var desk;
var ioSuffixesMap = {
    i2c: ['SCL', 'SDA'],
    uart: [
        {
            from: 'TX',
            to: 'RX'
        },
        {
            from: 'RX',
            to: 'TX'
        },
        {
            from: 'CTS',
            to: 'RTS'
        },
        {
            from: 'RTS',
            to: 'CTS'
        }
    ]
};
var ioDirMapping = {
    in: 'out',
    out: 'in'
};
var multipleBindingsTypes = {
    i2c: true,
    power: true,
    ground: true
};
var renderData;
// references for ui -> data.
/** device id as key */
var deviceDataItems = {};
/** pin path as key */
var pinDataItems = {};
function initialize() {
    for (var _i = 0, _a = renderData.devices; _i < _a.length; _i++) {
        var deviceData = _a[_i];
        for (var _b = 0, _c = deviceData.pins; _b < _c.length; _b++) {
            var pin = _c[_b];
            pinDataItems[deviceData.id + '/' + pin.id] = pin;
        }
        deviceDataItems[deviceData.id] = deviceData;
    }
    renderDesk();
}
var $titleLayer = $(
        "<div class=\"title-layer\">\n" +
        "<div class=\"id\"></div>\n" +
        "<div class=\"alias\"></div>\n" +
        "<div class=\"type\"></div>\n</div>")
    .hide()
    .appendTo(document.body);

var line = '=========================';

// TODO: dynamically add div item
var $titleDeviceLayer = $(
        "<div class=\"title-device-layer\">\n" +
        "<div class=\"connection\"></div>\n" +
        "<div class=\"line\"></div>\n</div>")
    .hide()
    .appendTo(document.body);

var $errorLayer = $(document.createElement('div'))
    .addClass('error-layer')
    .hide()
    .appendTo(document.body);
var showingErrorTimer;
function showError(message) {
    clearTimeout(showingErrorTimer);
    $errorLayer
        .text(message)
        .fadeIn(200);
    showingErrorTimer = setTimeout(function () {
        $errorLayer.fadeOut(200);
    }, 2000);
}
var $draggablePin = $(document.createElement('div'))
    .addClass('draggable-pin')
    .hide()
    .appendTo(document.body);
var mousedownData = {
    $pin: undefined,
    x: undefined,
    y: undefined
};
var withinClickRange;
var $highlightedWires;

$(document)
    .delegate('.pin:not(.reserved)', 'mousedown', function (event) {
    var $target = $(event.target);
    mousedownData.$pin = $target;
    mousedownData.x = event.clientX;
    mousedownData.y = event.clientY;
    withinClickRange = true;
    var type = $target.attr('data-type');
    var dir = $target.attr('data-direction');
    var pairedDir = ioDirMapping[dir];
    var possiblePairSelector = "[data-type=\"" + type + "\"][data-direction=\"" + pairedDir + "\"]";
    $('.pin').each(function (index, ele) {
        var $ele = $(ele);
        $ele.toggleClass('possible-pair', $ele.is(possiblePairSelector));
    });
    $('.desk').addClass('dragging');
    $target.addClass('dragging-origin');
})
    .delegate('.pin', 'mouseenter', function (event) {
    showPinTip($(event.target), event);
})
    .delegate('.pin', 'mouseleave', function (event) {
    var $target = $(event.target);
    if ($target.is('.possible-pair')) {
        $target.removeClass('hover');
    }
    hidePinTip();
})
    .delegate('.wire', 'mouseenter', function (event) {
    var $target = $(event.target);
    var path = $target.attr('data-path');
    var pinFrom = $target.attr('data-pin-from');
    var pinTo = $target.attr('data-pin-to');
    var deviceFrom = $target.attr('data-device-from');
    var deviceTo = $target.attr('data-device-to');
    var highlightWiresSelector = "[data-path=\"" + path + "\"]";
    $('.wire').each(function (index, ele) {
        var $ele = $(ele);
        $ele.toggleClass('highlight', $ele.is(highlightWiresSelector));
    });
    $('.pin').removeClass('highlight');
    $(".device[data-id=\"" + deviceFrom + "\"] .pin[data-id=\"" + pinFrom + "\"]").addClass('highlight');
    $(".device[data-id=\"" + deviceTo + "\"] .pin[data-id=\"" + pinTo + "\"]").addClass('highlight');
})
    .delegate('.wire', 'mouseleave', function (event) {
    $('.wire.highlight, .pin.highlight').removeClass('highlight');
})
    .delegate('.device', 'mouseenter', function (event) {
    var $target = $(event.target);
    var path = $target.attr('data-path');
    var highlightWiresSelector = "[data-path=\"" + path + "\"]";
    $('.wire').each(function (index, ele) {
        var $ele = $(ele);
        $ele.toggleClass('highlight', $ele.is(highlightWiresSelector));
    });
    $('.pin').removeClass('highlight');
    highlightDevicePins($(event.target), event);
    showDeviceTip($(event.target), event);
})
    .delegate('.device', 'mouseleave', function (event) {
    hideDeviceTip($(event.target), event);
    $('.wire.highlight, .pin.highlight').removeClass('highlight');
})
    .mousemove(function (event) {
    var possiblePins = $('.pin.possible-pair');
    if (!possiblePins.length) {
        return;
    }
    var width = possiblePins.outerWidth();
    var x = event.clientX;
    var y = event.clientY;
    if (withinClickRange) {
        if (Math.sqrt(Math.pow(x - mousedownData.x, 2) + Math.pow(y - mousedownData.y, 2)) > 2) {
            withinClickRange = false;
        }
    }
    $draggablePin
        .css({
        left: x + 'px',
        top: y + 'px'
    })
        .fadeIn(100);
    var found = false;
    possiblePins.each(function (index, ele) {
        var $ele = $(ele);
        if (!found && isElementInRange(ele, event)) {
            found = true;
            $ele.addClass('hover');
            showPinTip($ele, event);
        }
        else {
            $ele.removeClass('hover');
        }
    });
    if (!found) {
        hidePinTip();
    }
})
    .mouseup(function (event) {
    var $target = mousedownData.$pin;
    if (withinClickRange && $target.is('.connected')) {
        disconnect($target);
    }
    else {
        var $origin = $('.pin.dragging-origin');
        var $paired = $('.pin.possible-pair.hover');
        if ($origin.length && $paired.length) {
            connect($origin, $paired);
        }
    }
    $('.pin').removeClass('dragging-origin possible-pair hover');
    $('.desk').removeClass('dragging');
    $draggablePin.hide();
});

function highlightDevicePins($target, event) {
    var id = $target.attr('data-id');
    var wires = $('.wire.vertical:not(.wire-shadow)');

    for (var i = 0; i < wires.length; i++) {
        wire = $(wires[i]);

        var deviceFrom = wire.data('device-from');
        var deviceTo = wire.data('device-to');
        var pinFrom = wire.data('pin-from');
        var pinTo = wire.data('pin-to');
        var dataPath = deviceFrom + '/' + pinFrom + ">" + deviceTo + '/' + pinTo;

        // the device itself or the mainboard
        if (deviceFrom === id || deviceTo === id) {
            $(".wire[data-path=\"" + dataPath + "\"]").addClass('highlight');
            $(".device[data-id=\"" + deviceFrom + "\"] .pin[data-id=\"" + pinFrom + "\"]").addClass('highlight');
            $(".device[data-id=\"" + deviceTo + "\"] .pin[data-id=\"" + pinTo + "\"]").addClass('highlight');
        }
    }
}

function alignWords(former, latter) {
    var string;

    string = former + ' ';
    for (var i = 0; i < line.length - 2 - former.length - latter.length; i++) {
        string += '.';
    }
    string = string +  ' ' + latter;

    return string;
}

function hideDeviceTip($target, event) {
    var targetClass = $target.attr('class');
    if (targetClass !== 'device') {
        return;
    }

    $titleDeviceLayer.fadeOut();
}

function showDeviceTip($target, event) {
    var targetClass = $target.attr('class');
    if (targetClass !== 'device') {
        return;
    }

    $titleDeviceLayer.find('.pin-path').remove();

    var id = $target.attr('data-id');

    var $wires = $('.wire[data-device-from="' + id + '"]:not(.wire-shadow)');

    if (!$wires.length) {
        return;
    }

    $titleDeviceLayer
        .find('.connection')
        .text(alignWords($wires.data('device-from'), $wires.data('device-to')));

    $titleDeviceLayer
        .find('.line')
        .text(line);

    var pinPathSet = {};

    var $pinPaths = $wires.map(function (index) {
        var $wire = $(this);

        var pinPath = $wire.data('path');

        if (pinPath in pinPathSet) {
            return;
        }

        pinPathSet[pinPath] = true;

        var pinFrom = $wire.data('pin-from');
        var pinTo = $wire.data('pin-to');

        return $(document.createElement('div'))
            .addClass('pin-path')
            .text(alignWords(pinFrom, pinTo))
            .get();
    });

    $titleDeviceLayer.append($pinPaths);

    // TODO: reuse these codes with showPinTip()
    var left;
    var right;
    var top;
    var bottom;

    $titleDeviceLayer
        .stop(true, false)
        .css('visibility', 'hidden')
        .show();

    var $window = $(window);
    var bodyWidth = $window.width();
    var bodyHeight = $window.height();
    var layerWidth = $titleDeviceLayer.outerWidth() + 24;
    var layerHeight = $titleDeviceLayer.outerHeight();
    var x = event.clientX;
    var y = event.clientY;

    if (x + layerWidth > bodyWidth && layerWidth < bodyWidth) {
        left = '';
        right = bodyWidth - x + 'px';
    }
    else {
        left = x + 'px';
        right = '';
    }
    if (y + layerHeight > bodyHeight && layerHeight < bodyHeight) {
        top = '';
        bottom = bodyHeight - y + 'px';
    }
    else {
        top = y + 'px';
        bottom = '';
    }

    $titleDeviceLayer
        .css({
        left: left,
        right: right,
        top: top,
        bottom: bottom,
        visibility: 'visible'
    })
        .fadeIn(100);
}

function hidePinTip() {
    $titleLayer.fadeOut();
}
function showPinTip($target, event) {
    if ($target.is('.possible-pair')) {
        $target.addClass('hover');
    }
    var id = $target.attr('data-id');
    var idOnBoard = $target.attr('data-id-on-board');
    var type = $target.attr('data-type');
    if (idOnBoard) {
        $titleLayer
            .find('.id')
            .text(idOnBoard);
        $titleLayer
            .find('.alias')
            .text(id)
            .show();
    }
    else {
        $titleLayer
            .find('.id')
            .text(id);
        $titleLayer
            .find('.alias')
            .text('')
            .hide();
    }
    $titleLayer
        .find('.type')
        .text(type || 'unknown');
    var left;
    var right;
    var top;
    var bottom;
    $titleLayer
        .stop(true, false)
        .css('visibility', 'hidden')
        .show();
    var $window = $(window);
    var bodyWidth = $window.width();
    var bodyHeight = $window.height();
    var layerWidth = $titleLayer.outerWidth() + 24;
    var layerHeight = $titleLayer.outerHeight();
    var x = event.clientX;
    var y = event.clientY;
    if (x + layerWidth > bodyWidth && layerWidth < bodyWidth) {
        left = '';
        right = bodyWidth - x + 'px';
    }
    else {
        left = x + 'px';
        right = '';
    }
    if (y + layerHeight > bodyHeight && layerHeight < bodyHeight) {
        top = '';
        bottom = bodyHeight - y + 'px';
    }
    else {
        top = y + 'px';
        bottom = '';
    }
    $titleLayer
        .css({
        left: left,
        right: right,
        top: top,
        bottom: bottom,
        visibility: 'visible'
    })
        .fadeIn(100);
}
function connect($origin, $paired) {
    var mapping = renderData.mapping;
    var fromPath = getIOPath($origin);
    var toPath = getIOPath($paired);
    var type = $origin.attr('data-type');
    var allowMultiple = !!hop.call(multipleBindingsTypes, type) && multipleBindingsTypes[type];
    if ($origin.attr('data-direction') === 'out') {
        _a = [toPath, fromPath], fromPath = _a[0], toPath = _a[1];
    }
    if (!allowMultiple) {
        for (var _i = 0, _b = Object.keys(mapping); _i < _b.length; _i++) {
            var path = _b[_i];
            if (mapping[path] === toPath) {
                delete mapping[path];
            }
        }
    }
    mapping[fromPath] = toPath;
    renderDesk();
    var _a;
}
function disconnect($pin) {
    var path = getIOPath($pin);
    var mapping = renderData.mapping;
    if (mapping[path]) {
        delete mapping[path];
    }
    for (var _i = 0, _a = Object.keys(mapping); _i < _a.length; _i++) {
        var fromPath = _a[_i];
        if (mapping[fromPath] === path) {
            delete mapping[fromPath];
        }
    }
    renderDesk();
}
function getIOPath($pin) {
    var deviceId = $pin.closest('.device').attr('data-id');
    var pinId = $pin.attr('data-id');
    var ioId = pinId.split('.')[0];
    return deviceId + '/' + ioId;
}
function isElementInRange(ele, event) {
    var rect = ele.getBoundingClientRect();
    var diffX = event.clientX - rect.left;
    if (diffX < 0 || diffX > ele.offsetWidth) {
        return false;
    }
    var diffY = event.clientY - rect.top;
    if (diffY < 0 || diffY > ele.offsetHeight) {
        return false;
    }
    return true;
}
var $saveButton = $('.save-button');
$saveButton.click(function () {
    $saveButton
        .text('Saving')
        .prop('disabled', true);
    $.ajax('/api/save-mapping', {
        method: 'post',
        data: JSON.stringify(renderData.mapping),
        contentType: 'application/json'
    })
        .done(function () {
        $saveButton
            .text('Saved');
        setTimeout(function () {
            $saveButton
                .text('Save')
                .prop('disabled', false);
        }, 500);
    });
});
var $resetButton = $('.reset-button');
$resetButton.click(function () {
    $resetButton
        .text('Resetting')
        .prop('disabled', true);
    $.getJSON('/api/reset', function (data) {
        renderData.mapping = data;
        renderDesk();
        setTimeout(function () {
            $resetButton
                .text('Reset')
                .prop('disabled', false);
        }, 500);
    });
});
$.getJSON('/api/get-data', function (data) {
    renderData = data;
    initialize();
});
window.onbeforeunload = function () {
    $.get('/api/close' + location.search);
};
window.onerror = function (error) {
    showError(error);
};
function renderDesk() {
    if (desk) {
        desk.$element.remove();
    }
    var ioTypes = {};
    var devices = renderData
        .devices
        .map(function (deviceData) {
        var pins = deviceData
            .pins
            .map(function (pinData) {
            var ioPath = deviceData.id + '/' + pinData.id.split('.')[0];
            if (!hop.call(ioTypes, ioPath)) {
                ioTypes[ioPath] = pinData.type;
            }
            return new Pin(pinData);
        });
        return new Device(deviceData.id, deviceData.imageUrl, deviceData.width, deviceData.height, pins);
    });
    var ioMapping = renderData.mapping;
    var pinMapping = {};
    for (var _i = 0, _a = Object.keys(ioMapping); _i < _a.length; _i++) {
        var inputId = _a[_i];
        var outputId = ioMapping[inputId];
        var type = ioTypes[inputId];
        var suffixes = hop.call(ioSuffixesMap, type) && ioSuffixesMap[type];
        if (suffixes) {
            for (var _b = 0, suffixes_1 = suffixes; _b < suffixes_1.length; _b++) {
                var suffix = suffixes_1[_b];
                var from = void 0;
                var to = void 0;
                if (typeof suffix === 'string') {
                    from = suffix;
                    to = suffix;
                }
                else {
                    from = suffix.from;
                    to = suffix.to;
                }
                pinMapping[(inputId + "." + from)] = outputId + "." + to;
            }
        }
        else {
            pinMapping[inputId] = outputId;
        }
    }
    desk = new Desk(devices, pinMapping);
    desk.render();
    desk.$element.appendTo(document.getElementsByClassName('desk-wrapper')[0]);
    $titleLayer.fadeOut();
    // The default style is NOT highlighted
    $('.desk').addClass('hover-wire');
}
