moodle-local_stackmatheditor
============================

[![Moodle Plugin CI](https://github.com/ralferlebach/moodle-local_stackmatheditor/actions/workflows/moodle-plugin-ci-main.yml/badge.svg?branch=main)](https://github.com/ralferlebach/moodle-local_stackmatheditor/actions/workflows/moodle-plugin-ci-main.yml?query=branch%3Amain)
[![MDL Shield](https://img.shields.io/endpoint?url=https%3A%2F%2Fmdlshield.com%2Fapi%2Fbadge%2Flocal_stackmatheditor)](https://mdlshield.com/dashboard/plugins/local_stackmatheditor)

STACK Math Editor replaces the plain text answer inputs of **STACK** questions with a visual
**MathQuill** formula editor and a configurable toolbar. Students write mathematics as they would
on paper; the plugin converts it into the Maxima syntax STACK expects – and back again, so saved
answers reappear as formulas.


Requirements
------------

This plugin requires Moodle 4.5+ and PHP 8.2+. The CI covers Moodle 4.5 to 5.2 with PHP 8.2 to 8.4.

It also requires **qtype_stack** (STACK 4.13 or later) together with the plugins STACK depends on:
qbehaviour_adaptivemultipart, qbehaviour_dfexplicitvaildate, qbehaviour_dfcbmexplicitvaildate and
qbank_importasversion. STACK needs a working Maxima installation (Maxima 5.46 or later).

mod_adaptivequiz is supported if it is installed, but not required.


Motivation for this plugin
--------------------------

STACK assesses mathematical answers with a computer algebra system, but students have to type them
in a linear syntax such as `(x^2+1)/sqrt(2*x)`. For many learners, especially at school level and at
the start of their studies, this syntax is a barrier of its own: answers are marked wrong or invalid
because of brackets and stars, not because of mathematics.

This plugin lets students enter fractions, roots, powers, sets, logic and Greek letters visually,
while STACK keeps receiving exactly the syntax it needs. Teachers decide per site, per quiz and per
question which toolbar groups are offered.


Features
--------

### Version 1.0

* Visual MathQuill editor for STACK answer inputs in quiz attempts, quiz review and question preview.
* Automatic LaTeX → Maxima conversion (tex2max) and Maxima → LaTeX for pre-filling saved answers (max2tex).
* Configurable toolbar groups: basic arithmetic, powers and roots, exponential/logarithm, comparison
  operators, absolute value, set theory, logic, brackets, mathematical constants, trigonometry,
  Greek letters (lowercase and uppercase).
* Five modes for implicit multiplication (see "How this plugin works").
* Configuration per site, per quiz and per question, including an optional question preview.
* English and German language packs.

### Version 1.1

* Support for small and mobile displays by automatic line breaks of long button rows.
* Plus/minus and minus/plus buttons.

### Version 1.2

* Multi-line editor for STACK's textarea and equivalence-reasoning inputs, including equation
  systems within a line; empty lines can be edited as a real line.
* Mathematically correct conversion of roots, plus/minus, set theory, logic and Greek letters into
  syntax STACK accepts (see "How this plugin works").
* Check and Submit always send exactly what the editor shows, even directly after the last key.
* Documented integration events for external scripts (see "Integration events").
* Configuration pages return to the page they were opened from.

### Planned

* Structured integral editor serialising to `integrate(expr, x[, a, b])` (issue #44).
* Structured derivative editor serialising to `diff(expr, x[, n], ...)` (issue #46).



Installation
------------

Install the plugin like any other plugin to folder
/local/stackmatheditor

See https://docs.moodle.org/en/Installing_plugins for details on installing Moodle plugins.


Usage & Settings
----------------

After installing the plugin, it is active with its default settings: STACK questions in quizzes show
the visual editor.

To configure the plugin and its behaviour, please visit:
Site administration -> Plugins -> Local plugins -> STACK MathQuill Editor

There, you find four settings:

* **Plugin activation (instance-wide)** – completely disabled, completely enabled, or off / on by
  default with an override per quiz or question.
* **Handling of implicit multiplication (default)** – the default variable mode (see below).
* **Use percent-pi notation for π** – send π as `%pi` instead of `pi`.
* **Default toolbar groups** – the groups offered unless a quiz or question says otherwise.

Teachers who may manage a quiz can override the toolbar groups, the variable mode and – depending
on the activation setting – the activation itself:

* for the whole quiz, via the quiz's "More" menu -> "Set up STACK MathQuill Editor";
* for a single STACK question, via the configuration icon next to the question on the quiz edit
  page or in the question info box of an attempt.

The configuration page shows quiz and question name (with version) and a collapsible preview of the
question. "Back" returns to exactly the page the configuration was opened from.

If you want to learn more about using local plugins in Moodle, please see
https://docs.moodle.org/en/Local_plugins.


Capabilities
------------

This plugin does not add any additional capabilities.

Configuring a quiz or question requires `mod/quiz:manage` (for mod_adaptivequiz:
`mod/adaptivequiz:viewreport`, as that module has no manage capability).


Scheduled Tasks
---------------

This plugin does not add any additional scheduled tasks.


How this plugin works / Pitfalls
--------------------------------

### The chain

The original STACK input stays in the page (moved off-screen, never removed), so STACK, Moodle and
other scripts keep working with it. The editor converts every change and writes the result into
that input:

    MathQuill (LaTeX) -> tex2max -> original STACK input -> STACK / Maxima
    saved answer -> max2tex -> MathQuill

Supported STACK input types: algebraic, units, textarea and equivalence reasoning.
Supported pages: quiz attempt and review, question preview, and mod_adaptivequiz.

### Implicit multiplication

| Mode | `2ab` becomes |
|---|---|
| explicit multiplication, single-character variables | `2*a*b` |
| explicit multiplication, multi-character variables | `2*ab` |
| spaces, single-character variables | `2 a b` |
| spaces, multi-character variables | `2 ab` |
| leave untouched, let STACK handle it ("star options") | `2ab` |

Function names (sqrt, sin, log, …), constants and Greek letter names are never split.

### Conversion rules worth knowing

* **Roots** always become `sqrt(...)` and never touch neighbouring symbols.
* **Plus/minus** becomes a solution set: `x = ±2` → `(x=2) nounor (x=-2)`; `∓` is the mirror image;
  several signs are coupled (exactly two alternatives).
* **Equation systems** join their rows with `nounand`. STACK assesses each part of a `nounor` /
  `nounand` structure separately.
* **Logic buttons** write `and` / `or` / `not` / `implies` – STACK judges the statement as a whole.
  `⇐` becomes a swapped implication, `⇔` the conjunction of both implications.
* **Set theory** uses STACK's functions: `x ∈ A ∪ B` → `elementp(x,union(A,B))`; ⊆ → `subsetp`,
  ⊂/⊃ are proper subsets/supersets; a chain `A ⊃ B ⊂ C` means `A ⊃ B and B ⊂ C`.
* **Greek letters** use STACK's own convention, the letter's name (`\alpha` ↔ `alpha`); variant
  glyphs map to their letter; the uppercase buttons that look like Latin letters write the Latin
  letter (STACK does not distinguish them either).

### Pitfalls

* **Empty lines** can be edited in the multi-line editor, but STACK itself drops them when an
  answer is saved; after a reload they are gone.
* A plain logical `or` is never turned back into `±` – only STACK's `nounor` is.
* Answers saved by versions before 1.2 with `and` between system rows or `or` between ±
  alternatives are displayed as logical `∧` / `∨` and keep that meaning when edited.


Greek letters
-------------

* `\alpha` becomes `alpha`, `\Lambda` becomes `Lambda`, and back again. STACK accepts every Greek
  name as a student variable and typesets it as the Greek glyph, so teacher answers written as
  `alpha` match.
* Variant glyphs have no identity of their own in STACK and map to their letter: `\varepsilon` →
  `epsilon`, `\vartheta` → `theta`, `\varphi` → `phi` (they come back as the standard glyph).
* `\pi` becomes `pi` (or `%pi`, depending on the setting).
* `lambda` in front of a bracket is always written as a product (`lambda*(x)`), because
  `lambda(...)` is Maxima's anonymous-function constructor.
* Latin letters typed as a Greek name (a-l-p-h-a) form that name, which STACK – like the editor on
  the way back – shows as α.


Integration events
------------------

The editor is an input surface, not an event gateway: it never cancels, replaces or isolates
Moodle's or STACK's own events. External scripts (learning or mentoring tools) should listen to
the **original STACK input** and to the documented `stackmatheditor:*` events below. They must
not depend on the internal `.sme-*` DOM structure, which may change without notice.

All events are `CustomEvent`s that bubble; `event.detail.source` is `'local_stackmatheditor'`.

| Event | Dispatched on | When | `detail` |
|---|---|---|---|
| `stackmatheditor:input` | original STACK input | after the editor wrote a changed value (the native `input` and `change` events fire right before it, once each) | `name`, `value` |
| `stackmatheditor:enter` | original STACK input | Enter in the visible editor, and the "+" buttons that add a line or row | `name`, `trigger` (`'key'` or `'button'`), `inputType`, `slot` (textarea/equiv) |
| `stackmatheditor:beforecheck` | STACK's Check button | click on Check, after every editor wrote its visible state | `name` (button name) |
| `stackmatheditor:beforesubmit` | the form | form submission, after every editor wrote its visible state | `submitter` (name of the submitting button, if any) |

Additionally, every Enter signal is mirrored as a non-bubbling `keydown`/`keyup` with
`key: 'Enter'` (`keyCode`/`which` 13) on the original input, for scripts that listen directly on
that field. The mirror does not bubble, so document-level delegation still sees exactly one Enter:
the real key event of the visible editor. Synthetic key events are untrusted and never submit a
form.

A Check click raises `beforecheck` followed by `beforesubmit`, then the native submission runs
unchanged, exactly once.

```javascript
const input = document.querySelector('textarea[name$="_ans1"]');
input.addEventListener('stackmatheditor:enter', (e) => {
    // e.detail.trigger is 'key' or 'button'.
});
document.addEventListener('stackmatheditor:beforecheck', () => {
    // The original STACK inputs already hold the visible editor state here.
});
```


Theme support
-------------

This plugin is developed and tested on Moodle Core's Boost theme.
It should also work with Boost child themes, including Moodle Core's Classic theme. However, we can't support any other theme than Boost.


Plugin repositories
-------------------

This plugin is not yet published in the Moodle plugins repository; publication is planned with
version 1.2. The plugin is checked by MDL Shield (see the badge above).

The latest development version can be found on Github:
https://github.com/ralferlebach/moodle-local_stackmatheditor


Bug and problem reports / Support requests
------------------------------------------

This plugin is carefully developed and thoroughly tested, but bugs and problems can always appear.

Please report bugs and problems on Github:
https://github.com/ralferlebach/moodle-local_stackmatheditor/issues

We will do our best to solve your problems, but please note that due to limited resources we can't always provide per-case support.


Feature proposals
-----------------

Due to limited resources, the functionality of this plugin is primarily implemented for our own local needs and published as-is to the community. We are aware that members of the community will have other needs and would love to see them solved by this plugin.

Please issue feature proposals on Github:
https://github.com/ralferlebach/moodle-local_stackmatheditor/issues

Please create pull requests on Github:
https://github.com/ralferlebach/moodle-local_stackmatheditor/pulls

We are always interested to read about your feature proposals or even get a pull request from you, but please accept that we can handle your issues only as feature _proposals_ and not as feature _requests_.


Development
-----------

The development environment, the quality gates and the CI pipelines are described in
`docs/ENTWICKLUNGSUMGEBUNG.md` (German); the test suites (PHPUnit, Behat, Jest, Playwright,
k6, JMeter) in `tests/README.md`. Neither is part of the release package.


Moodle release support
----------------------

Due to limited resources, this plugin is only maintained for the most recent major release of Moodle as well as the most recent LTS release of Moodle. Bugfixes are backported to the LTS release. However, new features and improvements are not necessarily backported to the LTS release.

Apart from these maintained releases, previous versions of this plugin which work in legacy major releases of Moodle are still available as-is without any further updates in the Moodle Plugins repository.

There may be several weeks after a new major release of Moodle has been published until we can do a compatibility check and fix problems if necessary. If you encounter problems with a new major release of Moodle - or can confirm that this plugin still works with a new major release - please let us know on Github.

This plugin is designed to be compatible with all currently supported versions of Moodle, leveraging its latest APIs. However, if you are using a legacy version of Moodle, we kindly advise against installing or using this plugin. Instead, we strongly recommend updating your Moodle instance to a supported version to ensure security and compliance with current technological standards. Thank you for your understanding.


Translating this plugin
-----------------------

This Moodle plugin is provided with English and German language packs only. Translations into other languages must be managed through AMOS (https://lang.moodle.org), where they will become part of Moodle's official language pack.

As the plugin creator, we continue to maintain the German translation. For all other languages, we kindly ask you to contribute your translations directly in AMOS. These contributions will be reviewed by Moodle's official language pack maintainers before being included in the official repository.

Thank you for supporting the global Moodle community!


Right-to-left support
---------------------

This plugin has not been tested with Moodle's support for right-to-left (RTL) languages.
If you want to use this plugin with a RTL language and it doesn't work as-is, you are free to send us a pull request on Github with modifications.


Privacy
-------

The plugin stores toolbar configurations per quiz and question, together with the user who last
modified them (see the privacy metadata). It stores no data about students or their answers –
answers remain in STACK.


Third-party libraries
---------------------

MathQuill 0.10.1 (https://mathquill.com), Mozilla Public License 2.0 – see `thirdpartylibs.xml`.


Maintainers
-----------

The plugin is maintained by\
Ralf Erlebach


Copyright
---------

The copyright of this plugin is held by\
Ralf Erlebach

Individual copyrights of individual developers are tracked in PHPDoc comments and Git commits.

This program is free software: you can redistribute it and/or modify it under the terms of the
GNU General Public License as published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
