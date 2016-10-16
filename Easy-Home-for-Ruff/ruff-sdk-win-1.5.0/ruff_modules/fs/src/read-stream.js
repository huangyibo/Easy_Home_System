/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

/* jshint ignore:start */
'use strict';

var Stream = require('stream').Stream;
var Readable = Stream.Readable;
var util = require('util');
var fs = require('./index.js');

var pool;
var kMinPoolSpace = 128;

function allocNewPool(poolSize) {
    pool = new Buffer(poolSize);
    pool.used = 0;
}

function ReadStream(path, options) {
    if (!(this instanceof ReadStream)) {
        return new ReadStream(path, options);
    }

    if (options === undefined) {
        options = {};
    } else if (typeof options === 'string') {
        options = { encoding: options };
    } else if (options === null || typeof options !== 'object') {
        throw new TypeError('"options" argument must be a string or an object');
    }

    // a little bit bigger buffer and water marks by default
    options = Object.create(options);
    if (options.highWaterMark === undefined) {
        options.highWaterMark = 64 * 1024;
    }

    Readable.call(this, options);

    this.path = path;
    this.fd = options.fd === undefined ? null : options.fd;
    this.flags = options.flags === undefined ? 'r' : options.flags;
    this.mode = options.mode === undefined ? parseInt('666', 8) : options.mode;

    this.start = options.start;
    this.end = options.end;
    this.autoClose = options.autoClose === undefined ? true : options.autoClose;
    this.pos = undefined;

    if (this.start !== undefined) {
        if (typeof this.start !== 'number') {
            throw new TypeError('"start" option must be a Number');
        }
        if (this.end === undefined) {
            this.end = Infinity;
        } else if (typeof this.end !== 'number') {
            throw new TypeError('"end" option must be a Number');
        }

        if (this.start > this.end) {
            throw new Error('"start" option must be <= "end" option');
        }

        this.pos = this.start;
    }

    if (typeof this.fd !== 'number') {
        this.open();
    }

    this.on('end', function () {
        if (this.autoClose) {
            this.destroy();
        }
    });
}

util.inherits(ReadStream, Readable);

ReadStream.prototype.open = function () {
    var that = this;
    fs.open(this.path, this.flags, this.mode, function (er, fd) {
        if (er) {
            if (that.autoClose) {
                that.destroy();
            }
            that.emit('error', er);
            return;
        }
        that.fd = fd;
        that.emit('open', fd);
        // start the flow of data.
        that.read();
    });
};

ReadStream.prototype._read = function (n) {
    if (typeof this.fd !== 'number') {
        return this.once('open', function () {
            this._read(n);
        });
    }

    if (this.destroyed) {
        return;
    }

    if (!pool || pool.length - pool.used < kMinPoolSpace) {
        // discard the old pool.
        pool = null;
        allocNewPool(this._readableState.highWaterMark);
    }

    // Grab another reference to the pool in the case that while we're
    // in the thread pool another read() finishes up the pool, and
    // allocates a new one.
    var thisPool = pool;
    var toRead = Math.min(pool.length - pool.used, n);
    var start = pool.used;

    if (this.pos !== undefined) {
        toRead = Math.min(this.end - this.pos + 1, toRead);
    }

    // already read everything we were supposed to read!
    // treat as EOF.
    if (toRead <= 0) {
        return this.push(null);
    }

    // the actual read.
    var that = this;
    fs.read(this.fd, pool, pool.used, toRead, typeof this.pos === 'number' ? this.pos : -1, onread);

    // move the pool positions, and internal position for reading.
    if (this.pos !== undefined) {
        this.pos += toRead;
    }

    pool.used += toRead;

    function onread(er, bytesRead) {
        if (er) {
            if (that.autoClose) {
                that.destroy();
            }
            that.emit('error', er);
        } else {
            var b = null;

            if (bytesRead > 0) {
                b = thisPool.slice(start, start + bytesRead);
            }

            that.push(b);
        }
    }
};

ReadStream.prototype.destroy = function () {
    if (this.destroyed) {
        return;
    }
    this.destroyed = true;
    this.close();
};

ReadStream.prototype.close = function (cb) {
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

    var that = this;
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

exports.ReadStream = ReadStream;

exports.createReadStream = function (path, options) {
    return new ReadStream(path, options);
};
