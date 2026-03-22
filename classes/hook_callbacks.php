<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

/**
 * Hook callbacks for local_stackmatheditor.
 *
 * Handles:
 * - Injection of MathJax Hub shim and definitions (before_top_of_body)
 * - Injection of MathQuill editor runtime data (before_footer)
 * - Injection of configure links for teachers (before_footer)
 *
 * Registered via db/hooks.php.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class hook_callbacks {

    /** @var string[] Pages where MathQuill editor is injected. */
    private const EDITOR_PAGES = [
        'mod-quiz-attempt',
        'mod-quiz-review',
        'question-preview',
        'question-bank-previewquestion',
    ];

    /** @var string[] Pages where configure links are injected. */
    private const CONFIGURE_PAGES = [
        'mod-quiz-attempt',
        'mod-quiz-review',
        'mod-quiz-edit',
    ];

    // ────────────────────────────────────────────────────────────
    //  Guards
    // ────────────────────────────────────────────────────────────

    /**
     * Should the MathQuill editor be injected on this page?
     *
     * @return bool
     */
    private static function should_inject_editor(): bool {
        global $PAGE;
        if (!get_config('local_stackmatheditor', 'enabled')) {
            return false;
        }
        return in_array($PAGE->pagetype, self::EDITOR_PAGES);
    }

    /**
     * Should configure links be injected on this page?
     * Requires mod/quiz:manage capability.
     *
     * @return bool
     */
    private static function should_inject_configure(): bool {
        global $PAGE;
        if (!get_config('local_stackmatheditor', 'enabled')) {
            return false;
        }
        if (!in_array($PAGE->pagetype, self::CONFIGURE_PAGES)) {
            return false;
        }
        if (!$PAGE->cm) {
            return false;
        }
        try {
            $context = \context_module::instance($PAGE->cm->id);
            return has_capability('mod/quiz:manage', $context);
        } catch (\Throwable $e) {
            return false;
        }
    }

    // ────────────────────────────────────────────────────────────
    //  Slot config resolution (editor)
    // ────────────────────────────────────────────────────────────

    /**
     * Resolve per-slot toolbar configs for attempt/review pages.
     *
     * @return array Slot number => config array.
     */
    private static function resolve_slot_configs(): array {
        global $DB, $PAGE;
        $slotconfigs = [];

        $attemptid = optional_param('attempt', 0, PARAM_INT);
        if (!$attemptid) {
            return $slotconfigs;
        }

        $cmid = $PAGE->cm ? (int) $PAGE->cm->id : 0;
        if (!$cmid) {
            return $slotconfigs;
        }

        try {
            $attempt = $DB->get_record(
                'quiz_attempts', ['id' => $attemptid]);
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

            list($insql, $params) = $DB->get_in_or_equal(
                $questionids, SQL_PARAMS_NAMED, 'qid');
            $questions = $DB->get_records_select(
                'question', "id {$insql}", $params, '', 'id, qtype');

            $slotqbeids = [];
            $slotquestionids = [];
            $qbeidtoqid = [];

            foreach ($questions as $question) {
                if ($question->qtype !== 'stack') {
                    continue;
                }
                $qbeid = config_manager::resolve_qbeid(
                    (int) $question->id);
                $slots = $qamap[$question->id] ?? [];
                foreach ($slots as $slot) {
                    $slotquestionids[$slot] = (int) $question->id;
                    if ($qbeid) {
                        $slotqbeids[$slot] = $qbeid;
                        if (!isset($qbeidtoqid[$qbeid])) {
                            $qbeidtoqid[$qbeid] =
                                (int) $question->id;
                        }
                    }
                }
            }

            if (empty($slotquestionids)) {
                return $slotconfigs;
            }

            // Batch load by qbeid.
            if (!empty($slotqbeids)) {
                $qbeids = array_values(
                    array_unique($slotqbeids));
                $configs = config_manager::get_configs(
                    $cmid, $qbeids, $qbeidtoqid);
                foreach ($slotqbeids as $slot => $qbeid) {
                    $slotconfigs[$slot] = $configs[$qbeid]
                        ?? config_manager::get_instance_defaults();
                }
            }

            // Fallback for slots without qbeid.
            foreach ($slotquestionids as $slot => $qid) {
                if (!isset($slotconfigs[$slot])) {
                    $slotconfigs[$slot] =
                        config_manager::get_config($cmid, 0, $qid);
                }
            }
        } catch (\Throwable $e) {
            error_log(
                '[SME] resolve_slot_configs: ' . $e->getMessage());
        }

        return $slotconfigs;
    }

    /**
     * Resolve configs for question preview pages.
     *
     * @return array Slot number => config array.
     */
    private static function resolve_preview_configs(): array {
        global $PAGE;

        $questionid = optional_param('id', 0, PARAM_INT);
        if (!$questionid) {
            return [];
        }

        $qbeid = config_manager::resolve_qbeid($questionid);
        if (!$qbeid) {
            return [];
        }

        $cmid = $PAGE->cm ? (int) $PAGE->cm->id : 0;
        return [1 => config_manager::get_config($cmid, $qbeid)];
    }

    /**
     * Derive variable modes from slot configs.
     *
     * @param array $slotconfigs Slot => config.
     * @return array Slot => variable mode string.
     */
    private static function resolve_slot_variable_modes(
        array $slotconfigs): array {
        $modes = [];
        $default = config_manager::get_instance_variable_mode();
        foreach ($slotconfigs as $slot => $config) {
            $modes[$slot] = $config['_variableMode'] ?? $default;
        }
        return $modes;
    }

    // ────────────────────────────────────────────────────────────
    //  Configure-link data builders
    // ────────────────────────────────────────────────────────────

    /**
     * Build configure-link data for attempt/review pages.
     *
     * @return array Slot => {questionid, qbeid}.
     */
    private static function build_attempt_configure_data(): array {
        global $DB, $PAGE;
        $data = [];

        $attemptid = optional_param('attempt', 0, PARAM_INT);
        if (!$attemptid || !$PAGE->cm) {
            return $data;
        }

        try {
            $attempt = $DB->get_record(
                'quiz_attempts', ['id' => $attemptid]);
            if (!$attempt) {
                return $data;
            }

            $qas = $DB->get_records(
                'question_attempts',
                ['questionusageid' => $attempt->uniqueid],
                'slot ASC'
            );

            $questionids = [];
            $slotmap = [];
            foreach ($qas as $qa) {
                $qid = (int) $qa->questionid;
                $slot = (int) $qa->slot;
                $slotmap[$slot] = $qid;
                $questionids[] = $qid;
            }
            if (empty($questionids)) {
                return $data;
            }

            list($insql, $params) = $DB->get_in_or_equal(
                $questionids, SQL_PARAMS_NAMED);
            $questions = $DB->get_records_select(
                'question', "id {$insql}", $params,
                '', 'id, qtype');

            foreach ($slotmap as $slot => $qid) {
                if (!isset($questions[$qid])) {
                    continue;
                }
                if ($questions[$qid]->qtype !== 'stack') {
                    continue;
                }
                $qbeid = config_manager::resolve_qbeid($qid);
                $data[$slot] = [
                    'questionid' => $qid,
                    'qbeid' => $qbeid ?: 0,
                ];
            }
        } catch (\Throwable $e) {
            error_log('[SME] build_attempt_configure_data: '
                . $e->getMessage());
        }

        return $data;
    }

    /**
     * Build configure-link data for quiz edit page.
     *
     * @return array List of {questionid, qbeid, name, slot}.
     */
    private static function build_edit_configure_data(): array {
        global $DB, $PAGE;
        $data = [];

        if (!$PAGE->cm) {
            return $data;
        }

        try {
            $quiz = $DB->get_record(
                'quiz', ['id' => $PAGE->cm->instance], 'id');
            if (!$quiz) {
                return $data;
            }

            $slots = $DB->get_records(
                'quiz_slots',
                ['quizid' => $quiz->id],
                'slot ASC'
            );

            foreach ($slots as $slot) {
                $qref = $DB->get_record_sql(
                    "SELECT qv.questionid,
                            qv.questionbankentryid,
                            q.qtype, q.name
                       FROM {question_versions} qv
                       JOIN {question} q
                            ON q.id = qv.questionid
                      WHERE qv.questionbankentryid = :qbeid
                   ORDER BY qv.version DESC",
                    ['qbeid' => $slot->questionbankentryid],
                    IGNORE_MULTIPLE
                );

                if (!$qref || $qref->qtype !== 'stack') {
                    continue;
                }

                $data[] = [
                    'questionid' =>
                        (int) $qref->questionid,
                    'qbeid' =>
                        (int) $qref->questionbankentryid,
                    'name' => $qref->name,
                    'slot' => (int) $slot->slot,
                ];
            }
        } catch (\Throwable $e) {
            error_log('[SME] build_edit_configure_data: '
                . $e->getMessage());
        }

        return $data;
    }

    // ────────────────────────────────────────────────────────────
    //  Hook: before_top_of_body  (MathJax shim + definitions)
    // ────────────────────────────────────────────────────────────

    /**
     * Inject MathJax Hub shim and element-group definitions
     * into the page head area.
     *
     * @param \core\hook\output\before_standard_top_of_body_html_generation $hook
     * @return void
     */
    public static function before_top_of_body(
        \core\hook\output\before_standard_top_of_body_html_generation $hook
    ): void {
        if (!self::should_inject_editor()) {
            return;
        }

        // MathJax v2 Hub compatibility shim.
        $shimjs = <<<'JSEOF'
<script type="text/javascript">
(function(){
    "use strict";
    var noop=function(){};
    function createHubShim(){
        function typesetV3(el){
            if(window.MathJax&&window.MathJax.typesetPromise){
                try{
                    window.MathJax.typesetPromise(
                        el?[el]:[]
                    ).catch(noop);
                }catch(e){}
            }else if(window.MathJax&&window.MathJax.typeset){
                try{
                    window.MathJax.typeset(el?[el]:[]);
                }catch(e){}
            }
        }
        function processQueue(){
            var i,item;
            for(i=0;i<arguments.length;i++){
                item=arguments[i];
                if(typeof item==="function"){
                    try{item();}catch(e){}
                }else if(Array.isArray(item)){
                    if(item[0]==="Typeset"){
                        typesetV3(
                            item.length>2?item[2]:null
                        );
                    }else if(typeof item[0]==="function"){
                        try{
                            item[0].apply(
                                item[1]||null,
                                item.slice(2)
                            );
                        }catch(e){}
                    }
                }
            }
        }
        return{
            Queue:processQueue,
            Typeset:function(el,cb){
                typesetV3(el);
                if(typeof cb==="function"){
                    setTimeout(cb,10);
                }
            },
            Config:noop,
            Configured:noop,
            Register:{
                StartupHook:function(h,cb){
                    if(typeof cb==="function"){
                        try{cb();}catch(e){}
                    }
                },
                MessageHook:noop,
                LoadHook:noop
            },
            processSectionDelay:0,
            processUpdateDelay:0,
            processUpdateTime:250,
            config:{
                showProcessingMessages:false,
                messageStyle:"none",
                "HTML-CSS":{},
                SVG:{},
                NativeMML:{},
                TeX:{}
            },
            signal:{Interest:noop},
            getAllJax:function(){return[];},
            getJaxFor:function(){return null;},
            Reprocess:noop,
            Rerender:noop,
            setRenderer:noop,
            Insert:function(dst,src){
                if(dst&&src){
                    for(var k in src){
                        if(src.hasOwnProperty(k)){
                            dst[k]=src[k];
                        }
                    }
                }
                return dst;
            }
        };
    }
    function ensureHub(){
        if(!window.MathJax
                ||typeof window.MathJax!=="object"){
            return false;
        }
        if(window.MathJax.Hub){return true;}
        window.MathJax.Hub=createHubShim();
        if(!window.MathJax.Callback){
            window.MathJax.Callback={
                Queue:function(){
                    var q={Push:function(){
                        var j;
                        for(j=0;j<arguments.length;j++){
                            if(typeof arguments[j]==="function"){
                                try{arguments[j]();}catch(e){}
                            }
                        }
                    }};
                    q.Push.apply(q,arguments);
                    return q;
                },
                Signal:function(){
                    return{Interest:noop,Post:noop};
                }
            };
        }
        if(!window.MathJax.Ajax){
            window.MathJax.Ajax={
                Require:function(f,cb){
                    if(typeof cb==="function"){cb();}
                },
                config:{root:""},
                STATUS:{OK:1},
                loaded:{}
            };
        }
        return true;
    }
    ensureHub();
    var count=0,maxCount=500;
    var interval=setInterval(function(){
        ensureHub();
        count++;
        if(count>=maxCount){clearInterval(interval);}
    },20);
})();
</script>
JSEOF;

        // Definitions JSON for JavaScript modules.
        $defsdata = definitions::export_for_js();
        $defsjson = json_encode(
            $defsdata,
            JSON_UNESCAPED_UNICODE | JSON_HEX_TAG
        );
        $defstag =
            '<script type="application/json" id="sme-definitions">'
            . $defsjson
            . '</script>';

        $hook->add_html($shimjs . "\n" . $defstag);
    }

    // ────────────────────────────────────────────────────────────
    //  Hook: before_footer  (editor runtime + configure links)
    // ────────────────────────────────────────────────────────────

    /**
     * Inject MathQuill editor runtime data and configure links
     * before the page footer.
     *
     * @param \core\hook\output\before_footer_html_generation $hook
     * @return void
     */
    public static function before_footer(
        \core\hook\output\before_footer_html_generation $hook
    ): void {
        global $PAGE;

        $injectEditor = self::should_inject_editor();
        $injectConfigure = self::should_inject_configure();

        if (!$injectEditor && !$injectConfigure) {
            return;
        }

        $cmid = $PAGE->cm ? (int) $PAGE->cm->id : 0;

        // ── Editor runtime ──
        if ($injectEditor) {
            self::inject_editor_runtime($cmid);
        }

        // ── Configure links ──
        if ($injectConfigure) {
            self::inject_configure_links($cmid);
        }
    }

    /**
     * Inject MathQuill editor: CSS, JS init call, and runtime JSON.
     *
     * @param int $cmid Course module ID.
     * @return void
     */
    private static function inject_editor_runtime(int $cmid): void {
        global $PAGE;

        $plugindir = __DIR__ . '/../thirdparty/mathquill/';
        $jsfile = file_exists($plugindir . 'mathquill.min.js')
            ? 'mathquill.min.js'
            : 'mathquill.js';

        $mqjsurl = (new \moodle_url(
            '/local/stackmatheditor/thirdparty/mathquill/' . $jsfile
        ))->out(false);

        $mqcssurl = (new \moodle_url(
            '/local/stackmatheditor/thirdparty/mathquill/'
            . 'mathquill.css'
        ))->out(false);

        // Resolve per-slot configs.
        $slotconfigs = [];
        $slotvarmodes = [];

        if (in_array($PAGE->pagetype,
            ['mod-quiz-attempt', 'mod-quiz-review'])) {
            $slotconfigs = self::resolve_slot_configs();
            $slotvarmodes =
                self::resolve_slot_variable_modes($slotconfigs);
        } else if (in_array($PAGE->pagetype,
            ['question-preview',
                'question-bank-previewquestion'])) {
            $slotconfigs = self::resolve_preview_configs();
            $slotvarmodes =
                self::resolve_slot_variable_modes($slotconfigs);
        }

        $instancedefaults =
            config_manager::get_instance_defaults();
        $instancevarmode =
            config_manager::get_instance_variable_mode();

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
            'slotConfigs' => !empty($slotconfigs)
                ? $slotconfigs : new \stdClass(),
            'slotVarModes' => !empty($slotvarmodes)
                ? $slotvarmodes : new \stdClass(),
            'instanceDefaults' => $instancedefaults,
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
     * Inject configure links via AMD module.
     *
     * @param int $cmid Course module ID.
     * @return void
     */
    private static function inject_configure_links(int $cmid): void {
        global $PAGE;

        $configureurl = (new \moodle_url(
            '/local/stackmatheditor/configure.php'
        ))->out(false);

        $linktext = get_string(
            'configure_editor', 'local_stackmatheditor');
        $returnurl = $PAGE->url->out(false);

        $linkdata = [];

        if (in_array($PAGE->pagetype,
            ['mod-quiz-attempt', 'mod-quiz-review'])) {
            $slots = self::build_attempt_configure_data();
            if (!empty($slots)) {
                $linkdata = [
                    'mode'         => 'attempt',
                    'cmid'         => $cmid,
                    'configureUrl' => $configureurl,
                    'returnUrl'    => $returnurl,
                    'slots'        => $slots,
                    'linkText'     => $linktext,
                ];
            }
        } else if ($PAGE->pagetype === 'mod-quiz-edit') {
            $questions = self::build_edit_configure_data();
            if (!empty($questions)) {
                $linkdata = [
                    'mode'         => 'edit',
                    'cmid'         => $cmid,
                    'configureUrl' => $configureurl,
                    'returnUrl'    => $returnurl,
                    'questions'    => $questions,
                    'linkText'     => $linktext,
                ];
            }
        }

        if (!empty($linkdata)) {
            $PAGE->requires->js_call_amd(
                'local_stackmatheditor/configure_links',
                'init',
                [$linkdata]
            );
        }
    }
}
