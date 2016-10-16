/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

'use strict';

function isTest(item) {
    return item.indexOf('test') === 0 && item !== 'test';
}

var styleSequenceMap = {
    red: [31, 39],
    green: [32, 39]
};

function stylize(text, styleName) {
    if (hasOwnProperty.call(styleSequenceMap, styleName)) {
        var sequence = styleSequenceMap[styleName];
        return '\u001B[' + sequence[0] + 'm' + text + '\u001B[' + sequence[1] + 'm';
    } else {
        return text;
    }
}

function runTest(testMap, key, errors, next) {
    if (typeof testMap.beforeEach === 'function') {
        testMap.beforeEach.call(testMap);
    }

    var test = testMap[key];
    var done = false;
    var hasError = false;

    var asynchronous;
    var timer;

    try {
        if (test.length) {
            asynchronous = true;

            timer = setTimeout(function () {
                if (done) {
                    return;
                }

                done = true;
                hasError = true;

                var error = new Error('Test timed out');
                errors.push(error);

                printError(error);
            }, 15000);

            test(function (error) {
                if (hasError) {
                    return;
                }

                if (done || error) {
                    hasError = true;
                    error = error || new Error('The `done` callback has been called multiple times');
                    errors.push(error);
                    printError(error);
                }

                if (!done) {
                    done = true;
                    clearTimeout(timer);

                    if (typeof testMap.afterEach === 'function') {
                        testMap.afterEach.call(testMap);
                    }

                    if (!hasError) {
                        printResult(true);
                    }

                    next();
                }
            });


        } else {
            asynchronous = false;
            test();
        }
    } catch (error) {
        clearTimeout(timer);
        hasError = true;
        errors.push(error);
        printError(error);
    }

    if (!asynchronous) {
        if (typeof testMap.afterEach === 'function') {
            testMap.afterEach.call(testMap);
        }

        if (!hasError) {
            printResult(true);
        }

        next();
    }

    function printError(error) {
        printResult(false);
        console.error(error.stack || error);
    }

    function printResult(passed) {
        if (passed) {
            console.log(stylize(key + ': passed.', 'green'));
        } else {
            console.log(stylize(key + ': failed.', 'red'));
        }
    }
}

function runTestMap(testMap, errors, next) {
    var pendingKeys = Object.keys(testMap).filter(isTest);

    nextKey();

    function nextKey() {
        if (!pendingKeys.length) {
            next();
            return;
        }

        var key = pendingKeys.shift();
        var target = testMap[key];

        if (typeof target === 'function') {
            runTest(testMap, key, errors, nextKey);
        } else if (typeof target === 'object') {
            runTestMap(target, errors, nextKey);
        }
    }
}

exports.run = function(module) {
    var errors = [];

    runTestMap(module, errors, function () {
        if (errors.length) {
            exitWithError();
        }
    });

    process.on('exit', function (code) {
        if (code === 0 && errors.length) {
            exitWithError();
        }
    });
};

function exitWithError() {
    console.error(stylize('Test failed.', 'red'));
    process.exit(1);
}
