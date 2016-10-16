"use strict";
require('promise');
var HTTP = require('http');
var URL = require('url');
module.exports = exports = fetch;
function fetch(url, _a) {
    var _b = _a === void 0 ? {} : _a, method = _b.method, headers = _b.headers, body = _b.body, referrer = _b.referrer;
    return new Promise(function (resolve, reject) {
        var urlObject = URL.parse(url);
        if (referrer) {
            if (headers) {
                headers['referer'] = referrer;
            }
            else {
                headers = {
                    referer: referrer
                };
            }
        }
        var req = HTTP.request({
            protocol: urlObject.protocol,
            hostname: urlObject.hostname,
            port: urlObject.port,
            path: urlObject.path,
            method: method,
            headers: headers
        }, function (res) { return resolve(new Response(res)); });
        req.on('error', function (error) { return reject(error); });
        if (body) {
            req.write(body);
        }
        req.end();
    });
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = fetch;
var Response = (function () {
    function Response(res) {
        this._res = res;
        this._headers = res.headers;
        this._bufferPromise = new Promise(function (resolve, reject) {
            var chunks = [];
            res.on('data', function (chunk) {
                chunks.push(chunk);
            });
            res.on('end', function () {
                resolve(Buffer.concat(chunks));
                chunks = undefined;
            });
            res.on('error', function (error) {
                reject(error);
                chunks = undefined;
            });
        });
    }
    Object.defineProperty(Response.prototype, "ok", {
        get: function () {
            var res = this._res;
            return res.statusCode >= 200 && res.statusCode < 300;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Response.prototype, "status", {
        get: function () {
            return this._res.statusCode;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Response.prototype, "statusText", {
        get: function () {
            return this._res.statusMessage;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Response.prototype, "headers", {
        get: function () {
            return this._headers;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Response.prototype, "bodyUsed", {
        get: function () {
            return !!this._bufferPromise;
        },
        enumerable: true,
        configurable: true
    });
    Response.prototype.buffer = function () {
        if (!this._bufferPromise) {
            return Promise.reject(new Error('Buffer has already been used'));
        }
        var bufferPromise = this._bufferPromise;
        this._bufferPromise = undefined;
        return bufferPromise;
    };
    Response.prototype.text = function () {
        return this
            .buffer()
            .then(function (buffer) { return buffer.toString(); });
    };
    Response.prototype.json = function () {
        return this
            .buffer()
            .then(function (buffer) { return JSON.parse(buffer.toString()); });
    };
    return Response;
}());
exports.Response = Response;
//# sourceMappingURL=index.js.map