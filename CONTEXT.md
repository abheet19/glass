# glass — current implementation context

> Evidence snapshot: 10 September 2026 IST. Canonical repository: `D:\Code\glass`. The last public Pages mapping independently verified before this release was source `8d3dd5607ebf5bcca11877ae2f04c21593a72e62`; determine any later mapping from the Pages workflow/deployment and a live HTTP probe.
>
> This is the short, AI-readable map. Current source and executable tests win if an older design note disagrees. A dirty working tree is a candidate, not a release; a configured URL is not proof that the candidate is deployed.

## Product contract

glass is a framework-agnostic CSS design system: semantic OKLCH tokens, primitives, component/state styles, eight product themes, a Tailwind v3 adapter, and an executable contrast/structure contract. It lets independent products share accessible visual grammar without importing one JavaScript runtime. Theme files define eight seed properties; the verifier checks nine role tokens after derivation. These are different counts.

## Architecture and end-to-end flow

```text
theme seed values + base semantic tokens
  -> CSS custom-property cascade
  -> primitives/components/data/forms/navigation/feedback
  -> demo specimens and consumer apps
  -> Node contrast/structure verifier + real-browser behavior verifier
```

`src/tokens.css` defines semantic roles rather than component colors. Theme files override product seeds. Component sheets consume only semantic roles. `scripts/contrast.mjs` parses committed CSS, resolves the light/dark palettes, computes OKLCH-to-sRGB luminance and WCAG ratios, checks structural laws, and can emit synchronized JSON. The demo exercises themes, grounds, system preference, reduced motion/transparency, keyboard tabs/gallery/tooltips/forms, feedback, deep links, and mobile overflow.

## Code map

| Path | Responsibility |
| --- | --- |
| `src/tokens.css; src/tokens.json` | semantic source and generated machine-readable tokens |
| `src/themes` | eight product theme seed sets |
| `src/primitives.css; components.css; forms.css; navigation.css; feedback.css; data.css` | framework-neutral reusable styles |
| `tailwind-preset.js` | Tailwind v3 mapping to glass semantic variables |
| `scripts/contrast.mjs` | OKLCH conversion, luminance/contrast math, structural assertions, and JSON emission |
| `demo/index.html` | interactive specimen and copyable markup |
| `tools/verify-demo.mjs; tools/record-demo.mjs` | browser acceptance and GIF provenance |
| `.github/workflows/ci.yml; deploy-pages.yml` | quality gate and Pages assembly/publication |

## Invariants and trust boundaries

- Components consume semantic roles, not product-specific literal colors.
- Text, state, focus, border, and chart roles must satisfy the checked contrast/structure rules on both grounds.
- Generated `tokens.json` must match the CSS source; changes require a clean generation diff.
- Keyboard, reduced-motion, reduced-transparency, system-ground, and deep-link behavior remain testable in the plain HTML demo.
- Consumer theme availability does not prove that every consumer has migrated or deployed every component.

## User workflows to preserve

- Switch all eight themes and light/dark/system grounds; inspect the recomputed budget.
- Toggle flat/reduced transparency and reduced motion; verify skeleton motion stops.
- Use keyboard activation, roving tabs, Home/End, gallery selection, tooltip focus, native fields, state buttons, feedback, and deep links.
- Inspect component/data/form/navigation specimens and copy real markup.
- Use the mobile demo without page overflow outside intentional inner scrollers.

## Concepts this project teaches

| Concept | How it appears here |
| --- | --- |
| Design tokens | semantic variables decouple intent from product palette |
| CSS cascade | base roles, themes, modes, and local components form deliberate override layers |
| Color science | OKLCH seeds convert to sRGB luminance for checked contrast ratios |
| Accessibility contracts | focus, state distinction, motion/transparency preferences, and keyboard models are executable |
| Build determinism | generated JSON and Pages assembly are compared to committed source |
| Supply-chain boundaries | plain CSS can be vendored; npm/Pages publication and consumer deployment are separate claims |

## CI, packaging, deployment, and rollback

`npm run check` runs 814 contrast/structure assertions across 16 palettes. `npm run test:browser` runs ten interactive browser groups. `npm run tokens` regenerates JSON and must leave an intentional, reviewed diff. `npm pack --dry-run` inspects the package payload. CI runs the static and browser gates. `deploy-pages.yml` assembles `demo`, `src`, and `brand` into `_site` and publishes GitHub Pages from `main` or manual dispatch.

The retained pre-release assembled-site probe passed ten browser groups. For any release, rerun tokens, gates, package, and assembled-site checks; then record the Pages deployment/source and live HTTP probe for the exact commit. Preserve the prior Pages artifact/source for rollback. An npm-ready package is not evidence of an npm registry release.

## Current measured evidence

| Result | Evidence |
| --- | --- |
| 814 contrast/structure assertions passed across 16 palettes | `D:\Work\glass Study Pack\08_TESTING_ARTIFACT.md` |
| 10 local browser groups, zero browser errors | `D:\Code\glass\docs\verification\browser-results.json` |
| Assembled `_site` 10/10 including `/brand/mark.svg` HTTP 200 | `verification-work\glass-site-20260910\evidence\browser-results.json (SHA-256 3507DB65…AB36)` |
| Last Pages source recorded before this release was `8d3dd56...` | `D:\Work\glass Study Pack\08_TESTING_ARTIFACT.md` |

The evidence above belongs to the named local working-tree snapshot unless it explicitly names a release/image. It does not become live evidence merely because a deployment configuration exists.

## Open limits

- Automated contrast covers declared tokens and tested specimens, not arbitrary downstream overrides or all real content combinations.
- The browser suite is not visual-regression/pixel-baseline, screen-reader, device-fleet, or field Core Web Vitals evidence.
- Pages publication is separate from npm publication; no npm release is established.
- A theme file does not certify a consumer app. Verify each app's current source and deployment independently.
- Publication status is time-sensitive; verify the current Pages workflow/deployment SHA and live assets before making a release claim.

## Reading order

1. `CONTEXT.md` — current source/publication boundary
2. `D:\Work\glass Study Pack\02_glass_Concepts_From_Zero.md` — tokens, cascade, OKLCH, contrast, and accessibility
3. `D:\Work\glass Study Pack\01_glass_Architecture_And_Contrast_Law.md` — source layers and verifier laws
4. `src/tokens.css; src/themes; src/*.css` — actual design-system source
5. `scripts/contrast.mjs; tools/verify-demo.mjs; demo/index.html` — math and behavior evidence
6. `D:\Work\glass Study Pack\05_glass_System_Design_JavaScript_CSS_Walkthrough.md` — code walkthrough
7. `D:\Work\glass Study Pack\06_glass_Setup_CICD_Pages_And_Consumer_Integration.md; docs/SANITY.md` — delivery and release checks

Use `docs/SANITY.md` in the repository, or `09_SANITY_CHECK.md` in the Study Pack, before claiming that a new change works.

## Rules for the next coding agent

1. Use semantic roles; do not paste product-specific literals into shared components.
2. Run the contrast/structure and browser gates after token, theme, component, or demo changes.
3. Regenerate `tokens.json` from the source and review the exact diff.
4. Verify each consumer separately and keep Pages/npm/consumer release claims distinct.
5. Do not commit, publish Pages/npm, or change consumer deployments without authorization.
