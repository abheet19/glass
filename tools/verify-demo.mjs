import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.GLASS_DEMO_URL || pathToFileURL(path.join(root, 'demo/index.html')).href;
const out = process.env.GLASS_EVIDENCE_DIR || path.join(root, 'docs/verification');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.GLASS_BROWSER_CHANNEL });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const checks = [];
const check = async (name, fn) => { await fn(); checks.push(name); };
try {
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('[data-theme-btn]').first().waitFor();
  await check('all eight themes on both grounds update selected controls and measured budget', async () => {
    for (const theme of ['zeno', 'weft', 'vantage', 'shield', 'textify', 'health', 'rephrase', 'detect']) {
      for (const ground of ['dark', 'light']) {
        await page.locator(`[data-theme-btn="${theme}"]`).click();
        await page.locator(`[data-ground="${ground}"]`).click();
        assert.equal(await page.locator('html').getAttribute('data-glass'), theme);
        assert.equal(await page.locator('html').getAttribute('data-theme'), ground);
        assert.equal(await page.locator(`[data-theme-btn="${theme}"]`).getAttribute('aria-pressed'), 'true');
        assert.ok((await page.locator('#budget-rows').innerText()).length > 100);
        assert.equal(await page.locator('#budget-rows').getByText('FAIL', { exact: true }).count(), 0);
      }
    }
  });
  await check('keyboard theme activation retains focus after redraw', async () => {
    await page.locator('[data-theme-btn="weft"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.themeBtn), 'weft');
  });
  await check('system ground follows preference and flat mode toggles off and on', async () => {
    await page.locator('[data-ground="system"]').click();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.querySelector('#bar-sub').textContent.includes('light (system)'));
    await page.locator('#flat').click();
    assert.equal(await page.locator('html').getAttribute('data-flat'), '1');
    await page.locator('#flat').click();
    assert.equal(await page.locator('html').getAttribute('data-flat'), null);
  });
  await check('gallery selection supports keyboard space', async () => {
    await page.locator('[data-pick="textify"]').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('html').getAttribute('data-glass'), 'textify');
  });
  await check('tabs implement roving focus, arrow keys, Home/End and connected panels', async () => {
    await page.getByRole('tab', { name: 'Overview', exact: true }).click();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab', { name: 'Tokens', exact: true }).getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#sample-panel-tokens').isVisible(), true);
    await page.keyboard.press('End');
    assert.equal(await page.locator('#sample-panel-themes').isVisible(), true);
    await page.keyboard.press('Home');
    assert.equal(await page.locator('#sample-panel-overview').isVisible(), true);
  });
  await check('tooltip works with focus and does not stay permanently visible', async () => {
    await page.locator('#sample-tab-overview').focus();
    await page.mouse.move(0, 0);
    assert.equal(await page.locator('#sample-tooltip').isVisible(), false);
    await page.locator('.tooltip-trigger').focus();
    assert.equal(await page.locator('#sample-tooltip').isVisible(), true);
  });
  await check('native fields and state specimen buttons respond', async () => {
    await page.locator('#d-ta').fill('Synthetic component check');
    assert.equal(await page.locator('#d-ta').inputValue(), 'Synthetic component check');
    await page.locator('#d-sel').selectOption({ label: 'weft' });
    assert.equal(await page.locator('#d-sel').inputValue(), 'weft');
    const checkbox = page.getByRole('checkbox', { name: 'Checkbox', exact: true });
    await checkbox.uncheck();
    assert.equal(await checkbox.isChecked(), false);
    for (const label of ['Primary', 'Quiet', 'Ghost', 'Glass']) {
      await page.locator('[data-sample-button]').filter({ hasText: new RegExp(`^${label}$`) }).click();
      assert.ok((await page.locator('#button-sample-status').innerText()).includes(label));
    }
    for (const action of ['Duplicate', 'Rename', 'Delete']) {
      await page.locator(`[data-menu-sample="${action}"]`).click();
      assert.ok((await page.locator('#menu-sample-status').innerText()).includes('no data was changed'));
    }
    assert.equal(await page.getByRole('button', { name: 'Disabled', exact: true }).isDisabled(), true);
  });
  await check('reduced motion stops skeleton animation', async () => {
    assert.equal(await page.locator('.skeleton').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  });
  await check('deep links select expected palette', async () => {
    const linked = new URL(url);
    linked.search = '?glass=weft&theme=dark&flat=1';
    await page.goto(linked.href);
    assert.equal(await page.locator('html').getAttribute('data-glass'), 'weft');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.locator('html').getAttribute('data-flat'), '1');
  });
  await page.locator('#flat').click();
  await page.screenshot({ path: path.join(out, 'glass-dark-weft.png'), fullPage: true });
  await check('mobile layout contains overflow within intended scroll containers', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  });
  await page.screenshot({ path: path.join(out, 'glass-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  const result = { url, checks, count: checks.length, browserErrors: errors, scope: 'Behavior and screenshots; contrast math is separately checked by npm run check. No pixel-baseline or consumer-app certification.' };
  await writeFile(path.join(out, 'browser-results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ checks: checks.length, browserErrors: errors, result: path.join(out, 'browser-results.json') }));
} finally { await browser.close(); }
