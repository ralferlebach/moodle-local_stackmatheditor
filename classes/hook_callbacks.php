<?php
namespace local_stackmatheditor;

defined('MOODLE_INTERNAL') || die();

use local_stackmatheditor\output\mathjax_injector;
use local_stackmatheditor\output\editor_injector;
use local_stackmatheditor\output\configure_injector;

/**
 * Hook callbacks for local_stackmatheditor.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class hook_callbacks {

    /** @var string[] Pages where the editor is active. */
    private const EDITOR_PAGES = [
        'mod-quiz-attempt',
        'mod-quiz-review',
        'question-preview',
        'question-bank-previewquestion',
    ];

    /** @var string[] Pages where configure links appear. */
    private const CONFIGURE_PAGES = [
        'mod-quiz-edit',
        'mod-quiz-attempt',
        'mod-quiz-review',
    ];

    /**
     * Check if the plugin is enabled.
     *
     * @return bool True if enabled.
     */
    private static function is_enabled(): bool {
        return (bool) get_config(
            'local_stackmatheditor', 'enabled');
    }

    /**
     * Check if current page is an editor page.
     *
     * @return bool True if editor should be injected.
     */
    private static function is_editor_page(): bool {
        global $PAGE;
        return in_array(
            $PAGE->pagetype, self::EDITOR_PAGES);
    }

    /**
     * Check if current page is a configure page.
     *
     * @return bool True if configure links appear.
     */
    private static function is_configure_page(): bool {
        global $PAGE;
        return in_array(
            $PAGE->pagetype, self::CONFIGURE_PAGES);
    }

    /**
     * Inject MathJax v2 shim at top of body.
     *
     * @param \core\hook\output\before_standard_top_of_body_html_generation $hook
     */
    public static function before_top_of_body(
        \core\hook\output\before_standard_top_of_body_html_generation $hook
    ): void {
        if (!self::is_enabled()) {
            return;
        }

        if (!self::is_editor_page()) {
            return;
        }

        quiz_helper::dbg(
            'before_top_of_body: injecting MathJax shim');

        $shimjs = <<<'JSEOF'
<script type="text/javascript">
(function(){
    "use strict";
    var noop=function(){};

    function createHubShim(){
        function processQueue(){
            var i,item;
            for(i=0;i<arguments.length;i++){
                item=arguments[i];
                if(typeof item==="function"){
                    try{item();}catch(e){}
                }else if(Array.isArray(item)){
                    if(item[0]==="Typeset"){
                        var el=(item.length>2)?item[2]:null;
                        if(window.MathJax&&window.MathJax.typesetPromise){
                            try{
                                window.MathJax.typesetPromise(el?[el]:[]).catch(noop);
                            }catch(e){}
                        }
                    }else if(typeof item[0]==="function"){
                        try{item[0].apply(item[1]||null,item.slice(2));}catch(e){}
                    }
                }
            }
        }
        return{
            Queue:processQueue,
            Typeset:function(el,cb){
                if(window.MathJax&&window.MathJax.typesetPromise){
                    window.MathJax.typesetPromise(el?[el]:[]).then(cb||noop).catch(noop);
                }else if(typeof cb==="function"){cb();}
            },
            Config:noop,
            Register:{
                StartupHook:function(h,cb){if(typeof cb==="function"){try{cb();}catch(e){}}},
                MessageHook:noop,LoadHook:noop
            },
            Configured:noop,
            processSectionDelay:0,processUpdateDelay:0,processUpdateTime:250,
            config:{showProcessingMessages:false,messageStyle:"none","HTML-CSS":{},SVG:{},NativeMML:{},TeX:{}},
            signal:{Interest:noop},
            getAllJax:function(){return[];},
            getJaxFor:function(){return null;},
            Reprocess:noop,Rerender:noop,setRenderer:noop,
            Insert:function(dst,src){
                if(dst&&src){for(var k in src){if(src.hasOwnProperty(k)){dst[k]=src[k];}}}
                return dst;
            }
        };
    }

    function ensureHub(){
        if(window.MathJax&&typeof window.MathJax==="object"&&!window.MathJax.Hub){
            window.MathJax.Hub=createHubShim();
            if(!window.MathJax.Callback){
                window.MathJax.Callback={
                    Queue:function(){
                        var q={Push:function(){var i;for(i=0;i<arguments.length;i++){
                            if(typeof arguments[i]==="function"){try{arguments[i]();}catch(e){}}
                        }}};q.Push.apply(q,arguments);return q;
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
        return(window.MathJax&&window.MathJax.Hub)?true:false;
    }

    ensureHub();
    var count=0,maxCount=500;
    var iv=setInterval(function(){
        ensureHub();
        if(++count>=maxCount){clearInterval(iv);}
    },20);
})();
</script>
JSEOF;

        $hook->add_html($shimjs);
    }

    /**
     * Main injection: definitions, editor runtime, configure links.
     *
     * @param \core\hook\output\before_footer_html_generation $hook
     */
    public static function before_footer(
        \core\hook\output\before_footer_html_generation $hook
    ): void {
        global $PAGE;

        if (!self::is_enabled()) {
            return;
        }

        $isEditor = self::is_editor_page();
        $isConfigure = self::is_configure_page();

        quiz_helper::dbg(
            'before_footer: page=' . $PAGE->pagetype
            . ' editor=' . ($isEditor ? 'Y' : 'N')
            . ' configure=' . ($isConfigure ? 'Y' : 'N')
        );

        if (!$isEditor && !$isConfigure) {
            return;
        }

        // ── Editor injection ──
        if ($isEditor) {
            try {
                $cmid = quiz_helper::get_cmid();

                // 1. Definitions (#sme-definitions).
                mathjax_injector::inject();

                // 2. Runtime + MathQuill init.
                editor_injector::inject($cmid);

                quiz_helper::dbg(
                    'editor injected: cmid=' . $cmid);
            } catch (\Throwable $e) {
                quiz_helper::dbg(
                    'editor injection error: '
                    . $e->getMessage());
            }
        }

        // ── Configure links injection ──
        if ($isConfigure) {
            try {
                $cmid = quiz_helper::get_cmid();
                if ($cmid <= 0) {
                    quiz_helper::dbg(
                        'configure: no cmid, skipping');
                    return;
                }

                quiz_helper::dbg(
                    'configure guard: can_manage='
                    . (quiz_helper::can_manage_quiz($cmid)
                        ? 'true' : 'false'));

                if (quiz_helper::can_manage_quiz($cmid)) {
                    configure_injector::inject($cmid);
                }
            } catch (\Throwable $e) {
                quiz_helper::dbg(
                    'configure injection error: '
                    . $e->getMessage());
            }
        }
    }
}
