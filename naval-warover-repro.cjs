// Repro: do ship "ghost" sprites (GS.navalLandings) and transport boats (GS.boats)
// persist after a war ends? Start a coastal war, run until landing ghosts exist,
// force a peace treaty (-> WAR_OVER), then inspect what still lives + would draw.
const { chromium, devices } = require("playwright");
const A = process.argv[2] || "peru";
const B = process.argv[3] || "colombia";
const URL = `https://rpzxufo7cgr7ocwi39ch.c.websim.com/`; // live 1306
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices["Pixel 5"], extraHTTPHeaders: { referer: URL } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(`PAGEERR ${e.message}`));
  page.on("console", m => { if (m.type() === "error") errors.push(`CONSOLEERR ${m.text()}`); });

  await page.goto(URL, { waitUntil: "domcontentloaded", referer: URL });
  await page.waitForTimeout(3500);
  try { await page.click('#play-mode-btn', { timeout: 3000 }); await page.waitForTimeout(1000); } catch (e) {}
  try { await page.click('#scroller-choice-modern', { timeout: 3000 }); await page.waitForTimeout(1200); } catch (e) {}
  try { await page.click('#enter-scenario-btn', { timeout: 4000 }); } catch (e) {}
  await page.waitForTimeout(9000);

  await page.evaluate(async () => {
    window.__s = await import('./state.js');
    window.__e = await import('./engine-simulation.js');
    window.__m = await import('./main.js');
    window.__d = await import('./war-diplomacy.js');
  });

  async function startWar() {
    return page.evaluate(({ ra, rb }) => {
      const GS = window.__s.GS;
      const find = re => GS.countryMetadata.findIndex(m => m && new RegExp(re, "i").test(m.name));
      const ia = find(ra), ib = find(rb);
      if (ia < 0 || ib < 0) return { ok: false, why: "country not found" };
      const mk = idx => { const m = GS.countryMetadata[idx]; return { id: idx + 1, name: m.name, color: m.color, role: "OFFENSE", strategy: "BALANCED", buffState: "none" }; };
      window.__m.resetToSelection();
      GS.sides = [[mk(ia)], [mk(ib)]];
      GS.activeSideIndex = 0;
      const btn = document.getElementById("start-btn");
      if (btn) { btn.disabled = false; btn.click(); }
      return { ok: true, a: GS.sides[0][0].name, b: GS.sides[1][0].name };
    }, { ra: A, rb: B });
  }

  const started = await startWar();
  if (!started.ok) { console.log(JSON.stringify({ started })); await browser.close(); process.exit(1); }

  // Run until at least one naval landing ghost exists (ships dropped troops).
  let ghostsBefore = 0, boatsBefore = 0, waited = 0;
  for (let i = 0; i < 80; i++) {
    const snap = await page.evaluate(() => {
      const GS = window.__s.GS;
      return { gs: GS.gameState, ghosts: (GS.navalLandings || []).length, boats: (GS.boats || []).length, units: (GS.units || []).length, frame: GS.simFrameCount };
    });
    ghostsBefore = snap.ghosts; boatsBefore = snap.boats; waited = i;
    if (snap.gs !== 'SIMULATING') { await startWar(); await sleep(3000); continue; }
    if (snap.ghosts > 0) break;
    await sleep(1500);
  }

  // Force a peace treaty -> WAR_OVER, then IMMEDIATELY inspect (before the 2.5s auto reset).
  const afterWarOver = await page.evaluate(() => {
    const GS = window.__s.GS;
    window.__d.applyTreaty('PEACE_TREATY');
    // Would the render draw ghosts/boats now? ghost-draw is ungated by gameState;
    // boat-draw is gated to SIMULATING.
    return {
      gs: GS.gameState,
      ghosts: (GS.navalLandings || []).length,
      boats: (GS.boats || []).length,
      units: (GS.units || []).length,
      ghostDrawGatedByState: false, // main.js:2251 has no gameState check
      boatDrawGatedByState: true,   // main.js:2282 requires SIMULATING
    };
  });

  // Wait past the auto reset-to-selection (2.5s) and re-check: ghosts still there = frozen leftovers.
  await sleep(3200);
  const afterReset = await page.evaluate(() => {
    const GS = window.__s.GS;
    return { gs: GS.gameState, ghosts: (GS.navalLandings || []).length, boats: (GS.boats || []).length, units: (GS.units || []).length };
  });

  console.log(JSON.stringify({
    started, sampledTicks: waited, ghostsBefore, boatsBefore,
    afterWarOver, afterReset,
    verdict: {
      ghostsLeakPastWarOver: afterWarOver.ghosts > 0,        // drawn (ungated) => visible frozen ships
      ghostsLeakIntoSelection: afterReset.ghosts > 0,
      boatsLeakArray: afterWarOver.boats > 0,                 // stale data, not drawn (gated)
    },
    errors: errors.slice(0, 8), errCount: errors.length
  }, null, 2));
  await browser.close();
}
main().catch(e => { console.error("FATAL", e); process.exit(1); });
