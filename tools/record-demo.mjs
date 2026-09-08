/**
 * tools/record-demo.mjs — records the hero demo frames for docs/demo/glass-demo.gif.
 *
 * Every frame is a real screenshot of demo/index.html driven through its own
 * theme switcher; nothing here is mocked up. Frames land in docs/demo/.frames/
 * together with frames.json (per-frame hold durations), which tools/assemble_gif.py
 * turns into the committed GIF.
 *
 *   npm install            # playwright is a devDependency, never a runtime one
 *   npx playwright install chromium
 *   npm run record:demo
 *
 * Captured at 1280 CSS px on a 2x device scale (2560 px wide) so the downscale
 * to 1000 px supersamples and the table text stays crisp.
 */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'demo', '.frames');
const page_url = pathToFileURL(path.join(root, 'demo', 'index.html')).href;

const THEMES = ['zeno', 'weft', 'vantage', 'shield', 'textify', 'health', 'rephrase', 'detect'];

/* The storyboard. `at` is a section id (or 'top'); `hold` is milliseconds the
   frame stays on screen (capped and continuously sampled below — see capture()).
   Beat 1 is the switcher, beat 2 is the proof. */
const board = [
  // beat 1 — eight themes, one structure, dark ground. First beat holds long
  // enough to be a readable still (it is frame 0); the rest are brisk — this
  // is a switcher, and a switcher should read as fast flips, not a slideshow.
  ...THEMES.map((t, i) => ({ theme: t, ground: 'dark', at: 'ramp', hold: i === 0 ? 1400 : 550 })),
  // beat 1b — the same structure on the light ground
  ...['detect', 'health', 'vantage', 'zeno'].map(t => ({ theme: t, ground: 'light', at: 'ramp', hold: 550 })),
  // beat 2 — the contrast budget, recomputed live from the tokens. This is the
  // proof, so it gets a real beat to be read — capped, not frozen.
  { theme: 'zeno', ground: 'light', at: 'budget', hold: 1300 },
  { theme: 'weft', ground: 'dark', at: 'budget', hold: 1300 },
  { theme: 'textify', ground: 'dark', at: 'budget', hold: 1300 },
  { theme: 'zeno', ground: 'dark', at: 'budget', hold: 1400 },
];

const browser = await chromium.launch({ channel: process.env.GLASS_BROWSER_CHANNEL });
const page = await browser.newPage({
  viewport: { width: 1280, height: 820 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
  reducedMotion: 'reduce',
});
await page.goto(page_url, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelectorAll('[data-theme-btn]').length === 8);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const frames = [];
// Continuous capture, not snapshot-and-hold: each beat is sampled every
// ~100ms across its (capped) duration instead of one screenshot repeated for
// seconds. The theme swap itself is an instant CSS-variable flip (no
// transition to film), but sampling through the beat still catches any
// layout settle and keeps every held frame under the same ~1.3-1.4s ceiling.
const CAP_MS = 1400;
const SAMPLE_MS = 100;

for (const [i, shot] of board.entries()) {
  await page.evaluate(({ theme, ground, at }) => {
    document.querySelector(`[data-theme-btn="${theme}"]`).click();
    document.querySelector(`[data-ground="${ground}"]`).click();
    if (at === 'top') window.scrollTo(0, 0);
    else {
      // Leave the sticky bar clear of the section heading.
      const y = document.getElementById(at).getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.max(0, y - 96));
    }
  }, shot);

  const total = Math.min(shot.hold, CAP_MS);
  const n = Math.max(2, Math.round(total / SAMPLE_MS));
  const step = total / n;
  for (let s = 0; s < n; s++) {
    await page.waitForTimeout(step);
    const name = `frame-${String(i).padStart(3, '0')}-${String(s).padStart(2, '0')}.png`;
    await page.screenshot({ path: path.join(outDir, name) });
    frames.push({ file: name, hold: Math.round(step), theme: shot.theme, ground: shot.ground, at: shot.at });
  }
  process.stdout.write(`  beat ${i}  ${shot.theme} · ${shot.ground} · ${shot.at}  (${n} frames)\n`);
}

await writeFile(path.join(outDir, 'frames.json'), JSON.stringify({ width: 1000, frames }, null, 2));
await browser.close();

const total = frames.reduce((a, f) => a + f.hold, 0);
console.log(`\n  ${frames.length} frames, ${(total / 1000).toFixed(1)}s. Now: python tools/assemble_gif.py`);
