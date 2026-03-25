<?php
namespace local_stackmatheditor\output;

defined('MOODLE_INTERNAL') || die();

/**
 * Shared page-output utilities for local_stackmatheditor.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class page_helper {

    /**
     * Inject a JSON data payload into the page as a <script type="application/json"> element.
     *
     * The element is appended to <body> via an AMD inline script so it is
     * available to AMD modules that run after page load. Using a JSON script
     * element rather than passing data as js_call_amd() arguments avoids the
     * 1 024-character limit imposed by that API.
     *
     * The element can be read in JavaScript with:
     *   var data = JSON.parse(document.getElementById(id).textContent);
     *
     * @param string $id   The id attribute for the <script> element (e.g. 'sme-runtime').
     * @param mixed  $data Data to JSON-encode and embed. Must be json_encode()-able.
     * @return void
     */
    public static function inject_json_element(string $id, mixed $data): void {
        global $PAGE;

        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_THROW_ON_ERROR);

        $PAGE->requires->js_amd_inline(
            "(function() {"
            . " var el = document.createElement('script');"
            . " el.type = 'application/json';"
            . " el.id = " . json_encode($id) . ";"
            . " el.textContent = " . json_encode($json) . ";"
            . " document.body.appendChild(el);"
            . "})();"
        );
    }
}
