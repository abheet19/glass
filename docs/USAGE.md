# Glass usage guide

Glass is plain CSS. Load the semantic tokens, one product theme, and either the full component entry point or only the sheets a product uses.

```html
<link rel="stylesheet" href="src/tokens.css">
<link rel="stylesheet" href="src/themes/weft.css">
<link rel="stylesheet" href="src/components.css">
```

Set `data-glass` for hue, `data-theme="light|dark"` for an explicit ground, and `data-flat="1"` to remove transparency. Omitting `data-theme` follows the operating system.

## Product workflow

1. Start with semantic roles such as `--surface`, `--raised`, `--ink`, and `--accent`; do not add literal product colours inside shared components.
2. Use native elements and ARIA states. Glass styles `aria-selected`, `aria-current`, `aria-expanded`, and the workspace collapse data attributes; application code must update them.
3. For IDE or agent layouts, use `.workspace-frame`, `.workspace-body`, side panels, `.workspace-editor-grid`, `.workspace-dock`, and `.command-composer`. Products still supply real file, terminal, agent, persistence, and approval behavior.
4. Preserve accessible names, visible focus, keyboard tab behavior, error text, and status announcements.
5. Run the complete release gate in `docs/TESTING.md` before vendoring or deploying changed CSS.

At widths below 900 px the assistant panel overlays the editor. Below 640 px the explorer also overlays, editor panes stack, and horizontal tab/table overflow remains inside its own scroller. Toggle buttons must remain available and keep `aria-expanded` synchronized.

The live demo is at <https://abheet19.github.io/glass/demo/>. It is a specimen and integration reference; it does not implement a product backend.
