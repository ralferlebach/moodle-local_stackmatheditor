# STACK Math Editor ##

STACK Math Editor is a Moodle local plugin that adds a visual **MathQuill-based formula editor** to STACK question answer inputs in quiz attempts, quiz review, and STACK question preview contexts.

The plugin injects a configurable toolbar for mathematical input, supports **LaTeX-style entry**, and converts the entered expressions into a form suitable for **STACK / Maxima** processing. It also provides **instance-level defaults** and **per-question configuration** for the available toolbar groups and variable handling.

## Key features ##

- Adds a visual MathQuill editor to STACK answer inputs in supported quiz and preview pages.
- Uses Moodle hooks and AMD modules to inject the editor without modifying STACK core files.
- Supports **automatic LaTeX-to-Maxima conversion** for common mathematical notation.
- Provides configurable toolbar groups such as fractions, powers, roots, trigonometry, logarithms, constants, comparison operators, parentheses, calculus symbols, Greek letters, and matrices.
- Supports configurable **variable modes** with instance defaults and question-specific overrides.
- Adds a dedicated configuration UI for individual STACK questions inside a quiz context.
- Exposes an AJAX-capable external service for retrieving toolbar configuration for question IDs.
- Ships with English and German language packs.

## Requirements ##

- Moodle **4.1 or later**
- **qtype_stack** installed
- A Moodle quiz context containing STACK questions for per-question configuration

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

### Global settings ###

Global plugin settings are available at

_Site administration > Plugins > Local plugins > STACK Math Editor_

The plugin currently provides at least these site-wide settings:

- **Enable / disable plugin**
- Default **variable mode**
- Default enabled **toolbar groups**

### Per-question configuration ###

The plugin also supports question-specific configuration for STACK questions in a quiz context.

A dedicated configuration page is available at:

- the question page in a quiz (for STACK questions)
- at the attempt pages in zthe question info boxes (for STACK questions)
- additionally it may be manually retrieved by the following URL
  /local/stackmatheditor/configure.php?cmid=<CourseModuleID>&qbeid=<QuestinBankEntryID>  

Depending on the calling context, the plugin resolves the question bank entry automatically and lets authorized users configure:

- the enabled toolbar groups for the question
- the variable mode for that question

The configuration form also shows the quiz name, question name including version, and a collapsible question preview.

## How it works ##

The plugin registers output hooks and injects assets on supported pages. It loads MathQuill, initializes the frontend via AMD modules, and publishes runtime configuration data for the current STACK question slots.

The frontend code includes modules for:

- editor initialization
- configure-link injection
- MathJax compatibility handling
- LaTeX-to-Maxima conversion
- Maxima-to-TeX conversion

Toolbar definitions include predefined groups for common mathematical constructs and symbol sets. The conversion layer also contains mappings for functions, constants, operators, comparison symbols, Greek letters, and units.

## Supported contexts ##

Based on the current implementation, the plugin is designed to work in these contexts:

- **Quiz attempt** pages
- **Quiz review** pages
- **Question preview** pages
- **Quiz editing** pages for injecting links to the configuration UI

The per-question configuration page itself requires a quiz module context and the capability to manage the quiz.

## Development notes ##

- The plugin is currently marked as **MATURITY_ALPHA**.
- The current release string in `version.php` is **0.8**.
- The plugin stores configuration in its own database installation/upgrade layer and uses Moodle's standard upgrade flow.
- The repository contains AMD source and build directories, JavaScript compatibility code, CSS, PHP classes, and language files.

## Limitations ##

- The plugin is specifically built around **STACK** and is not a general-purpose editor for arbitrary Moodle question types.
- Question-specific configuration is tied to quiz / question-bank entry resolution in the supported contexts.
- Because the plugin is currently alpha, installations should be tested carefully before production rollout.

## Knonw Issues ##

- works at the moment only with input fields, not with text area
- no option for quiz-wide preferences at the moment
- no automated testing (CI still to be implemented)

## Privacy ##

The repository structure indicates that the plugin stores configuration required for editor behavior. No dedicated privacy provider is visible in the plugin structure at the moment, so you should review your local compliance requirements before production use.

## Related components ##

This plugin is designed to complement:

- Moodle **quiz**
- Moodle **question bank / preview** workflows
- **qtype_stack**
- **MathQuill** as the client-side formula editor
- **Maxima / STACK** expression handling

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
