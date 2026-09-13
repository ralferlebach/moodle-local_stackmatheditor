This plugin includes the following third-party library:

* MathQuill
  - Location: thirdparty/mathquill
  - Version: 0.10.1-sme.1
  - License: MPL-2.0
  - Upstream repository: https://github.com/mathquill/mathquill
  - Fork used here:      https://github.com/ralferlebach/mathquill

Source
------
MathQuill is included here as a build of a fork, not as an upstream release.

  Base:   mathquill/mathquill, branch main, commit bb9974ab
          (the build banner still reads "v0.10.1"; upstream has not tagged a
          release since 2017, so the banner is not a usable version marker.)
  Fork:   ralferlebach/mathquill, branch feature/matrix-environments
  Change: editable LaTeX matrix environments (matrix, pmatrix, bmatrix,
          Bmatrix, vmatrix, Vmatrix), the public API insertMatrix /
          insertColumnVector / insertRowVector, and the browser test
          automation around them.

The version string 0.10.1-sme.1 identifies this build; -sme.N is incremented
whenever a new fork build is imported.

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

2. Copy from the fork's build/ directory into
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
