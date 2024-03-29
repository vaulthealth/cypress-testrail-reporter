"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRail = void 0;
var axios = require('axios');
var fs = require('fs');
var path = require('path');
var FormData = require('form-data');
var TestRailLogger = require('./testrail.logger');
var TestRailCache = require('./testrail.cache');
var TestRail = /** @class */ (function () {
    function TestRail(options) {
        this.options = options;
        this.runId = 0;
        this.includeAll = true;
        this.caseIds = [];
        this.runIds = [];
        this.base = "".concat(options.host, "/index.php?/api/v2");
        this.runId;
    }
    TestRail.prototype.getCases = function (suiteId, nextURL, cases, resolve, reject) {
        var _this = this;
        var url = "".concat(this.base, "/get_cases/").concat(this.options.projectId, "&suite_id=").concat(suiteId);
        if (nextURL) {
            url += nextURL;
        }
        if (this.options.groupId) {
            url += "&section_id=".concat(this.options.groupId);
        }
        if (this.options.filter) {
            url += "&filter=".concat(this.options.filter);
        }
        if (this.options.typeId) {
            url += "&type_id=".concat(this.options.typeId);
        }
        return axios({
            method: 'get',
            url: url,
            headers: {
                'Content-Type': 'application/json',
                'x-api-ident': 'beta'
            },
            auth: {
                username: this.options.username,
                password: this.options.password
            }
        })
            .then(function (response) {
            var retrievedCases = cases.concat(response.data.cases.map(function (item) { return item.id; }));
            if (response.data._links.next !== null) {
                _this.getCases(suiteId, response.data._links.next, retrievedCases, resolve, reject);
            }
            else {
                resolve(retrievedCases);
            }
        })
            .catch(function (error) {
            console.error(error);
            reject([]);
        });
    };
    TestRail.prototype.getRuns = function () {
        var _this = this;
        console.log("Getting runs...");
        return axios({
            method: 'get',
            url: "".concat(this.base, "/get_runs/").concat(this.options.projectId),
            headers: {
                'Content-Type': 'application/json',
                'x-api-ident': 'beta'
            },
            auth: {
                username: this.options.username,
                password: this.options.password
            }
        })
            .then(function (response) {
            _this.runIds = response.data.runs;
            return _this.runIds;
        })
            .catch(function (error) { return console.error("ERROR", error); });
    };
    TestRail.prototype.createRun = function (name, description, suiteId) {
        var _this = this;
        if (this.options.includeAllInTestRun === false) {
            this.includeAll = false;
            new Promise(function (resolve, reject) {
                _this.getCases(suiteId, null, [], resolve, reject);
            }).then(function (response) {
                console.log('Creating run with following cases:');
                console.debug(response);
                _this.caseIds = response;
                _this.addRun(name, description, suiteId);
            });
        }
        else {
            this.addRun(name, description, suiteId);
        }
    };
    TestRail.prototype.addRun = function (name, description, suiteId) {
        var _this = this;
        console.log("Adding Run...");
        return axios({
            method: 'post',
            url: "".concat(this.base, "/add_run/").concat(this.options.projectId),
            headers: { 'Content-Type': 'application/json' },
            auth: {
                username: this.options.username,
                password: this.options.password,
            },
            data: JSON.stringify({
                suite_id: suiteId,
                name: name,
                description: description,
                include_all: this.includeAll,
                case_ids: this.caseIds
            }),
        })
            .then(function (response) {
            _this.runId = response.data.id;
            // cache the TestRail Run ID
            TestRailCache.store('runId', _this.runId);
        })
            .catch(function (error) { console.error(error); });
    };
    TestRail.prototype.deleteRun = function () {
        this.runId = TestRailCache.retrieve('runId');
        axios({
            method: 'post',
            url: "".concat(this.base, "/delete_run/").concat(this.runId),
            headers: { 'Content-Type': 'application/json' },
            auth: {
                username: this.options.username,
                password: this.options.password,
            },
        }).catch(function (error) { return console.error(error); });
    };
    TestRail.prototype.publishResults = function (results) {
        this.runId = TestRailCache.retrieve('runId');
        return axios({
            method: 'post',
            url: "".concat(this.base, "/add_results_for_cases/").concat(this.runId),
            headers: { 'Content-Type': 'application/json' },
            auth: {
                username: this.options.username,
                password: this.options.password,
            },
            data: JSON.stringify({ results: results }),
        })
            .then(function (response) { return response.data; })
            .catch(function (error) {
            console.error(error);
        });
    };
    TestRail.prototype.publishResult = function (results) {
        return axios.post("".concat(this.base, "/add_results_for_cases/").concat(results.run_id), {
            results: [{ case_id: results.case_id, status_id: results.status_id, comment: results.comment }],
        }, {
            auth: {
                username: this.options.username,
                password: this.options.password,
            },
        }).then(function (response) {
            console.log("Publishing following results:");
            console.debug(response.data);
            return response.data;
        })
            .catch(function (error) {
            console.error(error);
        });
    };
    TestRail.prototype.uploadAttachment = function (resultId, path) {
        var form = new FormData();
        form.append('attachment', fs.createReadStream(path));
        axios({
            method: 'post',
            url: "".concat(this.base, "/add_attachment_to_result/").concat(resultId),
            headers: __assign({}, form.getHeaders()),
            auth: {
                username: this.options.username,
                password: this.options.password,
            },
            data: form,
        }).then(function (response) {
            console.log("Uploading screenshot...");
            console.debug(response.data);
        })
            .catch(function (error) {
            console.error(error);
        });
    };
    // This function will attach failed screenshot on each test result(comment) if founds it
    TestRail.prototype.uploadScreenshots = function (caseId, resultId) {
        var _this = this;
        var SCREENSHOTS_FOLDER_PATH = path.join(__dirname, '../../../screenshots');
        fs.readdir(SCREENSHOTS_FOLDER_PATH, function (err, folders) {
            console.log("Found screenshots for following sections:");
            console.debug(folders);
            if (err) {
                return console.log('Unable to scan screenshots folder: ' + err);
            }
            folders.forEach(function (folder) {
                fs.readdir(SCREENSHOTS_FOLDER_PATH + "/".concat(folder), function (err, spec) {
                    if (err) {
                        return console.log('Unable to scan screenshots folder: ' + err);
                    }
                    spec.forEach(function (spec) {
                        fs.readdir(SCREENSHOTS_FOLDER_PATH + "/".concat(folder, "/").concat(spec), function (err, file) {
                            if (err) {
                                return console.log('Unable to scan screenshots folder: ' + err);
                            }
                            console.log("Found following screenshots");
                            console.debug(file);
                            file.forEach(function (file) {
                                if (file.includes("C".concat(caseId)) && /(failed|attempt)/g.test(file)) {
                                    try {
                                        _this.uploadAttachment(resultId, SCREENSHOTS_FOLDER_PATH + '/' + folder + '/' + spec + '/' + file);
                                    }
                                    catch (err) {
                                        console.log('Screenshot upload error: ', err);
                                    }
                                }
                            });
                        });
                    });
                });
            });
        });
    };
    ;
    TestRail.prototype.closeRun = function () {
        this.runId = TestRailCache.retrieve('runId');
        axios({
            method: 'post',
            url: "".concat(this.base, "/close_run/").concat(this.runId),
            headers: { 'Content-Type': 'application/json' },
            auth: {
                username: this.options.username,
                password: this.options.password,
            },
        })
            .then(function () {
            TestRailLogger.log('Test run closed successfully');
        })
            .catch(function (error) { return console.error(error); });
    };
    return TestRail;
}());
exports.TestRail = TestRail;
//# sourceMappingURL=testrail.js.map