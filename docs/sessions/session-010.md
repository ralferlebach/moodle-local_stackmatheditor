# Session 010 – MathQuill fork with matrix support imported

**Branch:** `development`
**Date:** 2026-09-13
**Plugin version:** 2026091306 (release 1.3.0-dev, MATURITY_ALPHA)
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
