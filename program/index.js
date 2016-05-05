var Q = require('q'),
    _ = require('lodash'),
    moment = require('moment'),
    util = require('util'),

    logger = require('../logger'),

    Zone = require('./zone');

var TYPE_INTERVAL = 'interval',

    TYPE_ADHOC = 'adhoc',

    TYPE_SCHEDULED_ONCE = 'scheduled_once',

    TYPE_WEEKLY = 'weekly',

    Program = {
        totalDuration: 0,

        type: null,

        availableZones: [],

        enabledZones: [],

        startTimes: [],

        setAvailableZones: function (zones) {
            var self = this;

            _.forEach(zones, function (zone) {
                var tmpZone = new Zone();
                tmpZone.id = zone.id;
                tmpZone.name = zone.name;

                self.availableZones.push(tmpZone);
            });
        },

        findZoneById: function (id) {
            return _.find(this.enabledZones, 'id', id);
        },

        getDurationForZoneById: function (id) {
            var zone = this.findZoneById(id);

            return zone.duration;
        },

        /**
         * Start building a list of start times, need to know the start time for
         * each run so we can determine end time and know if we should currently
         * be running a program
         *
         * @param {[type]} startTimes [description]
         */
        setStartTimes: function (startTimes) {
            // filter out any null start times
            startTimes = _.filter(startTimes, null);

            logger.debug(util.format('Start times set to %j', startTimes));

            this.startTimes = startTimes;
        },

        /**
         * Returns the id of the zone that should currently be active.
         *
         * If return value is null, program also is not active.
         *
         * @param  {Object} A moment object representing the current time
         * @return {Int}    A zone id (or null)
         */
        getZoneToBeActive: function (now) {
            var self = this,

                useStartTime = false,

                numberOfMillisecondsIntoProgram = 0,

                activeZone = null;

            // Should any programs currently be running?
            _.forEach(this.startTimes, function (startTime) {
                // to get time, clone the startTime moment object and add on the duration
                var endTime = moment(startTime).add(self.totalDuration, 'ms');

                if(!now.isBetween(startTime, endTime, moment)) {
                    return;
                }

                useStartTime = startTime;
                return false;
            });

            if(!useStartTime) {
                return null;
            }

            numberOfMillisecondsIntoProgram = (now.unix() - useStartTime.unix()) * 1000;

            activeZone = Math.ceil(numberOfMillisecondsIntoProgram / _.first(this.enabledZones).duration);

            return activeZone;
        },

        getTotalDuration: function () {
            return this.totalDuration;
        },

        onRunComplete: function () {
            // intentionally left blank
        }
    };

module.exports = {
    create: function (availableZones, programSettings) {
        if (_.isEmpty(availableZones)) {
            logger.warn('No available zones provided for program.');
        }

        if (!_.has(programSettings, 'type')) {
            throw new Error("Invalid program type");
        };

        var defaultOptions = {
            type: TYPE_INTERVAL
        };

        var typeClass = require('./types/'+programSettings.type);
        typeClass.prototype = Program;

        var programInstance = new typeClass(programSettings);
        programInstance.setAvailableZones(availableZones);
        programInstance.enableZones();

        return programInstance;
    }
}