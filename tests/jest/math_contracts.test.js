/**
 * @jest-environment jsdom
 */
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
 * Issue #96: the math contracts, first half - LaTeX to the Maxima string STACK receives.
 *
 * tests/fixtures/math_contracts.json is the single source of truth for what the toolbar promises.
 * This suite proves, for every contract, that the real tex2max (variable mode 'stack', the
 * definitions the converters get in production) turns the LaTeX into exactly the Maxima string the
 * contract names - and that the bundled MathQuill does not change the meaning on the way, because
 * production converts what MathQuill hands back, not what was written into it.
 * tests/unit/cas_contract_test.php proves the second half: that STACK's parser and a real Maxima
 * accept that string.
 *
 * The gates make the fixture complete: every visible button and every toolbar group has a
 * contract, unless it is a named exception.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const fs = require('fs');
const path = require('path');
const {loadAmd, loadDefinitions} = require('./amd_loader');

const contracts = require('../fixtures/math_contracts.json');
const buttons = require('./fixtures/buttons.json');
const tex2max = loadAmd('tex2max');

/**
 * What definitions::export_for_js() delivers on a site with default settings, beyond the keys in
 * fixtures/definitions.json. Keep in sync with SITE_DEFAULTS in tests/unit/cas_contract_test.php,
 * which fails when the PHP defaults move.
 */
const SITE_DEFAULTS = {
    vectorFormat: 'matrix',
    normFunction: 'norm',
    coordinateSeparator: '|'
};

/**
 * Visible buttons without a contract of their own, as "group|template" -> reason.
 *
 * Empty on purpose: every button has a contract, the brackets and the Greek capitals that look
 * like Latin letters included. Keep in sync with NO_OWN_CONTRACT in tests/unit/cas_contract_test.php.
 */
const NO_OWN_CONTRACT = {};

/**
 * Definitions for one contract: production defaults plus the contract's own site settings.
 *
 * @param {Object} contract Contract.
 * @returns {Object} Definitions.
 */
function defsFor(contract) {
    return loadDefinitions(Object.assign({}, SITE_DEFAULTS, contract.settings || {}));
}

/**
 * Convert as the editor does when it writes into the STACK input.
 *
 * @param {Object} contract Contract.
 * @param {string} latex LaTeX to convert.
 * @returns {Object} tex2max.analyse() result.
 */
function convert(contract, latex) {
    return tex2max.analyse(latex, {defs: defsFor(contract), variableMode: 'stack'});
}

/**
 * Whitespace does not change what STACK reads; "2* 3" and "2*3" are the same answer.
 *
 * @param {string} maxima Maxima string.
 * @returns {string} The string without whitespace.
 */
function compact(maxima) {
    return maxima.replace(/\s+/g, '');
}

describe('the contract fixture (#96)', () => {
    test('ids are unique kebab-case and every contract is complete', () => {
        const ids = new Set();
        contracts.forEach((contract) => {
            expect(contract.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
            expect(ids.has(contract.id)).toBe(false);
            ids.add(contract.id);
            expect(typeof contract.group).toBe('string');
            expect(contract.latex.trim()).not.toBe('');
            expect(contract.maxima.trim()).not.toBe('');
            expect(Array.isArray(contract.packages)).toBe(true);
            expect(['accept', 'known-defect']).toContain(contract.cas);
            expect(typeof contract.browserSmoke).toBe('boolean');
        });
    });

    test('exactly one contract is kept as the browser smoke test', () => {
        const smoke = contracts.filter((contract) => contract.browserSmoke);
        expect(smoke.map((contract) => contract.id)).toEqual(['matrix']);
        expect(smoke[0].cas).toBe('accept');
    });

    test('every visible button has a contract', () => {
        const covered = new Set(
            contracts.filter((contract) => contract.button !== undefined)
                .map((contract) => contract.group + '|' + contract.button)
        );
        const missing = buttons
            .map((button) => button.group + '|' + button.template)
            .filter((key) => !covered.has(key) && !(key in NO_OWN_CONTRACT));

        expect(missing).toEqual([]);
    });

    test('no toolbar group exists without a contract', () => {
        const groups = new Set(contracts.map((contract) => contract.group));
        const missing = [...new Set(buttons.map((button) => button.group))]
            .filter((group) => !groups.has(group));

        expect(missing).toEqual([]);
    });

    test('a contract never names a button its group does not have', () => {
        const known = new Set(buttons.map((button) => button.group + '|' + button.template));
        const shipped = new Set(buttons.map((button) => button.group));

        contracts
            // Groups that only appear with a site setting (the vector differential operators)
            // are not in the default catalogue; tests/unit/cas_contract_test.php checks them
            // against the catalogue with those settings.
            .filter((contract) => contract.button !== undefined && shipped.has(contract.group))
            .forEach((contract) => {
                expect(known.has(contract.group + '|' + contract.button)).toBe(true);
            });
    });
});

describe('tex2max fulfils every contract (#96)', () => {
    test.each(contracts.map((contract) => [contract.id, contract]))(
        '%s',
        (_id, contract) => {
            const result = convert(contract, contract.latex);

            expect(result.problems).toEqual([]);
            expect(result.maxima).not.toBe('');
            expect(result.maxima).toBe(contract.maxima);
            // #39: no LaTeX control sequence may reach the CAS.
            expect(result.maxima).not.toMatch(/\\/);
        }
    );
});

describe('MathQuill keeps the meaning of every contract (#96)', () => {
    let MQ;

    beforeAll(() => {
        // The bundled build, evaluated in jsdom. Interface 3 parses and serialises exactly like
        // interface 2, which production uses; it only does without jQuery.
        const file = path.resolve(__dirname, '..', '..', 'thirdparty', 'mathquill', 'mathquill.js');
        // eslint-disable-next-line no-new-func
        new Function('window', 'document', fs.readFileSync(file, 'utf8')).call(window, window, document);
        MQ = window.MathQuill.getInterface(3);
    });

    /**
     * Write LaTeX into a field configured as input_fields.js configures it, and read it back.
     *
     * @param {string} latex LaTeX.
     * @returns {string} What the field hands to the converter.
     */
    function throughField(latex) {
        const span = document.createElement('span');
        document.body.appendChild(span);
        const field = MQ.MathField(span, {
            spaceBehavesLikeTab: false,
            disableAutoSubstitutionInSubscripts: true,
            autoOperatorNamesOnlyWholeWord: true
        });
        field.latex(latex);
        const result = field.latex();
        span.remove();
        return result;
    }

    test.each(contracts.map((contract) => [contract.id, contract]))(
        '%s',
        (_id, contract) => {
            const result = convert(contract, throughField(contract.latex));

            if (contract.mathquillDefect) {
                // Pinned, not hidden: once MathQuill or the converter is fixed, this fails and
                // the flag has to go.
                expect(compact(result.maxima)).not.toBe(compact(contract.maxima));
                return;
            }
            expect(result.problems).toEqual([]);
            expect(compact(result.maxima)).toBe(compact(contract.maxima));
        }
    );
});
