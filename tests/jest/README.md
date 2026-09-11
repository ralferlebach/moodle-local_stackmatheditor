# local_stackmatheditor — Jest unit tests

Unit tests for the pure conversion logic in `amd/src` (`tex2max.js`, `max2tex.js`). They run in
Node without Moodle, which makes them the fastest place for roundtrip test tables.

`amd_loader.js` evaluates the **source** module with a stub `define()` and hands it the
dependencies you pass explicitly; an undeclared dependency fails loudly instead of receiving
`undefined`.

```bash
make jest            # from the plugin root; runs npm ci on first use
# or
cd tests/jest && npm ci && npm test
```

The package lives here, not in the plugin root, on purpose: a `package.json` in the plugin root
makes moodle-plugin-ci run an additional `npm install` inside the plugin during every install.
