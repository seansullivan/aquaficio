var util = require('util'),
    Q = require('q'),
    _ = require('lodash'),

    gpioInterface = require('./interface'),

    config = require('../config'),
    logger = require('../logger'),

    GPIO_PIN_OUTPUT = "output";


module.exports = {
    setupPins: function () {
        var pinCommands = [
            Q.npost(gpioInterface, 'open', [config.pins.outputEnable, GPIO_PIN_OUTPUT]),
            Q.npost(gpioInterface, 'write', [config.pins.outputEnable, true]),
            Q.npost(gpioInterface, 'open', [config.pins.clock, GPIO_PIN_OUTPUT]),
            Q.npost(gpioInterface, 'write', [config.pins.clock, false]),
            Q.npost(gpioInterface, 'open', [config.pins.data, GPIO_PIN_OUTPUT]),
            Q.npost(gpioInterface, 'write', [config.pins.data, false]),
            Q.npost(gpioInterface, 'open', [config.pins.latch, GPIO_PIN_OUTPUT]),
            Q.npost(gpioInterface, 'write', [config.pins.latch, false]),
        ];

        // execute all pin commands in sequence
        return pinCommands.reduce(Q.when, Q());
    },

    closePins: function () {
        var pinCommands = [
            Q.ninvoke(gpioInterface, 'close', config.pins.outputEnable),
            Q.ninvoke(gpioInterface, 'close', config.pins.clock),
            Q.ninvoke(gpioInterface, 'close', config.pins.data),
            Q.ninvoke(gpioInterface, 'close', config.pins.latch),
        ];

        // execute all pin commands in sequence
        return pinCommands.reduce(Q.when, Q());
    },

    enableShiftRegisterOutput: function () {
        return Q.npost(gpioInterface, 'write', [config.pins.outputEnable, false]);
    },

    disableShiftRegisterOutput: function() {
        return Q.npost(gpioInterface, 'write', [config.pins.outputEnable, true]);
    },

    shiftOutput: function (zones, activeZone) {
        var todo = [],
            debugOutput = '';

        todo.push(Q.npost(gpioInterface, 'write', [config.pins.clock, false]));
        todo.push(Q.npost(gpioInterface, 'write', [config.pins.latch, false]));

        _.forEach(zones, function (zone) {
            todo.push(Q.npost(gpioInterface, 'write', [config.pins.clock, false]));

            var dataValue = zone.id === activeZone ? true : false;

            todo.push(Q.npost(gpioInterface, 'write', [config.pins.data, dataValue]));

            debugOutput += dataValue === true ? '1' : '0';

            todo.push(Q.npost(gpioInterface, 'write', [config.pins.clock, true]));
        });

        todo.push(Q.npost(gpioInterface, 'write', [config.pins.latch, true]));

        logger.debug(util.format("Writing byte: %s", debugOutput));

        return todo.reduce(Q.when, Q());
    }
}