const { chromium } = require('/usr/lib/node_modules/playwright/index.mjs');
const V = process.argv[2] || '1239';
const PV = `https://rpzxufo7cgr7ocwi39ch.c.websim.com/?v=${V}`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
    extraHTTPHeaders: { referer: PV },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { const t = m.text(); if (m.type() === 'error') errors.push(t); });

  // Fail ONLY the first fetch of the 2022 scenario JSON (after the attract demo
  // has already pulled it once on boot). Count modern-day fetches; abort the first
  // one that happens after we click, succeed afterwards.
  let clicked = false, failedOnce = false, fetchCount = 0;
  await page.route('**/data/world%20map%202022.json', async route => {
    if (clicked && !failedOnce) { failedOnce = true; fetchCount++; return route.abort('failed'); }
    fetchCount++; return route.continue();
  });

  await page.goto(PV, { waitUntil: 'load', referer: PV });
  await page.waitForTimeout(5000);
  await page.evaluate(() => { const b = document.getElementById('play-mode-btn'); if (b) b.click(); });
  await page.waitForTimeout(1200);
  clicked = true;
  await page.evaluate(() => { const b = document.getElementById('choice-modern-day'); if (b) b.click(); });
  await page.waitForTimeout(11000);
  await page.screenshot({ path: `/tmp/mw-flaky-v${V}.png` });
  console.log('FAILED_ONCE', failedOnce, 'FETCHES_AFTER_CLICK', fetchCount);
  console.log('ERRORS', errors.length, JSON.stringify(errors.slice(0, 8)));
  await browser.close();
})();
