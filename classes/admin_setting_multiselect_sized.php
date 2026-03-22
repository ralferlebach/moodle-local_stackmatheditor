<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Multiselect admin setting that auto-sizes to the number of choices.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class admin_setting_multiselect_sized extends \admin_setting_configmultiselect {

    /**
     * Render HTML output with size matching the number of choices.
     *
     * @param mixed $data Current setting data.
     * @param string $query Search query for highlighting.
     * @return string HTML output.
     */
    public function output_html($data, $query = '') {
        $html = parent::output_html($data, $query);
        $size = count($this->choices);
        if ($size > 0) {
            $html = str_replace('size="10"', 'size="' . $size . '"', $html);
        }
        return $html;
    }
}
