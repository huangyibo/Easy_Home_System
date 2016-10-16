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
var MODE_666 = parseInt('666', 8);

exports.accessSync = function (path, mode) {
    fsUtil.nullCheck(path);
    binding.access(pathModule._makeLong(path), mode || 'r');
};

exports.lstatSync = function (path) {
    fsUtil.nullCheck(path);
    return binding.lstat(pathModule._makeLong(path));
};

exports.ftruncateSync = function (fd, len) {
    if (len === undefined) {
        len = 0;
    }
    return binding.ftruncate(fd, len);
};

exports.truncateSync = function (path, len) {
    if (len === undefined) {
        len = 0;
    }
    // allow error to be thrown, but still close fd.
    var fd = fs.openSync(path, 'r+', MODE_666);
    return fsUtil.withCloseWhenError(fs, fd, function () {
        return fs.ftruncateSync(fd, len);
    });
};

exports.readlinkSync = function (path) {
    fsUtil.nullCheck(path);
    return binding.readlink(pathModule._makeLong(path));
};

exports.symlinkSync = function (destination, path, type) {
    type = typeof type === 'string' ? type : null;

    fsUtil.nullCheck(destination);
    fsUtil.nullCheck(path);

    return binding.symlink(fsUtil.preprocessSymlinkDestination(isWindows, destination, type, path),
        pathModule._makeLong(path),
        type);
};

exports.linkSync = function (srcpath, dstpath) {
    fsUtil.nullCheck(srcpath);
    fsUtil.nullCheck(dstpath);
    return binding.link(pathModule._makeLong(srcpath),
        pathModule._makeLong(dstpath));
};

exports.fchmodSync = function (fd, mode) {
    return binding.fchmod(fd, mode);
};

exports.chmodSync = function (path, mode) {
    fsUtil.nullCheck(path);
    return binding.chmod(pathModule._makeLong(path), mode);
};

exports.fchownSync = function (fd, uid, gid) {
    return binding.fchown(fd, uid, gid);
};

exports.chownSync = function (path, uid, gid) {
    fsUtil.nullCheck(path);
    return binding.chown(pathModule._makeLong(path), uid, gid);
};

exports.utimesSync = function (path, atime, mtime) {
    fsUtil.nullCheck(path);
    binding.utimes(pathModule._makeLong(path),
        fsUtil.toUnixTimestamp(atime),
        fsUtil.toUnixTimestamp(mtime));
};

exports.futimesSync = function (fd, atime, mtime) {
    binding.futimes(fd,
        fsUtil.toUnixTimestamp(atime),
        fsUtil.toUnixTimestamp(mtime));
};

exports.fdatasyncSync = function (fd) {
    return binding.fdatasync(fd);
};

exports.fsyncSync = function (fd) {
    return binding.fsync(fd);
};

// Regexp that finds the next partion of a (partial) path
// result is [base_with_slash, base], e.g. ['somedir/', 'somedir']
var nextPartRe = isWindows ? /(.*?)(?:[\/\\]+|$)/g : /(.*?)(?:[\/]+|$)/g;

// Regex to find the device root, including trailing slash. E.g. 'c:\\'.
var splitRootRe = isWindows ? /^(?:[a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/][^\\\/]+)?[\\\/]*/ : /^[\/]*/;

exports.realpathSync = function (p, cache) {
    // make p is absolute
    p = pathModule.resolve(p);
    if (cache && Object.prototype.hasOwnProperty.call(cache, p)) {
        return cache[p];
    }

    var original = p;
    var knownHard = {};

    // current character position in p
    var pos;
    // the partial path so far, including a trailing slash if any
    var current;

    function checkRootExits() {
        // On windows, check that the root exists. On unix there is no need.
        if (isWindows && !knownHard[current]) {
            fs.lstatSync(current);
            knownHard[current] = true;
        }
    }

    function start() {
        // Skip over roots
        var m = splitRootRe.exec(p);
        pos = m[0].length;
        current = m[0];

        checkRootExits();
    }

    start();

    // walk down the path, swapping out linked pathparts for their real  values
    // NB: p.length changes.
    while (pos < p.length) {
        // find the next part
        nextPartRe.lastIndex = pos;
        var result = nextPartRe.exec(p);
        // the partial path scanned in the previous round, with slash
        var previous = current;
        var base = previous + result[1];
        current += result[0];
        pos = nextPartRe.lastIndex;

        // continue if not a symlink
        if (knownHard[base] || (cache && cache[base] === base)) {
            continue;
        }

        var resolvedLink;
        if (cache && Object.prototype.hasOwnProperty.call(cache, base)) {
            // some known symbolic link.  no need to stat again.
            resolvedLink = cache[base];
        } else {
            var stat = fs.lstatSync(base);
            if (!stat.isSymbolicLink()) {
                knownHard[base] = true;
                if (cache) {
                    cache[base] = base;
                }
                continue;
            }

            // read the link if it wasn't read before
            var linkTarget = fs.readlinkSync(base);
            resolvedLink = pathModule.resolve(previous, linkTarget);
            // track this, if given a cache.
            if (cache) {
                cache[base] = resolvedLink;
            }
        }

        // resolve the link, then start over
        p = pathModule.resolve(resolvedLink, p.slice(pos));

        start();
    }

    if (cache) {
        cache[original] = p;
    }

    return p;
};
