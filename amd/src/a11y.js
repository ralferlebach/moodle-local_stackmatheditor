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
 * Accessible names from the language pack for the editor's own controls.
 *
 * MathQuill 0.10.1 renders a hidden textarea without a label; screen readers then announce an
 * unnamed edit field. The row buttons of the multi-line editors are icons. Both get their name
 * from the language pack here, so the name follows the user's language.
 *
 * @module     local_stackmatheditor/a11y
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define(['core/str'], function(Str) {
    'use strict';

    /** @type {Object} Strings delivered with the page, keyed by string identifier. */
    var preloaded = {};

    /**
     * Use the strings delivered with the page.
     *
     * @param {?Object} strings Map key => text (definitions.strings).
     */
    function useStrings(strings) {
        Object.keys(strings || {}).forEach(function(key) {
            preloaded[key] = strings[key];
        });
    }

    /**
     * Set aria-label (and optionally title) of an element from a language string.
     *
     * @param {?HTMLElement} el Element.
     * @param {string} key String key in local_stackmatheditor.
     * @param {boolean} [withTitle] Also set the title (visible tooltip).
     */
    function label(el, key, withTitle) {
        if (!el) {
            return;
        }
        // Delivered with the page (definitions::export_for_js): named at once, no AJAX round trip.
        if (preloaded[key]) {
            el.setAttribute('aria-label', preloaded[key]);
            if (withTitle) {
                el.setAttribute('title', preloaded[key]);
            }
            return;
        }
        Str.get_string(key, 'local_stackmatheditor').then(function(text) {
            el.setAttribute('aria-label', text);
            if (withTitle) {
                el.setAttribute('title', text);
            }
            return text;
        }).catch(function() {
            // The control keeps working without a name; nothing else to do.
        });
    }

    /**
     * Name the hidden input of a MathQuill field.
     *
     * @param {Object} field MathQuill MathField API object.
     */
    function labelEditor(field) {
        label(field.el().querySelector('textarea'), 'aria_formula_input');
    }

    return /** @alias module:local_stackmatheditor/a11y */ {
        useStrings: useStrings,
        label: label,
        labelEditor: labelEditor
    };
});
