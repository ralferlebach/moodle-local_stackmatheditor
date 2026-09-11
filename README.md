# STACK Math Editor ##

STACK Math Editor is a Moodle local plugin that adds a visual **MathQuill-based formula editor** to STACK question answer inputs in quiz attempts, quiz review, and STACK question preview contexts.

The plugin injects a configurable toolbar for mathematical input, supports **LaTeX-style entry**, and converts the entered expressions into a form suitable for **STACK / Maxima** processing. It also provides **instance-level defaults** and **per-question configuration** for the available toolbar groups and variable handling.

## Key features ##

### Version 1.0 ###
- Adds a visual MathQuill editor to STACK answer inputs in supported quiz and preview pages.
- Supports **automatic LaTeX-to-Maxima conversion** for common mathematical notation.
- Provides configurable toolbar groups such as fractions, powers, roots, trigonometry, logarithms, constants, comparison operators, parentheses, calculus symbols, Greek letters, and matrices.
- Supports configurable **variable modes** with instance defaults and question-specific overrides.
- Adds a dedicated configuration UI for individual STACK questions inside a quiz context.
- English and German language packs at the moment

### Version 1.1 ###
- support of **small an mobile displays** by automatic linebreaks of long blocks of buttons
- added plus/minus and minus/plus functionality

### Version 1.2 ###
- Square roots, set-theory and logic operators are converted to syntax STACK accepts (`sqrt`, `elementp`, `union`, `subsetp`, … ; `and`/`or` for logic).
- Plus/minus becomes a solution set (`nounor`), equation systems are joined with `nounand`, and both are read back losslessly.
- Check and Submit always send exactly what the editor shows.
- Documented integration events for external scripts (see "Integration events").

## Requirements ##

- Moodle **4.5 or later**
- recent **qtype_stack** installed
- a Moodle quiz context containing STACK questions for per-question configuration

## Installation via uploaded ZIP file ##

1. Log in to your Moodle site as an admin and go to _Site administration > Plugins > Install plugins_.
2. Upload the ZIP file with the plugin code.
3. Confirm that Moodle detects the plugin as `local_stackmatheditor`.
4. Complete the installation.
5. Visit _Site administration > Notifications_ if Moodle prompts you to finish the upgrade.

## Installing manually ##

The plugin can also be installed by placing the contents of this directory into

    {your/moodle/dirroot}/local/stackmatheditor

Afterwards, log in to your Moodle site as an admin and go to _Site administration > Notifications_ to complete the installation.

Alternatively, you can run

    $ php admin/cli/upgrade.php

to complete the installation from the command line.


## Configuration ##

This plugin works with mod_quiz and mod_adaptivequiz.

### Global settings ###

Global plugin settings are available at

_Site administration > Plugins > Local plugins > STACK Math Editor_

The plugin currently provides at least these site-wide settings:

- **Enable / disable plugin**
- Default **variable mode**
- Default enabled **toolbar groups**

### Configuration ###

The plugin also supports question-specific configuration for STACK questions in a quiz context.

A dedicated configuration page is available at:

- the question page in a quiz (for STACK questions)
- at the attempt pages in the question info boxes (for STACK questions)
- additionally it may be manually retrieved by the following URL
  /local/stackmatheditor/configure.php?cmid=<CourseModuleID>&qbeid=<QuestinBankEntryID>  

Depending on the calling context, the plugin resolves the question bank entry automatically and lets authorized users configure:

- the enabled toolbar groups for the question
- the variable mode for that question

The configuration form also shows the quiz name, question name including version, and a collapsible question preview.

## Greek letters ##

The editor uses STACK's own convention for Greek letters: the **letter's name**. `\alpha` becomes
`alpha`, `\Lambda` becomes `Lambda`, and back again. STACK accepts every Greek name as a student
variable and typesets it as the Greek glyph, so teacher answers written as `alpha` match.

- Variant glyphs have no identity of their own in STACK and map to their letter: `\varepsilon` →
  `epsilon`, `\vartheta` → `theta`, `\varphi` → `phi` (they come back as the standard glyph).
- `\pi` becomes `pi` (or `%pi`, depending on the global setting).
- Uppercase letters that look like Latin letters (Alpha, Beta, Epsilon, …) are not Greek in STACK
  and are not offered; the eleven distinct ones (Γ Δ Θ Λ Ξ Π Σ Υ Φ Ψ Ω) are.
- `lambda` in front of a bracket is always written as a product (`lambda*(x)`), because
  `lambda(...)` is Maxima's anonymous-function constructor.
- Latin letters typed as a Greek name (a-l-p-h-a) form that name, which STACK – like the editor on
  the way back – shows as α. STACK itself does not distinguish the two, so neither does the editor.
  In single-letter modes Greek names are protected from being split into letters.

## Integration events (for external scripts) ##

The editor is an input surface, not an event gateway: it never cancels, replaces or isolates
Moodle's or STACK's own events. External scripts (learning or mentoring tools) should listen to
the **original STACK input** and to the documented `stackmatheditor:*` events below. They must
not depend on the internal `.sme-*` DOM structure, which may change without notice.

All events are `CustomEvent`s that bubble; `event.detail.source` is `'local_stackmatheditor'`.

| Event | Dispatched on | When | `detail` |
|---|---|---|---|
| `stackmatheditor:input` | original STACK input | after the editor wrote a changed value (the native `input` and `change` events fire right before it, once each) | `name`, `value` |
| `stackmatheditor:enter` | original STACK input | Enter in the visible editor, and the "+" buttons that add a row | `name`, `trigger` (`'key'` or `'button'`), `inputType`, `slot` (textarea/equiv) |
| `stackmatheditor:beforecheck` | STACK's Check button | click on Check, after every editor wrote its visible state | `name` (button name) |
| `stackmatheditor:beforesubmit` | the form | form submission, after every editor wrote its visible state | `submitter` (name of the submitting button, if any) |

Additionally, every Enter signal is mirrored as a non-bubbling `keydown`/`keyup` with
`key: 'Enter'` (`keyCode`/`which` 13) on the original input, for scripts that listen directly on
that field. The mirror does not bubble, so document-level delegation still sees exactly one Enter:
the real key event of the visible editor. Synthetic key events are untrusted and never submit a
form.

A Check click raises `beforecheck` followed by `beforesubmit`, then the native submission runs
unchanged, exactly once.

```javascript
const input = document.querySelector('textarea[name$="_ans1"]');
input.addEventListener('stackmatheditor:enter', (e) => {
    // e.detail.trigger is 'key' or 'button'.
});
document.addEventListener('stackmatheditor:beforecheck', () => {
    // The original STACK inputs already hold the visible editor state here.
});
```

## Limitations ##

- Works with mod_quiz and mod_adaptivequiz only
- The plugin is specifically built around **STACK** and is not a general-purpose editor for arbitrary Moodle question types.
- Question-specific configuration is tied to quiz / question-bank entry resolution in the supported contexts.

## Support ##

Please use your normal project support and issue-tracking workflow for bug reports, feature requests, and local adaptations.

## License ##

2026 Ralf Erlebach

This program is free software: you can redistribute it and/or modify it under
 the terms of the GNU General Public License as published by the Free Software
 Foundation, either version 3 of the License, or (at your option) any later
 version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
 WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with
 this program. If not, see <https://www.gnu.org/licenses/>.
