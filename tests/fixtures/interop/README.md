# Interoperability fixtures (#102 - #104)

Imported by `tests/playwright/seed.php` into four quizzes and played by
`tests/playwright/interop.spec.js`. See `docs/INTEROP.md`.

| File | Source | Changed |
|---|---|---|
| `stack_mixed_types.xml` | written for this plugin: one input of every STACK type next to an algebraic one | - |
| `stack_jsxgraph_bindings.xml` | `samplequestions/stacklibrary/Doc-Examples/Specialist-Tools-Docs/JSXgraphs/stack_jxg.binding-demo-4.4.xml` | boards 360px wide instead of 100% |
| `stack_geogebra_watch.xml` | `.../Specialist-Tools-Docs/GeoGebra.xml` | inputs shown |
| `stack_geogebra_input.xml` | the same | inputs shown; watches `ans1,A`, remembers `B` in a `geogebra` input |
| `stack_parsons_proof.xml` | `samplequestions/stacklibrary/Templates/Parsons-Proof/questions-ft-Parsons-proofs-1-Minimal.xml` | - |
| `stack_parsons_grid.xml` | `.../Specialist-Tools-Docs/Drag-and-drop/Drag_and_drop-2-Grid.xml` | - |
| `stack_reveal.xml` | `.../Authoring-Docs/Question-blocks/Reveal_block_example.xml` | - |
| `stack_adapt.xml` | `.../Authoring-Docs/Question-blocks/Adapt_button_block.xml` | - |
| `stack_stackjs.xml` | `samplequestions/stack-js/stack-js-issue-specific-example-938.xml` | - |

STACK's sample questions are distributed with `qtype_stack` under the GNU GPL v3 or later, the
licence of this plugin. Each file holds the single question of its source.
