'use strict';

var net = require('net');
var util = require('util');
var mbedtls = require('./tls.so');

var Socket = net.Socket;
var slice = Array.prototype.slice;

function noOp() { }

function TLSSocket(socket, options) {
    if (options === undefined) {
        this._tlsOptions = {};
    } else {
        this._tlsOptions = options;
    }

    if (options.isServer && socket instanceof Socket) {
        Socket.call(this, {
            handle: socket._handle
        });

        this._parent = socket;
    } else {
        Socket.call(this);
    }

    this._init();
}

util.inherits(TLSSocket, Socket);

TLSSocket.prototype._init = function () {
    var options = this._tlsOptions;

    this.authorized = true;
    this.authorizationError = null;
    this.encrypted = true;

    this._requestCert = !!options.requestCert;
    this._rejectUnauthorized = !!options.rejectUnauthorized;
    this.isServer = options.isServer;

    if (!this.isServer && options.rejectUnauthorized === undefined) {
        this._rejectUnauthorized = true;
    }

    this._tlsHandle = undefined;
    this._encryptedData = Buffer.alloc(0);

    this._pendingChunks = [];
    this._pendingEncodings = [];
    this._pendingCallbacks = [];
};

TLSSocket.prototype._tlsWrite = function (data) {
    mbedtls.write(this._tlsHandle, util._toDuktapeBuffer(data));
};

TLSSocket.prototype._writePendingChunks = function () {
    for (var i = 0; i < this._pendingChunks.length; i++) {
        this._tlsWrite(
            this._pendingChunks[i],
            this._pendingEncodings[i],
            this._pendingCallbacks[i]
        );
    }

    this._pendingChunks =
    this._pendingEncodings =
    this._pendingCallbacks = undefined;
};

TLSSocket.prototype._write = function (chunk, encoding, callback) {
    this._pendingChunks.push(chunk);
    this._pendingEncodings.push(encoding);
    this._pendingCallbacks.push(callback);
};

TLSSocket.prototype.push = function (chunk, encoding) {
    var push = Socket.prototype.push;

    if (chunk === null) {
        return push.call(this, chunk);
    }

    if (typeof chunk === 'string') {
        chunk = new Buffer(chunk, encoding);
    }

    this._encryptedData = Buffer.concat([this._encryptedData, chunk]);

    while (true) {
        var ret = mbedtls.read(this._tlsHandle, chunk.length);

        if (ret instanceof Duktape.Buffer) {
            push.call(this, new Buffer(ret));
            continue;
        }

        switch (ret) {
            case mbedtls.SSL_HANDSHAKE_OVER:
                this._write = Socket.prototype._write;
                this.write = this._tlsWrite;

                this._tlsVersion = mbedtls.get_version(this._tlsHandle);
                this._tlsCipher = mbedtls.get_ciphersuite(this._tlsHandle);

                if (this._requestCert) {
                    this._tlsPeerCertificate = mbedtls.get_peercert(this._tlsHandle);
                }

                this.emit('_secure');
                this._writePendingChunks();

                continue;
            case mbedtls.ERR_CERT_VERIFY_FAILED:
                this.authorized = false;

                if (!this._rejectUnauthorized) {
                    continue;
                }

                this.authorizationError = new Error('unauthorized peer certificate');
                this.emit('_tlsError', this.authorizationError);

                return true;
            case mbedtls.ERR_SSL_WANT_READ:
                return true;
            case mbedtls.ERR_SSL_PEER_CLOSE:
                mbedtls.cleanup(this._tlsHandle);

                if (!this.isServer) {
                    this.destroy();
                }

                return true;
            case mbedtls.EOF:
                this.emit('end');
                return true;
            default:
                this.authorizationError = new Error('return value (' + ret + ') error');
                this.emit('_tlsError', this.authorizationError);
                return true;
        }
    }
};

TLSSocket.prototype._sendCallback = function (data) {
    Socket.prototype._write.call(this, new Buffer(data), undefined, noOp);
};

TLSSocket.prototype._receiveCallback = function (length) {
    var resultData = this._encryptedData.slice(0, length);
    this._encryptedData = this._encryptedData.slice(length, this._encryptedData.length);
    return resultData;
};

TLSSocket.prototype.getCipher = function () {
    return this._tlsCipher;
};

TLSSocket.prototype.getProtocol = function () {
    return this._tlsVersion;
};

TLSSocket.prototype.getPeerCertificate = function () {
    return this._tlsPeerCertificate;
};

TLSSocket.prototype.destroy = function () {
    Socket.prototype.destroy.call(this);
    if (this.isServer) {
        this._parent._handle = null;
        this._parent.destroy();
    }
};

exports.TLSSocket = TLSSocket;

function Server(/* [options], listener */) {
    var options;
    var listener;

    if (arguments[0] !== null && typeof arguments[0] === 'object') {
        options = arguments[0];
        listener = arguments[1];
    }

    var that = this;

    this.setOptions(options);

    net.Server.call(this, function (rawSocket) {
        var socket = new TLSSocket(rawSocket, {
            isServer: true,
            server: that,
            requestCert: that.requestCert,
            rejectUnauthorized: that.rejectUnauthorized
        });

        socket._tlsHandle = mbedtls.init_server();

        if (socket._requestCert) {
            mbedtls.config_cacert(socket._tlsHandle, that.ca);
            mbedtls.config_authmode(socket._tlsHandle, mbedtls.SSL_VERIFY_REQUIRED);
        }

        mbedtls.config_owncert(socket._tlsHandle, that.cert);
        mbedtls.config_ownkey(socket._tlsHandle, that.key);
        mbedtls.config_bio(
            socket._tlsHandle,
            socket._receiveCallback.bind(socket),
            socket._sendCallback.bind(socket)
        );
        mbedtls.apply_config(socket._tlsHandle);

        socket.on('_secure', function () {
            if (!this.destroyed) {
                that.emit('secureConnection', this);
            }
        });

        socket.on('close', function () {
            mbedtls.cleanup(this._tlsHandle);
        });

        socket.on('_tlsError', function (err) {
            this.destroy();
            that.emit('tlsClientError', err, this);
        });
    });

    if (listener) {
        this.on('secureConnection', listener);
    }
}

util.inherits(Server, net.Server);

Server.prototype.setOptions = function (options) {
    if (typeof options.requestCert === 'boolean') {
        this.requestCert = options.requestCert;
    } else {
        this.requestCert = false;
    }

    if (typeof options.rejectUnauthorized === 'boolean') {
        this.rejectUnauthorized = options.rejectUnauthorized;
    } else {
        this.rejectUnauthorized = false;
    }

    if (options.key) {
        this.key = options.key;
    }

    if (options.cert) {
        this.cert = options.cert;
    }

    if (options.ca) {
        this.ca = options.ca;
    }
};

exports.Server = Server;

exports.createServer = function (options, listener) {
    return new Server(options, listener);
};

exports.connect = function (/* [port, host], options, cb */) {
    var args = normalizeConnectArgs(slice.call(arguments));
    var options = args[0];
    var cb = args[1];

    var socket = new TLSSocket(options.socket, {
        isServer: false,
        requestCert: true,
        rejectUnauthorized: options.rejectUnauthorized
    });

    if (cb) {
        socket.once('secureConnect', cb);
    }

    if (!options.socket) {
        var connectOptions = {
            port: options.port,
            host: options.host
        };

        socket.connect(connectOptions, function () {
            socket._tlsHandle = mbedtls.init_client();

            mbedtls.config_cacert(socket._tlsHandle, options.ca);

            if (options.cert !== undefined && options.key !== undefined) {
                mbedtls.config_owncert(socket._tlsHandle, options.cert);
                mbedtls.config_ownkey(socket._tlsHandle, options.key);
            }

            mbedtls.config_bio(
                socket._tlsHandle,
                socket._receiveCallback.bind(socket),
                socket._sendCallback.bind(socket)
            );
            mbedtls.config_authmode(socket._tlsHandle, mbedtls.SSL_VERIFY_REQUIRED);
            if (options.servername) {
                mbedtls.config_servername(
                    socket._tlsHandle,
                    options.servername
                );
            }
            mbedtls.apply_config(socket._tlsHandle);
            mbedtls.read(socket._tlsHandle, 0);
        });
    }

    socket.on('_secure', function () {
        if (!socket.destroyed) {
            socket.emit('secureConnect');
        }
    });

    socket.on('_tlsError', function (err) {
        socket.emit('error', err);
        socket.destroy();
    });

    socket.on('close', function () {
        if (socket._tlsHandle !== undefined) {
            mbedtls.cleanup(socket._tlsHandle);
        }
    });

    return socket;
};

function normalizeConnectArgs(listArgs) {
    var args = net._normalizeConnectArgs(listArgs);
    var options = args[0];
    var cb = args[1];

    if (listArgs[1] !== null && typeof listArgs[1] === 'object') {
        options = util._extend(options, listArgs[1]);
    } else if (listArgs[2] !== null && typeof listArgs[2] === 'object') {
        options = util._extend(options, listArgs[2]);
    }

    return cb ? [options, cb] : [options];
}
