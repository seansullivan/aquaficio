var Q = require('q'),

    logger = require('../logger');

var interfaceMock = {
    open: function (pin, options, callback) {
        logger.debug("Open pin: %s with options: %j", pin, options);

        callback();
    },

    write: function (pin, value, callback) {
        value = value === true ? 'HIGH' : 'LOW';

        logger.debug("Write to pin: %s a value of: %s", pin, value);

        callback();
    },

    close: function (pin, callback) {
        logger.debug("Close pin: %s", pin, value);

        callback();
    }
}

if(process.env.NODE_ENV === 'test') {
    module.exports = interfaceMock;
} else {
    module.exports = require('pi-gpio');
}