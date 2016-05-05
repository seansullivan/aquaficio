'use strict';

var chai = require('chai');

chai.config.includeStack = true;

var expect = chai.expect;
var assert = chai.assert;

var _ = require('lodash');

var ProgramFactory = require('../../program/');
var IntervalProgram = require('../../program/types/interval');

describe('Creating a program instance via the factory', function () {
    var defaultAvailableZones = [1, 2, 3, 4, 5];
    var emptyAvailableZones = [];

    var TYPE_INTERVAL = 'interval';

    var defaultProgramSettings = {
        type: TYPE_INTERVAL
    };

    it('should create', function () {
        var programInstance = ProgramFactory.create(defaultAvailableZones, defaultProgramSettings);

        expect(programInstance).to.be.an.instanceof(IntervalProgram);
    });

    it('should create even if no available zones', function () {
        var programInstance = ProgramFactory.create(emptyAvailableZones, defaultProgramSettings);

        expect(programInstance).to.be.an.instanceof(IntervalProgram);
    });

    it('should throw an error if type not provided with program settings', function () {
        var testProgramSettings = _.clone(defaultProgramSettings);
        delete testProgramSettings.type;

        var createWithNoType = function () {
            ProgramFactory.create(defaultAvailableZones, testProgramSettings);
        }

        expect(createWithNoType).to.throw(Error);
    });
});
