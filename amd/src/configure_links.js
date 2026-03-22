/**
 * Injects configure links for STACK questions on quiz pages.
 *
 * On attempt/review pages: adds "Configure editor" link below
 * the "Edit question" link in the question info panel.
 *
 * On quiz edit pages: adds a calculator icon next to each
 * STACK question's action icons.
 *
 * @module     local_stackmatheditor/configure_links
 * @copyright  2026 Your Name
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
define(['jquery'], function($) {
    'use strict';

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
     * Create a link element with calculator icon and text.
     *
     * @param {string} href URL.
     * @param {string} text Link text.
     * @returns {jQuery} Link element.
     */
    function createLink(href, text) {
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
     * Create a small icon-only link for the edit page.
     *
     * @param {string} href URL.
     * @param {string} title Tooltip text.
     * @returns {jQuery} Icon link element.
     */
    function createIconLink(href, title) {
        var $icon = $('<i>')
            .addClass('fa fa-calculator')
            .attr('aria-hidden', 'true');
        var $link = $('<a>')
            .attr('href', href)
            .attr('title', title)
            .addClass('sme-configure-edit-link ml-1 mr-1')
            .css('color', '#0f6cbf')
            .append($icon);
        return $link;
    }

    /**
     * Inject links on quiz attempt/review pages.
     * Adds link below "Edit question" in the question info panel.
     *
     * @param {Object} data Configuration data.
     */
    function injectAttemptLinks(data) {
        var slots = data.slots || {};
        var slotNum;

        for (slotNum in slots) {
            if (!slots.hasOwnProperty(slotNum)) {
                continue;
            }
            injectSingleAttemptLink(data, slotNum, slots[slotNum]);
        }
    }

    /**
     * Inject a single configure link on an attempt/review page.
     *
     * @param {Object} data Configuration data.
     * @param {string} slotNum Slot number.
     * @param {Object} slotData Slot question data.
     */
    function injectSingleAttemptLink(data, slotNum, slotData) {
        var url = buildUrl(
            data.configureUrl,
            data.cmid,
            slotData.qbeid,
            slotData.questionid,
            data.returnUrl
        );

        var $link = createLink(url, data.linkText);
        var $wrapper = $('<div>')
            .addClass('sme-configure-wrapper mt-1')
            .append($link);

        // Find the question container for this slot.
        var $container = $(
            '[id^="question-' + slotNum + '-"]'
        );

        if (!$container.length) {
            return;
        }

        // Try to find the info panel.
        var $info = $container.find('.info');
        if ($info.length) {
            // Insert after "Edit question" link.
            var $editLink = $info.find(
                'a[href*="question/bank/editquestion"],'
                + ' a[href*="question.php"]'
            );
            if ($editLink.length) {
                $editLink.first().closest('div, span, p')
                    .after($wrapper);
            } else {
                $info.append($wrapper);
            }
        } else {
            // Fallback: prepend to question content area.
            $container.find('.content').first()
                .prepend($wrapper);
        }
    }

    /**
     * Inject links on quiz edit page.
     * Adds calculator icon next to edit icons for STACK questions.
     *
     * @param {Object} data Configuration data.
     */
    function injectEditLinks(data) {
        var questions = data.questions || [];
        var i;

        for (i = 0; i < questions.length; i++) {
            injectSingleEditLink(data, questions[i]);
        }
    }

    /**
     * Inject a single configure icon link for one question
     * on the quiz edit page.
     *
     * @param {Object} data Configuration data.
     * @param {Object} q Question data {questionid, qbeid, name, slot}.
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

        // Strategy 1: Find by slot number in list items.
        var $slotItem = $(
            '#slot-' + q.slot
            + ', [data-slotid][data-slot="' + q.slot + '"]'
            + ', li[id*="slot"][id*="' + q.slot + '"]'
        );

        if ($slotItem.length) {
            var $actions = $slotItem.find(
                '.mod-quiz-edit-actions,'
                + ' .editing_action,'
                + ' .action-menu,'
                + ' .actions,'
                + ' .ml-auto'
            );
            if ($actions.length) {
                $actions.first().prepend(
                    $iconLink.clone(true)
                );
                return;
            }
        }

        // Strategy 2: Find question name link.
        var $nameLinks = $(
            'a[href*="editquestion"][href*="id='
            + q.questionid + '"]'
        );
        if (!$nameLinks.length) {
            var questionName = q.name;
            $nameLinks = $('a').filter(function() {
                return $(this).text().trim() === questionName;
            });
        }

        if ($nameLinks.length) {
            $nameLinks.first().after(
                $iconLink.clone(true)
            );
        }
    }

    return /** @alias module:local_stackmatheditor/configure_links */ {
        /**
         * Initialize configure link injection.
         *
         * @param {Object} data Configuration data from PHP.
         */
        init: function(data) {
            $(document).ready(function() {
                if (data.mode === 'attempt') {
                    injectAttemptLinks(data);
                } else if (data.mode === 'edit') {
                    injectEditLinks(data);
                }
            });
        }
    };
});
