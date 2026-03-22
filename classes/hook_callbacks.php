<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Hook callbacks for local_stackmatheditor.
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
     * Check whether the plugin is enabled and the current page is relevant.
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
     * Resolves per-slot toolbar configurations for the current quiz attempt.
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
            $attempt = $DB->get_record('quiz_attempts', ['id' => $attemptid]);
            if (!$attempt) {
                return $slotconfigs;
            }

            $qas = $DB->get_records(
                'question_attempts',
                ['questionusageid' => $attempt->uniqueid],
                'slot ASC'
            );

            if (empty($qas)) {
                return $slotconfigs;
            }

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

            // Resolve qbeids and build lookup maps.
            $slotqbeids = [];      // slot => qbeid
            $slotquestionids = []; // slot => questionid (for legacy fallback)
            $qbeidToQid = [];      // qbeid => questionid

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

            // If no STACK questions at all, return empty.
            if (empty($slotquestionids)) {
                return $slotconfigs;
            }

            // Load configs — pass questionid map for legacy fallback.
            if (!empty($slotqbeids)) {
                $qbeids = array_values(array_unique($slotqbeids));
                $configs = config_manager::get_configs($cmid, $qbeids, $qbeidToQid);

                foreach ($slotqbeids as $slot => $qbeid) {
                    $slotconfigs[$slot] = $configs[$qbeid] ?? config_manager::DEFAULT_ELEMENTS;
                }
            }

            // For slots without qbeid, try direct legacy lookup by questionid.
            foreach ($slotquestionids as $slot => $qid) {
                if (!isset($slotconfigs[$slot])) {
                    $slotconfigs[$slot] = config_manager::get_config(
                        $cmid, 0, $qid
                    );
                }
            }

        } catch (\Throwable $e) {
            error_log('[SME] resolve_slot_configs error: ' . $e->getMessage());
        }

        return $slotconfigs;
    }

    /**
     * Resolves per-slot toolbar config for question preview mode.
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
     * Injects MathJax v2 Hub compatibility shim at the top of body.
     *
     * @param \core\hook\output\before_standard_top_of_body_html_generation $hook
     */
    public static function before_top_of_body(
        \core\hook\output\before_standard_top_of_body_html_generation $hook
    ): void {
        if (!self::should_inject()) {
            return;
        }

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

        $hook->add_html($shimjs);
    }

    /**
     * Injects MathQuill AMD module with pre-resolved slot configurations.
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

        // Resolve slot configs server-side.
        $slotconfigs = [];
        if (in_array($PAGE->pagetype, ['mod-quiz-attempt', 'mod-quiz-review'])) {
            $slotconfigs = self::resolve_slot_configs();
        } else if (in_array($PAGE->pagetype,
            ['question-preview', 'question-bank-previewquestion'])) {
            $slotconfigs = self::resolve_preview_configs();
        }

        $PAGE->requires->js_call_amd(
            'local_stackmatheditor/mathquill_init',
            'init',
            [[
                'mathquillJsUrl'  => $mqjsurl,
                'mathquillCssUrl' => $mqcssurl,
                'cmid'            => $cmid,
                'slotConfigs'     => !empty($slotconfigs)
                    ? (object) $slotconfigs
                    : new \stdClass(),
            ]]
        );
    }
}
