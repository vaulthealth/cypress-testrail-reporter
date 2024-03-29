"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSuiteName = exports.CypressTestRailReporter = void 0;
var mocha_1 = require("mocha");
var testrail_1 = require("./testrail");
var shared_1 = require("./shared");
var testrail_interface_1 = require("./testrail.interface");
var testrail_validation_1 = require("./testrail.validation");
var TestRailCache = require('./testrail.cache');
var TestRailLogger = require('./testrail.logger');
var moment = require("moment");
var runCounter = 1;
var CypressTestRailReporter = /** @class */ (function (_super) {
    __extends(CypressTestRailReporter, _super);
    function CypressTestRailReporter(runner, options) {
        var _this = _super.call(this, runner) || this;
        _this.results = [];
        _this.suiteId = [];
        _this.runId = 0;
        _this.serverTestCaseIds = [];
        _this.reporterOptions = options.reporterOptions;
        if (process.env.CYPRESS_TESTRAIL_REPORTER_USERNAME) {
            _this.reporterOptions.username = process.env.CYPRESS_TESTRAIL_REPORTER_USERNAME;
        }
        if (process.env.CYPRESS_TESTRAIL_REPORTER_PASSWORD) {
            _this.reporterOptions.password = process.env.CYPRESS_TESTRAIL_REPORTER_PASSWORD;
        }
        if (process.env.CYPRESS_TESTRAIL_REPORTER_RUNNAME) {
            _this.reporterOptions.runName = process.env.CYPRESS_TESTRAIL_REPORTER_RUNNAME;
        }
        if (process.env.CYPRESS_TESTRAIL_REPORTER_GROUPID) {
            _this.reporterOptions.runName = process.env.CYPRESS_TESTRAIL_REPORTER_GROUPID;
        }
        if (process.env.CYPRESS_TESTRAIL_RUN_ID) {
            TestRailCache.store('runId', process.env.CYPRESS_TESTRAIL_RUN_ID);
        }
        _this.testRailApi = new testrail_1.TestRail(_this.reporterOptions);
        _this.testRailValidation = new testrail_validation_1.TestRailValidation(_this.reporterOptions);
        /**
         * This will validate reporter options defined in cypress.json file
         * if we are passing suiteId as a part of this file than we assign value to variable
         * usually this is the case for single suite projects
         */
        _this.testRailValidation.validateReporterOptions(_this.reporterOptions);
        if (_this.reporterOptions.suiteId) {
            _this.suiteId = _this.reporterOptions.suiteId;
        }
        /**
         * This will validate runtime environment variables
         * if we are passing suiteId as a part of runtime env variables we assign that value to variable
         * usually we use this way for multi suite projects
         */
        var cliArguments = _this.testRailValidation.validateCLIArguments();
        if (cliArguments && cliArguments.length) {
            _this.suiteId = cliArguments;
        }
        /**
         * If no suiteId has been passed with previous two methods
         * runner will not be triggered
         */
        if (_this.suiteId && _this.suiteId.toString().length) {
            runner.on('start', function () {
                /**
                * runCounter is used to count how many spec files we have during one run
                * in order to wait for close test run function
                */
                TestRailCache.store('runCounter', runCounter);
                /**
                * creates a new TestRail Run
                * unless a cached value already exists for an existing TestRail Run in
                * which case that will be used and no new one created.
                */
                _this.testRailApi.getRuns().then(function (res) {
                    var name = generateSuiteName(_this.suiteId, _this.reporterOptions.runName);
                    if (_this.testRailApi.runIds.some(function (run) { return run["name"] == name; }) == false) {
                        TestRailLogger.warn('Starting with following options: ');
                        console.debug(_this.reporterOptions);
                        if (_this.reporterOptions.suiteId) {
                            TestRailLogger.log("Following suiteId has been set in cypress.json file: ".concat(_this.suiteId));
                        }
                        if (_this.reporterOptions.disableDescription) {
                            var description = '';
                        }
                        else {
                            if (process.env.CYPRESS_CI_JOB_URL) {
                                var description = process.env.CYPRESS_CI_JOB_URL;
                            }
                            else {
                                var description = 'For the Cypress run visit https://dashboard.cypress.io/#/projects/runs';
                            }
                        }
                        TestRailLogger.log("Creating TestRail Run with name: ".concat(name));
                        _this.testRailApi.createRun(name, description, _this.suiteId);
                    }
                    else {
                        /*
                        look for the run id of run with name that already exists
                        */
                        for (var _i = 0, _a = _this.testRailApi.runIds; _i < _a.length; _i++) {
                            var runObj = _a[_i];
                            if (runObj["name"] == name) {
                                _this.runId = runObj["id"];
                                break;
                            }
                        }
                        TestRailLogger.log("Using existing TestRail Run with ID: '".concat(_this.runId, "'"));
                    }
                });
            });
            runner.on('pass', function (test) {
                _this.submitResults(testrail_interface_1.Status.Passed, test, "Execution time: ".concat(test.duration, "ms"));
            });
            runner.on('fail', function (test, err) {
                _this.submitResults(testrail_interface_1.Status.Failed, test, "".concat(err.message));
            });
            runner.on('retry', function (test) {
                _this.submitResults(testrail_interface_1.Status.Retest, test, 'Cypress retry logic has been triggered!');
            });
        }
        return _this;
    }
    /**
     * Ensure that after each test results are reported continuously
     * Additionally to that if test status is failed or retried there is possibility
     * to upload failed screenshot for easier debugging in TestRail
     * Note: Uploading of screenshot is configurable option
     */
    CypressTestRailReporter.prototype.submitResults = function (status, test, comment) {
        var _this = this;
        if (this.runId === 0) {
            this.runId = TestRailCache.retrieve('runId');
        }
        var caseIds = (0, shared_1.titleToCaseIds)(test.title);
        if (caseIds.length) {
            caseIds.map(function (caseId) {
                _this.testRailApi.publishResult({
                    run_id: _this.runId,
                    case_id: caseId,
                    status_id: status,
                    comment: "Execution time: ".concat(test.duration, "ms, case_id: ").concat(caseId),
                })
                    .then(function (response) {
                    if (_this.reporterOptions.allowFailedScreenshotUpload === true && (status === testrail_interface_1.Status.Failed || status === testrail_interface_1.Status.Retest)) {
                        _this.testRailApi.uploadScreenshots(caseId, response[0].id);
                    }
                });
            });
        }
    };
    return CypressTestRailReporter;
}(mocha_1.reporters.Spec));
exports.CypressTestRailReporter = CypressTestRailReporter;
/**
 * Decide which suite name should be assigned
 * @param suiteId current Suite running
 * @param runName
 * @returns
 */
function generateSuiteName(suiteId, runName) {
    var baseSuiteName = 'Automated regression test run for';
    var executionDateTime = moment().format('dddd, MMMM Do YYYY');
    var name = "";
    if (suiteId == 64 /* PLATFORM_SUITE.MONOREPO */) {
        name = "".concat(runName || "".concat(baseSuiteName), " ").concat(executionDateTime);
    }
    else if (suiteId == 535 /* PLATFORM_SUITE.LIFE_SCIENCES */) {
        name = "".concat(runName || "LS - ".concat(baseSuiteName), " ").concat(executionDateTime);
    }
    else {
        name = "".concat(runName || "Unknown Suite: ".concat(baseSuiteName), " ").concat(executionDateTime);
    }
    return name;
}
exports.generateSuiteName = generateSuiteName;
//# sourceMappingURL=cypress-testrail-reporter.js.map