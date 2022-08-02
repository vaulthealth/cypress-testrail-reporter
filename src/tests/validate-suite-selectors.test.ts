import { generateSuiteName } from "../lib/cypress-testrail-reporter";
import * as moment from 'moment';

const currentDate = moment().format('dddd, MMMM Do YYYY')

const monorepoValidSuiteName = `Automated regression test run for ${currentDate}`
const lsValidSuiteName = `LS - Automated regression test run for ${currentDate}`
const invalidSuiteName = `Unknown Suite: Automated regression test run for ${currentDate}`

const tests = [
    { suiteId: PLATFORM_SUITE.LIFE_SCIENCES, expectedSuiteName: lsValidSuiteName },
    { suiteId: '535', expectedSuiteName: lsValidSuiteName },
    { suiteId: "Invalid", expectedSuiteName: invalidSuiteName },
    { suiteId: PLATFORM_SUITE.MONOREPO, expectedSuiteName: monorepoValidSuiteName },
    { suiteId: '64', expectedSuiteName: monorepoValidSuiteName },
];

describe("Validate Suite Logic Assigns the proper SuiteName for both string & int IDs", () => {
    tests.forEach((config) => {
        let suite = config.suiteId;
        test(`Testing Suite IDs for: ${suite}`, () => {
            let suiteName = generateSuiteName(suite)
            expect(suiteName).toEqual(config.expectedSuiteName)
        });
    });
});