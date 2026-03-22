/**
 * Injects configure links for STACK questions on quiz pages.
 *
 * Data is read from a JSON script element (#sme-configure-data)
 * to avoid the 1024-char limit of js_call_amd().
 *
 * @module     local_stackmatheditor/configure_links
 * @copyright  2026 Ralf Erlebach
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define(['jquery'], function($) {
    'use strict';

    /** @var {boolean} Enable debug logging. */
    var DEBUG = true;

    /**
     * Debug log helper.
     *
     * @param {string} msg Message.
     */
    function dbg(msg) {
        if (DEBUG) {
            window.console.log('[SME-links] ' + msg);
        }
    }

    /**
     * Load data from JSON script element.
     *
     * @returns {Object|null} Data or null.
     */
    function loadData() {
        var el = document.getElementById(
            'sme-configure-data');
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

    /**
     * Build a configure URL.
     *
     * @param {string} base Base URL.
     * @param {number} cmid Course module ID.
     * @param {number} qbeid Question bank entry ID.
     * @param {number} qid Question ID.
     * @param {string} ret Return URL.
     * @returns {string} Full URL.
     */
    function buildUrl(base, cmid, qbeid, qid, ret) {
        var url = base
            + '?cmid=' + encodeURIComponent(cmid);
        if (qbeid) {
            url += '&qbeid=' + encodeURIComponent(qbeid);
        }
        if (qid) {
            url += '&questionid='
                + encodeURIComponent(qid);
        }
        if (ret) {
            url += '&returnurl='
                + encodeURIComponent(ret);
        }
        return url;
    }

    /**
     * Create a text link with calculator icon.
     *
     * @param {string} href URL.
     * @param {string} text Link text.
     * @returns {jQuery} Link element.
     */
    function createTextLink(href, text) {
        return $('<a>')
            .attr('href', href)
            .attr('title', text)
            .addClass('sme-configure-link')
            .append(
                $('<i>').addClass('fa fa-calculator')
                    .attr('aria-hidden', 'true')
            )
            .append(' ' + text);
    }

    /**
     * Create a small icon-only link.
     *
     * @param {string} href URL.
     * @param {string} title Tooltip.
     * @returns {jQuery} Icon link.
     */
    function createIconLink(href, title) {
        return $('<a>')
            .attr('href', href)
            .attr('title', title)
            .addClass('sme-configure-edit-link ml-1 mr-1')
            .css({
                'color': '#0f6cbf',
                'font-size': '1em',
                'text-decoration': 'none'
            })
            .append(
                $('<i>').addClass('fa fa-calculator fa-fw')
                    .attr('aria-hidden', 'true')
            );
    }

    // ─── Attempt page ────────────────────────────────

    /**
     * Find question container for a slot.
     *
     * @param {string} slot Slot number.
     * @returns {jQuery} Container or empty.
     */
    function findContainer(slot) {
        // Fast: CSS selector for .que ending with -slot.
        var $c = $('[id$="-' + slot + '"].que');
        if ($c.length) {
            return $c.first();
        }
        // Fallback: regex on question-*-slot.
        var re = new RegExp(
            '^question-\\d+-' + slot + '$');
        var $m = $('[id^="question-"]').filter(function() {
            return re.test(this.id);
        });
        return $m.length ? $m.first() : $();
    }

    /**
     * Inject links on attempt/review pages.
     *
     * @param {Object} data Configuration data.
     */
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

    /**
     * Inject one link on attempt page.
     *
     * @param {Object} data Config data.
     * @param {string} slot Slot number.
     * @param {Object} sd Slot data.
     * @returns {boolean} True if injected.
     */
    function doAttemptSlot(data, slot, sd) {
        var url = buildUrl(
            data.configureUrl, data.cmid,
            sd.qbeid, sd.questionid, data.returnUrl);
        var $w = $('<div>')
            .addClass('sme-configure-wrapper mt-1')
            .append(createTextLink(url, data.linkText));

        var $c = findContainer(slot);
        if (!$c.length) {
            dbg('slot ' + slot + ': not found');
            return false;
        }

        // Try info panel first.
        var $info = $c.find('.info');
        if ($info.length) {
            var $edit = $info.find(
                'a[href*="editquestion"]');
            if ($edit.length) {
                $edit.first().closest('div, span, p')
                    .after($w);
                return true;
            }
            $info.append($w);
            return true;
        }

        // Before formulation.
        var $f = $c.find('.formulation');
        if ($f.length) {
            $f.before($w);
            return true;
        }

        $c.prepend($w);
        return true;
    }

    // ─── Edit page ───────────────────────────────────

    /**
     * Inject links on quiz edit page.
     *
     * @param {Object} data Configuration data.
     */
    function injectEditLinks(data) {
        var questions = data.questions || [];
        var count = 0;
        var i;

        for (i = 0; i < questions.length; i++) {
            if (doEditQuestion(data, questions[i])) {
                count++;
            }
        }
        dbg('edit: ' + count + '/' + questions.length);
    }

    /**
     * Inject one icon on edit page.
     *
     * @param {Object} data Config data.
     * @param {Object} q Question data.
     * @returns {boolean} True if injected.
     */
    function doEditQuestion(data, q) {
        var url = buildUrl(
            data.configureUrl, data.cmid,
            q.qbeid, q.questionid, data.returnUrl);
        var $icon = createIconLink(url, data.linkText);

        // Find edit link for this question.
        var $edit = $(
            'a[href*="editquestion"][href*="id='
            + q.questionid + '"]');
        if (!$edit.length) {
            $edit = $(
                'a[href*="editquestion"][href*="id='
                + q.qbeid + '"]');
        }

        if ($edit.length) {
            var $row = $edit.first().closest(
                '.activity-wrapper, .activity,'
                + ' .slot, li, [data-for="cmitem"]');
            if ($row.length) {
                var $actions = $row.find(
                    '.activity-actions, .actions,'
                    + ' .ml-auto');
                if ($actions.length) {
                    $actions.first().prepend(
                        $icon.clone(true));
                    return true;
                }
            }
            $edit.first().after($icon.clone(true));
            return true;
        }

        // Fallback: find by name.
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

    // ─── Run ─────────────────────────────────────────

    /**
     * Execute injection with loaded data.
     *
     * @param {Object} data Configuration data.
     */
    function run(data) {
        dbg('run: mode=' + data.mode);
        if (data.mode === 'attempt') {
            injectAttemptLinks(data);
        } else if (data.mode === 'edit') {
            injectEditLinks(data);
        }
    }

    return /** @alias module:local_stackmatheditor/configure_links */ {
        /**
         * Initialize. Reads data from DOM element.
         */
        init: function() {
            dbg('init');
            $(document).ready(function() {
                var data = loadData();
                if (data) {
                    run(data);
                    return;
                }
                // Single retry for race condition
                // with inline JS element creation.
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
