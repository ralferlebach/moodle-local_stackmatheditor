# STACK widgets next to the editor (#102, #103, #104)

The editor converts four kinds of STACK input and leaves everything else exactly as STACK and
its widgets render, fill and submit it. This page says which inputs those are, how the decision
is made, what is tested, and where the limits are.

## Which inputs get an editor

| `data-stack-input-type` | Editor |
|---|---|
| `algebraic`, `units` | one-line editor (`input_fields.js`) |
| `equiv`, `textarea` | multi-line editor (`textarea_fields.js`) |
| `string` (also Parsons blocks and JSXGraph custom bindings), `json`, `geogebra`, `freetext`, `notes`, `numerical`, `singlechar`, `matrix`, `varmatrix`, `boolean`, `dropdown`, `checkbox`, `radio`, any other value | none - the field stays native |
| no type metadata (STACK before 4.4) | only when the field is positively an algebraic STACK input: `<input type="text">` with STACK's class `algebraic` or `algebraic-right`, inside a `.que.stack`, whose name or id ends in `_ansN` |

The explicit type is authoritative. The name convention `_ansN` alone is no proof of the type:
before build 2026110201 a typed GeoGebra, string, JSON, numerical, single-character or matrix
field named `..._ans1` got a MathQuill editor (24 of the 71 cases of
`tests/jest/foreign_input_types_102_104.test.js` fail against build 2026110200; in the browser,
the string field of the mixed-types question got an editor). A field the editor does not take
gets no wrapper, is not hidden, has no flush on submit, gets no event dispatched by the editor,
and keeps its focus.

Where a widget writes into an algebraic field - a JSXGraph `bind_point`, a GeoGebra `watch`, a
STACK-JS script - that field does get an editor: the editor shows the value the widget wrote
(external values, #64), and sends it unchanged unless the student edits it in the editor
(#100). Typing into such an editor moves the JSXGraph object: the binding is two-way.

## What is tested

`tests/playwright/interop.spec.js` plays each scenario twice in a real quiz: with the editor
switched off for the whole site (no editor script on the page, `editor-switch.php 0`) and with it
on. Both runs do the same things with the widgets. For every answer field of the page it checks
that the value before the Check is what the request sends, what the question engine stores
(`attempt-state.php`) and what the page shows after the reload, and that the widgets' values are
the same with the editor on and off. Green on Moodle 4.5 and 5.3 (Chromium).

| Scenario | Fixture | Interaction | Checked in addition |
|---|---|---|---|
| Every STACK input type | `interop/stack_mixed_types.xml` (one input of each type) | native typing and selection in every foreign field, the algebraic field in the editor | only algebraic and units get an editor; focus stays in the foreign field |
| JSXGraph bindings | `interop/stack_jsxgraph_bindings.xml` (STACK's binding demo) | mouse drags of points and the slider in six boards: `bind_point`, `bind_slider`, `bind_point_dual`, `bind_point_relative`, `bind_point_direction`, `bind_list_of`, `define_group`, `custom_bind` | typing `[2,-1]` into the bound editor moves the point; the reload restores the board; the group fills all its fields; the custom binding's string stays native |
| GeoGebra, two boards | STACK's minimal GeoGebra question; a second one watching a point into an algebraic input and remembering in a `geogebra` input | points moved through the applet's API (`setCoords`) | the watched number (slope) and point arrive in the editor fields; the remembered JSON in the string and the geogebra input; the reload restores the remembered points |
| Parsons proof and grid, reveal, adapt, STACK-JS | STACK's samples | proof steps by double-click, a grid cell by drag; reveal by answering true; the adapt button; `a£b` into the string field that the STACK-JS script turns into `pound(a,b)` in a hidden algebraic field | the revealed editor is visible and usable; the STACK-JS value is sent unchanged |

The Jest matrix (`tests/jest/foreign_input_types_102_104.test.js`, 71 tests) covers the same
decision for 13 explicit types x 4 name variants, the legacy markers, and a mixed page with
submit, focus, events and the switch.

## Fixtures

The files in `tests/fixtures/interop/` other than `stack_mixed_types.xml` are STACK's own sample
questions from `qtype_stack/samplequestions` (GPL v3 or later, the licence of this plugin),
reduced to their single question. Changes, so that a test can see and use them:

* JSXGraph binding demo: boards `width="360px"` instead of `100%`. In the narrow layout of a quiz
  without the editor the demo's boards collapse to zero width - a property of the demo's
  layout, not of the editor, but nothing can be dragged then.
* GeoGebra: the inputs are shown (STACK's documentation recommends that while testing); the
  second question watches `ans1,A`, remembers `B`, and keeps its state in a `geogebra` input.

## Third-party content, CSP and data flows

* The editor bundles no GeoGebra, JSXGraph, Sortable or other widget library and loads none.
  STACK loads them: JSXGraph and Sortable from STACK's own `corsscripts`, GeoGebra from
  geogebra.org (`deployggb.js` and the material), each inside STACK's sandboxed `srcdoc` iframe.
  GeoGebra's terms apply to that content; a site that blocks geogebra.org by its Content
  Security Policy blocks STACK's GeoGebra block with or without the editor.
* Data flow: the widget in the iframe -> STACK-JS (`postMessage`) -> STACK's VLE script sets the
  original field and dispatches `change`/`input` -> the editor, for an algebraic field only,
  shows the value. Nothing flows the other way except through the original field, which STACK-JS
  watches.
* `mod_geogebra` is no dependency. Its pages (`mod-geogebra-view`, `-attempt`, `-report`, `-index`)
  are not editor pages, so no editor script is loaded there in any activation mode
  (`context_resolver_test::test_geogebra_activity_pages`).

## Limits

* Firefox is not tested here; the browser runs are Chromium.
* `mod_geogebra` is proven only by the page gate above. A browser run on a `mod_geogebra`
  activity needs that plugin installed on the test site, which was not possible here.
* GeoGebra angles are not covered: the documented applet has no angle object.
* The Parsons grid is dragged with a real mouse press and HTML5 drag events dispatched in the
  iframe: Chromium under Playwright does not complete a native drag inside an iframe. Proof steps
  use STACK's double-click.
* A Parsons block takes the focus on the first click into the page - with the editor off as well;
  the test clicks again, as a student would.
* Mouse drags land on slightly different sub-pixels in the two layouts, so dragged coordinates are
  compared by their format between the runs, and exactly within each run.
