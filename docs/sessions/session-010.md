# Session 010 – MathQuill fork with matrix support imported

**Branch:** `development`
**Date:** 2026-09-13
**Plugin version:** 2026091303 (release 1.3.0-dev, MATURITY_ALPHA)
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
