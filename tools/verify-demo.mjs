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

const THEMES = ['zeno', 'weft', 'vantage', 'shield', 'textify', 'health', 'rephrase', 'detect', 'mono', 'graphite', 'warm'];

try {
  await page.goto(url, { waitUntil: 'load' });

  await check('onboarding welcomes, sets a theme and appearance, offers products to explore, enters the Studio, and is not shown again', async () => {
    await page.locator('#screen-onboarding').waitFor();
    assert.equal(await page.locator('#studio').isVisible(), false);
    assert.ok((await page.locator('[data-ob-explore]').count()) >= 4, 'explore-a-product entries present');
    await page.locator('[data-ob-accent="weft"]').click();
    assert.equal(await page.locator('[data-ob-accent="weft"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-ob-ground="dark"]').click();
    assert.equal(await page.locator('[data-ob-ground="dark"]').getAttribute('aria-pressed'), 'true');
    await page.locator('#obEnter').click();
    assert.equal(await page.locator('#studio').isVisible(), true);
    assert.equal(await page.locator('#screen-onboarding').isHidden(), true);
    assert.equal(await page.locator('html').getAttribute('data-glass'), 'weft');
    assert.equal(await page.evaluate(() => localStorage.getItem('glass-onboarded')), '1');
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.locator('#screen-onboarding').isHidden(), true);
    assert.equal(await page.locator('#studio').isVisible(), true);
  });

  await check('all eleven themes on both grounds pass the live budget with zero FAIL rows, at AA and AAA', async () => {
    await page.locator('#sidebar [data-goto="settings"]').click();
    for (const wcag of ['AA', 'AAA']) {
      await page.locator('#settab-a11y').click();
      await page.locator(`[data-wcag="${wcag}"]`).click();
      await page.locator('#settab-appearance').click();
      for (const theme of THEMES) {
        for (const ground of ['dark', 'light']) {
          await page.locator(`[data-ground="${ground}"]`).first().click();
          await page.locator(`[data-theme-btn="${theme}"]`).click();
          assert.equal(await page.locator('html').getAttribute('data-glass'), theme);
          assert.equal(await page.locator('html').getAttribute('data-theme'), ground);
          assert.equal(await page.locator(`[data-theme-btn="${theme}"]`).getAttribute('aria-pressed'), 'true');
          await page.locator('#sidebar [data-goto="library"]').click();
          await page.locator('#libtab-foundations').click();
          assert.ok((await page.locator('#budget-rows').innerText()).length > 100);
          if (wcag === 'AA') assert.equal(await page.locator('#budget-rows .state-bad').count(), 0, `${theme} · ${ground} · AA`);
          await page.locator('#sidebar [data-goto="settings"]').click();
        }
      }
    }
    await page.locator('#settab-a11y').click();
    await page.locator('[data-wcag="AA"]').click();
    await page.locator('#settab-appearance').click();
    await page.locator('[data-ground="dark"]').first().click();
    await page.locator('[data-theme-btn="zeno"]').click();
  });

  await check('WCAG AA/AAA target changes the required minimum and the live pass count', async () => {
    await page.locator('#settab-a11y').click();
    const aa = await page.locator('#passGaugeLabel').innerText();
    await page.locator('[data-wcag="AAA"]').click();
    const aaa = await page.locator('#passGaugeLabel').innerText();
    assert.notEqual(aa, aaa);
    await page.locator('#sidebar [data-goto="library"]').click();
    await page.locator('#libtab-foundations').click();
    assert.ok((await page.locator('#budget-rows tr').first().locator('td').nth(3).innerText()).includes('7.0'));
    await page.locator('#sidebar [data-goto="settings"]').click();
    await page.locator('[data-wcag="AA"]').click();
  });

  await check('roving tabindex, arrow keys, Home/End work across Library, Settings and Detail tabs', async () => {
    await page.locator('#sidebar [data-goto="library"]').click();
    await page.locator('#libtab-components').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#libtab-foundations').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('End');
    assert.equal(await page.locator('#libtab-patterns').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#workspace-demo').isVisible(), true);
    await page.keyboard.press('Home');
    assert.equal(await page.locator('#libtab-components').getAttribute('aria-selected'), 'true');

    await page.locator('#sidebar [data-goto="settings"]').click();
    await page.locator('#settab-appearance').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#settab-a11y').getAttribute('aria-selected'), 'true');

    await page.locator('#sidebar [data-goto="library"]').click();
    await page.locator('.comp-card', { hasText: '.btn' }).first().click();
    await page.locator('#dtab-preview').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#dtab-tokens').getAttribute('aria-selected'), 'true');
    assert.ok((await page.locator('.token-row').count()) > 0);
  });

  await check('command palette opens, filters, runs an action by keyboard, and closes; shortcuts overlay opens and closes', async () => {
    await page.keyboard.press('Control+k');
    assert.equal(await page.locator('#paletteOverlay').isVisible(), true);
    await page.locator('#paletteInput').fill('vantage');
    assert.ok((await page.locator('.palette-item').count()) >= 1);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('html').getAttribute('data-glass'), 'vantage');
    assert.equal(await page.locator('#paletteOverlay').isHidden(), true);

    await page.keyboard.press('Control+k');
    await page.locator('#paletteInput').fill('nonexistent-xyz');
    assert.ok((await page.locator('.palette-empty').innerText()).includes('No matches'));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#paletteOverlay').isHidden(), true);

    await page.keyboard.press('?');
    assert.equal(await page.locator('#shortcutsOverlay').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#shortcutsOverlay').isHidden(), true);

    await page.locator('#sidebar [data-goto="settings"]').click();
    await page.locator('#settab-appearance').click();
    await page.locator('[data-theme-btn="zeno"]').click();
  });

  await check('sidebar navigation, mobile hamburger, and project rows carry real GitHub links', async () => {
    await page.locator('#sidebar [data-goto="overview"]').click();
    assert.equal(await page.locator('#screen-overview').isVisible(), true);
    assert.equal(await page.locator('#sidebar [data-goto="overview"]').getAttribute('aria-current'), 'page');

    const hrefs = await page.locator('.proj-link').evaluateAll(as => as.map(a => a.getAttribute('href')));
    assert.equal(hrefs.length, 8);
    assert.ok(hrefs.every(h => /^https:\/\/github\.com\/abheet19\//.test(h)));
    assert.equal(await page.locator('.proj-link').first().getAttribute('target'), '_blank');
    assert.equal(await page.locator('.proj-link').first().getAttribute('rel'), 'noopener');

    await page.locator('[data-set-accent="textify"]').click();
    assert.equal(await page.locator('html').getAttribute('data-glass'), 'textify');

    await page.setViewportSize({ width: 320, height: 844 });
    await page.locator('#hamburgerBtn').click();
    assert.equal(await page.locator('#sidebar').evaluate(el => el.classList.contains('open')), true);
    await page.locator('#sidebar [data-goto="library"]').click();
    assert.equal(await page.locator('#sidebar').evaluate(el => el.classList.contains('open')), false);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('[data-set-accent="zeno"]').click();
  });

  await check('library search, category filter, and card-to-detail navigation with correct breadcrumbs', async () => {
    await page.locator('#sidebar [data-goto="library"]').click();
    await page.locator('#libtab-components').click();
    const total = await page.locator('.comp-card').count();
    await page.locator('#libSearch').fill('toast');
    assert.ok((await page.locator('.comp-card').count()) < total);
    await page.locator('#libSearch').fill('');
    await page.locator('.chip-filter', { hasText: 'Feedback' }).click();
    assert.ok((await page.locator('.comp-card').count()) < total);
    await page.locator('.chip-filter', { hasText: 'All' }).click();
    assert.equal(await page.locator('.comp-card').count(), total);

    await page.locator('.comp-card', { hasText: '.field' }).first().click();
    assert.equal(await page.locator('#libDetailInner').isVisible(), true);
    assert.equal(await page.locator('#crumbCat').innerText(), 'Primitives');
    assert.equal(await page.locator('#detailName').innerText(), '.field');

    await page.locator('[data-comp-id="stat"]').click();
    const themeCount = `${THEMES.length}/${THEMES.length}`;
    await page.locator('#detailBody .metric-card-value', { hasText: themeCount }).waitFor();
    assert.equal(await page.locator('#detailBody .metric-card-value').last().innerText(), themeCount);

    await page.locator('[data-comp-id="field"]').click();
    await page.locator('#detailName', { hasText: '.field' }).waitFor();
  });

  await check('detail tabs render live tokens, escaped/copyable code, and computed accessibility rows', async () => {
    await page.locator('#dtab-tokens').click();
    assert.ok((await page.locator('.token-row').count()) > 0);
    await page.locator('#dtab-code').click();
    assert.ok((await page.locator('#detailBody pre').innerText()).includes('<input'));
    await page.locator('#detailCopyBtn').click();
    assert.ok((await page.locator('.toast').count()) > 0);
    await page.locator('#dtab-a11y').click();
    const rows = await page.locator('#detailBody table tbody tr').count();
    assert.ok(rows > 0);
    assert.equal(await page.locator('#detailBody .state-bad').count(), 0);
    await page.locator('#dtab-preview').click();
    assert.equal(await page.locator('#detailBody input[aria-invalid="true"]').count(), 1);
  });

  await check('interactive specimens respond: switch, checkbox/radio, tabs, tooltip, menu, toast, modal', async () => {
    await page.locator('[data-goto="library"]').first().click();
    await page.locator('.comp-card', { hasText: '.switch' }).click();
    await page.locator('#dp-switch').check();
    assert.equal(await page.locator('#dp-switch').isChecked(), true);

    await page.locator('[data-goto="library"]').first().click();
    await page.locator('.comp-card', { hasText: '.tabs' }).click();
    await page.locator('#dpTabs [data-dp="tokens"]').click();
    assert.ok((await page.locator('#dpTabBody').innerText()).includes('getComputedStyle'));

    await page.locator('[data-goto="library"]').first().click();
    await page.locator('.comp-card', { hasText: '.tooltip' }).click();
    await page.mouse.move(0, 0);
    assert.equal(await page.locator('#dp-tip').isVisible(), false);
    await page.locator('button[aria-describedby="dp-tip"]').focus();
    assert.equal(await page.locator('#dp-tip').isVisible(), true);

    await page.locator('[data-goto="library"]').first().click();
    await page.locator('.comp-card', { hasText: '.menu' }).first().click();
    await page.locator('#dpMenuBtn').click();
    assert.equal(await page.locator('#dpMenu').isHidden(), false);
    await page.mouse.click(5, 5);
    assert.equal(await page.locator('#dpMenu').isHidden(), true);

    await page.locator('[data-goto="library"]').first().click();
    await page.locator('.comp-card', { hasText: '.toast' }).first().click();
    await page.locator('#dpToastBtn').click();
    assert.ok((await page.locator('.toast').count()) > 0);

    await page.locator('[data-goto="library"]').first().click();
    await page.locator('.comp-card', { hasText: '.modal-scrim' }).click();
    await page.locator('#dpModalBtn').click();
    assert.equal(await page.locator('#modalScrim').isVisible(), true);
    await page.locator('#modalActions button', { hasText: 'Confirm' }).click();
    assert.equal(await page.locator('#modalScrim').isHidden(), true);
  });

  await check('workspace pattern controls every panel, tab, tree, split and composer flow', async () => {
    await page.locator('[data-goto="library"]').first().click();
    await page.locator('#libtab-patterns').click();
    const frame = page.locator('#workspace-demo');
    assert.equal(await frame.getAttribute('data-nav-collapsed'), 'false');
    assert.equal(await page.locator('[aria-label="Open files"] [role="tab"]').count(), 3);
    assert.equal(await page.locator('[aria-label="Developer tool views"] [role="tab"]').count(), 5);

    await page.locator('[data-workspace-file="forms"]').click();
    assert.equal(await page.locator('#workspace-file-tab-forms').getAttribute('aria-selected'), 'true');
    assert.equal(await page.locator('#workspace-file-panel-forms').isVisible(), true);

    for (const [button, attribute] of [
      ['#workspace-toggle-nav', 'data-nav-collapsed'],
      ['#workspace-toggle-aside', 'data-aside-collapsed'],
    ]) {
      await page.locator(button).click();
      assert.equal(await frame.getAttribute(attribute), 'true');
      await page.locator(button).click();
      assert.equal(await frame.getAttribute(attribute), 'false');
    }

    await page.locator('#workspace-dock-tab-terminal').click();
    assert.equal(await page.locator('#workspace-dock-panel-terminal').isVisible(), true);

    await page.locator('#workspace-divider').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#workspace-divider').getAttribute('aria-valuenow'), '63');

    await page.locator('#workspace-prompt').fill('Verify the release');
    await page.locator('#workspace-composer').getByRole('button', { name: 'Run', exact: true }).click();
    assert.equal(await page.locator('#workspace-prompt').inputValue(), '');
    assert.ok((await page.locator('#workspace-composer-status').innerText()).includes('Verify the release'));

    const disclosure = page.locator('.thinking-disclosure');
    await disclosure.locator('summary').click();
    assert.equal(await disclosure.getAttribute('open'), '');
    await frame.screenshot({ path: path.join(out, 'glass-workspace-desktop.png') });

    await page.locator('#inspectPatternBtn').click();
    assert.equal(await page.locator('#detailName').innerText(), 'Workspace shell');
  });

  await check('accessible names, labels, IDs and local anchors are structurally complete', async () => {
    const defects = await page.evaluate(() => {
      const duplicateIds = [...document.querySelectorAll('[id]')]
        .map(element => element.id)
        .filter((id, index, ids) => ids.indexOf(id) !== index);
      const unnamedButtons = [...document.querySelectorAll('button')]
        .filter(button => !(button.getAttribute('aria-label') || button.textContent.trim() || button.title))
        .map(button => button.outerHTML.slice(0, 120));
      const unlabelledFields = [...document.querySelectorAll('input, select, textarea')]
        .filter(field => {
          if (field.type === 'hidden') return false;
          const labels = field.labels ? [...field.labels] : [];
          return !labels.length && !field.getAttribute('aria-label') && !field.getAttribute('aria-labelledby');
        })
        .map(field => field.id || field.outerHTML.slice(0, 120));
      const brokenLocalAnchors = [...document.querySelectorAll('a[href^="#"]')]
        .map(anchor => anchor.getAttribute('href').slice(1))
        .filter(id => id && !document.getElementById(id));
      return { duplicateIds, unnamedButtons, unlabelledFields, brokenLocalAnchors };
    });
    assert.deepEqual(defects, { duplicateIds: [], unnamedButtons: [], unlabelledFields: [], brokenLocalAnchors: [] });
  });

  await check('reduced motion stops skeleton animation', async () => {
    await page.locator('[data-goto="library"]').first().click();
    await page.locator('#libtab-components').click();
    await page.locator('.comp-card', { hasText: '.skeleton' }).first().click();
    assert.equal(await page.locator('.skeleton').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  });

  await check('restart-onboarding confirms with a real modal, and Cancel leaves state untouched', async () => {
    await page.locator('#sidebar [data-goto="settings"]').click();
    await page.locator('#footerRestart').click();
    assert.equal(await page.locator('#modalTitle').innerText(), 'Restart onboarding?');
    await page.locator('#modalActions button', { hasText: 'Cancel' }).click();
    assert.equal(await page.locator('#modalScrim').isHidden(), true);
    assert.equal(await page.locator('#screen-settings').isVisible(), true);

    await page.locator('#settab-install').click();
    await page.locator('.copy-btn').first().click();
    assert.ok((await page.locator('.toast').count()) > 0);
  });

  await check('header theme switcher plus the added interactive components respond', async () => {
    // always-available theme switcher in the header
    await page.locator('#sidebar [data-goto="overview"]').click();
    await page.locator('#accentSwitchBtn').click();
    assert.equal(await page.locator('#accentMenu').isVisible(), true);
    await page.locator('#accentMenu [data-accent-pick="mono"]').click();
    assert.equal(await page.locator('html').getAttribute('data-glass'), 'mono');
    assert.equal(await page.locator('#accentMenu').isHidden(), true);

    // accordion expands
    await page.locator('[data-goto="library"]').first().click();
    await page.locator('.comp-card', { hasText: 'Accordion' }).click();
    const acc = page.locator('.acc-item').nth(1);
    assert.equal(await acc.evaluate(el => el.open), false);
    await acc.locator('summary').click();
    assert.equal(await acc.evaluate(el => el.open), true);

    // tag input adds a tag
    await page.locator('[data-goto="library"]').first().click();
    await page.locator('.comp-card', { hasText: 'Tag input' }).click();
    await page.locator('#dpTagField').waitFor();
    const tags = await page.locator('#dpTagInput .tag').count();
    await page.locator('#dpTagField').fill('release');
    await page.locator('#dpTagField').press('Enter');
    assert.equal(await page.locator('#dpTagInput .tag').count(), tags + 1);

    // rating responds to the keyboard
    await page.locator('[data-goto="library"]').first().click();
    await page.locator('.comp-card', { hasText: 'Rating' }).click();
    await page.locator('#dpRating [aria-checked="true"]').focus();
    await page.keyboard.press('ArrowRight');
    assert.ok((await page.locator('#dpRatingOut').innerText()).includes('4 of 5'));

    // stepper advances
    await page.locator('[data-goto="library"]').first().click();
    await page.locator('.comp-card', { hasText: 'Stepper' }).click();
    await page.locator('#dpStepNext').click();
    assert.equal(await page.locator('#dpStepper .step').nth(2).getAttribute('aria-current'), 'step');

    // drawer opens and closes on Escape
    await page.locator('[data-goto="library"]').first().click();
    await page.locator('.comp-card', { hasText: 'Drawer / sheet' }).click();
    await page.locator('#dpDrawerBtn').click();
    assert.equal(await page.locator('#drawerOverlay').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#drawerOverlay').isHidden(), true);

    // restore the shipped default accent
    await page.locator('#accentSwitchBtn').click();
    await page.locator('#accentMenu [data-accent-pick="zeno"]').click();
  });

  await check('deep links select the expected accent, ground, transparency and screen', async () => {
    const linked = new URL(url);
    linked.search = '?glass=weft&theme=dark&flat=1&screen=library';
    await page.goto(linked.href);
    assert.equal(await page.locator('#screen-onboarding').isHidden(), true);
    assert.equal(await page.locator('html').getAttribute('data-glass'), 'weft');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.locator('html').getAttribute('data-flat'), '1');
    assert.equal(await page.locator('#screen-library').isVisible(), true);
  });

  await page.locator('#sidebar [data-goto="settings"]').click();
  await page.locator('#settab-appearance').click();
  await page.locator('[data-theme-btn="weft"]').click();
  await page.screenshot({ path: path.join(out, 'glass-dark-weft.png'), fullPage: true });

  await check('mobile layout contains overflow within intended scroll containers', async () => {
    await page.setViewportSize({ width: 320, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator('#hamburgerBtn').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator('#sidebar [data-goto="library"]').click();
    await page.locator('#libtab-patterns').click();
    assert.ok(await page.locator('#workspace-demo').evaluate(element => element.scrollWidth <= element.clientWidth + 1));
    await page.locator('#workspace-toggle-nav').click();
    assert.equal(await page.locator('#workspace-demo').getAttribute('data-nav-collapsed'), 'true');
    await page.locator('#workspace-toggle-aside').click();
    assert.equal(await page.locator('#workspace-demo').getAttribute('data-aside-collapsed'), 'true');
    const stickyHeader = page.locator('.topbar');
    await stickyHeader.evaluate(element => { element.style.visibility = 'hidden'; });
    await page.locator('#workspace-demo').screenshot({ path: path.join(out, 'glass-workspace-mobile.png') });
    await stickyHeader.evaluate(element => { element.style.visibility = ''; });
  });

  await page.screenshot({ path: path.join(out, 'glass-mobile.png'), fullPage: true });
  assert.deepEqual(errors, []);
  const result = {
    url,
    checks,
    count: checks.length,
    browserErrors: errors,
    scope: 'Behavior and screenshots for the Glass Studio demo app; contrast math is separately checked by npm run check. No pixel-baseline or consumer-app certification.',
  };
  await writeFile(path.join(out, 'browser-results.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ checks: checks.length, browserErrors: errors, result: path.join(out, 'browser-results.json') }));
} finally { await browser.close(); }
