// 60 seconds per tick
// Get current time
// determine which zone should be on

var Q = require('q'),
    _ = require('lodash'),
    moment = require('moment'),

    gpio = require('./gpio'),

    config = require('./config'),

    manifest = require('./manifest.json'),

    logger = require('./logger'),

    util = require('util');

var zones = manifest.zones,

    programs = manifest.programs,

    enabledPrograms = _.filter(programs, 'enabled', true),

    enabledProgram = _.first(enabledPrograms);

    currentState = {},

    programRunHistory = {
        started_at: null,
        zones: [],
        completed_at: null
    },

    programFactory = require('./program');

if(_.size(enabledPrograms) > 1) {
    logger.error("Multiple enabled programs not yet supported");
    process.exit(1);
}

logger.info("Using program: %s", enabledProgram.name);

var activeProgram = programFactory.create(zones, enabledProgram);

// get active zone from current state
function getActiveZone() {
    var activeZoneId = _.findKey(currentState, function (zone) {
        return zone !== null;
    });

    return activeZoneId || null;
}


function sendNotifications (message) {
    var notifications = _.get(config, 'notifications', []);

    if (_.isEmpty(notifications) || process.env.NODE_ENV === 'test') {
        return Q();
    }

    var notification = _.first(notifications);

    return sendSMS(notification, message);
}

function sendSMS (notification, message) {
    var AWS = require('aws-sdk');

    var SNS = new AWS.SNS({
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
        region: "us-east-1"
    });

    var publishParams = {
        TopicArn: notification.topicArn,
        Message: message
    };

    return Q.ninvoke(SNS, 'publish', publishParams)
        .fail(function (error) {
            logger.error(error);

            return Q.reject();
        });
}

/**
 * Update the "state machine" to identify which zone is active.
 *
 * By passing null as the zoneId, state will be set to no active zones
 */
function updateActiveZone(zoneId) {
    currentState = _.mapValues(currentState, function () {
        return null;
    });

    if (zoneId !== null) {
        currentState[zoneId] = true;
    }
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
                logger.debug('----------------------');
                return gpio.shiftOutput(zones, null);
            })
            .then(function () {
                logger.debug('----------------------');
                return gpio.enableShiftRegisterOutput();
            })
            .fail(function (error) {
                logger.error(error);
                logger.error(error.stack);

                return Q.reject(error);
            });
    },

    execute = function () {
        logger.debug("Sprinklers processing at %s", moment().toString());

        var now = moment(),

            zoneToBeActive = activeProgram.getZoneToBeActive(now),

            currentlyActiveZone = getActiveZone();

        if(!zoneToBeActive) {
            // No zone is to be active now, check and see if our state machine
            // thinks that we still have an active zone.
            currentlyActiveZone = getActiveZone();

            if(!currentlyActiveZone) {
                logger.debug("No active zone.");
                return Q();
            }

            // Ending program
            logger.debug("[!] Program %s has completed...", activeProgram.settings.id);

            programRunHistory.completed_at = moment().format();

            var message = util.format('Program %s has completed at %s, watering zones %j', programRunHistory.id, programRunHistory.completed_at, programRunHistory.zones);

            logger.info('[!] %s', message);

            // No zones are to be active
            return gpio.shiftOutput(zones, null)
                .then(function () {
                    updateActiveZone(null);

                    return sendNotifications(message);
                })
                .then(function () {
                    activeProgram.onRunComplete();

                    return Q(true);
                });
        }

        var sendStartNotifications = Q();

        if(currentlyActiveZone === null) {
            programRunHistory.id = activeProgram.settings.id;
            programRunHistory.started_at = moment().format();

            var message = util.format('Program %s has started at %s', programRunHistory.id, programRunHistory.started_at);
            logger.info('[!] %s', message);

            sendStartNotifications = sendNotifications(message);
        }

        logger.debug("[!] Zone _%s_ is to be active", zoneToBeActive);

        updateActiveZone(zoneToBeActive);

        if (!_.includes(programRunHistory.zones, zoneToBeActive)) {
            programRunHistory.zones.push(zoneToBeActive);
        }

        return sendStartNotifications
            .then(function () {
                return gpio.shiftOutput(zones, zoneToBeActive);
            });
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
            return gpio.closePins();
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
