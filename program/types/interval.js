var _ = require('lodash'),

    moment = require('moment');

var IntervalProgram = function (settings) {
    this.settings = settings;

    this.enableZones = function () {
        var totalDuration = 0;

        if(_.size(settings.zones) === 1 && _.first(settings.zones).zone === "all") {
            this.enabledZones = _.map(this.availableZones, function (availableZone) {
                var tmpDuration = _.first(settings.zones).duration;

                totalDuration += parseInt(tmpDuration, 10);

                availableZone.duration = tmpDuration;

                return availableZone;
            });

            this.totalDuration = totalDuration;
        }

        // base has a setStartTimes method that cleanses and sets
        this.setStartTimes(this.getStartTimes());
    }

    this.getStartTimes = function () {
        var startTimes = settings.run_at,

            self = this;

        return _.map(startTimes, function (startTime) {
            if(_.has(startTime, 'event')) {
                // convert event criteria to timestamp
                logger.warn("Event parsing not yet implemented");
                return null;
            }

            if(!_.has(startTime, 'time')) {
                throw new Error("Unable to parse start time for program");
            }

            var hour = _.get(startTime.time, 'hour', null),
                minute = _.get(startTime.time, 'minute', 0);

            if(hour === null) {
                logger.warn("Program does not have an hour");
                return null;
            }

            // Build the start time moment object
            var whenToRun = moment().startOf('day').hour(hour).minute(minute);

            /**
             * Determine whether the run has completed today, if so, schedule
             * tomorrow's run.
             *
             * @type {Boolean}
             */
            var runHasCompleted = moment(whenToRun).add(self.totalDuration, 'ms').isBefore(moment());

            if (runHasCompleted) {
                whenToRun = moment().startOf('day').add(1, 'd').hour(hour).minute(minute);
            }

            return whenToRun;
        });
    }

    /**
     * The run has completed, schedule the next run.
     */
    this.onRunComplete = function () {
        this.setStartTimes(this.getStartTimes());
    }
};

module.exports = IntervalProgram;
