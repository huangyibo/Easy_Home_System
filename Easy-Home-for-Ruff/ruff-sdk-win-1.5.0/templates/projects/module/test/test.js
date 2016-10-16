'use strict';

var assert = require('assert');
var path = require('path');
var test = require('test');

var module = require(path.join(__dirname, '..'));

module.exports = {
    'test should run module': function () {
        assert.equal('Hello, Ruff', module());
    }
};

test.run(module.exports);
