// capture-reel60.mjs — records a smooth 60fps showcase reel of the REDESIGNED glass
// Studio, driven against the LIVE GitHub Pages deployment.
//
// The flow is the real product story, in the order a first-time visitor sees it:
//
//   1. Onboarding hue-picker — the eight themes are wearable live; we try a few so
//      the whole page re-skins (Zeno crimson → Weft teal → Vantage gold → HealthFlow).
//   2. Skip setup → the Studio shell (Overview).
//   3. Library → Components — the component gallery, scrolled through its groups.
//   4. A component detail — one card opened into its detail screen.
//   5. A per-project "what it uses" view — pick a project in the sidebar and watch the
//      whole specimen set re-skin to that product's accent.
//
// Playwright records the session as .webm against a fresh profile (so onboarding shows).
// ffmpeg then produces TWO artifacts:
//   • docs/media/glass-reel.mp4  — H.264, ~1280px wide, a true 60fps clip. The source
//     video is ~25fps, so we motion-interpolate to 60 (minterpolate, fps=60) for
//     genuinely smooth playback, then encode with -r 60.
//   • docs/media/glass-demo.gif  — a smaller looping GIF for the README, palette-optimised.
//
// Run:  node tools/capture-reel60.mjs
//       GLASS_URL=http://127.0.0.1:8080 node tools/capture-reel60.mjs   (against a local build)
//       FFMPEG=/path/to/ffmpeg node tools/capture-reel60.mjs            (if ffmpeg is not on PATH)
//
// Prereqs: npm install && npx playwright install chromium

import { chromium } from 'playwright';
import { mkdirSync, statSync, rmSync, mkdtempSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync, execSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const MEDIA = join(ROOT, 'docs', 'media');
const BASE = (process.env.GLASS_URL ?? 'https://abheet19.github.io/glass/').replace(/\/$/, '');
const VIEWPORT = { width: 1280, height: 800 };
const MP4 = join(MEDIA, 'glass-reel.mp4');
const GIF = join(MEDIA, 'glass-demo.gif');

mkdirSync(MEDIA, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Find an ffmpeg for the webm → mp4/gif conversions. Prefers $FFMPEG, then PATH,
 *  then the known winget install path on this machine. */
function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {
    /* not on PATH */
  }
  const winget =
    'C:/Users/abhee/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe';
  try {
    execSync(`"${winget}" -version`, { stdio: 'ignore' });
    return winget;
  } catch {
    throw new Error('ffmpeg not found — set $FFMPEG to its full path.');
  }
}

/** Smoothly scroll the main content column by `delta` px over `ms`, in small steps,
 *  so the recorded video carries real motion frames for minterpolate to work on. */
async function smoothScroll(page, sel, delta, ms) {
  const steps = Math.max(6, Math.round(ms / 60));
  const per = delta / steps;
  for (let i = 0; i < steps; i++) {
    await page.evaluate(([s, d]) => {
      const el = document.querySelector(s);
      if (el) el.scrollTop += d;
    }, [sel, per]);
    await sleep(ms / steps);
  }
}

async function main() {
  const ffmpeg = findFfmpeg();
  console.log(`glass 60fps reel → ${BASE}  (ffmpeg: ${ffmpeg})`);

  // Warm the origin once (GitHub Pages is static, but this is honest belt-and-braces
  // in case the deploy target ever moves behind an auto-stopping host).
  try {
    execSync(`curl -s -o NUL --max-time 30 "${BASE}/demo/"`, { stdio: 'ignore', shell: true });
  } catch {
    /* warmup is best-effort */
  }

  const tmp = mkdtempSync(join(tmpdir(), 'glass-reel60-'));
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
    recordVideo: { dir: tmp, size: VIEWPORT },
  });
  const t0 = Date.now(); // recording begins ~here
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  // The root redirects to ./demo/; go straight there to skip the redirect flash.
  await page.goto(`${BASE}/demo/`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Fresh profile → onboarding is shown. Wait for the hue-picker to be live.
  await page.locator('#screen-onboarding').waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForFunction(
    () => document.querySelectorAll('#obAccentGrid [data-ob-accent]').length >= 8,
    { timeout: 45000 },
  );
  await sleep(1200); // let the reader take in "Pick the hue that's you."
  const tStart = Date.now(); // the interesting motion starts here

  // ---- Beat 1: the hue-picker. Wear a few themes; the whole page re-skins live. ----
  for (const theme of ['weft', 'vantage', 'health', 'zeno']) {
    const tile = page.locator(`#obAccentGrid [data-ob-accent="${theme}"]`);
    await tile.scrollIntoViewIfNeeded().catch(() => {});
    await tile.hover().catch(() => {});
    await sleep(240);
    await tile.click().catch(() => {});
    await sleep(620);
  }
  await sleep(500);

  // ---- Beat 2: Skip setup → the Studio shell. ----
  await page.locator('#obSkip').click();
  await page.locator('#screen-overview').waitFor({ state: 'visible', timeout: 20000 });
  await sleep(1100);

  // ---- Beat 3: Library → Components, scrolled through its groups. ----
  await page.locator('#sidebar [data-goto="library"]').click();
  await page.locator('#libtab-components').click().catch(() => {});
  await page.waitForFunction(
    () => document.querySelectorAll('#compGrid .comp-card').length > 4,
    { timeout: 20000 },
  );
  await page.evaluate(() => { const c = document.getElementById('content'); if (c) c.scrollTop = 0; });
  await sleep(700);
  // Walk down through the gallery groups.
  await smoothScroll(page, '#content', 520, 1500);
  await sleep(500);
  await smoothScroll(page, '#content', 560, 1500);
  await sleep(500);
  await smoothScroll(page, '#content', 560, 1500);
  await sleep(600);
  // Back up a little to frame a card we'll open.
  await smoothScroll(page, '#content', -720, 1100);
  await sleep(500);

  // ---- Beat 4: open a component detail. ----
  const card = page.locator('#compGrid .comp-card').first();
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(300);
  await card.hover().catch(() => {});
  await sleep(300);
  await card.click();
  await page.locator('#screen-detail').waitFor({ state: 'visible', timeout: 20000 });
  await sleep(1400);
  await smoothScroll(page, '#content', 360, 1000);
  await sleep(900);

  // ---- Beat 5: a per-project "what it uses" view. ----
  // Projects render into the sidebar as [data-set-accent] rows → openProject().
  const proj = page.locator('#projList [data-set-accent="vantage"]').first();
  await proj.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await proj.hover().catch(() => {});
  await sleep(300);
  await proj.click();
  await page.locator('#screen-project').waitFor({ state: 'visible', timeout: 20000 });
  await page.evaluate(() => { const c = document.getElementById('content'); if (c) c.scrollTop = 0; });
  await sleep(1300);
  await smoothScroll(page, '#content', 520, 1500);
  await sleep(600);
  // Re-skin once more: pick another product so the whole specimen set re-colours.
  const proj2 = page.locator('#projList [data-set-accent="zeno"]').first();
  await proj2.click().catch(() => {});
  await sleep(900);
  await page.evaluate(() => { const c = document.getElementById('content'); if (c) c.scrollTop = 0; });
  await smoothScroll(page, '#content', 460, 1400);
  await sleep(1200); // hold on the finished frame

  const tEnd = Date.now();
  const video = page.video();
  await context.close(); // flushes the .webm
  await browser.close();
  const webm = await video.path();

  const trimStart = Math.max(0, (tStart - t0) / 1000 - 0.3);
  const duration = (tEnd - tStart) / 1000 + 0.6;
  console.log(`  webm ${webm} — trim from ${trimStart.toFixed(2)}s for ${duration.toFixed(2)}s`);

  // ---- MP4: true 60fps via motion interpolation. ----
  // minterpolate synthesises intermediate frames (mci/aobmc) so the ~25fps source
  // plays as a smooth 60fps clip; -r 60 stamps the output rate.
  const mp4Vf =
    'minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir,scale=1280:-2:flags=lanczos,format=yuv420p';
  const mp4Args = [
    '-y', '-ss', trimStart.toFixed(2), '-t', duration.toFixed(2), '-i', webm,
    '-vf', mp4Vf, '-r', '60',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-movflags', '+faststart',
    '-an', MP4,
  ];
  console.log('  encoding 60fps mp4 (minterpolate — this takes a while)…');
  let r = spawnSync(ffmpeg, mp4Args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg mp4 exited ${r.status}`);

  // ---- GIF: a smaller looping teaser for the README, palette-optimised. ----
  // Derived from the finished MP4 (not the raw webm) and capped to a punchy window —
  // the hue-picker re-skin through the gallery scroll — at a reduced fps/width so it
  // stays a few MB and loops well inside a README. The full flow lives in the MP4.
  const GIF_WINDOW = Math.min(12, duration); // seconds
  const gifVf =
    'fps=13,scale=560:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4';
  const gifArgs = [
    '-y', '-ss', '0.5', '-t', GIF_WINDOW.toFixed(2), '-i', MP4,
    '-filter_complex', gifVf, '-loop', '0', GIF,
  ];
  console.log('  encoding looping gif…');
  r = spawnSync(ffmpeg, gifArgs, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg gif exited ${r.status}`);

  rmSync(tmp, { recursive: true, force: true });
  const mp4Mb = (statSync(MP4).size / 1024 / 1024).toFixed(2);
  const gifMb = (statSync(GIF).size / 1024 / 1024).toFixed(2);
  console.log(`  wrote ${MP4} (${mp4Mb} MB, 60fps)`);
  console.log(`  wrote ${GIF} (${gifMb} MB)`);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
