/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

/* jshint ignore:start */
'use strict';

var pathModule = require('path');
var util = require('util');

var binding = require('./binding.js');
var fsUtil = require('./util.js');

var kMaxLength = require('buffer').kMaxLength;
var kReadFileBufferLength = 8 * 1024;

var MODE_666 = parseInt('666', 8);
var MODE_777 = parseInt('777', 8);

var fs = exports;

// Static method to set the stats properties on a Stats object.
fs.Stats = function (mode, uid, gid, size, atime, mtime, ctime, type) {
    this.mode = mode;
    this.uid = uid;
    this.gid = gid;
    this.size = size;
    this.atime = new Date(atime * 1000);
    this.mtime = new Date(mtime * 1000);
    this.ctime = new Date(ctime * 1000);
    this.type = type;
};

fs.Stats.prototype.isDirectory = function () {
    return this.type === 'directory';
};

fs.Stats.prototype.isFile = function () {
    return this.type === 'file';
};

fs.Stats.prototype.isBlockDevice = function () {
    return this.type === 'block';
};

fs.Stats.prototype.isCharacterDevice = function () {
    return this.type === 'char';
};

fs.Stats.prototype.isSymbolicLink = function () {
    return this.type === 'link';
};

fs.Stats.prototype.isFIFO = function () {
    return this.type === 'fifo';
};

fs.Stats.prototype.isSocket = function () {
    return this.type === 'socket';
};

fs.exists = function (path, callback) {
    function cb(err) {
        if (callback) {
            callback(!err);
        }
    }
    if (!fsUtil.nullCheck(path, cb)) {
        return;
    }
    binding.stat(pathModule._makeLong(path), { oncomplete: cb });
};

fs.existsSync = function (path) {
    try {
        fsUtil.nullCheck(path);
        binding.stat(pathModule._makeLong(path));
        return true;
    } catch (e) {
        return false;
    }
};

fs.stat = function (path, callback) {
    callback = fsUtil.makeCallback(callback);
    if (!fsUtil.nullCheck(path, callback)) {
        return;
    }
    binding.stat(pathModule._makeLong(path), { oncomplete: callback });
};

fs.statSync = function (path) {
    fsUtil.nullCheck(path);
    return binding.stat(pathModule._makeLong(path));
};

fs.fstat = function (fd, callback) {
    binding.fstat(fd, { oncomplete: fsUtil.makeCallback(callback) });
};

fs.fstatSync = function (fd) {
    return binding.fstat(fd);
};

function readFileAfterRead(err, bytesRead) {
    var context = this.context; // jshint ignore:line

    if (err) {
        return context.close(err);
    }

    if (bytesRead === 0) {
        return context.close();
    }

    context.pos += bytesRead;

    if (context.size === context.pos) {
        return context.close();
    }

    if (context.size === 0) {
        // unknown size, just read until we don't get bytes.
        context.buffers.push(context.buffer.slice(0, bytesRead));
    }

    context.read();
}

function readFileAfterClose(err) {
    var context = this.context; // jshint ignore:line
    var buffer = null;
    var callback = context.callback;

    if (context.err) {
        return callback(context.err);
    }

    if (context.size === 0) {
        buffer = Buffer.concat(context.buffers, context.pos);
    } else if (context.pos < context.size) {
        buffer = context.buffer.slice(0, context.pos);
    } else {
        buffer = context.buffer;
    }

    if (context.encoding) {
        buffer = buffer.toString(context.encoding);
    }

    callback(err, buffer);
}

function ReadFileContext(callback, encoding, binding) {
    this.fd = undefined;
    this.size = undefined;
    this.callback = callback;
    this.buffers = null;
    this.buffer = null;
    this.pos = 0;
    this.encoding = encoding;
    this.err = null;
    this.binding = binding;
}

ReadFileContext.prototype.read = function () {
    var buffer;
    var offset;
    var length;

    if (this.size === 0) {
        buffer = this.buffer = new Buffer(kReadFileBufferLength);
        offset = 0;
        length = kReadFileBufferLength;
    } else {
        buffer = this.buffer;
        offset = this.pos;
        length = this.size - this.pos;
    }

    var req = { oncomplete: readFileAfterRead };
    req.context = this;

    this.binding.read(this.fd, buffer, offset, length, offset, req);
};

ReadFileContext.prototype.close = function (err) {
    this.err = err;

    var req = { oncomplete: readFileAfterClose };
    req.context = this;

    this.binding.close(this.fd, req);
};

function readFileAfterStat(err, st) {
    var context = this.context; // jshint ignore:line

    if (err) {
        return context.close(err);
    }

    var size = context.size = st.isFile() ? st.size : 0;

    if (size === 0) {
        context.buffers = [];
        context.read();
        return;
    }

    if (size > kMaxLength) {
        err = new RangeError('File size is greater than possible Buffer: 0x' + kMaxLength.toString(16) + 'bytes');
        return context.close(err);
    }

    context.buffer = new Buffer(size);
    context.read();
}

function readFileAfterOpen(err, fd) {
    var context = this.context; // jshint ignore:line

    if (err) {
        context.callback(err);
        return;
    }

    context.fd = fd;

    var req = { oncomplete: readFileAfterStat };
    req.context = context;

    binding.fstat(fd, req);
}

fs.readFile = function (path, options) {
    var callback = fsUtil.maybeCallback(arguments[arguments.length - 1]);
    options = fsUtil.converterReadOptions(options);

    if (!fsUtil.nullCheck(path, callback)) {
        return;
    }

    var req = { oncomplete: readFileAfterOpen };
    req.context = new ReadFileContext(callback, options.encoding, binding);

    binding.open(pathModule._makeLong(path), options.flag, MODE_666, req);
};

fs.openSync = function (path, flag, mode) {
    return binding.open(pathModule._makeLong(path), flag, mode || MODE_666);
};

fs.closeSync = function (fd) {
    return binding.close(fd);
};

function getFileSize(fd) {
    return fsUtil.withCloseWhenError(fs, fd, function () {
        var st = fs.fstatSync(fd);
        return st.isFile() ? st.size : 0;
    });
}

function getBuffer(size, fd) {
    if (size > 0) {
        return fsUtil.withCloseWhenError(fs, fd, function () {
            return new Buffer(size);
        });
    }
}

fs.readSync = function (fd, buffer, offset, length, position) {
    return binding.read(fd, buffer, offset, length, position);
};

fs.readFileSync = function (path, options) {
    options = fsUtil.converterReadOptions(options);
    var fd = fs.openSync(path, options.flag || 'r', MODE_666);
    var size = getFileSize(fd);
    var buffer = getBuffer(size, fd); // single buffer with file data
    var buffers = []; // list for when size is unknown
    var pos = 0;
    fsUtil.withCloseWhenError(fs, fd, function () {
        var done = false;
        var bytesRead;
        while (!done) {
            if (size !== 0) {
                bytesRead = fs.readSync(fd, buffer, pos, size - pos, pos);
            } else {
                // the kernel lies about many files.
                // Go ahead and try to read some bytes.
                buffer = new Buffer(8192);
                bytesRead = fs.readSync(fd, buffer, pos, 8192, pos);
                if (bytesRead) {
                    buffers.push(buffer.slice(0, bytesRead));
                }
            }
            pos += bytesRead;
            done = (bytesRead === 0) || (size !== 0 && pos >= size);
        }
    });

    fs.closeSync(fd);

    if (size === 0) {
        // data was collected into the buffers list.
        buffer = Buffer.concat(buffers, pos);
    } else if (pos < size) {
        buffer = buffer.slice(0, pos);
    }

    if (options.encoding) {
        buffer = buffer.toString(options.encoding);
    }
    return buffer;
};

fs.open = function (path, flags, mode) {
    var callback = fsUtil.makeCallback(arguments[arguments.length - 1]);
    if (!fsUtil.nullCheck(path, callback)) {
        return;
    }

    binding.open(pathModule._makeLong(path), flags, mode, { oncomplete: callback });
};

fs.read = function (fd, buffer, offset, length, position, callback) {
    function wrapper(err, bytesRead) {
        // Retain a reference to buffer so that it can't be GC'ed too soon.
        if (callback) {
            callback(err, bytesRead || 0, buffer);
        }
    }

    binding.read(fd, buffer, offset, length, position, { oncomplete: wrapper });
};

fs.readdir = function (path, callback) {
    util.assertCallback(callback);
    uv.fs_scandir(path, function (ent, err) {
        if (err) {
            callback(err);
        } else {
            var items = [];
            while (true) {
                var item = uv.fs_scandir_next(ent);
                if (!item) {
                    break;
                }
                items.push(item.name);
            }
            callback(null, items);
        }
    });
};

fs.readdirSync = function (path) {
    var items = [];
    for (var ent = uv.fs_scandir(path); ent; ) {
        var item = uv.fs_scandir_next(ent);
        if (!item) {
            break;
        }
        items.push(item.name);
    }
    return items;
};

fs.close = function (fd, callback) {
    binding.close(fd, { oncomplete: fsUtil.makeCallback(callback) });
};

// usage:
//  fs.write(fd, buffer, offset, length[, position], callback);
// OR
//  fs.write(fd, string[, position[, encoding]], callback);
fs.write = function (fd, buffer, offset, length, position, callback) {
    if (!(buffer instanceof Buffer) && typeof buffer !== 'string') {
        buffer = String(buffer);
    }

    if (typeof length === 'number') {
        // fs.writeSync(fd, buffer, offset, length[, position], callback);
        var end = offset + length;

        if (typeof position === 'function') {
            callback = position;
            position = undefined;
        }

        if (typeof buffer === 'string') {
            buffer = new Buffer(buffer);
        }

        buffer = buffer.slice(offset, end);
    } else {
        // fs.write(fd, string[, position[, encoding]], callback);
        var encoding;

        if (typeof offset === 'function') {
            callback = offset;
            position = undefined;
        } else if (typeof length === 'function') {
            callback = length;
            position = offset;
        } else {
            callback = position;
            position = offset;
            encoding = length;
        }

        if (typeof buffer === 'string') {
            buffer = new Buffer(buffer, encoding);
        }
    }

    callback = fsUtil.maybeCallback(callback);

    return binding.write(fd, util._toDuktapeBuffer(buffer), position || 0, {
        oncomplete: oncomplete
    });

    function oncomplete(error, written) {
        // Retain a reference to buffer so that it can't be GC'ed too soon.
        callback(error, written || 0, buffer);
    }
};

// usage:
//  fs.writeSync(fd, buffer, offset, length[, position]);
// OR
//  fs.writeSync(fd, string[, position[, encoding]]);
fs.writeSync = function (fd, buffer, offset, length, position) {
    if (!(buffer instanceof Buffer) && typeof buffer !== 'string') {
        buffer = String(buffer);
    }

    if (typeof length === 'number') {
        // fs.writeSync(fd, buffer, offset, length[, position]);
        var end = offset + length;

        if (typeof buffer === 'string') {
            buffer = new Buffer(buffer);
        }

        buffer = buffer.slice(offset, end);
    } else {
        // fs.write(fd, string[, position[, encoding]], callback);
        position = offset; // args[2]
        var encoding = length; // args[3]

        if (typeof buffer === 'string') {
            buffer = new Buffer(buffer, encoding);
        }
    }

    buffer = util._toDuktapeBuffer(buffer);

    return binding.write(fd, buffer, position || 0);
};

function writeAll(fd, buffer, position, callback) {
    fs.write(fd, buffer, position, function (error, written) {
        if (error) {
            fs.close(fd, function () {
                if (callback) {
                    callback(error);
                }
            });

            return;
        }

        if (written === buffer.length) {
            fs.close(fd, callback);
        } else {
            position += written;
            writeAll(fd, buffer.slice(written), position, callback);
        }
    });
}

fs.writeFile = function (path, data, options) {
    var callback = fsUtil.maybeCallback(arguments[arguments.length - 1]);

    options = fsUtil.converterWriteOptions(options, MODE_666);

    fs.open(path, options.flag || 'w', options.mode,
        fsUtil.callErrorWhenError(callback, function (openErr, fd) {
            var buffer = data instanceof Buffer ?
                data : new Buffer(data, options.encoding || 'utf8');

            writeAll(fd, buffer, 0, callback);
        }));
};

fs.writeFileSync = function (path, data, options) {
    options = fsUtil.converterWriteOptions(options, MODE_666);

    if (!(data instanceof Buffer)) {
        data = new Buffer(data, options.encoding || 'utf8');
    }

    var fd = fs.openSync(path, options.flag || 'w', options.mode);

    fsUtil.withCloseWhenError(fs, fd, function () {
        var offset = 0;

        while (data.length - offset > 0) {
            offset += fs.writeSync(fd, data, offset);
        }
        fs.closeSync(fd);
    });
};

fs.appendFile = function (path, data, options) {
    var callback = fsUtil.maybeCallback(arguments[arguments.length - 1]);
    options = fsUtil.converterAppendOptions(options, MODE_666);

    fs.open(path, options.flag || 'a', options.mode,
        fsUtil.callErrorWhenError(callback, function (openErr, fd) {
            fs.fstat(fd, fsUtil.callErrorWhenError(callback, function (statErr, stat) {
                var buffer = data instanceof Buffer ?
                    data : new Buffer(String(data), options.encoding || 'utf8');
                writeAll(fd, buffer, stat.size, callback);
            }));
        }));
};

fs.appendFileSync = function (path, data, options) {
    options = fsUtil.converterAppendOptions(options, MODE_666);

    if (!(data instanceof Buffer)) {
        data = new Buffer(data, options.encoding || 'utf8');
    }

    var fd = fs.openSync(path, options.flag || 'w', options.mode);
    fsUtil.withCloseWhenError(fs, fd, function () {
        var offset = 0;
        var pos = getFileSize(fd);
        while (data.length - offset > 0) {
            offset += fs.writeSync(fd, data.slice(offset), pos + offset);
        }
        fs.closeSync(fd);
        return offset;
    });
};

fs.rename = function (oldPath, newPath, callback) {
    callback = fsUtil.makeCallback(callback);
    if (!fsUtil.nullCheck(oldPath, callback)) {
        return;
    }
    if (!fsUtil.nullCheck(newPath, callback)) {
        return;
    }
    binding.rename(pathModule._makeLong(oldPath),
        pathModule._makeLong(newPath),
        { oncomplete: callback });
};

fs.renameSync = function (oldPath, newPath) {
    fsUtil.nullCheck(oldPath);
    fsUtil.nullCheck(newPath);
    return binding.rename(pathModule._makeLong(oldPath),
        pathModule._makeLong(newPath));
};

fs.unlink = function (path, callback) {
    callback = fsUtil.makeCallback(callback);
    if (!fsUtil.nullCheck(path, callback)) {
        return;
    }
    binding.unlink(pathModule._makeLong(path), { oncomplete: callback });
};

fs.unlinkSync = function (path) {
    fsUtil.nullCheck(path);
    return binding.unlink(pathModule._makeLong(path));
};

fs.mkdir = function (path, mode, callback) {
    if (typeof mode === 'function') {
        callback = mode;
        mode = MODE_777;
    }
    binding.mkdir(pathModule._makeLong(path), mode || MODE_777, { oncomplete: fsUtil.makeCallback(callback) });
};

fs.mkdirSync = function (path, mode) {
    fsUtil.nullCheck(path);
    return binding.mkdir(pathModule._makeLong(path), mode || MODE_777);
};

fs.rmdir = function (path, callback) {
    callback = fsUtil.maybeCallback(callback);
    if (!fsUtil.nullCheck(path, callback)) {
        return;
    }
    binding.rmdir(pathModule._makeLong(path), { oncomplete: callback });
};

fs.rmdirSync = function (path) {
    fsUtil.nullCheck(path);
    return binding.rmdir(pathModule._makeLong(path));
};

var lazyExports = [
    {
        keys: [
            'access',
            'lstat',
            'ftruncate',
            'truncate',
            'readlink',
            'symlink',
            'link',
            'fchmod',
            'chmod',
            'fchown',
            'chown',
            'utimes',
            'futimes',
            'fdatasync',
            'fsync',
            'realpath'
        ],
        module: './level-2-async.js'
    },
    {
        keys: [
            'accessSync',
            'lstatSync',
            'ftruncateSync',
            'truncateSync',
            'readlinkSync',
            'symlinkSync',
            'linkSync',
            'fchmodSync',
            'chmodSync',
            'fchownSync',
            'chownSync',
            'utimesSync',
            'futimesSync',
            'fdatasyncSync',
            'fsyncSync',
            'realpathSync'
        ],
        module: './level-2-sync.js'
    },
    {
        keys: ['ReadStream', 'createReadStream'],
        module: './read-stream.js'
    },
    {
        keys: ['WriteStream', 'SyncWriteStream', 'createWriteStream'],
        module: './write-stream.js'
    }
];

for (var i = 0; i < lazyExports.length; i++) {
    var info = lazyExports[i];
    addExportProxies(info.keys, info.module);
}

function addExportProxies(keys, moduleName) {
    keys.forEach(function (key) {
        Object.defineProperty(fs, key, {
            get: function () {
                applyExports(keys, moduleName);
                return fs[key];
            },
            set: function (value) {
                var index = keys.indexOf(key);
                keys.splice(index, 1);

                Object.defineProperty(this, key, {
                    value: value,
                    writable: true,
                    enumerable: true,
                    configurable: true
                });
            },
            enumerable: true,
            configurable: true
        });
    });
}

function applyExports(keys, moduleName) {
    var module = require(moduleName);

    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];

        Object.defineProperty(fs, key, {
            value: module[key],
            writable: true,
            enumerable: true,
            configurable: true
        });
    }
}
