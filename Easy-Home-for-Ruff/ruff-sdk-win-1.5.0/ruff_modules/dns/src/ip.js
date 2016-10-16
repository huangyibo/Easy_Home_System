/*!
 * Copyright (c) 2015-2016, Nanchao, Inc.
 * All rights reserved.
 */

'use strict';

var ip = exports;
var Buffer = require('buffer').Buffer;

ip.toBuffer = function(ip, buff, offset) {
    offset = ~~offset;

    var result;

    if (uv.is_ipv4(ip)) {
        result = buff || new Buffer(offset + 4);
        ip.split(/\./g).map(function(byte) {
            result[offset++] = parseInt(byte, 10) & 0xff;
        });
    } else if (uv.is_ipv6(ip)) {
        var sections = ip.split(':', 8);

        var i;
        for (i = 0; i < sections.length; i++) {
            var isv4 = uv.is_ipv4(sections[i]);
            var v4Buffer;

            if (isv4) {
                v4Buffer = this.toBuffer(sections[i]);
                sections[i] = v4Buffer.slice(0, 2).toString('hex');
            }

            if (v4Buffer && ++i < 8) {
                sections.splice(i, 0, v4Buffer.slice(2, 4).toString('hex'));
            }
        }

        if (sections[0] === '') {
            while (sections.length < 8) {sections.unshift('0');}
        } else if (sections[sections.length - 1] === '') {
            while (sections.length < 8) {sections.push('0');}
        } else if (sections.length < 8) {
            for (i = 0; i < sections.length && sections[i] !== ''; i++){}
            var argv = [ i, 1 ];
            for (i = 9 - sections.length; i > 0; i--) {
                argv.push('0');
            }
            sections.splice.apply(sections, argv);
        }

        result = buff || new Buffer(offset + 16);
        for (i = 0; i < sections.length; i++) {
            var word = parseInt(sections[i], 16);
            result[offset++] = (word >> 8) & 0xff;
            result[offset++] = word & 0xff;
        }
    }

    if (!result) {
        throw Error('Invalid ip address: ' + ip);
    }

    return result;
};

ip.toString = function(buff, offset, length) {
    offset = ~~offset;
    length = length || (buff.length - offset);

    var result = [], i;
    if (length === 4) {
        // IPv4
        for (i = 0; i < length; i++) {
            result.push(buff[offset + i]);
        }
        result = result.join('.');
    } else if (length === 16) {
        // IPv6
        for (i = 0; i < length; i += 2) {
            result.push(buff.readUInt16BE(offset + i).toString(16));
        }
        result = result.join(':');
        result = result.replace(/(^|:)0(:0)*:0(:|$)/, '$1::$3');
        result = result.replace(/:{3,4}/, '::');
    }

    return result;
};

ip.isIP = function (ipaddr) {
    if (uv.is_ipv4(ipaddr)) {
        return 4;
    } else if (uv.is_ipv6(ipaddr)) {
        return 6;
    }
};