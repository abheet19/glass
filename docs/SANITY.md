# Glass sanity, acceptance, and release guide

Run against synthetic demo data and record the branch, commit, dirty-path list, commands, environment, evidence hashes, CI run, and live SHA.

```powershell
Set-Location 'D:\Code\glass'
npm ci
npm run format:check
npm run lint
npm run check
npm run test:browser
npm pack --dry-run
```

## Product acceptance

- [ ] Eight themes and light/dark/system grounds update both selected controls and the measured budget.
- [ ] Keyboard theme/gallery/tabs/Home/End/tooltip/form/menu actions work with visible focus.
- [ ] Reduced motion stops animation; flat transparency and deep links round-trip.
- [ ] Every explorer item opens a file tab; explorer/assistant toggle; tree disclosure hides content.
- [ ] Split resize works by keyboard; Problems, Output, Debug Console, Terminal, and Ports all open.
- [ ] Composer handles valid and empty submissions; sanitized run details toggle.
- [ ] No duplicate IDs, unnamed buttons, unlabelled fields, broken local anchors, browser errors, or page overflow at 320 px.
- [ ] Token JSON and package payload contain only intended files.

## Release sequence

1. Inspect the visual and source diff, focused desktop/mobile captures, and package payload.
2. Freeze one commit and rerun every gate on it.
3. Push; require green CI and Pages for that commit.
4. Verify `/release.json`, the live demo, a themed deep link, CSS, and brand mark against the full commit SHA.
5. Record the rollback commit and update `CONTEXT.md`, `MEMORY.md`, and the external Study Pack.

Automated results are scoped evidence for the exact tree. They are not an external WCAG certification, pixel baseline, full screen-reader/device matrix, consumer-app certification, or npm registry release.
