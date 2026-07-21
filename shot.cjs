const { chromium } = require('playwright');
const PV = 'https://rpzxufo7cgr7ocwi39ch.c.websim.com/?v=1187';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 }, // Pixel-ish phone portrait
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
    extraHTTPHeaders: { referer: PV },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERR ' + e.message));

  await page.goto(PV, { waitUntil: 'load', referer: PV });
  // Let the boot-to-map funnel land on the modern map + tiles load.
  await page.waitForTimeout(9000);

  // How many Google Earth satellite tiles actually loaded?
  const tileInfo = await page.evaluate(() => {
    const tiles = document.querySelectorAll('img.leaflet-tile');
    let loaded = 0, google = 0;
    tiles.forEach(t => { if (t.complete && t.naturalWidth > 0) loaded++; if (/google|mt1\.google/.test(t.src)) google++; });
    return { total: tiles.length, loaded, google, sample: tiles[0] ? tiles[0].src : null };
  });
  console.log('TILES', JSON.stringify(tileInfo));

  await page.screenshot({ path: '/tmp/mw1186/europe-default.png' });

  // Zoom into Europe: dispatch a few wheel-up events over the upper-centre (central Europe).
  const box = { x: 206, y: 380 };
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(box.x, box.y);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(1400);
  }
  await page.waitForTimeout(4000);

  const tileInfo2 = await page.evaluate(() => {
    const tiles = document.querySelectorAll('img.leaflet-tile');
    let loaded = 0; tiles.forEach(t => { if (t.complete && t.naturalWidth > 0) loaded++; });
    return { total: tiles.length, loaded };
  });
  console.log('TILES_ZOOMED', JSON.stringify(tileInfo2));

  await page.screenshot({ path: '/tmp/mw1186/europe-zoom.png' });
  console.log('ERRORS', errors.length, JSON.stringify(errors.slice(0, 8)));
  await browser.close();
})();
