# Glass testing plan

Run from a clean checkout with Node 18 or newer.

```powershell
npm ci
npm run format:check
npm run lint
npm run check
npm run test:browser
npm pack --dry-run
```

## Automated acceptance matrix

- `format:check`: final newlines, trailing whitespace, and canonical JSON.
- `lint`: all JavaScript syntax, CSS brace balance, and local CSS imports.
- `check`: 814 contrast and structural assertions over eight themes on light and dark grounds, including every shipped stylesheet variable.
- `test:browser`: twelve groups covering all theme/ground controls, keyboard paths, fields, menu actions, tabs, tooltips, reduced motion, deep links, every workspace control, structural labels/IDs/anchors, and page containment at 320 px.
- `npm pack --dry-run`: verifies the public package payload.

Inspect `docs/verification/glass-workspace-desktop.png` and `glass-workspace-mobile.png` after browser runs. For release, inspect the entire diff, push one commit, wait for CI and Pages, then require `https://abheet19.github.io/glass/release.json` to equal that exact commit SHA and smoke the live demo/deep link.

## Manual checks retained for humans

- Navigate the complete page with keyboard only and confirm focus remains visible.
- Inspect light, dark, and flat modes at 320, 768, and desktop widths.
- Check the accessibility tree with a browser inspector and run a screen-reader pass for the consuming product.
- Verify downstream applications independently. Passing Glass proves the library and demo, not arbitrary consumer markup.

Glass is WCAG 2.2 aligned for the tested criteria and specimens. The automated suite is not an external accessibility certification, a full assistive-technology matrix, or field Core Web Vitals evidence.
