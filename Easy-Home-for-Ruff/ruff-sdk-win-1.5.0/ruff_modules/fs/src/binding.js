/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

'use strict';

var fs = require('./index.js');

exports.access = function () {
    uv.fs_access.apply(null, arguments);
};

function convertStatsAndSwapWithError(stats, error) {
    return [error, !error && convertStats(stats)];
}

function swapResultAndError(result, error) {
    return [error, result];
}

function convertClosingResultAndSwapWithError(success) {
    if (success) {
        return [];
    } else {
        return [new Error('Close error')];
    }
}

function convertStats(stats) {
    return new fs.Stats(
        stats.mode,
        stats.uid,
        stats.gid,
        stats.size,
        stats.atime.sec,
        stats.mtime.sec,
        stats.ctime.sec,
        stats.type
    );
}

function wrapDecisionCall(fn, args, converter, resultConverter) {
    var reqIndex = args.length - 1;
    var req = args[reqIndex];

    var oncomplete = req && req.oncomplete;

    if (typeof oncomplete === 'function') {
        args[reqIndex] = function () {
            oncomplete.apply(
                req,
                converter ? converter.apply(undefined, arguments) : arguments
            );
        };

        return fn.apply(null, args);
    } else {
        var ret = fn.apply(null, args);
        return resultConverter ? resultConverter(ret) : ret;
    }
}

exports.stat = function (path, req) {
    return wrapDecisionCall(
        uv.fs_stat,
        arguments,
        convertStatsAndSwapWithError,
        convertStats
    );
};

exports.lstat = function (path, req) {
    return wrapDecisionCall(
        uv.fs_lstat,
        arguments,
        convertStatsAndSwapWithError,
        convertStats
    );
};

exports.fstat = function (fd, req) {
    return wrapDecisionCall(
        uv.fs_fstat,
        arguments,
        convertStatsAndSwapWithError,
        convertStats
    );
};

exports.open = function (path, flag, mode, req) {
    return wrapDecisionCall(
        uv.fs_open,
        arguments,
        swapResultAndError
    );
};

exports.read = function (fd, buffer, offset, length, position, req) {
    var oncomplete = req && req.oncomplete;

    if (typeof oncomplete === 'function') {
        uv.fs_read(fd, length, position, function (data, error) {
            if (error) {
                oncomplete.call(req, error);
                return;
            }

            new Buffer(data).copy(buffer, offset, 0, length);
            oncomplete.call(req, undefined, data.length);
        });
    } else {
        var data = uv.fs_read(fd, length, position);
        new Buffer(data).copy(buffer, offset, 0, length);
        return data.length;
    }
};

exports.close = function (fd, req) {
    return wrapDecisionCall(
        uv.fs_close,
        arguments,
        convertClosingResultAndSwapWithError
    );
};

exports.write = function (fd, buffer, position, req) {
    return wrapDecisionCall(
        uv.fs_write,
        arguments,
        function (length, error) {
            return [error, length, buffer];
        }
    );
};

exports.unlink = function (path, req) {
    return wrapDecisionCall(uv.fs_unlink, arguments, swapResultAndError);
};

exports.rename = function (oldPath, newPath, req) {
    return wrapDecisionCall(uv.fs_rename, arguments, swapResultAndError);
};

exports.ftruncate = function (fd, len, req) {
    return wrapDecisionCall(uv.fs_ftruncate, arguments, swapResultAndError);
};

exports.mkdir = function (path, mode, req) {
    return wrapDecisionCall(uv.fs_mkdir, arguments, swapResultAndError);
};

exports.rmdir = function (path, req) {
    return wrapDecisionCall(uv.fs_rmdir, arguments, swapResultAndError);
};

exports.readlink = function (path, req) {
    return wrapDecisionCall(uv.fs_readlink, arguments, swapResultAndError);
};

exports.symlink = function (srcPath, dstPath, type, req) {
    return wrapDecisionCall(uv.fs_symlink, arguments, swapResultAndError);
};

exports.link = function (srcPath, dstPath, type, req) {
    return wrapDecisionCall(uv.fs_link, arguments, swapResultAndError);
};

exports.fchmod = function (fd, mode, req) {
    return wrapDecisionCall(uv.fs_fchmod, arguments, swapResultAndError);
};

exports.chmod = function (path, mode, req) {
    return wrapDecisionCall(uv.fs_chmod, arguments, swapResultAndError);
};

exports.fchown = function (fd, uid, gid, req) {
    return wrapDecisionCall(uv.fs_fchown, arguments, swapResultAndError);
};

exports.chown = function (fd, uid, gid, req) {
    return wrapDecisionCall(uv.fs_chown, arguments, swapResultAndError);
};

exports.utimes = function (path, atime, mtime, req) {
    return wrapDecisionCall(uv.fs_utime, arguments, swapResultAndError);
};

exports.futimes = function (fd, atime, mtime, req) {
    return wrapDecisionCall(uv.fs_futime, arguments, swapResultAndError);
};

exports.fdatasync = function (fd, req) {
    return wrapDecisionCall(uv.fs_fdatasync, arguments, swapResultAndError);
};

exports.fsync = function (fd, req) {
    return wrapDecisionCall(uv.fs_fsync, arguments, swapResultAndError);
};
