/**
 * Injects configure links for STACK questions on quiz pages.
 *
 * Data is read from a JSON script element (#sme-configure-data)
 * to avoid the 1024-char limit of js_call_amd() arguments.
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
     * Load configuration data from JSON script element.
     *
     * @returns {Object|null} Data or null if not found.
     */
    function loadData() {
        var el = document.getElementById('sme-configure-data');
        if (!el) {
            dbg('data element not found, retrying...');
            return null;
        }
        try {
            return JSON.parse(el.textContent);
        } catch (e) {
            dbg('data parse error: ' + e.message);
            return null;
        }
    }

    /**
     * Build a configure URL with return parameter.
     *
     * @param {string} baseUrl Configure page base URL.
     * @param {number} cmid Course module ID.
     * @param {number} qbeid Question bank entry ID.
     * @param {number} questionid Question ID.
     * @param {string} returnUrl Return URL.
     * @returns {string} Full URL.
     */
    function buildUrl(baseUrl, cmid, qbeid, questionid, returnUrl) {
        var url = baseUrl
            + '?cmid=' + encodeURIComponent(cmid);
        if (qbeid) {
            url += '&qbeid=' + encodeURIComponent(qbeid);
        }
        if (questionid) {
            url += '&questionid='
                + encodeURIComponent(questionid);
        }
        if (returnUrl) {
            url += '&returnurl='
                + encodeURIComponent(returnUrl);
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
        var $icon = $('<i>')
            .addClass('fa fa-calculator')
            .attr('aria-hidden', 'true');
        var $link = $('<a>')
            .attr('href', href)
            .attr('title', text)
            .addClass('sme-configure-link')
            .append($icon)
            .append(' ' + text);
        return $link;
    }

    /**
     * Create a small icon-only link.
     *
     * @param {string} href URL.
     * @param {string} title Tooltip text.
     * @returns {jQuery} Icon link element.
     */
    function createIconLink(href, title) {
        var $icon = $('<i>')
            .addClass('fa fa-calculator fa-fw')
            .attr('aria-hidden', 'true');
        var $link = $('<a>')
            .attr('href', href)
            .attr('title', title)
            .addClass('sme-configure-edit-link ml-1 mr-1')
            .css({
                'color': '#0f6cbf',
                'font-size': '1em',
                'text-decoration': 'none'
            })
            .append($icon);
        return $link;
    }

    // ──────────────────────────────────────────────────
    //  Attempt/review page
    // ──────────────────────────────────────────────────

    /**
     * Find question container for a slot on attempt page.
     *
     * @param {string} slotNum Slot number.
     * @returns {jQuery} Container or empty jQuery.
     */
    function findQuestionContainer(slotNum) {
        var $container = $('[id$="-' + slotNum + '"].que');
        if ($container.length) {
            dbg('  container via .que[id$=-'
                + slotNum + ']');
            return $container.first();
        }

        $container = $('input[name*=":' + slotNum + '_"]')
            .closest('.que');
        if ($container.length) {
            dbg('  container via input name');
            return $container.first();
        }

        var regex = new RegExp(
            '^question-\\d+-' + slotNum + '$');
        var matched = $('[id^="question-"]').filter(function() {
            return regex.test(this.id);
        });
        if (matched.length) {
            dbg('  container via regex id='
                + matched.first().attr('id'));
            return matched.first();
        }

        dbg('  available containers:');
        $('[id^="question-"]').each(function() {
            dbg('    id=' + this.id);
        });

        return $();
    }

    /**
     * Inject links on attempt/review pages.
     *
     * @param {Object} data Configuration data.
     */
    function injectAttemptLinks(data) {
        var slots = data.slots || {};
        var slotNum;
        var count = 0;

        for (slotNum in slots) {
            if (!slots.hasOwnProperty(slotNum)) {
                continue;
            }
            if (injectSingleAttemptLink(
                data, slotNum, slots[slotNum])) {
                count++;
            }
        }
        dbg('attempt: injected ' + count + ' links');
    }

    /**
     * Inject one link on attempt/review page.
     *
     * @param {Object} data Configuration data.
     * @param {string} slotNum Slot number.
     * @param {Object} slotData Question data.
     * @returns {boolean} True if injected.
     */
    function injectSingleAttemptLink(data, slotNum, slotData) {
        var url = buildUrl(
            data.configureUrl,
            data.cmid,
            slotData.qbeid,
            slotData.questionid,
            data.returnUrl
        );

        var $link = createTextLink(url, data.linkText);
        var $wrapper = $('<div>')
            .addClass('sme-configure-wrapper mt-1')
            .append($link);

        var $container = findQuestionContainer(slotNum);

        if (!$container.length) {
            dbg('attempt slot ' + slotNum
                + ': container not found');
            return false;
        }

        dbg('attempt slot ' + slotNum
            + ': id=' + $container.attr('id'));

        var $info = $container.find('.info');
        if ($info.length) {
            var $editLink = $info.find(
                'a[href*="editquestion"],'
                + ' a[href*="question.php"]'
            );
            if ($editLink.length) {
                $editLink.first()
                    .closest('div, span, p')
                    .after($wrapper);
                dbg('attempt slot ' + slotNum
                    + ': after edit link');
                return true;
            }
            $info.append($wrapper);
            dbg('attempt slot ' + slotNum
                + ': appended to info');
            return true;
        }

        var $formulation = $container.find('.formulation');
        if ($formulation.length) {
            $formulation.before($wrapper);
            dbg('attempt slot ' + slotNum
                + ': before formulation');
            return true;
        }

        var $anyEdit = $container.find(
            'a[href*="editquestion"]');
        if ($anyEdit.length) {
            $anyEdit.first().after($wrapper);
            dbg('attempt slot ' + slotNum
                + ': after editquestion');
            return true;
        }

        $container.prepend($wrapper);
        dbg('attempt slot ' + slotNum
            + ': prepended to container');
        return true;
    }

    // ──────────────────────────────────────────────────
    //  Edit page
    // ──────────────────────────────────────────────────

    /**
     * Inject links on quiz edit page.
     *
     * @param {Object} data Configuration data.
     */
    function injectEditLinks(data) {
        var questions = data.questions || [];
        var i;
        var count = 0;

        dbg('edit: injecting ' + questions.length + ' links');

        for (i = 0; i < questions.length; i++) {
            if (injectSingleEditLink(data, questions[i])) {
                count++;
            }
        }
        dbg('edit: injected ' + count + '/'
            + questions.length);
    }

    /**
     * Inject one icon on quiz edit page.
     *
     * @param {Object} data Configuration data.
     * @param {Object} q Question data.
     * @returns {boolean} True if injected.
     */
    function injectSingleEditLink(data, q) {
        var url = buildUrl(
            data.configureUrl,
            data.cmid,
            q.qbeid,
            q.questionid,
            data.returnUrl
        );
        var $iconLink = createIconLink(url, data.linkText);

        dbg('edit q=' + q.questionid
            + ' name="' + q.name
            + '" slot=' + q.slot);

        if (strategyEditLink(q, $iconLink)) {
            return true;
        }
        if (strategyQuestionName(q, $iconLink)) {
            return true;
        }
        if (strategySlotContainer(q, $iconLink)) {
            return true;
        }

        dbg('  FAILED: no injection point');
        return false;
    }

    /**
     * Strategy 1: Find edit-question link by question ID.
     *
     * @param {Object} q Question data.
     * @param {jQuery} $iconLink Icon link.
     * @returns {boolean} True if injected.
     */
    function strategyEditLink(q, $iconLink) {
        var $editLinks = $(
            'a[href*="editquestion"][href*="id='
            + q.questionid + '"]'
        );
        if (!$editLinks.length) {
            $editLinks = $(
                'a[href*="editquestion"][href*="id='
                + q.qbeid + '"]'
            );
        }
        if (!$editLinks.length) {
            dbg('  strategy1: no edit link');
            return false;
        }

        var $link = $editLinks.first();
        var $row = $link.closest(
            '[data-for="cmitem"],'
            + ' [data-for="slot"],'
            + ' .activity-wrapper,'
            + ' .slot,'
            + ' .activity,'
            + ' li'
        );

        if ($row.length) {
            var $actions = $row.find(
                '.activity-actions,'
                + ' .actions,'
                + ' .mod-quiz-edit-actions,'
                + ' .ml-auto'
            );
            if ($actions.length) {
                $actions.first().prepend(
                    $iconLink.clone(true));
                dbg('  strategy1: in actions area');
                return true;
            }
        }

        $link.after($iconLink.clone(true));
        dbg('  strategy1: after edit link');
        return true;
    }

    /**
     * Strategy 2: Find by question name text.
     *
     * @param {Object} q Question data.
     * @param {jQuery} $iconLink Icon link.
     * @returns {boolean} True if injected.
     */
    function strategyQuestionName(q, $iconLink) {
        var questionName = q.name;
        var $matchedLinks = $('a').filter(function() {
            var text = $(this).text().trim();
            return text === questionName
                || text.indexOf(questionName) === 0;
        });

        if (!$matchedLinks.length) {
            dbg('  strategy2: no name match "'
                + questionName + '"');
            return false;
        }

        var $link = $matchedLinks.first();
        var $row = $link.closest(
            '[data-for="cmitem"],'
            + ' [data-for="slot"],'
            + ' .activity-wrapper,'
            + ' .slot,'
            + ' .activity,'
            + ' li,'
            + ' div.d-flex'
        );

        if ($row.length) {
            var $actions = $row.find(
                '.activity-actions,'
                + ' .actions,'
                + ' .ml-auto'
            );
            if ($actions.length) {
                $actions.first().prepend(
                    $iconLink.clone(true));
                dbg('  strategy2: in actions');
                return true;
            }
        }

        $link.after($iconLink.clone(true));
        dbg('  strategy2: after name link');
        return true;
    }

    /**
     * Strategy 3: Find slot container by data attributes.
     *
     * @param {Object} q Question data.
     * @param {jQuery} $iconLink Icon link.
     * @returns {boolean} True if injected.
     */
    function strategySlotContainer(q, $iconLink) {
        var selectors = [
            '[data-slot-number="' + q.slot + '"]',
            '[data-slotid="' + q.slot + '"]',
            '[data-slot="' + q.slot + '"]',
            '#slot-' + q.slot
        ];
        var i;
        var $container;

        for (i = 0; i < selectors.length; i++) {
            $container = $(selectors[i]);
            if ($container.length) {
                dbg('  strategy3: via "'
                    + selectors[i] + '"');
                var $actions = $container.find(
                    '.activity-actions,'
                    + ' .actions,'
                    + ' .ml-auto'
                );
                if ($actions.length) {
                    $actions.first().prepend(
                        $iconLink.clone(true));
                    dbg('  strategy3: in actions');
                    return true;
                }
                $container.append(
                    $iconLink.clone(true));
                dbg('  strategy3: appended');
                return true;
            }
        }

        dbg('  strategy3: no container');
        return false;
    }

    /**
     * Run injection with data.
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
         * Initialize configure link injection.
         * Reads data from #sme-configure-data JSON element.
         */
        init: function() {
            dbg('init called');

            $(document).ready(function() {
                dbg('DOM ready');

                // Data element may not exist yet if
                // js_amd_inline runs after this module.
                var data = loadData();
                if (data) {
                    run(data);
                    return;
                }

                // Retry with short delay.
                var retries = 0;
                var maxRetries = 20;
                var interval = setInterval(function() {
                    retries++;
                    data = loadData();
                    if (data) {
                        clearInterval(interval);
                        run(data);
                        return;
                    }
                    if (retries >= maxRetries) {
                        clearInterval(interval);
                        dbg('gave up waiting for data');
                    }
                }, 100);
            });
        }
    };
});
