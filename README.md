# local_stackmatheditor – Visual Math Editor for Moodle STACK

A Moodle local plugin that provides a visual MathQuill-based formula editor
for STACK question type answer fields, with automatic LaTeX-to-Maxima
conversion and per-question toolbar configuration.

## Installation

1. Copy this folder to `moodle/local/stackmatheditor/`.
2. Download MathQuill assets into `thirdparty/mathquill/`:
   - `mathquill.min.js`
   - `mathquill.css`
3. Visit **Site Administration → Notifications** to install.
4. Set `$CFG->cachejs = false;` in `config.php` during development.

## Configuration

- **Global:** Site Administration → Plugins → Local plugins → STACK Math Editor
- **Per question:** `/local/stackmatheditor/configure.php?questionid=<ID>`

## Requirements

- Moodle 4.1+
- qtype_stack installed

## License

GPL-3.0-or-later
