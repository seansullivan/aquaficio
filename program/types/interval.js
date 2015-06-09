var _ = require('lodash');

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

        this._setStartTimes(settings.run_at);
    }
};

module.exports = IntervalProgram;