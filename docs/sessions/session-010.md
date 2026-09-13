# Session 010 – MathQuill fork with matrix support imported

**Branch:** `development`
**Date:** 2026-09-13
**Plugin version:** 2026091300 (release 1.3.0-dev, MATURITY_ALPHA)
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

## 5. Next steps (not in this iteration)

1. tex2max / max2tex: `\begin{bmatrix}a&b\\c&d\end{bmatrix}` ↔ `matrix([a,b],[c,d])`, vectors as
   n×1 / 1×n, with Jest roundtrip tables and Behat where MathQuill normalises.
   `convertCasesToAndRelations` in `tex2max.js` is the pattern to follow.
2. Toolbar: the `matrix_operators` group currently only has 𝟙, Aᵀ, A*, A†. Matrix insertion needs
   a new element type — the existing buttons all go through `write` with a LaTeX string, which is
   the wrong mechanism for a structure that has a dedicated API.
3. Decide whether the `\,` workaround in the converter can go.
