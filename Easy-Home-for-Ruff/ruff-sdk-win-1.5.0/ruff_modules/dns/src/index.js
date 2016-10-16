/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

'use strict';

var packet = require('./dns-packet/index.js');
var dgram = require('dgram');
var ip = require('./ip.js');

function silenceCloseSocket(socket) {
    try {
        socket.close();
    } catch (e) {
        console.error('error when close socket: %s', e);
    }
}

var newPacketId = (function() {
    var _currentPacketId = 1;
    var _maxPacketId = Math.pow(2, 31);
    return function() {
        if (_currentPacketId < _maxPacketId) {
            _currentPacketId++;
        } else {
            _currentPacketId = 1;
        }
        return _currentPacketId;
    };
})();

function _errnoException(err, syscall, original) {
    var e;
    if (err instanceof Error) {
        e = err;
    }
    var errname = 'Error';
    var message = syscall + ' ' + errname;
    if (original) {
        message += ' ' + original;
    }
    if (e) {
        e.message = message + '; ' + e.message;
    } else{
        e = new Error(message);
    }
    e.code = errname;
    e.errno = errname;
    e.syscall = syscall;
    return e;
}

var NOT_FOUND = 'ENOTFOUND';
var lookupSystemCall = 'lookupLocalDNSServer';
function errnoException(err, syscall, hostname) {
    if (typeof err === 'number') {
        err = NOT_FOUND;
    }
    var ex = null;
    if (typeof err === 'string') {  // c-ares error code.
        ex = new Error(syscall + ' ' + err + (hostname ? ' ' + hostname : ''));
        ex.code = err;
        ex.errno = err;
        ex.syscall = syscall;
    } else {
        ex = _errnoException(err, syscall);
    }
    if (hostname) {
        ex.hostname = hostname;
    }
    return ex;
}

function GetAddrInfoReqWrap(callback, family, hostname, all) {
    this.callback = callback;
    this.family = family;
    this.hostname = hostname;
    this.oncomplete = all ? this.onlookupall : this.onlookup;
}

GetAddrInfoReqWrap.prototype.onlookup = function(err, addresses) {
    if (err) {
        return this.callback(errnoException(err, lookupSystemCall, this.hostname));
    }
    if (this.family) {
        this.callback(null, addresses[0], this.family);
    } else {
        this.callback(null, addresses[0], 4);
    }
};

GetAddrInfoReqWrap.prototype.onlookupall = function(err, addresses) {
    var results = [];
    if (err) {
        return this.callback(errnoException(err, lookupSystemCall, this.hostname));
    }

    for (var i = 0; i < addresses.length; i++) {
        results.push({
            address: addresses[i],
            family: this.family || 4
        });
    }

    this.callback(null, results);
};

var nameServerIP = process.env.NAME_SERVER || '127.0.0.1';

exports.lookup = function(hostname, options, callback) {
    var hints = 0;
    var family = -1;
    var all = false;

    if (hostname && typeof hostname !== 'string') {
        throw new TypeError('Invalid arguments: ' +
            'hostname must be a string or falsey');
    } else if (typeof options === 'function') {
        callback = options;
        family = 0;
    } else if (typeof callback !== 'function') {
        throw new TypeError('Invalid arguments: callback must be passed');
    } else if (options !== null && typeof options === 'object') {
        hints = options.hints >>> 0;
        family = options.family >>> 0;
        all = options.all === true;

        if (hints !== 0 &&
            hints !== exports.ADDRCONFIG &&
            hints !== exports.V4MAPPED &&
            hints !== (exports.ADDRCONFIG | exports.V4MAPPED)) {
            throw new TypeError('Invalid argument: hints must use valid flags');
        }
    } else {
        family = options >>> 0;
    }

    if (family !== 0 && family !== 4) {
        throw new TypeError('Invalid argument: family must be 4');
    }

    if (!hostname) {
        if (all) {
            callback(null, []);
        } else {
            callback(null, null, 4);
        }
        return {};
    }

    var matchedFamily = ip.isIP(hostname);
    if (matchedFamily) {
        if (all) {
            callback(null, [{ address: hostname, family: matchedFamily }]);
        } else {
            callback(null, hostname, matchedFamily);
        }
        return {};
    }

    var req = new GetAddrInfoReqWrap(callback, family, hostname, all);

    var buf = packet.encode({
        type: 'query',
        id: newPacketId(),
        flags: packet.RECURSION_DESIRED,
        questions: [{ type: 'A', name: hostname }]
    });

    var socket = exports._dnsClient || dgram.createSocket();
    socket.on('message', function(message) {
        var response = packet.decode(message);
        var addresses = [];
        if (response && response.answers) {
            response.answers.forEach(function(answer) {
                if (answer.class === 1) {
                    var data = answer.data;
                    if (ip.isIP(data)) {
                        addresses.push(answer.data);
                    }
                }
            });
        }
        silenceCloseSocket(socket);
        if (addresses.length > 0) {
            req.oncomplete(null, addresses);
        } else if (hostname.toLowerCase() === 'localhost') {
            req.oncomplete(null, ['127.0.0.1']);
        } else {
            var err = errnoException(NOT_FOUND, lookupSystemCall, hostname);
            console.log('exception = %j', err);
            req.oncomplete(err, null);
        }
    });

    socket.on('error', function(exception) {
        silenceCloseSocket(socket);
        var err = errnoException(exception, lookupSystemCall, hostname);
        callback(err, null);
    });

    socket.send(buf, 0, buf.length, 53, nameServerIP);
    return req;
};

exports.ADDRCONFIG = 1024;
exports.V4MAPPED = 2048;