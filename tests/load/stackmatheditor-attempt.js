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
 * k6 load test: students working on a quiz with ten STACK questions on one page.
 *
 * Each virtual user logs in as its own seeded student (sme_student01 …), starts or continues an
 * attempt at "SME Load Quiz" and then repeatedly
 *   1. loads the attempt page - STACK renders ten questions, the plugin injects its editors;
 *   2. calls the plugin's web service local_stackmatheditor_get_config for the ten questions,
 *      exactly as the browser does.
 * Thresholds describe the service level for this page type; tighten them with real data.
 *
 * Environment: BASE_URL (required), LOAD_CMID (required), USER_PASS (required),
 *              VUS (default 10, at most the number of seeded students), DURATION (default 60s).
 * Run: k6 run -e BASE_URL=… -e LOAD_CMID=… -e USER_PASS=… tests/load/stackmatheditor-attempt.js
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import http from 'k6/http';
import {check, fail, group, sleep} from 'k6';
import {Trend} from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/+$/, '');
const CMID = __ENV.LOAD_CMID;
const PASS = __ENV.USER_PASS;

const attemptPage = new Trend('sme_attempt_page_duration', true);
const configCall = new Trend('sme_get_config_duration', true);

export const options = {
    vus: Number(__ENV.VUS || 10),
    duration: __ENV.DURATION || '60s',
    // One Moodle session per virtual user for the whole run (k6 resets cookies per iteration).
    noCookiesReset: true,
    thresholds: {
        'checks': ['rate>0.99'],
        'http_req_failed': ['rate<0.01'],
        // Local reference (10 VUs, PHP built-in server with 16 workers): attempt page p95 941 ms,
        // max 1.2 s; get_config p95 219 ms, max 688 ms. Provisional limits with CI headroom -
        // tighten after the first GitHub run (docs/ENTWICKLUNGSUMGEBUNG.md, section 7).
        'sme_attempt_page_duration': ['p(95)<3000', 'max<8000'],
        'sme_get_config_duration': ['p(95)<800', 'max<3000'],
    },
};

/**
 * Log in and open (or continue) the attempt; returns what the iterations need.
 *
 * @returns {Object} {attemptUrl, sesskey}
 */
function startSession() {
    const user = 'sme_student' + String(((__VU - 1) % 99) + 1).padStart(2, '0');
    const login = http.get(`${BASE_URL}/login/index.php`);
    const token = (login.body.match(/name="logintoken" value="([^"]+)"/) || [])[1] || '';
    const res = http.post(`${BASE_URL}/login/index.php`, {username: user, password: PASS, logintoken: token});
    if (!check(res, {'login succeeded': (r) => !/login\/index\.php/.test(r.url)})) {
        fail(`login failed for ${user}`);
    }
    const view = http.get(`${BASE_URL}/mod/quiz/view.php?id=${CMID}`);
    const sesskey = (view.body.match(/"sesskey":"([^"]+)"/) || [])[1];
    const start = http.post(`${BASE_URL}/mod/quiz/startattempt.php`, {cmid: CMID, sesskey: sesskey});
    if (!check(start, {'attempt page reached': (r) => /mod\/quiz\/attempt\.php/.test(r.url)})) {
        fail(`could not start an attempt for ${user}: ${start.url}`);
    }
    return {attemptUrl: start.url, sesskey: sesskey};
}

let session = null;

export function setup() {
    if (!BASE_URL || !CMID || !PASS) {
        throw new Error('BASE_URL, LOAD_CMID and USER_PASS must be set.');
    }
    const probe = http.get(`${BASE_URL}/login/index.php`);
    if (probe.status !== 200) {
        throw new Error(`Target not reachable: ${BASE_URL} answered HTTP ${probe.status}.`);
    }
}

export default function() {
    if (session === null) {
        session = startSession();
    }
    group('attempt page', () => {
        const page = http.get(session.attemptUrl, {tags: {endpoint: 'attempt'}});
        attemptPage.add(page.timings.duration);
        check(page, {
            'attempt page 200': (r) => r.status === 200,
            'ten STACK questions rendered': (r) => (r.body.match(/class="que stack/g) || []).length === 10,
            'plugin injected its configuration': (r) => r.body.indexOf('local_stackmatheditor') !== -1,
        });
    });
    group('get_config web service', () => {
        const body = JSON.stringify([{
            index: 0,
            methodname: 'local_stackmatheditor_get_config',
            args: {cmid: Number(CMID), questionids: []},
        }]);
        const res = http.post(
            `${BASE_URL}/lib/ajax/service.php?sesskey=${session.sesskey}&info=local_stackmatheditor_get_config`,
            body,
            {headers: {'Content-Type': 'application/json'}, tags: {endpoint: 'get_config'}}
        );
        configCall.add(res.timings.duration);
        check(res, {
            'get_config 200': (r) => r.status === 200,
            'get_config without error': (r) => {
                try {
                    return JSON.parse(r.body)[0].error === false;
                } catch (e) {
                    return false;
                }
            },
        });
    });
    sleep(1);
}
