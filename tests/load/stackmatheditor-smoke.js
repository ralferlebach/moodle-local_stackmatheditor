// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

/**
 * k6 smoke load test for local_stackmatheditor - the twin of stackmatheditor-smoke.jmx.
 *
 * A handful of virtual users request the login page and the plugin's shipped AMD module for a
 * short period. It proves that the load harness, the site and the asset path work together; it is
 * not yet a capacity measurement. Thresholds are a first baseline - tighten them after real runs.
 *
 * Environment: BASE_URL (required), VUS (default 5), DURATION (default 15s).
 * Run: k6 run -e BASE_URL=http://127.0.0.1:8000 tests/load/stackmatheditor-smoke.js
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import http from 'k6/http';
import {check, sleep} from 'k6';

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/+$/, '');

// Revision -1 makes requirejs.php serve exactly this one module from amd/build.
const AMD_MODULE = '/lib/requirejs.php/-1/local_stackmatheditor/tex2max.js';

export const options = {
    vus: Number(__ENV.VUS || 5),
    duration: __ENV.DURATION || '15s',
    thresholds: {
        // A failed check fails the run; without this k6 only reports it and exits 0.
        checks: ['rate>0.99'],
        http_req_failed: ['rate<0.01'],
        http_req_duration: ['p(95)<3000'],
    },
};

/**
 * Fail fast on a missing or unreachable target.
 *
 * Without this the plan generates load against a dead URL and reports "100% of requests failed",
 * which reads like a plugin defect instead of a broken environment.
 *
 * @returns {void}
 */
export function setup() {
    if (!BASE_URL) {
        throw new Error('BASE_URL must be set (-e BASE_URL=...).');
    }
    const probe = http.get(`${BASE_URL}/login/index.php`);
    if (probe.status !== 200) {
        throw new Error(`Target not reachable: ${BASE_URL} answered HTTP ${probe.status}.`);
    }
}

/**
 * One iteration: login page plus the plugin's AMD module.
 *
 * @returns {void}
 */
export default function() {
    const login = http.get(`${BASE_URL}/login/index.php`, {tags: {endpoint: 'login'}});
    check(login, {
        'login page returns 200': (r) => r.status === 200,
        'login page contains the login form': (r) => r.body.includes('login/index.php'),
    });

    const amd = http.get(`${BASE_URL}${AMD_MODULE}`, {tags: {endpoint: 'amd-tex2max'}});
    check(amd, {
        'tex2max module returns 200': (r) => r.status === 200,
        'tex2max module is the named AMD build': (r) => r.body.includes('local_stackmatheditor/tex2max'),
    });

    sleep(1);
}
