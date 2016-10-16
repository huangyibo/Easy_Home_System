/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

'use strict';

var assert = require('assert');
var EventEmitter = require('events');
var util = require('util');
var trait = require('trait');
var include = trait.include;

function noOp() { }

/**
 * Device.prototype.extend()
 * @param {Trait} traitObject
 */
function extend(traitObject) {
    if (!trait.isTrait(traitObject)) {
        traitObject = trait(traitObject);
    }

    trait.extend(this, traitObject);
}

/**
 * Abstract class Device.
 */
function Device() {
    EventEmitter.call(this);
}

util.inherits(Device, EventEmitter);

function driver(options) {
    var attach = options.attach;
    var detach = options.detach || noOp;
    var getInterface = options.getInterface || options.getDevice;

    assert.ifError(typeof attach !== 'function' && new TypeError('Option `attach` is expected to be a function'));
    assert.ifError(typeof detach !== 'function' && new TypeError('Option `detach` is expected to be a function'));
    assert.ifError(getInterface && typeof getInterface !== 'function' && new TypeError('Option `detach` is expected to be a function'));

    function Constructor() {
        Device.call(this);
        attach.apply(this, arguments);
    }

    util.inherits(Constructor, Device);

    // Parameters: options, context, next
    Constructor.async = attach.length >= 3;

    var prototype = Constructor.prototype;

    prototype.detach = detach;
    prototype.getInterface = getInterface;
    prototype.extend = extend;

    var exports = options.exports;

    if (exports) {
        var keys = Object.getOwnPropertyNames(exports);

        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var descriptor = Object.getOwnPropertyDescriptor(exports, key);
            Object.defineProperty(prototype, key, descriptor);
        }
    }

    var traits = options.traits;

    if (traits) {
        for (var j = 0; j < traits.length; j++) {
            include(Constructor, traits[j]);
        }
    }

    return Constructor;
}

driver.mdelay = uv.mdelay;

module.exports = driver;
