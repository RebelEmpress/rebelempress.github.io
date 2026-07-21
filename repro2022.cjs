const { chromium } = require('/usr/lib/node_modules/playwright/index.mjs');
const V = process.argv[2] || '1238';
const PV = `https://rpzxufo7cgr7ocwi39ch.c.websim.com/?v=${V}`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
    extraHTTPHeaders: { referer: PV },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERR ' + e.message));

  await page.goto(PV, { waitUntil: 'load', referer: PV });
  await page.waitForTimeout(5000);

  // Click PLAY to open scenario selector
  await page.evaluate(() => { const b = document.getElementById('play-mode-btn'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  // Click Modern Day
  const clicked = await page.evaluate(() => {
    const b = document.getElementById('choice-modern-day');
    if (!b) return 'NO_BTN';
    b.click(); return 'CLICKED';
  });
  console.log('MODERNDAY', clicked);
  await page.waitForTimeout(9000);

  const diag = await page.evaluate(() => {
    const GS = window.GS || {};
    return {
      gameState: GS.gameState,
      scenarioCtx: GS.currentScenarioContext ? GS.currentScenarioContext.id : null,
      rawGeo: !!GS.rawGeoJsonData,
      countryCount: (GS.countryMetadata || []).length,
      modernEarth: GS.modernEarthImagery,
    };
  });
  console.log('DIAG', JSON.stringify(diag));
  await page.screenshot({ path: `/tmp/mw2022-v${V}.png` });
  console.log('ERRORS', errors.length, JSON.stringify(errors.slice(0, 12)));
  await browser.close();
})();
