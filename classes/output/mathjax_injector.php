<?php
namespace local_stackmatheditor\output;

defined('MOODLE_INTERNAL') || die();

use local_stackmatheditor\definitions;

/**
 * Injects MathJax v2 Hub shim and element definitions.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class mathjax_injector {

    /**
     * Inject shim JS and definitions JSON into page head.
     *
     * @param \core\hook\output\before_standard_top_of_body_html_generation $hook
     * @return void
     */
    public static function inject(
        \core\hook\output\before_standard_top_of_body_html_generation $hook
    ): void {
        // Static shim JS file.
        $shimurl = (new \moodle_url(
            '/local/stackmatheditor/js/mathjax_shim.js'
        ))->out(false);
        $shimtag = '<script type="text/javascript" src="'
            . $shimurl . '"></script>';

        // Definitions JSON for JS modules.
        $defsdata = definitions::export_for_js();
        $defsjson = json_encode(
            $defsdata,
            JSON_UNESCAPED_UNICODE | JSON_HEX_TAG
        );
        $defstag =
            '<script type="application/json" id="sme-definitions">'
            . $defsjson
            . '</script>';

        $hook->add_html($shimtag . "\n" . $defstag);
    }
}
