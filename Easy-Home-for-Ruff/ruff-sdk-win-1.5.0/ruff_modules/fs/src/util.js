/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

'use strict';

var DEBUG = process.env.RUFF_DEBUG && /fs/.test(process.env.RUFF_DEBUG);
var util = require('util');
var pathModule = require('path');

function rethrow() {
    // Only enable in debug mode. A backtrace uses ~1000 bytes of heap space and
    // is fairly slow to generate.
    if (DEBUG) {
        var backtrace = new Error();
        return function (err) {
            if (err) {
                backtrace.stack = err.name + ': ' + err.message +
                    backtrace.stack.substr(backtrace.name.length);
                throw backtrace;
            }
        };
    }

    return function (err) {
        if (err) {
            throw err; // Forgot a callback but don't know where? Use NODE_DEBUG=fs
        }
    };
}

function maybeCallback(cb) {
    return typeof cb === 'function' ? cb : rethrow();
}

function makeCallback(cb) {
    if (cb === undefined) {
        return rethrow();
    }

    if (typeof cb !== 'function') {
        throw new TypeError('callback must be a function');
    }

    return function () {
        return cb.apply(null, arguments);
    };
}

function nullCheck(path, callback) {
    if (String(path).indexOf('\u0000') !== -1) {
        var er = new Error('Path must be a string without null bytes.');
        er.code = 'ENOENT';
        if (typeof callback !== 'function') {
            throw er;
        }
        process.nextTick(callback, er);
        return false;
    }
    return true;
}

function throwOptionsError(options) {
    throw new TypeError('Expected options to be either an object or a string, ' +
        'but got ' + typeof options + ' instead');
}

function assertEncoding(encoding) {
    if (encoding && !Buffer.isEncoding(encoding)) {
        throw new Error('Unknown encoding: ' + encoding);
    }
}

function getOptionsWithDefault(options, encodingValue, flagValue, modeValue) {
    var reOptions;
    if (!options || typeof options === 'function') {
        reOptions = {
            encoding: encodingValue,
            mode: modeValue,
            flag: flagValue
        };
    } else if (typeof options === 'string') {
        reOptions = {
            encoding: options,
            mode: modeValue,
            flag: flagValue
        };
    } else if (typeof options === 'object') {
        reOptions = options;
    } else {
        throwOptionsError(options);
    }
    return reOptions;
}

function converterReadOptions(options) {
    var reOptions = getOptionsWithDefault(options, null, 'r');
    assertEncoding(reOptions.encoding);
    return reOptions;
}

function converterWriteOptions(options, mode) {
    var reOptions = getOptionsWithDefault(options, 'utf8', 'w', mode);
    assertEncoding(reOptions.encoding);
    return reOptions;
}

function converterAppendOptions(options, mode) {
    return getOptionsWithDefault(options, 'utf8', 'a', mode);
}

function withCloseWhenError(fs, fd, cb) {
    try {
        return cb();
    } catch (e) {
        if (fs && fd) {
            fs.closeSync(fd);
        }
        throw e;
    }
}

function callErrorWhenError(cb, doCb) {
    return function (err) {
        if (err) {
            if (cb) {
                cb(err);
            }
        } else {
            doCb.apply(this, arguments);
        }
    };
}

function getString(mayBuffer) {
    if (mayBuffer instanceof Buffer) {
        return mayBuffer.toString();
    }

    if (typeof mayBuffer !== 'string') {
        return String(mayBuffer);
    }

    return mayBuffer;
}

function preprocessSymlinkDestination(isWindows, path, type, linkPath) {
    if (!isWindows) {
        // No preprocessing is needed on Unix.
        return path;
    } else if (type === 'junction') {
        // Junctions paths need to be absolute and \\?\-prefixed.
        // A relative target is relative to the link's parent directory.
        path = pathModule.resolve(linkPath, '..', path);
        return pathModule._makeLong(path);
    } else {
        // Windows symlinks don't tolerate forward slashes.
        return String(path).replace(/\//g, '\\');
    }
}

// converts Date or number to a fractional UNIX timestamp
function toUnixTimestamp(time) {
    if (typeof time === 'string' && !isNaN(time)) {
        return Number(time);
    }
    if (typeof time === 'number') {
        if (!Number.isFinite(time) || time < 0) {
            return Date.now() / 1000;
        }
        return time;
    }
    if (util.isDate(time)) {
        // convert to 123.456 UNIX timestamp
        return time.getTime() / 1000;
    }
    throw new Error('Cannot parse time: ' + time);
}

exports.maybeCallback = maybeCallback;
exports.makeCallback = makeCallback;
exports.nullCheck = nullCheck;
exports.converterReadOptions = converterReadOptions;
exports.converterWriteOptions = converterWriteOptions;
exports.converterAppendOptions = converterAppendOptions;
exports.withCloseWhenError = withCloseWhenError;
exports.callErrorWhenError = callErrorWhenError;
exports.getString = getString;
exports.preprocessSymlinkDestination = preprocessSymlinkDestination;
exports.toUnixTimestamp = toUnixTimestamp;
