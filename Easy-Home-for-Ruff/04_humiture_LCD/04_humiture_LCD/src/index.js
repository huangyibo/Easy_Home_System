'use strict';
var Path = require('path');
var Server = require('home').Server;

var server = new Server();
var mqtt = require('mqtt');
var settable = false;

$.ready(function (error) {
    if (error) {
        console.log(error);
        return;
    }
    
    var client = mqtt.connect('mqtt://121.201.28.64');
    var msg = "";
    var topic = "";

    server.use('/', Server.static('statics'));

    client.on('connect', function () {
        client.subscribe('light');
        client.subscribe('air_condition');
        client.subscribe('tv');
        client.subscribe('window');
        // client.publish('light', 'Hello Ruff!');
        console.log("connected!");
    });

    client.on('error', function () {
        console.log("disconnected!");
    });

    client.on('message', function (topicc, message) {
        topic = topicc.toString();
        if (topic == "light")
            settable = true;
        msg = message.toString();
        console.log(topic);
        console.log(msg);
    });

    var humidity_ = 0;
    var temperature_ = 0;
    var light_ = 0;

    $('#lcd').turnOn();
    $('#lcd').setCursor(1, 0);
    $('#lcd').print('Welcome!');

    setInterval( function () {
        $('#humirature').getTemperature(function (error, temperature) {
            if (error) {
                console.error(error);
                return;
            }

            $('#lcd').setCursor(1, 0);
            // console.log('temperature', temperature);
            $('#lcd').print('temperature: ' + temperature);

            temperature_ = temperature;
        });

        $('#humirature').getRelativeHumidity(function (error, humidity) {
            if (error) {
                console.error(error);
                return;
            }
            $('#lcd').setCursor(1, 1);
            $('#lcd').print('humidity: ' + humidity);

            humidity_ = humidity;
        });
        $('#light').getIlluminance(function (error, light) {
            light_ = light;
            if ( !settable && light_ >= 1000 ) {
                topic = "window";
                msg = "0";
            }
            if ( !settable && light_ <= 1000 ) {
                topic = "window";
                msg = "1";
            }

        });

    }, 1000);


    server.get('/temperature', function (req) {
        var timestamp = Number(req.query.timestamp) || 0;
        return {
            timestamp : Date.now(),
            temperature : temperature_,
            humidity : humidity_,
            light : light_,
            msg : msg
        };
    });

    server.get('/status', function (req, res) {
        return {
            timestamp : Date.now(),
            temperature : temperature_,
            humidity : humidity_,
            light : light_,
            msg : msg
        }
    });

    server.get('/home', function (req, res) {
    })

    server.get('/control', function (req, res) {
        return {
            topic : topic,
            msg : msg,
        };
    })

    $('#led-r').turnOn();

    server.listen(8888);


});


