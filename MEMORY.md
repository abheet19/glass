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

## Known boundaries

Contrast checks cover declared roles and specimens. Consumers can still misuse roles or author inaccessible markup, so each product keeps its own browser/accessibility gate. No npm registry publication is claimed.
