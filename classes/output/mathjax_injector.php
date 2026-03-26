<?php
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

namespace local_stackmatheditor\output;

defined('MOODLE_INTERNAL') || die();

use local_stackmatheditor\definitions;

/**
 * Injects element definitions JSON into the page.
 *
 * Creates the #sme-definitions JSON script element consumed by
 * the mathquill_init AMD module.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class mathjax_injector {
    /**
     * Inject toolbar element definitions as a JSON script element (#sme-definitions).
     *
     * @return void
     */
    public static function inject(): void {
        page_helper::inject_json_element(
            'sme-definitions',
            definitions::export_for_js()
        );
    }
}
