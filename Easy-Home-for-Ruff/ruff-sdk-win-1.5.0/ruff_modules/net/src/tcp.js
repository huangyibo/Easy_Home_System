/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

'use strict';

function TCP(server) {
    this._tcp = uv.new_tcp();
    this.bytesRead = 0;

    if (server) {
        uv.accept(server, this._tcp);
    }
}

TCP.prototype.open = function open(fd) {
    uv.tcp_open(this._tcp, fd);
};

TCP.prototype.close = function close(callback) {
    uv.close(this._tcp, callback);
};

TCP.prototype.shutdown = function shutdown(callback) {
    uv.shutdown(this._tcp, callback);
};

TCP.prototype.readStop = function readStop() {
    uv.read_stop(this._tcp);
};

TCP.prototype.readStart = function readStart() {
    var that = this;

    uv.read_start(this._tcp, function (error, data) {
        if (data) {
            that.bytesRead += data.length;
        }

        that.onread(error, data);
    });
};

TCP.prototype.getsockname = function getsockname() {
    return uv.tcp_getsockname(this._tcp);
};

TCP.prototype.getpeername = function getpeername() {
    return uv.tcp_getpeername(this._tcp);
};

TCP.prototype.write = function write(data, callback) {
    uv.write(this._tcp, data, callback);
};

TCP.prototype.connect = function connect(address, port, callback) {
    uv.tcp_connect(this._tcp, address, port, callback);
};

TCP.prototype.bind = function bind(address, port) {
    uv.tcp_bind(this._tcp, address, port);
};

TCP.prototype.listen = function listen(backlog) {
    var that = this;

    uv.listen(this._tcp, backlog, function (error) {
        that.onconnection(error, new TCP(that._tcp));
    });
};

TCP.prototype.setSimultaneousAccepts = function setSimultaneousAccepts(enabled) {
    uv.tcp_simultaneous_accepts(enabled);
};

TCP.prototype.ref = function ref() {
    // TODO:
};

TCP.prototype.unref = function unref() {
    // TODO:
};

Object.defineProperties(TCP.prototype, {
    readable: {
        get: function () {
            return uv.is_readable(this._tcp);
        }
    },
    writable: {
        get: function () {
            return uv.is_writable(this._tcp);
        }
    }
});

module.exports = TCP;
