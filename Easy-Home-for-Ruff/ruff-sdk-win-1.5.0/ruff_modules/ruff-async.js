/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

'use strict';

var EventEmitter = require('events');
var util = require('util');

function series(tasks, callback) {
    var values;

    next();

    function next(error, value) {
        if (error) {
            util.invokeCallback(callback, error);
            return;
        }

        if (values) {
            values.push(value);
        } else {
            values = [];
        }

        var task = tasks.shift();

        if (task) {
            task(next);
        } else {
            util.invokeCallback(callback, undefined, values);
        }
    }
}

exports.series = series;

function eachSeries(values, handler, callback) {
    next();

    function next(error) {
        if (error) {
            util.invokeCallback(callback, error);
            return;
        }

        if (!values.length) {
            util.invokeCallback(callback);
            return;
        }

        handler(values.shift(), next);
    }
}

exports.eachSeries = eachSeries;

function Queue(fn) {
    EventEmitter.call(this);

    this._fn = fn;

    // This won't change what's on the prototype.
    this._done = this._done.bind(this);

    this._pending = false;
    this._items = [];
}

util.inherits(Queue, EventEmitter);

Queue.prototype._done = function (error, value) {
    var callback = this._pendingCallback;

    if (typeof callback === 'function') {
        callback(error, value);
    } else if (error) {
        var items = this._items;
        var index;

        for (index = 0; index < items.length; index++) {
            var pendingItem = items[index];

            if (typeof pendingItem.callback === 'function') {
                pendingItem.callback.call(pendingItem.this, error);
                break;
            }

            // We are breaking if index equals items.length -1,
            // so index will never get to items.length.
            if (pendingItem.last || index === items.length - 1) {
                this.emit('error', error);
                break;
            }
        }

        items.splice(0, index + 1);
    }

    this._next();
};

Queue.prototype._next = function () {
    if (!this._items.length) {
        this._pending = false;
        this._pendingCallback = undefined;
        return;
    }

    var item = this._items.shift();

    this._pendingCallback = item.callback;
    this._fn.apply(item.this, item.args.concat(this._done));
};

Queue.prototype.push = function (thisArg, args, callback) {
    var that = this;

    var items = this._items;

    items.push({
        this: thisArg,
        args: args,
        callback: callback
    });

    if (this._pending) {
        return;
    }

    this._pending = true;

    process.nextTick(function () {
        items[items.length - 1].last = true;
        that._next();
    });
};

exports.Queue = Queue;
