// 60 seconds per tick
// Get current time
// determine which zone should be on

var Q = require('q'),
    _ = require('lodash'),
    winston = require('winston'),
    moment = require('moment'),

    gpio = require('./gpio'),

    config = require('./config'),

    manifest = require('./manifest.json');

var logger = new winston.Logger();

logger.add(winston.transports.Console, {
    level: 'debug',
    colorize: true,
    prettyPrint: true,
    depth: 5
});

var zones = manifest.zones,

    programs = manifest.programs,

    activePrograms = _.filter(programs, 'active', true),

    activeProgram = _.first(activePrograms);

    currentState = {};

if(_.size(activePrograms) > 1) {
    logger.error("Multiple active programs not yet supported");
    process.exit(1);
}

logger.info("Using program: %s", activeProgram.name);

// get active zone from current state
function getActiveZone() {
    return _.find(currentState, function (zone) {
        return zone !== null;
    });
}

var initialize = function () {
        /**
         * Build the initial state
         */
        _.forEach(zones, function (zone) {
            currentState[zone.id] = null;
        });

        return setupPins()
            .then(function () {
                return shiftOutput(null);
            })
            .then(function () {
                return Q.npost(gpio, 'write', [config.pins.outputEnable, 1])
            });
    },

    GPIO_PIN_OUTPUT = "output",

    setupPins = function () {
        var pinCommands = [
            Q.npost(gpio, 'open', [config.pins.outputEnable, GPIO_PIN_OUTPUT]),
            Q.npost(gpio, 'write', [config.pins.outputEnable, 1]),
            Q.npost(gpio, 'open', [config.pins.clock, GPIO_PIN_OUTPUT]),
            Q.npost(gpio, 'write', [config.pins.clock, 0]),
            Q.npost(gpio, 'open', [config.pins.data, GPIO_PIN_OUTPUT]),
            Q.npost(gpio, 'write', [config.pins.data, 0]),
            Q.npost(gpio, 'open', [config.pins.latch, GPIO_PIN_OUTPUT]),
            Q.npost(gpio, 'write', [config.pins.latch, 0]),
        ];

        // execute all pin commands in sequence
        return pinCommands.reduce(Q.when, Q());
    },

    closePins = function () {
        var pinCommands = [
            Q.ninvoke(gpio, 'close', config.pins.outputEnable),
            Q.ninvoke(gpio, 'close', config.pins.clock),
            Q.ninvoke(gpio, 'close', config.pins.data),
            Q.ninvoke(gpio, 'close', config.pins.latch),
        ];

        // execute all pin commands in sequence
        return pinCommands.reduce(Q.when, Q());
    },

    shiftOutput = function (activeZone) {
        var todo = [];

        todo.push(Q.npost(gpio, 'write', [config.pins.clock, false]));
        todo.push(Q.npost(gpio, 'write', [config.pins.latch, false]));

        _.forEach(zones, function (zone) {
            todo.push(Q.npost(gpio, 'write', [config.pins.clock, false]));

            var dataValue = zone.id === activeZone ? true : false;

            todo.push(Q.npost(gpio, 'write', [config.pins.data, dataValue]));

            todo.push(Q.npost(gpio, 'write', [config.pins.clock, true]));
        });

        todo.push(Q.npost(gpio, 'write', [config.pins.latch, true]));

        return todo.reduce(Q.when, Q());
    }

    execute = function () {
        var now = moment(),

            firstZone = _.first(activeProgram.zones),

            programTotalDuration = 0;

        logger.info("Sprinklers processing at %s", now.toString());

        // Should any zones be active?
        // Zones to run:
        if(_.size(activeProgram.zones) === 1 && firstZone.zone === "all") {
            logger.debug("Running all zones for this program.");

            // determine program total duration
            programTotalDuration = _.size(zones) * firstZone.duration;

            // Start building a list of start times, need to know the start time for
            // each run so we can determine end time and know if we should currently
            // be running a program
            var startTimes = activeProgram.run_at;

            // if any start times are events, satisfy those events to determine the start time from it
            startTimes = _.map(startTimes, function (startTime) {
                if(_.has(startTime, 'event')) {
                    // convert event criteria to timestamp
                    logger.warn("Event parsing not yet implemented");
                    return null;
                }

                if(!_.has(startTime, 'time')) {
                    throw new Error("Unable to parse start time for program");
                }
                var hour = _.has(startTime.time, 'hour') ? startTime.time.hour : 0,
                    minute = _.has(startTime.time, 'minute') ? startTime.time.minute : 0;

                if(!hour) {
                    logger.warn("Program does not have an hour");
                    return null;
                }

                // Build the start time moment object
                return moment().startOf('day').hour(hour).minute(minute);
            });

            // filter out any null start times
            startTimes = _.filter(startTimes, null);

            // @TODO -- detect any start times that are too close to another when we factor in duration
            // This could be detected and prevented when saving settings

            var useStartTime = false;
            // Should any programs currently be running?
            _.forEach(startTimes, function (startTime) {
                // to get time, clone the startTime moment object and add on the duration
                var endTime = moment(startTime).add(programTotalDuration, 'ms');

                if(!now.isBetween(startTime, endTime, moment)) {
                    return;
                }

                useStartTime = startTime;
                return false;
            });

            // program not currently running, shut off any active zone
            if(!useStartTime) {
                var activeZone = getActiveZone();

                if(!activeZone) {
                    logger.debug("No active zone, no program to run");
                    return Q();
                }

                // @TODO Turn off active zone -- cleanup
                return Q();
            }

            // At this point, a program is running and we need to figure out
            // which zone should be on (all others should be off)

            var numberOfMillisecondsIntoProgram = (now.unix() - useStartTime.unix()) * 1000;

            var activeZone = Math.ceil(numberOfMillisecondsIntoProgram / firstZone.duration);

            logger.debug("[!] Zone _%s_ is active", activeZone);

            return shiftOutput(activeZone);
        }

        return Q();
    };

var toProcess;

var processor = function () {
    execute()
        .then(function () {
           toProcess =  setTimeout(processor, config.processLoopInterval);
        });
}

initialize()
    .then(function () {
        processor();
    });

var cleaningUpFlag = false;

var onExit = function () {
    if(cleaningUpFlag === true) {
        return;
    }

    cleaningUpFlag = true;
    clearTimeout(toProcess);

    logger.info("Program is exiting, cleaning up.");

    shiftOutput(null)
        .then(function () {
            return closePins();
        })
        .then(function () {
            logger.info("All pins closed. Exiting");
            process.exit();
        });
}

process
    .on('exit', onExit)
    .on('SIGINT', onExit)
    .on('SIGTERM', onExit)
    .on('uncaughtException', onExit);
