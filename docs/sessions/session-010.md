# Session 010 – MathQuill fork with matrix support imported

**Branch:** `development`
**Date:** 2026-09-13
**Plugin version:** 2026091315 (release 1.3.0-dev, MATURITY_ALPHA)
**Predecessor:** session-009 (#53–#56)

---

## 1. Context

Issue #40 (switching to the desmosinc fork) was rolled back in an earlier session because that
fork has no matrices either. The matrices have now been built in our own fork:

    https://github.com/ralferlebach/mathquill  branch feature/matrix-environments
    base: mathquill/mathquill main @ bb9974ab

The fork adds the six LaTeX matrix environments as editable structures, the public API
`insertMatrix` / `insertColumnVector` / `insertRowVector`, and browser test automation for the
MathQuill suites themselves. Verified there: `make`, `make lint`, `prettier --check` green,
811 Mocha tests green, 29 Playwright tests green in Chromium, Firefox and WebKit each.

## 2. What this iteration changes

Only the vendored library and its metadata. No plugin source file is touched, so `amd/build`
stays byte-identical and the grunt gate is unaffected.

- `thirdparty/mathquill/`: `mathquill.js`, `mathquill.min.js`, `mathquill.css` replaced with the
  fork build; `font/` replaced by `fonts/` (the fork's build emits the plural name and the CSS
  references it relatively). `README.md` placeholder removed.
- The basic build and the Symbola-basic fonts are not imported — `mathquill.css` does not
  reference them.
- `thirdpartylibs.xml`: version `0.10.1-sme.1`, repository is now the fork, `customised` is now
  `true`. The previous declaration claimed unmodified upstream code, which would have been wrong
  the moment the fork build landed.
- `thirdparty/readme_moodle.txt`: rewritten. Records the base commit, the fork, the build steps,
  the `-sme.N` scheme and the MPL-2.0 consequence of shipping a modified build.
- `db/removed_files.txt`: `thirdparty/mathquill/font` and the old placeholder README.
- `README.md`: third-party section names the fork.
- `version.php`: 2026091300.

## 3. Why the library swap is a smaller risk than it looks

The plugin's coupling to MathQuill's DOM is thin. Across `amd/src`, `styles.css`, Behat and
Playwright, only five MathQuill classes are used: `mq-editable-field`, `mq-container`,
`mq-root-block`, `mq-empty`, `mq-math-mode`. All exist unchanged in the fork build.

The API surface is equally small: `MQ.MathField(el, {spaceBehavesLikeTab, handlers})`,
`mq.latex()`, `mq.focus()`, `field.el()`. `getInterface(2)` still requires `window.jQuery`, which
`mathquill_init.js` already sets before loading.

What did change upstream since the 2017 release is the rendering: brackets are SVG now, not
scaled spans, and there is a spacing-bug feature detection that adds an `mq-has-spacing-bug`
class to the root block. Nothing in the plugin selects on either, but this is exactly what the
verification below has to prove.

## 4. Verification — NOT yet run

This iteration was prepared without a Moodle tree. Before it is merged, the following must run
locally and in CI:

- `make check` (PHPCS, PHPDoc, Mustache, Gherkin, PHPCPD, ESLint, AMD build, Jest, PHPUnit)
- Behat, including the CAS scenarios (`make behat-stack` first)
- Playwright: the settings page and, above all, the delivered assets over `requirejs.php` —
  a wrong font path shows up in the network panel, not in the DOM
- A manual look at a STACK input in a quiz attempt: rendering, cursor, `\,` handling (the old
  0.10.1 could not parse `\,`; the converter workaround may now be unnecessary — check before
  removing it)

Expected side effects to watch for: the extra root-block class, SVG brackets in axe runs, and
`mathquill.js` growing from 173 KB to 490 KB (the minified file, which the injector prefers, is
166 KB and thus close to the old unminified size).

## 5. Iteration 2 (2026091301): conversion rules and toolbar

### tex2max

`convertMatrixEnvironments()` converts all six environments to Maxima's `matrix()`. It runs
before the `\left` / `\right` and brace passes, matches the innermost environment first (so a
matrix inside a cell works) and leaves cell contents to the rest of the pipeline.

    \begin{bmatrix}a&b\\c&d\end{bmatrix}   ->  matrix([a,b],[c,d])
    \begin{pmatrix}x\\y\\z\end{pmatrix}    ->  matrix([x],[y],[z])
    \begin{bmatrix}\frac{1}{2}&\sqrt{x}\end{bmatrix}  ->  matrix([(1)/(2),sqrt(x)])

An empty cell is not padded with a zero — that would silently change the answer. It is reported
through the problem channel introduced for #44: `analyse()` returns an empty `maxima` and the
code `matrix_cell_empty`, which `local_validation.js` renders using the new language string. A
short row is padded structurally and reported the same way.

### max2tex

`extractMatrixCalls()` follows the integral pattern: the matrix goes into the placeholder store
so that the row and column separators survive the later passes, and every cell is converted on
its own. `matrix(a,b)` without row lists and ragged matrices are left untouched rather than
rendered as a structure they do not have.

The write-back environment is `pmatrix` (`MATRIX_ENVIRONMENT` in max2tex.js) and the toolbar
inserts the same. This keeps the pre-fill loop visually stable: a reloaded attempt looks like
what the student typed. Inserting bmatrix and writing back pmatrix would change the brackets on
every save.

### Toolbar

`toolbar.js` gains the action `matrix`, which calls MathQuill's `insertMatrix()`. A matrix is a
structure with its own API, not a LaTeX string that could go through `write`. The
`matrix_operators` group in `definitions.php` gains four buttons: 2x2, 3x3, row vector (1x3),
column vector (3x1). `definitions_test.php` accepts the new element type and checks that both
dimensions are present and are positive integers.

The Jest definitions fixture is unaffected: it only carries the conversion-relevant keys, not
`elementGroups`.

### Verification of iteration 2

- Jest: 744 tests green (711 before, 33 new). No regression.
- ESLint over `amd/src` via grunt: green.
- `grunt amd` in a real Moodle 4.5 tree: `amd/build` rebuilt for max2tex, tex2max and toolbar,
  including the source maps. They are part of this delivery.
- PHPCS, Moodle standard, errors *and* warnings, run inside the Moodle tree over `classes`,
  `lang`, `tests/unit` and `version.php`: green.
- Still outstanding: PHPUnit (needs a database), Behat, Playwright and a manual look at a real
  STACK input.

## 6. Iteration 3 (2026091302): delimiters carry meaning, and a setting for vectors

Ralf's specification, implemented as given:

| LaTeX | Maxima |
| --- | --- |
| `\begin{bmatrix}` (toolbar: matrices) | `matrix([a,b],[c,d])` |
| `\begin{pmatrix}` (toolbar: vectors) | `matrix([x],[y])` |
| `\begin{vmatrix}` or `\det` + any environment | `determinant(matrix(...))` |
| `\begin{Vmatrix}` | `norm(matrix(...))` |
| `\begin{Vmatrix}\begin{pmatrix}…` | `norm(matrix([x],[y]))` |

Write-back: matrices as `bmatrix`, vectors (1×n, n×1) as `pmatrix`, `determinant()` as `vmatrix`,
the norm function as `Vmatrix` — with the inner `pmatrix` kept for vectors and dropped for
matrices, because there the norm bars replace the brackets.

`det`, `determinant`, `norm` and `transpose` were added to the function names, so implicit
multiplication no longer splits them into single variables.

### Two settings

`vectorformat` (matrix | list, default matrix) decides whether a one-row or one-column matrix is
written as `matrix([a,b,c])` or as the list `[a,b,c]`. This is an answer-test question, not a
display question: `ATAlgEquiv` fails when a list meets a matrix. In list mode `max2tex` draws a
list as a row vector — a list has no orientation, so a column vector comes back as a row. The
setting description says so.

`normfunction` (default `norm`) is the Maxima function a norm is written to. Maxima has no norm
that covers vectors and matrices alike, so the name belongs to the question author, who defines
it in the question variables (`norm(v) := sqrt(v . v)`) and enters the same name here. Nothing
is invented behind the author's back.

### Verification of iteration 3

- Jest: 753 tests green (744 before).
- ESLint via grunt: green after one trailing-space fix; `amd/build` rebuilt and included.
- PHPCS, Moodle standard, errors and warnings, over `classes`, `lang`, `tests/unit`,
  `settings.php`, `version.php`: green.
- The Jest definitions fixture was updated for the new function names; it does not carry
  `elementGroups`, so the toolbar change does not affect it.

### Open question

`vmatrix` now means determinant. A student who wants to write "the matrix with bars" no longer
can — that is the point of the specification, but it is worth a look during the first real
question test.

## 7. Iteration 4 (2026091303): the two Behat failures from the CI run

The dev run was green everywhere except Behat: 45 of 47 scenarios passed.

### `sqrt((p^(2))/(4-q))` instead of `sqrt((p^2)/(4-q))`

A direct consequence of the MathQuill upgrade, not of the matrix work. The 2017 release wrote a
squared term as `p^2`; the current build normalises it to `p^{2}`, and tex2max turned every
`^{…}` into `^(…)`. Every squared term in every answer was therefore reaching the CAS with an
extra pair of parentheses.

The superscript rule now drops the parentheses when the exponent is a single digit group or a
single letter, and keeps them otherwise:

    p^{2}   -> p^2         x^{n+1} -> x^(n+1)
    x^{10}  -> x^10        x^{ab}  -> x^(ab)
    e^{x}   -> e^x         x^{-1}  -> x^(-1)

`x^{ab}` deliberately keeps its parentheses: `x^ab` would be split into `x^a*b` by implicit
multiplication. Seven cases were added to `conversion.test.js`.

### The capability scenario could never pass

`configure.php` answers a request without `mod/quiz:manage` with `required_capability_exception`,
which is correct and is what the scenario wanted to prove. But Moodle renders that as an
exception page, and Behat's after-step hook fails *any* step that ends on one — so the
`When I am on the … configuration page` step failed before the `Then` could assert anything. The
scenario was unrunnable as written, independently of this branch.

The check now lives in a step of its own, `… with question "nonexistent" is denied to me`: it
visits the page, asserts the permission message, asserts that "Cannot resolve the question" is
*not* there (the actual point of #54 — the capability gate comes before question resolution) and
then navigates away, so the after-step hook sees a clean page.

### Verification of iteration 4

- Jest: 760 green (753 before).
- `grunt amd`: rebuilt, included.
- PHPCS over `classes`, `lang`, `tests`, `settings.php`, `configure.php`, `version.php`: green.
- Behat itself could not be run here (no database). The gherkin change is one line; the step is
  new code and is the thing to watch in the next run.

## 8. Next steps

1. Behat for the matrix path: insert through the toolbar, fill, save, reload and check that the
   pre-filled answer is the same matrix.
2. Decide whether the `\,` workaround in the converter can go now that MathQuill is current.
3. Consider whether a 1xn matrix should convert to a Maxima list instead. It currently does not:
   `matrix([a,b,c])` keeps the matrix semantics, which is the honest reading of what the editor
   shows.


## 9. Iteration 5 (2026091304): #58, #59, #60 — identifier integrity

Applied to 1.3.0 and, identically, to 1.2.0 (released as 1.2.1, version 2026091300).

### #58 / #60 — an operator name inside a longer identifier

`Umax` reached STACK as `U max`. The cause is not the reserved-words logic — in the "leave
untouched" mode that code does not even run, as #60 established. MathQuill un-italicises an
operator name wherever it finds one inside a run of letters, so typing `Umax` yields the LaTeX
`U\max `. `markControlWords()` then put a token boundary in front of `\max`, and
`resolveBoundaries()` turned that boundary into a space, because it separates an identifier
from a following word. That rule is right for `a\sqrt{b}` (#39) and wrong here.

`mergeGluedOperatorNames()` now runs before `markControlWords()` and re-joins such a name with
the identifier it belongs to. The deciding question is whether the name is applied to anything:

    U\max                  -> Umax          one identifier (#58)
    \max imum              -> maximum       one identifier
    a\sin\left(x\right)     -> a sin(x)      unchanged, a times sin of x
    \max\left(a,b\right)    -> max(a,b)      unchanged, the function max
    a\sqrt{b}              -> a sqrt(b)     unchanged, \sqrt is not an operator name

The name list mirrors MathQuill's own defaults and is built the same way MathQuill builds it,
so it can be compared against the library when the configuration changes.

### #59 — multi-character subscripts

`max2tex` grouped only the first character after `_`, so `U_max` was drawn as `U_{m}ax`. It now
groups the whole alphanumeric suffix: `U_{max}`, `x_{12}`, `T_{amb}`.

`tex2max` collapsed `U_{m}ax` into `U_max`, which is a different expression and made the two
forms indistinguishable. A subscript group that is followed directly by more characters now
keeps a boundary marker, so the existing variable-mode logic decides what happens at that
boundary:

| LaTeX     | stack     | explicit_single | explicit_multi |
| --------- | --------- | --------------- | -------------- |
| `U_{max}` | `U_max`   | `U_max`         | `U_max`        |
| `U_{m}ax` | `U_m ax`  | `U_m*a*x`       | `U_m*ax`       |

The roundtrip `U_max -> U_{max} -> U_max` is stable and covered by tests.

### Verification

- Jest: 809 green in 1.3.0 (760 before), 760 green in 1.2.1 (711 before). The 49 new cases are
  in `tests/jest/identifiers.test.js`.
- `grunt amd` in a Moodle 4.5 tree: `tex2max` and `max2tex` rebuilt in both versions.
- PHPCS, Moodle standard: green.
- New Behat scenarios in `tests/behat/tex2max_conversion.feature` use the existing
  `tex2max output for latex ... in variableMode ...` step; every expected value in them was
  checked against the real converter, but Behat itself was not run (no database here).

### Not done deliberately

No language strings were touched, and MathQuill itself was not changed. The fix is in the
converter, which is what both versions share; 1.2.x ships MathQuill 0.10.1 and could not take a
library change anyway. The editor still *displays* `U max` in roman type while typing — the
value handed to STACK is now correct, the display is a MathQuill matter and belongs in the fork.


## 10. Iteration 6 (2026091305): #61 checked against the fixed code

#61 is the technical cross-check of #58 and comes with a full acceptance matrix. Running it
against the code from iteration 5 showed that the identifier half was already satisfied and
that one row was not: `max(x,y)`.

`max` was in no function list of the plugin — neither in `BUILTIN_FUNCTION_NAMES` in
`tex2max.js` nor in `definitions::get_function_names()`. In the multi-character modes that
produced `max*(x,y)`, in single-character mode `m*a*x*(x,y)`. `min` fared slightly better
because it is protected as a word elsewhere, but it still collected a star: `min*(x,y)`.
`max` and `min` are now registered as functions in both places, and the Jest fixture follows.

The complete matrix from #61 now holds, in all five modes:

| typed      | stack      | explicit_multi | space_multi | explicit_single | space_single |
| ---------- | ---------- | -------------- | ----------- | --------------- | ------------ |
| `max(x,y)` | `max(x,y)` | `max(x,y)`     | `max(x,y)`  | `max(x,y)`      | `max(x,y)`   |
| `Umax`     | `Umax`     | `Umax`         | `Umax`      | `U*m*a*x`       | `U m a x`    |
| `maxU`     | `maxU`     | `maxU`         | `maxU`      | `m*a*x*U`       | `m a x U`    |
| `argmax`   | `argmax`   | `argmax`       | `argmax`    | `a*r*g*m*a*x`   | `a r g m a x`|
| `maximum`  | `maximum`  | `maximum`      | `maximum`   | `m*a*x*i*m*u*m` | `m a x i m u m` |

Jest: 822 green in 1.3.0, 773 in 1.2.1. The matrix is a test table, not prose.

### Where this implementation differs from the issue's recommendation

#61 advises against repairing `U\max ` back into `Umax` afterwards, because control-word
boundaries could be damaged. The repair is what iteration 5 does, deliberately: it is the only
fix that works for 1.2.x as well, which ships MathQuill 0.10.1 and cannot take a library
change. The risk the issue names is contained by construction — only names from MathQuill's own
auto-operator list are merged, and only where the name is not applied to an argument, so
`\sqrt`, `\frac`, `\pi` and every other control word are untouched (covered by tests).

What the repair cannot fix is the display: while typing, `Umax` still shows "max" in roman
type. That is MathQuill's doing and belongs in the fork, where `autoUnItalicize()` should only
accept an operator name that spans the entire run of letters.


## 11. Iteration 7 (2026091306): what typing actually produces

The matrix in #61 lists typed words, not LaTeX. Everything so far had been tested against the
LaTeX I assumed MathQuill produces. Typing the words into a real MathQuill field in a browser
and reading `field.latex()` back confirmed the assumption for ten of eleven rows — and found one
case nobody had written down:

    typed "U_max"  ->  U_{\max}

The operator-name substitution also fires inside a subscript. The converter turned that into
`U_ max` in stack mode: the boundary marker in front of `\max` survived the subscript
replacement, and `resolveBoundaries()` made a space out of it, because the text in front,
`U_`, looks like an identifier. `U_ max` is not a valid CAS string.

Two changes:

* `mergeGluedOperatorNames()` also treats an operator name that fills a `{...}` group on its own
  as a label rather than a function, so `U_{\max}` becomes `U_max` in every mode.
* Every `MQ.MathField()` call now passes `disableAutoSubstitutionInSubscripts: true`, so the
  substitution no longer happens in the first place: typing `U_max` yields `U_{max}`. Verified
  in a browser. MathQuill 0.10.1 does not have the option and ignores it, which is why 1.2.1
  needs the converter change and gets it.

The captured browser output is now a test table in `identifiers.test.js` — the LaTeX column is
measured, not assumed.

Jest: 833 green in 1.3.0, 784 in 1.2.1.


## 12. Iteration 8 (2026091307): the display follows the value

Until now the converter repaired what MathQuill had already split: the value handed to STACK was
right, but while typing, "Umax" still showed "max" in roman type. That part cannot be fixed in
the plugin — it happens in `autoUnItalicize()`, which un-italicises an operator name wherever it
occurs inside a run of letters.

The fork now has an option for it, `autoOperatorNamesOnlyWholeWord` (default false, so the
library's own tests and any other user of the fork are unaffected). A name is recognised only
when it covers the whole run:

| typed      | option off             | option on              |
| ---------- | ---------------------- | ---------------------- |
| `max`      | `\max`                 | `\max`                 |
| `max(x,y)` | `\max\left(x,y\right)`  | `\max\left(x,y\right)`  |
| `Umax`     | `U\max`                | `Umax`                 |
| `argmax`   | `\arg\max`             | `argmax`               |
| `maximum`  | `\max imum`            | `maximum`              |
| `sinvalue` | `\sin value`           | `sinvalue`             |
| `U_max`    | `U_{\max}`             | `U_{max}`              |

This iteration imports the fork build that carries the option (`0.10.1-sme.2`) and switches it
on at all three `MQ.MathField()` call sites, next to
`disableAutoSubstitutionInSubscripts`. Measured against the vendored file in a browser, with
exactly the options the plugin passes — the table above is that measurement.

The converter merge from iteration 5 stays. It is now a safety net rather than the main fix:
answers stored before this version still contain `U\max`, and a field configured elsewhere
without the option still produces it.

1.2.1 keeps the converter-only solution. MathQuill 0.10.1 has neither option and ignores both.

### Verification

- Typed behaviour measured in a browser against `thirdparty/mathquill/mathquill.min.js`
- Jest 833 green, PHPCS green, `amd/build` rebuilt for `input_fields` and `textarea_fields`
- `thirdpartylibs.xml` and `thirdparty/readme_moodle.txt` record `0.10.1-sme.2` and what
  changed in it

### Still open

Behat and Playwright have not run here (no database). The library swap touches the editor in
every quiz attempt, so the full suite matters more than usual before this leaves `development`.


## 13. Iteration 9 (2026091308): #62 — matrix and vector input from the toolbar

The four fixed buttons from iteration 3 are gone. In their place the matrix group has two
buttons that open a chooser:

    [⋮] ▾    grid, 5 × 5, highlights the block from (1,1) to the cell under the cursor
    (a⋮b) ▾  dimension and orientation for a vector

### Structured model instead of a LaTeX string

The issue is explicit that complex structures must not be assembled as LaTeX and written into
the field. Three new modules:

* `structured_input.js` — the model. `createMatrix(rows, columns)`,
  `createVector(dimension, orientation)`, validation, the shared size limit (10, quick pick 5),
  and `toLatex()` for the cases where MathQuill has to be handed LaTeX.
* `structured_serializer.js` — model ↔ Maxima. Parsing walks the string with a bracket counter,
  not a global regular expression, because cells contain commas, brackets and nested matrices.
* `structured_popup.js` — the two choosers. Keyboard first: arrows move, Enter confirms, Escape
  closes and returns the focus to the button. The chosen size is written out as text
  (`3 × 2 matrix`) in an `aria-live` region, so it is not carried by colour alone.

`toolbar.js` gained the action `popup` and hands the model to MathQuill's structure API
(`insertMatrix` / `insertRowVector` / `insertColumnVector`). It never builds a LaTeX string.

### A vector is not a matrix

The model keeps the distinction: `{type: 'vector', orientation, elements}` against
`{type: 'matrix', rows}`. The serializer decides once what that means for the CAS —
`matrix([a],[b],[c])` for a column vector, or a list when `vectorformat` is set to `list`.
Reverse loading reads a single row or a single column back as a vector, which is what the
editor offered in the first place.

### Reverse loading and errors

`fromMaxima()` returns null for anything that is not one of these structures —
`matrix(a,b)` with list-valued variables, a ragged matrix, an unbalanced bracket. The caller
keeps the generic editor behaviour rather than discarding the answer.

### Verification

- 33 new Jest cases in `structured_input.test.js`: model, serializer, reverse loading,
  roundtrip for the four fixtures from the issue, and the popup under jsdom — arrow keys, the
  selection staying inside the grid, click, Enter, Escape, focus return, ARIA roles, language
  pack labels. Suite total 866 green.
- ESLint and the AMD build via grunt in a Moodle 4.5 tree, PHPCS green.

### Not covered by this iteration

Changing the dimensions of an existing matrix still happens through the keyboard
(`Shift-Enter`, `Shift-Spacebar`, Backspace on an empty row or column) from iteration 3, not
through a context menu. §3 of the issue allows either; a menu would be the nicer UI and is the
obvious follow-up.

Behat and Playwright have not run here. The popup is tested under jsdom, which covers the
logic but not the layout, the focus ring or the placement below the button.


## 14. Iteration 10 (2026091309): #64 — the typed space is a boundary

STACK has "insert stars" variants that read spaces: with them, `a b` and `ab` are different
inputs. The editor could not produce that difference at all, because every field was created
with `spaceBehavesLikeTab: true` — the space key navigated instead of typing. And even if it
had, `tex2max` deleted the control space with `s.replace(/\\ /g, '')`.

Both are fixed, and the editor still does not interpret the space; it passes it on.

| typed     | field.latex() | CAS string |
| --------- | ------------- | ---------- |
| `a b`     | `a\ b`        | `a b`      |
| `2 x`     | `2\ x`        | `2 x`      |
| `x y z`   | `x\ y\ z`     | `x y z`    |
| `a b+c d` | `a\ b+c\ d`   | `a b+c d`  |
| `U max`   | `U\ \max`     | `U max`    |
| `ab`      | `ab`          | `ab`       |

The LaTeX column is measured in a browser against the vendored build, with the options the
plugin passes. Tab and Shift-Tab still leave a block — checked in the same run by typing into a
fraction denominator and tabbing out.

### How the space survives

`tex2max` turns the control space into its own marker, distinct from the token boundary the
converter uses internally: a boundary may disappear, user input may not. The marker becomes a
plain space at the very end, after every pass that could have swallowed it. Typographic spacing
(`\,`, `\;`) still carries no meaning and is still dropped.

`max2tex` goes the other way, but only for a space between two operands, and only after the
keyword passes have run: before that, a space also separates `x in A` or `p and q`, and
protecting those spaces kept the keyword rules from matching. A space that belongs to a control
word (`\in A`) is left alone as well. Both mistakes were caught by the existing suite, which is
what it is for.

### Visibility

The fork got a class for the typed space (`mq-space`, build `0.10.1-sme.3`) — MathQuill renders
it as an unclassed span, which gives no stable styling hook. `styles.css` widens it slightly. No
symbol is drawn: a middle dot would mean explicit multiplication, which is a different
expression again.

### Verification

- 20 new Jest cases in `spaces.test.js`, suite total 886 green
- Typing, the class and Tab navigation measured in Chromium against
  `thirdparty/mathquill/mathquill.min.js`
- ESLint and the AMD build through grunt, PHPCS green

### What this changes for users

Space no longer jumps out of a fraction or a subscript. That was a convenience; it is now
Tab, Shift-Tab or the arrow keys. The trade is deliberate: without it, a whole family of STACK
input configurations cannot be served at all.


## 15. Iteration 11 (2026091310): #65 — STACK owns the input semantics

The editor had its own setting for implicit multiplication next to STACK's. Two settings for one
question, and the second one could contradict the first. It is gone.

* `settings.php`: the admin default `variablemode` is removed.
* `configure_form.php`: the select is replaced by a read-only section.
* `config_manager::get_instance_variable_mode()` always returns the STACK mode. Values stored by
  earlier versions are ignored rather than migrated — handing the decision back to STACK must not
  depend on an upgrade step having run.
* The four language strings of the removed setting are deleted.

### What is shown instead

`classes/stack_inputs.php` reads `qtype_stack_inputs.insertstars` — per input, because one
question can have several inputs with different settings, and the global
`qtype_stack/inputinsertstars` is only the default for new ones. The configuration page lists:

    STACK input semantics
    ans1    Don't insert stars
    ans2    Insert stars for implied multiplication only
    ans3    Insert stars assuming single-character variables, implied and for spaces

    [Edit STACK input settings]

The labels come from `qtype_stack`'s own language strings (the value map mirrors
`stack_options::get_insert_star_options()`), so a teacher reads the same words as in the
question editor, in their language. A value this plugin does not know is shown as a number
rather than guessed at.

The link appears only with the question edit capability; without it the values are still shown,
because knowing the semantics is useful even when you may not change it. The editor never writes
`qtype_stack_inputs`.

### Verification

- New `tests/unit/stack_inputs_test.php`: several inputs with different values, no inputs, the
  labels against `qtype_stack`, an unknown value, and no link without a question. The tests skip
  themselves where `qtype_stack` is not installed instead of failing.
- `config_manager_test.php` now asserts the invariant instead of the removed setting: whatever
  `variablemode` holds, the mode is STACK's.
- PHPCS green, Jest unchanged at 886.

### Interaction with #64

#64 made a typed space reach STACK unchanged. This iteration is what makes that decision
readable: a teacher configuring the toolbar now sees whether the input actually reads spaces
(`Insert stars for spaces only` and friends) — without the editor interpreting anything.

### Still open

PHPUnit did not run here (no database), so the new tests are unexecuted. The Behat and
Playwright scenarios from the issue — two inputs with different values, change in STACK, reload —
need a live instance.


## 16. Iteration 12 (2026091311): the ESLint complexity gate

The CI run after iteration 11 was green everywhere except JS/CSS:

    137:5  warning  Function 'fromMaxima' has a complexity of 25. Maximum allowed is 20
    Warning: ESLint found too many warnings (maximum: 0)

`fromMaxima()` from #62 did three jobs at once: recognise a list, read the rows of a
`matrix(...)` call, and decide which model the rows describe. It is now three functions —
`listToModel()`, `matrixCallRows()`, `rowsToModel()` — with `fromMaxima()` as four lines on top.
Behaviour is unchanged; the 33 tests of the module pass as before.

### Why this slipped through

The AMD rebuild here runs `grunt amd --force`, copied from the plugin's makefile, and `--force`
turns an ESLint failure into a printed warning that the exit code no longer reflects. The CI
runs `moodle-plugin-ci grunt --max-lint-warnings 0`, which does not forgive. Since this
iteration the local rebuild runs without `--force`, so the two agree.


## 17. Iteration 13 (2026091312): #45 — differential operators

The three buttons that existed wrote `\mathrm{grad}\,` and friends. What reached the CAS was
`gradf` — one identifier, silently wrong. `rot` would have gone to Maxima as `rot`, which is a
German label, not a function.

### The mapping is a setting, not an assumption

Maxima has no gradient, divergence or curl that works everywhere: they live in the `vect`
package, need `express()` and depend on the coordinate system, and many STACK questions define
their own. Which of these a given site has cannot be decided in this plugin, so each operator
gets a site setting holding the Maxima function name:

    diffopgradient      diffopdivergence      diffopcurl      diffoplaplacian

An empty setting means the operator does not exist here, and then **the button is not offered
at all**. If such an operator still turns up in an answer — an old one, or an import — the
converter reports `diffop_unavailable` through the problem channel and hands STACK nothing,
rather than an expression the CAS would reject.

### Label and CAS name are separate levels

| button | LaTeX | CAS (example configuration) |
| ------ | ----- | --------------------------- |
| grad   | `\operatorname{grad}(...)` | `grad(...)` |
| div    | `\operatorname{div}(...)`  | `div(...)`  |
| rot    | `\operatorname{rot}(...)`  | `curl(...)` |
| Δ      | `\Delta(...)`              | `laplacian(...)` |

A site whose curl is called `curl` still shows `rot` to a German-speaking student, and back the
other way the label returns. The operand is part of the template: the button writes the brackets
and puts the cursor inside them.

### Δ and ∇

`\Delta` is the Laplace operator only when a bracket follows it. A bare `Δ`, `Δx` or `2Δ` stays
the Greek letter — that distinction is what the issue asks for, and it is covered by tests.
`\nabla` has no button: a free nabla without an operand is notation, not an operation. It still
converts to the identifier `nabla` so that no backslash reaches the CAS (#39).

An operator without a bracketed operand — what the old buttons produced — is reported as
`diffop_operand_missing`. `grad f` is not a CAS call, and guessing where the operand ends would
be inventing semantics.

### Verification

- 33 new Jest cases: the four operators configured and unconfigured, nested and multi-variable
  operands, an operator on a vector, a site-specific name, the negative cases (free ∇, free Δ,
  `rot` without operand, `div` without vector) and the roundtrip. Suite total 919 green.
- ESLint via grunt **without `--force`** (see iteration 12), PHPCS green — which caught a
  duplicated language key before it reached CI.

### What is still unverified

The wording of the issue is "verified STACK/Maxima mapping". What this iteration provides is the
*mechanism* for a verified mapping plus the refusal to guess one. Whether `grad` exists on your
installation, whether it needs `express()`, and in which coordinate system it works, has to be
tried in a STACK question — I cannot test that here. Until an admin enters a name, the operators
stay invisible, which is the state the issue asks for.


## 18. Iteration 14 (2026091313): #50 — the editor follows STACK, not the module name

Two decisions were mixed up in one list of module names. They are separate now.

**Runtime.** Whether an editor appears is decided in the browser, against the rendered DOM: a
`qtype_stack` input that is editable gets one. The page type only decides whether the bootstrap
is loaded at all, and that list is no longer a constant in the hook class but
`context_resolver::supports_page()`, which knows the previous pages plus `mod-capquiz-*`,
`mod-studentquiz-view` and `filter-embedquestion-showquestion` — and reads further ones from a
site setting, so a new question-engine consumer needs no code change. On a page without a STACK
input, the cost is one module load.

**Configuration.** Resolving a question-bank entry, a capability and a return URL stays module
specific, and the plugin only claims it for quiz and adaptive quiz. Everywhere else the editor
runs with the site defaults instead of not running at all - which is what §5 of the issue asks
for. `lib.php` asks `has_configuration_ui()` for the settings link rather than comparing module
names.

### Two smaller things that belong to the same issue

A read-only or disabled input no longer gets an editor. It never should have: next to a
teacher-rendered answer, a MathQuill field suggests the answer could still be changed.

Questions rendered after page load — CAPQuiz and StudentQuiz replace them over AJAX — are picked
up by a `MutationObserver`, throttled to one pass per burst. The pass is idempotent through the
`data-sme-init` marker that was already there, so no input ever gets two editors.

### Verification

- New `context_resolver_test.php`: the old contexts keep working, the new ones are supported,
  unrelated pages are not, the admin setting is honoured and validated (`*`, `<script>`,
  `../etc/passwd` are ignored), and runtime and configuration are asserted to be separate
  decisions - CAPQuiz gets the editor and no configuration page.
- ESLint via grunt without `--force`, PHPCS over the whole plugin: green.
- README: the sentence about mod_quiz and mod_adaptivequiz is replaced by a matrix.

### What cannot be verified here

Everything that needs a live instance: CAPQuiz, StudentQuiz and `filter_embedquestion` with a
real STACK question, the AJAX question change, and whether the editor initialises inside the
embed iframe. The issue asks for that explicitly, and the page types are best guesses from the
respective module's URL structure - `mod-capquiz-view` may well be wrong for the version you
have. If it is, the *Additional page types* setting fixes it without a release, which is one
reason that setting exists.


## 19. Iteration 15 (2026091314): #63 — elementary geometry

School notation on the surface, STACK's `geometry.mac` underneath. The existing geometry group
in the toolbar gains five structured entries; the symbols it already had stay.

| button | editor | STACK |
| ------ | ------ | ----- |
| P(x\|y)   | `P\left(2\|3\right)` | `[2,3]` |
| P(x\|y\|z) | `P\left(2\|3\|4\right)` | `[2,3,4]` |
| d(A,B)   | `d\left(A,B\right)` | `Distance(A,B)` |
| ∠ABC     | `\angle ABC` | `Angle(A,B,C)` — B is the vertex |
| \|AB\|     | `\left\|\overline{AB}\right\|` | `Distance(A,B)` |

The point name is a label: it does not reach the CAS. The coordinate separator is a setting
(`|`, `;`, `,`) and changes notation only — STACK receives a list either way.

### What is deliberately not in this iteration

Segment, ray, line, circle and sphere have no STACK type. The issue says as much and forbids
inventing one, and it leaves the representation open ("a documented parameter representation").
Which one is right depends on what the questions compare against — a pair of points, a circle
equation, two separate values — and that is a decision for the question author, not for me. The
buttons are therefore not shipped. The same reasoning as for the differential operators in #45.

### Reverse loading and a collision worth knowing about

`Distance(A,B)` and `Angle(A,B,C)` are unambiguous and always come back as `d(A,B)` and `∠ABC`.
A bare list is not: `[2,3]` is a point in a geometry question, a vector when the vector format is
set to `list` (#62), and an ordinary list elsewhere. The editor cannot tell from the string, so
drawing lists as points is a setting and it is **off by default**. With it on, `[2,3]` shows as
`P(2|3)` and the roundtrip is stable.

### Verification

- 31 new Jest cases: points in 2D, 3D and all three separators, the name not reaching the CAS,
  ordinary brackets and function calls staying what they are, distance in both directions, the
  vertex of an angle, no degree conversion, `cos(∠ABC)` as the combination the issue describes,
  the model itself, and regression against the vector, matrix and trigonometry rubrics. Suite
  total 950 green.
- ESLint via grunt without `--force`, PHPCS over the whole plugin: green.

### Still open

`geometry.mac` has to be loaded for `Distance` and `Angle` to exist in a question. Whether that
happens automatically in your STACK version, and whether the GeoGebra binding passes points in
exactly this form, needs a real question — as with #45, the editor produces the documented call
and does not check the CAS.


## 20. Iteration 16 (2026091315): the CI run after #63

Two jobs red, both from iteration 14 and 15, both from the same kind of gap between what I run
here and what the CI runs.

### PHPUnit: a debugging message counts as a failure

`stack_inputs::get_edit_url()` asked `question_has_capability_on()` about a question id that does
not exist. Moodle answers that with a `debugging()` message, and in a PHPUnit run an unexpected
debugging message fails the test — two of them, on all three Moodle versions.

The fix is better production behaviour as well: the question is looked up first, and a missing
one means no link, without troubling the question engine. The test now asserts
`assertDebuggingNotCalled()`, so the message cannot come back unnoticed.

This was the first CI run in which the tests from #65 could fail at all. They ran green in the
previous run because iteration 11 had not reached that runner yet.

### ESLint: warnings, not errors

    max2tex.js  1204:50  Unnecessary escape character: \[     no-useless-escape
    input_fields.js 449  'initField' has a complexity of 23   complexity

Both are warnings, and my local `grunt amd` tolerates warnings — the CI passes
`--max-lint-warnings 0` to moodle-plugin-ci, which does not. Iteration 12 had already drawn the
conclusion to drop `--force`; that was not enough, because `--force` and the warning threshold
are two different things. The check that matches the CI is:

    npx eslint --max-warnings 0 local/stackmatheditor/amd/src/*.js

Note that `npx grunt amd --max-lint-warnings 0` is *not* it: grunt reads the 0 as a task name,
reports "Task 0 not found" and exits non-zero for a reason that has nothing to do with the code.
That is what I ran at first, and it looked like a real failure.

The escape in the character class was simply superfluous. The complexity came from the read-only
check that #50 added to `initField()`; the guard clauses now live in `skipField()`, which reads
better anyway.

### Verification

Jest 950 green, PHPCS over the whole plugin green, `eslint --max-warnings 0` green.
