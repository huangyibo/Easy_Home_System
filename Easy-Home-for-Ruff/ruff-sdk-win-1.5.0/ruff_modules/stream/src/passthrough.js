/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

'use strict';

module.exports = PassThrough;

var Transform = require('./transform.js');
var util = require('util');
util.inherits(PassThrough, Transform);

function PassThrough(options) {
    if (!(this instanceof PassThrough))
        return new PassThrough(options);

    Transform.call(this, options);
}

PassThrough.prototype._transform = function (chunk, encoding, cb) {
    cb(null, chunk);
};
