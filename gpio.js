var Q = require('q'),
    winston = require('winston');

var logger = new winston.Logger();

logger.add(winston.transports.Console, {
    level: 'debug',
    colorize: true,
    prettyPrint: true,
    depth: 5
});

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