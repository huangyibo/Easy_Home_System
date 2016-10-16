var hop = Object.prototype.hasOwnProperty;
var Direction;
(function (Direction) {
    Direction[Direction["top"] = 0] = "top";
    Direction[Direction["right"] = 1] = "right";
    Direction[Direction["bottom"] = 2] = "bottom";
    Direction[Direction["left"] = 3] = "left";
})(Direction || (Direction = {}));
var GapDirection;
(function (GapDirection) {
    GapDirection[GapDirection["horizontal"] = 0] = "horizontal";
    GapDirection[GapDirection["vertical"] = 1] = "vertical";
})(GapDirection || (GapDirection = {}));
var ColorSelector = (function () {
    function ColorSelector(map) {
        if (map === void 0) { map = {}; }
        this.map = map;
        this.nextColorIndex = 0;
    }
    ColorSelector.prototype.getColor = function (colorPath) {
        var color = this.map[colorPath];
        if (!color) {
            color =
                this.map[colorPath] = ColorSelector.colors[this.nextColorIndex];
            this.moveNextColorIndex();
        }
        return color;
    };
    ColorSelector.prototype.revokeColor = function (colorPath) {
        var colorSet = this.map[colorPath];
        if (colorSet) {
            var nextColor = ColorSelector.colors[this.nextColorIndex];
            if (colorSet === nextColor) {
                this.moveNextColorIndex();
            }
            delete this.map[colorPath];
        }
    };
    ColorSelector.prototype.moveNextColorIndex = function () {
        this.nextColorIndex++;
        if (this.nextColorIndex === ColorSelector.colors.length) {
            this.nextColorIndex = 0;
        }
    };
    ColorSelector.colors = [
        '#ea6153',
        '#e67e22',
        '#f1c40f',
        '#3498db',
        '#2ecc71',
        '#1abc9c',
        '#34495e',
        '#9b59b6',
        '#c0392b',
        '#d35400',
        '#f39c12',
        '#2980b9',
        '#27ae60',
        '#16a085',
        '#2c3e50',
        '#8e44ad'
    ];
    return ColorSelector;
}());
function addToMappedArray(mapping, key, item) {
    if (hop.call(mapping, key)) {
        mapping[key].push(item);
    }
    else {
        mapping[key] = [item];
    }
}
var Desk = (function () {
    function Desk(devices, pinMapping, colorSelector, height) {
        if (colorSelector === void 0) { colorSelector = new ColorSelector(); }
        if (height === void 0) { height = 2; }
        this.devices = devices;
        this.pinMapping = pinMapping;
        this.colorSelector = colorSelector;
        this.height = height;
        this.pathToPin = {};
        this.pathToPinPairs = {};
        this.verticalGaps = [];
        this.horizontalGaps = [];
        this.colomnHeights = [];
        this.rowWidths = [];
        this.$element = $(document.createElement('div')).addClass('desk');
        this.width = Math.ceil(devices.length / height);
        this.initializeGaps();
        this.initializePathToPin();
        this.initializePathToPinPairs();
        this.initializeSizes();
        for (var _i = 0, devices_1 = devices; _i < devices_1.length; _i++) {
            var device = devices_1[_i];
            device.arrangeGapsForPins();
        }
        for (var _a = 0, devices_2 = devices; _a < devices_2.length; _a++) {
            var device = devices_2[_a];
            device.joinGaps();
        }
    }
    Desk.prototype.initializeGaps = function () {
        for (var i = 0; i <= this.width; i++) {
            this.verticalGaps.push(new Gap(this, GapDirection.vertical, i));
        }
        for (var i = 0; i <= this.height; i++) {
            this.horizontalGaps.push(new Gap(this, GapDirection.horizontal, i));
        }
    };
    Desk.prototype.initializePathToPin = function () {
        var devices = this.devices;
        var pathToPin = this.pathToPin;
        for (var i = 0; i < devices.length; i++) {
            var device = devices[i];
            device.desk = this;
            var x = Math.floor(i / this.height);
            var y = i % this.height;
            device.deskIndexX = x;
            device.deskIndexY = y;
            device.gapsAround = [
                // top
                this.horizontalGaps[y],
                // right
                this.verticalGaps[x + 1],
                // bottom
                this.horizontalGaps[y + 1],
                // left
                this.verticalGaps[x]
            ];
            for (var _i = 0, _a = device.pins; _i < _a.length; _i++) {
                var pin = _a[_i];
                pathToPin[pin.path] = pin;
            }
        }
    };
    Desk.prototype.initializePathToPinPairs = function () {
        for (var _i = 0, _a = this.devices; _i < _a.length; _i++) {
            var device = _a[_i];
            for (var _b = 0, _c = device.pins; _b < _c.length; _b++) {
                var pin = _c[_b];
                var path = pin.path;
                if (hop.call(this.pinMapping, path)) {
                    var pairedPathOrPaths = this.pinMapping[path];
                    var pairedPaths = void 0;
                    if (typeof pairedPathOrPaths === 'string') {
                        pairedPaths = [pairedPathOrPaths];
                    }
                    else {
                        pairedPaths = pairedPathOrPaths;
                    }
                    for (var _d = 0, pairedPaths_1 = pairedPaths; _d < pairedPaths_1.length; _d++) {
                        var pairedPath = pairedPaths_1[_d];
                        var pairedPin = this.pathToPin[pairedPath];
                        if (!pairedPin) {
                            console.warn("Missing paired pin \"" + pairedPath + "\"");
                            continue;
                        }
                        var pinPair = new PinPair(this, pin, pairedPin);
                        addToMappedArray(this.pathToPinPairs, path, pinPair);
                        addToMappedArray(this.pathToPinPairs, pairedPath, pinPair);
                    }
                }
            }
        }
    };
    Desk.prototype.initializeSizes = function () {
        for (var x = 0; x < this.width; x++) {
            // Calculate max width of devices on y axis.
            var maxWidth = 0;
            for (var y = 0; y < this.height; y++) {
                var i = x * this.height + y;
                if (i >= this.devices.length) {
                    break;
                }
                var device = this.devices[i];
                if (device.width > maxWidth) {
                    maxWidth = device.width;
                }
            }
            this.rowWidths[x] = maxWidth;
        }
        for (var y = 0; y < this.height; y++) {
            // Calculate max height of devices on x axis.
            var maxHeight = 0;
            for (var x = 0; x < this.width; x++) {
                var i = x * this.height + y;
                if (i >= this.devices.length) {
                    break;
                }
                var device = this.devices[i];
                if (device.height > maxHeight) {
                    maxHeight = device.height;
                }
            }
            this.colomnHeights[y] = maxHeight;
        }
    };
    Desk.prototype.render = function () {
        this.renderDevices();
        this.renderWires();
    };
    Desk.prototype.renderDevices = function () {
        var left = this.verticalGaps[0].width;
        for (var x = 0; x < this.width; x++) {
            // Calculate max width of devices on y axis.
            var maxWidth = this.rowWidths[x];
            // Second round, set the offset based on max width (centering).
            for (var y = 0; y < this.height; y++) {
                var i = x * this.height + y;
                if (i >= this.devices.length) {
                    break;
                }
                var device = this.devices[i];
                device.deskOffsetX = left + (maxWidth - device.width) / 2;
            }
            left += maxWidth;
            var gap = this.verticalGaps[x + 1];
            gap.deskOffsetX = left;
            left += gap.width;
        }
        var deskWidth = left;
        var top = this.horizontalGaps[0].width;
        for (var y = 0; y < this.height; y++) {
            // Calculate max height of devices on x axis.
            var maxHeight = this.colomnHeights[y];
            // Second round, set the offset based on max height (centering).
            for (var x = 0; x < this.width; x++) {
                var i = x * this.height + y;
                if (i >= this.devices.length) {
                    break;
                }
                var device = this.devices[i];
                device.deskOffsetY = top + (maxHeight - device.height) / 2;
            }
            top += maxHeight;
            var gap = this.horizontalGaps[y + 1];
            gap.deskOffsetY = top;
            top += gap.width;
        }
        var deskHeight = top;
        this.$element.css({
            width: deskWidth + 'px',
            height: deskHeight + 'px'
        });
        for (var _i = 0, _a = this.devices; _i < _a.length; _i++) {
            var device = _a[_i];
            this.$element.append(device.$element);
        }
    };
    Desk.prototype.renderWires = function () {
        for (var _i = 0, _a = this.horizontalGaps; _i < _a.length; _i++) {
            var gap = _a[_i];
            gap.render();
        }
        for (var _b = 0, _c = this.verticalGaps; _b < _c.length; _b++) {
            var gap = _c[_b];
            gap.render();
        }
    };
    return Desk;
}());
var Pin = (function () {
    function Pin(_a) {
        var id = _a.id, type = _a.type, reserved = _a.reserved, direction = _a.direction, x = _a.x, y = _a.y;
        this.pinPairPathToGapLine = {};
        this.id = id;
        this.x = x;
        this.y = y;
        this.$element = $(document.createElement('div'))
            .addClass('pin')
            .toggleClass('reserved', !!reserved)
            .attr('data-id', id)
            .attr('data-type', type)
            .attr('data-direction', direction)
            .css({
            left: x + 'px',
            top: y + 'px'
        });
    }
    Object.defineProperty(Pin.prototype, "path", {
        get: function () {
            return this.device.id + '/' + this.id;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Pin.prototype, "deskOffsetX", {
        get: function () {
            return this.device.deskOffsetX + this.x;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Pin.prototype, "deskOffsetY", {
        get: function () {
            return this.device.deskOffsetY + this.y;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Pin.prototype, "zIndexBase", {
        get: function () {
            return this._zIndexBase;
        },
        set: function (value) {
            this._zIndexBase = value;
            this.$element.css('z-index', value * 2 + 101);
        },
        enumerable: true,
        configurable: true
    });
    Pin.prototype.getDeskOffsetX = function (pinPair) {
        return this.deskOffsetX;
    };
    Pin.prototype.getDeskOffsetY = function (pinPair) {
        return this.deskOffsetY;
    };
    return Pin;
}());
var PinPair = (function () {
    function PinPair(desk, pinA, pinB) {
        this.pinA = pinA;
        this.pinB = pinB;
        this.color = desk.colorSelector.getColor(this.path);
    }
    Object.defineProperty(PinPair.prototype, "path", {
        get: function () {
            var pathA = this.pinA.path;
            var pathB = this.pinB.path;
            if (pathA > pathB) {
                _a = [pathB, pathA], pathA = _a[0], pathB = _a[1];
            }
            return pathA + '>' + pathB;
            var _a;
        },
        enumerable: true,
        configurable: true
    });
    return PinPair;
}());
var Device = (function () {
    function Device(id, imageUrl, width, height, pins) {
        this.id = id;
        this.width = width;
        this.height = height;
        this.pins = pins;
        // devicesAround: Device[] = [];
        this.gapsAround = [];
        this.$element = $(document.createElement('div'))
            .addClass('device')
            .attr('data-id', id)
            .css({
            width: width + 'px',
            height: height + 'px'
        });
        if (imageUrl) {
            this.$element.css({
                backgroundImage: "url(" + imageUrl + ")",
                backgroundSize: width + "px " + height + "px"
            });
        }
        else {
            this.$element.addClass('no-image');
        }
        for (var _i = 0, pins_1 = pins; _i < pins_1.length; _i++) {
            var pin = pins_1[_i];
            pin.device = this;
            this.$element.append(pin.$element);
        }
    }
    Object.defineProperty(Device.prototype, "deskOffsetX", {
        get: function () {
            return this._deskOffsetX;
        },
        set: function (value) {
            this.$element.css({
                left: value + 'px'
            });
            this._deskOffsetX = value;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Device.prototype, "deskOffsetY", {
        get: function () {
            return this._deskOffsetY;
        },
        set: function (value) {
            this.$element.css({
                top: value + 'px'
            });
            this._deskOffsetY = value;
        },
        enumerable: true,
        configurable: true
    });
    Device.prototype.arrangeGapsForPins = function () {
        for (var _i = 0, _a = this.pins; _i < _a.length; _i++) {
            var pin = _a[_i];
            if (!(pin.path in this.desk.pathToPinPairs)) {
                continue;
            }
            var gapDirection = void 0;
            var distances = [
                // top
                pin.y,
                // right
                this.width - pin.x,
                // bottom
                this.height - pin.y,
                // left
                pin.x
            ];
            var minDistance = Infinity;
            for (var i = 0; i < distances.length; i++) {
                var distance = distances[i];
                if (distance < minDistance) {
                    minDistance = distance;
                    gapDirection = i;
                }
            }
            pin.zIndexBase = Math.floor(minDistance);
            this.gapsAround[gapDirection].add(pin);
        }
    };
    Device.prototype.joinGaps = function () {
        var desk = this.desk;
        for (var _i = 0, _a = this.pins; _i < _a.length; _i++) {
            var pin = _a[_i];
            var pinPairs = desk.pathToPinPairs[pin.path];
            if (!pinPairs) {
                continue;
            }
            for (var _b = 0, pinPairs_1 = pinPairs; _b < pinPairs_1.length; _b++) {
                var pinPair = pinPairs_1[_b];
                var pairedPin = pinPair.pinA === pin ? pinPair.pinB : pinPair.pinA;
                if (pin.gap === pairedPin.gap) {
                    // The same gap, great
                    pin.pinPairPathToGapLine[pinPair.path].heads = [pin, pairedPin];
                }
                else if (pin.gap.direction === pairedPin.gap.direction) {
                    var jointGap = void 0;
                    // parallel gaps
                    switch (pin.gap.direction) {
                        case GapDirection.horizontal:
                            var xA = this.deskIndexX;
                            var xB = pairedPin.device.deskIndexX;
                            var x = void 0;
                            if (xA === xB) {
                                if (pin.x + pairedPin.x < desk.rowWidths[this.deskIndexX]) {
                                    x = xA;
                                }
                                else {
                                    x = xA + 1;
                                }
                            }
                            else {
                                x = Math.ceil((xA + xB) / 2);
                            }
                            jointGap = desk.verticalGaps[x];
                            jointGap.join(pinPair, pin.gap, pairedPin.gap);
                            break;
                        case GapDirection.vertical:
                            var yA = this.deskIndexY;
                            var yB = pairedPin.device.deskIndexY;
                            var y = void 0;
                            if (yA === yB) {
                                if (pin.y + pairedPin.y < desk.colomnHeights[this.deskIndexY]) {
                                    y = yA;
                                }
                                else {
                                    y = yA + 1;
                                }
                            }
                            else {
                                y = Math.ceil((yA + yB) / 2);
                            }
                            jointGap = desk.horizontalGaps[y];
                            jointGap.join(pinPair, pin.gap, pairedPin.gap);
                            break;
                    }
                    pin.pinPairPathToGapLine[pinPair.path].heads = [pin, jointGap];
                }
                else {
                    // gaps that cross each other
                    pin.pinPairPathToGapLine[pinPair.path].heads = [pin, pairedPin.gap];
                }
            }
        }
    };
    return Device;
}());
var GapLine = (function () {
    function GapLine(gap, index, pinPair) {
        this.gap = gap;
        this.index = index;
        this.pinPair = pinPair;
        this.$element = $(document.createDocumentFragment());
    }
    Object.defineProperty(GapLine.prototype, "deskOffsetX", {
        get: function () {
            var gap = this.gap;
            return gap.deskOffsetX + gap.padding + gap.lineMargin * this.index;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(GapLine.prototype, "deskOffsetY", {
        get: function () {
            var gap = this.gap;
            return gap.deskOffsetY + gap.padding + gap.lineMargin * this.index;
        },
        enumerable: true,
        configurable: true
    });
    GapLine.prototype.render = function () {
        if (!this.heads) {
            return;
        }
        for (var _i = 0, _a = this.heads; _i < _a.length; _i++) {
            var head = _a[_i];
            if (head instanceof Pin) {
                this.renderLineToPin(head);
            }
        }
        if (this.heads.length < 2) {
            return;
        }
        var headA = this.heads[0];
        var headB = this.heads[1];
        var $wireShadow = $(document.createElement('div'))
            .addClass('wire-shadow');
        var $wire = $(document.createElement('div'))
            .css({
            backgroundColor: this.pinPair.color
        })
            .add($wireShadow)
            .addClass('wire in-gap')
            .attr('data-path', this.pinPair.path)
            .attr('data-pin-from', this.pinPair.pinA.id)
            .attr('data-device-from', this.pinPair.pinA.device.id)
            .attr('data-pin-to', this.pinPair.pinB.id)
            .attr('data-device-to', this.pinPair.pinB.device.id);
        switch (this.gap.direction) {
            case GapDirection.horizontal:
                var offsetXA = headA.getDeskOffsetX(this.pinPair);
                var offsetXB = headB.getDeskOffsetX(this.pinPair);
                $wire.css({
                    top: this.deskOffsetY + 'px',
                    left: Math.min(offsetXA, offsetXB) + 'px',
                    width: Math.abs(offsetXA - offsetXB) + 'px'
                });
                break;
            case GapDirection.vertical:
                var offsetYA = headA.getDeskOffsetY(this.pinPair);
                var offsetYB = headB.getDeskOffsetY(this.pinPair);
                $wire.css({
                    left: this.deskOffsetX + 'px',
                    top: Math.min(offsetYA, offsetYB) + 'px',
                    height: Math.abs(offsetYA - offsetYB) + 'px'
                });
                break;
        }
        this.$element.append($wire);
    };
    GapLine.prototype.renderLineToPin = function (pin) {
        var $wireShadow = $(document.createElement('div'))
            .addClass('wire-shadow');
        var $wire = $(document.createElement('div'))
            .css({
            zIndex: pin.zIndexBase * 2 + 100,
            backgroundColor: this.pinPair.color
        })
            .add($wireShadow)
            .addClass('wire')
            .attr('data-path', this.pinPair.path)
            .attr('data-pin-from', this.pinPair.pinA.id)
            .attr('data-device-from', this.pinPair.pinA.device.id)
            .attr('data-pin-to', this.pinPair.pinB.id)
            .attr('data-device-to', this.pinPair.pinB.device.id);
        pin.$element.addClass('connected');
        switch (this.gap.direction) {
            case GapDirection.horizontal:
                $wire
                    .addClass('vertical')
                    .css({
                    left: pin.deskOffsetX + 'px',
                    top: Math.min(pin.deskOffsetY, this.deskOffsetY) + 'px',
                    height: Math.abs(pin.deskOffsetY - this.deskOffsetY) + 'px'
                });
                break;
            case GapDirection.vertical:
                $wire
                    .addClass('horizontal')
                    .css({
                    top: pin.deskOffsetY + 'px',
                    left: Math.min(pin.deskOffsetX, this.deskOffsetX) + 'px',
                    width: Math.abs(pin.deskOffsetX - this.deskOffsetX) + 'px'
                });
                break;
        }
        this.$element.append($wire);
    };
    return GapLine;
}());
var Gap = (function () {
    function Gap(desk, direction, deskIndex) {
        this.desk = desk;
        this.direction = direction;
        this.deskIndex = deskIndex;
        this.padding = 10;
        this.lineMargin = 10;
        this.lineWidth = 4;
        this.deskOffsetX = 0;
        this.deskOffsetY = 0;
        this.lines = [];
    }
    Object.defineProperty(Gap.prototype, "width", {
        get: function () {
            return this.lineMargin * (this.lines.length - 1) + this.padding * 2;
        },
        enumerable: true,
        configurable: true
    });
    Gap.prototype.requireLineByPinPair = function (pinPair) {
        for (var _i = 0, _a = this.lines; _i < _a.length; _i++) {
            var line = _a[_i];
            if (line.pinPair === pinPair) {
                return line;
            }
        }
        throw new Error('No matching pin pair.');
    };
    Gap.prototype.getDeskOffsetX = function (pinPair) {
        return this
            .requireLineByPinPair(pinPair)
            .deskOffsetX;
    };
    Gap.prototype.getDeskOffsetY = function (pinPair) {
        return this
            .requireLineByPinPair(pinPair)
            .deskOffsetY;
    };
    Gap.prototype.add = function (pin) {
        pin.gap = this;
        var pinPairs = this.desk.pathToPinPairs[pin.path];
        for (var _i = 0, pinPairs_2 = pinPairs; _i < pinPairs_2.length; _i++) {
            var pinPair = pinPairs_2[_i];
            for (var _a = 0, _b = this.lines; _a < _b.length; _a++) {
                var line_1 = _b[_a];
                if (line_1.pinPair === pinPair) {
                    pin.pinPairPathToGapLine[pinPair.path] = line_1;
                    return;
                }
            }
            var line = new GapLine(this, this.lines.length, pinPair);
            pin.pinPairPathToGapLine[pinPair.path] = line;
            // TODO: better arrangement
            this.lines.push(line);
        }
    };
    Gap.prototype.join = function (pinPair, gapA, gapB) {
        for (var _i = 0, _a = this.lines; _i < _a.length; _i++) {
            var line_2 = _a[_i];
            if (line_2.pinPair === pinPair) {
                return;
            }
        }
        var line = new GapLine(this, this.lines.length, pinPair);
        line.heads = [gapA, gapB];
        // TODO: better arrangement
        this.lines.push(line);
    };
    Gap.prototype.render = function () {
        for (var _i = 0, _a = this.lines; _i < _a.length; _i++) {
            var line = _a[_i];
            line.render();
            this.desk.$element.append(line.$element);
        }
    };
    return Gap;
}());
