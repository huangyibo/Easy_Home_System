/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

'use strict';

var required = Object.freeze({
    toString: function() { return '<trait.required>'; }
});

function Trait(spec) {
    this._required = [];
    this._exports = {};

    for (var field in spec) {
        if (spec.hasOwnProperty(field)) {
            var specField = spec[field];
            if (specField === required) {
                this._required.push(field);
            } else {
                this._exports[field] = specField;
            }
        }
    }
}

function doExtend(obj, trait) {
    var requiredMethods = trait._required;

    requiredMethods.forEach(function(requiredKey) {
        if (!obj[requiredKey] || (typeof obj[requiredKey] !== 'function')) {
            throw new Error('Required method [' + requiredKey + '] is missing');
        }
    });

    var traitMethods = trait._exports;
    for (var traitKey in traitMethods) {
        if (traitMethods.hasOwnProperty(traitKey)) {
            obj[traitKey] = traitMethods[traitKey];
        }
    }

    return obj;
}

function doIsTrait(obj) {
    return (obj instanceof Trait);
}

var trait = function(spec) {
    return new Trait(spec);
};

trait.required = required;

trait.isTrait = function(obj) {
    return doIsTrait(obj);
};

trait.include = function(ctor, trait) {
    if (ctor === undefined || ctor === null) {
        throw new TypeError('The constructor to `include` must not be ' +
            'null or undefined.');
    }

    if (trait === undefined || trait === null) {
        throw new TypeError('The trait to `include` must not be ' +
            'null or undefined.');
    }

    if (!doIsTrait(trait)) {
        throw new TypeError('The trait to `include` must be a trait.');
    }

    doExtend(ctor.prototype, trait);
    return ctor;
};

trait.extend = function(obj, trait) {
    if (obj === undefined || obj === null) {
        throw new TypeError('The object to `extend` must not be ' +
            'null or undefined.');
    }

    if (trait === undefined || trait === null) {
        throw new TypeError('The trait to `extend` must not be ' +
            'null or undefined.');
    }

    if (!doIsTrait(trait)) {
        throw new TypeError('The trait to `extend` must be a trait.');
    }

    return doExtend(obj, trait);
};

module.exports = trait;