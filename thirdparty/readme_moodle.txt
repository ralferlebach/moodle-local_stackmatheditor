This plugin includes the following third-party library:

* MathQuill
  - Location: thirdparty/mathquill
  - Version: 0.10.1-sme.4
  - License: MPL-2.0
  - Upstream repository: https://github.com/mathquill/mathquill
  - Fork used here:      https://github.com/ralferlebach/mathquill

Source
------
MathQuill is included here as a build of a fork, not as an upstream release.

  Base:   mathquill/mathquill, branch main, commit bb9974ab
          (the build banner still reads "v0.10.1"; upstream has not tagged a
          release since 2017, so the banner is not a usable version marker.)
  Fork:   ralferlebach/mathquill
  Fork commit: c1aa2e8b1ec0b0edafb965a12dd0a3be80a473bd
          (branch feature/matrix-environments - informative only; the commit is
           what identifies this build, a branch moves)
  Change: editable LaTeX matrix environments (matrix, pmatrix, bmatrix,
          Bmatrix, vmatrix, Vmatrix), the public API insertMatrix /
          insertColumnVector / insertRowVector, the configuration option
          autoOperatorNamesOnlyWholeWord, and the browser test automation
          around them.

  sme.4:  makes the input event its own text-entry path (#72). Blink on
          Android delivers soft-keyboard text without a keypress, so the
          shim had never registered its typedText handler and dropped the
          first characters until Enter was pressed. An IME commit is handled
          on compositionend, character by character.

  sme.3:  gives the typed space the class mq-space, so a space the user
          entered can be made visible (#64). Without a class there is no
          stable hook: MathQuill renders it as an unclassed span with a
          non-breaking space.

  sme.2:  adds autoOperatorNamesOnlyWholeWord. With it, MathQuill accepts an
          operator name only when it covers the whole run of letters, so
          typing "Umax" stays one identifier instead of becoming U \max
          (#58, #61). The option defaults to false upstream; this plugin
          switches it on for every editable field.

The version string 0.10.1-sme.4 identifies this build; -sme.N is incremented
whenever a new fork build is imported.

Build provenance of 0.10.1-sme.4
--------------------------------
  Upstream repository: https://github.com/mathquill/mathquill
  Upstream base:       bb9974ab
  Fork repository:     https://github.com/ralferlebach/mathquill
  Fork commit:         c1aa2e8b1ec0b0edafb965a12dd0a3be80a473bd
  Branch:              feature/matrix-environments (informative only)
  Built with:          Node 22.22.2, npm 10.9.7
  Build command:       npm ci && make
  Imported:            2026-09-15
  Verified:            rebuilt from this commit; the three files below match byte for byte
  License:             MPL-2.0

  SHA-256 of the imported runtime files:
    mathquill.js      a8f0b253bf380ee2f625e71f9826fa585eece1087fa60b06bfe42a9747e3b0d5
    mathquill.min.js  19be0bd1d948c1692db5bc905a0bb18955ef51a9a486542eb60b3dfcbb07cfce
    mathquill.css     25af0d2b872ae38cb2024599787d4617dbecfb3a0228301a8b296ed60c59cb78

  Reproduce with:
    git clone https://github.com/ralferlebach/mathquill
    cd mathquill
    git checkout c1aa2e8b1ec0b0edafb965a12dd0a3be80a473bd
    npm ci
    make

  Not with "git checkout feature/matrix-environments": a branch name is not a
  release pin, and a later build of it can produce different artefacts.

MPL-2.0 requires modified files to be identifiable as modified. The
modification is not applied to the distributed build by hand: it lives in the
fork's source tree, and the fork's history is the record of what was changed.

Installation / update procedure
-------------------------------
The library is stored in:
local/stackmatheditor/thirdparty/mathquill

To update this library:

1. Check out the fork and build it:

     git clone https://github.com/ralferlebach/mathquill
     cd mathquill && npm ci && make

2. Note the exact commit you built (git rev-parse HEAD) - it belongs in this
   file. Then copy from the fork's build/ directory into
   local/stackmatheditor/thirdparty/mathquill:

     mathquill.js
     mathquill.min.js
     mathquill.css
     fonts/Symbola.{eot,svg,ttf,woff,woff2}

   The basic build (mathquill-basic.*) and the Symbola-basic fonts are not
   used by this plugin and are not imported.

3. Raise the -sme.N suffix here and in thirdpartylibs.xml.
4. Run the plugin's own test suites: a MathQuill upgrade changes the DOM the
   Behat and Playwright selectors depend on.

Note on the font directory
--------------------------
The fork's build emits fonts/ (plural); releases up to 0.10.1 used font/.
mathquill.css references fonts/ relatively, so the directory name must not be
changed on import.

Notes
-----
This library is third-party code and is not covered by the plugin copyright,
with the exception of the matrix support contributed by the plugin author to
the fork, which is likewise MPL-2.0.
