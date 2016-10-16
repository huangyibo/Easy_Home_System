/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

'use strict';

var Stream = require('stream').Stream;
var Writable = Stream.Writable;
var util = require('util');
var binding = require('./binding.js');
var fs = require('./index.js');
var fsUtil = require('./util.js');

function WriteStream(path, options) {
    if (!(this instanceof WriteStream)) {
        return new WriteStream(path, options);
    }

    if (options === undefined) {
        options = {};
    } else if (typeof options === 'string') {
        options = {
            encoding: options
        };
    } else if (options === null || typeof options !== 'object') {
        throw new TypeError('options must be a string or an object');
    }
    options = Object.create(options);

    Writable.call(this, options);

    this.path = path;
    this.fd = options.fd === undefined ? null : options.fd;
    this.flags = options.flags === undefined ? 'w' : options.flags;
    this.mode = options.mode === undefined ? parseInt('0666', 8) : options.mode;

    this.start = options.start;
    this.pos = undefined;
    this.bytesWritten = 0;

    if (this.start !== undefined) {
        if (typeof this.start !== 'number') {
            throw new TypeError('start must be a Number');
        }
        if (this.start < 0) {
            throw new Error('start must be >= zero');
        }

        this.pos = this.start;
    }

    if (options.encoding) {
        this.setDefaultEncoding(options.encoding);
    }

    if (typeof this.fd !== 'number') {
        this.open();
    }

    // dispose on finish.
    this.once('finish', this.close);
}

util.inherits(WriteStream, Writable);

WriteStream.prototype.open = function () {
    fs.open(this.path, this.flags, this.mode, function (er, fd) {
        if (er) {
            this.destroy();
            this.emit('error', er);
            return;
        }

        this.fd = fd;
        this.emit('open', fd);
    }.bind(this));
};

WriteStream.prototype._write = function (data, encoding, cb) {
    if (!(data instanceof Buffer)) {
        return this.emit('error', new Error('Invalid data'));
    }
    if (typeof this.fd !== 'number') {
        return this.once('open', function () {
            this.pos = this.pos || 0;
            this._write(data, encoding, cb);
        });
    }
    var that = this;
    fs.write(this.fd, data, this.pos, function (er, bytes) {
        if (er) {
            that.destroy();
            return cb(er);
        }
        that.bytesWritten += bytes;
        cb();
    });

    if (this.pos !== undefined) {
        this.pos += data.length;
    }
};

function writev(fd, chunks, position, callback) {
    function wrapper(err, written) {
        // Retain a reference to chunks so that they can't be GC'ed too soon.
        callback(err, written || 0, chunks);
    }
    binding.write(fd, chunks.toString(), position, { oncomplete: wrapper });
}

WriteStream.prototype._writev = function (data, cb) {
    if (typeof this.fd !== 'number') {
        return this.once('open', function () {
            this._writev(data, cb);
        });
    }
    var that = this;
    var len = data.length;
    var chunks = new Array(len);
    var size = 0;

    for (var i = 0; i < len; i++) {
        var chunk = data[i].chunk;
        chunks[i] = chunk;
        size += chunk.length;
    }
    writev(this.fd, Buffer.concat(chunks, size), this.pos, function (er, bytes) {
        if (er) {
            that.destroy();
            return cb(er);
        }
        that.bytesWritten += bytes;
        cb();
    });

    if (this.pos !== undefined) {
        this.pos += size;
    }
};

WriteStream.prototype.destroy = function () {
    if (this.destroyed) {
        return;
    }
    this.destroyed = true;
    this.close();
};

WriteStream.prototype.close = function (cb) {
    var that = this;

    function close(fd) {
        fs.close(fd || that.fd, function (er) {
            if (er) {
                that.emit('error', er);
            } else {
                that.emit('close');
            }
        });
        that.fd = null;
    }

    if (cb) {
        this.once('close', cb);
    }
    if (this.closed || typeof this.fd !== 'number') {
        if (typeof this.fd !== 'number') {
            this.once('open', close);
            return;
        }
        return process.nextTick(this.emit.bind(this, 'close'));
    }
    this.closed = true;

    close();
};

// There is no shutdown() for files.
WriteStream.prototype.destroySoon = WriteStream.prototype.end;

exports.WriteStream = WriteStream;

// SyncWriteStream is internal. DO NOT USE.
// Temporary hack for process.stdout and process.stderr when piped to files.
function SyncWriteStream(fd, options) {
    Stream.call(this);

    options = options || {};

    this.fd = fd;
    this.writable = true;
    this.readable = false;
    this.autoClose = options.autoClose === undefined ? true : options.autoClose;
}

util.inherits(SyncWriteStream, Stream);

SyncWriteStream.prototype.write = function (data, arg1, arg2) {
    var encoding;
    var cb;

    // parse arguments
    if (arg1) {
        if (typeof arg1 === 'string') {
            encoding = arg1;
            cb = arg2;
        } else if (typeof arg1 === 'function') {
            cb = arg1;
        } else {
            throw new Error('bad arg');
        }
    }
    fsUtil.assertEncoding(encoding);

    // Change strings to buffers. SLOW
    if (typeof data === 'string') {
        data = new Buffer(data, encoding);
    }

    fs.writeSync(this.fd, data, 0, data.length);

    if (cb) {
        process.nextTick(cb);
    }

    return true;
};

SyncWriteStream.prototype.end = function (data, arg1, arg2) {
    if (data) {
        this.write(data, arg1, arg2);
    }
    this.destroy();
};

SyncWriteStream.prototype.destroy = function () {
    if (this.autoClose) {
        fs.closeSync(this.fd);
    }
    this.fd = null;
    this.emit('close');
    return true;
};

SyncWriteStream.prototype.destroySoon = SyncWriteStream.prototype.destroy;

exports.SyncWriteStream = SyncWriteStream;

exports.createWriteStream = function (path, options) {
    return new fs.WriteStream(path, options);
};
