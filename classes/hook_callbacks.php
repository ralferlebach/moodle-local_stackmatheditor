<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Hook callbacks for local_stackmatheditor.
 *
 * Injects:
 * 1. MathJax v2 shim (synchronous inline script at top of body)
 * 2. Definitions JSON (application/json script tag, read by JS from DOM)
 * 3. Runtime data JSON (slot configs, var modes — via js_amd_inline)
 * 4. MathQuill AMD module call (only small params via js_call_amd)
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class hook_callbacks {

    /** @var string[] Page types where the editor should be active. */
    private const ALLOWED_PAGES = [
        'mod-quiz-attempt',
        'mod-quiz-review',
        'question-preview',
        'question-bank-previewquestion',
    ];

    /**
     * Check whether the plugin should inject on this page.
     *
     * @return bool
     */
    private static function should_inject(): bool {
        global $PAGE;

        if (!get_config('local_stackmatheditor', 'enabled')) {
            return false;
        }
        if (!in_array($PAGE->pagetype, self::ALLOWED_PAGES)) {
            return false;
        }
        return true;
    }

    /**
     * Resolve per-slot toolbar configs for the current quiz attempt.
     * Uses direct DB queries. No debugging() calls.
     *
     * @return array Map of slot number => toolbar config array.
     */
    private static function resolve_slot_configs(): array {
        global $DB, $PAGE;

        $slotconfigs = [];

        $attemptid = optional_param('attempt', 0, PARAM_INT);
        if (!$attemptid) {
            return $slotconfigs;
        }

        $cmid = 0;
        if ($PAGE->cm) {
            $cmid = (int) $PAGE->cm->id;
        }
        if (!$cmid) {
            return $slotconfigs;
        }

        try {
            // 1. Load attempt.
            $attempt = $DB->get_record('quiz_attempts', ['id' => $attemptid]);
            if (!$attempt) {
                return $slotconfigs;
            }

            // 2. Load question attempts for this usage.
            $qas = $DB->get_records(
                'question_attempts',
                ['questionusageid' => $attempt->uniqueid],
                'slot ASC'
            );
            if (empty($qas)) {
                return $slotconfigs;
            }

            // 3. Map question IDs to slots.
            $qamap = [];
            $questionids = [];
            foreach ($qas as $qa) {
                $qid = (int) $qa->questionid;
                $slot = (int) $qa->slot;
                $qamap[$qid][] = $slot;
                if (!in_array($qid, $questionids)) {
                    $questionids[] = $qid;
                }
            }
            if (empty($questionids)) {
                return $slotconfigs;
            }

            // 4. Load question records to filter by qtype.
            list($qidinsql, $qidparams) = $DB->get_in_or_equal(
                $questionids, SQL_PARAMS_NAMED, 'qid'
            );
            $questions = $DB->get_records_select(
                'question',
                "id {$qidinsql}",
                $qidparams,
                '',
                'id, qtype'
            );

            // 5. For STACK questions, resolve questionbankentryid.
            $slotqbeids = [];
            $slotquestionids = [];
            $qbeidToQid = [];

            foreach ($questions as $question) {
                if ($question->qtype !== 'stack') {
                    continue;
                }
                $qbeid = config_manager::resolve_qbeid((int) $question->id);
                $slots = $qamap[$question->id] ?? [];
                foreach ($slots as $slot) {
                    $slotquestionids[$slot] = (int) $question->id;
                    if ($qbeid) {
                        $slotqbeids[$slot] = $qbeid;
                        $qbeidToQid[$qbeid] = (int) $question->id;
                    }
                }
            }

            if (empty($slotquestionids)) {
                return $slotconfigs;
            }

            // 6. Batch-load configs.
            if (!empty($slotqbeids)) {
                $qbeids = array_values(array_unique($slotqbeids));
                $configs = config_manager::get_configs($cmid, $qbeids, $qbeidToQid);
                foreach ($slotqbeids as $slot => $qbeid) {
                    $slotconfigs[$slot] = $configs[$qbeid]
                        ?? config_manager::get_instance_defaults();
                }
            }

            // 7. Legacy fallback for slots without qbeid.
            foreach ($slotquestionids as $slot => $qid) {
                if (!isset($slotconfigs[$slot])) {
                    $slotconfigs[$slot] = config_manager::get_config($cmid, 0, $qid);
                }
            }

        } catch (\Throwable $e) {
            error_log('[SME] resolve_slot_configs error: ' . $e->getMessage());
        }

        return $slotconfigs;
    }

    /**
     * Resolve per-slot toolbar config for question preview mode.
     *
     * @return array Map of slot number => toolbar config array.
     */
    private static function resolve_preview_configs(): array {
        global $PAGE;

        $slotconfigs = [];

        $questionid = optional_param('id', 0, PARAM_INT);
        if (!$questionid) {
            return $slotconfigs;
        }

        $qbeid = config_manager::resolve_qbeid($questionid);
        if (!$qbeid) {
            return $slotconfigs;
        }

        $cmid = $PAGE->cm ? (int) $PAGE->cm->id : 0;
        $config = config_manager::get_config($cmid, $qbeid);
        $slotconfigs[1] = $config;

        return $slotconfigs;
    }

    /**
     * Extract variable mode per slot from configs.
     *
     * @param array $slotconfigs Existing slot configs.
     * @return array Map of slot => variable mode string.
     */
    private static function resolve_slot_variable_modes(array $slotconfigs): array {
        $modes = [];
        $instancemode = config_manager::get_instance_variable_mode();
        foreach ($slotconfigs as $slot => $config) {
            $modes[$slot] = $config['_variableMode'] ?? $instancemode;
        }
        return $modes;
    }

    /**
     * Injects MathJax v2 compatibility shim AND definitions JSON.
     *
     * Definitions are placed in a script type="application/json" tag
     * so that JS can read them from the DOM without hitting the
     * 1024 character limit of js_call_amd arguments.
     *
     * @param \core\hook\output\before_standard_top_of_body_html_generation $hook
     */
    public static function before_top_of_body(
        \core\hook\output\before_standard_top_of_body_html_generation $hook
    ): void {
        if (!self::should_inject()) {
            return;
        }

        // --- MathJax v2 shim ---
        $shimjs = <<<'JSEOF'
<script type="text/javascript">
(function(){
    "use strict";
    var noop=function(){};
    function createHubShim(){
        function typesetV3(el){
            if(window.MathJax&&window.MathJax.typesetPromise){
                try{window.MathJax.typesetPromise(el?[el]:[]).catch(noop);}catch(e){}
            }else if(window.MathJax&&window.MathJax.typeset){
                try{window.MathJax.typeset(el?[el]:[]);}catch(e){}
            }
        }
        function processQueue(){
            var i,item;
            for(i=0;i<arguments.length;i++){
                item=arguments[i];
                if(typeof item==="function"){try{item();}catch(e){}}
                else if(Array.isArray(item)){
                    if(item[0]==="Typeset"){typesetV3(item.length>2?item[2]:null);}
                    else if(typeof item[0]==="function"){
                        try{item[0].apply(item[1]||null,item.slice(2));}catch(e){}
                    }
                }
            }
        }
        return{
            Queue:processQueue,
            Typeset:function(el,cb){typesetV3(el);if(typeof cb==="function"){setTimeout(cb,10);}},
            Config:noop,Configured:noop,
            Register:{
                StartupHook:function(h,cb){if(typeof cb==="function"){try{cb();}catch(e){}}},
                MessageHook:noop,LoadHook:noop
            },
            processSectionDelay:0,processUpdateDelay:0,processUpdateTime:250,
            config:{showProcessingMessages:false,messageStyle:"none","HTML-CSS":{},SVG:{},NativeMML:{},TeX:{}},
            signal:{Interest:noop},
            getAllJax:function(){return[];},getJaxFor:function(){return null;},
            Reprocess:noop,Rerender:noop,setRenderer:noop,
            Insert:function(dst,src){
                if(dst&&src){for(var k in src){if(src.hasOwnProperty(k)){dst[k]=src[k];}}}
                return dst;
            }
        };
    }
    function ensureHub(){
        if(!window.MathJax||typeof window.MathJax!=="object"){return false;}
        if(window.MathJax.Hub){return true;}
        window.MathJax.Hub=createHubShim();
        if(!window.MathJax.Callback){
            window.MathJax.Callback={
                Queue:function(){
                    var q={Push:function(){
                        var i;for(i=0;i<arguments.length;i++){
                            if(typeof arguments[i]==="function"){try{arguments[i]();}catch(e){}}
                        }
                    }};q.Push.apply(q,arguments);return q;
                },
                Signal:function(){return{Interest:noop,Post:noop};}
            };
        }
        if(!window.MathJax.Ajax){
            window.MathJax.Ajax={
                Require:function(f,cb){if(typeof cb==="function"){cb();}},
                config:{root:""},STATUS:{OK:1},loaded:{}
            };
        }
        return true;
    }
    ensureHub();
    var count=0,maxCount=500,interval=setInterval(function(){
        ensureHub();count++;if(count>=maxCount){clearInterval(interval);}
    },20);
})();
</script>
JSEOF;

        // --- Definitions JSON ---
        $defsdata = definitions::export_for_js();
        $defsjson = json_encode($defsdata, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        $defstag = '<script type="application/json" id="sme-definitions">'
            . $defsjson . '</script>';

        $hook->add_html($shimjs . "\n" . $defstag);
    }

    /**
     * Injects MathQuill AMD module call and runtime data.
     *
     * Only small params go via js_call_amd (under 1024 chars).
     * Slot configs and instance defaults go via a DOM JSON element.
     *
     * @param \core\hook\output\before_footer_html_generation $hook
     */
    public static function before_footer(
        \core\hook\output\before_footer_html_generation $hook
    ): void {
        global $PAGE;

        if (!self::should_inject()) {
            return;
        }

        // Detect MathQuill JS file.
        $plugindir = __DIR__ . '/../thirdparty/mathquill/';
        $jsfile = file_exists($plugindir . 'mathquill.min.js')
            ? 'mathquill.min.js'
            : 'mathquill.js';

        $mqjsurl = (new \moodle_url(
            '/local/stackmatheditor/thirdparty/mathquill/' . $jsfile
        ))->out(false);

        $mqcssurl = (new \moodle_url(
            '/local/stackmatheditor/thirdparty/mathquill/mathquill.css'
        ))->out(false);

        $cmid = $PAGE->cm ? (int) $PAGE->cm->id : 0;

        // Resolve slot configs and variable modes.
        $slotconfigs = [];
        $slotvarmodes = [];

        if (in_array($PAGE->pagetype, ['mod-quiz-attempt', 'mod-quiz-review'])) {
            $slotconfigs = self::resolve_slot_configs();
            $slotvarmodes = self::resolve_slot_variable_modes($slotconfigs);
        } else if (in_array($PAGE->pagetype,
            ['question-preview', 'question-bank-previewquestion'])) {
            $slotconfigs = self::resolve_preview_configs();
            $slotvarmodes = self::resolve_slot_variable_modes($slotconfigs);
        }

        $instancedefaults = config_manager::get_instance_defaults();
        $instancevarmode = config_manager::get_instance_variable_mode();

        // Small params via js_call_amd (well under 1024 chars).
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

        // Larger runtime data via DOM JSON element.
        $runtimedata = json_encode([
            'slotConfigs'      => !empty($slotconfigs)
                ? $slotconfigs : new \stdClass(),
            'slotVarModes'     => !empty($slotvarmodes)
                ? $slotvarmodes : new \stdClass(),
            'instanceDefaults' => $instancedefaults,
        ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);

        $PAGE->requires->js_amd_inline("
            (function() {
                var el = document.createElement('script');
                el.type = 'application/json';
                el.id = 'sme-runtime';
                el.textContent = " . json_encode($runtimedata) . ";
                document.body.appendChild(el);
            })();
        ");
    }
}
