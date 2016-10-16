/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

/* jshint ignore:start */
'use strict';

var util = require('util');
var pSlice = Array.prototype.slice;

function Expectation(methodName, args, answers, whenever, handler) {
    this.methodName = methodName;
    this.args = args;
    this.whenever = whenever;
    this.answers = answers;
    this.handler = handler;
    this.current = 0;
}

Expectation.prototype._nextAnswer = function () {
    if (this.current >= this.answers.length) {
        this.current = 0;
    }

    return this.answers[this.current++];
};

Expectation.prototype.hasNextAnswer = function () {
    return this.current < this.answers.length;
};

Expectation.prototype.nextAnswer = function (object, args) {
    return this.handler(this._nextAnswer(), object, args);
};

function Any() { }

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);
function isArguments(object) {
    return Object.prototype.toString.call(object) === '[object Arguments]';
}

function objectToString(o) {
    return Object.prototype.toString.call(o);
}

function isDate(d) {
    return objectToString(d) === '[object Date]';
}

function isRegExp(re) {
    return objectToString(re) === '[object RegExp]';
}

function isPrimitive(arg) {
    return arg === null ||
        typeof arg !== 'object' && typeof arg !== 'function';
}

function objEquiv(a, b, strict) {
    if (a === null || a === undefined || b === null || b === undefined) {
        return false;
    }
    // if one is a primitive, the other must be same
    if (isPrimitive(a) || isPrimitive(b)) {
        return a === b;
    }
    if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) {
        return false;
    }
    var aIsArgs = isArguments(a),
        bIsArgs = isArguments(b);
    if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs)) {
        return false;
    }
    if (aIsArgs) {
        a = pSlice.call(a);
        b = pSlice.call(b);
        return _deepEqual(a, b, strict);
    }
    var ka = Object.keys(a),
        kb = Object.keys(b),
        key, i;
    // having the same number of owned properties (keys incorporates
    // hasOwnProperty)
    if (ka.length !== kb.length) {
        return false;
    }
    // the same set of keys (although not necessarily the same order),
    ka.sort();
    kb.sort();
    // ~~~cheap key test
    for (i = ka.length - 1; i >= 0; i--) {
        if (ka[i] !== kb[i]) {
            return false;
        }
    }
    // equivalent values for every corresponding key, and
    // ~~~possibly expensive deep test
    for (i = ka.length - 1; i >= 0; i--) {
        key = ka[i];
        if (!_deepEqual(a[key], b[key], strict)) {
            return false;
        }
    }
    return true;
}

function _deepEqual(actual, expected, strict) { // jshint ignore:line
    // 7.1. All identical values are equivalent, as determined by ===.
    if (actual === expected) {
        return true;
    } else if (actual instanceof Buffer && expected instanceof Buffer) {
        return actual.compare(expected) === 0; // jshint ignore:line

    // 7.2. If the expected value is a Date object, the actual value is
    // equivalent if it is also a Date object that refers to the same time.
    } else if (isDate(actual) && isDate(expected)) {
        return actual.getTime() === expected.getTime();

    // 7.3 If the expected value is a RegExp object, the actual value is
    // equivalent if it is also a RegExp object with the same source and
    // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
    } else if (isRegExp(actual) && isRegExp(expected)) {
        return actual.source === expected.source &&
            actual.global === expected.global &&
            actual.multiline === expected.multiline &&
            actual.lastIndex === expected.lastIndex &&
            actual.ignoreCase === expected.ignoreCase;

    // 7.4. Other pairs that do not both pass typeof value == 'object',
    // equivalence is determined by ==.
    } else if ((actual === null || typeof actual !== 'object') &&
        (expected === null || typeof expected !== 'object')) {
        return strict ? actual === expected : actual == expected; // jshint ignore:line

    // 7.5 For all other Object pairs, including Array objects, equivalence is
    // determined by having the same number of owned properties (as verified
    // with Object.prototype.hasOwnProperty.call), the same set of keys
    // (although not necessarily the same order), equivalent values for every
    // corresponding key, and an identical 'prototype' property. Note: this
    // accounts for both named and indexed properties on Arrays.
    } else {
        return objEquiv(actual, expected, strict);
    }
}

function match(mockArguments, actualArguments) {
    if (mockArguments instanceof Any) {
        return true;
    }

    if (isArguments(mockArguments) && isArguments(actualArguments)) {
        if (mockArguments.length !== actualArguments.length) {
            return false;
        }

        for (var i = 0; i < mockArguments.length; i++) {
            if (!match(mockArguments[i], actualArguments[i])) {
                return false;
            }
        }

        return true;
    }

    if (typeof mockArguments === 'function' && actualArguments instanceof mockArguments) {
        return true;
    }

    return _deepEqual(mockArguments, actualArguments, true);
}

function isTargetFunction(field) {
    return typeof field === 'function' && field !== 'constructor';
}

function doTimes(expected) {
    if (expected < 0) {
        throw new Error('Expected invocation times should be greater than 0');
    }

    return {
        verify: function (data) {
            if (data.length !== expected) {
                throw new Error(util.format('Expect invoke %d times but actual %d times', expected, data.length));
            }
        }
    };
}

function toVerificationMode(mode) {
    if (mode === undefined) {
        return doTimes(1);
    }

    return mode;
}

function mockMethod(object, name, original) {
    return function () {
        if (object.__stub) {
            throw new Error('Unfinished `when`, call `then` finish it');
        }

        object.__invocations.push({
            name: name,
            args: arguments
        });

        var expectations = object.__expectations[name];

        if (expectations) {
            var matchedExpectation;
            var index;

            for (index = 0; index < expectations.length; index++) {
                var expectation = expectations[index];

                if (match(expectation.args, arguments)) {
                    matchedExpectation = expectation;
                    break;
                }
            }

            if (matchedExpectation) {
                var answer = matchedExpectation.nextAnswer(this, arguments);

                if (!matchedExpectation.hasNextAnswer() && !matchedExpectation.whenever) {
                    expectations.splice(index, 1);
                }

                return answer;
            }
        }

        if (typeof original === 'function') {
            return original.apply(this, arguments);
        }
    };
}

function spyMethod(object, name, original) {
    return mockMethod(object, name, function () {
        return original.apply(object, arguments);
    });
}

function setExpectation(whenObject, methodName, args, answers, whenever, handler) {
    if (!whenObject.__expectations[methodName]) {
        whenObject.__expectations[methodName] = [];
    }

    whenObject.__expectations[methodName].push(new Expectation(methodName, args, answers, whenever, handler));
    whenObject.__stub = false;
}

function whenMethod(whenObject, methodName, whenever) {
    return function () {
        var expectedArgs = arguments;
        return {
            then: function () {
                setExpectation(whenObject, methodName, expectedArgs, arguments, whenever, function (callback, object, args) {
                    return callback.apply(object, args);
                });
            },

            thenReturn: function () {
                setExpectation(whenObject, methodName, expectedArgs, arguments, whenever, function (value) {
                    return value;
                });
            },

            thenThrow: function () {
                setExpectation(whenObject, methodName, expectedArgs, arguments, whenever, function (value) {
                    throw value;
                });
            }
        };
    };
}

function verificationMethod(methodName, verificationObject) {
    return function () {
        var args = arguments;
        var matchResult = verificationObject.mockObject.__invocations.filter(function (invocation) {
            return invocation.name === methodName && match(args, invocation.args);
        });

        verificationObject.mode.verify(matchResult);
    };
}

function anyIntercepted(obj, methodHandler) {
    var handler = {
        get: function (target, key) {
            if (!(key in target)) {
                target[key] = methodHandler(key, obj);
            }

            return target[key];
        }
    };

    return new Proxy(obj, handler);
}

function Interceptable() {
    this.__expectations = Object.create(null);
    this.__invocations = [];
    this.__stub = false;
}

function mock(object, extendable) {
    var interceptedMap = Object.create(null);

    Interceptable.call(object);

    return new Proxy(object, {
        get: function (target, name) {
            if (name in interceptedMap) {
                return interceptedMap[name];
            }

            var mockedMethod;

            if (name in target) {
                var value = target[name];

                if (typeof value === 'function') {
                    mockedMethod = mockMethod(target, name, value);
                    interceptedMap[name] = mockedMethod;
                    return mockedMethod;
                } else {
                    return value;
                }
            } else if (extendable) {
                mockedMethod = mockMethod(target, name);
                interceptedMap[name] = mockedMethod;
                return mockedMethod;
            } else {
                return undefined;
            }
        }
    });
}

module.exports = exports = mock;

exports.any = new Any();

exports.spy = function (obj) {
    var spyObject = new Interceptable();

    for (var fm in obj) {
        if (obj[fm] === 'constructor') {
            continue;
        } else if (typeof obj[fm] === 'function') {
            spyObject[fm] = spyMethod(spyObject, fm, obj[fm]);
        } else {
            spyObject[fm] = obj[fm];
        }
    }
    return spyObject;
};

exports.mockAny = exports.anyMock = function () {
    var mockObject = new Interceptable();

    return anyIntercepted(mockObject, function (name) {
        return mockMethod(mockObject, name);
    });
};

exports.when = function (mockObject) {
    mockObject.__stub = true;

    return anyIntercepted({}, function (key) {
        return whenMethod(mockObject, key);
    });
};

exports.whenever = function (mockObject) {
    mockObject.__stub = true;

    return anyIntercepted({}, function (key) {
        return whenMethod(mockObject, key, true);
    });
};

exports.verify = function (mockObject, verificationMode) {
    var verificationObject = {
        mockObject: mockObject,
        mode: toVerificationMode(verificationMode)
    };

    for (var prop in mockObject) {
        if (isTargetFunction(mockObject[prop])) {
            verificationObject[prop] = verificationMethod(prop, verificationObject);
        }
    }

    return anyIntercepted(verificationObject, function (key) {
        return verificationMethod(key, verificationObject);
    });
};

exports.times = function (expected) {
    return doTimes(expected);
};

exports.once = function () {
    return doTimes(1);
};

exports.twice = function () {
    return doTimes(2);
};

exports.never = function () {
    return doTimes(0);
};

exports.atLeast = function (expected) {
    return {
        verify: function (data) {
            if (data.length < expected) {
                throw new Error(util.format('Expect invoke at least %d times but actual %d times', expected, data.length));
            }
        }
    };
};

exports.atMost = function (expected) {
    return {
        verify: function (data) {
            if (data.length > expected) {
                throw new Error(util.format('Expect invoke at most %d times but actual %d times', expected, data.length));
            }
        }
    };
};
