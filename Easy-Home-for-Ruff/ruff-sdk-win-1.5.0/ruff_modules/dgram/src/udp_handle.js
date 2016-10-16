/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

/* globals uv: false */
'use strict';

var exceptionWithHostPort = require('util')._exceptionWithHostPort;

function udp() {
    this.sock = null; // jshint ignore:line
}

function wrapTryCatch(cb) {
    return function() {
        try {
            cb.apply(this, arguments);
        } catch (e) {
            return e;
        }
    };
}

udp.prototype.bind = wrapTryCatch(function(address, port) {
    this.sock = uv.new_udp(); // jshint ignore:line
    uv.udp_bind(this.sock, address, port); // jshint ignore:line
});

udp.prototype.recvStart = wrapTryCatch(function() {
    var self = this.owner;
    uv.udp_recv_start(this.sock, function(err, nread, data, rinfo) { // jshint ignore:line
        rinfo.size = data.length; // compatibility
        rinfo.address = rinfo.ip;
        if (err || nread < 0) {
            self.emit('error', exceptionWithHostPort(err || new Error('nread < 0'), 'send', rinfo.address, rinfo.port));
        } else {
            self.emit('message', new Buffer(data), rinfo);
        }
    });
});

udp.prototype.recvStop = wrapTryCatch(function() {
    uv.udp_recv_stop(this.sock); // jshint ignore:line
});

udp.prototype.send = wrapTryCatch(function(buffer, offset, length, port, ip, callback) {
    var cb = function(err) {
        if (callback) {
            if (err) {
                err = exceptionWithHostPort(err, 'send', ip, port);
            }
            callback.call(null, err, length);
        }
    };
    uv.udp_send(this.sock, buffer.toString().slice(offset, offset + length), ip, port, cb); // jshint ignore:line
});

udp.prototype.getsockname = wrapTryCatch(function(options) {
    var sock = uv.udp_getsockname(this.sock); // jshint ignore:line
    options.family = sock.family;
    options.address = sock.ip;
    options.port = sock.port;
});

udp.prototype.close = wrapTryCatch(function() {
    if (this.sock) {
        uv.close(this.sock);
    }
});

exports.UDP = udp;
