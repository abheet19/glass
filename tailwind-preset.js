/* =============================================================================
   GLASS — Tailwind preset
   tailwind-preset.js

   So a Tailwind project imports the SAME source of truth rather than a second
   copy of it that drifts. This is not an abstract worry: HealthFlow, the one
   project of the eight built on Tailwind, kept its palette in
   tailwind.config.js AND again in theme.ts for MUI, by hand, and the two had
   already begun to disagree.

   HOW IT WORKS. Every colour here maps to a CSS custom property, not to a hex.
   `bg-surface` compiles to `background-color: var(--surface)`, which means the
   theme triad and the data-glass switch keep working inside Tailwind — change
   the attribute on <html> and every Tailwind-generated rule follows, with no
   `dark:` variant anywhere and no second palette to maintain.

   Because the values are var() references, Tailwind's opacity modifier
   (bg-surface/50) cannot work on them: the token is an oklch() function, not
   three channels Tailwind can slot an alpha into. Use the glass tokens, which
   carry their own alpha, or color-mix().

   USE IT (Tailwind v3):

     // tailwind.config.js
     import glass from '@abheet19/glass/tailwind-preset';
     export default { presets: [glass], content: ['./src/**\/*.{ts,tsx,html}'] };

     // and once, at your CSS entry point — the preset maps names to tokens,
     // it does not define them:
     @import '@abheet19/glass/tokens.css';
     @import '@abheet19/glass/themes/weft.css';
     @import '@abheet19/glass/primitives.css';   // optional

   For Tailwind v4, skip the preset and use @theme inline with the same var()
   references; the mapping below is the list of names to declare.

   The structural values (radii, durations, the easing curve, the type scale)
   are read from src/tokens.json, which scripts/contrast.mjs regenerates from
   the CSS and then verifies on every run. If the CSS moves and the JSON does
   not, CI fails before this file can serve a stale number.
   ============================================================================= */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tokens = require('./src/tokens.json');

const s = tokens.structure;

/** @type {import('tailwindcss').Config} */
const preset = {
  theme: {
    extend: {
      colors: {
        /* ground and surfaces */
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        raised: 'var(--raised)',
        line: 'var(--line)',

        /* ink — three roles, three different ceilings. See tokens.css §1.3:
           `ink-3` is NOT a text colour on either ground. */
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },

        /* accent — `accent-2` is text-safe on opaque planes and graphic-only
           on glass. */
        accent: { DEFAULT: 'var(--accent)', 2: 'var(--accent-2)' },
        'on-accent': 'var(--on-accent)',

        /* the four states, shared by every theme on purpose */
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        bad: 'var(--bad)',
        info: 'var(--info)',

        /* glass. `glass-worst` is a MEASUREMENT token — the worst realistic
           composite behind a pane, used by the contrast budget. Never paint
           with it. */
        glass: {
          fill: 'var(--gl-fill)',
          edge: 'var(--gl-edge)',
          spec: 'var(--gl-spec)',
          inner: 'var(--gl-inner)',
        },
      },

      borderColor: { DEFAULT: 'var(--line)' },
      outlineColor: { DEFAULT: 'var(--focus)' },
      ringColor: { DEFAULT: 'var(--focus)' },
      ringWidth: { DEFAULT: 'var(--focus-w)' },
      ringOffsetWidth: { DEFAULT: 'var(--focus-off)' },

      borderRadius: {
        1: s['r-1'],
        2: s['r-2'],
        3: s['r-3'],
        pill: s['r-pill'],
      },

      fontFamily: {
        ui: 'var(--font-ui)',
        mono: 'var(--font-mono)',
      },

      fontSize: {
        0: ['var(--fs-0)', { lineHeight: 'var(--lh-2)' }],
        1: ['var(--fs-1)', { lineHeight: 'var(--lh-3)' }],
        2: ['var(--fs-2)', { lineHeight: 'var(--lh-1)' }],
        3: ['var(--fs-3)', { lineHeight: 'var(--lh-1)' }],
      },

      spacing: {
        1: s['sp-1'], 2: s['sp-2'], 3: s['sp-3'], 4: s['sp-4'],
        5: s['sp-5'], 6: s['sp-6'], 7: s['sp-7'], 8: s['sp-8'],
        target: s['target-min'],
      },

      transitionDuration: {
        fast: s['t-fast'],
        base: s['t-base'],
        slow: s['t-slow'],
        DEFAULT: s['t-base'],
      },

      transitionTimingFunction: {
        glass: s.ease,
        DEFAULT: s.ease,
      },

      backdropBlur: { glass: '14px' },
      backdropSaturate: { glass: '1.4' },

      boxShadow: { glass: 'var(--gl-shadow)' },

      /* One stacking order for every overlay component in components.css:
         dropdown < tooltip < toast < modal (tokens.css §1.12). */
      zIndex: {
        dropdown: s['z-dropdown'],
        tooltip: s['z-tooltip'],
        toast: s['z-toast'],
        modal: s['z-modal'],
      },
    },
  },
};

export default preset;
