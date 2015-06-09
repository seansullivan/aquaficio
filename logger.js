var winston = require('winston');

var logger = new winston.Logger();

logger.add(winston.transports.Console, {
    level: 'debug',
    colorize: true,
    prettyPrint: true,
    depth: 5
});

module.exports = logger;