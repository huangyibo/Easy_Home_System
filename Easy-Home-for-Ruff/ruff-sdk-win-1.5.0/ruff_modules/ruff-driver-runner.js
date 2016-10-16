/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

'use strict';

var path = require('path');
var EventEmitter = require('events');
var mock = require('ruff-mock');

function DriverRunner() { }

DriverRunner.prototype.run = function (driverDirPath, callback) {
    var info = require(path.join(driverDirPath, 'driver.json'));

    var inputsInfo = info.inputs || Object.create(null);
    var args = info.args || Object.create(null);

    var inputs = Object.create(null);

    for (var name in inputsInfo) {
        inputs[name] = mock(new EventEmitter(), true);
    }

    var deviceContext = {
        model: undefined,
        args: args
    };

    var DeviceConstructor = require(driverDirPath);

    if (DeviceConstructor.async) {
        new DeviceConstructor(inputs, deviceContext, function (error, device) {
            if (error) {
                callback(error);
                return;
            }

            callback(undefined, {
                device: device,
                inputs: inputs
            });
        });
    } else {
        var device = new DeviceConstructor(inputs, deviceContext);

        setImmediate(callback, undefined, {
            device: device,
            inputs: inputs
        });
    }
};

module.exports = new DriverRunner();
