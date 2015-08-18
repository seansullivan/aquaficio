var util = require('util'),
    Q = require('q'),
    _ = require('lodash'),

    gpioInterface = require('./interface'),

    config = require('../config'),
    logger = require('../logger'),

    GPIO_PIN_OUTPUT = "output";


module.exports = {
    setupPins: function () {
        return Q.npost(gpioInterface, 'open', [config.pins.clock, GPIO_PIN_OUTPUT])
            .then(function () {
                return Q.npost(gpioInterface, 'write', [config.pins.clock, false]);
            })
            .then(function () {
                return Q.npost(gpioInterface, 'open', [config.pins.outputEnable, GPIO_PIN_OUTPUT]);
            })
            .then(function () {
                // disable shift register output
                return Q.npost(gpioInterface, 'write', [config.pins.outputEnable, true]);
            })
            .then(function () {
                return Q.npost(gpioInterface, 'open', [config.pins.data, GPIO_PIN_OUTPUT]);
            })
            .then(function () {
                return Q.npost(gpioInterface, 'write', [config.pins.data, false]);
            })
            .then(function () {
                return Q.npost(gpioInterface, 'open', [config.pins.latch, GPIO_PIN_OUTPUT]);
            })
            .then(function () {
                return Q.npost(gpioInterface, 'write', [config.pins.latch, false]);
            });
    },

    closePins: function () {
        return Q.ninvoke(gpioInterface, 'close', config.pins.outputEnable)
            .then(function () {
                return Q.ninvoke(gpioInterface, 'close', config.pins.clock);
            })
            .then(function () {
                return Q.ninvoke(gpioInterface, 'close', config.pins.data);
            })
            .then(function () {
                return Q.ninvoke(gpioInterface, 'close', config.pins.latch);
            });
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

        return Q.npost(gpioInterface, 'write', [config.pins.clock, false])
            .then(function () {
                return Q.npost(gpioInterface, 'write', [config.pins.latch, false]);
            })
            .then(function () {
                zonesReversed = _(zones)
                    .clone(true)
                    .reverse();

                return _.reduce(zonesReversed, function (zoneTodoStack, zone) {
                    return zoneTodoStack.then(function () {
                        var dataValue = zone.id === activeZone ? true : false;

                        debugOutput += dataValue === true ? '1' : '0';

                        return Q.npost(gpioInterface, 'write', [config.pins.clock, false])
                            .then(function () {
                                return Q.npost(gpioInterface, 'write', [config.pins.data, dataValue]);
                            })
                            .then(function () {
                                return Q.npost(gpioInterface, 'write', [config.pins.clock, true]);
                            });
                    });
                }, Q());
            })
            .then(function () {
                logger.debug(util.format("Writing byte: %s", debugOutput));

                return Q.npost(gpioInterface, 'write', [config.pins.latch, true]);
            })
            .fail(function (error) {
                logger.error(error);
                logger.error(error.stack);
            });
    }
}