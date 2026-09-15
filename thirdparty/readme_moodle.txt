This plugin includes the following third-party library:

* MathQuill
  - Location: thirdparty/mathquill
  - Version: 0.10.1 with one local patch (see below)
  - License: MPL-2.0
  - Upstream repository: https://github.com/mathquill/mathquill

Source
------
MathQuill was obtained from the upstream project repository:
https://github.com/mathquill/mathquill

For the version used in this plugin, see:
https://github.com/mathquill/mathquill/releases/tag/v0.10.1

Local patch (local_stackmatheditor #72)
---------------------------------------
mathquill.js carries one change against the upstream 0.10.1 release, in the
keyboard shim (saneKeyboardEvents):

  Blink on Android delivers soft-keyboard text as input events without a
  keypress. The shim registers its typedText handler only from the keypress
  and paste paths, so the first characters were dropped until some other key
  - Enter, typically - happened to register it. The patch makes the input
  event its own text-entry path, and handles an IME commit on compositionend
  character by character.

  Registering the handler rather than calling it directly is what keeps the
  patch safe where the classic path also runs: typedText() empties the
  textarea when it inserts, so a second run finds nothing to insert. No
  browser detection is involved.

  Search for "local_stackmatheditor #72" in thirdparty/mathquill/mathquill.js
  to find the change. 1.3.x carries the same fix in the MathQuill fork it
  ships, so this patch is a 1.2.x-only measure.

  SHA-256 of the patched file:
    mathquill.js  ad2df51a09d57c3dd6e8e3c139c9fae74befbef0b19ef1e29e8cb23efebc21f1

Re-applying the patch after an update:
  Take the upstream 0.10.1 mathquill.js, find the line that binds
  'keydown keypress input keyup focusout paste' and add the two handlers
  described above after it.

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