# Session 010 – MathQuill fork with matrix support imported

**Branch:** `development`
**Date:** 2026-09-13
**Plugin version:** 2026091510 (release 1.3.0-dev, MATURITY_ALPHA)
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


## 21. Iteration 17 (2026091316): a green job failed on its log upload

The run after iteration 16 reported `lint-php: failure`, and with it `phpunit: skipped`,
`behat: skipped`, `CI complete: failure`. The lint itself had passed:

    Checked 40 files in 0.1 seconds
    No syntax error found
    job: lint-php
    status: success

What failed was the step after it:

    Uploading artifact: error-summary-dev-lint-php.zip
    Finished uploading artifact content to blob storage!
    Finalizing artifact upload
    ##[error]Failed to FinalizeArtifact: ... (403) Forbidden

Three other jobs in the same run uploaded their summary without trouble, so this is GitHub's
artifact service, not the workflow. No code change would have fixed it, and a re-run probably
would have.

That a transient upload error can take down a job whose checks passed - and skip everything
downstream - is the part that is worth fixing. Every `actions/upload-artifact` step in all five
workflows now carries `continue-on-error: true`. The logs are a convenience for reading a
failure, never the gate.

`ci-complete` itself stays strict: it still demands `success` from every job, and it reported
this correctly.

### Verification

The five workflow files parse and every upload step is guarded (checked mechanically, not by
eye). No plugin code changed in this iteration.


## 22. Iteration 18 (2026091317): #13 — students can put the editor away

A switch above each editor. Off means: the answer goes into the original STACK input as Maxima,
and that input comes back into its normal place, where it can be typed into directly. On means:
whatever is in the input at that moment - including what was typed while the editor was away -
goes back into the editor as LaTeX, and the input returns off screen.

The preference is remembered in `localStorage`, for the site rather than per question: someone
who switches the editor off to see more of a question on a phone wants it off on the next one
too. Blocked storage (private mode) is not an error; the editor then simply starts on.

### A module of its own

`amd/src/editor_toggle.js` owns the switch and the two CSS classes and nothing else. What
"hand over" means is passed in as two callbacks, because only the caller knows whether it drives
one field or something else. The module has no dependencies - no jQuery, no MathQuill - which is
why its behaviour can be tested under jsdom rather than reasoned about.

The original input is parked with a class now instead of inline styles, and it is still parked
off screen rather than hidden: `display:none` would take it out of the accessibility tree and
move STACK's validation feedback.

### Where it is not offered

The relation-system editor (several lines with a brace) has no switch. Coming back from the
plain input would mean rebuilding the rows from the text, and if that failed, the student's
typing would be gone. Better no switch than a switch that loses an answer. The same applies to
the textarea editor, which has its own module.

### Verification

- 8 Jest cases under jsdom: the switch is a labelled `role="switch"` checkbox, switching off
  hands the answer over and reveals the input, switching on reads back what is in the input at
  that moment, the input is never removed from the page, a click drives the same path, the state
  is announced in an `aria-live` region, the choice is remembered but the initial application is
  not a choice, and blocked storage does not break anything. Suite total 958 green.
- ESLint `--max-warnings 0`, stylelint and PHPCS green.
- Not verified here: how it looks and feels in a real quiz attempt. The switch uses the
  Bootstrap classes and brings its own CSS fallback, but the visual check is yours.


## 23. Iteration 19 (2026091318): the switch for the system editor too

The previous iteration left the relation-system editor without a switch, for fear of losing an
answer on the way back. That fear was addressable, and here is how.

**Off**: `syncSystemToInput()` already writes what the lines mean as one nounand-joined answer -
`(a+2*b=5) nounand (2*a+6*b=-2)` - so handing over is exactly the existing function. The plain
input comes back into its place with that value.

**On**: the value is read back. If it is unchanged since the hand-over, the rows stay as they
are, with their cursor position. If it changed - the student typed into the plain input - the
rows are rebuilt from it with `getRelationSystemParts()`. An answer that is no longer a system
(`x=1`) becomes one row instead of nothing: no answer is thrown away, which was the whole
objection.

### One bug found by writing the test

The first application of the switch used to call the "read it back" direction as well. In the
single-line editor that only re-prefilled a field that already held the answer; in the system
editor it threw away rows that had just been built and rebuilt them from the input. Since the
initial application the editor is left alone - it was built from that very value a moment ago.
`apply(on, initial)` now only transfers when it is a real switch.

### Refactoring

`rebuildSystemRows()` and `attachSystemToggle()` are module-level functions, not nested ones:
ESLint refuses a function declaration inside a block, and `initField()` was over the complexity
limit again. Caught by `eslint --max-warnings 0` before the CI saw it, which is what iteration
16 changed.

### Verification

4 further Jest cases: off writes the nounand answer, on without a change keeps the rows, an edit
made while the editor was away is taken over, and an answer that is no longer a system is kept.
Suite total 963 green. ESLint, stylelint, PHPCS green.

Still not offered in the textarea editor, which has its own module and no line structure to
rebuild.


## 24. Iteration 20 (2026091319): the switch built editors around itself

Behat ran for the first time since the library swap, and it was worth the wait: 20 of 61
scenarios failed, all of them with the same root cause, and one that no unit test could have
found.

The DOM in the failure dump:

    <div class="sme-input-wrap"><div class="sme-toggle ...">
      <div class="sme-input-wrap"><div class="sme-toggle ...">
        <div class="sme-input-wrap"><div class="sme-toggle ...">   (and so on, 1430 times)

The editor finds its inputs with, among others, `input[id*="_ans"]`. The switch is an `<input>`
as well, and its id was built from the input it belongs to: `sme-toggle-q1:1_ans1` - which
contains `_ans`. So the switch looked like a STACK answer field, got an editor of its own, that
editor added a switch, and the `MutationObserver` from #50 kept the cycle going. Nothing was
typed into the real field any more, which is why a `latex()` came back as `"on"`: the value of a
checkbox.

Two changes, because one would have been enough and both are cheap:

* The switch ids are now counted (`sme-editor-switch-1`), never derived from the input. A Jest
  case asserts that the id cannot contain `_ans`.
* `skipField()` refuses anything inside an `.sme-input-wrap` and anything that is a checkbox,
  radio, button, submit or file input. A STACK answer is typed, not ticked.

### What this says about the test setup

Jest tests the modules, Behat tests the page. This bug lived exactly between them: every module
behaved correctly, and their combination did not. The `MutationObserver` turned a small mistake
into a runaway loop - a reminder that #50 added a mechanism that reacts to the editor's own DOM
changes.

### Verification

964 Jest cases green, ESLint `--max-warnings 0`, PHPCS green. The CI run also shows PHPUnit
green on 4.5, 5.0 and 5.2, plus JS/CSS, quality, stale files and PHP lint - Behat was the only
red job, and the 41 scenarios that passed did so with the new MathQuill build, the space
handling from #64 and the read-only rule from #50 in place.


## 25. Iteration 21 (2026091320): #66 — a button needs its CAS package too

#34 says a button must have a verified mapping. #66 adds the second condition, and it is the one
that closes the points left open by #45 and #63:

    Visible button = verified mapping AND the package is available in this question.

### The resolver

`classes/dependency_resolver.php` reads `qtype_stack_options.questionvariables` and answers one
question per group: are its packages loaded here? Three requirement types:

* `stack_core` - loaded by `stackmaxima.mac`, always satisfied. `geometry.mac` with `Distance`,
  `Angle` and `Length` is core, so the geometry group from #63 is never marked.
* `stack_contrib` - needs `stack_include_contrib("...");` in the question.
* `maxima_share` - needs `load("...");`.

Detection normalises before it matches: Maxima comments are removed first (a `load("vect")`
inside `/* ... */` is not a load), whitespace is collapsed, and both quote styles are accepted.
`load ( 'vect' )` counts, `myload("vect")` and `load("vectors")` do not.

It is feature detection and nothing else: no CAS code runs, no question variables are written,
no package is loaded. What it cannot read counts as not loaded - never the other way round.

### Where it takes effect

* `definitions.php`: the groups declare their requirements. `vector_differential` needs `vect`;
  `geometry` declares `geometry.mac` as core, so the declaration is complete rather than absent.
* `editor_injector`: a group whose packages are missing is switched off in the configuration
  that reaches the browser - per slot, per question. A student sees no button and no reason.
* `configure_form`: the author sees the group marked with `*`, with the exact line to add. The
  choice can still be saved: configure now, load the package afterwards, and the group appears on
  the next reload. Nothing about availability is persisted - the question variables are the only
  truth.

### Verification

12 new PHPUnit cases: every documented syntax variant, what must not count (comments, a longer
package name, a different function), core without a load, the instruction text per type, several
requirements as an AND, a group without requirements, the declared dependencies of the toolbar
being well formed, and the fail-safe for a question that cannot be read. PHPCS green over the
whole plugin.

### What this changes for #45 and #63

The differential operators now have two gates: an admin has to name the Maxima function
(iteration 13), and the question has to load `vect`. Both are the author's decisions, and
neither is guessed. The geometry group needs no action - `geometry.mac` is core.

### Still open

Behat for the dynamic case - add the line, reload, group appears; remove it, group disappears -
needs a live instance. And the CI matrix from #34 §CI, which would fail the build when a visible
group has no declared dependency, is not written: the PHPUnit test asserts the declarations are
well formed, but not that every group with CAS-dependent buttons has declared one. That check
needs the catalogue from #34 to exist first.


## 26. Iteration 22 (2026091321): three things found by asking where the buttons are

Ralf asked where vectors, matrices, cross and dot product, norm and det are. Answering it turned
up two defects and one genuine gap.

### The duplicate array key

Iteration 15 (#63) added a group `'geometry'` while a group of that name already existed, and
then merged the new entries into the old one as well. Two entries with the same key in one PHP
array: the later one wins, silently. The effective geometry group was the new one - points,
distance, angle - and the original symbols (overline, degree, angle, perpendicular) had
disappeared, along with the `requires` declaration from #66.

The duplicate is removed; the merged group from iteration 15 is the one that stays.

### The norm button promised something it did not deliver

`‖v‖` wrote `\left\|…\right\|`, which the converter turned into `abs(v)`. For a vector that is
not the norm, it is a different function - exactly the kind of button #34 forbids. With a
configured norm function (#45) the double bar now becomes `norm(v)`; the single bar stays
`abs(x)`, which is right. Without a configured function nothing changes, and the site has said
nothing about what its norm is called.

### det had no button at all

The conversions existed since #61 and #45 - `|A|` as a vmatrix, and `\det` in front of a matrix
environment - but no button offered them. There is one now, in the matrix group, and `det(A)`
from the keyboard is converted too: Maxima calls it `determinant()`.

### Verification

4 new Jest cases, suite at 968 green. ESLint, PHPCS green.

### Where the buttons live, for the record

| Wanted | Group | Default |
| ------ | ----- | ------- |
| Matrices, vectors (the two choosers) | Matrix operations | off |
| Vector arrow, norm, dot, cross | Vector operations | off |
| det | Matrix operations | off |
| Points, distance, angle, overline, degree | Geometry | off |
| grad, div, rot, Δ | Vector differential | off, and needs `load("vect");` |

Groups that are off by default have to be switched on in the site settings or per quiz/question.


## 27. Iteration 23 (2026091322): the groups were inside a comment

The screenshots settle the question from iteration 22. The settings page offers 14 groups, and
vectors, matrices and geometry are not among them. The reason is in `definitions.php`:

    // @codingStandardsIgnoreStart
    /*
    // 10. Physical constants.
    ...
    // 20. Statistics.
    */
    // @codingStandardsIgnoreEnd

Two block comments hold eight groups: physical constants, geometry, hyperbolic functions,
calculus operators, vectors, vector differential, matrices and statistics. They were parked
there - the same discipline as #34, features waiting for a verified mapping - and every
iteration since #45 has been editing code inside those comments without noticing. The matrix
choosers from #62, the operators from #45, the geometry entries from #63: all written, all
tested by Jest through the converter, and none of them reachable from the settings page.

A harness that evaluates `get_element_groups()` outside Moodle made it visible in one line: 14
groups instead of 22.

### What is activated now, and what is not

Four groups leave the comment: geometry, vector operations, vector differential, matrices. Each
keeps only the buttons whose mapping I could verify, which is the point of #34:

| Group | Buttons | Dropped, and why |
| --- | --- | --- |
| Geometry | P(x\|y), P(x\|y\|z), d(A,B), angle ABC, \|AB\|, overline | degree sign, bare angle, perpendicular - `90circ`, `angle` and `a perp b` are not Maxima expressions |
| Vectors | arrow, dot, norm | the cross product: LaTeX's times sign is multiplication, and a cross product needs `express(a ~ b)` from vect |
| Matrices | matrix chooser, vector chooser, det, ident, transpose | `A^T`, `A^*`, `A^†` - they became `A^(T)`, `A^(*)`, `A^(dagger)`, none of which Maxima accepts. ident and transpose are now function templates that do convert |
| Vector differential | grad, div, rot, Δ | nothing; the group is empty until an admin names the Maxima functions (#45) and is hidden without `load("vect")` (#66) |

Physical constants, hyperbolic functions, calculus operators and statistics stay in the comment:
they were not asked for, and I have not checked their mappings.

### The regression that should have existed

`definitions_test.php` now asserts that these four groups are in the catalogue and in the
settings list, and that an offered group has buttons - `vector_differential` excepted, because
there a setting decides. A group inside a comment is invisible from the outside: nothing failed,
the settings page was simply shorter than the code suggested.

### Verification

PHPCS green over the whole plugin, Jest 968 green, the group list checked with the harness: 18
groups, with the expected buttons per group.


## 28. Iteration 24 (2026091323): the last two red tests, and the README

Two CI runs, both red only in PHPUnit, and they tell the story of the last two iterations.

The earlier run (2026091321) failed three tests of `dependency_resolver_test`: the group
`vector_differential` was not in the catalogue. That was the comment-block problem, and
iteration 23 fixed it.

The later run (2026091322) fails two older tests of `definitions_test`: every group must have at
least one element, and every label must carry an example. `vector_differential` has neither -
its buttons exist only once an administrator has named the Maxima function for each of them
(#45). Both assertions now skip the groups listed in a new `CONFIGURABLE_GROUPS` constant, with
the reason in the docblock; the test from iteration 23 uses the same list instead of a local
copy.

The group stays in the catalogue although it is empty, on purpose: the settings page needs
somewhere to show that it exists, and #66 needs somewhere to say which package is missing.

### README

The feature list for 1.3 now names what has been built since 1.2 - matrices and vectors,
geometry, determinant and norm, the differential operators with their two gates, the typed
space, the on/off switch, STACK owning the implicit multiplication, identifier integrity and the
wider set of question contexts. The conversion section gains the matrix, determinant, point,
operator and space rules, and the pitfalls gain the question people will actually ask: a button
that is not there is a group switched off, a function not named, or a package not loaded.

Physical constants, hyperbolic functions, calculus operators and statistics stay commented out
as agreed - their mappings are unchecked, and #34 is clear about what that means.


## 29. Iteration 25 (2026091324): the README says what it should

The requirements section still read "mod_adaptivequiz is supported if it is installed, but not
required" - true since 1.0 and misleading since #50. No activity module is required at all; the
editor attaches itself wherever the question engine renders an editable STACK input, and the
sentence now points at the table that lists where that is.

The 1.3 feature list is rewritten the way Ralf asked: geometry, vectors, matrices, spaces,
the on/off switch, then the contexts. Vectors and matrices are separate entries now rather than
one bullet about choosers - a student looking for the norm is looking under vectors, not under
"structured input". Determinant, identity and transpose moved to the matrix entry, the norm to
the vector entry, and the CAS detail left the list: what a bullet has to say is what the button
does, not how it travels to Maxima.

Two entries are gone entirely. Identifier integrity (#58, #59, #61) is not a feature, it is the
absence of a bug. Implicit multiplication is not one either: #65 removed a setting, and what
remains is STACK doing what it always did.

Privacy keeps its own section, which now says what the API support actually does, instead of
claiming a place in a list of things a teacher can use.


## 30. Iteration 26 (2026091500): #67 - the external service authorises again

#67 is a regression of #14, and the invariant it states is the whole finding: a valid Moodle
context is not an authorisation, and a valid question id does not prove the question belongs to
the quiz that was asked about.

`classes/external/get_config.php` did `context_module::instance($cmid)` followed by
`validate_context()`, and then resolved every question id the caller sent through
`config_manager::resolve_qbeid()` - globally, against the whole question bank. Three things were
missing, and all three are now in the runtime path, in the order the review checklist demands:

1. `get_coursemodule_from_id('quiz', $cmid, 0, false, MUST_EXIST)` - a context id says nothing
   about what the module is.
2. `require_capability('mod/quiz:view', $context)` after `validate_context()` - the line #14
   settled on, back where it belongs.
3. The question ids are scoped against the quiz: `quiz_helper::load_quiz_qbeids()` returns the
   bank entries the quiz actually uses, and anything else is dropped from the answer. Fail
   closed, not resolved globally.

`load_quiz_qbeids()` is new and deliberately does not filter by question type, unlike
`load_quiz_stack_questions()`: the question here is "does this quiz use it", not "is it a STACK
question". A quiz whose slots cannot be read scopes to nothing, never to everything.

### Tests

`tests/unit/external_get_config_test.php` covers what the issue lists: an unknown question id is
dropped, a question from another quiz is not answered for while the same question through its own
quiz is, a user whose `mod/quiz:view` is prohibited gets nothing, a forum course module is
refused, a course module id that does not exist is refused, and an empty quiz scopes to nothing.

The one test that needs a question in a quiz skips itself where `quiz_add_quiz_question()` is not
available, so a future Moodle that moves that API does not turn a red test into a false finding.

### Not done in this iteration

Issues #68, #70 and #71 could not be read: GitHub's API refused with a rate limit, and only #67
and #69 came through. #69 (`MATURITY_STABLE` evidence: browser, accessibility, performance,
dependency and final artefact) is a release-process issue rather than a code change, and it needs
the four verification runs that cannot happen here.


## 31. Iteration 27 (2026091501): #71 - documentation and runtime describe the same contract

#71 (P1, stable documentation gate) lists four findings. Three are addressed here; the
fourth is a release step and cannot be done from a development branch.

### A and B: the README contradicted itself

Under "Usage & Settings" it still listed four settings, among them "Handling of implicit
multiplication", and said teachers could override "the variable mode". Two sections further down
it said, correctly, that STACK decides this and the editor has no setting for it. #65 removed
that setting in iteration 11; the README kept describing it.

The settings section now lists what `settings.php` actually registers - activation, default
groups, percent-pi, vector format, norm function, the four operator mappings, coordinate
separator, point notation and additional page types - and states plainly that implicit
multiplication is not among them.

### The guard, so it does not drift again

`tests/unit/documentation_test.php` reads `settings.php`, takes the setting names out of it and
asserts:

* every setting has a title and a description string;
* every title appears in the README;
* the README does not describe the removed setting, in any of its three old spellings;
* the strings of the removed setting are gone as well;
* the English and German packs have the same keys.

It is a cheap test and it would have caught this drift the day it appeared.

### #58: a browser regression on the real typing path

The issue is right that a converter test is not enough for this defect: it was born in MathQuill's
typing path. The existing Behat step types through `write()`, which is a different path.

A new step, `I press the keys "Umax" into the MathQuill field for "ans1"`, clicks the field and
sends real key events through Moodle's own `behat_general::i_type`. Five scenarios use it -
`Umax`, `Umin`, `argmax`, `maximum`, `sinvalue` - plus `max(x,y)` staying a function and `U_max`
keeping its subscript, in both directions. They assert the hidden STACK input and the LaTeX in
the field, which is the chain the issue describes.

### Release notes

The README has a "Release notes 1.3" section covering what the issue asks for: the new features,
the two fixes, the behaviour changes (the removed setting, the space key), what question authors
have to load or configure, and the support matrix.

### Not done here

The release step itself - `MATURITY_STABLE`, the version string, the tag and the plugin directory
metadata changed atomically - belongs to the release, not to a development iteration. So does the
formal decision on #34, #58 and #66: I can report what is implemented, but closing an issue or
accepting a residual risk is the maintainer's call.

What I can say about the three: #66's DoD is implemented and covered by tests, except the
dynamic browser check (add the line, reload, group appears). #58 now has the browser regression
the issue asks for, but it has not run yet. #34 is not finished - there is no catalogue that
assigns every visible button its verified mapping, and no CI check that fails when one is
missing. The buttons activated in iteration 23 were checked by hand, one at a time.


## 32. Iteration 28 (2026091502): #68, #69 and #70

### #68 - configuration travelled between quizzes

`config_manager` documented five lookup layers, and one of them was "any qbeid match (legacy
fallback)" - a query on `questionbankentryid` with no `cmid` at all. The same question used in
two quizzes therefore shared whatever one of them had configured, although `cmid = 0 + qbeid`
already exists as the explicit way to say "for this question everywhere".

The layer is gone from both paths. The single lookup no longer reads an unscoped qbeid record,
and the batch lookup - which had the same thing in bulk form - now starts at the global default.
Single and batch follow the same hierarchy again, which they did not before.

The other legacy layer, the one on the old `questionid` column, had the same hole and is now
scoped to `cmid = 0 OR cmid = <this quiz>`: a genuinely old record still rescues the quiz it
belongs to, and reaches no other.

Six new PHPUnit cases in `config_cross_quiz_test.php`: a configuration in quiz A does not reach
quiz B, the explicit global default does reach both, an exact configuration wins in its own quiz
only, batch and single lookup agree, the batch path inherits the global default, and a quiz
default stays in its quiz.

### #70 - the vendored library is pinned to a commit

`thirdparty/readme_moodle.txt` named a branch, which is not a pin: a rebuild of
`feature/matrix-environments` next month produces something else. It now carries the fork commit
`99c967df728178973084ebfe27577961348ffc56`, the upstream base, the toolchain (Node 22.22.2, npm
10.9.7), the build command, the import date and the SHA-256 of the three imported files, plus the
reproduction recipe that checks out the commit rather than the branch. The leftover sentence
claiming this build was `sme.1` is corrected - it is `sme.3`.

The main workflow gained a step that writes down which revisions a run actually tested against:
the plugin SHA, the Moodle branch, the HEAD of every STACK dependency it installed, and the
vendored MathQuill provenance. The branch variables stay as they are - testing against STACK
master is what catches incompatibilities early - but a run now says what it meant.

### #69 - evidence for the exact artefact

A new workflow, `release-evidence.yml`, started by hand with the commit to certify. It records
what is being certified (commit, version, maturity, vendored library with checksums), runs a
dependency audit over both lock files, builds the release archive with its checksum, and writes
the list of gates that no workflow can close - the manual accessibility sample, and the run links
for Playwright, accessibility and load on that same commit.

`docs/RELEASE-CHECKLIST.md` says the same thing in prose, including the part the issue is most
insistent about: the maturity flip is the last step, atomically with README, release notes, tag
and directory metadata, and never a mixed state.

### What I did not do

Option A of #69 - making Playwright, accessibility and load blocking jobs of the main workflow -
is a decision about how long every push should take, and it is yours. The hybrid gate is built;
turning it into a required check is a repository setting, as is branch protection for `main`
(#69 finding C), which I cannot change from here.

Nor did I close any issue or accept a residual risk. #34 in particular is not done: there is no
catalogue that maps every visible button to its verified mapping, and no CI check that fails when
one is missing.


## 33. Iteration 29 (2026091503): the issue numbers, correctly attached

The five review findings arrived as files named 01 to 05, and I wrote those numbers into code
comments and documentation. They are not issue numbers. The mapping, checked against the issue
titles on GitHub rather than against the file names:

| File | Issue | Subject | Done in |
| --- | --- | --- | --- |
| 01 | #67 | External service without capability and object scope (P0) | 2026091500 |
| 02 | #68 | Unscoped qbeid fallback mixes configuration between quizzes | 2026091502 |
| 03 | #69 | MATURITY_STABLE needs browser, a11y, performance, dependency and artefact evidence | 2026091502 |
| 04 | #70 | Stable build not reproducible: fork and CI dependencies not pinned | 2026091502 |
| 05 | #71 | README, open P1 issues and runtime semantics out of sync | 2026091501 |

Every `(#02)`, `(#03)`, `(#04)` in `config_manager.php`, `config_cross_quiz_test.php`,
`release-evidence.yml`, `moodle-plugin-ci-main.yml` and this document now reads `(#68)`, `(#69)`,
`(#70)`. #67 and #71 were already referenced correctly, the first by name from the start, the
second only in prose - `documentation_test.php` now names it too.

Three of the five mappings are confirmed by the issue title (#67, #68, #69 were readable through
the API or the page); #70 and #71 were confirmed by reading their page titles after the API rate
limit refused. No mapping rests on the file order alone.


## 34. Iteration 30 (2026091504): the CI run, and #34 gets its gate

### The run

Behat: 69 scenarios, 804 steps, all green - including the seven keyboard scenarios from #58 and
everything the toggle recursion had broken. The browser regression the documentation issue asked
for is no longer a plan, it is a result.

PHPUnit: one test red, `test_without_the_capability`. Prohibiting `mod/quiz:view` also makes the
activity inaccessible, so `require_login()` objects inside `validate_context()` before
`require_capability()` is ever reached - and the test insisted on the second exception. Both
mean the same thing, and the test now accepts either.

That exposed something worth saying out loud: a behavioural test cannot prove the capability
line is there, because the service looks correct without it. So a second test asserts the line
exists in the source and comes after `validate_context()`. That is exactly the regression #67
describes - #14 was closed with that line, and the line disappeared.

### #34 - a visible button is a promise, and now it is checked

`definitions::export_button_catalogue()` exports every button with the LaTeX it writes - no
language strings, because a contract is the template, not the label. `export_buttons.php`
regenerates the fixture, `button_fixture_test.php` fails when it is stale, and
`button_contract.test.js` takes all 116 buttons, fills the empty slots of each template with an
operand and converts it. Three assertions per button: nothing is reported as unconvertible, the
result is not empty, and no backslash survives (#39). Sixteen structural buttons are additionally
checked against their exact documented mapping.

It found a bug on the first run. The norm button wrote `\left\\|\right\\|` - a LaTeX line
break followed by a pipe, not a double bar - and it reached the CAS as `abs(\)`. I introduced
that in iteration 23 with one backslash too many, checked it by hand, and did not see it.
`button_fixture_test` now also refuses any template containing a line break.

This is the P1 that stood between the current state and stable. What the gate proves is narrow
and worth restating: every button produces a CAS-safe string, and the structural ones produce
the documented one. It does not prove the CAS agrees with the meaning - for the operators and
the geometry functions that needs a real question with the packages from #66.

Jest is at 1085 tests.


## 35. Iteration 31 (2026091505 / 1.2.2): #72 - Android Blink dropped the first characters

The issue is precise about the mechanism, and it is right. MathQuill's keyboard shim polls with
`EveryTick`, whose handler starts as `noop`. `typedText` is registered only from the keypress and
paste paths. Blink on Android delivers soft-keyboard text as `beforeinput`/`input` without a
keypress the shim can use - so the poller still held `noop`, and every character was dropped
until some other key registered it. Enter did, which is why Enter "healed" it.

### The fix, in the input layer, in both versions

`onInput()` is now a text-entry path of its own: for a non-composing insert event it registers
`typedText` with the poller. Registering rather than calling is the whole trick for
deduplication - `typedText()` empties the textarea when it inserts, so a second run on engines
that also fire the classic path finds nothing to insert. No browser detection, no synthetic key,
no new field, exactly as the issue asks.

An IME commits a whole word at once, which `typedText()` cannot do - it inserts a single
character. `compositionend` therefore commits the textarea content character by character and
leaves it empty.

* 1.3.x: fixed in the fork, `0.10.1-sme.4`, fork commit `5364d108`, rebuilt and vendored.
* 1.2.x: MathQuill 0.10.1 is a plain upstream release there and cannot take a fork. The same
  change is applied to the vendored `mathquill.js`, which makes it a modified library:
  `thirdpartylibs.xml` now says `customised=true` with version `0.10.1-sme72`, and
  `thirdparty/readme_moodle.txt` describes the patch, its reason, the SHA-256 of the patched
  file and how to re-apply it after an update. Released as 1.2.2.

### Verification

Six new Mocha cases in the fork (`test/unit/androidInput.test.js`): a character without keydown
or keypress, digits and operators, a fresh field needing no Enter first, a deletion left to the
keystroke path, the classic desktop sequence typing exactly one character, and an IME commit
arriving once. Mocha is at 822.

Both builds were then driven in a real browser - the vendored 1.3 bundle and the patched 1.2
bundle, each loaded on a blank page: typing `a`, `1`, `+` through input events alone produces
`a1+` in both, and the classic keydown/keypress/input/keyup sequence produces exactly `q`.

PHPCS green on both codebases, Jest 1085 (1.3) and 784 (1.2).

### What is not covered

A real Android device. The fix is verified against the event sequence the issue documents, not
against Gboard on a phone. The browser matrix in the issue - Chrome, Opera, Firefox, Edge, Brave
on Android - still has to be walked through by hand.


## 36. Iteration 32 (2026091506): the Playwright failure, and #73

### The e2e failure was the same drift as #71, one layer down

`settings.spec.js` timed out after two minutes on `admin: on/off`. The reason is in the helper,
not in the test: `adminSettings()` selected `s_local_stackmatheditor_variablemode`, and
`configure()` selected `variablemode` on the configuration page. #65 removed both in iteration
11. Playwright waits for a locator that will never exist, and the test dies of a timeout rather
than of a clear "element not found".

The browser suite still described a product that had not existed for twenty iterations. Fixed:
the helpers no longer touch the setting, the five-mode test became one - what is typed is what
STACK receives - and the quiz/question tests assert groups and activation, which is what they
were really about. The test that checked the removed setting is gone rather than adapted.

### #73: the student switch becomes a permission

Two things were mixed in one switch: whether the editor exists, and whether a student may put it
away. They are separate now, and the second is subordinate to the first.

* `allowstudenttoggle` as a site setting, default on, so an upgrade takes nothing away.
* `_allowStudentToggle` in the quiz and question configuration, stored like the activation, and
  only ever stored as true when the editor is on at that level.
* `config_manager::get_effective_student_toggle()` resolves it as an AND: no editor, no switch;
  the site can take it away; the quiz can; the question can; none of them can give it back.
* The configuration form shows the checkbox directly under the activation one, with
  `disabledIf` on it - the dependency is visible, and `configure.php` enforces it again when
  saving, because a disabled control is not a validation.
* The runtime receives the answer per slot and either renders the switch or does not. Not a
  disabled control: a switch that cannot be used still says there is a decision to make.
* A remembered browser preference cannot get around it. With no permission the editor stays in
  the state the author configured, whatever localStorage holds - `Preference != Permission`, as
  the issue puts it.

Tests: the full cross-level matrix from the issue as a PHPUnit table, the downstream cases
(system off / quiz on / question on, quiz off / question on), no editor means no switch, and the
upgrade default. Four Jest cases for the runtime decision, including the stored-preference case.
Jest is at 1089.

### Not done for #73

The Playwright cross-level matrix. The suite that would host it is the one that had been broken
since iteration 11, and I would rather see it green once before extending it.


## 37. Iteration 33 (2026091507): the matrix test asserted a feature nobody asked for

One PHPUnit case out of 125 failed on all three matrix jobs: case 5 of the #73 cross-level
matrix. System editor on, quiz editor off, question editor on - the issue's table says the
editor is off, the plugin says it is on.

The plugin is right, and my test was wrong to encode the table without checking. Instance modes
2 and 3 exist so that a question can decide for itself; the configuration page offers exactly
that to teachers, and it has worked that way since 1.0. #73 is about the student switch and
assumed the activation contract rather than changing it - Fall E even says so explicitly
("sofern die bestehende globale Aktivierungslogik ebenfalls als harte Obergrenze definiert
ist").

So the editor keeps its contract and the switch follows the issue. The case now asserts what
actually happens, with the reason in the docblock, and a new case covers what the issue was
really after: a quiz that switches the editor off decides for every question that says nothing.

If the activation contract should change - quiz off as a hard bound for its questions - that is
a separate feature with its own migration story, not a test fix.

### #70 recorded as a decision

No tags: the release lane keeps installing STACK from its moving branches, deliberately, and the
run writes down the revisions it tested against. `docs/RELEASE-CHECKLIST.md` now states that as
an accepted residual risk rather than leaving it looking like an oversight.


## 38. Iteration 34 (2026091508): #68 closed by measurement, #69 answered by decision

### #68

Ralf ran the two queries on his instance. No duplicates, and the second query failed with
"Unknown column 'questionid'" - his installation was created after that column was dropped, so
the legacy layer could never have fired there at all.

That is the answer, but only for one installation. `cli/diagnose_legacy_config.php` asks the
same questions anywhere: duplicates per (cmid, questionbankentryid), records of the old
questionid kind where that column still exists, and question bank entries configured in more
than one quiz - which is legitimate and was exactly the situation in which the removed layer
leaked one quiz's configuration into another. Read-only, and it says what it found rather than
what someone should do about it.

With that, #68's "historische Records migriert oder bewusst diagnostiziert" is answerable for
any installation, and answered for this one: nothing to migrate.

### #69

Two of the three things I asked for came back as decisions rather than tasks, which is fine -
they just have to be written down instead of left looking undone.

Branch protection: not wanted. A failing check stops the work and gets fixed, or knowingly does
not, but it should not block the merge mechanically. `docs/RELEASE-CHECKLIST.md` records that,
including what it costs: nothing prevents a tag on a red run, so the evidence run is the only
thing that shows a stable release was green.

The missing workflow: `release-evidence.yml` is not in the Actions list because a manually
started workflow only appears once its file is on the default branch. It was added on
`development` in 2026091502 and `main` still carries 1.2.2. It will appear after the next merge;
the checklist now says so, rather than leaving it looking broken.


## 39. Iteration 35 (2026091509): the vendored library is reproducible again

`ralferlebach/mathquill` main is now at `c1aa2e8b1ec0b0edafb965a12dd0a3be80a473bd`
("android-fix"), and it carries the keyboard shim and the six unit tests unchanged from what was
verified here.

Rebuilt from that commit with Node 22.22.2 and npm 10.9.7:

    mathquill.js      a8f0b253bf380ee2f625e71f9826fa585eece1087fa60b06bfe42a9747e3b0d5
    mathquill.min.js  19be0bd1d948c1692db5bc905a0bb18955ef51a9a486542eb60b3dfcbb07cfce
    mathquill.css     25af0d2b872ae38cb2024599787d4617dbecfb3a0228301a8b296ed60c59cb78

All three match the files this plugin ships, byte for byte. `readme_moodle.txt` now names that
commit instead of `5364d108`, which only ever existed on the machine that produced the bundle.

That was the last open point of #70 that could be closed from here: the modified runtime library
can be rebuilt from a commit that exists in the fork, and the checksums prove the rebuild lands
on the same bytes. The dependency pinning of the CI lane stays deliberately unpinned, as
recorded in the release checklist.


## 40. Iteration 36 (2026091510): cross product, the norm default, the textarea switch

### The cross product, with as few prerequisites as possible

Neither Maxima nor STACK has a cross product function. The operator is `~` from the vect
package, and it only produces a result inside `express()`. So the button writes exactly that:

    a x b                    ->  express(a ~ b)
    (a x b) x c              ->  express((express(a ~ b)) ~ c)
    column vectors           ->  express(matrix([1],[2],[3]) ~ matrix([4],[5],[6]))

One line in the question variables is the whole prerequisite, `load("vect");`, and nothing has
to be defined. The resolution runs on the finished Maxima string, where an operand is an
identifier, a number, a bracketed group or a function call, innermost first.

The button lives in a group of its own, "Vector products", which declares the vect package
through #66: where the question does not load it, the group is not rendered, and the arrow, the
dot and the norm in the neighbouring group are unaffected.

Two guards, because the times sign can also arrive from imported content: between two numbers it
stays multiplication, and a sign without an operand on one side is not turned into a call.

Worth recording, because I argued the opposite two messages earlier: STACK's `multsgn = "cross"`
option does *not* interfere. It only changes how STACK renders its own interpretation of the
answer, and the editor never reads that - a pre-fill reads the stored Maxima string. What remains
is imported LaTeX containing a times sign, which is what the two guards are for.

### The norm default follows the vector format

`stack/maxima/geometry.mac` has `Length(v)`, and it is the Euclidean norm in any dimension - but
it takes a **list** and refuses a matrix. The plugin writes vectors as matrices by default, so a
single default was wrong in one of the two cases either way. It now follows the format: `Length`
for list vectors, `norm` for matrix vectors, where the question defines it. The setting
description says so.

### The textarea editor gets the switch

The reason it was left out does not apply there: the lines of a textarea answer are separated by
newlines, so reading them back is splitting a string, not parsing one. `rebuildFrom()` does that,
and the permission from #73 is honoured per slot exactly as in the other two editors.

### Not in this iteration

Changing the size of an existing matrix through the chooser (#62 §3). The editor would have to
read the matrix under the cursor and resize it, and the fork's public API has `insertMatrix` but
nothing to inspect or resize an existing one. That is a fork change first, plugin second, and it
deserves its own iteration rather than the tail of this one.

Jest: 1097.
