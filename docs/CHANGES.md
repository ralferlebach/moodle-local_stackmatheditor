Changes
=======

All notable changes to **local_stackmatheditor**, newest first. The short version is in the
README under *Motivation for this plugin*; this file is the full record, version by version.

Version numbers follow `version.php`: the release name (`1.4.0`) and the build
(`YYYYMMDDNN`).


1.4.0 (2026100801) - stable
----------------------------

1.3.0 (build 2026100700) was published on 7 October 2026. 1.4.0 adds the security, privacy,
lifecycle, backup and data integrity fixes below, found in the reviews of 8 October 2026. A
build 2026100800 with these fixes under the release name 1.3.0 existed for testing only.

### Fixed

* Security: the configuration page shows and saves only questions of the quiz it is opened for. A
  user who could manage one quiz could open the preview and the input semantics of any STACK
  question on the site by changing the question id in the address (MDL Shield review,
  2026-10-08).
* The configuration link appears in the settings menu of an adaptive quiz whose question
  categories contain a STACK question. The check behind it called a method that did not exist,
  so the link never appeared.
* The diagnostic script `cli/diagnose_legacy_config.php` runs; it stopped at its first line of
  output.
* Deleting a quiz or a course deletes its editor configurations. They used to stay behind with the
  "last modified by" reference, out of reach of privacy requests. Rows left over from earlier
  builds are reported in the user's own context for export and deletion, and
  `cli/repair_config.php` removes them.
* Configuring an adaptive quiz requires `moodle/course:manageactivities`, a write capability. The
  report capability `mod/adaptivequiz:viewreport` used before let a role that may only see reports
  change the configuration. Navigation, edit-page links and the configuration page share one check.
* Backup, restore, import and duplication of a quiz keep its editor configuration, mapped onto the
  new activity and the restored questions. It used to fall back to the defaults.
* The privacy export names the scope of a configuration in the language of the export, next to a
  stable key. The editor switch, the matrix and vector choosers and the resize confirmation have
  no English fallback text any more: their strings come from the language pack only.
* Moodle 5.3 dark colour mode: toolbar, editor fields, switch and choosers take their colours from
  the theme instead of fixed light ones, and the question preview on the configuration page opens
  with Bootstrap 5's attribute. Moodle 4.5 looks as before.
* After a fast drag of a JSXGraph slider the editor shows the value the input ends on. It could
  stay one step behind, because values arriving within the same tick as the previous one were
  ignored.
* A toolbar group that is wider on its own than a very narrow editor breaks inside instead of
  reaching out of the toolbar.
* A toolbar group that fits on a line stays on one line at every editor width. Its separator
  took a few pixels of the line, so at some widths - which ones depended on the fonts - a group
  of five broke apart although its buttons fitted. The separator now sits in the gap between the
  groups and takes no room. A cluster of a large group that is wider than a very narrow toolbar
  breaks inside instead of reaching out of it.
* Right-to-left pages (Hebrew, Arabic, Persian): formula, button symbols and the rows and columns of
  the matrix chooser stay left to right - labels like ∂²/∂x∂y or ∠ABC were rearranged by the
  page direction and the grid was mirrored. The choosers open under their button on the side the
  page reads from, and STACK's hidden input no longer sits outside the window on the right. The
  toolbar itself follows the page.
* A soft keyboard that announces each character with an "Unidentified" key (keyCode 229) no longer
  loses its input. MathQuill 0.10.1-sme.6 ignores only Chrome's Ctrl-Shift-U Unicode entry, which
  the old guard was meant for.
* Two teachers saving the same quiz or question at the same moment no longer leave two
  configurations behind. The database itself now holds one configuration per quiz, question and
  quiz default: the quiz default is stored with question bank entry 0 instead of an empty value,
  and (activity, question bank entry) is a unique index. Writes of one scope are additionally
  serialised by a lock, so a second writer waits instead of failing.
* Conversion (#96): a fraction argument may nest to any depth (`\frac{1}{\sqrt{x_{1}}}` was
  reported as unparsed); the converter's own function names (matrix, determinant, ident,
  transpose, the geometry functions, the norm and the differential operators) are never split
  into single letters; what follows a closed `^{…}` or `_{…}` group is a new factor
  (`x^{2}3` is not `x^23`); max2tex braces every longer exponent and nests power chains
  (`x^y^z` → `x^{y^{z}}`).
* `x^2\frac{1}{2}` is x² times one half. The digits of an exponent, a subscript, a decimal or an
  identifier in front of a fraction were read as the integer part of a mixed number (`x^(2+1/2)`).
* Every template button leaves the cursor in its first slot (fraction, power, roots, overline,
  vector arrow, segment length). Typing after a click went behind the template.
* The norm button writes a norm. It wrote `\left\|…\right\|`, which MathQuill drops without a
  trace; it now writes `\left\lVert…\right\rVert`, and both spellings become the configured norm
  function.
* `rot(F)` reaches STACK as the configured curl. MathQuill keeps `\operatorname{rot}` only as the
  letters "rot"; where the site has a CAS name for curl, those letters applied to a bracket are
  the operator.
* `50%` reaches STACK as `50/100`. STACK has no `%` operator and rejected every answer with a
  percent sign. A typed Maxima constant (`%pi`, `%e`, `%i`, `%phi`, `%gamma`) keeps its sign.

* Leibniz notation with the operand in the numerator is a derivative: `\frac{\partial f}{\partial x}`
  reaches STACK as `diff(f,x)` (also with an order and mixed), not as `(del f)/(del x)` (#46).
* `\nabla` and `\partial` stay one word in the single-letter modes (`nabla`, not `n*a*b*l*a`).
* `mod(7,3)` is a function call in every mode; the explicit modes wrote `mod (7,3)` (#42).
* An equation system is string-stable over TeX → Maxima → TeX → Maxima in stack mode as well:
  the alignment mark left a space behind the relation (`a= 5`) (#42).
* Where the site has no Laplace operator, Δ in front of a bracket is the Greek letter. It was
  reported as an unavailable operator and the answer was emptied, so `Δ(x+1)` could not be
  entered at all (#45).
* A line added with the "Add line" button or with Enter in a multi-line input reaches STACK at
  once, as typing does; before, only when the attempt was submitted (#23).

### Behaviour changes

* The approximately-equal button (≈) is gone. Maxima has no such operator, and STACK rejected
  every answer that contained it. Pasted LaTeX with `\approx` is still converted as before
  (`~=`), and STACK still rejects it.

### For question authors

* The question configuration lists, per STACK input, the function names the enabled buttons write
  that the input does not allow yet (Distance, Angle, the norm function, the configured
  differential operators). STACK accepts them from students only when they are under "Allowed
  words"; without that, every answer that uses such a button is rejected as an unknown function.
* Known limits, pinned in `tests/fixtures/math_contracts.json` so that a fix shows up as a failing
  test: STACK's CAS validation evaluates Distance and Angle with the bare point names the geometry
  templates produce and stops with "expects its arguments to be lists"; the cross product needs
  the vect package, which STACK cannot preload for a student answer; MathQuill turns a pasted thin
  space `\,` into a comma (the toolbar templates do not write one).
* STACK's textarea input drops empty rows when it reads an answer: the editor keeps an empty
  line between two others and the attempt stores it, but after a reload the answer has the lines
  STACK kept (#41, pinned in `tests/playwright/multiline.spec.js`).

### Tests (#96)

* Behat runs 6 scenarios instead of 92 (preflight, one STACK end-to-end smoke, four configuration
  page scenarios) and only in the cells 4.5/8.2/PostgreSQL and 5.3/8.4/MariaDB 11.4. The other
  86 scenario instances moved to Jest, to PHPUnit against a real STACK and Maxima, and to
  Playwright; `docs/TEST-MIGRATION.md` maps every one of them. Locally the Behat run takes
  79 seconds instead of 20 - 33 minutes per cell, without CAS resets or cache purges between the
  scenarios.
* Every Behat run writes per-scenario timings (`SME_BEHAT_TIMINGS`, `.github/behat-timings.py`)
  into the job summary and an artefact.
* New browser tests for the equivalence reasoning input (`equiv.spec.js`, quiz
  `SME_EQUIV_CMID` from `stack_equiv.xml`), systems, the remove buttons and the numbering in the
  multi-line editor, Enter in a single-line editor and keyboard navigation in a matrix.
* `tests/fixtures/math_contracts.json` holds one contract per button and per former CAS scenario;
  it is checked through tex2max, through MathQuill and through STACK's validation and Maxima. The
  CAS part is required in the main CI (`SME_REQUIRE_CAS=1`).

### For administrators

* The upgrade removes configurations of deleted activities and duplicate configurations once,
  converts the quiz defaults to question bank entry 0 and makes the scope index unique. Nothing a
  site shows changes: of duplicates, the configuration every page read before is kept.
* `cli/repair_config.php` reports and removes configurations of deleted activities; on an
  upgraded site it finds no duplicates, the database no longer allows them.
* A restore of a backup made with an earlier version reads its quiz defaults, which carry no
  question bank entry, as the quiz default.


1.3.0 (2026100700) - stable
----------------------------

### New

* Structured matrices and vectors, entered through choosers rather than by writing LaTeX.
* Elementary geometry in school notation: points, distance, angle, length of a segment.
* Determinant, identity matrix, transpose, and a norm that becomes the Maxima function the site
  names.
* Vector differential operators, per-site configurable and package-aware.
* Toolbar groups declare the CAS packages they need. A group whose packages the question does not
  load is not rendered for students; the configuration page says which line to add.
* A typed space reaches STACK as a space.
* Students can switch the editor off and back on; the answer travels with it. Site, quiz and
  question decide whether they may: any level can take the permission away, none can give it back.
* The editor attaches to any editable STACK input the question engine renders.
* A cross product button writes `express(a ~ b)`; the question only has to load `vect`.
* Matrix and vector choosers work with mouse, finger and pen, and with the cursor in an existing
  matrix they change its size. The largest size is configurable per site, quiz and question.
* The toolbar follows the width of the editor rather than the window, and a group of up to five
  buttons is never torn apart.
* A script that writes into the STACK input - a JSXGraph slider, for example - is picked up by the
  editor at once.

### Fixed

* Nested structures survive the conversion in both directions: a root inside a root, a function
  inside itself, absolute values and binomial coefficients within one another, at any depth. What
  cannot be converted is reported instead of being passed on as a plausible-looking but different
  expression.
* Coordinates may be expressions: `P(f(x)|g(x))` reaches STACK as a list, as `P(2|3)` always did.
* With "off by default, can be enabled per quiz or question", a question switched on in a quiz that
  stays off gets its editor. The page used to decide for the whole quiz before the question could.
* A question configuration made in one quiz no longer appears in another quiz using the same
  question; only the explicit global default crosses quizzes.
* On Android Chrome and Opera, a freshly focused field accepts the first soft-keyboard character
  immediately. It used to drop everything until Enter had been pressed once.
* `Umax` reaches STACK as `Umax`, not as `U max`, and `U_max` keeps its whole subscript in both
  directions.
* The external service authorises: the course module has to be a quiz, the user has to be allowed
  to view it, and a question id only answers for questions that quiz actually uses.

### Behaviour changes

* The editor's own setting for implicit multiplication is gone. STACK's "Insert stars" per input
  is the only source; stored values of the old setting are ignored.
* Space no longer moves the cursor out of a fraction or a subscript - that is Tab, Shift-Tab or
  the arrow keys.

### For question authors

* `Distance`, `Angle` and `Length` come from STACK's `geometry.mac` and are always available.
* `grad`, `div`, `rot` and Δ need `load("vect");` in the question variables, and an administrator
  has to name the Maxima function for each of them. Without both, the buttons are not offered.
* A norm is written to the function named in the settings. The default follows the vector
  format: STACK's own `Length` for list vectors, `norm` for matrix vectors - define that one in the
  question variables, for example `norm(v) := sqrt(v . v)`.
* The cross product needs `load("vect");` and nothing else.

### Support matrix

* Moodle 4.5 to 5.3, PHP 8.2 to 8.4, STACK 4.13 or later, Maxima 5.46 or later. Moodle 5.3
  itself needs PHP 8.3, PostgreSQL 17 or MariaDB 11.4.

### Verified on devices

* Android, Chrome and Firefox, in portrait and in landscape: soft-keyboard input, the toolbar and
  the choosers without findings (6 October 2026).

### Everything in 1.3 at a glance

* The toolbar follows the width of the editor rather than of the browser window: opening
  Moodle's navigation drawer rewraps it, closing the drawer expands it again, and a group of up
  to five buttons is never torn apart.
* Android Chrome and Opera: the first characters typed on the soft keyboard no longer disappear
  until Enter has been pressed once.
* Elementary geometry in school notation: `P(2|3)`, `d(A,B)`, `∠ABC` and the length of a segment.
  The coordinate separator is a setting and changes the notation, not the meaning.
* Vector calculus: a chooser for dimension and orientation - one drag decides both, sideways for
  a row and downwards for a column, and the buttons remain for keyboard use - plus arrow, dot
  product and norm.
* Matrix calculus: a grid chooser for rows and columns - drag with mouse, finger or pen, or use
  the arrow keys, and the page does not scroll under an active selection - plus determinant,
  identity and transpose. With the cursor in a matrix the chooser opens on its current size and
  changes it. The largest size on offer is configurable per site, quiz and question.
* Vector differential operators (grad, div, rot, Δ). Each button appears only where an
  administrator has named the Maxima function for it and the question loads the package it needs.
* A typed space reaches STACK as a space - `a b` and `ab` are different answers to a
  space-sensitive input. Space no longer jumps out of a fraction; that is Tab or the arrow keys.
* The original STACK input stays the integration point in both directions: a script that writes
  into it - STACK's JSXGraph sliders, for example - is picked up by the visible editor at once,
  and an edit in the editor still reaches that script.
* Students can switch the editor off and back on. The answer travels with it, in either
  direction, including in the multi-line editor. Whether they may is decided by the site, the
  quiz and the question: any level can take the permission away, none can give it back.
* The editor attaches to any editable STACK input the question engine renders - quiz, adaptive
  quiz, question preview, CAPQuiz, StudentQuiz, embedded questions - and to questions that arrive
  after page load. Read-only inputs keep their plain rendering.

1.2.2 (2026091500) - stable
----------------------------

### Fixed

* Android Chrome and Opera: the first characters typed on the soft keyboard no longer disappear
  until Enter has been pressed once. The vendored MathQuill 0.10.1 carries a one-line patch for
  it; 1.3 has the same fix in its MathQuill fork.


1.2.1 (2026091302) - stable
----------------------------

### Fixed

* Identifiers that contain the name of a function keep their meaning: `Umax` is one variable,
  not `U max`, and `U_max` keeps its whole subscript in both directions.
* `max(x,y)` and `min(x,y)` are recognised as function calls in every implicit-multiplication
  mode.


1.2
---

* Set theory: element, union, intersection, difference, (proper) subset and superset, entered
  visually and handed to STACK in its own set functions.
* Integral calculus: definite and indefinite integrals as a structured template (limits,
  integrand, integration variable).
* Differential calculus: first, higher and mixed partial derivatives as structured templates.


1.1
---

* Support for small and mobile displays by automatic line breaks of long button rows.
* Plus/minus and minus/plus buttons.


1.0
---

* Visual MathQuill editor for STACK answer inputs in quiz attempts, quiz review and question preview.
* Automatic LaTeX → Maxima conversion (tex2max) and Maxima → LaTeX for pre-filling saved answers (max2tex).
* Configurable toolbar groups: basic arithmetic, powers and roots, exponential/logarithm, comparison
  operators, absolute value, logic, brackets, mathematical constants, trigonometry,
  Greek letters (lowercase and uppercase).
* Implicit multiplication is STACK's decision: its "Insert stars" setting per input is the only
  source, and the configuration page shows it read-only with a link into the question.
* Configuration per site, per quiz and per question, including an optional question preview.
* English and German language packs.
