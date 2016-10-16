/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

'use strict';

var Buffer = require('buffer').Buffer;
var util = require('util');
var EventEmitter = require('events');

var UDP = require('./udp_handle.js').UDP;
var errnoException = util._errnoException;
var exceptionWithHostPort = util._exceptionWithHostPort;

var BIND_STATE_UNBOUND = 0;
var BIND_STATE_BINDING = 1;
var BIND_STATE_BOUND = 2;

function _healthCheck(socket) {
    if (!socket._handle) {
        throw new Error('Not running'); // error message from dgram_legacy.js
    }
}

function _sendParamCheck(buffer, offset, length, port, address) {
    if (!(buffer instanceof Buffer)) {
        throw new TypeError('First argument must be a buffer or string.');
    }

    if (typeof offset !== 'number' || typeof length !== 'number') {
        throw new Error('send takes offset and length as args 2 and 3');
    }

    if (offset < 0) {
        throw new RangeError('Offset should be >= 0');
    }

    if ((length === 0 && offset > buffer.length) || (length > 0 && offset >= buffer.length)) {
        throw new RangeError('Offset into buffer too large');
    }

    // Sending a zero-length datagram is kind of pointless but it _is_
    // allowed, hence check that length >= 0 rather than > 0.
    if (length < 0) {
        throw new RangeError('Length should be >= 0');
    }

    if (offset + length > buffer.length) {
        throw new RangeError('Offset + length beyond buffer length');
    }

    if (typeof address !== 'string') {
        throw new Error(' sockets must send to port, address');
    }

    if (port <= 0 || port > 65535) {
        throw new RangeError('Port should be > 0 and < 65536');
    }
}

function _stopReceiving(socket) {
    if (!socket._receiving) {
        return;
    }
    socket._handle.recvStop();
    socket._receiving = false;
}

function _startListening(socket) {
    // Todo: handle errors
    socket._handle.recvStart();
    socket._receiving = true;
    socket._bindState = BIND_STATE_BOUND;
    socket.emit('listening');
}

function _sendAfterBound(self, data) {
    if (!self._sendQueue) {
        self._sendQueue = [];
        self.once('listening', function() {
            // Flush the send queue.
            for (var i = 0; i < self._sendQueue.length; i++) {
                self.send.apply(self, self._sendQueue[i]);
            }
            self._sendQueue = undefined;
        });
    }
    self._sendQueue.push(data);
}

function _replaceHandle(self, newHandle) {
    newHandle.bind = self._handle.bind;
    newHandle.send = self._handle.send;
    newHandle.owner = self;
    self._handle.close();
    self._handle = newHandle;
}

function _bindAddress(self, option, arg1) {
    var address;
    var port;

    if (option !== null && typeof option === 'object') {
        address = option.address || '0.0.0.0';
        port = option.port;
    } else {
        address = (!arg1 || typeof arg1 === 'function') ? '0.0.0.0' : arg1;
        port = option;
    }

    var err = self._handle.bind(address, port || 0);
    if (err) {
        return exceptionWithHostPort(err, 'bind', address, port);
    }
}

function Socket(listener) {
    EventEmitter.call(this);

    var handle = new UDP();
    handle.owner = this;

    this._handle = handle;
    this._receiving = false;
    this._bindState = BIND_STATE_UNBOUND;

    if (typeof listener === 'function') {
        this.on('message', listener);
    }
}

util.inherits(Socket, EventEmitter);

Socket.prototype.bind = function(option) {
    var self = this;

    _healthCheck(self);

    if (this._bindState !== BIND_STATE_UNBOUND) {
        throw new Error('Socket is already bound');
    }

    this._bindState = BIND_STATE_BINDING;

    if (typeof arguments[arguments.length - 1] === 'function') {
        self.once('listening', arguments[arguments.length - 1]);
    }

    var err;
    if (option instanceof UDP) {
        err = _replaceHandle(self, option);
    } else {
        err = _bindAddress(self, option, arguments[1]);
    }

    if (err) {
        self.emit('error', err);
        self._bindState = BIND_STATE_UNBOUND;
        return;
    }

    _startListening(self);

    return self;
};

Socket.prototype.send = function(buffer, offset, length, port, address, callback) {
    var self = this;

    if (typeof buffer === 'string') {
        buffer = new Buffer(buffer);
    }
    if (typeof callback !== 'function') {
        callback = undefined;
    }
    offset = offset | 0;
    length = length | 0;
    port = port | 0;

    _sendParamCheck(buffer, offset, length, port, address);

    _healthCheck(self);

    if (self._bindState === BIND_STATE_UNBOUND) {
        self.bind(0, null);
    }

    // If the socket hasn't been bound yet, push the outbound packet onto the
    // send queue and send after binding is complete.
    if (self._bindState !== BIND_STATE_BOUND) {
        // If the send queue hasn't been initialized yet, do it, and install an
        // event handler that flushes the send queue after binding is done.
        _sendAfterBound(self, [buffer, offset, length, port, address, callback]);
        return;
    }

    var err = self._handle.send(buffer, offset, length, port, address, callback);
    if (err && callback) {
        var ex = exceptionWithHostPort(err, 'send', address, port);
        process.nextTick(callback, ex);
    }
};

Socket.prototype.close = function(callback) {
    if (typeof callback === 'function') {
        this.on('close', callback);
    }
    var self = this;
    _healthCheck(self);
    _stopReceiving(self);
    self._handle.close();
    self._handle = null;
    process.nextTick(function() {
        self.emit('close');
    });

    return this;
};

Socket.prototype.address = function() {
    _healthCheck(this);

    var out = {};
    var err = this._handle.getsockname(out);
    if (err) {
        throw errnoException(err, 'getsockname');
    }

    return out;
};

exports.Socket = Socket;
