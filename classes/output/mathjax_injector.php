<?php
namespace local_stackmatheditor\output;

defined('MOODLE_INTERNAL') || die();

use local_stackmatheditor\definitions;

/**
 * Injects element definitions JSON into the page.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class mathjax_injector {

    /**
     * Inject definitions JSON into page via AMD inline.
     * Creates the #sme-definitions script element.
     *
     * @return void
     */
    public static function inject(): void {
        global $PAGE;

        $defsdata = definitions::export_for_js();
        $defsjson = json_encode(
            $defsdata,
            JSON_UNESCAPED_UNICODE | JSON_HEX_TAG
        );

        $PAGE->requires->js_amd_inline("
            (function() {
                var el = document.createElement('script');
                el.type = 'application/json';
                el.id = 'sme-definitions';
                el.textContent = "
            . json_encode($defsjson) . ";
                document.body.appendChild(el);
            })();
        ");
    }
}
