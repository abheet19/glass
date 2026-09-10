# glass — sanity, acceptance, and release guide

> Snapshot: 10 September 2026 IST. Run this against disposable or synthetic data. Save the branch, commit, complete dirty-path list, command, exit code, environment, and artifact hashes with every result.

## Before running

Run against the checked local demo first. Treat consumer applications and the public Pages site as separate targets. Do not edit generated JSON manually.

```powershell
Set-Location 'D:\Code\glass'
npm ci
npm run check
npm run tokens
git diff -- src/tokens.json
npm run test:browser
npm pack --dry-run
```

## Product sanity checklist

- [ ] All eight themes on light/dark/system grounds update selected controls and measured budget.
- [ ] Keyboard theme/gallery/tabs/Home/End/tooltip/form/state actions work with visible focus.
- [ ] Reduced motion halts animation and flat/reduced transparency toggles round-trip.
- [ ] Deep links choose the expected palette and mobile overflow stays inside intended scrollers.
- [ ] Generated token JSON has only intended changes; package contains only intended source/demo/brand files.
- [ ] Assembled Pages artifact serves root/deep links, CSS, controls, and brand mark before publication.

## Retained evidence for the reviewed release

- 814 local contrast/structure assertions and 10 local browser groups passed.
- `verification-work/glass-site-20260910/evidence/browser-results.json`: assembled site 10/10, mark HTTP 200.
- Public `main`, successful Pages workflow run `34441715981`, Pages deployment `6365312606`, and the live demo map to `bf8677b...`; live `demo/index.html` was byte-identical to that commit (SHA-256 `E734534B...AAFE1`).

## Release sequence

1. Review the local visual/Pages diff and freeze one commit.
2. Run check, clean token generation diff, browser, package dry-run, and assembled-site probe.
3. Publish Pages with approval; record workflow, source SHA, URL/deep-link/mark smoke, and rollback source.
4. Publish npm only through a separate reviewed registry release and record package integrity.

## Claims this guide does not establish

- No universal consumer certification, pixel visual regression, full screen-reader matrix, or field Core Web Vitals.
- Local package/Pages assembly is not a public Pages or npm release.

A green local run is evidence for the exact tested tree. Call a feature deployed only after recording `source commit -> CI run -> image/release -> post-deploy smoke` for the same bytes.
