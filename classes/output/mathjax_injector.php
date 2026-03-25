<?php
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
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
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
