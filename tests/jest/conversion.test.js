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
 * Smoke tests for the tex2max / max2tex conversion modules.
 *
 * Deliberately small: they prove that the harness loads the real amd/src modules and that the
 * conversion core works. The issue-driven roundtrip suites (#30, #34, #35, #39, #42) build on this.
 *
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const {loadAmd} = require('./amd_loader');

const tex2max = loadAmd('tex2max');
const max2tex = loadAmd('max2tex');

describe('tex2max', () => {
    test('a fraction becomes a bracketed Maxima quotient', () => {
        expect(tex2max.convert('\\frac{1}{2}')).toBe('(1)/(2)');
    });

    test('pi honours the usePercentPi definition', () => {
        expect(tex2max.convert('\\pi')).toBe('pi');
        expect(tex2max.convert('\\pi', {defs: {usePercentPi: true}})).toBe('%pi');
    });
});

describe('max2tex', () => {
    test('a Maxima quotient becomes a LaTeX fraction', () => {
        expect(max2tex.convert('(1)/(2)')).toBe('\\frac{1}{2}');
    });

    test('a fraction survives the roundtrip LaTeX -> Maxima -> LaTeX', () => {
        expect(max2tex.convert(tex2max.convert('\\frac{1}{2}'))).toBe('\\frac{1}{2}');
    });
});
