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
 * Minimal AMD loader for Jest.
 *
 * The modules in amd/src are plain `define([deps], factory)` modules. This loader evaluates the
 * SOURCE file (not the build) with a stub `define`, hands the factory the dependencies passed in
 * and returns what the factory returns. Unknown dependencies fail loudly: a module that silently
 * received `undefined` would test something other than what ships.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const fs = require('fs');
const path = require('path');

const AMD_SRC = path.resolve(__dirname, '..', '..', 'amd', 'src');

/**
 * Load one AMD module from amd/src.
 *
 * @param {string} name Module file name without extension, e.g. 'tex2max'.
 * @param {Object} [deps] Map of dependency id to the value handed to the factory.
 * @returns {*} The module's export.
 */
function loadAmd(name, deps = {}) {
    const file = path.join(AMD_SRC, name + '.js');
    const source = fs.readFileSync(file, 'utf8');
    let exported;
    let defined = false;
    const define = (ids, factory) => {
        if (typeof ids === 'function') {
            factory = ids;
            ids = [];
        }
        const args = ids.map((id) => {
            if (!Object.prototype.hasOwnProperty.call(deps, id)) {
                throw new Error(`AMD module '${name}' needs '${id}' - pass it to loadAmd().`);
            }
            return deps[id];
        });
        exported = factory(...args);
        defined = true;
    };
    // eslint-disable-next-line no-new-func
    new Function('define', source)(define);
    if (!defined) {
        throw new Error(`${file} did not call define().`);
    }
    return exported;
}

/**
 * Load the server-side definitions the converters receive in production.
 *
 * tests/jest/fixtures/definitions.json is an export of definitions::export_for_js() (the keys the
 * converters read). tests/unit/jest_fixture_test.php fails as soon as the fixture and the PHP
 * definitions drift apart, so the Jest tests never run against outdated definitions.
 *
 * @param {Object} [overrides] Keys to add or replace, e.g. {usePercentPi: true}.
 * @returns {Object} Definitions object.
 */
function loadDefinitions(overrides = {}) {
    const file = path.join(__dirname, 'fixtures', 'definitions.json');
    return Object.assign(JSON.parse(fs.readFileSync(file, 'utf8')), overrides);
}

/** All implicit-multiplication / variable modes the converters support. */
const VARIABLE_MODES = ['explicit_single', 'explicit_multi', 'space_single', 'space_multi', 'stack'];

module.exports = {loadAmd, loadDefinitions, VARIABLE_MODES};
