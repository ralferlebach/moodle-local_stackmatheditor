Changes
=======

All notable changes to **local_stackmatheditor**, newest first. The short version is in the
README under *Motivation for this plugin*; this file is the full record, version by version.

Version numbers follow `version.php`: the release name (`1.3.0`) and the build
(`YYYYMMDDNN`).


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

* Security: the configuration page shows and saves only questions of the quiz it is opened for. A
  user who could manage one quiz could open the preview and the input semantics of any STACK
  question on the site by changing the question id in the address (MDL Shield review,
  2026-10-08).
* The configuration link appears in the settings menu of an adaptive quiz whose question
  categories contain a STACK question. The check behind it called a method that did not exist,
  so the link never appeared.
* The diagnostic script `cli/diagnose_legacy_config.php` runs; it stopped at its first line of
  output.
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
