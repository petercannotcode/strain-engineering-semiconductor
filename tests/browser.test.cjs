"use strict";
// Optional browser QA: install Playwright separately or use a supplied NODE_PATH.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href);
    for (const [width, height] of [[1366, 768], [1440, 900], [768, 1024], [390, 844], [320, 800]]) {
      await page.setViewportSize({ width, height });
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        panels: [...document.querySelectorAll('.dashboard .panel')].map(panel => {
          const bounds = panel.getBoundingClientRect();
          return { bottom: bounds.bottom, contentBottom: Math.max(...[...panel.children].map(child => child.getBoundingClientRect().bottom)) };
        })
      }));
      assert(!metrics.overflow, `Horizontal overflow at ${width}`);
      for (const panel of metrics.panels) assert(panel.contentBottom <= panel.bottom, `Panel content overflow at ${width}`);
      if (width >= 1366) assert(metrics.panels.every(panel => panel.bottom <= height), `Desktop panels below fold at ${width}`);
      if ([1366, 390].includes(width)) await page.screenshot({ path: path.join(__dirname, `dashboard-${width}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    for (const mode of ['biaxial', 'uniaxial']) {
      await page.locator(`input[value="${mode}"]`).check();
      for (const strain of [-2, 0, 2]) {
        await page.locator('#strain-magnitude').fill(String(strain));
        await page.locator('#strain-magnitude').dispatchEvent('input');
        for (const temperature of [100, 600]) {
          await page.locator('#temperature').fill(String(temperature));
          await page.locator('#temperature').press('Tab');
          for (const axis of ['x', 'y', 'z']) {
            await page.locator('#transport-axis').selectOption(axis);
            assert(!/NaN|Infinity|undefined/.test(await page.locator('main').innerHTML()));
            const state = await page.evaluate(() => ({ m: strainState.magnitude, mode: strainState.mode, t: strainState.temperature, a: strainState.transportAxis }));
            assert.deepEqual(state, { m: strain / 100, mode, t: temperature, a: axis });
          }
        }
      }
    }
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => ({ m: strainState.magnitude, mode: strainState.mode, t: strainState.temperature, a: strainState.transportAxis })), { m: 0, mode: 'biaxial', t: 300, a: 'x' });
    assert.equal(await page.locator('#mobility-ratio').textContent(), '1.000×');
    assert((await page.locator('#device-result').textContent()).includes('+0.0%'));
    await page.locator('.model-notes > summary').click();
    assert.equal(await page.locator('.model-notes').getAttribute('open'), '');
    await page.locator('#tensile-scenario').click();
    assert.equal(await page.evaluate(()=>strainState.magnitude), .005);
    await page.locator('#compare-toggle').click();
    assert.equal(await page.locator('#compare-toggle').getAttribute('aria-pressed'),'true');
    assert((await page.locator('#band-drawing').innerHTML()).includes('#8994a8'));
    await page.locator('#challenge-toggle').click();
    assert(await page.locator('#challenge-content').isVisible());
    assert.deepEqual(errors, []);
    console.log('Browser QA passed: five viewport sizes, panel containment, desktop visibility, 36 mode/strain/temperature/direction combinations, reset and model notes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
