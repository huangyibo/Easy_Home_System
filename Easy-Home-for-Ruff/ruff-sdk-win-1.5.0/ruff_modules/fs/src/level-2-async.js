/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

'use strict';

var pathModule = require('path');

var fs = require('./index.js');
var binding = require('./binding.js');
var fsUtil = require('./util.js');

var isWindows = process.platform === 'win32';

exports.access = function (path, mode, callback) {
    if (typeof mode === 'function') {
        callback = mode;
        mode = 'r';
    } else if (typeof callback !== 'function') {
        throw new TypeError('callback must be a function');
    }

    if (!fsUtil.nullCheck(path, callback)) {
        return;
    }

    binding.access(pathModule._makeLong(path), mode, fsUtil.makeCallback(callback));
};

exports.lstat = function (path, callback) {
    callback = fsUtil.makeCallback(callback);
    if (!fsUtil.nullCheck(path, callback)) {
        return;
    }
    binding.lstat(pathModule._makeLong(path), { oncomplete: callback });
};

exports.ftruncate = function (fd, len, callback) {
    if (typeof len === 'function') {
        callback = len;
        len = 0;
    } else if (len === undefined) {
        len = 0;
    }
    binding.ftruncate(fd, len, { oncomplete: fsUtil.makeCallback(callback) });
};

exports.truncate = function (path, len, callback) {
    if (typeof len === 'function') {
        callback = len;
        len = 0;
    } else if (len === undefined) {
        len = 0;
    }

    callback = fsUtil.maybeCallback(callback);
    fs.open(path, 'r+', fsUtil.callErrorWhenError(function (er, fd) {
        binding.ftruncate(fd, len, {
            oncomplete: function () {
                fs.close(fd, function (er2) {
                    callback(er || er2);
                });
            }
        });
    }));
};

exports.readlink = function (path, callback) {
    callback = fsUtil.makeCallback(callback);
    if (!fsUtil.nullCheck(path, callback)) {
        return;
    }

    binding.readlink(pathModule._makeLong(path), { oncomplete: callback });
};

exports.symlink = function (destination, path, type) {
    type = typeof type === 'string' ? type : null;
    var callback = fsUtil.makeCallback(arguments[arguments.length - 1]);

    if (!fsUtil.nullCheck(destination, callback)) {
        return;
    }
    if (!fsUtil.nullCheck(path, callback)) {
        return;
    }

    binding.symlink(fsUtil.preprocessSymlinkDestination(destination, type, path),
        pathModule._makeLong(path),
        type,
        { oncomplete: callback });
};

exports.link = function (srcpath, dstpath, callback) {
    callback = fsUtil.makeCallback(callback);
    if (!fsUtil.nullCheck(srcpath, callback)) {
        return;
    }
    if (!fsUtil.nullCheck(dstpath, callback)) {
        return;
    }

    binding.link(pathModule._makeLong(srcpath),
        pathModule._makeLong(dstpath),
        { oncomplete: callback });
};

exports.fchmod = function (fd, mode, callback) {
    binding.fchmod(fd, mode, { oncomplete: fsUtil.makeCallback(callback) });
};

exports.chmod = function (path, mode, callback) {
    callback = fsUtil.makeCallback(callback);
    if (!fsUtil.nullCheck(path, callback)) {
        return;
    }
    binding.chmod(pathModule._makeLong(path),
        mode,
        { oncomplete: callback });
};

exports.fchown = function (fd, uid, gid, callback) {
    binding.fchown(fd, uid, gid, { oncomplete: fsUtil.makeCallback(callback) });
};

exports.chown = function (path, uid, gid, callback) {
    callback = fsUtil.makeCallback(callback);
    if (!fsUtil.nullCheck(path, callback)) {
        return;
    }

    binding.chown(pathModule._makeLong(path), uid, gid, { oncomplete: callback });
};

exports.utimes = function (path, atime, mtime, callback) {
    callback = fsUtil.makeCallback(callback);
    if (!fsUtil.nullCheck(path, callback)) {
        return;
    }
    binding.utimes(pathModule._makeLong(path),
        fsUtil.toUnixTimestamp(atime),
        fsUtil.toUnixTimestamp(mtime),
        { oncomplete: callback });
};

exports.futimes = function (fd, atime, mtime, callback) {
    binding.futimes(fd,
        fsUtil.toUnixTimestamp(atime),
        fsUtil.toUnixTimestamp(mtime),
        { oncomplete: callback });
};

exports.fdatasync = function (fd, callback) {
    binding.fdatasync(fd, { oncomplete: fsUtil.makeCallback(callback) });
};

exports.fsync = function (fd, callback) {
    binding.fsync(fd, { oncomplete: fsUtil.makeCallback(callback) });
};

// Regexp that finds the next partion of a (partial) path
// result is [base_with_slash, base], e.g. ['somedir/', 'somedir']
var nextPartRe = isWindows ? /(.*?)(?:[\/\\]+|$)/g : /(.*?)(?:[\/]+|$)/g;

// Regex to find the device root, including trailing slash. E.g. 'c:\\'.
var splitRootRe = isWindows ? /^(?:[a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/][^\\\/]+)?[\\\/]*/ : /^[\/]*/;

exports.realpath = function (p, cache, cb) {
    if (typeof cb !== 'function') {
        cb = fsUtil.maybeCallback(cache);
        cache = null;
    }

    // make p is absolute
    p = pathModule.resolve(p);

    if (cache && Object.prototype.hasOwnProperty.call(cache, p)) {
        return process.nextTick(cb.bind(null, null, cache[p]));
    }

    var original = p;
    var knownHard = {};

    // current character position in p
    var pos;
    // the partial path so far, including a trailing slash if any
    var current;
    // the partial path without a trailing slash (except when pointing at a root)
    var base;
    // the partial path scanned in the previous round, with slash
    var previous;

    function initP() {
        // Skip over roots
        var m = splitRootRe.exec(p);
        pos = m[0].length;
        current = m[0];
        base = m[0];
        previous = '';
    }

    function start() {
        initP();
        // On windows, check that the root exists. On unix there is no need.
        if (isWindows && !knownHard[base]) {
            fs.lstat(base, function (err) {
                if (err) {
                    return cb(err);
                }
                knownHard[base] = true;
                loop();
            });
        } else {
            process.nextTick(loop);
        }
    }

    function gotResolvedLink(resolvedLink) {
        // resolve the link, then start over
        p = pathModule.resolve(resolvedLink, p.slice(pos));
        start();
    }

    function gotTarget(err, target, base) {
        if (err) {
            return cb(err);
        }
        var resolvedLink = pathModule.resolve(previous, target);
        if (cache) {
            cache[base] = resolvedLink;
        }
        gotResolvedLink(resolvedLink);
    }

    function gotStat(err, stat) {
        if (err) {
            return cb(err);
        }
        // if not a symlink, skip to the next path part
        if (!stat.isSymbolicLink()) {
            knownHard[base] = true;
            if (cache) {
                cache[base] = base;
            }
            return process.nextTick(loop);
        }
        // stat & read the link if not read before
        fs.stat(base, function (err) {
            if (err) {
                return cb(err);
            }
            fs.readlink(base, function (err, target) {
                gotTarget(err, target);
            });
        });
    }

    // walk down the path, swapping out linked pathparts for their real
    // values
    function loop() {
        // stop if scanned past end of path
        if (pos >= p.length) {
            if (cache) {
                cache[original] = p;
            }
            return cb(null, p);
        }

        // find the next part
        nextPartRe.lastIndex = pos;
        var result = nextPartRe.exec(p);
        previous = current;
        current += result[0];
        base = previous + result[1];
        pos = nextPartRe.lastIndex;

        // continue if not a symlink
        if (knownHard[base] || (cache && cache[base] === base)) {
            return process.nextTick(loop);
        }

        if (cache && Object.prototype.hasOwnProperty.call(cache, base)) {
            // known symbolic link.  no need to stat again.
            return gotResolvedLink(cache[base]);
        }
        return fs.lstat(base, gotStat);
    }

    start();
};
