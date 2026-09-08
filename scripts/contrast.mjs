#!/usr/bin/env node
/* =============================================================================
   GLASS — the contrast budget
   scripts/contrast.mjs

   Dependency-free. Reads src/tokens.css, all eight src/themes/*.css and
   src/primitives.css; resolves every custom property (nested var(), oklch()
   with sRGB gamut mapping, color-mix(in srgb, ...), alpha compositing);
   computes WCAG 2.x relative luminance; and asserts the budget for

       EIGHT THEMES  x  TWO GROUNDS  =  SIXTEEN PALETTES

   every time it runs. Zeno's version checked one palette pair. This one checks
   sixteen, and refuses to let a theme opt out.

     4.5 : 1   text                        WCAG 2.2 SC 1.4.3
     3.0 : 1   graphics and UI components  WCAG 2.2 SC 1.4.11
     1.10: 1   a state fill must separate from the plane it sits on

   Beyond the two WCAG thresholds it also asserts:

     · the two light blocks in tokens.css are identical, declaration for
       declaration — the only reason it is safe to write them twice
     · every theme file declares EXACTLY the eight seed properties and nothing
       else, so a theme structurally cannot alter the ladder
     · the resolved lightness ladder is numerically identical across all eight
       themes, on both grounds
     · every var() referenced in any of the ten stylesheets resolves to a
       property that is actually declared somewhere
     · every state chip's fill separates from the plane, no two state fills
       collapse onto the same greyscale luminance, and every glyph and label is
       unique — colour is never the only channel
     · each declared exclusion is NECESSARY: the pair the system forbids really
       does fail. An exclusion nobody rechecks is folklore, not a rule.
     · src/tokens.json still matches the CSS it claims to mirror

   Exits non-zero on any failure, so CI genuinely blocks a regression.

     node scripts/contrast.mjs                 the matrix, then pass or fail
     node scripts/contrast.mjs --verbose       every pair, every palette
     node scripts/contrast.mjs --theme weft    one theme only
     node scripts/contrast.mjs --emit-json     rewrite src/tokens.json
   ============================================================================= */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const THEMES_DIR = join(SRC, 'themes');
const JSON_PATH = join(SRC, 'tokens.json');

const VERBOSE = process.argv.includes('--verbose');
const EMIT_JSON = process.argv.includes('--emit-json');
const ONLY_THEME = (() => {
  const i = process.argv.indexOf('--theme');
  return i >= 0 ? process.argv[i + 1] : null;
})();

const TEXT_MIN = 4.5;
const CTRL_MIN = 3.0;
const FILL_DELTA_MIN = 1.10;
const LADDER_GAP_MIN = 0.0025;
const LADDER_L_TOLERANCE = 0.005; /* resolved lightness drift allowed between themes */

/* The eight numbers a theme is allowed to set, and the only ones. */
const SEED_PROPS = [
  '--h-ground', '--c-ground',
  '--h-accent', '--c-accent', '--c-accent-lt',
  '--h-accent-2', '--c-accent-2', '--c-accent-2-lt',
];

const STATES = ['ok', 'warn', 'bad', 'info'];

/* =============================================================================
   1. COLOUR — sRGB, OKLab/OKLCH, WCAG luminance.
   ============================================================================= */

const srgbToLinear = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055) * 255;

function hexToRgb(hex) {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  if (!/^[0-9a-f]{6}/i.test(h)) throw new Error(`not a hex colour: ${hex}`);
  return { rgb: [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)], a };
}

const rgbToHex = (rgb) =>
  '#' + rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0').toUpperCase()).join('');

/* OKLCH -> linear sRGB. Björn Ottosson's matrices, unmodified. */
function oklchToLinearRgb(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

function linearRgbToOklab(lin) {
  const [r, g, b] = lin;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

const inGamut = (lin, e = 1e-5) => lin.every((c) => c >= -e && c <= 1 + e);

/* CSS Color 4 gamut mapping, the cheap honest version: hold L and H, reduce C
   by bisection until the colour is representable in sRGB. This is what a
   browser does to an out-of-gamut oklch(), so measuring the clipped colour is
   measuring what the user actually sees. */
function oklchToRgb(L, C, H) {
  let lin = oklchToLinearRgb(L, C, H);
  if (!inGamut(lin)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinearRgb(L, mid, H))) lo = mid; else hi = mid;
    }
    lin = oklchToLinearRgb(L, lo, H);
  }
  return lin.map((c) => linearToSrgb(Math.min(1, Math.max(0, c))));
}

const oklabLightness = (rgb) => linearRgbToOklab(rgb.map(srgbToLinear))[0];

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((c8) => {
    const c = c8 / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg, bg) {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/* Composite a possibly-transparent colour over an opaque backdrop. */
const over = (c, backdrop) =>
  c.a >= 1 ? c.rgb : c.rgb.map((v, i) => v * c.a + backdrop[i] * (1 - c.a));

/* =============================================================================
   2. CSS PARSING — enough of it, and no more.
   ============================================================================= */

function splitTopLevel(str, sep) {
  const out = [];
  let depth = 0, buf = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === sep && depth === 0) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  out.push(buf);
  return out.map((s) => s.trim()).filter(Boolean);
}

function splitTopLevelWhitespace(str) {
  const out = [];
  let depth = 0, buf = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) { if (buf) out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  if (buf) out.push(buf);
  return out;
}

/* Every `selector { body }` pair. Nested at-rules degrade harmlessly: the inner
   rule matches with its own selector and the at-rule prelude falls out. */
function ruleBlocks(text) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text)) !== null) rules.push({ selector: m[1].trim(), body: m[2] });
  return rules;
}

function declarations(body) {
  const decls = {};
  for (const stmt of splitTopLevel(body, ';')) {
    const i = stmt.indexOf(':');
    if (i < 0) continue;
    const prop = stmt.slice(0, i).trim();
    const value = stmt.slice(i + 1).trim().replace(/\s*!important$/, '');
    if (prop) decls[prop] = value;
  }
  return decls;
}

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function loadCss(path) {
  const raw = readFileSync(path, 'utf8');
  return { path, raw, rules: ruleBlocks(stripComments(raw)) };
}

const tokensCss = loadCss(join(SRC, 'tokens.css'));
const primitivesCss = loadCss(join(SRC, 'primitives.css'));
const themeFiles = readdirSync(THEMES_DIR).filter((f) => f.endsWith('.css')).sort();
const themeCss = Object.fromEntries(
  themeFiles.map((f) => [f.replace(/\.css$/, ''), loadCss(join(THEMES_DIR, f))]),
);

const ALL_THEMES = Object.keys(themeCss);
const RUN_THEMES = ONLY_THEME ? ALL_THEMES.filter((t) => t === ONLY_THEME) : ALL_THEMES;
if (ONLY_THEME && RUN_THEMES.length === 0) {
  console.error(`unknown theme "${ONLY_THEME}" — have: ${ALL_THEMES.join(', ')}`);
  process.exit(2);
}

const declsFor = (file, selector) => {
  const rule = file.rules.find((r) => r.selector === selector);
  return rule ? declarations(rule.body) : null;
};

const ROOT_DARK = declsFor(tokensCss, ':root');
const ROOT_LIGHT_ATTR = declsFor(tokensCss, ':root[data-theme="light"]');
const ROOT_LIGHT_MEDIA = declsFor(tokensCss, ':root:not([data-theme="dark"])');

if (!ROOT_DARK || !ROOT_LIGHT_ATTR || !ROOT_LIGHT_MEDIA) {
  console.error('tokens.css is missing one of the three theme-triad blocks.');
  process.exit(2);
}

/* Build the variable map for one (theme, ground) palette. Seeds first so the
   theme overrides tokens.css's defaults; the ground block last so it overrides
   the derived dark values. Seeds and derived tokens are disjoint sets, which is
   the whole point of the split. */
function paletteVars(theme, ground) {
  const seeds = declsFor(themeCss[theme], `:root[data-glass="${theme}"]`) || {};
  const base = { ...ROOT_DARK, ...seeds };
  return ground === 'light' ? { ...base, ...ROOT_LIGHT_ATTR } : base;
}

/* =============================================================================
   3. VALUE RESOLUTION — var(), oklch(), color-mix(in srgb), hex, transparent.
   Returns { rgb, a }.
   ============================================================================= */

function resolve(value, vars, seen = new Set()) {
  const v = String(value).trim();

  if (/^transparent$/i.test(v)) return { rgb: [0, 0, 0], a: 0 };
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return hexToRgb(v);

  const varMatch = v.match(/^var\(\s*(--[\w-]+)\s*(?:,([\s\S]+))?\)$/i);
  if (varMatch) {
    const name = varMatch[1];
    if (seen.has(name)) throw new Error(`circular var(${name})`);
    if (vars[name] !== undefined) return resolve(vars[name], vars, new Set([...seen, name]));
    if (varMatch[2] !== undefined) return resolve(varMatch[2], vars, seen);
    throw new Error(`undefined custom property ${name}`);
  }

  const oklchMatch = v.match(/^oklch\(\s*([\s\S]+?)\s*\)$/i);
  if (oklchMatch) {
    const [body, alphaPart] = splitTopLevel(oklchMatch[1], '/');
    const parts = splitTopLevelWhitespace(body);
    if (parts.length !== 3) throw new Error(`oklch needs three components: ${v}`);
    const num = (raw, pctScale) => {
      let t = raw.trim();
      const m = t.match(/^var\(\s*(--[\w-]+)\s*(?:,([\s\S]+))?\)$/i);
      if (m) {
        const name = m[1];
        if (vars[name] !== undefined) return num(vars[name], pctScale);
        if (m[2] !== undefined) return num(m[2], pctScale);
        throw new Error(`undefined custom property ${name}`);
      }
      t = t.replace(/deg$/i, '');
      if (t.endsWith('%')) return parseFloat(t) / 100 * pctScale;
      const n = parseFloat(t);
      if (Number.isNaN(n)) throw new Error(`not a number in oklch(): ${raw}`);
      return n;
    };
    const L = num(parts[0], 1);
    const C = num(parts[1], 0.4);
    const H = num(parts[2], 360);
    const a = alphaPart === undefined ? 1 : num(alphaPart, 1);
    return { rgb: oklchToRgb(L, C, H), a };
  }

  const mixMatch = v.match(/^color-mix\(\s*in\s+srgb\s*,([\s\S]+)\)$/i);
  if (mixMatch) {
    const parts = splitTopLevel(mixMatch[1], ',');
    if (parts.length !== 2) throw new Error(`color-mix must take two colours: ${v}`);
    const parsed = parts.map((p) => {
      const pm = p.match(/^([\s\S]+?)\s+([\d.]+)%$/);
      return pm ? { color: pm[1].trim(), pct: parseFloat(pm[2]) } : { color: p.trim(), pct: null };
    });
    const [x, y] = parsed;
    if (x.pct === null && y.pct === null) { x.pct = 50; y.pct = 50; }
    else if (x.pct === null) x.pct = 100 - y.pct;
    else if (y.pct === null) y.pct = 100 - x.pct;
    const total = x.pct + y.pct;
    if (total === 0) throw new Error(`color-mix percentages sum to zero: ${v}`);
    const wx = x.pct / total, wy = y.pct / total;
    const cx = resolve(x.color, vars, seen);
    const cy = resolve(y.color, vars, seen);
    /* CSS Color 4: premultiplied interpolation, so mixing with `transparent`
       lowers alpha instead of dragging the colour toward black. */
    const a = cx.a * wx + cy.a * wy;
    const rgb = a === 0
      ? [0, 0, 0]
      : [0, 1, 2].map((i) => (cx.rgb[i] * cx.a * wx + cy.rgb[i] * cy.a * wy) / a);
    return { rgb, a };
  }

  throw new Error(`cannot resolve colour value: ${v}`);
}

/* =============================================================================
   4. THE STATE GRAMMAR, READ BACK OUT OF primitives.css
   ============================================================================= */

const stateBase = (() => {
  const r = primitivesCss.rules.find((x) => /(^|,)\s*\.state\s*$/.test(x.selector) && x.body.includes('--st-glyph'));
  return r ? declarations(r.body) : {};
})();

function stateDecls(name) {
  const wanted = new RegExp(`\\.state-${name}(?![\\w-])`);
  const rule = primitivesCss.rules.find((r) => wanted.test(r.selector) && r.body.includes('--st-fill'));
  if (!rule) return null;
  return { ...stateBase, ...declarations(rule.body) };
}

const unescapeCssString = (v) =>
  String(v).trim().replace(/^["']|["']$/g, '')
    .replace(/\\([0-9a-f]{1,6})\s?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));

/* =============================================================================
   5. THE BUDGET
   ============================================================================= */

const rows = [];
let failures = 0;
const record = (r) => { if (!r.pass) failures++; rows.push(r); };

function makeCheck(theme, ground, vars) {
  const R = (value, backdropValue) => {
    const bd = resolve(backdropValue, vars);
    const fg = resolve(value, vars);
    return contrastRatio(over(fg, over(bd, [128, 128, 128])), over(bd, [128, 128, 128]));
  };
  return function check({ group, pair, fg, bg, min, kind = 'ratio', note = '' }) {
    let ratio = null, error = null;
    try { ratio = R(fg, bg); } catch (e) { error = e.message; }
    const pass = error === null && ratio >= min;
    record({ theme, ground, group, pair, ratio, min, pass, kind, note: error ? `ERROR ${error}` : note });
    return ratio;
  };
}

/* An exclusion is only honest if it is necessary: the pair the system forbids
   must genuinely be BELOW threshold. If one starts passing, the rule is
   arbitrary and should be relaxed rather than left as folklore.

   Exclusions run on the DARK ground only, and that is not laziness. On the
   light ground the glass tint only ever LIGHTENS what is behind it while every
   ink is dark, so glass on a light ground always has more contrast than the
   opaque --raised plane. Glass is never the binding case there; every glass
   exclusion in this system is a dark-ground exclusion. */
function makeExclusion(theme, ground, vars) {
  const chk = makeCheck(theme, ground, vars);
  return function exclusion({ pair, fg, bg, min, note = '' }) {
    let ratio = null, error = null;
    try {
      const bd = resolve(bg, vars);
      const bdRgb = over(bd, [128, 128, 128]);
      ratio = contrastRatio(over(resolve(fg, vars), bdRgb), bdRgb);
    } catch (e) { error = e.message; }
    const pass = error === null && ratio < min;
    record({
      theme, ground, group: 'exclusions · verified necessary', pair, ratio, min, pass, kind: 'ratio',
      note: error ? `ERROR ${error}` : (pass ? note : 'CLEARS the threshold — relax the rule rather than leave it as folklore'),
    });
    void chk;
  };
}

const matrix = [];

for (const theme of RUN_THEMES) {
  for (const ground of ['dark', 'light']) {
    const vars = paletteVars(theme, ground);
    const check = makeCheck(theme, ground, vars);
    const exclusion = makeExclusion(theme, ground, vars);
    const cell = { theme, ground };

    /* --- A. ink, on the worst opaque plane and on the worst glass ---------- */
    cell.inkPlane = check({ group: 'text · ink', pair: '--ink on --raised', fg: 'var(--ink)', bg: 'var(--raised)', min: TEXT_MIN, note: 'worst opaque plane' });
    cell.inkGlass = check({ group: 'text · ink', pair: '--ink on --gl-worst', fg: 'var(--ink)', bg: 'var(--gl-worst)', min: TEXT_MIN, note: 'worst realistic glass' });
    cell.ink2Plane = check({ group: 'text · ink', pair: '--ink-2 on --raised', fg: 'var(--ink-2)', bg: 'var(--raised)', min: TEXT_MIN });
    cell.ink2Glass = check({ group: 'text · ink', pair: '--ink-2 on --gl-worst', fg: 'var(--ink-2)', bg: 'var(--gl-worst)', min: TEXT_MIN });
    check({ group: 'text · ink', pair: '--ink on --surface', fg: 'var(--ink)', bg: 'var(--surface)', min: TEXT_MIN });
    check({ group: 'text · ink', pair: '--ink on --bg', fg: 'var(--ink)', bg: 'var(--bg)', min: TEXT_MIN });
    /* --gl-inner is the opaque-enough inner plate a dense label sits on. */
    check({ group: 'text · ink', pair: '--ink on --gl-inner over --gl-worst', fg: 'var(--ink)', bg: 'var(--gl-inner)', min: TEXT_MIN, note: 'the inner plate' });

    /* --ink-3 is not a text colour anywhere; it is the 3:1 graphic token, and
       on opaque planes only. */
    cell.ink3Plane = check({ group: 'graphic · ink', pair: '--ink-3 on --raised', fg: 'var(--ink-3)', bg: 'var(--raised)', min: CTRL_MIN, kind: 'graphic', note: 'never text — disabled and watermark only' });

    /* --- B. accent ---------------------------------------------------------- */
    cell.accPlane = check({ group: 'text · accent', pair: '--accent on --raised', fg: 'var(--accent)', bg: 'var(--raised)', min: TEXT_MIN });
    cell.accGlass = check({ group: 'text · accent', pair: '--accent on --gl-worst', fg: 'var(--accent)', bg: 'var(--gl-worst)', min: TEXT_MIN });
    cell.acc2Plane = check({ group: 'text · accent', pair: '--accent-2 on --raised', fg: 'var(--accent-2)', bg: 'var(--raised)', min: TEXT_MIN });
    cell.acc2Glass = check({ group: 'graphic · accent', pair: '--accent-2 on --gl-worst', fg: 'var(--accent-2)', bg: 'var(--gl-worst)', min: CTRL_MIN, kind: 'graphic', note: 'graphic only on glass — see exclusions' });
    cell.onAcc = check({ group: 'text · accent', pair: '--on-accent on --accent', fg: 'var(--on-accent)', bg: 'var(--accent)', min: TEXT_MIN, note: '.btn-primary label' });
    check({ group: 'text · accent', pair: '--on-accent on --accent-2', fg: 'var(--on-accent)', bg: 'var(--accent-2)', min: TEXT_MIN });
    /* .btn-primary:hover mixes the accent 88% toward the ink — the label must
       survive the hover, not only the resting state. */
    check({
      group: 'text · accent', pair: '--on-accent on .btn-primary:hover',
      fg: 'var(--on-accent)', bg: 'color-mix(in srgb, var(--accent) 88%, var(--ink))', min: TEXT_MIN,
    });

    /* --- C. the four states, as text on planes and graphics on glass -------- */
    let worstStateText = Infinity, worstStateGlass = Infinity;
    for (const s of STATES) {
      worstStateText = Math.min(worstStateText, check({ group: 'text · states', pair: `--${s} on --raised`, fg: `var(--${s})`, bg: 'var(--raised)', min: TEXT_MIN }));
      worstStateGlass = Math.min(worstStateGlass, check({ group: 'graphic · states', pair: `--${s} on --gl-worst`, fg: `var(--${s})`, bg: 'var(--gl-worst)', min: CTRL_MIN, kind: 'graphic', note: 'glyph or edge only' }));
    }
    cell.stateText = worstStateText;
    cell.stateGlass = worstStateGlass;

    /* --- D. focus ring, on every plane it can land on ---------------------- */
    let worstFocus = Infinity;
    for (const bg of ['--bg', '--surface', '--raised', '--gl-worst']) {
      worstFocus = Math.min(worstFocus, check({ group: 'graphic · focus ring', pair: `--focus on ${bg}`, fg: 'var(--focus)', bg: `var(${bg})`, min: CTRL_MIN, kind: 'graphic' }));
    }
    cell.focus = worstFocus;

    /* --- E. controls -------------------------------------------------------- */
    cell.gauge = check({ group: 'graphic · controls', pair: '.gauge-fill on .gauge track', fg: 'var(--accent)', bg: 'var(--line)', min: CTRL_MIN, kind: 'graphic', note: 'determinate bar against its track' });
    check({ group: 'graphic · controls', pair: '--line on --surface', fg: 'var(--line)', bg: 'var(--surface)', min: 1.10, kind: 'delta', note: 'a hairline must be visible at all — decorative, exempt from 1.4.11' });
    check({ group: 'text · controls', pair: '--ink-2 on .chip', fg: 'var(--ink-2)', bg: 'color-mix(in srgb, var(--ink) 8%, var(--surface))', min: TEXT_MIN, note: '.chip label' });
    check({ group: 'text · controls', pair: '--ink on .chip-accent', fg: 'var(--ink)', bg: 'color-mix(in srgb, var(--accent) 16%, var(--surface))', min: TEXT_MIN, note: '.chip-accent label' });
    check({ group: 'text · controls', pair: '--ink-3 on .field placeholder', fg: 'var(--ink-3)', bg: 'var(--bg)', min: CTRL_MIN, kind: 'graphic', note: 'placeholder — not content, 1.4.11 threshold' });

    /* --- F. the state chips, parsed out of primitives.css ------------------- */
    const fills = [];
    for (const name of STATES) {
      const d = stateDecls(name);
      if (!d) {
        record({ theme, ground, group: 'state grammar', pair: `.state-${name}`, ratio: null, min: TEXT_MIN, pass: false, kind: 'ratio', note: 'ERROR no .state- rule in primitives.css' });
        continue;
      }
      check({ group: 'state · label on fill', pair: `.state-${name}: --st-ink on --st-fill`, fg: d['--st-ink'], bg: d['--st-fill'], min: TEXT_MIN });
      check({ group: 'state · key bar + glyph on fill', pair: `.state-${name}: --st-key on --st-fill`, fg: d['--st-key'], bg: d['--st-fill'], min: CTRL_MIN, kind: 'graphic' });
      check({ group: 'state · fill separates from the plane', pair: `.state-${name}: --st-fill vs --surface`, fg: d['--st-fill'], bg: 'var(--surface)', min: FILL_DELTA_MIN, kind: 'delta', note: 'greyscale separation' });
      try {
        const rgb = over(resolve(d['--st-fill'], vars), [128, 128, 128]);
        fills.push({ name, rgb, lum: relativeLuminance(rgb) });
      } catch { /* the check above already recorded the failure */ }
    }
    /* No two fills may collapse onto the same luminance, or the fill stops
       being a channel and the chip falls back to glyph + word alone. */
    const ladder = [...fills].sort((a, b) => a.lum - b.lum);
    for (let i = 1; i < ladder.length; i++) {
      const gap = ladder[i].lum - ladder[i - 1].lum;
      record({
        theme, ground, group: 'state · greyscale ladder', pair: `${ladder[i - 1].name} -> ${ladder[i].name}`,
        ratio: gap, min: LADDER_GAP_MIN, pass: gap >= LADDER_GAP_MIN, kind: 'lum', note: 'luminance step, not a ratio',
      });
    }

    /* --- G. the exclusions, on the binding ground --------------------------- */
    if (ground === 'dark') {
      exclusion({ pair: '--ink-3 on --raised as text', fg: 'var(--ink-3)', bg: 'var(--raised)', min: TEXT_MIN, note: 'why --ink-3 is not a text colour' });
      exclusion({ pair: '--ink-3 on --gl-worst as graphic', fg: 'var(--ink-3)', bg: 'var(--gl-worst)', min: CTRL_MIN, note: 'why --ink-3 is opaque planes only' });
      exclusion({ pair: '--accent-2 on --gl-worst as text', fg: 'var(--accent-2)', bg: 'var(--gl-worst)', min: TEXT_MIN, note: 'why --accent-2 is graphic only on glass' });
      exclusion({ pair: '--bad on --gl-worst as text', fg: 'var(--bad)', bg: 'var(--gl-worst)', min: TEXT_MIN, note: 'why a state colour never sits directly on glass' });
    }

    matrix.push(cell);
  }
}

/* =============================================================================
   6. STRUCTURAL LAWS — the ones that are not ratios.
   ============================================================================= */

const laws = [];
const law = (name, pass, note = '') => { if (!pass) failures++; laws.push({ name, pass, note }); };

/* 6.1 The two light blocks must be identical, declaration for declaration. */
{
  const a = ROOT_LIGHT_ATTR, b = ROOT_LIGHT_MEDIA;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const drift = [...keys].filter((k) => a[k] !== b[k]);
  law('the two light blocks in tokens.css are identical', drift.length === 0,
    drift.length ? `drift: ${drift.join(', ')}` : `${keys.size} declarations, both blocks`);
}

/* 6.2 A theme may declare the eight seeds and nothing else. This is what makes
   "a theme cannot alter structure" a fact rather than a convention. */
for (const [name, file] of Object.entries(themeCss)) {
  const sel = `:root[data-glass="${name}"]`;
  const d = declsFor(file, sel);
  if (!d) { law(`themes/${name}.css declares ${sel}`, false, 'selector not found'); continue; }
  const got = Object.keys(d).sort();
  const want = [...SEED_PROPS].sort();
  const extra = got.filter((k) => !want.includes(k));
  const missing = want.filter((k) => !got.includes(k));
  const otherRules = file.rules.filter((r) => r.selector !== sel);
  law(`themes/${name}.css declares exactly ${SEED_PROPS.length} seeds`,
    extra.length === 0 && missing.length === 0 && otherRules.length === 0,
    [extra.length ? `extra: ${extra.join(', ')}` : '',
     missing.length ? `missing: ${missing.join(', ')}` : '',
     otherRules.length ? `${otherRules.length} rule(s) outside ${sel}` : ''].filter(Boolean).join(' · ') || 'seeds only');
}

/* 6.3 The resolved lightness ladder must be numerically identical across every
   theme, on both grounds. Themes rotate hue; they do not move the ladder. */
{
  const LADDER_TOKENS = ['--bg', '--surface', '--raised', '--line', '--ink', '--ink-2', '--ink-3', '--accent', '--accent-2'];
  for (const ground of ['dark', 'light']) {
    for (const t of LADDER_TOKENS) {
      const ls = RUN_THEMES.map((theme) => {
        const vars = paletteVars(theme, ground);
        return oklabLightness(over(resolve(`var(${t})`, vars), [128, 128, 128]));
      });
      const spread = Math.max(...ls) - Math.min(...ls);
      law(`ladder invariant · ${t} (${ground})`, spread <= LADDER_L_TOLERANCE,
        `L ${(Math.min(...ls) * 100).toFixed(1)}%-${(Math.max(...ls) * 100).toFixed(1)}% across ${RUN_THEMES.length} themes, spread ${(spread * 100).toFixed(2)} pts`);
    }
  }
}

/* 6.4 Every var() in every stylesheet must resolve to a property declared
   somewhere. This is the check that stops a rename from silently painting an
   element with nothing. */
{
  const declared = new Set();
  const referenced = new Map();
  const files = [tokensCss, primitivesCss, ...Object.values(themeCss)];
  for (const f of files) {
    const bare = stripComments(f.raw);
    for (const m of bare.matchAll(/(--[\w-]+)\s*:/g)) declared.add(m[1]);
    for (const m of bare.matchAll(/var\(\s*(--[\w-]+)/g)) {
      if (!referenced.has(m[1])) referenced.set(m[1], f.path.split(/[\\/]/).pop());
    }
  }
  const dangling = [...referenced.keys()].filter((n) => !declared.has(n));
  law('every var() resolves to a declared property', dangling.length === 0,
    dangling.length ? `dangling: ${dangling.map((n) => `${n} (${referenced.get(n)})`).join(', ')}`
                    : `${referenced.size} names referenced, ${declared.size} declared`);
}

/* 6.5 Colour is never the only channel: every state carries a unique glyph and
   a unique word, so the status survives greyscale and colour-vision difference. */
{
  const glyphs = new Map(), labels = new Map();
  let ok = true;
  for (const name of STATES) {
    const d = stateDecls(name);
    if (!d || !d['--st-glyph'] || !d['--st-label']) { ok = false; continue; }
    const g = unescapeCssString(d['--st-glyph']), l = unescapeCssString(d['--st-label']);
    if (glyphs.has(g) || labels.has(l)) ok = false;
    glyphs.set(g, name); labels.set(l, name);
  }
  law('every state has a unique glyph and a unique word', ok,
    ok ? [...glyphs.keys()].map((g, i) => `${g} ${[...labels.keys()][i]}`).join(' · ') : 'collision or missing channel');
}

/* =============================================================================
   7. tokens.json — the same tokens as data, verified against the CSS.
   ============================================================================= */

function buildJson() {
  const structure = Object.fromEntries(
    ['--r-1', '--r-2', '--r-3', '--r-pill', '--t-fast', '--t-base', '--t-slow', '--ease',
     '--font-ui', '--font-mono', '--fs-0', '--fs-1', '--fs-2', '--fs-3',
     '--lh-1', '--lh-2', '--lh-3', '--target-min',
     '--sp-1', '--sp-2', '--sp-3', '--sp-4', '--sp-5', '--sp-6', '--sp-7', '--sp-8',
     '--z-dropdown', '--z-tooltip', '--z-toast', '--z-modal',
    ].map((k) => [k.replace(/^--/, ''), ROOT_DARK[k]]),
  );
  const COLOUR_TOKENS = ['--bg', '--surface', '--raised', '--line', '--ink', '--ink-2', '--ink-3',
    '--accent', '--accent-2', '--on-accent', '--ok', '--warn', '--bad', '--info'];
  const themes = {};
  for (const theme of ALL_THEMES) {
    const seeds = declsFor(themeCss[theme], `:root[data-glass="${theme}"]`) || {};
    const entry = { seeds: Object.fromEntries(SEED_PROPS.map((p) => [p.replace(/^--/, ''), seeds[p]])), resolved: {} };
    for (const ground of ['dark', 'light']) {
      const vars = paletteVars(theme, ground);
      entry.resolved[ground] = Object.fromEntries(
        COLOUR_TOKENS.map((t) => [t.replace(/^--/, ''), rgbToHex(over(resolve(`var(${t})`, vars), [128, 128, 128]))]),
      );
    }
    themes[theme] = entry;
  }
  return {
    name: '@abheet19/glass',
    note: 'Generated by scripts/contrast.mjs --emit-json. The CSS is the source of truth; this file mirrors it, and contrast.mjs fails if the two drift. `resolved` is each token flattened to sRGB hex for consumers that cannot evaluate oklch.',
    thresholds: { text: TEXT_MIN, graphic: CTRL_MIN, fillDelta: FILL_DELTA_MIN },
    structure,
    themes,
  };
}

const builtJson = buildJson();

if (EMIT_JSON) {
  writeFileSync(JSON_PATH, JSON.stringify(builtJson, null, 2) + '\n', 'utf8');
  console.log(`wrote ${JSON_PATH}`);
} else {
  let onDisk = null;
  try { onDisk = JSON.parse(readFileSync(JSON_PATH, 'utf8')); } catch { /* reported below */ }
  const same = onDisk !== null && JSON.stringify(onDisk) === JSON.stringify(builtJson);
  law('src/tokens.json still matches the CSS', ONLY_THEME ? true : same,
    ONLY_THEME ? 'skipped (--theme narrows the set)'
               : (same ? `${ALL_THEMES.length} themes x 2 grounds mirrored`
                       : 'drifted — run: node scripts/contrast.mjs --emit-json'));
}

/* =============================================================================
   8. OUTPUT
   ============================================================================= */

const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);
const fmt = (r, kind) => (r === null || Number.isNaN(r) ? '  -  ' : r.toFixed(kind === 'lum' ? 4 : 2));

console.log('');
console.log('  GLASS — CONTRAST BUDGET');
console.log(`  ${RUN_THEMES.length} themes x 2 grounds = ${RUN_THEMES.length * 2} palettes`);
console.log(`  text ${TEXT_MIN.toFixed(1)}:1 (WCAG 1.4.3) · graphic ${CTRL_MIN.toFixed(1)}:1 (WCAG 1.4.11) · fill delta ${FILL_DELTA_MIN.toFixed(2)}:1`);
console.log('');

/* --- the matrix: one row per palette, the ceiling that binds each column ---- */
const COLS = [
  ['ink/plane', 'inkPlane', TEXT_MIN], ['ink/glass', 'inkGlass', TEXT_MIN],
  ['ink2/plane', 'ink2Plane', TEXT_MIN], ['ink2/glass', 'ink2Glass', TEXT_MIN],
  ['ink3/plane', 'ink3Plane', CTRL_MIN], ['acc/plane', 'accPlane', TEXT_MIN],
  ['acc/glass', 'accGlass', TEXT_MIN], ['acc2/plane', 'acc2Plane', TEXT_MIN],
  ['acc2/glass', 'acc2Glass', CTRL_MIN], ['on-acc', 'onAcc', TEXT_MIN],
  ['state/txt', 'stateText', TEXT_MIN], ['state/gfx', 'stateGlass', CTRL_MIN],
  ['focus', 'focus', CTRL_MIN], ['gauge', 'gauge', CTRL_MIN],
];
const W = 16;
const rule = (ch) => ch.repeat(W + COLS.length * 11);
console.log(rule('='));
console.log(`  ${pad('PALETTE', W)}${COLS.map(([h]) => padL(h, 11)).join('')}`);
console.log(`  ${pad('min', W)}${COLS.map(([, , m]) => padL(m.toFixed(1), 11)).join('')}`);
console.log(rule('-'));
for (const c of matrix) {
  const cells = COLS.map(([, key, min]) => {
    const v = c[key];
    return padL(v === undefined || v === null ? '-' : `${v.toFixed(2)}${v >= min ? ' ' : '!'}`, 11);
  });
  console.log(`  ${pad(`${c.theme} · ${c.ground}`, W)}${cells.join('')}`);
}
console.log(rule('='));
console.log('  a "!" marks a ratio below its column minimum. plane = --raised, the lightest');
console.log('  opaque plane text may land on. glass = --gl-worst, the worst realistic');
console.log('  composite behind a .glass pane.');
console.log('');

/* --- the structural laws ---------------------------------------------------- */
console.log(rule('='));
console.log('  STRUCTURAL LAWS — the assertions that are not ratios');
console.log(rule('='));
for (const l of laws) console.log(`  ${l.pass ? 'PASS' : 'FAIL'}  ${pad(l.name, 52)} ${l.note}`);
console.log('');

/* --- every pair, on request -------------------------------------------------- */
if (VERBOSE) {
  const grouped = new Map();
  for (const r of rows) {
    const key = `${r.theme} · ${r.ground} · ${r.group}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(r);
  }
  for (const [key, groupRows] of grouped) {
    console.log(rule('-'));
    console.log(`  ${key.toUpperCase()}`);
    console.log(rule('-'));
    const w = Math.max(40, ...groupRows.map((r) => r.pair.length));
    for (const r of groupRows) {
      console.log(`  ${pad(r.pair, w)} ${padL(fmt(r.ratio, r.kind), 8)} ${padL(r.min.toFixed(r.kind === 'lum' ? 4 : 2), 8)}  ${r.pass ? 'PASS' : 'FAIL'}${r.note ? '  ' + r.note : ''}`);
    }
    console.log('');
  }
}

/* --- verdict ----------------------------------------------------------------- */
const total = rows.length + laws.length;
const passed = rows.filter((r) => r.pass).length + laws.filter((l) => l.pass).length;
console.log(rule('='));
if (failures === 0) {
  console.log(`  PASS — ${passed}/${total} assertions hold across ${RUN_THEMES.length * 2} palettes.`);
  console.log(rule('='));
  console.log('');
  process.exit(0);
} else {
  console.log(`  FAIL — ${failures} of ${total} assertions are below the budget:`);
  for (const r of rows.filter((x) => !x.pass)) {
    console.log(`         ${r.theme} · ${r.ground} · ${r.pair} — ${fmt(r.ratio, r.kind)} (needs ${r.min.toFixed(2)}) ${r.note}`);
  }
  for (const l of laws.filter((x) => !x.pass)) console.log(`         LAW ${l.name} — ${l.note}`);
  console.log(rule('='));
  console.log('');
  process.exit(1);
}
