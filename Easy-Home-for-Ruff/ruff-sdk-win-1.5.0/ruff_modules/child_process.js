/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

'use strict';

var util = require('util');
var EE = require('events');
var sigConstants = uv.get_sig_const();
var sigTable;

function _signumToSigid(signum) {
    if (!sigTable) {
        sigTable = {};
        for (var id in sigConstants) {
            var num = sigConstants[id];
            sigTable[num] = id;
        }
    }
    return sigTable[signum];
}

function _validEnv(env) {
    var envList = [];

    if (env === undefined) {
        env = process.env;
    }

    for (var key in env) {
        var envString = key + '=' + env[key];
        envList.push(envString);
    }

    return envList;
}

function _validateStdio(stdio, sync) {
    var ipc;
    var ipcFd;

    // Replace shortcut with an array
    if (util.isString(stdio)) {
        switch (stdio) {
            case 'ignore': stdio = ['ignore', 'ignore', 'ignore']; break;
            case 'pipe': stdio = ['pipe', 'pipe', 'pipe']; break;
            case 'inherit': stdio = [0, 1, 2]; break;
            default: throw new TypeError('Incorrect value of stdio option: ' + stdio);
        }
    } else if (!util.isArray(stdio)) {
        throw new TypeError('Incorrect value of stdio option: ' +
                            util.inspect(stdio));
    }

    // At least 3 stdio will be created
    // Don't concat() a new Array() because it would be sparse, and
    // stdio.reduce() would skip the sparse elements of stdio.
    // See http://stackoverflow.com/a/5501711/3561
    while (stdio.length < 3) {
        stdio.push(undefined);
    }

    // Translate stdio into C++-readable form
    // (i.e. PipeWraps or fds)
    stdio = stdio.reduce(function(acc, stdio, i) {
        function cleanup() {
            acc.filter(function(stdio) {
                return stdio.type === 'pipe' || stdio.type === 'ipc';
            }).forEach(function(stdio) {
                if (stdio.handle) {
                    stdio.handle.close();
                }
            });
        }

        // Defaults
        if (util.isNullOrUndefined(stdio)) {
            stdio = i < 3 ? 'pipe' : 'ignore';
        }

        if (stdio === null || stdio === 'ignore') {
            acc.push({type: 'ignore'});
        } else if (stdio === 'pipe' || util.isNumber(stdio) && stdio < 0) {
            var a = {
                type: 'pipe',
                readable: i === 0,
                writable: i !== 0
            };

            if (!sync) {
                a.handle = uv.new_pipe(false);
                acc.push(a);
            }
        } else if (stdio === 'ipc') {
            if (sync || !util.isUndefined(ipc)) {
                // Cleanup previously created pipes
                cleanup();
                if (!sync) {
                    throw Error('Child process can have only one IPC pipe');
                } else {
                    throw Error('You cannot use IPC with synchronous forks');
                }
            }

            ipc = uv.new_pipe(true);
            ipcFd = i;

            acc.push({
                type: 'pipe',
                handle: ipc,
                ipc: true
            });
        } else if (stdio === 'inherit') {
            acc.push({
                type: 'inherit',
                fd: i
            });
        } else if (util.isNumber(stdio) || util.isNumber(stdio.fd)) {
            acc.push({
                type: 'fd',
                fd: stdio.fd || stdio
            });
        } else {
            throw new TypeError('Incorrect value for stdio stream');
        }

        return acc;
    }, []);

    return {stdio: stdio, ipc: ipc, ipcFd: ipcFd};
}

function maybeClose(subprocess) {
    subprocess.emit('close', subprocess.exitCode, subprocess.signalCode);
}

function ChildProcess() {
    EE.call(this);
    var self = this;
    this._onExit = function(code, signalCode) {
        self.exitCode = code;
        self.signalCode = signalCode;

        self.emit('exit', self.exitCode, _signumToSigid(self.signalCode));

        maybeClose(self);
        uv.close(self._handle, function() {
            self._handle = null;
        });
    };
}

util.inherits(ChildProcess, EE);

ChildProcess.prototype.kill = function(signal) {
    var sig_id = signal || 'SIGTERM';
    var sig_num = sigConstants[sig_id];

    if (sig_num) {
        uv.kill_process(this._handle, sig_num);
    }
};

function ChildStdio(handle, isReadable, isWritable) {
    EE.call(this);
    this._handle    = handle;
    this._readable  = isReadable;
    this._writeable = isWritable;
    var self = this;

    if (this._readable) {
        uv.read_start(this._handle, function(error, data) {
            if (error) {
                self.emit('error', error);
            } else {
                if (data) {
                    self.emit('data', data);
                } else {
                    self.emit('close');
                    if (self._handle) {
                        uv.close(self._handle);
                        self._handle = null;
                    }
                }
            }
        });
    }
}

util.inherits(ChildStdio, EE);

ChildStdio.prototype.write = function(data, cb) {
    if (this._writeable) {
        uv.write(this._handle, data, cb);
    }
};

ChildStdio.prototype.end = function() {
    if (this._handle) {
        uv.close(this._handle);
    }
    this._handle = null;
};

ChildProcess.prototype.spawn = function(command, args, options) {
    options = options || {};
    options.stdio = options.stdio || ['pipe', 'pipe', 'pipe'];
    options.stdio = _validateStdio(options.stdio).stdio;
    options.env   = _validEnv(options.env);

    this._handle = uv.spawn(command, args, options, this._onExit);
    if (options.stdio[0].type === 'pipe') {
        this.stdin = new ChildStdio(options.stdio[0].handle, false, true);
    }

    if (options.stdio[1].type === 'pipe') {
        this.stdout = new ChildStdio(options.stdio[1].handle, true, false);
    }

    if (options.stdio[2].type === 'pipe') {
        this.stderr = new ChildStdio(options.stdio[2].handle, true, false);
    }

    return this;
};


exports.spawn = function(command, args, options) {
    var child = new ChildProcess();

    child.spawn(command, args, options);

    return child;
};

/*
var ls = new ChildProcess().spawn('ls', ['-lh', '/']);

ls.on('exit', function(code, signal) {
    console.log('ls exit with', code);
});

ls.stdout.on('data', function(data) {
    console.log('data .... :', data);
});

ls.stdout.on('close', function() {
    console.log('closing ...');
});

var ps = spawn('ps', ['ax']);
var grep = spawn('grep', ['tope']);

ps.stdout.on('data', function(data) {
    grep.stdin.write(data);
});

ps.on('exit', function() {
    grep.stdin.end();
});

grep.stdout.on('data', function(data) {
    console.log(data.toString());
});
*/
