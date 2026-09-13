# Glass release memory

Load `CONTEXT.md` first for the compact architecture map and `docs/TESTING.md` for the executable release contract.

## Durable decisions

- A theme owns eight hue/chroma seed values. The shared system owns lightness, semantic roles, spacing, typography, radii, motion, and accessibility fallbacks.
- Shared component sheets consume semantic tokens. Product-specific literal colours stay in theme files.
- Glass has no runtime JavaScript. Demo JavaScript demonstrates the behavior that consumer applications must implement.
- Workspace patterns adapt common editor/agent interaction conventions through Glass semantics: clear active states, collapsible panels, file/tool tabs, split panes, a focused composer, run disclosure, and a compact status line.
- Run details expose sanitized checkpoints and tool outcomes, never private model reasoning.
- A release is current only when source gates pass and public `release.json` reports the same full commit SHA.

## Current release work

The September 2026 release adds `workspace.css`, a complete interactive workspace specimen, all-control browser coverage, 320 px containment fixes, source-quality checks, Husky pre-commit enforcement, focused evidence captures, usage/testing documentation, and exact-SHA Pages provenance. The external release sign-off records the immutable commit, CI run, deployment, and public proof.

## In-progress: Glass Studio redesign (branch `redesign-glass`, not yet merged or deployed)

`demo/index.html` was rebuilt from a single scrolling page into an app shell (onboarding, sidebar, Overview/Library/Settings screens, a component Detail view, a command palette, a shortcuts overlay) while keeping every real feature — the live oklch contrast math, all eight themes, both grounds, flat mode — intact and computed exactly as before. New, honestly-computed features: a live AA/AAA WCAG toggle (7:1 text per 1.4.6; no stricter WCAG tier exists for non-text contrast, so graphic pairs hold at 3:1 either way), a Projects panel linking all eight source repos by their real `github.com/abheet19/<repo>` names (verified live via `gh api users/abheet19/repos`, not guessed), and Install instructions corrected to the real un-published-to-npm paths. Found and fixed two real defects along the way: `.modal-scrim`'s `display: grid` silently defeated the native `hidden` attribute (fixed in `src/feedback.css`, covered by a code comment and unaffected the 814/814 contrast budget), and a card grid was interpolating component blurb text through `innerHTML` unescaped, which let literal `<input>`/`<textarea>` substrings in the prose parse as phantom form elements. `tools/verify-demo.mjs` was rewritten to 15 groups covering the new IA at the same rigor as before; `tools/record-demo.mjs`'s selectors were updated to match but the hero GIF itself has not been re-recorded. Everything above is branch-local and green (`npm run validate`); nothing has been pushed or deployed — that is a deliberate human-review gate, not an oversight.

## Known boundaries

Contrast checks cover declared roles and specimens. Consumers can still misuse roles or author inaccessible markup, so each product keeps its own browser/accessibility gate. No npm registry publication is claimed.
