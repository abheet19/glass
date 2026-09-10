# glass — current implementation context

> Release candidate: 10 September 2026 IST. Canonical repository: `D:\Code\glass`. Source and executable tests win if an older note disagrees. A dirty working tree is a candidate; a configured URL is not deployment proof.

## Product contract

Glass is a framework-neutral CSS design system: semantic OKLCH tokens, eight product themes, reusable product/workspace primitives, a Tailwind v3 adapter, and executable quality, contrast, interaction, accessibility, and responsive contracts. It solves cross-product visual drift without imposing a JavaScript framework or runtime.

## Architecture

```text
eight seed values per theme + shared semantic tokens
  -> CSS cascade and accessibility modes
  -> primitives/forms/navigation/feedback/data/workspace sheets
  -> plain-HTML interactive demo and downstream products
  -> source-quality + 814 contrast/structure assertions + 12 browser groups
  -> exact-SHA GitHub Pages release
```

`workspace.css` adds editor and agent-shell layout primitives: title/status bars, project trees, multiple file tabs, resizable split panes, toggleable side panels, five tool tabs, a command composer, sanitized run details, filters, and metric cards. It supplies layout and responsive state styling; products own real execution and persistence.

## Code map

| Path | Responsibility |
| --- | --- |
| `src/tokens.css`, `src/tokens.json`, `src/themes` | semantic roles, generated mirror, and eight seed-only themes |
| `src/primitives.css`, `forms.css`, `navigation.css`, `feedback.css`, `data.css` | reusable controls and states |
| `src/workspace.css` | responsive editor, agent, and operations-shell patterns |
| `src/components.css` | single import for all six component sheets |
| `scripts/contrast.mjs` | colour math, budgets, seed/ladder/state/variable/JSON laws |
| `tools/quality.mjs`, `tools/verify-demo.mjs` | source hygiene and real-browser acceptance |
| `demo/index.html` | all-control specimen and copyable integration reference |
| `.github/workflows` | CI and exact-SHA Pages assembly/deployment |

## Invariants

- Component paint comes from semantic roles; theme files cannot alter structure.
- Tested text, focus, status, and graphic combinations meet their declared WCAG 2.2 thresholds on both grounds.
- Colour is never the only state channel; controls expose native names, roles, states, and keyboard behavior.
- At 320 px the page cannot overflow; wide data and tabs scroll only inside their intended containers.
- Every visible specimen action has a browser-tested observable result.
- Public completion requires `release.json.sha == git HEAD` after green CI and Pages.

## User flows

Switch eight themes and three ground choices; toggle flat mode; inspect the live contrast budget; operate fields, buttons, menus, tabs, tooltips, feedback and data specimens; then exercise every workspace file, panel, disclosure, split, dock tab, and composer action on desktop and mobile.

## Delivery and limits

Run `npm run validate` and `npm pack --dry-run`. CI runs source quality, all 814 contrast/structure assertions, and twelve browser groups. Pages runs the same gates, publishes the demo/source/brand, and writes the exact source SHA to `/release.json`.

This is automated WCAG-aligned evidence for the tested criteria, not an external certification, full screen-reader/device fleet, arbitrary consumer audit, or npm publication. Validate each consumer independently.

## Reading order

1. `CONTEXT.md`
2. `docs/USAGE.md`
3. `D:\Work\glass Study Pack\02_glass_Concepts_From_Zero.md`
4. `D:\Work\glass Study Pack\01_glass_Architecture_And_Contrast_Law.md`
5. `src/tokens.css`, `src/themes`, and the six component sheets
6. `scripts/contrast.mjs`, `tools/quality.mjs`, `tools/verify-demo.mjs`, `demo/index.html`
7. `docs/TESTING.md`, `docs/SANITY.md`, and the Study Pack delivery guide

## Rules for the next agent

Use semantic roles, keep new interaction states native and testable, and rerun quality/contrast/browser/package gates after any source change. Keep library, consumer, Pages, and npm claims separate. Do not claim a release live until the exact public SHA is verified.
