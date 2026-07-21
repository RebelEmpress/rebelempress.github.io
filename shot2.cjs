const { chromium } = require('playwright');
const PV = 'https://rpzxufo7cgr7ocwi39ch.c.websim.com/?v=1187';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
    extraHTTPHeaders: { referer: PV },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR ' + e.message));
  await page.goto(PV, { waitUntil: 'load', referer: PV });
  await page.waitForTimeout(9000);

  // Pan north so European land (Italy/Alps/Balkans) is under the zoom point, then zoom deep.
  const cx = 206, cy = 420;
  // drag map downward => view moves north onto Europe
  await page.mouse.move(cx, 300); await page.mouse.down();
  await page.mouse.move(cx, 600, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(1500);

  for (let i = 0; i < 6; i++) {
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(5000);

  const info = await page.evaluate(() => {
    const tiles = document.querySelectorAll('img.leaflet-tile');
    let loaded = 0, g = 0;
    tiles.forEach(t => { if (t.complete && t.naturalWidth>0) loaded++; if (/google/.test(t.src)) g++; });
    return { total: tiles.length, loaded, google: g };
  });
  console.log('TILES', JSON.stringify(info));
  await page.screenshot({ path: '/tmp/mw1186/europe-city.png' });
  console.log('ERRORS', errors.length, JSON.stringify(errors.slice(0,5)));
  await browser.close();
})();
