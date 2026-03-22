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
     * Injects a synchronous MathJax v2 compatibility shim at the top of body.
     *
     * This runs BEFORE any RequireJS callbacks, ensuring MathJax.Hub exists
     * when STACK's loader.js accesses it. Uses polling to handle the case
     * where MathJax is set/overwritten after this script runs.
     *
     * @param \core\hook\output\before_standard_top_of_body_html_generation $hook
     */
    public static function before_top_of_body(
        \core\hook\output\before_standard_top_of_body_html_generation $hook
    ): void {
        global $PAGE;

        if (!get_config('local_stackmatheditor', 'enabled')) {
            return;
        }

        if (!in_array($PAGE->pagetype, self::ALLOWED_PAGES)) {
            return;
        }

        // Inline synchronous script — runs before any AMD/RequireJS callbacks.
        // Uses nowdoc so PHP does not interpret $ signs in the JS code.
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
                }else if(typeof cb==="function"){
                    cb();
                }
            },
            Config:noop,
            Register:{
                StartupHook:function(h,cb){
                    if(typeof cb==="function"){try{cb();}catch(e){}}
                },
                MessageHook:noop,
                LoadHook:noop
            },
            Configured:noop,
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
                        var q={Push:function(){
                            var i;
                            for(i=0;i<arguments.length;i++){
                                if(typeof arguments[i]==="function"){
                                    try{arguments[i]();}catch(e){}
                                }
                            }
                        }};
                        q.Push.apply(q,arguments);
                        return q;
                    },
                    Signal:function(){return{Interest:noop,Post:noop};}
                };
            }
            if(!window.MathJax.Ajax){
                window.MathJax.Ajax={
                    Require:function(f,cb){if(typeof cb==="function"){cb();}},
                    config:{root:""},
                    STATUS:{OK:1},
                    loaded:{}
                };
            }
            return true;
        }
        return(window.MathJax&&window.MathJax.Hub)?true:false;
    }

    /* Try immediately. */
    ensureHub();

    /* Poll every 20ms for up to 10s to catch late loads and overwrites. */
    var count=0;
    var maxCount=500;
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
     * Injects MathQuill AMD module on quiz pages containing STACK questions.
     *
     * @param \core\hook\output\before_footer_html_generation $hook
     */
    public static function before_footer(
        \core\hook\output\before_footer_html_generation $hook
    ): void {
        global $PAGE;

        if (!get_config('local_stackmatheditor', 'enabled')) {
            return;
        }

        if (!in_array($PAGE->pagetype, self::ALLOWED_PAGES)) {
            return;
        }

        $plugindir = __DIR__ . '/../thirdparty/mathquill/';
        if (file_exists($plugindir . 'mathquill.min.js')) {
            $jsfile = 'mathquill.min.js';
        } else {
            $jsfile = 'mathquill.js';
        }

        $mqjsurl = (new \moodle_url(
            '/local/stackmatheditor/thirdparty/mathquill/' . $jsfile
        ))->out(false);

        $mqcssurl = (new \moodle_url(
            '/local/stackmatheditor/thirdparty/mathquill/mathquill.css'
        ))->out(false);

        $PAGE->requires->js_call_amd(
            'local_stackmatheditor/mathquill_init',
            'init',
            [[
                'mathquillJsUrl'  => $mqjsurl,
                'mathquillCssUrl' => $mqcssurl,
            ]]
        );
    }
}
