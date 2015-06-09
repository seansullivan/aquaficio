// 60 seconds per tick
// Get current time
// determine which zone should be on

var Q = require('q'),
    _ = require('lodash'),
    moment = require('moment'),

    gpio = require('./gpio'),

    config = require('./config'),

    manifest = require('./manifest.json'),

    logger = require('./logger');

var zones = manifest.zones,

    programs = manifest.programs,

    enabledPrograms = _.filter(programs, 'enabled', true),

    enabledProgram = _.first(enabledPrograms);

    currentState = {},

    programFactory = require('./program');

if(_.size(enabledPrograms) > 1) {
    logger.error("Multiple enabled programs not yet supported");
    process.exit(1);
}

logger.info("Using program: %s", enabledProgram.name);

var activeProgram = programFactory.create(zones, enabledProgram);

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

        return gpio.setupPins()
            .then(function () {
                return gpio.disableShiftRegisterOutput();
            })
            .then(function () {
                logger.debug('----------------------');
                return gpio.shiftOutput(zones, null);
            })
            .then(function () {
                logger.debug('----------------------');
                return gpio.enableShiftRegisterOutput();
            });
    },

    execute = function () {
        logger.debug("Sprinklers processing at %s", moment().toString());

        var now = moment(),

            zoneToBeActive = activeProgram.getZoneToBeActive(now),

            currentlyActiveZone = null;

        if(!zoneToBeActive) {
            // No zone is to be active now, check and see if our state machine
            // thinks that we still have an active zone.
            currentlyActiveZone = getActiveZone();

            if(!currentlyActiveZone) {
                logger.debug("No active zone.");
                return Q();
            }

            console.log('there is an active program and zone');

            // No zones are to be active
            return gpio.shiftOutput(zones, null);
        }

        logger.debug("[!] Zone _%s_ is to be active", zoneToBeActive);

        return gpio.shiftOutput(zones, zoneToBeActive);
    },

    toProcess,

    cleaningUpFlag = false,

    processor = function () {
        execute()
            .then(function () {
               toProcess = setTimeout(processor, config.processLoopInterval);
            });
    }

initialize()
    .then(function () {
        processor();
    });

var onExit = function () {
    if(cleaningUpFlag === true) {
        return;
    }

    cleaningUpFlag = true;
    clearTimeout(toProcess);

    logger.info("Program is exiting, cleaning up.");

    gpio.shiftOutput(zones, null)
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
    .on('uncaughtException', function (error) {
        logger.error(error);
        onExit();
    });
