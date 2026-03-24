<?php
namespace local_stackmatheditor\output;

defined('MOODLE_INTERNAL') || die();

use local_stackmatheditor\config_manager;
use local_stackmatheditor\quiz_helper;

/**
 * Injects MathQuill editor runtime data.
 *
 * Computes a per-slot enabled map (slotEnabled) and passes it to the
 * JS runtime so input_fields.js / textarea_fields.js can skip disabled slots.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class editor_injector {

    /**
     * Inject MathQuill CSS, init call, and runtime JSON.
     *
     * @param int $cmid Course module ID.
     * @return void
     */
    public static function inject(int $cmid): void {
        global $PAGE;

        $plugindir = __DIR__ . '/../../thirdparty/mathquill/';
        $jsfile    = file_exists($plugindir . 'mathquill.min.js')
            ? 'mathquill.min.js'
            : 'mathquill.js';

        $mqjsurl  = (new \moodle_url(
            '/local/stackmatheditor/thirdparty/mathquill/' . $jsfile
        ))->out(false);
        $mqcssurl = (new \moodle_url(
            '/local/stackmatheditor/thirdparty/mathquill/mathquill.css'
        ))->out(false);

        // Resolve per-slot configs.
        $slotconfigs  = self::resolve_slot_configs($cmid);
        $slotvarmodes = self::build_variable_modes($slotconfigs);

        // Build per-slot enabled map.
        $slotenabled = self::build_slot_enabled($slotconfigs);

        $instancevarmode = config_manager::get_instance_variable_mode();

        // AMD init call.
        $PAGE->requires->js_call_amd(
            'local_stackmatheditor/mathquill_init',
            'init',
            [[
                'mathquillJsUrl'  => $mqjsurl,
                'mathquillCssUrl' => $mqcssurl,
                'cmid'            => $cmid,
                'variableMode'    => $instancevarmode,
            ]]
        );

        // Runtime JSON element.
        $runtimedata = json_encode([
            'slotConfigs'      => !empty($slotconfigs)  ? $slotconfigs  : new \stdClass(),
            'slotVarModes'     => !empty($slotvarmodes) ? $slotvarmodes : new \stdClass(),
            'slotEnabled'      => !empty($slotenabled)  ? $slotenabled  : new \stdClass(),
            'instanceDefaults' => config_manager::get_instance_defaults(),
        ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);

        $PAGE->requires->js_amd_inline("
            (function() {
                var el = document.createElement('script');
                el.type = 'application/json';
                el.id = 'sme-runtime';
                el.textContent = "
            . json_encode($runtimedata) . ";
                document.body.appendChild(el);
            })();
        ");
    }

    /**
     * Resolve slot configs depending on page type.
     *
     * @param int $cmid Course module ID.
     * @return array Slot => config.
     */
    private static function resolve_slot_configs(int $cmid): array {
        global $PAGE;

        if (in_array($PAGE->pagetype, ['mod-quiz-attempt', 'mod-quiz-review'])) {
            return self::resolve_attempt_configs($cmid);
        }
        if (in_array($PAGE->pagetype, ['question-preview', 'question-bank-previewquestion'])) {
            return self::resolve_preview_configs($cmid);
        }
        return [];
    }

    /**
     * Resolve configs from a quiz attempt.
     *
     * @param int $cmid Course module ID.
     * @return array Slot => config.
     */
    private static function resolve_attempt_configs(int $cmid): array {
        $attemptid = optional_param('attempt', 0, PARAM_INT);
        if (!$attemptid) {
            return [];
        }

        $stackdata = quiz_helper::load_attempt_stack_slots($attemptid);
        if (empty($stackdata['slotmap'])) {
            return [];
        }

        $slotconfigs = [];

        if (!empty($stackdata['qbeids'])) {
            $qbeids  = array_values(array_unique($stackdata['qbeids']));
            $configs = config_manager::get_configs($cmid, $qbeids, $stackdata['qbeidmap']);
            foreach ($stackdata['qbeids'] as $slot => $qbeid) {
                $slotconfigs[$slot] = $configs[$qbeid]
                    ?? config_manager::get_instance_defaults();
            }
        }

        // Fallback for slots without qbeid.
        foreach ($stackdata['slotmap'] as $slot => $qid) {
            if (!isset($slotconfigs[$slot])) {
                $slotconfigs[$slot] = config_manager::get_config($cmid, 0, $qid);
            }
        }

        return $slotconfigs;
    }

    /**
     * Resolve configs for question preview.
     *
     * @param int $cmid Course module ID.
     * @return array Slot => config.
     */
    private static function resolve_preview_configs(int $cmid): array {
        $questionid = optional_param('id', 0, PARAM_INT);
        if (!$questionid) {
            return [];
        }
        $qbeid = config_manager::resolve_qbeid($questionid);
        if (!$qbeid) {
            return [];
        }
        return [1 => config_manager::get_config($cmid, $qbeid)];
    }

    /**
     * Build variable modes from slot configs.
     *
     * @param array $slotconfigs Slot => config.
     * @return array Slot => mode string.
     */
    private static function build_variable_modes(array $slotconfigs): array {
        $modes   = [];
        $default = config_manager::get_instance_variable_mode();
        foreach ($slotconfigs as $slot => $config) {
            $modes[$slot] = $config['_variableMode'] ?? $default;
        }
        return $modes;
    }

    /**
     * Build per-slot enabled map.
     *
     * For each slot, determines whether MathQuill should be activated:
     *   - Instance mode 0: always false
     *   - Instance mode 1: always true
     *   - Instance mode 2: false unless _enabled=true in config
     *   - Instance mode 3: true unless _enabled=false in config
     *
     * The _enabled value in $slotconfigs already reflects the full
     * lookup chain (question-level → quiz-level → instance defaults).
     *
     * @param array $slotconfigs Slot => merged config array.
     * @return array Slot => bool (true = activate MathQuill).
     */
    private static function build_slot_enabled(array $slotconfigs): array {
        $instancemode = config_manager::get_instance_enabled_mode();
        $enabled      = [];

        foreach ($slotconfigs as $slot => $cfg) {
            if ($instancemode === 0) {
                $enabled[$slot] = false;
            } else if ($instancemode === 1) {
                $enabled[$slot] = true;
            } else {
                // Modes 2 and 3: honour _enabled flag if present.
                if (array_key_exists('_enabled', $cfg)) {
                    $enabled[$slot] = (bool) $cfg['_enabled'];
                } else {
                    // No explicit setting: mode 3 defaults to on, mode 2 to off.
                    $enabled[$slot] = ($instancemode === 3);
                }
            }
        }

        return $enabled;
    }
}
