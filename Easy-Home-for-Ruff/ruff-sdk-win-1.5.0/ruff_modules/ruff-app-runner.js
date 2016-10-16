/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

'use strict';
var path = require('path');
var events = require('events');
var anyMock = require('ruff-mock').anyMock;

function include(target, mixInObj) {
    var mockObject = target;
    for (var fm in mixInObj) {
        if (mixInObj[fm] === 'constructor') {
            continue;
        } else {
            mockObject[fm] = mixInObj[fm];
        }
    }
    return mockObject;
}

function mockMissing(obj) {
    return include(anyMock(), obj);
}

function safeRequire(filename) {
    try {
        return require(filename);
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new SyntaxError('Fail to parse ' + filename + ', ' + error.message);
        }

        throw error;
    }
}

function AppRunner() {
    this._devices = {};
    this._currentAppPath = null;

    this._appEnd = null;
    this._appReady = null;
}

AppRunner.prototype._getDevice = function (id) {
    if (!(id in this._devices)) {
        throw Error('No [' + id + '] found in app.json');
    }
    return this._devices[id];
};

AppRunner.prototype._setAppEnd = function (cb) {
    this._appEnd = cb;
};

AppRunner.prototype._setAppReady = function (cb) {
    this._appReady = cb;
};

var currentAppPath = null;
var readyCallbacks = {};
var endCallbacks = {};

function enterApp(appPath) {
    currentAppPath = appPath;
}

function leaveApp(appPath) { // jshint ignore:line
    currentAppPath = null;
}

function readyCallback(cb) {
    if (currentAppPath) {
        readyCallbacks[currentAppPath] = cb;
    }
}

function getReady(appPath) {
    return readyCallbacks[appPath];
}

function endCallback(cb) {
    if (currentAppPath) {
        endCallbacks[currentAppPath] = cb;
    }
}

function getEnd(appPath) {
    return endCallbacks[appPath];
}

function asDeviceId(id) {
    if (id[0] === '#') {
        return id.substr(1);
    }

    throw new Error('Device ID [' + id + '] should start with #.');
}

function mock$(appRunner) {
    function $(id) {
        var deviceId = asDeviceId(id);
        return appRunner._getDevice(deviceId);
    }

    $.ready = function (cb) {
        readyCallback(cb);
    };

    $.end = function (cb) {
        endCallback(cb);
    };

    return $;
}

AppRunner.prototype._addDevice = function (id) {
    this._devices[id] = mockMissing(new events.EventEmitter());
};

AppRunner.prototype._loadBoard = function (board) {
    var boardConfig = safeRequire(path.join(this._currentAppPath, 'ruff_modules', board, 'board.json'));

    if (boardConfig && boardConfig.devices) {
        var that = this;
        boardConfig.devices.forEach(function (device) {
            that._addDevice(device.id);
        });
        return;
    }

    throw new Error('Fail to parse board, please ensure board has been installed correctly');
};

AppRunner.prototype._loadConfig = function () {
    var that = this;
    var appConfig = safeRequire(path.join(this._currentAppPath, 'app.json'));
    var packageData = safeRequire(path.join(this._currentAppPath, 'package.json'));

    var devices = appConfig && appConfig.devices;

    var boardVersionRangeMap = packageData.boards || packageData.ruff && packageData.ruff.boards;
    var boardNames = boardVersionRangeMap && Object
        .keys(boardVersionRangeMap)
        .filter(function (name) {
            return name !== '*';
        });

    var boardName = boardNames && boardNames[0] || 'ruff-mbd-v1';

    if (!devices) {
        throw new Error('Missing `devices` in file `app.json`');
    }

    this._loadBoard(boardName);
    devices.forEach(function (device) {
        that._addDevice(device.id);
    });
};

function AppRunnerContainer() {
}

AppRunnerContainer.prototype._doRun = function (appPath, runnable, args) {
    var runner = new AppRunner();

    enterApp(appPath);

    runner._currentAppPath = appPath;
    runner._devices = {};

    runner._loadConfig();

    global.$ = mock$(runner);

    safeRequire(path.join(appPath, 'src', 'index.js'));

    runner._appReady = getReady(appPath);
    runner._appEnd = getEnd(appPath);

    leaveApp(appPath);

    if (runner._appReady) {
        runner._appReady();
    }

    runnable.apply(runner, args);

    if (runner._appEnd) {
        runner._appEnd();
    }

    return {
        end: function (endCallback) {
            endCallback();
        }
    };
};

function runnable(one) {
    if (typeof one === 'function') {
        return one;
    }

    throw new TypeError('Runnable function is expected to run app runner');
}

AppRunnerContainer.prototype.run = function () {
    var appPath = arguments[0];
    var targetRunnable = runnable(arguments[1]);
    var leftArgIndex = 2;

    return this._doRun(appPath, targetRunnable,
        Array.prototype.slice.call(arguments, leftArgIndex));
};

module.exports = new AppRunnerContainer();
