/**
 * Injects configure links for STACK questions on quiz pages.
 *
 * Data is read from a JSON script element (#sme-configure-data)
 * to avoid the 1024-char limit of js_call_amd().
 *
 * On mod-quiz-edit, also inserts a "STACK MathQuill-Editor einrichten"
 * option into the quiz navigation <select> (Anforderung B).
 * The STACK check already happened in PHP — if quizConfigureUrl is
 * present in the data, we know STACK questions exist.
 *
 * @module     local_stackmatheditor/configure_links
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define(['jquery'], function($) {
    'use strict';

    var DEBUG = true;

    function dbg(msg) {
        if (DEBUG) {
            window.console.log('[SME-links] ' + msg);
        }
    }

    function loadData() {
        var el = document.getElementById('sme-configure-data');
        if (!el) {
            return null;
        }
        try {
            return JSON.parse(el.textContent);
        } catch (e) {
            dbg('parse error: ' + e.message);
            return null;
        }
    }

    function buildUrl(base, cmid, qbeid, qid, ret) {
        var url = base + '?cmid=' + encodeURIComponent(cmid);
        if (qbeid) {
            url += '&qbeid=' + encodeURIComponent(qbeid);
        }
        if (qid) {
            url += '&questionid=' + encodeURIComponent(qid);
        }
        if (ret) {
            url += '&returnurl=' + encodeURIComponent(ret);
        }
        return url;
    }

    function createTextLink(href, text) {
        return $('<a>')
            .attr('href', href)
            .attr('title', text)
            .addClass('sme-configure-link')
            .append($('<i>').addClass('fa fa-calculator').attr('aria-hidden', 'true'))
            .append(' ' + text);
    }

    function createIconLink(href, title) {
        return $('<a>')
            .attr('href', href)
            .attr('title', title)
            .addClass('sme-configure-edit-link ml-1 mr-1')
            .css({'color': '#0f6cbf', 'font-size': '1em', 'text-decoration': 'none'})
            .append($('<i>').addClass('fa fa-calculator fa-fw').attr('aria-hidden', 'true'));
    }

    // ── Attempt page ─────────────────────────────────────────────────────────

    function findContainer(slot) {
        var $c = $('[id$="-' + slot + '"].que');
        if ($c.length) {
            return $c.first();
        }
        var re = new RegExp('^question-\\d+-' + slot + '$');
        var $m = $('[id^="question-"]').filter(function() {
            return re.test(this.id);
        });
        return $m.length ? $m.first() : $();
    }

    function injectAttemptLinks(data) {
        var slots = data.slots || {};
        var slot;
        var count = 0;
        for (slot in slots) {
            if (!slots.hasOwnProperty(slot)) {
                continue;
            }
            if (doAttemptSlot(data, slot, slots[slot])) {
                count++;
            }
        }
        dbg('attempt: ' + count + ' injected');
    }

    function doAttemptSlot(data, slot, sd) {
        var url = buildUrl(data.configureUrl, data.cmid,
            sd.qbeid, sd.questionid, data.returnUrl);
        var $w = $('<div>').addClass('sme-configure-wrapper mt-1')
            .append(createTextLink(url, data.linkText));

        var $c = findContainer(slot);
        if (!$c.length) {
            dbg('slot ' + slot + ': not found');
            return false;
        }
        var $info = $c.find('.info');
        if ($info.length) {
            var $edit = $info.find('a[href*="editquestion"]');
            if ($edit.length) {
                $edit.first().closest('div, span, p').after($w);
                return true;
            }
            $info.append($w);
            return true;
        }
        var $f = $c.find('.formulation');
        if ($f.length) {
            $f.before($w);
            return true;
        }
        $c.prepend($w);
        return true;
    }

    // ── Edit page ─────────────────────────────────────────────────────────────

    /**
     * Insert a quiz-level configure option into the navigation <select>.
     *
     * Selector: form[action*="jumpto.php"] select[name="jump"]
     * This targets the "Fragen / Bewertungselemente" dropdown in quiz/edit.php.
     * Only inserts if quizConfigureUrl is set (= PHP confirmed STACK questions exist).
     *
     * @param {Object} data Configuration data.
     */
    function injectQuizNavOption(data) {
        if (!data.quizConfigureUrl || !data.quizLinkText) {
            return;
        }

        // Stable selector independent of YUI-generated IDs.
        var $select = $('form[action*="jumpto.php"] select[name="jump"]');
        if (!$select.length) {
            dbg('quiz nav select not found');
            return;
        }

        // Avoid double-injection on re-runs.
        if ($select.find('option[data-sme="quiz"]').length) {
            dbg('quiz nav option already present');
            return;
        }

        var $option = $('<option>')
            .val(data.quizConfigureUrl)
            .attr('data-sme', 'quiz')
            .text(data.quizLinkText);

        $select.append($option);

        // Wire up navigation: when selected, redirect immediately.
        $select.off('change.sme').on('change.sme', function() {
            var val = $(this).val();
            var $selected = $(this).find('option:selected');
            if ($selected.attr('data-sme') === 'quiz') {
                window.location.href = val;
            }
        });

        dbg('quiz nav option injected: ' + data.quizConfigureUrl);
    }

    function injectEditLinks(data) {
        // 1. Per-question icon links (existing behaviour).
        var questions = data.questions || [];
        var count = 0;
        var i;
        for (i = 0; i < questions.length; i++) {
            if (doEditQuestion(data, questions[i])) {
                count++;
            }
        }
        dbg('edit: ' + count + '/' + questions.length);

        // 2. Quiz-level option in nav selector (Anforderung B).
        injectQuizNavOption(data);
    }

    function doEditQuestion(data, q) {
        var url = buildUrl(data.configureUrl, data.cmid,
            q.qbeid, q.questionid, data.returnUrl);
        var $icon = createIconLink(url, data.linkText);

        var $edit = $('a[href*="editquestion"][href*="id=' + q.questionid + '"]');
        if (!$edit.length) {
            $edit = $('a[href*="editquestion"][href*="id=' + q.qbeid + '"]');
        }

        if ($edit.length) {
            var $row = $edit.first().closest(
                '.activity-wrapper, .activity, .slot, li, [data-for="cmitem"]');
            if ($row.length) {
                var $actions = $row.find('.activity-actions, .actions, .ml-auto');
                if ($actions.length) {
                    $actions.first().prepend($icon.clone(true));
                    return true;
                }
            }
            $edit.first().after($icon.clone(true));
            return true;
        }

        var name = q.name;
        var $nameLink = $('a').filter(function() {
            return $(this).text().trim() === name;
        });
        if ($nameLink.length) {
            $nameLink.first().after($icon.clone(true));
            return true;
        }

        dbg('edit q=' + q.questionid + ': not found');
        return false;
    }

    // ── Run ───────────────────────────────────────────────────────────────────

    function run(data) {
        dbg('run: mode=' + data.mode);
        if (data.mode === 'attempt') {
            injectAttemptLinks(data);
        } else if (data.mode === 'edit') {
            injectEditLinks(data);
        }
    }

    return /** @alias module:local_stackmatheditor/configure_links */ {
        init: function() {
            dbg('init');
            $(document).ready(function() {
                var data = loadData();
                if (data) {
                    run(data);
                    return;
                }
                setTimeout(function() {
                    data = loadData();
                    if (data) {
                        run(data);
                    } else {
                        dbg('no data found');
                    }
                }, 50);
            });
        }
    };
});
