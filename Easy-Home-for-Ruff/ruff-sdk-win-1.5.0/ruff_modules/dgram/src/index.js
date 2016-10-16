/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

'use strict';

var Socket = require('./socket.js').Socket;

exports.createSocket = function(listener) {
    return new Socket(listener);
};