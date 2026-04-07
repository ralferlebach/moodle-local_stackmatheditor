This plugin includes the following third-party library:

* MathQuill
  - Location: thirdparty/mathquill
  - Version: 0.10.1
  - License: MPL-2.0
  - Upstream repository: https://github.com/mathquill/mathquill

Source
------
MathQuill was obtained from the upstream project repository:
https://github.com/mathquill/mathquill

For the version used in this plugin, see:
https://github.com/mathquill/mathquill/releases/tag/v0.10.1

Installation / update procedure
-------------------------------
The library is stored in:
local/stackmatheditor/thirdparty/mathquill

To update this library:

1. Download MathQuill version 0.10.1 from the upstream repository or release page.
2. Extract the package.
3. Copy the required distribution files into:
   local/stackmatheditor/thirdparty/mathquill
4. Remove any files not required by this plugin, such as development-only files,
   test assets, CI configuration, and repository metadata.
5. Verify that the license information for MathQuill remains included and that
   thirdpartylibs.xml is kept in sync with the imported version.

Build instructions
------------------
MathQuill is included here as a prebuilt third-party library.

No local build step is required by this Moodle plugin, provided the distributed
upstream build artifacts are imported into thirdparty/mathquill.

Notes
-----
This library is third-party code and is not covered by the plugin copyright.
Any local modifications, if made in the future, should be documented here.
At present, the thirdpartylibs.xml declaration marks this library as not customised.