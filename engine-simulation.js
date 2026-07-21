// Engine module extracted from main.js — engine-simulation
import L from 'leaflet';
import { deepClone } from './utils.js';
import { getTranslation } from './translations.js';
import { CONFIG } from './config.js';
import { initAudio, playExplosionSound, playWarAmbiance, playWarStartSound } from './audio.js';
import { GS } from './state.js';
import * as DOM from './dom.js';
import { SPEED_STEPS, UNIT_HASH_CELL_SIZE, getOptimizationFactor, loadingBar, loadingStatus, map, setLoadingThematic, setSpeed, updateRestartVisibility } from './main.js';
import { findCodeByName, generatePuppetFlag, getEffectiveBuffState } from './flags.js';
import { computeAdjacency, getControlValue, getGridIndex, recalculateAllBounds } from './map-geo.js';
import { computeEncircledCoarse } from './encirclement.js';
import { updatePersistentInfluence, updateSidesUI } from './sides-ui.js';
import { advanceTutorial } from './ui-tutorial.js';
import { applyTreaty, capitulateCountry, handleRebellionPeace, recruitNeutralMidWar, showTreatyOffer } from './war-diplomacy.js';

export function spawnSingleUnit(sideIdx, sovereignId, team, preferEnemyFront = false) {
    // Enforce per‑side unit cap: if this side is already at or above the limit, do not spawn.
    const sideUnits = GS.units.filter(u => u.sideIndex === sideIdx).length;
    if (sideUnits >= CONFIG.MAX_UNITS_PER_SIDE) return false;

    // Note: Nations can continue to raise new units even if their displayed personnel pool is exhausted.
    // This prevents a hard "dead state" where they are permanently unable to fight.
    const theaterIndices = [];
    const frontlines = [];
    const isTeamA = team === 'A';
    const supplyFailed = GS.capitalLostCountries && GS.capitalLostCountries.has(sovereignId);
    
    // Efficiently find recruitment-eligible territory
    const step = Math.max(1, Math.floor(GS.landMask.length / 500000));
    for (let i = 0; i < GS.landMask.length; i += step) {
        if (GS.landMask[i] === 2 && GS.worldControlMap[i] === sovereignId) {
            const occ = GS.occupationMap[i];
            if ((isTeamA && occ > 0.5) || (!isTeamA && occ < -0.5)) {
                theaterIndices.push(i);
                
                // Fast check if this recruitment cell is on a border
                const neighbors = [i + 1, i - 1, i + GS.gridWidth, i - GS.gridWidth];
                let isF = false;
                for (const n of neighbors) {
                    if (n >= 0 && n < GS.landMask.length) {
                        const nId = GS.worldControlMap[n];
                        if (nId > 0 && nId !== sovereignId) {
                            const nSide = GS.sides.findIndex(s => s.some(c => c.id === nId));
                            if (nSide !== -1 && (nSide !== sideIdx)) {
                                isF = true;
                                break;
                            }
                        }
                    }
                }
                if (isF) frontlines.push(i);
            }
        }
    }

    if (theaterIndices.length === 0) return false;

    let idx;
    let isFromFront = false;

    // When we want reinforcements close to the enemy (losing but not on the brink),
    // bias heavily toward true frontline cells, falling back to interior if none exist.
    if (preferEnemyFront && frontlines.length > 0 && !supplyFailed) {
        idx = frontlines[Math.floor(Math.random() * frontlines.length)];
        isFromFront = true;
    } else if (frontlines.length > 0 && (Math.random() < 0.85 || supplyFailed)) {
        // Default behaviour: strong but not absolute preference for frontlines
        idx = frontlines[Math.floor(Math.random() * frontlines.length)];
        isFromFront = true;
    } else {
        idx = theaterIndices[Math.floor(Math.random() * theaterIndices.length)];
    }

    const y = Math.floor(idx / GS.gridWidth);
    const x = idx % GS.gridWidth;
    
    // Calculate direction away from enemies for pushback
    let vx = 0, vy = 0;
    if (isFromFront) {
        const neighbors = [
            { id: idx + 1, dx: 1, dy: 0 },
            { id: idx - 1, dx: -1, dy: 0 },
            { id: idx + GS.gridWidth, dx: 0, dy: 1 },
            { id: idx - GS.gridWidth, dx: 0, dy: -1 }
        ];
        for (const n of neighbors) {
            if (n.id >= 0 && n.id < GS.landMask.length) {
                const nId = GS.worldControlMap[n.id];
                if (nId > 0 && nId !== sovereignId) {
                    const nSide = GS.sides.findIndex(s => s.some(c => c.id === nId));
                    if (nSide !== -1 && (nSide !== sideIdx)) {
                        vx -= n.dx;
                        vy -= n.dy;
                    }
                }
            }
        }
    }
    
    const mag = Math.sqrt(vx*vx + vy*vy);
    // Reduced pushback to stay within sovereign borders (0.35x grid resolution)
    const pushBack = isFromFront && mag > 0 ? (CONFIG.GRID_RES * 0.35) : 0;
    const pvx = mag > 0 ? vx/mag : 0;
    const pvy = mag > 0 ? vy/mag : 0;

    let lat = (y * CONFIG.GRID_RES) - 90 + (Math.random() - 0.5) * CONFIG.GRID_RES * 0.8 + (pvy * pushBack);
    let lng = (x * CONFIG.GRID_RES) - 180 + (Math.random() - 0.5) * CONFIG.GRID_RES * 0.8 + (pvx * pushBack);

    // Sovereign Integrity Check: Ensure units don't spawn in neighbors (like France when Belgium is fighting Germany)
    const finalIdx = getGridIndex(lat, lng);
    if (finalIdx === -1 || GS.worldControlMap[finalIdx] !== sovereignId) {
        // Fallback to strict cell center to guarantee sovereign location
        lat = (y * CONFIG.GRID_RES) - 90 + (CONFIG.GRID_RES / 2);
        lng = (x * CONFIG.GRID_RES) - 180 + (CONFIG.GRID_RES / 2);
    }

    const isMountainCell = GS.terrainMask && GS.terrainMask[idx] > 0.35;
    // Alpenjägers: mostly drawn from mountainous recruitment cells
    const isAlpen = isMountainCell && Math.random() < 0.4;

    // Base health for this new unit
    let unitHealth = CONFIG.UNIT_HEALTH * (isAlpen ? CONFIG.ALPEN_HEALTH_MULT : 1);
    // When supply has failed (capital captured), newly raised units are under‑equipped and fragile
    if (supplyFailed) {
        unitHealth *= 0.4; // 60% health penalty
    }

    GS.units.push({
        id: Math.random(),
        lat,
        lng,
        team,
        sideIndex: sideIdx,
        sovereignId: sovereignId,
        beneficiaryId: sovereignId,
        isAlpenjager: !!isAlpen,
        health: unitHealth,
        lastAttack: 0,
        deployTicks: 30 // Exactly 0.5 seconds at 60fps
    });

    // Whenever a new unit is recruited mid‑war, restore personnel for that side
    // using the same dynamic soldiers‑per‑unit scaling used for casualties.
    if (team === 'A') {
        GS.teamASoldiers += GS.soldiersPerUnitA;
    } else if (team === 'B') {
        GS.teamBSoldiers += GS.soldiersPerUnitB;
    }

    return true;
}

export function setGameTimeFromInputs() {
    if (!DOM.timeSystemCheckbox || !DOM.timeSystemCheckbox.checked) {
        GS.gameTimeEnabled = false;
        GS.gameTimeDate = null;
        GS.gameTimeAccumulatorMs = 0;
        if (DOM.gameDateDisplay) DOM.gameDateDisplay.style.display = 'none';
        return;
    }
    const y = parseInt(DOM.timeYearInput.value || '0', 10);
    const m = parseInt(DOM.timeMonthInput.value || '0', 10);
    const d = parseInt(DOM.timeDayInput.value || '0', 10);
    if (!y || !m || !d) {
        // fallback default if user left blanks
        GS.gameTimeDate = { year: 1936, month: 1, day: 1 };
    } else {
        GS.gameTimeDate = { year: y, month: m, day: d };
    }
    GS.gameTimeEnabled = true;
    GS.gameTimeAccumulatorMs = 0;
    if (DOM.gameDateDisplay) {
        DOM.gameDateDisplay.style.display = 'block';
        DOM.gameDateDisplay.textContent = formatGameDate();
    }
}

export function formatGameDate() {
    if (!GS.gameTimeDate) return '0000/00/00';
    const y = GS.gameTimeDate.year.toString().padStart(4, '0');
    const m = GS.gameTimeDate.month.toString().padStart(2, '0');
    const d = GS.gameTimeDate.day.toString().padStart(2, '0');
    return `${y}/${m}/${d}`;
}

export function daysInMonth(year, month) {
    if (month === 1 || month === 3 || month === 5 || month === 7 || month === 8 || month === 10 || month === 12) return 31;
    if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
    // February
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    return isLeap ? 29 : 28;
}

export function advanceGameDateOneDay() {
    if (!GS.gameTimeEnabled || !GS.gameTimeDate) return;
    GS.gameTimeDate.day += 1;
    const dim = daysInMonth(GS.gameTimeDate.year, GS.gameTimeDate.month);
    if (GS.gameTimeDate.day > dim) {
        GS.gameTimeDate.day = 1;
        GS.gameTimeDate.month += 1;
        if (GS.gameTimeDate.month > 12) {
            GS.gameTimeDate.month = 1;
            GS.gameTimeDate.year += 1;
        }
    }
    if (DOM.gameDateDisplay) {
        DOM.gameDateDisplay.textContent = formatGameDate();
    }
}

export function tickGameTime(elapsedMs) {
    if (!GS.gameTimeEnabled || GS.gameState !== 'SIMULATING' || GS.isPaused || !GS.gameTimeDate) return;
    // Scale in-game time progression with the current simulation speed
    GS.gameTimeAccumulatorMs += elapsedMs * GS.simSpeed;
    const step = 500; // 0.5 seconds per day at 1x speed
    while (GS.gameTimeAccumulatorMs >= step) {
        advanceGameDateOneDay();
        GS.gameTimeAccumulatorMs -= step;
    }
}

// Build an auto conflict name from the participating sides, e.g.
// "RUSSIA VS UKRAINE AND POLAND". Countries within a side are joined with AND,
// sides are joined with VS (works for 2+ sides / FFA).
function buildDefaultConflictName() {
    const sideNames = (GS.sides || [])
        .map(side => (side || [])
            .map(c => (c && c.name ? c.name : '').toUpperCase())
            .filter(Boolean)
            .join(' AND '))
        .filter(s => s.length);
    return sideNames.join(' VS ');
}

// Show/hide the conflict-name banner under the status panel.
function renderConflictNameBanner() {
    const el = DOM.conflictNameBanner;
    if (!el) return;
    const name = GS.conflictName || '';
    if (name) {
        el.textContent = name;
        el.style.display = 'block';
    } else {
        el.textContent = '';
        el.style.display = 'none';
    }
}

export async function startWar() {
    const activeSides = GS.sides.filter(s => s.length > 0);
    if (activeSides.length < 2) {
        alert("Please assign countries to at least two sides.");
        return;
    }

    // Drop empty sides (e.g. the unused default Side C) before the war runs. This keeps a
    // 2-real-side war at length 2 so multi-side code paths gated on `GS.sides.length > 2`
    // (capture-by-presence) stay off — 2-side wars run byte-identical to before.
    GS.sides = activeSides;
    if (GS.activeSideIndex >= GS.sides.length) GS.activeSideIndex = GS.sides.length - 1;
    GS.attackers = GS.sides[0];
    GS.defenders = GS.sides[1];

    // Performance protection: show loading overlay while mobilizing giant nations
    setLoadingThematic(false);
    DOM.loadingOverlay.style.display = 'flex';
    loadingStatus.innerText = getTranslation('LOADING');
    loadingBar.style.width = "0%";
    
    // Yield to allow UI to render the loader
    await new Promise(r => setTimeout(r, 50));
    
    initAudio().then(() => {
        playWarAmbiance();
    });
    playWarStartSound();

    // Capture a clean snapshot of the scenario just before the war starts
    // so QUICK RESTART can restore it instantly with no loading screen.
    GS.initialWorldControlMapSnapshot = GS.worldControlMap ? new Int32Array(GS.worldControlMap) : null;
    GS.initialDeJureMapSnapshot = GS.deJureMap ? new Int32Array(GS.deJureMap) : null;
    GS.initialProvinceMapSnapshot = GS.provinceMap ? new Int32Array(GS.provinceMap) : null;
    GS.initialLandMaskSnapshot = GS.landMask ? new Uint8Array(GS.landMask) : null;
    GS.initialBiomeMaskSnapshot = GS.biomeMask ? new Uint8Array(GS.biomeMask) : null;
    GS.initialCountryMetadataSnapshot = deepClone(GS.countryMetadata);
    GS.initialCitiesSnapshot = deepClone(GS.cities);

    const attackers = GS.sides[0] || [];
    const defenders = GS.sides[1] || [];

    GS.teamAId = attackers.length > 0 ? attackers[0].id : -1;

    // Initialize time system for this war
    setGameTimeFromInputs();

    // Read optional manual manpower overrides from the setup inputs
    const mpAInput = document.getElementById('manpower-side-a');
    const mpBInput = document.getElementById('manpower-side-b');
    const parsedA = mpAInput ? parseInt(mpAInput.value, 10) : NaN;
    const parsedB = mpBInput ? parseInt(mpBInput.value, 10) : NaN;
    GS.manualSideAManpower = (!isNaN(parsedA) && parsedA > 0) ? parsedA : null;
    GS.manualSideBManpower = (!isNaN(parsedB) && parsedB > 0) ? parsedB : null;

    GS.gameState = 'SIMULATING';
    GS.isPaused = false;

    // Fresh "fight on after capital falls" decisions for this war (sticky within a war,
    // reset between wars so a nation re-rolls each time regardless of how the war was started).
    GS.fightOnCountries = new Set();
    GS.fightOnDecided = new Set();

    // Cinematic Mode logic
    GS.cinematicMode = document.getElementById('cinematic-mode-checkbox')?.checked || false;
    if (GS.cinematicMode) {
        document.getElementById('game-status').style.display = 'none';
        document.getElementById('stats-panel').style.display = 'none';
        
        // Start Recording
        try {
            const canvas = GS.influenceLayer._container;
            GS.recordedChunks = [];
            const stream = canvas.captureStream(30); // 30fps recording
            GS.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
            GS.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) GS.recordedChunks.push(e.data);
            };
            GS.mediaRecorder.start();
        } catch (e) {
            console.warn("MediaRecorder failed to start:", e);
        }
    } else {
        document.getElementById('game-status').style.display = 'flex';
        document.getElementById('stats-panel').style.display = 'block';
    }
    DOM.pauseBtn.innerText = '⏸';
    DOM.pauseBtn.style.background = '#f39c12';
    GS.lastTreatyTime = Date.now();
    GS.sideACasualties = 0;
    GS.sideBCasualties = 0;
    GS.countryCasualties.clear();
    GS.sides.flat().forEach(c => GS.countryCasualties.set(c.id, 0));
    GS.frameAccumulator = 0;
    GS.simFrameCount = 0;
    GS.simTickCount = 0; // per-tick counter gating encirclement (see performSimulationTick)
    GS.cachedP1LandScore = undefined; // reset cached land-score scan for the new war
    GS.stalemateAnchorScore = undefined; // reset frozen-front deadlock tracker for the new war
    GS.stalemateAnchorFrame = 0;
    setSpeed(1); // Conflicts start at 0.5 speed (Index 1 in SPEED_STEPS)
    
    // Initialize diplomacy and technology toggles
    GS.peaceTreatiesDisabled = DOM.noPeaceCheckbox.checked;
    // Capitulation rule: capital captured -> country surrenders and is annexed by the captor.
    GS.annexOnCapital = !!(DOM.annexOnCapitalCheckbox && DOM.annexOnCapitalCheckbox.checked);
    GS.annexedCountries = new Set(); // fires once per country per war
    // WAR GOALS: if the attacker pre-marked specific enemy land (during the claim phase),
    // a victory annexes ONLY the marked tiles; each defeated defender keeps the rest of its
    // original territory. Enabled only when the toggle is on AND tiles were actually marked.
    {
        const _wgCb = document.getElementById('war-goals-checkbox');
        if (_wgCb && _wgCb.checked && GS.warGoalCells && GS.warGoalCells.size > 0) {
            GS.warGoalsEnabled = true;
            // Persist the defender (pole B / odd side index) country ids so the war-end
            // partition can restore each defender's snapshot even after sides shrink.
            GS.warGoalDefenderIds = new Set();
            GS.sides.forEach((s, idx) => { if (idx % 2 === 1) s.forEach(c => GS.warGoalDefenderIds.add(c.id)); });
        } else {
            GS.warGoalsEnabled = false;
            GS.warGoalCells = null;
            GS.warGoalDefenderIds = null;
        }
    }
    GS.capitalDecided = new Set();   // capital-capture PUPPET decision is permanent; fight-on is only provisional
    GS.capitalReconsider = new Map(); // sovId -> frame at which a "fight on" country re-weighs surrender
    GS.capitalFightOnCount = new Map(); // sovId -> how many times it has chosen to fight on
    GS.capitalFightOnLand = new Map(); // sovId -> land fraction it held when its capital first fell (surrender baseline)
    GS.puppetCountries = new Set();
    GS.dominanceAnchorFrame = undefined; // decisive-dominance war-ender: frame the war became ≥95% one-sided
    GS.decisiveAnchorFrame = undefined;  // second-tier ender: frame the war became ≥85% one-sided (equal-nation softlock)
    // Warfare doctrine: a war-wide style that reshapes how fronts move and how bloody
    // the fighting is. We precompute flat multipliers here (read once) so the per-unit
    // hot loop just multiplies three numbers — no per-frame string compares.
    //   dealt = damage this unit deals · taken = damage it suffers · speed = advance rate
    GS.warDoctrine = (DOM.doctrineSelect && DOM.doctrineSelect.value) || 'standard';
    const DOCTRINE_MODS = {
        standard:  { dealt: 1.0, taken: 1.0,  speed: 1.0 },  // Combined Arms — unchanged baseline
        blitz:     { dealt: 1.4, taken: 1.1,  speed: 1.5 },  // fast, hard-hitting breakthroughs
        trench:    { dealt: 1.0, taken: 1.5,  speed: 0.45 }, // slow, grinding, very bloody static fronts
        guerrilla: { dealt: 0.7, taken: 0.7,  speed: 1.6 },  // mobile, evasive hit-and-run
    };
    GS.doctrineMods = DOCTRINE_MODS[GS.warDoctrine] || DOCTRINE_MODS.standard;

    // Conflict name: use the player's text if they typed one, else auto-name from the
    // countries fighting (e.g. "RUSSIA VS UKRAINE AND POLAND"). Shows in a banner at the
    // top of the map, just below the game status panel.
    const customConflictName = (DOM.conflictNameInput && DOM.conflictNameInput.value.trim()) || '';
    GS.conflictName = customConflictName || buildDefaultConflictName();
    renderConflictNameBanner();
    
    const startYear = (GS.gameTimeEnabled && GS.gameTimeDate) ? GS.gameTimeDate.year : 2024;
    // Historical technology gate: bombs/missiles are disabled for any scenario starting before 1942
    let isHistoricalGateActive = (GS.gameTimeEnabled && startYear < 1942);
    
    // Also look at the scenario name to decide if this is a pre-missile era
    const scName = (GS.currentScenarioContext?.name || "").toLowerCase();
    const preMissileKeywords = ["1936", "1914", "1804", "1492", "1 ad", "napoleonic", "ww1", "great war", "renaissance", "classical", "antique"];
    if (preMissileKeywords.some(k => scName.includes(k))) {
        isHistoricalGateActive = true;
    }

    GS.bombsDisabled = DOM.disableBombsCheckbox.checked || !GS.missilesEnabled || isHistoricalGateActive;
    // NO NAVAL ATTACKS (owner ask 2026-07-07): no boats spawn and land units never
    // walk into open sea, so the whole naval layer (ferries, sea combat, landing
    // ghosts) is inert — troops just fight the land fronts they can reach.
    GS.navalDisabled = !!(DOM.noNavalCheckbox && DOM.noNavalCheckbox.checked);

    DOM.statusText.innerText = GS.ffaMode ? "Free For All Active" : "Global Conflict Active";
    recalculateAllBounds();
    DOM.setupPanel.style.display = 'none';
    DOM.statsPanel.style.display = 'block';
    DOM.casualtyPanel.style.display = 'flex';
    DOM.resetBtn.style.display = 'block';
    updateRestartVisibility();
    
    // Final sync of mountain and province state before sim starts
    GS.mountainsEnabled = !DOM.setupDisableMountainsCheckbox.checked;
    GS.provincesEnabled = !DOM.setupDisableProvincesCheckbox.checked;
    document.getElementById('speed-controls').style.display = 'flex';
    DOM.godModeBtn.style.display = 'block';
    if (GS.godModeActive) DOM.godBombBtn.style.display = 'block';
    DOM.forcePeaceBtn.style.display = 'block';
    DOM.unitCountsDiv.style.display = 'flex';
    DOM.treatyAlert.style.display = 'none';

    const getCode = (feat) => {
        if (!feat || !feat.properties) return "un";
        const p = feat.properties;
        let code = p.ISO_A2 || p.iso_a2 || p.ISO_A2_EH || p.iso_a2_eh || p.ADDR_A2 || "un";
        if (code === "-99") code = "un";
        return code.toLowerCase();
    }
    
    // Optimize: Single pass to count initial cells and set up masks/occupancy
    const countryToSideMap = new Map();
    const cellCounts = new Map();
    const countryIndices = new Map();
    const sidePoleIndices = { 'A': [], 'B': [] };

    // Ensure country bounds are up to date before we derive any war theater extents
    recalculateAllBounds();

    GS.initialCombatants = [];
    GS.sides.forEach((side, idx) => {
        side.forEach(c => {
            GS.initialCombatants.push({
                id: c.id,
                name: c.name,
                sideIndex: idx,
                pole: idx % 2 === 0 ? 0 : 1
            });
            countryToSideMap.set(c.id, idx);
            cellCounts.set(c.id, 0);
            countryIndices.set(c.id, []);
            
            // Flag initialization: Reuse existing flag objects from metadata to prevent flickering and redundant fetches
            const meta = GS.countryMetadata.find(m => m && m.id === c.id);
            if (meta && meta.tempFlag) {
                c.flag = meta.tempFlag;
            } else {
                c.flag = new Image();
                c.flag.crossOrigin = "anonymous";
                if (meta && meta.flagUrl) {
                    c.flag.src = meta.flagUrl;
                } else {
                    const nameCode = findCodeByName(c.name);
                    const src = nameCode ? `https://flagcdn.com/w80/${nameCode}.png` : (c.feature ? `https://flagcdn.com/w80/${getCode(c.feature)}.png` : null);
                    if (src) c.flag.src = src;
                }
                if (meta) meta.tempFlag = c.flag;
            }
            c.isCapitulated = false;
            c.isSaturated = false;
        });
    });

    GS.primaryOccupierMap.fill(0);
    
    // SATELLITE THEATER DEFINITION: 
    // Ensure we have complete, non-viewport-limited bounds for every country involved.
    // This fixes the "early frontline cutoff" bug in big countries.
    recalculateAllBounds(true);

    // Determine the minimal bounding box that covers all warring countries on the grid
    let minX = GS.gridWidth - 1;
    let maxX = 0;
    let minY = GS.gridHeight - 1;
    let maxY = 0;

    GS.countryMetadata.forEach(meta => {
        if (!meta) return;
        if (!countryToSideMap.has(meta.id)) return;
        if (!meta.bounds) return;
        minX = Math.min(minX, meta.bounds.minX);
        maxX = Math.max(maxX, meta.bounds.maxX);
        minY = Math.min(minY, meta.bounds.minY);
        maxY = Math.max(maxY, meta.bounds.maxY);
    });

    // Fallback to full map if bounds are invalid for some reason
    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY) ||
        minX < 0 || minY < 0 || maxX <= minX || maxY <= minY) {
        minX = 0;
        minY = 0;
        maxX = GS.gridWidth - 1;
        maxY = GS.gridHeight - 1;
    }

    // THE OPTIMIZED PASS: Only scan the war theater bounding box, chunked to keep UI responsive
    const regionWidth = (maxX - minX + 1);
    const regionHeight = (maxY - minY + 1);
    const regionTotalCells = regionWidth * regionHeight;
    const chunkSize = 250000; // Smaller chunks for smoother big-war startup

    let processed = 0;
    for (let y = minY; y <= maxY; y++) {
        const rowOffset = y * GS.gridWidth;
        for (let x = minX; x <= maxX; x++) {
            const i = rowOffset + x;
            const id = GS.worldControlMap[i];
            if (id > 0 && countryToSideMap.has(id)) {
                const sideIdx = countryToSideMap.get(id);
                const isPoleA = sideIdx % 2 === 0;
                const poleKey = isPoleA ? 'A' : 'B';
                
                GS.landMask[i] = 2; // Mark as war zone
                GS.occupationMap[i] = isPoleA ? 1.0 : -1.0;
                GS.primaryOccupierMap[i] = id;
                
                cellCounts.set(id, cellCounts.get(id) + 1);
                countryIndices.get(id).push(i);
                sidePoleIndices[poleKey].push(i);
            }
            processed++;
            if (processed % chunkSize === 0) {
                loadingBar.style.width = Math.min(90, (processed / regionTotalCells) * 70) + "%";
                // Yield back to the browser so the UI doesn't freeze on giant conflicts
                await new Promise(r => setTimeout(r, 0));
            }
        }
    }

    // Set counts back to country objects
    GS.sides.forEach(side => side.forEach(c => {
        c.initialCells = cellCounts.get(c.id) || 0;
    }));

    // --- GENERALS & BATTLE PLANS ---
    // Each side gets a "general" with a plan quality; underdogs with a brilliant plan get powerful buffs.
    GS.generals = [];
    const sideLand = GS.sides.map(side =>
        side.reduce((sum, c) => sum + (cellCounts.get(c.id) || 0), 0)
    );

    // Automatically switch to POLITICAL view at the start of every war for consistent visibility.
    GS.viewMode = 'POLITICAL';
    if (DOM.viewModeBtn) {
        DOM.viewModeBtn.innerText = "POLITICAL";
        DOM.viewModeBtn.style.background = "#3498db";
    }
    if (GS.influenceLayer && typeof GS.influenceLayer._update === 'function') {
        GS.influenceLayer._forceRender = true;
        GS.influenceLayer._update();
    }

    GS.sides.forEach((side, idx) => {
        const myLand = sideLand[idx] || 0;
        const enemyLand = sideLand.reduce((sum, v, i) => i === idx ? sum : sum + v, 0);
        const isUnderdog = enemyLand > 0 && myLand < enemyLand;

        // Base plan quality; underdogs get a small bias towards better plans.
        // Overall values are kept modest so "cracked" generals are rare.
        let planQuality = Math.random();
        if (isUnderdog) {
            // Pull slightly towards the upper half but keep a lot of randomness.
            planQuality = Math.min(1, planQuality * 0.3 + 0.3 + Math.random() * 0.2);
        }

        const general = {
            sideIndex: idx,
            isUnderdog,
            planQuality,
            name: isUnderdog ? `Underdog General ${idx + 1}` : `General ${idx + 1}`
        };
        GS.generals.push(general);

        // If the plan is strong enough and this side is the underdog, consider super‑buffs.
        // However, if the opposing pole already fields heavily buffed nations (buff/super/godly),
        // their raw quality largely negates this general advantage.
        const enemyHasStrongBuff = GS.sides.some((otherSide, j) =>
            j !== idx &&
            (j !== idx) &&
            otherSide.some(c => ['buff', 'super', 'godly'].includes(c.buffState || 'none'))
        );

        // Make strong underdog generals much rarer (high threshold) and disable them
        // when facing strongly buffed opponents (e.g. Luxembourg vs a buffed Germany).
        if (isUnderdog && planQuality > 0.9 && !enemyHasStrongBuff) {
            side.forEach(c => {
                c.buffState = c.buffState === 'godly' ? 'godly' : 'super';
                const meta = GS.countryMetadata.find(m => m && m.id === c.id);
                if (meta) meta.buffState = c.buffState;
            });
        }
    });

    GS.teamAColor = attackers.length > 0 ? attackers[0].color : 'rgba(255,50,50,0.5)';
    GS.teamBColor = defenders.length > 0 ? defenders[0].color : 'rgba(50,100,255,0.5)';
    
    const repColorA = GS.teamAColor.replace(/[\d.]+\)$/g, '1)');
    const repColorB = GS.teamBColor.replace(/[\d.]+\)$/g, '1)');
    DOM.progressBar.style.backgroundColor = repColorA;
    document.getElementById('p1-units').style.color = repColorA;
    document.getElementById('p2-units').style.color = repColorB;
    document.getElementById('p1-cities').style.color = repColorA;
    document.getElementById('p2-cities').style.color = repColorB;

    GS.activeTheaterCities = GS.cities.filter(c => {
        const idx = getGridIndex(c.lat, c.lng);
        if (idx !== -1 && GS.landMask[idx] === 2) {
            c.sovereignId = GS.worldControlMap[idx];
            return true;
        }
        return false;
    });

    // Identify frontline cells for each country for smarter spawning
    const frontlineIndices = new Map();
    GS.sides.flat().forEach(c => frontlineIndices.set(c.id, []));
    
    // Scan warzone for borders to define the initial "front"
    const totalCells = GS.worldControlMap.length;
    for (let i = 0; i < totalCells; i++) {
        const id = GS.worldControlMap[i];
        if (id > 0 && countryToSideMap.has(id)) {
            const sideIdx = countryToSideMap.get(id);
            const y = Math.floor(i / GS.gridWidth);
            const x = i % GS.gridWidth;
            let isFrontline = false;
            // Check cardinal neighbors and calculate push vector
            const neighbors = [
                { id: i + 1, dx: 1, dy: 0 },
                { id: i - 1, dx: -1, dy: 0 },
                { id: i + GS.gridWidth, dx: 0, dy: 1 },
                { id: i - GS.gridWidth, dx: 0, dy: -1 }
            ];
            let vx = 0, vy = 0;
            for (const n of neighbors) {
                if (n.id >= 0 && n.id < totalCells) {
                    const nId = GS.worldControlMap[n.id];
                    // A cell is a frontline if its neighbor belongs to an enemy side
                    if (nId > 0 && countryToSideMap.has(nId) && (countryToSideMap.get(nId) !== sideIdx)) {
                        isFrontline = true;
                        vx -= n.dx; // Vector away from enemy neighbor
                        vy -= n.dy;
                    }
                }
            }
            if (isFrontline) {
                const mag = Math.sqrt(vx*vx + vy*vy);
                frontlineIndices.get(id).push({
                    idx: i,
                    vx: mag > 0 ? vx/mag : 0,
                    vy: mag > 0 ? vy/mag : 0
                });
            }
        }
    }

    // Efficient spawn based on pre-collected indices
    GS.sides.forEach((side, sideIdx) => {
        const isPoleA = sideIdx % 2 === 0;
        const multiplier = parseFloat(DOM.densitySlider.value) || 1.0;

        // Track how many units this side already has so we can enforce CONFIG.MAX_UNITS_PER_SIDE strictly.
        let sideCurrentUnits = GS.units.filter(u => u.sideIndex === sideIdx).length;

        side.forEach(c => {
            const theaterIndices = countryIndices.get(c.id);
            const fronts = frontlineIndices.get(c.id);
            if (!theaterIndices || theaterIndices.length === 0) return;

            // Diminishing Density: Large countries have lower unit density to prevent overcrowding.
            // Steeper exponent (0.65) tapers the giant nations (Russia, Canada, USA) harder so they
            // don't spawn an unrealistic flood of units, while mid/small countries are barely affected.
            const sizeFactor = Math.max(1, theaterIndices.length / 1500);
            const densityScale = 1.0 / Math.pow(sizeFactor, 0.65);

            let desiredCount = Math.floor(theaterIndices.length * CONFIG.UNIT_DENSITY_FACTOR * multiplier * densityScale);
            const floor = c.startingUnitsFloor || 3;
            desiredCount = Math.max(floor, desiredCount);

            // Hard per-country spawn cap so no single nation (e.g. Russia) fields an absurd army at
            // war start. Scales with the density slider so that control still works as expected.
            const perCountryCap = Math.max(floor, Math.round(CONFIG.PER_COUNTRY_SPAWN_CAP * multiplier));
            desiredCount = Math.min(desiredCount, perCountryCap);

            const remainingCap = Math.max(0, CONFIG.MAX_UNITS_PER_SIDE - sideCurrentUnits);
            const count = Math.min(desiredCount, remainingCap);
            if (count <= 0) return;

            for (let j = 0; j < count; j++) {
                // High probability (95%) to spawn at identified frontline cells
                let fData;
                let fromFront = false;
                if (fronts && fronts.length > 0 && Math.random() < 0.95) {
                    fData = fronts[Math.floor(Math.random() * fronts.length)];
                    fromFront = true;
                } else {
                    const tidx = theaterIndices[Math.floor(Math.random() * theaterIndices.length)];
                    fData = { idx: tidx, vx: 0, vy: 0 };
                }

                const y = Math.floor(fData.idx / GS.gridWidth);
                const x = fData.idx % GS.gridWidth;
                
                // Spread units slightly but keep them in their territory and on the line
                // Reduced jitter and pushback to 0.4x grid res to prevent spawning across allied borders
                const jitterRange = CONFIG.GRID_RES * 0.4;
                const pushBack = fromFront ? (CONFIG.GRID_RES * 0.4) : 0;

                let lat = (y * CONFIG.GRID_RES) - 90 + (Math.random() - 0.5) * jitterRange + (fData.vy * pushBack);
                let lng = (x * CONFIG.GRID_RES) - 180 + (Math.random() - 0.5) * jitterRange + (fData.vx * pushBack);

                // Validation: Ensure final coordinate is within the country's sovereign grid
                const finalIdx = getGridIndex(lat, lng);
                if (finalIdx === -1 || GS.worldControlMap[finalIdx] !== c.id) {
                    lat = (y * CONFIG.GRID_RES) - 90 + (CONFIG.GRID_RES / 2);
                    lng = (x * CONFIG.GRID_RES) - 180 + (CONFIG.GRID_RES / 2);
                }

                const isMountainCell = GS.terrainMask && GS.terrainMask[fData.idx] > 0.35;
                const isAlpen = isMountainCell && Math.random() < 0.4;

                GS.units.push({
                    id: Math.random(),
                    lat,
                    lng,
                    team: isPoleA ? 'A' : 'B',
                    sideIndex: sideIdx,
                    sovereignId: c.id,
                    beneficiaryId: c.id,
                    isAlpenjager: !!isAlpen,
                    health: CONFIG.UNIT_HEALTH * (isAlpen ? CONFIG.ALPEN_HEALTH_MULT : 1),
                    lastAttack: 0,
                    deployTicks: 30 // Exactly 0.5 seconds at 60fps
                });
                sideCurrentUnits++;
                if (sideCurrentUnits >= CONFIG.MAX_UNITS_PER_SIDE) break;
            }
        });
    });

    /**
     * Allied Cross‑Deployment:
     * After initial spawns, push a slice of each country's divisions into allied territory so weaker
     * friends aren't left with a paper-thin, isolated frontline that gets instantly rolled.
     */
    GS.sides.forEach((side, sideIdx) => {
        if (!side || side.length < 2) return; // nothing to balance
        const samePoleSides = side; // all entries here share the same pole by construction

        // Sort allies by land size so bigger partners share more units with smaller ones
        const sorted = samePoleSides
            .map(c => ({
                country: c,
                land: cellCounts.get(c.id) || 0
            }))
            .sort((a, b) => b.land - a.land);

        // Build quick lookup of candidate cells per country for redistribution
        const perCountryCells = new Map();
        sorted.forEach(entry => {
            perCountryCells.set(entry.country.id, (countryIndices.get(entry.country.id) || []).slice());
        });

        const sideUnits = GS.units.filter(u => u.sideIndex === sideIdx);
        if (!sideUnits.length) return;

        // For each stronger country, move a small portion of its units into each weaker ally's land
        for (let i = 0; i < sorted.length; i++) {
            const strong = sorted[i];
            if (!strong.land) continue;

            const strongUnits = sideUnits.filter(u => u.sovereignId === strong.country.id);
            if (strongUnits.length === 0) continue;

            // Up to ~20% of this country's units are available for cross‑deployment (min 2)
            const poolSize = Math.max(2, Math.floor(strongUnits.length * 0.2));

            for (let j = i + 1; j < sorted.length; j++) {
                const weak = sorted[j];
                if (!weak.land) continue;

                const weakCells = perCountryCells.get(weak.country.id);
                if (!weakCells || weakCells.length === 0) continue;

                // Number of units to move into this specific ally's territory (capped)
                const shareCount = Math.min(
                    Math.max(1, Math.floor(poolSize / (sorted.length - i - 1))),
                    strongUnits.length
                );
                if (shareCount <= 0) continue;

                for (let k = 0; k < shareCount; k++) {
                    const unit = strongUnits.pop();
                    if (!unit) break;

                    // Pick a random cell belonging to the weaker ally
                    const cellIdx = weakCells[Math.floor(Math.random() * weakCells.length)];
                    const cy = Math.floor(cellIdx / GS.gridWidth);
                    const cx = cellIdx % GS.gridWidth;
                    const baseLat = (cy * CONFIG.GRID_RES) - 90;
                    const baseLng = (cx * CONFIG.GRID_RES) - 180;

                    // Slight jitter inside the target cell, but keep the unit firmly inside ally territory
                    const jitter = CONFIG.GRID_RES * 0.4;
                    unit.lat = baseLat + CONFIG.GRID_RES / 2 + (Math.random() - 0.5) * jitter;
                    unit.lng = baseLng + CONFIG.GRID_RES / 2 + (Math.random() - 0.5) * jitter;

                    // Make sure longitude stays normalized
                    if (unit.lng > 180) unit.lng -= 360;
                    else if (unit.lng < -180) unit.lng += 360;

                    // Credit for land capture stays with the original sovereign; we only change location
                    unit.beneficiaryId = strong.country.id;
                }
            }
        }
    });

    // Historical Tech Guard for Base Generation
    const currentYear = GS.gameTimeDate ? GS.gameTimeDate.year : 2024;
    const allowSilos = !GS.gameTimeEnabled || currentYear >= 1942;

    ['A', 'B'].forEach(pole => {
        const validIndices = sidePoleIndices[pole];
        if (!validIndices || validIndices.length === 0) return;

        // Missile Silos (1942+)
        if (allowSilos) {
            const baseCount = Math.min(8, Math.max(2, Math.floor(validIndices.length / 500)));
            for (let i = 0; i < baseCount; i++) {
                const randIdx = validIndices[Math.floor(Math.random() * validIndices.length)];
                const y = Math.floor(randIdx / GS.gridWidth);
                const x = randIdx % GS.gridWidth;
                GS.bases.push({
                    lat: (y * CONFIG.GRID_RES) - 90 + (CONFIG.GRID_RES / 2),
                    lng: (x * CONFIG.GRID_RES) - 180 + (CONFIG.GRID_RES / 2),
                    team: pole
                });
            }
        }
    });

    // Transport boats (owner feature): line the coast of every warring maritime
    // nation with idle ferries, ready to carry troops across to an enemy shore.
    spawnBoats(countryIndices, countryToSideMap);

    DOM.loadingOverlay.style.display = 'none';

    if (GS.tutorialActive && GS.activeTutorialSet[GS.currentTutorialStep].actionRequired === "START_WAR") {
        advanceTutorial();
    }

    // Initialize displayed manpower, honoring any manual overrides if present.
    // Base manpower comes from units, with an additional city-based bonus so more cities = more manpower.
    const unitCountA = GS.units.filter(u => u.team === 'A').length;
    const unitCountB = GS.units.filter(u => u.team === 'B').length;
    const initialUnitsA = unitCountA * CONFIG.UNIT_TO_SOLDIER_RATIO;
    const initialUnitsB = unitCountB * CONFIG.UNIT_TO_SOLDIER_RATIO;

    // Initial manpower now comes only from units (or manual overrides), not cities
    GS.initialTeamASoldiers = GS.manualSideAManpower !== null
        ? GS.manualSideAManpower
        : Math.round(initialUnitsA);
    GS.initialTeamBSoldiers = GS.manualSideBManpower !== null
        ? GS.manualSideBManpower
        : Math.round(initialUnitsB);

    // Current remaining manpower starts at the initial pool and is reduced by casualties
    GS.teamASoldiers = GS.initialTeamASoldiers;
    GS.teamBSoldiers = GS.initialTeamBSoldiers;

    // Compute dynamic soldiers-per-unit ratios so casualties always match available manpower
    // and scale with the actual number of units on each side (including manual manpower overrides).
    GS.soldiersPerUnitA = unitCountA > 0 ? (GS.initialTeamASoldiers / unitCountA) : CONFIG.UNIT_TO_SOLDIER_RATIO;
    GS.soldiersPerUnitB = unitCountB > 0 ? (GS.initialTeamBSoldiers / unitCountB) : CONFIG.UNIT_TO_SOLDIER_RATIO;
    
    let bounds = L.latLngBounds([]);
    GS.sides.forEach(side => side.forEach(c => {
        if (c.feature) try { bounds.extend(L.geoJSON(c.feature).getBounds()); } catch(e) {}
    }));

    if (!bounds.isValid()) {
       for (let i = 0; i < GS.worldControlMap.length; i++) {
           const id = GS.worldControlMap[i];
           if (GS.sides.some(s => s.some(c => c.id === id))) {
               const y = Math.floor(i / GS.gridWidth);
               const x = i % GS.gridWidth;
               const lat = (y * CONFIG.GRID_RES) - 90;
               const lng = (x * CONFIG.GRID_RES) - 180;
               bounds.extend([lat, lng]);
           }
       }
    }
    
    if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2));
    }

    // Automatically join all vassals of countries starting the war if not disabled
    if (!DOM.disablePuppetsCheckbox.checked) {
        GS.sides.forEach((side, sIdx) => {
            if (!side) return;
            const initialVassals = [];
            side.forEach(c => {
                if (!c) return;
                GS.countryMetadata.forEach(m => {
                    if (m && m.overlordId === c.id && !GS.sides.flat().some(exist => exist && exist.id === m.id)) {
                        initialVassals.push(m.id);
                    }
                });
            });
            initialVassals.forEach(vid => recruitNeutralMidWar(vid, sIdx));
        });
    }
    
    requestAnimationFrame(updateLoop);
}

export function triggerRandomWar(opts = {}) {
    if (!GS.randomWarMode) return;

    // Never start a random war while a major conflict is already simulating,
    // to avoid corrupting existing sides and soft‑locking the game.
    if (GS.gameState === 'SIMULATING' || GS.gameState === 'WAR_OVER') return;

    if (!GS.adjacencyCache) GS.adjacencyCache = computeAdjacency();

    // Pre‑compute tile counts so we only pick real countries with land
    const tileCounts = new Map();
    for (let i = 0; i < GS.worldControlMap.length; i++) {
        const id = GS.worldControlMap[i];
        if (id > 0) {
            tileCounts.set(id, (tileCounts.get(id) || 0) + 1);
        }
    }

    const currentCombatants = new Set(GS.sides.flat().map(c => c.id));
    const eligibleCountries = Array
        .from(GS.adjacencyCache.keys())
        .filter(id => id > 0 && tileCounts.get(id) > 0 && !currentCombatants.has(id));

    if (eligibleCountries.length < 2) return;

    // preferSmall (attract-mode menu demo): bias toward small neighbours like
    // Germany vs Poland instead of sprawling Russia/USA fights — both because it
    // frames tighter on the menu and because fewer tiles = a lighter background
    // sim on low-end phones. Restrict the candidate pool to the smaller ~half of
    // countries; if no small adjacent pair exists we fall back to the full pool
    // below, so the demo never fails to start.
    let smallSet = null;
    if (opts.preferSmall) {
        const sizes = eligibleCountries.map(id => tileCounts.get(id)).sort((a, b) => a - b);
        const cap = sizes[Math.floor(sizes.length * 0.5)] || 0;
        const small = eligibleCountries.filter(id => tileCounts.get(id) <= cap);
        if (small.length >= 2) smallSet = new Set(small);
    }

    // Try to find a VALID pair of neighbors (different ids, both real countries
    // with adjacency). Each pass narrows the pool, and we fall through to an
    // unrestricted pass so a war always starts:
    //  - preferSmall (attract demo): small-half set first, then unrestricted.
    //  - balanced (player button): size-ratio-capped first, then unrestricted.
    const BALANCE_RATIO = 3; // larger side at most 3x the smaller
    let idA = -1, idB = -1;
    let passes;
    if (smallSet) passes = [{ set: smallSet }, {}];
    else if (opts.balanced) passes = [{ ratio: BALANCE_RATIO }, {}];
    else passes = [{}];

    for (const pass of passes) {
        const restrict = pass.set || null;
        const ratio = pass.ratio || 0; // 0 = no size-ratio limit
        const pool = restrict ? eligibleCountries.filter(id => restrict.has(id)) : eligibleCountries;
        const shuffledEligible = pool.slice().sort(() => Math.random() - 0.5);

        for (const candidateA of shuffledEligible) {
            const neighborsSet = GS.adjacencyCache.get(candidateA);
            if (!neighborsSet || neighborsSet.size === 0) continue;

            const sizeA = tileCounts.get(candidateA);
            const neighborIds = Array.from(neighborsSet).filter(id => {
                if (id <= 0 || id === candidateA) return false;
                const sizeB = tileCounts.get(id);
                if (!sizeB || currentCombatants.has(id)) return false;
                if (restrict && !restrict.has(id)) return false;
                if (ratio && Math.max(sizeA, sizeB) / Math.min(sizeA, sizeB) > ratio) return false;
                return true;
            });
            if (neighborIds.length === 0) continue;

            idA = candidateA;
            idB = neighborIds[Math.floor(Math.random() * neighborIds.length)];
            break;
        }
        if (idA > 0 && idB > 0) break;
    }

    // If we couldn't find a safe, adjacent pair, abort the random war request
    if (idA <= 0 || idB <= 0 || idA === idB) return;

    const metaA = GS.countryMetadata[idA - 1];
    const metaB = GS.countryMetadata[idB - 1];
    if (!metaA || !metaB) return;

    const countryA = { id: idA, name: metaA.name, color: metaA.color, role: 'OFFENSE', strategy: 'BALANCED', buffState: 'none' };
    const countryB = { id: idB, name: metaB.name, color: metaB.color, role: 'OFFENSE', strategy: 'BALANCED', buffState: 'none' };

    // Random war from setup: start a clean two‑sided conflict using normal flow
    GS.sides = [[countryA], [countryB]];
    GS.activeSideIndex = 0;
    updateSidesUI();
    startWar();
}

export function activateCountryMidWar(country, sideIdx) {
    const isPoleA = sideIdx % 2 === 0;
    const poleVal = isPoleA ? 1.0 : -1.0;
    const countryId = country.id;
    
    // Update existing units if switching sides
    GS.units.forEach(u => {
        if (u.sovereignId === countryId) {
            u.team = isPoleA ? 'A' : 'B';
            u.sideIndex = sideIdx;
            u.beneficiaryId = countryId;
            u.deployTicks = 15; // Brief re-deployment delay
        }
    });

    let cellCount = 0;
    const theaterIndices = [];

    for (let i = 0; i < GS.worldControlMap.length; i++) {
        if (GS.worldControlMap[i] === countryId) {
            GS.landMask[i] = 2; // Tag as active warzone
            // Flip existing occupation polarity to the new side's team
            GS.occupationMap[i] = poleVal;
            GS.primaryOccupierMap[i] = countryId;
            theaterIndices.push(i);
            cellCount++;
        }
    }
    country.initialCells = cellCount;

    // Add cities of the new country to the active theater so they can be captured
    const newCities = GS.cities.filter(c => {
        const idx = getGridIndex(c.lat, c.lng);
        return idx !== -1 && GS.worldControlMap[idx] === countryId;
    });
    GS.activeTheaterCities = [...GS.activeTheaterCities, ...newCities];

    const meta = GS.countryMetadata.find(m => m && m.id === countryId);
    if (meta && meta.tempFlag) {
        country.flag = meta.tempFlag;
    } else {
        country.flag = new Image();
        country.flag.crossOrigin = "anonymous";
        if (meta && meta.flagUrl) {
            country.flag.src = meta.flagUrl;
        }
        if (meta) meta.tempFlag = country.flag;
    }

    // Identify frontline cells for the intervening country for smart spawning
    const frontlines = [];
    theaterIndices.forEach(i => {
        let isF = false;
        let vx = 0, vy = 0;
        const neighbors = [
            { id: i + 1, dx: 1, dy: 0 },
            { id: i - 1, dx: -1, dy: 0 },
            { id: i + GS.gridWidth, dx: 0, dy: 1 },
            { id: i - GS.gridWidth, dx: 0, dy: -1 }
        ];
        for (const n of neighbors) {
            if (n.id >= 0 && n.id < GS.worldControlMap.length) {
                const nId = GS.worldControlMap[n.id];
                // A cell is a frontline if its neighbor belongs to an enemy side
                if (nId > 0 && nId !== countryId) {
                    const nSide = GS.sides.findIndex(s => s.some(c => c.id === nId));
                    if (nSide !== -1 && (nSide !== sideIdx)) {
                        isF = true;
                        vx -= n.dx; // Vector away from enemy neighbor
                        vy -= n.dy;
                    }
                }
            }
        }
        if (isF) {
            const mag = Math.sqrt(vx*vx + vy*vy);
            frontlines.push({
                idx: i,
                vx: mag > 0 ? vx/mag : 0,
                vy: mag > 0 ? vy/mag : 0
            });
        }
    });

    const multiplier = parseFloat(DOM.densitySlider.value) || 1.0;
    
    // Diminishing Density: Large countries have lower unit density to prevent overcrowding
    const sizeFactor = Math.max(1, theaterIndices.length / 1500);
    const densityScale = 1.0 / Math.pow(sizeFactor, 0.45);
    
    let count = Math.floor(theaterIndices.length * CONFIG.UNIT_DENSITY_FACTOR * multiplier * densityScale);
    count = Math.max(4, Math.min(count, CONFIG.MAX_UNITS_PER_SIDE));

    for (let j = 0; j < count; j++) {
        let fData;
        let fromFront = false;
        if (frontlines.length > 0 && Math.random() < 0.95) {
            fData = frontlines[Math.floor(Math.random() * frontlines.length)];
            fromFront = true;
        } else {
            const idx = theaterIndices[Math.floor(Math.random() * theaterIndices.length)];
            fData = { idx, vx: 0, vy: 0 };
        }

        const y = Math.floor(fData.idx / GS.gridWidth);
        const x = fData.idx % GS.gridWidth;
        
        // Use pushback logic consistent with startWar for clean frontline deployment
        const pushBack = fromFront ? (CONFIG.GRID_RES * 0.45) : 0;
        
        const spawnIdx = fData.idx;
        const isMountainCell = GS.terrainMask && GS.terrainMask[spawnIdx] > 0.35;
        const isAlpen = isMountainCell && Math.random() < 0.4;

        GS.units.push({
            id: Math.random(),
            lat: (y * CONFIG.GRID_RES) - 90 + (Math.random() - 0.5) * CONFIG.GRID_RES * 1.2 + (fData.vy * pushBack),
            lng: (x * CONFIG.GRID_RES) - 180 + (Math.random() - 0.5) * CONFIG.GRID_RES * 1.2 + (fData.vx * pushBack),
            team: isPoleA ? 'A' : 'B',
            sideIndex: sideIdx,
            sovereignId: countryId,
            beneficiaryId: countryId,
            isAlpenjager: !!isAlpen,
            health: CONFIG.UNIT_HEALTH * (isAlpen ? CONFIG.ALPEN_HEALTH_MULT : 1),
            lastAttack: 0,
            deployTicks: 30 // Exactly 0.5 seconds at 60fps
        });
    }
    recalculateAllBounds();
}

export function launchBomb(fromLat, fromLng, toLat, toLng, team) {
    GS.bombs.push({
        id: Math.random(),
        startLat: fromLat,
        startLng: fromLng,
        targetLat: toLat,
        targetLng: toLng,
        currentLat: fromLat,
        currentLng: fromLng,
        nextLat: fromLat,
        nextLng: fromLng,
        progress: 0,
        team: team,
        state: 'rising',
        trail: [],
        peakAlt: 1.5 + Math.random() * 2.5 // Lower altitude for a flatter, more realistic arc
    });
}

export function getBorderDirection(unit) {
    if (!GS.worldControlMap || !GS.landMask) return null;

    const idx = getGridIndex(unit.lat, unit.lng);
    if (idx === -1) return null;

    const y0 = Math.floor(idx / GS.gridWidth);
    const x0 = idx % GS.gridWidth;

    // Search radius in grid cells (frontline finder)
    const maxRadius = 12;
    let bestDx = 0, bestDy = 0;
    let bestDistSq = Infinity;

    for (let r = 1; r <= maxRadius; r++) {
        const yMin = Math.max(1, y0 - r);
        const yMax = Math.min(GS.gridHeight - 2, y0 + r);
        const xMin = Math.max(1, x0 - r);
        const xMax = Math.min(GS.gridWidth - 2, x0 + r);

        for (let y = yMin; y <= yMax; y++) {
            const rowOffset = y * GS.gridWidth;
            for (let x = xMin; x <= xMax; x++) {
                const i = rowOffset + x;
                if (GS.landMask[i] !== 2) continue;

                const occ = GS.occupationMap[i];
                // Frontline cells: warzone with near-neutral occupation (border band)
                if (Math.abs(occ) > 0.25) continue;

                const cellLat = (y * CONFIG.GRID_RES) - 90;
                const cellLng = (x * CONFIG.GRID_RES) - 180;
                const dLat = cellLat - unit.lat;
                const dLng = cellLng - unit.lng;
                const dSq = dLat * dLat + dLng * dLng;
                if (dSq < bestDistSq) {
                    bestDistSq = dSq;
                    bestDx = dLng;
                    bestDy = dLat;
                }
            }
        }

        if (bestDistSq < Infinity) break;
    }

    if (bestDistSq === Infinity) return null;
    const mag = Math.sqrt(bestDx * bestDx + bestDy * bestDy);
    if (!mag || !isFinite(mag)) return null;

    return { lat: bestDy / mag, lng: bestDx / mag };
}

// ---------------------------------------------------------------------------
// TRANSPORT BOATS (owner feature): dedicated ferries that sit on a country's
// coast at war start, carry nearby troops across water to an enemy shore, wait
// until everyone is out, then return for more. Additive on top of the existing
// "unit turns into a warship and swims across" model, which stays as the
// anti-deadlock fallback so wars always terminate.
// ---------------------------------------------------------------------------

// Cell center -> lat/lng.
function _cellLatLng(idx) {
    const y = Math.floor(idx / GS.gridWidth);
    const x = idx % GS.gridWidth;
    return {
        lat: (y * CONFIG.GRID_RES) - 90 + (CONFIG.GRID_RES / 2),
        lng: (x * CONFIG.GRID_RES) - 180 + (CONFIG.GRID_RES / 2)
    };
}

// A land cell is "coast" if a cardinal neighbour is sea (landMask===0); returns
// the sea neighbour's cell index (where a boat can float), or -1.
function _seaNeighbour(idx) {
    const w = GS.gridWidth;
    const nbrs = [idx + 1, idx - 1, idx + w, idx - w];
    for (const n of nbrs) {
        if (n >= 0 && n < GS.landMask.length && GS.landMask[n] === 0) return n;
    }
    return -1;
}

// Spawn idle transport boats along the coast of each warring maritime nation.
// countryIndices: Map(countryId -> [gridIdx...]) of cells that nation holds.
export function spawnBoats(countryIndices, countryToSideMap) {
    GS.boats = [];
    GS._boatCoastsByPole = { 0: [], 1: [] };
    if (!CONFIG.BOAT_ENABLED || !GS.landMask || GS.navalDisabled) return;

    // First pass: collect every coastal sea-point per nation, bucketed by pole,
    // so a boat can later find the nearest ENEMY shore to head for.
    const coastByCountry = new Map();
    countryIndices.forEach((cells, cid) => {
        const sideIdx = countryToSideMap.get(cid);
        if (sideIdx === undefined) return;
        const pole = sideIdx % 2;
        const pts = [];
        // Sample cells (cap work on giant nations) looking for coast.
        const stride = Math.max(1, Math.floor(cells.length / 4000));
        for (let k = 0; k < cells.length; k += stride) {
            const sea = _seaNeighbour(cells[k]);
            if (sea !== -1) {
                const p = _cellLatLng(sea);
                pts.push(p);
                GS._boatCoastsByPole[pole].push(p);
            }
        }
        if (pts.length) coastByCountry.set(cid, { pts, sideIdx, pole });
    });

    // Cap enemy-coast lists so the per-boat nearest-shore scan stays cheap.
    for (const pole of [0, 1]) {
        const arr = GS._boatCoastsByPole[pole];
        if (arr.length > 240) {
            const step = arr.length / 240;
            const thin = [];
            for (let i = 0; i < arr.length; i += step) thin.push(arr[Math.floor(i)]);
            GS._boatCoastsByPole[pole] = thin;
        }
    }

    // Second pass: place a few spread-out boats per coastal nation.
    coastByCountry.forEach((info, cid) => {
        if (GS.boats.length >= CONFIG.BOAT_GLOBAL_CAP) return;
        const { pts, sideIdx, pole } = info;
        const want = Math.min(CONFIG.BOATS_PER_COUNTRY, pts.length);
        const step = pts.length / want;
        for (let b = 0; b < want; b++) {
            if (GS.boats.length >= CONFIG.BOAT_GLOBAL_CAP) break;
            const home = pts[Math.floor(b * step)];
            GS.boats.push({
                id: Math.random(),
                sovereignId: cid,
                sideIndex: sideIdx,
                team: pole === 0 ? 'A' : 'B',
                pole,
                lat: home.lat,
                lng: home.lng,
                homeLat: home.lat,
                homeLng: home.lng,
                dirLat: 0,
                dirLng: pole === 0 ? 1 : -1,
                state: 'IDLE',
                passengers: [],
                targetLat: 0,
                targetLng: 0,
                stateTicks: 0,
                idleCooldown: CONFIG.BOAT_IDLE_COOLDOWN
            });
        }
    });
}

// Nearest enemy coast sea-point to a boat, or null.
function _nearestEnemyCoast(boat) {
    const enemyPole = boat.pole === 0 ? 1 : 0;
    const list = GS._boatCoastsByPole && GS._boatCoastsByPole[enemyPole];
    if (!list || !list.length) return null;
    let best = null, bestD = Infinity;
    for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const d = (p.lat - boat.lat) ** 2 + (p.lng - boat.lng) ** 2;
        if (d < bestD) { bestD = d; best = p; }
    }
    return best;
}

// True where a boat may float: open ocean off the grid, or a sea cell (landMask 0).
function _isWaterAt(lat, lng) {
    const idx = getGridIndex(lat, lng);
    return idx === -1 || (GS.landMask && GS.landMask[idx] === 0);
}

function _moveBoatToward(boat, tLat, tLng, speed) {
    const dLat = tLat - boat.lat;
    const dLng = tLng - boat.lng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < 1e-6) return 0;
    const step = Math.min(speed, dist);
    // Straight heading at the target.
    let hLat = dLat / dist;
    let hLng = dLng / dist;
    // Water-follow: if stepping straight would beach the boat, fan the heading out
    // left/right and take the first angle that keeps it on water (nearest-to-target
    // first). Stops ferries cutting across land. Cheap — boats are capped small and
    // these landMask probes only run on the tick a direct step is blocked.
    if (!_isWaterAt(boat.lat + hLat * step, boat.lng + hLng * step)) {
        const baseAng = Math.atan2(hLng, hLat);
        // Probe a little further ahead so we round headlands instead of hugging them.
        const probe = step * 2;
        for (let deg = 25; deg <= 150; deg += 25) {
            const rad = deg * Math.PI / 180;
            let done = false;
            for (const sign of [1, -1]) {
                const a = baseAng + sign * rad;
                const cLat = Math.cos(a), cLng = Math.sin(a);
                if (_isWaterAt(boat.lat + cLat * probe, boat.lng + cLng * probe)) {
                    hLat = cLat; hLng = cLng; done = true; break;
                }
            }
            if (done) break;
        }
        // If fully boxed in, fall through on the direct heading; the BOAT_STUCK_TICKS
        // backstop (dump troops + reset) and swim-across fallback keep wars ending.
    }
    boat.dirLat = hLat;
    boat.dirLng = hLng;
    boat.lat += hLat * step;
    boat.lng += hLng * step;
    // Report straight-line remaining so arrival (remain <= BOAT_LAND_DIST) still fires;
    // distance is recomputed fresh next tick, so sideways steering self-corrects.
    return dist - step;
}

// Re-add a carried troop to the field as a normal unit at (lat,lng).
function _disembark(boat, pax, lat, lng) {
    GS.units.push({
        id: Math.random(),
        lat,
        lng,
        team: boat.team,
        sideIndex: boat.sideIndex,
        sovereignId: pax.sovereignId,
        beneficiaryId: pax.beneficiaryId || pax.sovereignId,
        isAlpenjager: !!pax.isAlpenjager,
        health: pax.health > 0 ? pax.health : CONFIG.UNIT_HEALTH,
        lastAttack: 0,
        deployTicks: 20
    });
}

// Per-tick boat update. Kept cheap: boats are capped small (≤ BOAT_GLOBAL_CAP).
export function updateBoats(countryToSideMap) {
    if (!CONFIG.BOAT_ENABLED || !GS.boats || !GS.boats.length) return;
    const CAP = CONFIG.BOAT_CAPACITY;

    // Count live units per side so we never board a side down toward empty
    // (that would risk tripping the "no units left" white-peace ender).
    const sideUnitCount = {};
    for (let i = 0; i < GS.units.length; i++) {
        const s = GS.units[i].sideIndex;
        sideUnitCount[s] = (sideUnitCount[s] || 0) + 1;
    }

    for (let bi = 0; bi < GS.boats.length; bi++) {
        const boat = GS.boats[bi];
        boat.stateTicks++;

        // Global failsafe: if any moving/holding state drags on, abandon it.
        if (boat.state !== 'IDLE' && boat.stateTicks > CONFIG.BOAT_STUCK_TICKS) {
            for (const pax of boat.passengers) _disembark(boat, pax, boat.lat, boat.lng);
            boat.passengers.length = 0;
            boat.state = 'RETURNING';
            boat.targetLat = boat.homeLat;
            boat.targetLng = boat.homeLng;
            boat.stateTicks = 0;
        }

        switch (boat.state) {
            case 'IDLE': {
                if (boat.idleCooldown > 0) { boat.idleCooldown--; break; }
                // Need an enemy shore to sail for and spare troops to carry.
                const shore = _nearestEnemyCoast(boat);
                if (!shore) break;
                const spare = (sideUnitCount[boat.sideIndex] || 0) - 8; // keep a home garrison
                if (spare <= 0) break;
                boat.targetLat = shore.lat;
                boat.targetLng = shore.lng;
                boat.state = 'LOADING';
                boat.stateTicks = 0;
                break;
            }
            case 'LOADING': {
                // Pull in friendly land troops standing near the boat.
                const r2 = CONFIG.BOAT_LOAD_RADIUS * CONFIG.BOAT_LOAD_RADIUS;
                for (let i = GS.units.length - 1; i >= 0 && boat.passengers.length < CAP; i--) {
                    const u = GS.units[i];
                    if (u.sideIndex !== boat.sideIndex || u.isAtSea) continue;
                    if ((sideUnitCount[boat.sideIndex] || 0) <= 8) break; // keep a garrison
                    const d = (u.lat - boat.lat) ** 2 + (u.lng - boat.lng) ** 2;
                    if (d <= r2) {
                        boat.passengers.push({
                            sovereignId: u.sovereignId,
                            beneficiaryId: u.beneficiaryId,
                            isAlpenjager: u.isAlpenjager,
                            health: u.health
                        });
                        GS.units.splice(i, 1);
                        sideUnitCount[boat.sideIndex]--;
                    }
                }
                const full = boat.passengers.length >= CAP;
                const timeUp = boat.stateTicks >= CONFIG.BOAT_LOAD_TICKS;
                if ((full || timeUp) && boat.passengers.length > 0) {
                    boat.state = 'CROSSING';
                    boat.stateTicks = 0;
                } else if (timeUp && boat.passengers.length === 0) {
                    // Nobody came aboard — stand down and rest.
                    boat.state = 'IDLE';
                    boat.idleCooldown = CONFIG.BOAT_IDLE_COOLDOWN;
                    boat.stateTicks = 0;
                }
                break;
            }
            case 'CROSSING': {
                const remain = _moveBoatToward(boat, boat.targetLat, boat.targetLng, CONFIG.BOAT_SPEED);
                if (remain <= CONFIG.BOAT_LAND_DIST) {
                    boat.state = 'UNLOADING';
                    boat.stateTicks = 0;
                }
                break;
            }
            case 'UNLOADING': {
                // Hold on the shore and let troops step off one at a time.
                if (boat.passengers.length > 0) {
                    if (boat.stateTicks % CONFIG.BOAT_UNLOAD_EVERY === 0) {
                        const pax = boat.passengers.pop();
                        // Land them just past the shore, toward the enemy interior.
                        const lat = boat.targetLat + boat.dirLat * 0.12 + (Math.random() - 0.5) * 0.1;
                        const lng = boat.targetLng + boat.dirLng * 0.12 + (Math.random() - 0.5) * 0.1;
                        _disembark(boat, pax, lat, lng);
                    }
                } else if (boat.stateTicks > CONFIG.BOAT_LINGER_TICKS) {
                    boat.state = 'RETURNING';
                    boat.targetLat = boat.homeLat;
                    boat.targetLng = boat.homeLng;
                    boat.stateTicks = 0;
                }
                break;
            }
            case 'RETURNING': {
                const remain = _moveBoatToward(boat, boat.homeLat, boat.homeLng, CONFIG.BOAT_SPEED);
                if (remain <= CONFIG.BOAT_LAND_DIST) {
                    boat.lat = boat.homeLat;
                    boat.lng = boat.homeLng;
                    boat.state = 'IDLE';
                    boat.idleCooldown = CONFIG.BOAT_IDLE_COOLDOWN;
                    boat.stateTicks = 0;
                }
                break;
            }
        }
    }
}

export function performSimulationTick() {
    // If war is over, stop simulation mechanics (but update loop may continue for aftermath recording)
    if (GS.gameState === 'WAR_OVER') return false;
    // If in God Mode but the war hasn't started yet, don't tick simulation mechanics
    if (GS.godModeActive && GS.preGodModeState !== 'SIMULATING') return false;

    // 0. Initial Utility Helpers
    const recordDamage = (targetUnit, dmg) => {
        if (isNaN(dmg) || dmg <= 0 || isNaN(targetUnit.health) || targetUnit.health <= 0) return;
        
        // Casualties increase while battling: damage is converted to personnel loss in real-time
        const effectiveDmg = Math.min(targetUnit.health, dmg);
        const ratio = (targetUnit.team === 'A' ? (GS.soldiersPerUnitA || CONFIG.UNIT_TO_SOLDIER_RATIO) : (GS.soldiersPerUnitB || CONFIG.UNIT_TO_SOLDIER_RATIO));
        const loss = (effectiveDmg / CONFIG.UNIT_HEALTH) * ratio;
        
        if (targetUnit.team === 'A') {
            GS.teamASoldiers = Math.max(0, GS.teamASoldiers - loss);
        } else {
            GS.teamBSoldiers = Math.max(0, GS.teamBSoldiers - loss);
        }
        
        const currentTotal = GS.countryCasualties.get(targetUnit.sovereignId) || 0;
        GS.countryCasualties.set(targetUnit.sovereignId, currentTotal + loss);
        targetUnit.health -= dmg;
    };

    // Random War Mode mid‑simulation has been disabled to avoid corrupting existing wars.
    // Random wars can still be started manually from the setup screen via the Random War button.

    // 0. Initialize Tick Caches early to avoid access-before-initialization errors
    GS.activeBattles = [];
    // Naval landing ghosts: prune the expired ones (and any left dangling by a
    // sim-clock reset on a new game) once per tick so the renderer stays cheap.
    if (GS.navalLandings && GS.navalLandings.length) {
        GS.navalLandings = GS.navalLandings.filter(g =>
            g.expireTick > GS.simFrameCount && g.expireTick <= GS.simFrameCount + CONFIG.NAVAL_GHOST_TICKS);
    }
    GS.latestCountryStats.clear();
    const countryStats = GS.latestCountryStats;
    const combatantIds = new Set();
    const countryToSideMap = new Map();

    GS.sides.forEach((side, idx) => {
        side.forEach(c => {
            combatantIds.add(c.id);
            countryToSideMap.set(c.id, idx);
            countryStats.set(c.id, { units: 0, controlled: 0 });
        });
    });

    // Transport boats: run the ferry state machine each tick. Placed before the
    // war-end checks so boats always advance while SIMULATING; passengers are
    // always eventually re-added to GS.units so wars still terminate normally.
    updateBoats(countryToSideMap);

    // Precompute the set of grid cells that contain a city, ONCE per tick.
    // The influence pass (sides-ui) and the URBAN targeting scan below both test
    // "does this cell have a city?" for huge numbers of candidate cells; the old
    // code answered by rescanning every city (getGridIndex) for every cell — an
    // O(cellsProbed × cities) tax that spikes hard in big wars on cheap phones.
    // Cities never move, so build the lookup once and let both loops do O(1) has().
    const cityCellSet = new Set();
    for (let ci = 0; ci < GS.activeTheaterCities.length; ci++) {
        const cc = GS.activeTheaterCities[ci];
        const cgi = getGridIndex(cc.lat, cc.lng);
        if (cgi !== -1) cityCellSet.add(cgi);
    }
    GS.cityCellSet = cityCellSet;

    const isNeutral = (idx) => idx !== -1 && GS.landMask[idx] > 0 && !combatantIds.has(GS.worldControlMap[idx]);
    const isNeutralCountry = (idx) => isNeutral(idx) && GS.worldControlMap[idx] > 0;

    // Determine unit counts once
    let p1UnitsCount = 0;
    let p2UnitsCount = 0;
    for (let i = 0; i < GS.units.length; i++) {
        const u = GS.units[i];
        if (u.team === 'A') p1UnitsCount++; else p2UnitsCount++;
        const s = countryStats.get(u.sovereignId);
        if (s) s.units++;
    }

    // 1. Update territory
    updatePersistentInfluence(p1UnitsCount, p2UnitsCount, countryToSideMap);

    // 1a. Occupancy Smoothing: Occasionally clean up primaryOccupierMap during war to prevent speckling
    if (GS.simFrameCount % 120 === 0) {
        const sampleCount = 5000;
        const modified = [];
        for (let s = 0; s < sampleCount; s++) {
            const idx = Math.floor(Math.random() * GS.primaryOccupierMap.length);
            if (GS.landMask[idx] !== 2 || GS.primaryOccupierMap[idx] === 0) continue;
            
            const myId = GS.primaryOccupierMap[idx];
            const mySide = countryToSideMap.get(myId);
            
            // Sample 3x3 neighborhood
            const y = Math.floor(idx / GS.gridWidth);
            const x = idx % GS.gridWidth;
            const counts = new Map();
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx; const ny = y + dy;
                    if (nx >= 0 && nx < GS.gridWidth && ny >= 0 && ny < GS.gridHeight) {
                        const nId = GS.primaryOccupierMap[ny * GS.gridWidth + nx];
                        const nSide = countryToSideMap.get(nId);
                        // Only count allies
                        if (nId > 0 && nSide !== undefined && nSide === mySide) {
                            counts.set(nId, (counts.get(nId) || 0) + 1);
                        }
                    }
                }
            }
            
            let dominantAlly = myId;
            let maxC = 0;
            counts.forEach((c, id) => { if (c > maxC) { maxC = c; dominantAlly = id; } });
            
            // If the occupier is a tiny island in an allied sea (majority neighbors are a single ally), flip to them.
            if (maxC >= 5 && dominantAlly !== myId) {
                modified.push({idx, dominantAlly});
            }
        }
        // Apply modifications without a massive 24MB array GC copy
        for(let i=0; i<modified.length; i++) {
            GS.primaryOccupierMap[modified[i].idx] = modified[i].dominantAlly;
        }
    }

    // 1b. Territorial Integrity: Collapse deep pockets and isolated protrusions (Enclaves/Exclaves)
    // We sample the grid to find territory that is surrounded by the enemy.
    // This aggressively decays "border gore" and isolated bubbles.
    const optimizationFactor = getOptimizationFactor();
    const integBase = 5000;
    const integSamples = Math.max(1000, Math.floor(integBase / optimizationFactor));
    for (let s = 0; s < integSamples; s++) {
        const idx = Math.floor(Math.random() * GS.landMask.length);
        if (GS.landMask[idx] !== 2) continue; 
        const occ = GS.occupationMap[idx];
        if (Math.abs(occ) < 0.1) continue; 
        
        const ownerId = GS.worldControlMap[idx];
        const sideIdx = countryToSideMap.get(ownerId);
        if (sideIdx === undefined) continue;
        
        const isTeamA = sideIdx % 2 === 0;
        const isOccupiedByEnemy = isTeamA ? (occ < -0.05) : (occ > 0.05);
        const isOccupiedBySelf = isTeamA ? (occ > 0.05) : (occ < -0.05);
        
        const y = Math.floor(idx / GS.gridWidth);
        const x = idx % GS.gridWidth;
        let sovereignNeighbors = 0;
        let allyOccupiedNeighbors = 0;
        let enemyOccupiedNeighbors = 0;

        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dy === 0 && dx === 0) continue;
                const ny = y + dy; const nx = x + dx;
                if (ny < 0 || ny >= GS.gridHeight || nx < 0 || nx >= GS.gridWidth) continue;
                const nIdx = ny * GS.gridWidth + nx;
                const nOcc = GS.occupationMap[nIdx];
                if (GS.worldControlMap[nIdx] === ownerId) sovereignNeighbors++;
                if (isTeamA ? (nOcc > 0.1) : (nOcc < -0.1)) allyOccupiedNeighbors++;
                if (isTeamA ? (nOcc < -0.1) : (nOcc > 0.1)) enemyOccupiedNeighbors++;
            }
        }

        // A) Occupation Decay: If an enemy pocket is deep inside sovereign territory, it collapses.
        if (isOccupiedByEnemy && sovereignNeighbors >= 6) {
            GS.occupationMap[idx] *= 0.8; // Aggressive decay
        }
        
        // B) Exclave Decay: If a friendly protrusion (finger) is surrounded by enemy occupation, it collapses.
        // This prevents the thin "tendrils" shown in the border gore feedback.
        if (isOccupiedBySelf && enemyOccupiedNeighbors >= 7) {
            GS.occupationMap[idx] *= 0.75; 
        }
    }

    // Fade effect: slowly decay occupation values back to neutral
    if (CONFIG.OCCUPATION_FADE) {
        for (let i = 0; i < GS.occupationMap.length; i++) {
            if (GS.occupationMap[i] !== 0) {
                GS.occupationMap[i] *= 0.98; // Gradual decay
                if (Math.abs(GS.occupationMap[i]) < 0.001) GS.occupationMap[i] = 0;
            }
        }
    }

    // 1c. ENCIRCLEMENT COLLAPSE (territory topology). Every 60 sim-ticks we recompute,
    // via one coarse flood-fill (see encirclement.js), which ground is sealed off from
    // the outside — scale-free, so a whole sealed country is caught, not just a unit
    // ringed by enemy tiles. Any pocket that stays sealed for KILL_TICKS collapses: its
    // ground flips to the encircler, the trapped units are wiped, and a rising
    // "+N Encircled" popup fires. The per-unit detection below reads this same map.
    //
    // GATE ON A DEDICATED PER-TICK COUNTER, not GS.simFrameCount. simFrameCount is
    // incremented once per *visual loop* (updateLoop), decoupled from how often this
    // tick actually runs: at the default 0.5x speed the visual loop advances the counter
    // on no-tick frames, so this function only ever observed odd values and skipped every
    // multiple of 60 — and the background (hidden-tab) loop never increments it at all.
    // Either way the encirclement check never fired in normal play. A counter bumped here,
    // where it's checked, advances in lockstep with real ticks in every context.
    GS.simTickCount = (GS.simTickCount | 0) + 1;
    if (GS.simTickCount % 60 === 0 && GS.occupationMap && GS.gridWidth) {
        const STEP = 8;                                   // ~0.8deg coarse cells
        GS._encCache = GS._encCache || {};
        const enc = computeEncircledCoarse(GS.occupationMap, GS.landMask, GS.gridWidth, GS.gridHeight, STEP, GS._encCache);
        GS.encircledCoarse = enc.out; GS.encCw = enc.cw; GS.encCh = enc.ch; GS.encStep = STEP;
        const cw = enc.cw, ch = enc.ch, out = enc.out, N = cw * ch;

        // Per-cell sustain timer: how long this ground has been sealed (reset when it isn't).
        if (!GS.encTicksCoarse || GS.encTicksCoarse.length !== N) GS.encTicksCoarse = new Int16Array(N);
        const ticks = GS.encTicksCoarse;
        const KILL_TICKS = 120; // ~sustained encirclement before collapse (scales with game speed). Owner: "way more common" — halved the dwell so a sealed pocket snaps roughly twice as fast.
        for (let i = 0; i < N; i++) ticks[i] = out[i] !== 0 ? Math.min(20000, ticks[i] + 60) : 0;

        // OWNER FIX (2026-07-17) — "encirclements make ANY pocket get encircled, even a
        // big one where an army is meant to hold ... a big landlocked rebellion just
        // instantly dies." The unit-pocket collapse below used to teleport-wipe every
        // sealed pocket the same way regardless of size or garrison, so a fresh landlocked
        // rebellion vanished ~KILL_TICKS in — well inside its own release grace, before its
        // army could fight. Two shields (see the collapse body): a pocket owned by a nation
        // still in release grace, and a sizeable pocket that still fields a live garrison,
        // are spared the wipe and left to be decided by normal front combat (they still
        // carry the per-unit encircled debuff, so encirclement still bites — it just no
        // longer teleport-kills a living army). Small cut-off salients and dead/empty
        // enclaves still collapse exactly as before.
        const SMALL_POCKET_CELLS = 4; // <= this many coarse cells = a cut-off salient, always collapses
        const graceIds = new Set();
        GS.sides.forEach(side => side && side.forEach(c => { if (c && c.graceTicks > 0) graceIds.add(c.id); }));

        // Collapse each connected pocket that has stayed sealed long enough. Bounded events/pass.
        const visited = new Uint8Array(N);
        const stack = [];
        const dead = new Set();
        let events = 0;
        for (let s = 0; s < N && events < 8; s++) { // owner: more common — let up to 8 pockets collapse per pass (was 4) so simultaneous encirclements aren't starved
            if (visited[s] || ticks[s] < KILL_TICKS || out[s] === 0) { if (ticks[s] < KILL_TICKS) visited[s] = 1; continue; }
            const sign = out[s];                           // +1/-1 = team A/B units trapped; +2/-2 = empty land sealed by A/B
            const comp = []; stack.length = 0; stack.push(s); visited[s] = 1;
            while (stack.length) {
                const i = stack.pop(); comp.push(i);
                const x = i % cw, y = (i - x) / cw;
                const nb = [y > 0 ? i - cw : -1, y < ch - 1 ? i + cw : -1, x > 0 ? i - 1 : y * cw + (cw - 1), x < cw - 1 ? i + 1 : y * cw];
                for (let k = 0; k < 4; k++) { const j = nb[k]; if (j >= 0 && !visited[j] && ticks[j] >= KILL_TICKS && out[j] === sign) { visited[j] = 1; stack.push(j); } }
            }

            // Pocket centroid (used by both unit-pocket collapse and empty-patch capture).
            let cxSum = 0, cySum = 0;
            for (let m = 0; m < comp.length; m++) { const i = comp[m]; cxSum += i % cw; cySum += (i - (i % cw)) / cw; }
            const cLng = ((cxSum / comp.length) * STEP + STEP / 2) * CONFIG.GRID_RES - 180;
            const cLat = ((cySum / comp.length) * STEP + STEP / 2) * CONFIG.GRID_RES - 90;

            // EMPTY-LAND CAPTURE (owner: "detect patches of land without units that are
            // surrounded by enemy land and switch those"). No units to wipe — just flip the
            // sealed contested ground to the side that rings it. +2 = captured by A, -2 by B.
            if (sign === 2 || sign === -2) {
                const capTeamA = sign === 2, capSign = capTeamA ? 1 : -1;
                let capId = 0, cmx = 0; const ccounts = new Map();
                const cprobe = [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]];
                for (let d = 0; d < cprobe.length; d++) {
                    const gi = getGridIndex(cLat + cprobe[d][0], cLng + cprobe[d][1]);
                    if (gi === -1) continue;
                    const oid = GS.primaryOccupierMap[gi];
                    const os = countryToSideMap.get(oid);
                    if (oid > 0 && os !== undefined && (os % 2 === 0) === capTeamA) ccounts.set(oid, (ccounts.get(oid) || 0) + 1);
                }
                ccounts.forEach((c, id) => { if (c > cmx) { cmx = c; capId = id; } });
                if (capId === 0) countryToSideMap.forEach((sd, id) => { if (capId === 0 && (sd % 2 === 0) === capTeamA) capId = id; });
                if (capId > 0) {
                    let flipped = 0;
                    for (let m = 0; m < comp.length; m++) {
                        const ci = comp[m], ccx = ci % cw, ccy = (ci - (ci % cw)) / cw;
                        const xLo = ccx * STEP, yLo = ccy * STEP;
                        const xHi = Math.min(GS.gridWidth - 1, xLo + STEP - 1), yHi = Math.min(GS.gridHeight - 1, yLo + STEP - 1);
                        for (let yy = yLo; yy <= yHi; yy++) for (let xx = xLo; xx <= xHi; xx++) {
                            const gi = yy * GS.gridWidth + xx;
                            if (GS.landMask[gi] !== 2) continue;
                            if (Math.abs(GS.occupationMap[gi]) <= 0.1) {   // only flip genuinely contested ground
                                GS.occupationMap[gi] = capSign * 0.85;
                                GS.primaryOccupierMap[gi] = capId;
                                flipped++;
                            }
                        }
                    }
                    if (flipped > 0) events++;
                }
                for (let m = 0; m < comp.length; m++) ticks[comp[m]] = 0; // handled — clear so it won't re-fire
                continue;
            }

            const isTeamA = sign === 1, enemySign = isTeamA ? -1 : 1, teamCh = isTeamA ? 'A' : 'B';
            const spU = isTeamA ? (GS.soldiersPerUnitA || CONFIG.UNIT_TO_SOLDIER_RATIO) : (GS.soldiersPerUnitB || CONFIG.UNIT_TO_SOLDIER_RATIO);
            const cellSet = new Set(comp);

            // Trapped units sitting on the pocket.
            const trappedHere = []; let combined = 0;
            for (let ui = 0; ui < GS.units.length; ui++) {
                const v = GS.units[ui];
                if (v.team !== teamCh || v.deployTicks > 0 || isNaN(v.lat) || isNaN(v.lng)) continue;
                const wl = ((v.lng + 180) % 360 + 360) % 360;
                const vcx = Math.floor((wl / CONFIG.GRID_RES) / STEP);
                const vcy = Math.floor(((v.lat + 90) / CONFIG.GRID_RES) / STEP);
                if (vcx < 0 || vcx >= cw || vcy < 0 || vcy >= ch || !cellSet.has(vcy * cw + vcx)) continue;
                const loss = Math.max(0, (v.health / CONFIG.UNIT_HEALTH) * spU);
                trappedHere.push({ v, loss }); combined += loss;
            }
            // NOTE: combined can be 0 here (a sealed enemy-owned pocket whose defenders
            // are already gone). Owner report + screenshot: a nation fully ringed by the
            // enemy just sat there (green, undefeated) forever, because the old code did
            // `if (combined < 1) continue` and waited for occupants that can never arrive
            // — the pocket is sealed, so no reinforcement and no enemy unit ever walks in.
            // A pocket that has stayed sealed for KILL_TICKS is a dead enclave: overrun
            // its ground regardless of whether any units are left to wipe.

            // HOLD gate (owner fix, see the note above the collapse loop). Spare this pocket
            // the teleport-wipe — but keep its timers so it still collapses later if it is
            // genuinely beaten (garrison destroyed) — when either:
            //   (a) its ground is owned by a nation still in release grace (a fresh
            //       revolution that hasn't had its window to fight yet), or
            //   (b) it is bigger than a cut-off salient AND still fields a live garrison
            //       (combined >= ~one full unit). A big EMPTY enclave (combined ~ 0) fails
            //       this and still gets absorbed; small salients fall through and crush.
            let ownedByGrace = false;
            if (graceIds.size) {
                for (let m = 0; m < comp.length && !ownedByGrace; m++) {
                    const ci = comp[m], ccx = ci % cw, ccy = (ci - (ci % cw)) / cw;
                    const gi = Math.min(GS.gridHeight - 1, ccy * STEP + (STEP >> 1)) * GS.gridWidth
                             + Math.min(GS.gridWidth - 1, ccx * STEP + (STEP >> 1));
                    if (graceIds.has(GS.primaryOccupierMap[gi])) ownedByGrace = true;
                }
            }
            if (ownedByGrace || (comp.length > SMALL_POCKET_CELLS && combined >= spU)) {
                continue; // holds this pass; ticks kept, so a later gutted pocket still falls
            }

            // Encircling country = dominant enemy occupier around the pocket centroid.
            let encirclerId = 0, mx = 0;
            const counts = new Map();
            const probe = [[0, 0], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]];
            for (let d = 0; d < probe.length; d++) {
                const gi = getGridIndex(cLat + probe[d][0], cLng + probe[d][1]);
                if (gi === -1) continue;
                const oid = GS.primaryOccupierMap[gi];
                const os = countryToSideMap.get(oid);
                if (oid > 0 && os !== undefined && (os % 2 === 0) !== isTeamA) counts.set(oid, (counts.get(oid) || 0) + 1);
            }
            counts.forEach((c, id) => { if (c > mx) { mx = c; encirclerId = id; } });
            if (encirclerId === 0) countryToSideMap.forEach((sd, id) => { if (encirclerId === 0 && (sd % 2 === 0) !== isTeamA) encirclerId = id; });

            // No enemy owner identifiable around the pocket — can't attribute the land.
            // Clear the timers so it isn't re-scanned every pass and move on.
            if (encirclerId === 0) { for (let m = 0; m < comp.length; m++) ticks[comp[m]] = 0; continue; }

            events++;

            // Flip every trapped-side fine cell inside the pocket to the encircler.
            let flipped = 0;
            for (let m = 0; m < comp.length; m++) {
                const ci = comp[m], ccx = ci % cw, ccy = (ci - (ci % cw)) / cw;
                const xLo = ccx * STEP, yLo = ccy * STEP;
                const xHi = Math.min(GS.gridWidth - 1, xLo + STEP - 1), yHi = Math.min(GS.gridHeight - 1, yLo + STEP - 1);
                for (let yy = yLo; yy <= yHi; yy++) for (let xx = xLo; xx <= xHi; xx++) {
                    const gi = yy * GS.gridWidth + xx;
                    if (GS.landMask[gi] !== 2) continue;
                    if (isTeamA ? (GS.occupationMap[gi] > 0) : (GS.occupationMap[gi] < 0)) {
                        GS.occupationMap[gi] = enemySign * 0.85;
                        GS.primaryOccupierMap[gi] = encirclerId;
                        flipped++;
                    }
                }
            }

            // Book the trapped manpower as casualties and destroy the units (none if the
            // pocket was already unit-less — the loop is simply empty in that case).
            for (let m = 0; m < trappedHere.length; m++) {
                const { v, loss } = trappedHere[m];
                if (isTeamA) GS.teamASoldiers = Math.max(0, GS.teamASoldiers - loss);
                else GS.teamBSoldiers = Math.max(0, GS.teamBSoldiers - loss);
                GS.countryCasualties.set(v.sovereignId, (GS.countryCasualties.get(v.sovereignId) || 0) + loss);
                dead.add(v);
            }

            // Manpower popup when there were defenders to crush; a plain overrun tag when
            // the enclave was already empty and we just absorbed the ground.
            if (combined >= 1) {
                GS.encirclePops.push({ lat: cLat, lng: cLng, text: '+' + Math.round(combined).toLocaleString('en-US') + ' Encircled', life: 240, maxLife: 240 });
            } else if (flipped > 0) {
                GS.encirclePops.push({ lat: cLat, lng: cLng, text: 'Pocket Overrun', life: 240, maxLife: 240 });
            }
            for (let m = 0; m < comp.length; m++) ticks[comp[m]] = 0; // collapsed — clear so it won't re-fire
        }
        if (dead.size > 0) GS.units = GS.units.filter(u => !dead.has(u));
    }

    // Optimization: Only count land every 15 frames or if specifically requested
    // This removes the biggest bottleneck of scanning 6.4 million pixels every tick.
    // At high speeds, we count even less frequently to save heavy CPU cycles.
    const countInterval = Math.max(15, Math.floor(15 * GS.simSpeed));
    const shouldCountLand = GS.simFrameCount % countInterval === 0;

    // 2. Statistics & Soldiers (Dynamic based on units)
    // p1LandScore drove a FULL ~6.4M-cell scan of the occupation grid on EVERY tick,
    // even though the value only feeds the war-over check (>=99.9 / <=0.1) and the
    // slow land-transfer trickle — neither needs sub-15-frame precision. Fold it into
    // the same shouldCountLand cadence as the other big grid scan below and cache the
    // result; on off-frames reuse the cached score. Removes a per-tick full-grid pass.
    // p1LandScore (pole-A share of contested front) is now tallied inside the same
    // full-grid pass that counts per-country controlled land below — both only run on
    // shouldCountLand frames, so folding them together removes a whole redundant
    // ~6.4M-cell scan on every counting frame. That double scan on the same frame was a
    // periodic in-war frame spike; one pass halves it. Off-frames reuse the cached score.
    let p1LandScore = GS.cachedP1LandScore;

    // Manpower is a fixed pool initialized at war start and reduced by casualties;
    // do not recompute it from current unit counts here.
    // We only ensure it never goes negative and keep casualties in sync with it below.
    GS.teamASoldiers = Math.max(0, GS.teamASoldiers);
    GS.teamBSoldiers = Math.max(0, GS.teamBSoldiers);

    // 3. AI & Combat (Including Mid-War Recruitment)
    // (countInterval / shouldCountLand computed above, before the land-score scan.)

    // Build Spatial Hash for ultra-fast O(1) local combat & target lookup
    // Shared with renderer to allow high-performance unit culling
    GS.unitSpatialHash.clear();
    const unitHash = GS.unitSpatialHash;
    const HASH_SIZE = UNIT_HASH_CELL_SIZE; 
    for (let i = 0; i < GS.units.length; i++) {
        const u = GS.units[i];
        if (isNaN(u.lat) || isNaN(u.lng)) continue;
        const kx = Math.floor((u.lng + 180) / HASH_SIZE);
        const ky = Math.floor((u.lat + 90) / HASH_SIZE);
        const k = kx + '_' + ky;
        let arr = unitHash.get(k);
        if (!arr) { arr = []; unitHash.set(k, arr); }
        arr.push(u);
    }

    // --- UNIT CONSOLIDATION (Merge Stacks) ---
    // Periodically merge units of the same team that are virtually overlapping.
    // This fulfills the "no stacks" optimization and boosts performance in massive wars.
    if (GS.simFrameCount % 30 === 0 && GS.units.length > 40) {
        const mergeDistSq = 0.14 * 0.14; // ~15km radius for merging
        const maxMergedHealth = CONFIG.UNIT_HEALTH * 5; // Cap to prevent invincible "super-units"
        const unitsToRemove = new Set();

        for (let i = 0; i < GS.units.length; i++) {
            const u = GS.units[i];
            // Skip if already marked for removal or already at max merged strength
            if (unitsToRemove.has(u) || u.health >= maxMergedHealth || u.deployTicks > 0) continue;

            const kx = Math.floor((u.lng + 180) / HASH_SIZE);
            const ky = Math.floor((u.lat + 90) / HASH_SIZE);
            const k = kx + '_' + ky;
            const cellUnits = unitHash.get(k);
            if (!cellUnits) continue;

            for (let j = 0; j < cellUnits.length; j++) {
                const other = cellUnits[j];
                // Must be a different unit, same team, same sovereign, and not already being removed
                if (other === u || unitsToRemove.has(other) || other.team !== u.team || 
                    other.sovereignId !== u.sovereignId || other.deployTicks > 0) continue;

                // Simple squared distance check
                let dlng = other.lng - u.lng;
                if (dlng > 180) dlng -= 360; else if (dlng < -180) dlng += 360;
                const dSq = (u.lat - other.lat)**2 + dlng**2;
                
                if (dSq < mergeDistSq) {
                    const capacity = maxMergedHealth - u.health;
                    const transfer = Math.min(capacity, other.health);
                    
                    u.health += transfer;
                    other.health -= transfer;
                    
                    // If the other unit is depleted, mark for removal
                    if (other.health <= 0) {
                        unitsToRemove.add(other);
                    }
                    
                    // If the primary unit is full, stop looking for more neighbors to merge
                    if (u.health >= maxMergedHealth) break;
                }
            }
        }
        
        if (unitsToRemove.size > 0) {
            GS.units = GS.units.filter(u => !unitsToRemove.has(u));
            // Re-sync casualty counts: these units weren't destroyed by enemies, just consolidated.
            // No action needed here as personnel display derives from live unit health.
        }
    }
    if (shouldCountLand) {
        recalculateAllBounds();
        const countryFrontlines = new Map();
        GS.sides.flat().forEach(c => countryFrontlines.set(c.id, 0));

        let p1T = 0, p2T = 0; // pole-A / pole-B share of the contested front (feeds p1LandScore)
        // Decay-immune board control: attribute every warzone cell to the POLE that
        // physically holds it (primaryOccupierMap — set on capture, never faded), NOT to
        // occupation polarity (which decays toward 0 in a frozen/sealed pocket) and NOT to
        // de-jure ownership via stats.controlled (which counts a cell for NO ONE once it's
        // occupied-but-not-annexed — the exact reason germany-vs-poland softlocked). This is
        // the reliable "who owns the map" signal the decisive war-ender needs.
        let poleAHeld = 0, poleBHeld = 0;
        for (let i = 0; i < GS.worldControlMap.length; i++) {
            if (GS.landMask[i] === 2) {
                // Match visual frontline threshold (0) — tally every warzone cell by
                // occupation polarity, independent of who de-facto owns it.
                if (GS.occupationMap[i] > 0) p1T++;
                else if (GS.occupationMap[i] < 0) p2T++;
                const occId = GS.primaryOccupierMap[i];
                if (occId > 0) {
                    const occSide = countryToSideMap.get(occId);
                    if (occSide !== undefined) { if (occSide % 2 === 0) poleAHeld++; else poleBHeld++; }
                }
                const sid = GS.worldControlMap[i];
                const stats = countryStats.get(sid);
                if (stats) {
                    const sIdx = countryToSideMap.get(sid);
                    const isTeamA = sIdx % 2 === 0;
                    if ((isTeamA && GS.occupationMap[i] > 0) || (!isTeamA && GS.occupationMap[i] < 0)) {
                        stats.controlled++;
                    }

                    // Count frontline cells for saturation check
                    const neighbors = [i + 1, i - 1, i + GS.gridWidth, i - GS.gridWidth];
                    let isFront = false;
                    for (const n of neighbors) {
                        if (n >= 0 && n < GS.worldControlMap.length) {
                            const nid = GS.worldControlMap[n];
                            const nsid = countryToSideMap.get(nid);
                            if (nid > 0 && nsid !== undefined && (nsid !== sIdx)) {
                                isFront = true;
                                break;
                            }
                        }
                    }
                    if (isFront) {
                        countryFrontlines.set(sid, countryFrontlines.get(sid) + 1);
                    }
                }
            }
        }
        p1LandScore = (p1T + p2T > 0) ? (p1T / (p1T + p2T)) * 100 : 50;
        GS.cachedP1LandScore = p1LandScore;
        // Persist the decay-immune board-control tally for the decisive war-ender (read in
        // checkWinConditions, which also runs on non-counting frames).
        GS.cachedPoleAHeld = poleAHeld;
        GS.cachedPoleBHeld = poleBHeld;

        // Determine saturation for each country
        GS.sides.flat().forEach(c => {
            const stats = countryStats.get(c.id);
            const frontCount = countryFrontlines.get(c.id) || 0;
            // Strict Saturation Requirement: Nations must man 100% of their identified frontline before pushing.
            const saturationThreshold = 1.0; 
            if (stats) {
                if (stats.units >= frontCount * saturationThreshold) {
                    c.isSaturated = true;
                } else if (stats.units < frontCount * 0.6) {
                    // Drop saturation if decimated below 60% coverage to force regrouping
                    c.isSaturated = false;
                }
            }
        });
    } else {
        // Carry over stats from the last "counting" frame
        GS.sides.flat().forEach(c => {
            const stats = countryStats.get(c.id);
            if (stats) stats.controlled = c.lastControlledCount || c.initialCells || 0;
        });
    }

    // Persist stats for next frame's "non-counting" logic
    GS.sides.flat().forEach(c => {
        const stats = countryStats.get(c.id);
        if (stats && shouldCountLand) c.lastControlledCount = stats.controlled;
    });

    const unitsBySide = GS.sides.map((_, idx) => GS.units.filter(u => u.sideIndex === idx));
    // City target list used for CITY FOCUS and URBAN strategies; prefer the active theater,
    // and fall back to all known cities if no theater is defined.
    const cityTargets = (GS.activeTheaterCities && GS.activeTheaterCities.length)
        ? GS.activeTheaterCities
        : (GS.cities || []);

    // Calculate Victory Ratios for each side to coordinate surges
    const sideVictoryRatios = unitsBySide.map((sideUnits, sIdx) => {
        if (sideUnits.length === 0) return 0;
        const winners = sideUnits.filter(u => u.victoryBoostTicks > 0).length;
        const ratio = winners / sideUnits.length;

        // Global Surge State: Update coordinated push status for each side
        const sideCountries = GS.sides[sIdx];
        if (sideCountries) {
            sideCountries.forEach(c => {
                // Lowered surge threshold to 60% momentum for more consistent offensive action.
                // A side starts a coordinated surge when victory momentum is good (>60%) 
                // and frontline saturation is achieved.
                if (!c.isSurging && ratio > 0.6 && c.isSaturated) {
                    c.isSurging = true;
                } 
                // The surge breaks and units hold once momentum falls below 35%.
                else if (c.isSurging && ratio < 0.35) {
                    c.isSurging = false;
                }
                
                // If not saturated, immediately kill any active surge to force line-filling.
                if (!c.isSaturated) c.isSurging = false;
            });
        }

        return ratio;
    });

    // Calculate centroids for each side to help with strategic "fanning out"
    // Group-Based Hive Intelligence: Partition each side into 4 tactical battle groups
    const numGroups = 4;
    const sideCentroids = GS.sides.map((_, idx) => {
        const sideUnits = unitsBySide[idx];
        if (sideUnits.length === 0) return null;
        
        const groups = Array.from({length: numGroups}, () => ({ latSum: 0, lngSum: 0, count: 0, vLat: 0, vLng: 0 }));
        sideUnits.forEach(u => {
            const gIdx = Math.floor(u.id * 1000) % numGroups;
            groups[gIdx].latSum += u.lat;
            groups[gIdx].lngSum += u.lng;
            groups[gIdx].vLat += (u.dirLat || 0);
            groups[gIdx].vLng += (u.dirLng || 0);
            groups[gIdx].count++;
        });

        return groups.map(g => g.count > 0 ? {
            lat: g.latSum / g.count,
            lng: g.lngSum / g.count,
            vLat: g.vLat / g.count,
            vLng: g.vLng / g.count,
            count: g.count
        } : null);
    });

    // Pre-calculate collapsed nations for each side to avoid O(N^2) complexity inside the unit loop
    const sideToCollapsedNations = GS.sides.map((side, idx) => {
        const enemies = [];
        GS.sides.forEach((s, sIdx) => {
            const isEnemy = (sIdx !== idx);
            if (isEnemy && s.length > 0) {
                s.forEach(c => {
                    const stats = countryStats.get(c.id);
                    if (stats && stats.units === 0 && stats.controlled > 0) {
                        // Support nations are only valid targets for mop-up if they've already been "activated"
                        // (meaning someone has managed to breach their border already).
                        if (c.role === 'SUPPORT') {
                            const initial = c.initialCells || 1;
                            if (stats.controlled >= initial * 0.99) {
                                // Virtually untouched support nation, ignore for now
                                return;
                            }
                        }
                        enemies.push(c);
                    }
                });
            }
        });
        // Prioritize OFFENSE nations in the mop-up list to ensure core enemies are finished first
        enemies.sort((a, b) => {
            const aOffense = (a.role === 'OFFENSE' ? 1 : 0);
            const bOffense = (b.role === 'OFFENSE' ? 1 : 0);
            return bOffense - aOffense;
        });
        return enemies;
    });

    const countryToCityCount = new Map();
    const countryCapitalLost = new Map();
    const countryCapitalCaptor = new Map(); // sovId -> {captorId, lat, lng} when its capital is enemy-held
    const countryCityTally = new Map(); // sovId -> {total, lost, captorId, lat, lng} — for the all-cities-fallen surrender

    GS.activeTheaterCities.forEach(city => {
        const idx = getGridIndex(city.lat, city.lng);
        const ownerId = GS.primaryOccupierMap[idx];
        const originalSovereignId = city.sovereignId;

        if (ownerId > 0) {
            countryToCityCount.set(ownerId, (countryToCityCount.get(ownerId) || 0) + 1);
        }

        // --- City-capture pulse: announce when any theater city changes the side that holds it ---
        if (originalSovereignId > 0) {
            const origSide = countryToSideMap.get(originalSovereignId);
            if (origSide !== undefined) {
                const occ = GS.occupationMap[idx];
                // Definite hold only (A if occ>0.3, B if occ<-0.3); contested keeps the prior holder → no flicker.
                let heldPole = null;
                if (occ > 0.3) heldPole = 'A';
                else if (occ < -0.3) heldPole = 'B';
                const origPole = (origSide % 2 === 0) ? 'A' : 'B';
                const enemyPole = origPole === 'A' ? 'B' : 'A';
                // Tally every theater city per original owner so a nation that loses ALL of
                // them can be forced to peace. A city counts as "lost" only when it's decisively
                // enemy-held (|occ|>0.3), so a merely-contested city never trips the surrender.
                if (!countryCityTally.has(originalSovereignId)) countryCityTally.set(originalSovereignId, { total: 0, lost: 0, captorId: 0, lat: city.lat, lng: city.lng });
                const cTally = countryCityTally.get(originalSovereignId);
                cTally.total++;
                const cityLostToEnemy = origPole === 'A' ? (occ < -0.3) : (occ > 0.3);
                if (cityLostToEnemy) { cTally.lost++; if (ownerId > 0) { cTally.captorId = ownerId; cTally.lat = city.lat; cTally.lng = city.lng; } }
                if (heldPole && heldPole !== city._heldPole) {
                    const prev = city._heldPole;
                    if (prev !== undefined) { // first observation = game-start owner → init silently
                        const nm = (city.name || 'CITY').toUpperCase();
                        if (heldPole === enemyPole) {
                            GS.encirclePops.push({ lat: city.lat, lng: city.lng, text: nm + ' Captured', life: 240, maxLife: 240, pulse: true });
                            city._captured = true;
                        } else if (heldPole === origPole && city._captured) {
                            GS.encirclePops.push({ lat: city.lat, lng: city.lng, text: nm + ' Taken Back', life: 240, maxLife: 240, pulse: true });
                            city._captured = false;
                        }
                    }
                    city._heldPole = heldPole;
                }
            }
        }

        if (city.isCapital) {
            // A capital belongs to the nation that ORIGINALLY owned it, NOT whoever holds
            // it now. c.sovereignId gets overwritten to the current de-jure owner every
            // evaluation (see activeTheaterCities filter), so a conquered capital would
            // otherwise be mis-attributed to its conqueror — making the conqueror "lose
            // its capital" (and surrender!) if that city were ever re-occupied by an
            // enemy. Resolve the true home owner from the war-start snapshot instead.
            const homeOwnerId = (GS.initialWorldControlMapSnapshot && idx >= 0 && idx < GS.initialWorldControlMapSnapshot.length)
                ? GS.initialWorldControlMapSnapshot[idx] : originalSovereignId;
            // OWNER FIX (convert captured capital → regular city): once a capital cell is
            // DE-JURE owned by a nation other than its home owner, it has been conquered.
            // Demote it to a regular city permanently so re-taking a conquered capital can
            // never flag its CONQUEROR as having lost its own capital (the Brussels→UK
            // surrender bug the owner hit invading Belgium). A capital merely OCCUPIED (still
            // de-jure home-owned) is left alone, so the normal capital-loss supply/fight-on
            // mechanic for a nation losing its OWN capital is fully intact.
            if (homeOwnerId > 0 && originalSovereignId > 0 && originalSovereignId !== homeOwnerId) {
                city.isCapital = false;
                city._demotedCapital = true;
                return;
            }
            const homeSide = homeOwnerId > 0 ? countryToSideMap.get(homeOwnerId) : undefined;
            // Only a nation still in the war can lose its capital. If the home owner is
            // already out (annexed / puppeted), losing this city is moot — skip it so the
            // current holder is never flagged.
            if (homeSide !== undefined) {
                const isPoleA = homeSide % 2 === 0;
                const occ = GS.occupationMap[idx];

                // If the city is heavily occupied by the enemy side
                const isOccupiedByEnemy = isPoleA ? (occ < -0.3) : (occ > 0.3);
                if (isOccupiedByEnemy) {
                    countryCapitalLost.set(homeOwnerId, true);
                    countryCapitalCaptor.set(homeOwnerId, { captorId: ownerId, lat: city.lat, lng: city.lng });
                    // Decide ONCE (sticky per war) whether this nation FIGHTS ON after losing its capital.
                    // Most do → the defender keeps a real army and the war grinds on instead of a snap collapse.
                    if (!GS.fightOnDecided) GS.fightOnDecided = new Set();
                    if (!GS.fightOnCountries) GS.fightOnCountries = new Set();
                    if (!GS.fightOnDecided.has(homeOwnerId)) {
                        GS.fightOnDecided.add(homeOwnerId);
                        if (Math.random() < CONFIG.CAPITAL_FIGHT_ON_CHANCE) {
                            GS.fightOnCountries.add(homeOwnerId);
                        }
                    }
                }
            }
        }
    });
    // Expose capital-loss state globally so recruitment/spawn logic can react to supply failure
    GS.capitalLostCountries = new Set(countryCapitalLost.keys());

    // FORCE PEACE WHEN EVERY CITY FALLS (owner ask): a nation that has lost EVERY one of its
    // theater cities to the enemy is totally defeated — end its war immediately and annex it,
    // no matter its capital politics, fight-on odds, or size. Deterministic and unambiguous:
    // it fires the instant the last city flips, so there's no drag and none of the occupation-
    // fade / de-jure-ownership blind spots that stalled the land-share enders. Guarded by
    // capitalDecided + annexedCountries so it never double-fires or overrides an existing puppet.
    if (countryCityTally.size > 0) {
        if (!GS.capitalDecided) GS.capitalDecided = new Set();
        if (!GS.annexedCountries) GS.annexedCountries = new Set();
        countryCityTally.forEach((t, sovId) => {
            if (t.total <= 0 || t.lost < t.total) return;       // still holds at least one city
            if (GS.capitalDecided.has(sovId) || GS.annexedCountries.has(sovId)) return;
            const sovSide = countryToSideMap.get(sovId);
            if (sovSide === undefined) return;
            const sovCountry = GS.sides.flat().find(c => c.id === sovId);
            if (!sovCountry) return;
            GS.capitalDecided.add(sovId);
            GS.annexedCountries.add(sovId);
            const nm = (sovCountry.name || 'NATION').toUpperCase();
            if (GS.encirclePops) GS.encirclePops.push({ lat: t.lat, lng: t.lng, text: nm + ' SURRENDERS', life: 360, maxLife: 360 });
            capitulateCountry(sovCountry, sovSide);
        });
    }

    // Capitulation option: if enabled, a captured capital isn't just a supply failure —
    // the country surrenders and is annexed. All ground it still holds flips to whoever
    // took the capital, its units are wiped (booked as casualties), and a "<FLAG> ANNEXED"
    // tag floats up at the capital. Fires once per country (GS.annexedCountries guards it).
    if (GS.annexOnCapital && countryCapitalLost.size > 0) {
        if (!GS.annexedCountries) GS.annexedCountries = new Set();
        const annexDead = new Set();
        countryCapitalLost.forEach((_, sovId) => {
            if (GS.annexedCountries.has(sovId)) return;
            const cap = countryCapitalCaptor.get(sovId);
            if (!cap || cap.captorId <= 0 || cap.captorId === sovId) return;
            const sovSide = countryToSideMap.get(sovId);
            const captorSide = countryToSideMap.get(cap.captorId);
            if (sovSide === undefined || captorSide === undefined || sovSide === captorSide) return;
            GS.annexedCountries.add(sovId);

            const captorIsPoleA = captorSide % 2 === 0;
            const captorSign = captorIsPoleA ? 1 : -1;
            // Flip every cell still controlled by the surrendering country to the captor.
            for (let gi = 0; gi < GS.primaryOccupierMap.length; gi++) {
                if (GS.landMask[gi] !== 2) continue;
                if (GS.primaryOccupierMap[gi] === sovId) {
                    GS.primaryOccupierMap[gi] = cap.captorId;
                    GS.occupationMap[gi] = captorSign * 0.85;
                }
            }
            // Wipe the surrendering country's units, booking their manpower as casualties.
            const sovIsPoleA = sovSide % 2 === 0;
            const spU = sovIsPoleA ? (GS.soldiersPerUnitA || CONFIG.UNIT_TO_SOLDIER_RATIO) : (GS.soldiersPerUnitB || CONFIG.UNIT_TO_SOLDIER_RATIO);
            for (let ui = 0; ui < GS.units.length; ui++) {
                const v = GS.units[ui];
                if (v.sovereignId !== sovId) continue;
                const loss = Math.max(0, (v.health / CONFIG.UNIT_HEALTH) * spU);
                if (sovIsPoleA) GS.teamASoldiers = Math.max(0, GS.teamASoldiers - loss);
                else GS.teamBSoldiers = Math.max(0, GS.teamBSoldiers - loss);
                GS.countryCasualties.set(sovId, (GS.countryCasualties.get(sovId) || 0) + loss);
                annexDead.add(v);
            }

            const sovCountry = GS.sides.flat().find(c => c.id === sovId);
            const nm = (sovCountry && sovCountry.name) ? sovCountry.name.toUpperCase() : 'NATION';
            if (GS.encirclePops) GS.encirclePops.push({ lat: cap.lat, lng: cap.lng, text: nm + ' ANNEXED', life: 360, maxLife: 360 });
        });
        if (annexDead.size > 0) GS.units = GS.units.filter(u => !annexDead.has(u));
    }
    // OWNER ASK (2026-07-03): "remove the capital / fight-on / puppet system." Losing a capital
    // must NEVER trigger a surrender, annex, or puppet — it only tightens supply now (via
    // GS.capitalLostCountries, set above). A nation is defeated ONLY when it is actually overrun
    // (all cities fall / board-control enders / it is ground below the land floor), or when it
    // agrees to the negotiated-peace off-ramp restored below. So the whole fold/fight-on/puppet
    // politics block is disabled by default; it stays gated behind the opt-in annex checkbox above.
    else if (false && countryCapitalLost.size > 0) {
        if (!GS.capitalDecided) GS.capitalDecided = new Set();
        if (!GS.capitalReconsider) GS.capitalReconsider = new Map();
        if (!GS.capitalFightOnCount) GS.capitalFightOnCount = new Map();
        if (!GS.capitalFightOnLand) GS.capitalFightOnLand = new Map();
        if (!GS.puppetCountries) GS.puppetCountries = new Set();
        const puppetDead = new Set();
        let puppetMade = false;
        countryCapitalLost.forEach((_, sovId) => {
            if (GS.capitalDecided.has(sovId)) return; // already a puppet — locked
            // A country that chose to fight on isn't locked forever: it re-weighs surrender
            // periodically, and the odds climb as it keeps bleeding land. This stops the
            // "everyone fights on forever, the war never ends" case.
            const reconsiderAt = GS.capitalReconsider.get(sovId);
            if (reconsiderAt !== undefined && GS.simFrameCount < reconsiderAt) return;
            const cap = countryCapitalCaptor.get(sovId);
            if (!cap || cap.captorId <= 0 || cap.captorId === sovId) return;
            const sovSide = countryToSideMap.get(sovId);
            const captorSide = countryToSideMap.get(cap.captorId);
            if (sovSide === undefined || captorSide === undefined || sovSide === captorSide) return;

            const sovCountry = GS.sides.flat().find(c => c.id === sovId);
            const nm = (sovCountry && sovCountry.name) ? sovCountry.name.toUpperCase() : 'NATION';
            const stats = countryStats.get(sovId);
            const held = stats ? stats.controlled : 0;
            const initial = (sovCountry && sovCountry.initialCells) ? sovCountry.initialCells : 1;
            const frac = initial > 0 ? held / initial : 0;
            // Strong remnant → often fights on; gutted → almost always sues for terms.
            // Biased toward puppeting (owner ask: capitals should actually flip to puppet,
            // not endlessly fight on), and each reconsideration raises the odds further.
            const fightOns = GS.capitalFightOnCount.get(sovId) || 0;
            // Baseline: the land fraction it held the moment its capital first fell. This is
            // the reference we measure "how much more territory has it lost while fighting on"
            // against. Recorded once, on first encounter (before it can fight on).
            if (!GS.capitalFightOnLand.has(sovId)) GS.capitalFightOnLand.set(sovId, frac);
            const baselineFrac = GS.capitalFightOnLand.get(sovId);
            // Owner rule: a nation that loses its capital, fights on, and then bleeds a
            // meaningful chunk of its remaining territory should give up. Once it has shed
            // ≥18% of its original homeland since the capital fell, it's forced to settle —
            // a decisive ground loss ends the war regardless of the odds roll.
            const lostSinceCapital = baselineFrac - frac;
            const forcedByTerritoryLoss = fightOns > 0 && lostSinceCapital >= 0.18;
            // MIDDLE GROUND (owner "Middle"): fold MOST of the time, fight-on SOMETIMES.
            // The full removal (always fight-on) lost -7% avg playtime — players want the
            // "capital falls → war resolves" beat. But always folding felt flat. So a healthy
            // remnant now surrenders ~70% of the first roll (fights on ~30%), and the ~30%
            // that DO fight on keep a real army (supply softener) so it's a meaningful
            // contest, not a hollow token force. Gutted remnants still almost always fold.
            // Backstops below (fightOns escalation + forced settle) guarantee termination.
            let puppetChance = frac > 0.6 ? 0.70 : (frac > 0.35 ? 0.82 : 0.92);
            // Each prior fight-on adds +20% to the surrender odds, so a nation with a
            // FROZEN front (whose land fraction never shrinks) still converges to a
            // decision instead of rolling the same odds forever.
            puppetChance = Math.min(1, puppetChance + fightOns * 0.2);
            // Hard backstops: (a) it has lost decisive ground since the capital fell, or
            // (b) after 3 fight-ons — either way it's FORCED to settle, guaranteeing the war
            // terminates even if the front is a perfect deadlock.
            if (forcedByTerritoryLoss || fightOns >= 3 || Math.random() < puppetChance) {
                // → falls through to the PUPPET settlement below
            } else {
                // KEEP FIGHTING (provisional): the capital-lost supply penalty makes this a
                // gamble on its remaining land. Schedule a re-decision instead of locking it —
                // sooner each time (shorter window) so a beaten nation resolves promptly.
                GS.capitalFightOnCount.set(sovId, fightOns + 1);
                GS.capitalReconsider.set(sovId, GS.simFrameCount + 1200);
                if (GS.encirclePops) GS.encirclePops.push({ lat: cap.lat, lng: cap.lng, text: nm + ' FIGHTS ON', life: 300, maxLife: 300 });
                return;
            }
            // SETTLEMENT TYPE — annex vs puppet. Owner ask: "make them become puppets less."
            // Puppeting used to be the ONLY settlement outcome, so almost every fallen capital
            // produced a surviving vassal. Now a puppet is the exception: only a nation that
            // still holds a real remnant (≥30% of its homeland) is worth keeping as a vassal,
            // and even then only some of the time. Everyone else — the gutted majority — is
            // annexed outright (full seizure + elimination) via the standard capitulation path,
            // which also cleanly ends the war through the one-side-left check.
            const doPuppet = frac >= 0.30 && Math.random() < 0.45;
            if (!doPuppet) {
                GS.capitalDecided.add(sovId);
                if (sovCountry && sovSide !== undefined) capitulateCountry(sovCountry, sovSide);
                return;
            }
            GS.capitalDecided.add(sovId); // puppet decision is permanent
            GS.puppetCountries.add(sovId);
            puppetMade = true;
            // BECOME A PUPPET & LEAVE THE WAR. The old bug: the loser only shuffled some
            // land/troops but stayed on its own side, so it remained an enemy of the captor
            // and kept fighting forever — the "PUPPET" text fired but the war never ended.
            // Fix: settle it like a separate peace. Only the enemy-OCCUPIED part of its land
            // is carved off to the occupier; the rest stabilizes back under the puppet. Its
            // army stands down, it exits its side, and it becomes a vassal of the captor.
            // With the loser out of the war, the standard one-side-left check ends it.
            const sovIsPoleA = sovSide % 2 === 0;
            for (let gi = 0; gi < GS.worldControlMap.length; gi++) {
                if (GS.landMask[gi] !== 2) continue;
                const ownerId = GS.worldControlMap[gi];
                const occupierId = GS.primaryOccupierMap[gi];
                const occ = GS.occupationMap[gi];
                if (ownerId === sovId) {
                    // Enemy standing on the puppet's soil keeps it; the rest reverts + stabilizes.
                    const occupiedByEnemy = sovIsPoleA ? (occ < -0.05) : (occ > 0.05);
                    if (occupiedByEnemy) GS.worldControlMap[gi] = occupierId > 0 ? occupierId : cap.captorId;
                    GS.landMask[gi] = 1;
                    GS.occupationMap[gi] = 0;
                    GS.primaryOccupierMap[gi] = 0;
                } else if (occupierId === sovId) {
                    // The puppet relinquishes any land it was occupying abroad.
                    GS.landMask[gi] = 1;
                    GS.occupationMap[gi] = 0;
                    GS.primaryOccupierMap[gi] = 0;
                }
            }
            // Stand the puppet's whole army down (booked as casualties) so it stops fighting.
            const sovIsPoleA_spU = sovIsPoleA ? (GS.soldiersPerUnitA || CONFIG.UNIT_TO_SOLDIER_RATIO) : (GS.soldiersPerUnitB || CONFIG.UNIT_TO_SOLDIER_RATIO);
            GS.units.forEach(v => {
                if (v.sovereignId !== sovId) return;
                const loss = Math.max(0, (v.health / CONFIG.UNIT_HEALTH) * sovIsPoleA_spU);
                if (sovIsPoleA) GS.teamASoldiers = Math.max(0, GS.teamASoldiers - loss);
                else GS.teamBSoldiers = Math.max(0, GS.teamBSoldiers - loss);
                GS.countryCasualties.set(sovId, (GS.countryCasualties.get(sovId) || 0) + loss);
                puppetDead.add(v);
            });
            GS.units.forEach(u => { if (u.beneficiaryId === sovId) u.beneficiaryId = u.sovereignId; });
            // Exit its side — the beaten nation is out of the war.
            if (sovCountry && GS.sides[sovSide]) {
                const rmIdx = GS.sides[sovSide].indexOf(sovCountry);
                if (rmIdx > -1) GS.sides[sovSide].splice(rmIdx, 1);
            }
            // Vassalize under the captor (set fields inline; don't open the inspector mid-sim).
            const vMeta = GS.countryMetadata.find(m => m && m.id === sovId);
            if (vMeta) {
                if (!vMeta.baseFlagUrl) vMeta.baseFlagUrl = vMeta.flagUrl || null;
                vMeta.overlordId = cap.captorId;
            }
            if (sovCountry) sovCountry.overlordId = cap.captorId;
            generatePuppetFlag(sovId, cap.captorId);
            if (GS.encirclePops) GS.encirclePops.push({ lat: cap.lat, lng: cap.lng, text: nm + ' PUPPET', life: 360, maxLife: 360 });
        });
        if (puppetDead.size > 0) GS.units = GS.units.filter(u => !puppetDead.has(u));
        if (puppetMade) { updateSidesUI(); if (GS.influenceLayer) GS.influenceLayer.render(); }
    }

    // Mid-War Recruitment (Steady, Land-Capped, and Underdog-Aware)
    GS.sides.forEach((side, sIdx) => {
        side.forEach(country => {
            const stats = countryStats.get(country.id);
            if (!stats) return;

            const currentUnits = stats.units;
            const initialLand = country.initialCells || 1;
            const currentLand = stats.controlled;
            
            const supplyFailed = GS.capitalLostCountries.has(country.id);
            // Increased army caps to accommodate the much higher frontline saturation requirements.
            const multiplier = parseFloat(DOM.densitySlider.value) || 1.0;
            // Less aggressive size scaling to allow large empires to maintain thick lines.
            const sizeFactor = Math.max(1, currentLand / 2000);
            const densityScale = 1.0 / Math.pow(sizeFactor, 0.35);
            // Stronger city-based cap: more cities = more potential divisions in the field.
            const cityCount = countryToCityCount.get(country.id) || 0;
            const landCityMultiplier = 1 + (cityCount * 0.12); // each city adds +12% to this country's cap (capped later by side limits)
            const landBasedCap = Math.max(
                8,
                Math.floor(currentLand * CONFIG.UNIT_DENSITY_FACTOR * 1.5 * multiplier * densityScale * landCityMultiplier)
            );
            const sideLimit = CONFIG.MAX_UNITS_PER_SIDE;
            
            // Flexible Limit: allow bigger armies but still clamp for performance
            const flexibleLimit = sideLimit * (1 + Math.min(3.0, (currentLand / 4000) + (cityCount * 0.15)));
            let absoluteCap = Math.min(landBasedCap, flexibleLimit);
            
            // GODLY Buff: Higher cap and ignores flexible limits
            if (country.buffState === 'godly') {
                absoluteCap = Math.max(absoluteCap, 3600);
            }

            // If the capital has fallen, supply is failing: drastically limit total fieldable troops
            if (supplyFailed) {
                if (GS.fightOnCountries && GS.fightOnCountries.has(country.id)) {
                    absoluteCap = Math.max(30, Math.floor(absoluteCap * 0.6));
                } else {
                    absoluteCap = Math.min(absoluteCap, 5);
                }
            }

            if (currentUnits < absoluteCap) {
                const controlRatio = currentLand / initialLand; 
                const cityCountLocal = countryToCityCount.get(country.id) || 0;
                const cityBonus = 0.5 + cityCountLocal * 0.5; // Cities are a primary driver of recruitment speed
                
                // Manpower Scale: Diminishing returns on recruitment for massive nations
                // to prevent them from overwhelmingly flooding the screen with unit flags.
                const landRatio = currentLand / 2000; // Reference size
                let scaleFactor = Math.max(0.5, Math.pow(landRatio, 0.4));

                // Underdog Bonus: help nations that have lost most of their land cycle recruits faster
                const underdogFactor = (controlRatio < 0.4) ? (0.4 - controlRatio) * 2.0 : 0;

                // Annexation Urgency: once a country drops under 60% of its original land,
                // ramp recruitment up sharply the closer it gets to zero to avoid soft capitulations.
                const annexationUrgency = controlRatio < 0.6 ? (0.6 - controlRatio) * 4.0 : 0;
                const annexationMultiplier = 1 + annexationUrgency;

                // Force-Depletion Boost: if this country's army has been ground down well
                // below the size its land can sustain (i.e. the enemy destroyed its units),
                // cycle replacements much faster so it actually rebuilds instead of getting
                // steamrolled while it still holds territory.
                const fillRatio = absoluteCap > 0 ? currentUnits / absoluteCap : 1;
                const forceDepletion = fillRatio < 0.6 ? (0.6 - fillRatio) * 2.5 : 0;

                // Side-Imbalance Boost: if this country's whole side is badly outnumbered on
                // the field by the strongest enemy side, ramp recruitment so the war stays
                // competitive instead of snowballing one-sided.
                const mySideCount = unitsBySide[sIdx] ? unitsBySide[sIdx].length : currentUnits;
                let enemySideMax = 0;
                for (let oi = 0; oi < unitsBySide.length; oi++) {
                    if (oi === sIdx) continue;
                    if (unitsBySide[oi].length > enemySideMax) enemySideMax = unitsBySide[oi].length;
                }
                const sideDeficit = enemySideMax > 0 ? Math.max(0, (enemySideMax - mySideCount) / enemySideMax) : 0;
                const imbalanceMultiplier = 1 + sideDeficit * 2.0; // up to 3x when nearly wiped out vs a full enemy side

                // Faster baseline recruitment, heavily amplified by city count, underdog status,
                // annexation urgency, and how badly the army/side has been depleted.
                const baseRecruitmentChance = 0.006;
                let recruitmentChance = baseRecruitmentChance
                    * scaleFactor
                    * (controlRatio + cityBonus + underdogFactor + forceDepletion)
                    * annexationMultiplier
                    * imbalanceMultiplier
                    * multiplier;
                
                if (country.buffState === 'godly') {
                    recruitmentChance *= 12.0; // 12x recruitment speed
                }

                // If the capital is lost, recruitment almost collapses
                if (supplyFailed) {
                    recruitmentChance *= (GS.fightOnCountries && GS.fightOnCountries.has(country.id)) ? 0.6 : 0.1;
                }
                
                if (Math.random() < recruitmentChance) {
                    spawnSingleUnit(sIdx, country.id, sIdx % 2 === 0 ? 'A' : 'B');
                }
            }
        });
    });

    // Precompute city list once per tick; URBAN strategy and global city‑focus both reuse this
    const globalCityTargets = (GS.activeTheaterCities && GS.activeTheaterCities.length ? GS.activeTheaterCities : GS.cities);

    for (let i = GS.units.length - 1; i >= 0; i--) {
        const u = GS.units[i];
        
        // Scrub NaN units immediately to prevent rendering crashes
        if (isNaN(u.lat) || isNaN(u.lng)) {
            GS.units.splice(i, 1);
            continue;
        }

        u.dirLat = 0; u.dirLng = 0; // Reset movement indicators for the current tick
        u.activeTargetPos = null; // Reset target pos for the current tick (used for arrows)
        
        // Handle deployment/mobilization phase
        if (u.deployTicks > 0) {
            u.deployTicks--;
            continue; // Skip AI and movement while deploying
        }

        let sideIndex = u.sideIndex !== undefined ? u.sideIndex : (u.team === 'A' ? 0 : 1);
        const gIdx = Math.floor(u.id * 1000) % numGroups;
        const centroids = sideCentroids[sideIndex];
        const groupCentroid = centroids ? centroids[gIdx] : null;

        // Ensure sideIndex is valid if sides were removed via capitulation
        if (sideIndex >= GS.sides.length) sideIndex = GS.sides.length - 1;
        if (sideIndex < 0) sideIndex = 0;
        
        // Sync index back to object for the renderer
        u.sideIndex = sideIndex;

        const sideList = GS.sides[sideIndex];
        if (!sideList) continue;

        const countryObj = sideList.find(c => c.id === u.sovereignId);
        const isDefensive = countryObj?.strategy === 'DEFENSIVE';
        const isUrban = countryObj?.strategy === 'URBAN';
        const metaForBuff = GS.countryMetadata.find(m => m && m.id === u.sovereignId);
        const effectiveBuff = getEffectiveBuffState(countryObj, metaForBuff);
        
        let damageDealtMult = 1.0;
        let damageTakenMult = 1.0;
        let speedBuffMult = 1.0;

        // Warfare doctrine: apply the war-wide style multipliers up front so every
        // downstream combat/movement calc inherits them (standard = all 1.0 = no change).
        if (GS.doctrineMods) {
            damageDealtMult *= GS.doctrineMods.dealt;
            damageTakenMult *= GS.doctrineMods.taken;
            speedBuffMult *= GS.doctrineMods.speed;
        }

        // Victory Boost Logic: Momentum Phase
        if (u.victoryBoostTicks > 0) {
            u.victoryBoostTicks--;
            damageDealtMult *= 1.4; // Reduced damage boost for longer battles
            speedBuffMult *= 1.3;  // Reduced speed boost for slower pushing
        }

        // Capital Loss Penalty (Nerfed to prevent instant collapse of smaller nations)
        if (countryCapitalLost.has(u.sovereignId)) {
            damageDealtMult *= 0.8; // 20% reduction (was 35%)
            damageTakenMult *= 1.15; // 15% more vulnerable (was 25%)
            speedBuffMult *= 0.9;    // 10% slower (was 20%)
        }
        
        const gridIdxNow = getGridIndex(u.lat, u.lng);
        const isAtSea = gridIdxNow === -1 || GS.landMask[gridIdxNow] === 0;
        const mountainIntensity = (GS.mountainsEnabled && gridIdxNow !== -1) ? GS.terrainMask[gridIdxNow] : 0;
        const isMountain = mountainIntensity > 0;
        const currentControl = getControlValue(u.lat, u.lng);
        
        // Naval landing ghost (owner naval revamp): when a ship crosses from sea
        // onto land it has "dropped its troops" — leave a lingering ship just off
        // the coast that despawns after a few seconds. Purely cosmetic.
        if (u._wasAtSea && !isAtSea) {
            if (!GS.navalLandings) GS.navalLandings = [];
            if (GS.navalLandings.length < 200) {
                GS.navalLandings.push({
                    lat: u.lat - (u.dirLat || 0) * 0.18,
                    lng: u.lng - (u.dirLng || 0) * 0.18,
                    dirLat: u.dirLat || 0,
                    dirLng: (u.dirLng !== undefined ? u.dirLng : (u.team === 'A' ? 1 : -1)),
                    team: u.team,
                    expireTick: GS.simFrameCount + CONFIG.NAVAL_GHOST_TICKS
                });
            }
        }
        u._wasAtSea = isAtSea;

        // Cache terrain and sea states for the renderer
        u.isAtSea = isAtSea;
        u.mountainIntensity = mountainIntensity;

        // Optional city‑focus movement target (does not affect combat logic)
        let cityFocusTarget = null;
        if (GS.cityFocusMode && cityTargets && cityTargets.length) {
            const teamPole = (u.team === 'A') ? 1 : -1;
            let bestCity = null;
            let bestCityDistSq = Infinity;
            for (let cIdx = 0; cIdx < cityTargets.length; cIdx++) {
                const city = cityTargets[cIdx];
                const cv = getControlValue(city.lat, city.lng);
                // Prefer enemy or contested cities
                const isGoodTarget =
                    (teamPole > 0 && cv < 0.4) ||
                    (teamPole < 0 && cv > -0.4);
                if (!isGoodTarget) continue;
                const dSq = (u.lat - city.lat) ** 2 + (u.lng - city.lng) ** 2;
                if (dSq < bestCityDistSq) {
                    bestCityDistSq = dSq;
                    bestCity = city;
                }
            }
            if (bestCity) {
                cityFocusTarget = { lat: bestCity.lat, lng: bestCity.lng };
            }
        }

        // CITY GARRISON LOGIC: some units stay to defend nearby friendly cities
        let garrisonCity = null;
        let enemyNearGarrison = false;
        if (GS.cities && GS.cities.length) {
            const friendlyCities = GS.cities.filter(c => {
                const ownerId = c.ownerId || c.sovereignId || null;
                return ownerId === u.sovereignId;
            });
            if (friendlyCities.length) {
                let closest = null;
                let closestDistSq = Infinity;
                for (let iCity = 0; iCity < friendlyCities.length; iCity++) {
                    const c = friendlyCities[iCity];
                    const dSq = (u.lat - c.lat) ** 2 + (u.lng - c.lng) ** 2;
                    if (dSq < closestDistSq) {
                        closestDistSq = dSq;
                        closest = c;
                    }
                }
                // Within ~0.35 degrees (~40km) of a friendly city -> candidate for garrison
                if (closest && closestDistSq < 0.35 * 0.35) {
                    garrisonCity = closest;
                    // PERF: the friendly-near count and enemy-near flag for a city depend
                    // only on the city (its owning sovereign/team + current unit positions),
                    // not on which unit is asking — every unit near the same city used to
                    // re-scan all units for the identical answer (O(units) per garrisoning
                    // unit → O(units^2) in big city fights). Memoize per-city per-tick and
                    // fold the two scans into one pass. Pure memoization, same result.
                    if (GS._garrisonEvalFrame !== GS.simFrameCount) {
                        GS._garrisonEvalFrame = GS.simFrameCount;
                        GS._garrisonEvalCache = new Map();
                    }
                    const gKey = (closest.id != null) ? closest.id : (closest.lat + '_' + closest.lng);
                    let gEval = GS._garrisonEvalCache.get(gKey);
                    if (gEval === undefined) {
                        const cityRadiusSq = 0.25 * 0.25;
                        const enemyRadiusSq = 0.55 * 0.55;
                        let fN = 0;
                        let eNear = false;
                        for (let j = 0; j < GS.units.length; j++) {
                            const uu = GS.units[j];
                            const dSq = (uu.lat - closest.lat) ** 2 + (uu.lng - closest.lng) ** 2;
                            if (uu.team === u.team) {
                                if (uu.sovereignId === u.sovereignId && dSq < cityRadiusSq) fN++;
                            } else if (!eNear && dSq < enemyRadiusSq) {
                                eNear = true;
                            }
                        }
                        gEval = { friendlyNear: fN, enemyNear: eNear };
                        GS._garrisonEvalCache.set(gKey, gEval);
                    }
                    const friendlyNear = gEval.friendlyNear;
                    enemyNearGarrison = gEval.enemyNear;
                    // Mark / unmark garrison status
                    if (friendlyNear <= 5 || enemyNearGarrison) {
                        u.isGarrison = true;
                        u.garrisonCityId = closest.id || null;
                    } else {
                        // Too many defenders already, free this unit
                        if (u.isGarrison && u.garrisonCityId === (closest.id || null)) {
                            u.isGarrison = false;
                            u.garrisonCityId = null;
                        }
                    }
                } else {
                    // Far from any friendly city: clear garrison flag
                    if (u.isGarrison) {
                        u.isGarrison = false;
                        u.garrisonCityId = null;
                    }
                }
            }
        }

        if (countryObj) {
            if (effectiveBuff === 'buff') {
                damageDealtMult = 2.5;
                damageTakenMult = 0.6;
                speedBuffMult = 1.3;
            } else if (effectiveBuff === 'super') {
                damageDealtMult = 10.0;
                damageTakenMult = 0.2;
                speedBuffMult = 1.8;
            } else if (effectiveBuff === 'godly') {
                damageDealtMult = 40.0;
                damageTakenMult = 0.015;
                speedBuffMult = 2.2;
            } else if (effectiveBuff === 'weakened') {
                damageDealtMult = 0.7;
                damageTakenMult = 1.4;
                speedBuffMult = 0.7; // slightly slower when weakened
            } else if (effectiveBuff === 'crippled') {
                damageDealtMult = 0.4;
                damageTakenMult = 2.5;
                speedBuffMult = 0.7;
            }

            // Continuous attack/defense modifiers from sliders (-90% .. +90%)
            const atkPct = typeof countryObj.attackBuffPercent === 'number' ? countryObj.attackBuffPercent : 0;
            const defPct = typeof countryObj.defenseBuffPercent === 'number' ? countryObj.defenseBuffPercent : 0;
            const atkFactor = 1 + (atkPct / 100);
            const defFactor = 1 + (defPct / 100);
            if (atkFactor > 0) damageDealtMult *= atkFactor;
            // positive defPct reduces damageTaken (tougher), negative increases (softer)
            if (defFactor > 0.01) damageTakenMult *= (1 / defFactor);
        }

        // Terrain Modifiers: Mountains reduce speed and lethality based on intensity (size/scale)
        if (isMountain) {
            // Intensity 1.0 = full penalty, Intensity 0.1 = minimal penalty
            speedBuffMult *= (1.0 - (0.65 * mountainIntensity)); 
            damageDealtMult *= (1.0 - (0.4 * mountainIntensity));
            damageTakenMult *= (1.0 - (0.4 * mountainIntensity));
        }

        // Alpenjägers: small, quiet buffs with emphasis on mountain warfare
        if (u.isAlpenjager) {
            if (isMountain) {
                speedBuffMult *= CONFIG.ALPEN_MTN_SPEED_MULT;
            }
            damageDealtMult *= CONFIG.ALPEN_COMBAT_MULT;
            damageTakenMult *= (1.0 / CONFIG.ALPEN_COMBAT_MULT);
        }

        // Exile Disbandment: If a navy is at sea and its nation has lost all land, it slowly disbands
        if (isAtSea && countryObj) {
            const stats = countryStats.get(u.sovereignId);
            if (stats && stats.controlled === 0) {
                if (Math.random() < 0.02) { // Gradual disappearance of exiled navies
                    GS.units.splice(i, 1);
                    continue;
                }
            }
        }

        // --- ENCIRCLEMENT DETECTION (coarse topology) ---
        // Read the sealed-pocket map computed in the collapse pass (see encirclement.js):
        // a unit is encircled iff the ground it stands on is cut off from the outside.
        // Scale-free, so a unit standing on its own ground deep inside a large sealed
        // salient is finally caught — the old per-unit ring couldn't see past its own
        // radius and silently missed any pocket bigger than the ring.
        const isMega = effectiveBuff === 'super';
        const isSuper = effectiveBuff === 'buff';
        const isWeak = effectiveBuff === 'weakened';
        const isCripple = effectiveBuff === 'crippled';

        let isEncircled = false;
        if (!isAtSea && !isMega && !isSuper && GS.encircledCoarse && GS.encCw) {
            const step = GS.encStep, cw = GS.encCw, ch = GS.encCh;
            const wl = ((u.lng + 180) % 360 + 360) % 360;
            const cx = Math.floor((wl / CONFIG.GRID_RES) / step);
            const cy = Math.floor(((u.lat + 90) / CONFIG.GRID_RES) / step);
            if (cx >= 0 && cx < cw && cy >= 0 && cy < ch) {
                const cv = GS.encircledCoarse[cy * cw + cx];
                isEncircled = u.team === 'A' ? cv === 1 : cv === -1;
            }
        }

        if (isEncircled && !isMega && !isSuper) {
            damageDealtMult *= 0.25; // Massive reduction in combat effectiveness
            damageTakenMult *= 4.0;  // Extremely vulnerable to attacks
        }

        // Attrition logic: logistics strain increases the further you push into large nations
        const inEnemyTerritory = !isAtSea && ((u.team === 'A' && currentControl < -0.2) || (u.team === 'B' && currentControl > 0.2));
        
        // Attrition is disabled during Victory Boost (momentum) to prevent breakthroughs from stalling instantly
        if ((inEnemyTerritory || isEncircled) && !isMega && !isSuper && u.victoryBoostTicks <= 0) {
            // Logistics Strain: Attrition scales with the target's total land area
            let targetLandSize = 0;
            const enemySideIndices = GS.sides.map((_, idx) => idx).filter(idx => idx !== sideIndex);
            enemySideIndices.forEach(idx => {
                GS.sides[idx].forEach(enemy => {
                    const s = countryStats.get(enemy.id);
                    if (s) targetLandSize += s.controlled;
                });
            });

            const logisticsPenalty = Math.max(1, Math.log10(targetLandSize / 500 + 1));
            // War Fatigue: Attrition damage scales with war duration, wearing out enemies over time
            const warFatigueFactor = 1.0 + (GS.simFrameCount / 8000); 
            let dmg = CONFIG.ATTRITION_DAMAGE * (1 + Math.abs(currentControl) * 3) * logisticsPenalty * warFatigueFactor;
            
            if (isEncircled) dmg *= CONFIG.ENCIRCLEMENT_DAMAGE_MULT; 
            recordDamage(u, dmg * damageTakenMult);

            // Instant death triggers full remaining health as casualties
            if (isEncircled && Math.random() < 0.001) {
                recordDamage(u, u.health);
            }
        }

        // --- EXPEDITIONARY SUPPORT SYSTEM ---
        const role = countryObj?.role || 'OFFENSE';
        const alliesMetadata = sideList.filter(c => c.id !== u.sovereignId);
        const offensiveAllies = alliesMetadata.filter(c => c.role === 'OFFENSE');

        if (role === 'SUPPORT') {
            if (offensiveAllies.length > 0) {
                if (!u.beneficiaryId || u.beneficiaryId === u.sovereignId || !offensiveAllies.some(a => a.id === u.beneficiaryId)) {
                    u.beneficiaryId = offensiveAllies[Math.floor(Math.random() * offensiveAllies.length)].id;
                }
            } else if (alliesMetadata.length > 0) {
                if (!u.beneficiaryId || u.beneficiaryId === u.sovereignId) {
                    u.beneficiaryId = alliesMetadata[Math.floor(Math.random() * alliesMetadata.length)].id;
                }
            } else {
                u.beneficiaryId = u.sovereignId;
            }
        } else {
            // Offensive units: Drastically reduced chance to randomly wander off to support allies (like Britain to Canada)
            // unless their sovereign land is almost entirely occupied.
            const myStats = countryStats.get(u.sovereignId);
            const myInitial = (countryObj?.initialCells || 1);
            const beingOverrun = myStats ? (myStats.controlled < myInitial * 0.3) : false;
            
            // Significantly reduced probability to wander to an ally's territory (0.02% per frame)
            if (!beingOverrun && Math.random() < 0.0002 && alliesMetadata.length > 0) {
                u.beneficiaryId = alliesMetadata[Math.floor(Math.random() * alliesMetadata.length)].id;
            } else if (Math.random() < 0.12 || !u.beneficiaryId) {
                // High chance to reset to sovereign target to ensure focus on the main theater
                u.beneficiaryId = u.sovereignId;
            }
        }

        // Tactical Awareness: Identify enemies and local balance of power using O(1) Spatial Hash
        let target = null;
        let minDist = Infinity;
        let retreatVector = null;

        const tacticalRadiusSq = 0.6 * 0.6;
        const repulsionRadiusSq = 0.45 * 0.45;
        let localEnemyCount = 0;
        let localAllyCount = 1;
        let enemyCentroidLat = 0;
        let enemyCentroidLng = 0;
        
        const isRebelUnit = GS.activeRebellion && u.sovereignId === GS.activeRebellion.rebelId;
        const isAlpen = !!u.isAlpenjager;

        if (cityFocusTarget) {
            target = cityFocusTarget;
            minDist = (u.lat - cityFocusTarget.lat) ** 2 + (u.lng - cityFocusTarget.lng) ** 2;
        }

        const kx = Math.floor((u.lng + 180) / HASH_SIZE);
        const ky = Math.floor((u.lat + 90) / HASH_SIZE);
        const maxKx = Math.ceil(360 / HASH_SIZE);
        
        // Only search adjacent 3x3 hash cells (approx 6x6 degrees footprint)
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                let cx = kx + dx;
                const cy = ky + dy;
                
                if (cx < 0) cx += maxKx;
                else if (cx >= maxKx) cx -= maxKx;

                const arr = unitHash.get(cx + '_' + cy);
                if (!arr) continue;

                for (let j = 0; j < arr.length; j++) {
                    const e = arr[j];
                    if (e === u) continue;

                    const isEnemy = (e.sideIndex !== sideIndex);
                    
                    let deLng = e.lng - u.lng;
                    if (deLng > 180) deLng -= 360;
                    else if (deLng < -180) deLng += 360;
                    
                    const dSq = (u.lat - e.lat)**2 + deLng**2;

                    if (isEnemy) {
                        const eIdx = getGridIndex(e.lat, e.lng);
                        const eAtSea = eIdx === -1 || GS.landMask[eIdx] === 0;

                        if ((isDefensive || isRebelUnit) && !isAtSea) {
                            const isEnemyInMyMandatedLand = eIdx !== -1 && (isRebelUnit ? GS.deJureMap[eIdx] === u.sovereignId : GS.worldControlMap[eIdx] === u.sovereignId);
                            if (!isEnemyInMyMandatedLand && dSq > 0.09) continue; 
                        }

                        let distMult = eAtSea && !isAtSea ? 50.0 : 1.0;
                        const noise = (Math.sin(u.id + GS.simFrameCount * 0.02) * 0.03);
                        const noisyDSq = ((u.lat - e.lat + noise)**2 + (deLng + noise)**2) * distMult;

                        if (noisyDSq < minDist) {
                            minDist = noisyDSq;
                            target = e;
                        }

                        if (dSq < tacticalRadiusSq) {
                            let eWeight = 1;
                            if (eAtSea) eWeight *= (isAtSea ? 0.6 : 0.2);

                            const eSideIdx = countryToSideMap.get(e.sovereignId);
                            const eCountry = eSideIdx !== undefined ? GS.sides[eSideIdx].find(c => c.id === e.sovereignId) : null;
                            
                            if (eCountry?.buffState === 'super') eWeight *= 200;
                            else if (eCountry?.buffState === 'buff') eWeight *= 50;

                            localEnemyCount += eWeight;
                            enemyCentroidLat += e.lat * eWeight;
                            enemyCentroidLng += e.lng * eWeight;

                            if (dSq < 0.04) {
                                let proximityDamage = (CONFIG.COMBAT_DAMAGE * 0.07) * damageDealtMult * (1.0 - Math.sqrt(dSq)/0.2);
                                if (isAtSea && eAtSea) proximityDamage *= 2.2;

                                recordDamage(e, proximityDamage);
                                recordDamage(u, (proximityDamage * 0.8) * damageTakenMult);
                                
                                u.lastCombatTick = GS.simFrameCount;
                                e.lastCombatTick = GS.simFrameCount;
                                if (e.health <= 0) u.victoryBoostTicks = 240;

                                let existing = GS.activeBattles.find(b => (u.lat - b.lat)**2 + (u.lng - b.lng)**2 < 0.16);
                                if (existing) {
                                    existing.participants++;
                                    existing.lat = (existing.lat * (existing.participants - 1) + (u.lat + e.lat) / 2) / existing.participants;
                                    existing.lng = (existing.lng * (existing.participants - 1) + (u.lng + e.lng) / 2) / existing.participants;
                                } else {
                                    GS.activeBattles.push({ lat: (u.lat + e.lat) / 2, lng: (u.lng + e.lng) / 2, participants: 2 });
                                }
                            }
                        }
                    } else {
                        // Allies logic
                        if (dSq < tacticalRadiusSq) {
                            let aWeight = 1;
                            const aSideIdx = countryToSideMap.get(e.sovereignId);
                            const aCountry = aSideIdx !== undefined ? GS.sides[aSideIdx].find(c => c.id === e.sovereignId) : null;
                            if (aCountry?.buffState === 'super') aWeight *= 200;
                            else if (aCountry?.buffState === 'buff') aWeight *= 50;

                            localAllyCount += aWeight;

                            if (dSq < repulsionRadiusSq && dSq > 0.00001) {
                                const d = Math.sqrt(dSq);
                                if (!u.repulsionVector) u.repulsionVector = { lat: 0, lng: 0 };
                                u.repulsionVector.lat += (u.lat - e.lat) / d;
                                u.repulsionVector.lng += (u.lng - e.lng) / d;
                            }
                        }
                    }
                }
            }
        }
        
        u.lastAllyCount = localAllyCount;

        // Retreat logic: If enemy force is > 5x ally force (increased threshold to prevent premature dodging)
        if (localEnemyCount > localAllyCount * 8 && localEnemyCount >= 5) {
            const avgLat = enemyCentroidLat / localEnemyCount;
            const avgLng = enemyCentroidLng / localEnemyCount;
            const dirLat = u.lat - avgLat;
            const dirLng = u.lng - avgLng;
            const mag = Math.sqrt(dirLat*dirLat + dirLng*dirLng);
            if (mag > 0) {
                retreatVector = { lat: dirLat/mag, lng: dirLng/mag };
            }
        }

        const collapsedEnemyNations = sideToCollapsedNations[sideIndex] || [];
        
        const targetIdx = target ? getGridIndex(target.lat, target.lng) : -1;
        const targetAtSea = target && (targetIdx === -1 || GS.landMask[targetIdx] === 0);
        
        const totalEnemiesCount = GS.units.length - unitsBySide[sideIndex].length;
        
        // Global Target Fallback (if no enemies were found in the local 6-degree spatial hash but enemies exist somewhere)
        if (!target && !cityFocusTarget && totalEnemiesCount > 0) {
             let bestCentroidDist = Infinity;
             sideCentroids.forEach((centroids, idx) => {
                 const isEnemySide = (idx !== sideIndex);
                 if (isEnemySide && centroids) {
                     centroids.forEach(c => {
                         if (!c) return;
                         let dcLng = c.lng - u.lng;
                         if (dcLng > 180) dcLng -= 360; else if (dcLng < -180) dcLng += 360;
                         const dSq = (u.lat - c.lat)**2 + dcLng**2;
                         if (dSq < bestCentroidDist) {
                             bestCentroidDist = dSq;
                             target = c; 
                         }
                     });
                 }
             });
        }

        // Unified behavior: Units hunt enemies when nearby, but switch to focused territory capture (mop-up) 
        // when there are literally zero enemy units remaining.
        const shouldMopUp = (totalEnemiesCount === 0);

        // Target Caching: Only re-search for mop-up targets every few ticks to save CPU
        if (u.targetSearchCooldown > 0) {
            u.targetSearchCooldown--;
        }

        // Frontline Pressure: If unit is too close to a moving/losing border, push it back
        const borderBuffer = 0.06; // Narrower buffer so units sit "right on" the frontline
        const currentIdx = getGridIndex(u.lat, u.lng);
        const currentOwnerId = currentIdx !== -1 ? GS.worldControlMap[currentIdx] : 0;
        const currentOwnerSideIdx = countryToSideMap.get(currentOwnerId);
        
        // Tactical Control: If we significantly occupy the land, it's not "enemy land" for movement purposes
        // Broadened "friendly" land check to make units wait further back from the actual border
        const isEffectivelyMyLand = (u.team === 'A' && currentControl > 0.35) || (u.team === 'B' && currentControl < -0.35);
        const isOnEnemyLand = !isEffectivelyMyLand && currentOwnerSideIdx !== undefined && (currentOwnerSideIdx !== sideIndex);

        // Mega and Super units are immune to the automatic pushback; they ARE the pushback.
        // BUG FIX: Units were being "pushed back" and taking skirmish damage even when attacking into enemy land.
        // Pushback now only triggers if the unit is on friendly/sovereign territory that is being overrun by enemies.
        const ownerIdAtUnit = currentIdx !== -1 ? GS.worldControlMap[currentIdx] : 0;
        const ownerSideIdx = countryToSideMap.get(ownerIdAtUnit);
        const onFriendlySovereignLand = ownerSideIdx !== undefined && (ownerSideIdx === sideIndex);

        const isTooNearBorder = !isAtSea &&
            !isMega &&
            !isSuper &&
            onFriendlySovereignLand &&
            // Only treat tiles that are part of the active warzone as "border band"
            currentIdx !== -1 &&
            GS.landMask[currentIdx] === 2 &&
            (
                (u.team === 'A' && (currentControl < borderBuffer)) ||
                (u.team === 'B' && (currentControl > -borderBuffer))
            );

        // Direction toward nearby frontline (used to pull units to the border instead of roaming)
        const borderDir = getBorderDirection(u);
        
        if (isTooNearBorder && !isAtSea) {
            // Frontline Skirmish Damage: Being pushed back by an advancing border is taxing and represents rear-guard casualties
            const skirmishDamage = CONFIG.COMBAT_DAMAGE * 0.15 * (1.0 + Math.abs(currentControl) * 2);
            recordDamage(u, skirmishDamage * damageTakenMult);

            // Find direction of safety (deeper into friendly territory) by sampling nearby grid
            let bestLat = 0, bestLng = 0, bestVal = u.team === 'A' ? -Infinity : Infinity;
            const sDist = 0.6; // Sample further out to find safe haven
            const samples = [
                [0, sDist], [0, -sDist], [sDist, 0], [-sDist, 0], 
                [sDist*0.7, sDist*0.7], [-sDist*0.7, -sDist*0.7], [sDist*0.7, -sDist*0.7], [-sDist*0.7, sDist*0.7]
            ];
            
            samples.forEach(([dlng, dlat]) => {
                const sampleLat = u.lat + dlat;
                const sampleLng = u.lng + dlng;
                const val = getControlValue(sampleLat, sampleLng);
                const sIdx = getGridIndex(sampleLat, sampleLng);
                const isSampleLand = sIdx !== -1 && GS.landMask[sIdx] > 0;
                
                // Score samples: prioritize land and friendly control
                let score = val;
                
                const sampleOwnerId = sIdx !== -1 ? GS.worldControlMap[sIdx] : 0;
                const isSampleAlly = sideList.some(c => c.id === sampleOwnerId);

                if (!isSampleLand) {
                    // Sea is the ultimate retreat penalty
                    score = u.team === 'A' ? -999 : 999;
                } else if (isNeutralCountry(sIdx)) {
                    // Neutral land is "lava" - absolute priority is to stay out of non-combatant territory
                    score = u.team === 'A' ? -2500 : 2500;
                } else if (!isSampleAlly) {
                    // Enemy land is also a bad retreat destination but slightly more viable than neutral "lava"
                    score = u.team === 'A' ? -800 : 800;
                }

                if (u.team === 'A' ? score > bestVal : score < bestVal) {
                    bestVal = score;
                    bestLat = dlat;
                    bestLng = dlng;
                }
            });
            
            if (bestVal !== (u.team === 'A' ? -Infinity : Infinity)) {
                const mag = Math.sqrt(bestLat*bestLat + bestLng*bestLng);
                if (mag > 0) {
                    if (!retreatVector) retreatVector = { lat: 0, lng: 0 };
                    // Strong pushback force to ensure they outrun the advancing frontline
                    retreatVector.lat += (bestLat / mag) * 6.0;
                    retreatVector.lng += (bestLng / mag) * 6.0;
                }
            }
        }

        if (shouldMopUp) {
            // Mop-up mode: Enemy has no units or target is far and collapsed nations exist
            let enemyId = -1;
            const isRebel = GS.activeRebellion && u.sovereignId === GS.activeRebellion.rebelId;
            
            if (isRebel) {
                // REBELS: Target their own de jure land exclusively
                enemyId = u.sovereignId;
            } else if (isDefensive) {
                // DEFENSIVE: Target own nation to find occupied cells to reclaim
                enemyId = u.sovereignId;
            } else if (collapsedEnemyNations.length > 0) {
                // If there are multiple collapsed nations, prioritize the first few (which are sorted by OFFENSE role)
                const candidates = collapsedEnemyNations.slice(0, 3);
                enemyId = candidates[Math.floor(Math.random() * candidates.length)].id;
            } else {
                const possibleEnemySides = GS.sides.filter((s, idx) => {
                    if (GS.ffaMode) return idx !== sideIndex;
                    return idx !== sideIndex;
                }).filter(s => s.length > 0);
                
                if (possibleEnemySides.length > 0) {
                    const randomEnemySide = possibleEnemySides[Math.floor(Math.random() * possibleEnemySides.length)];
                    const randomEnemyCountry = randomEnemySide[Math.floor(Math.random() * randomEnemySide.length)];
                    enemyId = randomEnemyCountry?.id || -1;
                }
            }

            // If supporting an ally and no enemies nearby, move towards their frontlines
            // Only actually go to the ally if that ally is losing land (has occupation)
            let activeSupportTarget = null;
            if (u.beneficiaryId !== u.sovereignId) {
                const ally = sideList.find(c => c.id === u.beneficiaryId);
                const allyStats = countryStats.get(u.beneficiaryId);
                const allyInitial = ally?.initialCells || 1;
                // Only support allies that are at least 5% occupied to prevent unnecessary wandering
                if (ally && allyStats && allyStats.controlled < allyInitial * 0.95) {
                    activeSupportTarget = ally;
                } else {
                    // Force redirect back to sovereign/enemy goals if ally is safe
                    u.beneficiaryId = u.sovereignId;
                }
            }

            const needsNewTarget = !u.mopUpTarget || 
                                 (u.targetSearchCooldown <= 0) || 
                                 (u.lastMopUpId && u.lastMopUpId !== (activeSupportTarget ? activeSupportTarget.id : enemyId));

            if (needsNewTarget) {
                u.targetSearchCooldown = 15 + Math.floor(Math.random() * 20); // 0.25s - 0.6s cache
                const targetId = activeSupportTarget ? activeSupportTarget.id : enemyId;
                u.lastMopUpId = targetId;
                let bestCellIdx = -1;
                let bestScore = -Infinity;
                const isTeamA = u.team === 'A';
                
                // Calculate unit's relative position in its team cluster to maintain "lane" seeking
                const relLat = groupCentroid ? u.lat - groupCentroid.lat : 0;
                const relLng = groupCentroid ? u.lng - groupCentroid.lng : 0;

                // Hive Sector Logic constants: depend only on this unit's group, so compute the
                // squad's assigned geographic arc ONCE per target search instead of re-running
                // sin/cos for every one of the up-to-250 sampled candidate cells below.
                const sectorAngle = (gIdx / numGroups) * Math.PI * 2;
                const sectorLat = Math.sin(sectorAngle) * 45;
                const sectorLng = Math.cos(sectorAngle) * 45;

                // United Push Targeting: Sample cells heavily focused on the actual front rather than deep roaming.
                for (let j = 0; j < 250; j++) {
                    const randIdx = Math.floor(Math.random() * GS.worldControlMap.length);
                    const ownerAtIdx = GS.worldControlMap[randIdx];
                    const deJureAtIdx = GS.deJureMap[randIdx];

                    let isCandidate = false;
                    if (isRebel) {
                        if (deJureAtIdx === GS.activeRebellion.rebelId) {
                            const occ = GS.occupationMap[randIdx];
                            if ((isTeamA && occ < 0.95) || (!isTeamA && occ > -0.95)) isCandidate = true;
                        }
                    } else if (ownerAtIdx === targetId) {
                        const occ = GS.occupationMap[randIdx];
                        if (isDefensive) {
                            if ((isTeamA && occ < 0.98) || (!isTeamA && occ > -0.98)) isCandidate = true;
                        } else {
                            if ((isTeamA && occ < 0.85) || (!isTeamA && occ > -0.85)) isCandidate = true;
                        }
                    }

                    if (isCandidate) {
                        const cy = Math.floor(randIdx / GS.gridWidth);
                        const cx = randIdx % GS.gridWidth;
                        const cLat = (cy * CONFIG.GRID_RES) - 90;
                        const cLng = (cx * CONFIG.GRID_RES) - 180;

                        // Distance to assigned squad sector (sector arc hoisted above the loop)
                        const sectorDistSq = (cLat - sectorLat)**2 + (cLng - sectorLng)**2;
                        const sectorBias = Math.max(0, 100 - sectorDistSq * 0.05);

                        let dcLng = cLng - u.lng;
                        if (dcLng > 180) dcLng -= 360;
                        else if (dcLng < -180) dcLng += 360;

                        const distSq = (u.lat - cLat)**2 + (dcLng)**2;
                        const occ = GS.occupationMap[randIdx];
                        const occFavor = (1.0 - Math.abs(occ)) * 120; 
                        
                        // URBAN strategy: heavily reward cells that contain cities to create road‑like thrusts
                        let cityBias = 0;
                        if (countryObj?.strategy === 'URBAN') {
                            const hasCityHere = GS.cityCellSet ? GS.cityCellSet.has(randIdx) : GS.activeTheaterCities.some(c => getGridIndex(c.lat, c.lng) === randIdx);
                            if (hasCityHere) cityBias = 450;
                        }

                        // Combinatorial score: Proximity + Frontline Freshness + Squad Sector Focus + City priority
                        let score = occFavor - (distSq * 0.4) + sectorBias + cityBias;

                        // ALASKA & ARCTIC PENALTY: Discourage units from roaming to Alaska or far north islands 
                        // when Fighting in North America. This forces them to prioritize the Mainland US/Canada borders.
                        const isAlaska = cLat > 54 && cLng < -130;
                        const isArctic = cLat > 65;
                        
                        if (isAlaska) score -= 1500;
                        if (isArctic) score -= 800;

                        // MAINLAND THEATER BOOST: Encourage units to target "The Heartland" (Lower 48 / Europe core)
                        if (cLat > 25 && cLat < 50 && cLng > -125 && cLng < -65) score += 200; // US Mainland
                        if (cLat > 35 && cLat < 60 && cLng > -10 && cLng < 40) score += 200; // Europe Core
                        
                        if (score > bestScore) {
                            bestScore = score;
                            bestCellIdx = randIdx;
                        }
                    }
                }

                if (bestCellIdx !== -1) {
                    const y = Math.floor(bestCellIdx / GS.gridWidth);
                    const x = bestCellIdx % GS.gridWidth;
                    u.mopUpTarget = {
                        lat: (y * CONFIG.GRID_RES) - 90,
                        lng: (x * CONFIG.GRID_RES) - 180
                    };
                } else {
                    // Fallback: If no priority cells found, target ANY cell of the target nation.
                    // This prevents units (especially defensive or weakened ones) from freezing when priority targets are gone.
                    for (let j = 0; j < 80; j++) {
                        const randIdx = Math.floor(Math.random() * GS.worldControlMap.length);
                        if (GS.worldControlMap[randIdx] === targetId) {
                            const y = Math.floor(randIdx / GS.gridWidth);
                            const x = randIdx % GS.gridWidth;
                            u.mopUpTarget = { 
                                lat: (y * CONFIG.GRID_RES) - 90, 
                                lng: (x * CONFIG.GRID_RES) - 180 
                            };
                            break;
                        }
                    }
                }
            }
            target = u.mopUpTarget;
        }

        // CITY-FOCUS COMBAT MODE:
        // When enabled, AI movement targeting prioritizes cities as primary objectives,
        // using unit positions only for local combat/retreat decisions.
        if (GS.cityFocusMode && cityFocusTarget) {
            target = cityFocusTarget;
        }

        // If this unit is a city garrison, keep its primary target anchored to its city
        if (u.isGarrison && garrisonCity) {
            // When enemies are near, move to meet them but don't chase far away
            if (enemyNearGarrison && target && target.lat !== undefined && target.lng !== undefined) {
                // Blend between city center and enemy so garrison steps out a bit but stays local
                const blend = 0.5;
                target = {
                    lat: garrisonCity.lat * (1 - blend) + target.lat * blend,
                    lng: garrisonCity.lng * (1 - blend) + target.lng * blend
                };
            } else {
                // No nearby enemies: hold position around the city
                target = { lat: garrisonCity.lat, lng: garrisonCity.lng };
            }
        }

        if (target) {
            // Store target position for the renderer's operational arrows
            u.activeTargetPos = { lat: target.lat, lng: target.lng };

            // Spatial Jitter: Add a small, unit-specific offset to the target destination
            // to prevent multiple units from converging on the exact same coordinate.
            const jitterScale = 0.08;
            const jitterLat = target.lat + (Math.sin(u.id * 100) * jitterScale);
            const jitterLng = target.lng + (Math.cos(u.id * 100) * jitterScale);
            
            let dLat = jitterLat - u.lat;
            let dLng = jitterLng - u.lng;
            
            // GLOBAL WRAP: Shortest path around the world
            if (dLng > 180) dLng -= 360;
            else if (dLng < -180) dLng += 360;

            const dist = Math.sqrt(dLat * dLat + dLng * dLng);

            const isEngaged = u.lastCombatTick && (GS.simFrameCount - u.lastCombatTick < 2);

            // --- NAVAL STOP-AND-FIRE + ENCIRCLE (owner naval revamp) ---
            // Sea-vs-sea: instead of ramming the enemy to collide, a ship holds at a
            // standoff distance and trades ranged fire. The more friendly ships firing
            // on one enemy ship (encircling it), the faster it dies. Only applies when
            // BOTH ships are at sea — an amphibious assault on the coast falls through
            // to the normal push/combat logic so invasions are unchanged.
            let navalFiring = false;
            if (isAtSea && target && typeof target.health !== 'undefined' && target.health > 0
                && dist <= CONFIG.NAVAL_FIRE_RANGE) {
                const tIdx = getGridIndex(target.lat, target.lng);
                const tAtSea = tIdx === -1 || GS.landMask[tIdx] === 0;
                if (tAtSea) {
                    navalFiring = true;
                    const invDist = 1 / (dist || 1e-6);
                    // Face the target — drives the directional ship sprite.
                    u.dirLat = dLat * invDist;
                    u.dirLng = dLng * invDist;
                    u.lastCombatTick = GS.simFrameCount;
                    target.lastCombatTick = GS.simFrameCount;

                    // Hold at standoff: creep into firing range, then stop; ease back if too close.
                    const navalSpeed = CONFIG.UNIT_NAVAL_SPEED * speedBuffMult;
                    if (dist > CONFIG.NAVAL_STANDOFF + 0.05) {
                        u.lat += dLat * invDist * navalSpeed * 0.5;
                        u.lng += dLng * invDist * navalSpeed * 0.5;
                    } else if (dist < CONFIG.NAVAL_STANDOFF - 0.05) {
                        u.lat -= dLat * invDist * navalSpeed * 0.4;
                        u.lng -= dLng * invDist * navalSpeed * 0.4;
                    }
                    u.lat = Math.max(-89.9, Math.min(89.9, u.lat));
                    if (u.lng > 180) u.lng -= 360; else if (u.lng < -180) u.lng += 360;

                    // Encircle bonus: tally ships firing on this target this tick, carrying
                    // last tick's count so early-processed attackers also get the swarm bonus.
                    if (target._navFireStamp !== GS.simFrameCount) {
                        target._navFirePrev = target._navFireCur || 1;
                        target._navFireCur = 0;
                        target._navFireStamp = GS.simFrameCount;
                    }
                    target._navFireCur++;
                    const attackers = Math.max(target._navFireCur, target._navFirePrev || 1);
                    const encircleBonus = 1 + Math.min(CONFIG.NAVAL_ENCIRCLE_MAX, (attackers - 1) * CONFIG.NAVAL_ENCIRCLE_STEP);

                    // Range falloff: full damage at standoff, ~40% at the edge of range.
                    const span = (CONFIG.NAVAL_FIRE_RANGE - CONFIG.NAVAL_STANDOFF) || 1e-6;
                    const rangeFrac = Math.max(0, Math.min(1, 1 - (dist - CONFIG.NAVAL_STANDOFF) / span));
                    const falloff = 0.4 + 0.6 * rangeFrac;
                    const dmg = CONFIG.NAVAL_FIRE_DAMAGE * damageDealtMult * encircleBonus * falloff;
                    recordDamage(target, dmg);
                    if (target.health <= 0) u.victoryBoostTicks = 240;

                    // Firing effect for the renderer (a brief tracer toward the target).
                    u._navFireTargetLat = target.lat;
                    u._navFireTargetLng = target.lng;
                    u._navFireFxTick = GS.simFrameCount;
                }
            }

            if (navalFiring) {
                // Handled above: ship is holding station and firing at range.
            } else if (dist > 0.05 && !isEngaged) {
                // Movement logic
                const baseSpeed = isAtSea ? CONFIG.UNIT_NAVAL_SPEED : CONFIG.UNIT_SPEED;
                
                // Roaming Prevention: Removed exploratory wiggle to force a focused linear push
                const landSpeedBuff = (!isAtSea && ((u.team === 'A' && currentControl > 0.5) || (u.team === 'B' && currentControl < -0.5))) ? 1.8 : 1.2;
                const speedMult = landSpeedBuff * speedBuffMult;

                let moveDirLat = dLat / dist;
                let moveDirLng = dLng / dist;

                // Pull towards nearby frontline so units hug the border instead of roaming deep interiors
                if (borderDir && !isAtSea) {
                    // Force units to prioritize the frontline even more heavily to prevent the "interior roaming" seen in clusters.
                    const blendStrength = 0.9;
                    moveDirLat = moveDirLat * (1 - blendStrength) + borderDir.lat * blendStrength;
                    moveDirLng = moveDirLng * (1 - blendStrength) + borderDir.lng * blendStrength;
                    const magBorder = Math.sqrt(moveDirLat * moveDirLat + moveDirLng * moveDirLng);
                    if (magBorder > 0) {
                        moveDirLat /= magBorder;
                        moveDirLng /= magBorder;
                    }
                }

                // Apply tactical retreat/border pushback
                let activeRetreat = false;
                if (retreatVector) {
                    const rMag = Math.sqrt(retreatVector.lat**2 + retreatVector.lng**2);
                    if (rMag > 0) {
                        activeRetreat = true;
                        const rDirLat = retreatVector.lat / rMag;
                        const rDirLng = retreatVector.lng / rMag;
                        
                        // Blend target direction with retreat direction
                        // Reduced retreat strength so units don't "dodge" and sprint away entirely, 
                        // allowing them to keep some forward pressure while backing off.
                        const inHostileLand = (u.team === 'A' && currentControl < 0) || (u.team === 'B' && currentControl > 0);
                        const retreatStrength = inHostileLand ? 0.4 : 0.25; 
                        
                        moveDirLat = moveDirLat * (1 - retreatStrength) + rDirLat * retreatStrength;
                        moveDirLng = moveDirLng * (1 - retreatStrength) + rDirLng * retreatStrength;
                        
                        const finalMag = Math.sqrt(moveDirLat**2 + moveDirLng**2);
                        if (finalMag > 0) {
                            moveDirLat /= finalMag;
                            moveDirLng /= finalMag;
                        }
                    }
                }

                // Hive Cohesion & Alignment: Units stick with their squad and move in unison
                if (groupCentroid && !isAtSea && !activeRetreat) {
                    // 1. Cohesion: Pull towards squad center
                    const dCentLat = groupCentroid.lat - u.lat;
                    const dCentLng = groupCentroid.lng - u.lng;
                    const dCentDist = Math.sqrt(dCentLat * dCentLat + dCentLng * dCentLng);
                    if (dCentDist > 0.1) {
                        const cohesionStr = 0.15;
                        moveDirLat += (dCentLat / dCentDist) * cohesionStr;
                        moveDirLng += (dCentLng / dCentDist) * cohesionStr;
                    }

                    // 2. Alignment: Match squad's average heading
                    if (Math.abs(groupCentroid.vLat) > 0.01 || Math.abs(groupCentroid.vLng) > 0.01) {
                        const alignStr = 0.25;
                        moveDirLat += groupCentroid.vLat * alignStr;
                        moveDirLng += groupCentroid.vLng * alignStr;
                    }
                    
                    const newMag = Math.sqrt(moveDirLat * moveDirLat + moveDirLng * moveDirLng);
                    if (newMag > 0) {
                        moveDirLat /= newMag;
                        moveDirLng /= newMag;
                    }
                }

                // --- ENVELOPMENT MANEUVER (owner: "make units try to encircle more") ---
                // Instead of every unit ramming straight into the enemy mass, the wings of a
                // formation sweep laterally around the EDGES of a nearby enemy concentration.
                // A unit sitting on the left of its squad (relative to the line toward the enemy)
                // peels further left; a right-wing unit peels right. The front bows outward and
                // wraps around enemy pockets, so pincers link up behind them and the existing
                // encirclement-collapse (+N Encircled) fires far more often. Offense only, only
                // for a genuinely close enemy cluster, never while retreating — so the main
                // advance and the anti-snowball balance stay intact.
                if (groupCentroid && !isAtSea && !isDefensive && !activeRetreat && localEnemyCount >= 2) {
                    const ecLat = enemyCentroidLat / localEnemyCount;
                    let toLat = ecLat - u.lat;
                    let toLng = (enemyCentroidLng / localEnemyCount) - u.lng;
                    if (toLng > 180) toLng -= 360; else if (toLng < -180) toLng += 360;
                    const tMag = Math.sqrt(toLat * toLat + toLng * toLng);
                    // Only wrap a pocket that's actually close (a real pocket to envelop), not a
                    // distant blob — keeps the long-range advance pointed straight at the enemy.
                    if (tMag > 0.0001 && tMag < 1.4) {
                        const tx = toLat / tMag, ty = toLng / tMag;
                        // Perpendicular to the approach vector (90° rotation in lat/lng space).
                        const perpLat = -ty, perpLng = tx;
                        // Which wing is this unit on? Project its offset from the squad centre onto
                        // the perpendicular; sign decides the side. Self-reinforcing with cohesion
                        // (wing units keep their side) rather than fighting it.
                        let oLng = u.lng - groupCentroid.lng;
                        if (oLng > 180) oLng -= 360; else if (oLng < -180) oLng += 360;
                        const lateral = (u.lat - groupCentroid.lat) * perpLat + oLng * perpLng;
                        const side = lateral >= 0 ? 1 : -1;
                        // Tighten the noose as the pocket gets closer. Owner: "way more common" —
                        // stronger sweep (0.6) and a wider engagement range (1.2) so the wings begin
                        // wrapping from farther out and close pincers behind the enemy far more often.
                        const flankStr = 0.7 * (1 - tMag / 1.4);
                        moveDirLat = moveDirLat * (1 - flankStr) + perpLat * side * flankStr;
                        moveDirLng = moveDirLng * (1 - flankStr) + perpLng * side * flankStr;
                        const fMag = Math.sqrt(moveDirLat * moveDirLat + moveDirLng * moveDirLng);
                        if (fMag > 0) { moveDirLat /= fMag; moveDirLng /= fMag; }
                    }
                }

                // --- ANTI-OVEREXTENSION / LINE DISCIPLINE (owner: stop "border gore") ---
                // The ugly breakthrough is a single unit (or tiny clump) that has shoved deep
                // into enemy-held ground while the rest of the front lags, leaving a thin
                // salient the enemy counter-pushes around. Detect that: a unit standing in
                // enemy-controlled land that is FORWARD of its own squad (projected onto its
                // advance heading) AND lacks local allies on its flanks is over-extended.
                // When so, bend its heading back toward the squad and brake it so the line
                // catches up and the front advances as one wall instead of interpenetrating.
                // Offense only, never while retreating; the wings mid-envelopment move laterally
                // (small forward projection) so they aren't braked — they keep wrapping.
                let overextendBrake = 0;
                if (groupCentroid && !isAtSea && !activeRetreat) {
                    const inEnemyLand = (u.team === 'A' && currentControl < -0.1) || (u.team === 'B' && currentControl > 0.1);
                    if (inEnemyLand) {
                        let pullLng = groupCentroid.lng - u.lng;
                        if (pullLng > 180) pullLng -= 360; else if (pullLng < -180) pullLng += 360;
                        const pullLat = groupCentroid.lat - u.lat;
                        // Forward lead = how far ahead of the squad this unit sits along its heading
                        // (negative of the back-to-centroid vector projected onto the move dir).
                        const ahead = -(pullLat * moveDirLat + pullLng * moveDirLng);
                        const unsupported = localAllyCount < 4 || localEnemyCount > localAllyCount;
                        if (ahead > 0.22 && unsupported) {
                            const pMag = Math.sqrt(pullLat * pullLat + pullLng * pullLng);
                            if (pMag > 0) {
                                const bend = Math.min(0.55, 0.25 + (ahead - 0.22) * 0.6);
                                moveDirLat = moveDirLat * (1 - bend) + (pullLat / pMag) * bend;
                                moveDirLng = moveDirLng * (1 - bend) + (pullLng / pMag) * bend;
                                const m = Math.sqrt(moveDirLat * moveDirLat + moveDirLng * moveDirLng);
                                if (m > 0) { moveDirLat /= m; moveDirLng /= m; }
                                // Hold pace until the line closes up — the deeper the lone lead, the harder the brake.
                                overextendBrake = Math.min(0.7, bend);
                            }
                        }
                    }
                }

                // Apply allied repulsion to ensure units spread out to borders
                // Suppression check: Repulsion is disabled during active retreats to prioritize survival
                if (u.repulsionVector && !activeRetreat) {
                    const rMag = Math.sqrt(u.repulsionVector.lat**2 + u.repulsionVector.lng**2);
                    if (rMag > 0) {
                        // Less aggressive repulsion so units keep their forward momentum and don't scatter sideways
                        const repulsionStrength = 0.4;
                        moveDirLat = moveDirLat * (1 - repulsionStrength) + (u.repulsionVector.lat / rMag) * repulsionStrength;
                        moveDirLng = moveDirLng * (1 - repulsionStrength) + (u.repulsionVector.lng / rMag) * repulsionStrength;
                        const finalMag = Math.sqrt(moveDirLat**2 + moveDirLng**2);
                        if (finalMag > 0) {
                            moveDirLat /= finalMag;
                            moveDirLng /= finalMag;
                        }
                    }
                    u.repulsionVector = null;
                }

                // Guided Pathfinding: Priority-based Corridor Seeking
                // Actively detours around neutral nations (like Czechoslovakia) to find internal routes.
                const isProtectedSupport = (idx) => {
                    if (idx === -1 || GS.landMask[idx] === 0) return false;
                    const cellOwnerId = GS.worldControlMap[idx];
                    const ownerSideIdx = countryToSideMap.get(cellOwnerId);
                    if (ownerSideIdx === undefined) return false;
                    const isEnemySupport = (ownerSideIdx !== sideIndex) && role === 'OFFENSE' && GS.sides[ownerSideIdx].find(c => c.id === cellOwnerId)?.role === 'SUPPORT';
                    if (isEnemySupport) {
                        const occ = GS.occupationMap[idx];
                        return !((u.team === 'A' && occ > 0.1) || (u.team === 'B' && occ < -0.1));
                    }
                    return false;
                };

                // Enemy SUPPORT nations hard‑block movement (units hold the line rather than cross).
                const isInsideNeutralProtected = isProtectedSupport(currentIdx);
                // Dynamic lookahead: units stuck inside or near neutral territory look further to find a valid corridor.
                const lookAheadDist = isNeutralCountry(currentIdx) ? 1.6 : (isNeutralCountry(getGridIndex(u.lat + moveDirLat * 0.25, u.lng + moveDirLng * 0.25)) ? 1.2 : 0.6);

                const lookIdx = getGridIndex(u.lat + moveDirLat * lookAheadDist, u.lng + moveDirLng * lookAheadDist);

                // Also actively route around PURE neutral countries (owner request): if a unit is about to
                // enter neutral land, run the corridor search first so it skirts the neutral border instead
                // of marching through it. Unlike enemy SUPPORT, neutral avoidance is "soft" — if no clean
                // corridor exists we fall through to transit‑with‑attrition rather than freezing, so a war
                // can never deadlock behind an unavoidable neutral (e.g. an enemy reachable only across neutral land).
                const neutralDetour = isNeutralCountry(lookIdx) || isNeutralCountry(currentIdx);

                if (isProtectedSupport(lookIdx) || isInsideNeutralProtected || neutralDetour) {
                    // Impending neutral border or already inside. Try to "pathfind" a local corridor that stays off neutral land.
                    let bestLat = moveDirLat;
                    let bestLng = moveDirLng;
                    let foundFriendly = false;

                    // Local corridor search: sweep angles and check both mid‑point and end‑point cells
                    // so we don't just step over a single neutral cell but actually route around it.
                    const sweepSteps = 24;
                    const sweepAngle = Math.PI; // 180° left/right around current heading
                    const corridorLook = lookAheadDist;
                    const midFactor = 0.5;

                    for (let j = 1; j <= sweepSteps; j++) {
                        const angleOff = (sweepAngle / sweepSteps) * j;
                        const checkAngles = [angleOff, -angleOff];

                        for (const a of checkAngles) {
                            const curCos = Math.cos(a);
                            const curSin = Math.sin(a);

                            // Candidate direction
                            const candLat = moveDirLat * curCos - moveDirLng * curSin;
                            const candLng = moveDirLat * curSin + moveDirLng * curCos;

                            // Sample mid‑point along this direction
                            const midLat = u.lat + candLat * corridorLook * midFactor;
                            const midLng = u.lng + candLng * corridorLook * midFactor;
                            const midIdx = getGridIndex(midLat, midLng);

                            // Sample end‑point along this direction
                            const endLat = u.lat + candLat * corridorLook;
                            const endLng = u.lng + candLng * corridorLook;
                            const endIdx = getGridIndex(endLat, endLng);

                            const midBlocked = midIdx !== -1 && (isNeutralCountry(midIdx) || isProtectedSupport(midIdx));
                            const endBlocked = endIdx !== -1 && (isNeutralCountry(endIdx) || isProtectedSupport(endIdx));

                            // We only accept directions where both mid and end are non‑neutral/non‑protected land.
                            if (
                                endIdx !== -1 &&
                                GS.landMask[endIdx] > 0 &&
                                !midBlocked &&
                                !endBlocked
                            ) {
                                bestLat = candLat;
                                bestLng = candLng;
                                foundFriendly = true;
                                break;
                            }
                        }
                        if (foundFriendly) break;
                    }

                    if (!foundFriendly) {
                        // Second pass: search a slightly larger ring to get around wider neutral "blocks"
                        const farLook = corridorLook * 1.6;
                        for (let j = 1; j <= sweepSteps && !foundFriendly; j++) {
                            const angleOff = (sweepAngle / sweepSteps) * j;
                            const checkAngles = [angleOff, -angleOff];

                            for (const a of checkAngles) {
                                const curCos = Math.cos(a);
                                const curSin = Math.sin(a);

                                const candLat = moveDirLat * curCos - moveDirLng * curSin;
                                const candLng = moveDirLat * curSin + moveDirLng * curCos;

                                const midLat = u.lat + candLat * farLook * midFactor;
                                const midLng = u.lng + candLng * farLook * midFactor;
                                const midIdx = getGridIndex(midLat, midLng);

                                const endLat = u.lat + candLat * farLook;
                                const endLng = u.lng + candLng * farLook;
                                const endIdx = getGridIndex(endLat, endLng);

                                const midBlocked = midIdx !== -1 && (isNeutralCountry(midIdx) || isProtectedSupport(midIdx));
                                const endBlocked = endIdx !== -1 && (isNeutralCountry(endIdx) || isProtectedSupport(endIdx));

                                if (
                                    endIdx !== -1 &&
                                    GS.landMask[endIdx] > 0 &&
                                    !midBlocked &&
                                    !endBlocked
                                ) {
                                    bestLat = candLat;
                                    bestLng = candLng;
                                    foundFriendly = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (foundFriendly) {
                        const mag = Math.sqrt(bestLat**2 + bestLng**2);
                        if (mag > 0) {
                            moveDirLat = bestLat / mag;
                            moveDirLng = bestLng / mag;
                        }
                    } else if (isProtectedSupport(lookIdx) || isInsideNeutralProtected) {
                        // Enemy SUPPORT block with no corridor: hold the line this tick instead of
                        // drifting through protected enemy support territory.
                        moveDirLat = 0;
                        moveDirLng = 0;
                    }
                    // else: a pure‑neutral detour with no clean corridor — keep the original heading and
                    // transit through with attrition (handled below) so the advance never deadlocks.
                }

                // Neutral / protected territory: allow free passage but apply a small attrition tax
                // so units can traverse neutrals while slowly bleeding strength the longer they stay.
                // We also make them move a little faster through neutral land to keep the pace up.
                let neutralPenalty = 1.0;
                let touchingNeutralForNaval = false;

                const currentlyInNeutral = isNeutralCountry(currentIdx) || isProtectedSupport(currentIdx);

                if (currentlyInNeutral) {
                    // Light, constant chip damage while inside neutral land
                    if (!isNaN(u.health)) {
                        const neutralTickDamage = CONFIG.ATTRITION_DAMAGE * 0.15 * damageTakenMult;
                        recordDamage(u, neutralTickDamage);
                    }
                    // Slight speed-up when traversing neutral land
                    neutralPenalty = 1.2;
                } else if (isAtSea) {
                    // For naval units, treat upcoming neutral coastline as contact for minor attrition
                    const coastLookDist = 0.4;
                    const coastIdx = getGridIndex(u.lat + moveDirLat * coastLookDist, u.lng + moveDirLng * coastLookDist);
                    if (isNeutral(coastIdx) || isProtectedSupport(coastIdx)) {
                        touchingNeutralForNaval = true;
                        // Ships skimming neutral coasts also move a bit faster along them
                        neutralPenalty = 1.1;
                    }
                }

                // Naval neutral-contact damage: greatly reduced, just a tiny scrape while near neutral coasts
                if (isAtSea && touchingNeutralForNaval && !isNaN(u.health)) {
                    const neutralHitDamage = CONFIG.ATTRITION_DAMAGE * 0.1 * damageTakenMult;
                    recordDamage(u, neutralHitDamage);
                }
                
                // Massive speed boost when actively retreating to avoid being swallowed by fast borders
                // BUT trapped/encircled units cannot retreat efficiently
                let retreatBoost = activeRetreat ? 5.5 : 1.0;
                if (isEncircled) retreatBoost *= 0.05; 

                // --- FORCED PUSH COORDINATION (Victory-Driven) ---
                // Units now wait at the frontline until a significant portion of their army 
                // has won local skirmishes, triggering a massive, coordinated "Big Push".
                let pushReadiness = 1.0;
                const isAtFrontline = !isAtSea && !isEffectivelyMyLand && !isTooNearBorder;
                
                // War Attrition Logic: As wars last longer (simFrameCount increases), 
                // AI becomes more cautious, favoring "War of Attrition" over costly frontal assaults.
                const warWeariness = Math.min(0.85, GS.simFrameCount / 15000); // Ramps up over ~4 minutes
                
                if (isAtFrontline && !isMega && !isSuper && !activeRetreat) {
                    const victoryRatio = sideVictoryRatios[sideIndex] || 0;
                    
                    // UNITED PUSH COORDINATION: Units now creep forward even when not surging to prevent static fronts.
                    if (countryObj?.isSurging) {
                        // Cohesive surge: keep the advance even so the front pushes as a wall,
                        // not as thin fingers (owner: stop "border gore" / ugly breakthroughs where
                        // a few units race deep into enemy land and leave an exposed salient). Tight
                        // ±15% jitter just breaks up a perfectly straight line without letting any
                        // unit punch a lone breakthrough ahead of its neighbours.
                        const spearheadAggression = 0.85 + (Math.sin(u.id * 777) * 0.5 + 0.5) * 0.3; // 0.85x–1.15x
                        const momentumScale = Math.min(1.8, victoryRatio * 2.5);
                        pushReadiness = 4.2 * momentumScale * spearheadAggression;
                        
                        // Attrition Adjustment: Long wars suppress aggressive surges unless victory is certain
                        pushReadiness *= (1.0 - (warWeariness * 0.5));

                        // Local Breakthrough: Units with high local victory momentum push even harder
                        if (u.victoryBoostTicks > 0) pushReadiness *= 1.4;
                    } else {
                        // Creeping Advance: Units advance at a moderate speed while holding the line to maintain pressure.
                        // In old wars, this advance slows to a crawl (War of Attrition).
                        pushReadiness = 0.7 * (1.0 - warWeariness);
                    }

                    // Strategic Lock: allow pushes with smaller groups so they don't sit idle
                    if (localAllyCount < 3) pushReadiness = 0.0;
                    
                    // Force halt if saturation is lost, but still allow some forward pressure
                    if (countryObj && !countryObj.isSaturated) {
                        pushReadiness = 0.3;
                    }
                }

                const moveDist = baseSpeed * speedMult * neutralPenalty * retreatBoost * pushReadiness * 0.8 * (1 - overextendBrake); // Reduced movement speed; overextendBrake holds lone forward units so the front stays cohesive
                
                // NO NAVAL ATTACKS: a land unit never steps into open sea, so wars
                // stay land-only (no swim-across, no sea crossing). The stalemate net
                // still ends any front frozen by unreachable water.
                let navalBlocked = false;
                if (GS.navalDisabled && !isAtSea && !isNaN(moveDirLat) && !isNaN(moveDirLng) && !isNaN(moveDist)
                    && _isWaterAt(u.lat + moveDirLat * moveDist, u.lng + moveDirLng * moveDist)) {
                    navalBlocked = true;
                }
                // Safety: Prevent NaN from propagating if moveDir calculation fails
                if (!navalBlocked && !isNaN(moveDirLat) && !isNaN(moveDirLng) && !isNaN(moveDist)) {
                    u.lat += moveDirLat * moveDist;
                    u.lng += moveDirLng * moveDist;
                    u.dirLat = moveDirLat; // Store trajectory for renderer
                    u.dirLng = moveDirLng;
                    
                    // Geographic clamping/wrapping to prevent units from flying off the map
                    u.lat = Math.max(-89.9, Math.min(89.9, u.lat));
                    // Wrap longitude [-180, 180]
                    if (u.lng > 180) u.lng -= 360;
                    if (u.lng < -180) u.lng += 360;
                }
            } else if (target && typeof target.health !== 'undefined') {
                // Combat logic
                u.lastCombatTick = GS.simFrameCount;
                target.lastCombatTick = GS.simFrameCount;

                // Strategic Depth: Units defending their own de jure (historical) territory get a defense boost.
                let defenseBonus = 1.0;
                const currentIdx = getGridIndex(u.lat, u.lng);
                const isDeJureLand = currentIdx !== -1 && GS.deJureMap[currentIdx] === u.sovereignId;
                
                if (!isAtSea) {
                    if (isDeJureLand) defenseBonus *= 0.65; // 35% reduction in historical land
                    if (GS.worldControlMap[gridIdxNow] === u.sovereignId && Math.abs(currentControl) < 0.2) {
                        defenseBonus *= 0.85; // Additional stack for unoccupied frontline
                    }

                    // City Fortification: Units near friendly cities are much harder to destroy
                    const nearbyCity = GS.activeTheaterCities.find(c => c.sovereignId === u.sovereignId && (u.lat - c.lat)**2 + (u.lng - c.lng)**2 < 0.04);
                    if (nearbyCity) {
                        defenseBonus *= 0.45; // Significant defense boost in urban centers
                    }
                }

                // War of Attrition: In long wars, units defending "dig in", taking less damage 
                // but making it harder for the attacker to break through without high losses.
                const longWarDefense = (GS.simFrameCount > 6000) ? 0.75 : 1.0;
                
                const tDmg = CONFIG.COMBAT_DAMAGE * damageDealtMult * 0.7;
                const uDmg = (CONFIG.COMBAT_DAMAGE * 0.8) * damageTakenMult * defenseBonus * longWarDefense;
                
                // Casualties increase while battling (direct engagement)
                recordDamage(target, tDmg);
                recordDamage(u, uDmg);

                // Positional knockback: both units are pushed by the force of the engagement.
                // Direction is along the line between them; distance is small and scaled by relative damage.
                const dLat = target.lat - u.lat;
                let dLng = target.lng - u.lng;
                if (dLng > 180) dLng -= 360;
                else if (dLng < -180) dLng += 360;
                const distSq = dLat * dLat + dLng * dLng;
                if (distSq > 0) {
                    const dist = Math.sqrt(distSq) || 1e-6;
                    const nx = dLng / dist;
                    const ny = dLat / dist;

                    // Base push scaled by movement speed so it feels consistent with unit motion
                    const basePush = (isAtSea ? CONFIG.UNIT_NAVAL_SPEED : CONFIG.UNIT_SPEED) * 1.2;
                    // Relative damage factor: more damage dealt -> stronger push on the target
                    const totalDmg = tDmg + uDmg || 1e-6;
                    const targetFactor = Math.min(1.5, (tDmg / totalDmg) * 1.5);
                    const selfFactor = Math.min(1.0, (uDmg / totalDmg) * 1.0);

                    // Push target away from attacker
                    const targetPushLat = ny * basePush * targetFactor;
                    const targetPushLng = nx * basePush * targetFactor;
                    // Push attacker slightly backwards as recoil
                    const selfPushLat = -ny * basePush * 0.5 * selfFactor;
                    const selfPushLng = -nx * basePush * 0.5 * selfFactor;

                    // Apply knockback, keeping within latitude limits and wrapping longitude
                    const applyPush = (unitObj, dLatMove, dLngMove) => {
                        let newLat = unitObj.lat + dLatMove;
                        let newLng = unitObj.lng + dLngMove;
                        newLat = Math.max(-89.9, Math.min(89.9, newLat));
                        if (newLng > 180) newLng -= 360;
                        else if (newLng < -180) newLng += 360;
                        unitObj.lat = newLat;
                        unitObj.lng = newLng;
                    };

                    if (isFinite(targetPushLat) && isFinite(targetPushLng)) {
                        applyPush(target, targetPushLat, targetPushLng);
                    }
                    if (isFinite(selfPushLat) && isFinite(selfPushLng)) {
                        applyPush(u, selfPushLat, selfPushLng);
                    }
                }

                if (target.health <= 0) {
                    u.victoryBoostTicks = 180; // Reduced momentum duration
                }
            }
        }

        if (u.health <= 0) {
            // Units are already being counted for casualties per-hit during simulation.
            // This just cleans them up when they reach 0 health.
            GS.units.splice(i, 1);
        }
    }

    // NOTE: Even if teamASoldiers/teamBSoldiers reach 0, sides remain on the field and can still recruit.
    // This keeps wars from hard-locking when a side's manpower bar is exhausted.

    // 4. Individual Capitulation & Treaty Logic
    const timeSinceTreaty = Date.now() - GS.lastTreatyTime;

    // Keep side-level casualty counters consistent with remaining manpower and initial pools
    if (GS.initialTeamASoldiers > 0) {
        GS.sideACasualties = Math.max(0, GS.initialTeamASoldiers - GS.teamASoldiers);
    }
    if (GS.initialTeamBSoldiers > 0) {
        GS.sideBCasualties = Math.max(0, GS.initialTeamBSoldiers - GS.teamBSoldiers);
    }

    // Check for individual country falls
    for (let sIdx = 0; sIdx < GS.sides.length; sIdx++) {
        const side = GS.sides[sIdx];
        for (let i = side.length - 1; i >= 0; i--) {
            const country = side[i];

            // Decrement grace period
            if (country.graceTicks > 0) country.graceTicks--;

            const stats = countryStats.get(country.id);
            if (!stats) continue;

            const initial = country.initialCells || 1;
            const controlPct = (stats.controlled / initial) * 100;
            
            // Individual Capitulation criteria:
            // If undefended (0 units), capitulate much earlier (25% land)
            // Otherwise, fight until 2% land remains
            // If the capital has already fallen (supply failing) and the nation is now down
            // to a small remnant of its front, it's finished — capitulate even with a few
            // units left, so a beaten "fights on" nation can't keep a dead war alive forever.
            // Nations can be granted a grace period (e.g. rebellions) where they are immune to capitulation
            const isProtected = country.graceTicks > 0;
            const supplyFailed = GS.capitalLostCountries && GS.capitalLostCountries.has(country.id);
            // Owner ask: wars weren't ending when a nation had "basically all its territory
            // captured." A defended nation with its capital still (nominally) intact used to
            // fight down to 2% of its homeland before capitulating, so a gutted rump could keep
            // a decided war alive. Raise the universal floor to 8%: once ANY nation is ground
            // below 8% of its original homeland it capitulates and is annexed, regardless of
            // whether its capital was flagged lost. (Capital-lost nations already fall at 18%.)
            if (!isProtected && ((stats.units === 0 && controlPct < 25) || controlPct < 8 || (supplyFailed && controlPct < 18))) {
                capitulateCountry(country, sIdx);
                // Exit tick early to re-evaluate state in next tick with updated sides/units
                return false; 
            }
        }
    }

    // Count distinct active SIDES (not parity poles) so 3+ side wars only end when one side is left.
    // For exactly 2 sides this is identical to the old pole count.
    const activeSideSet = new Set();
    const effectiveSideSet = new Set();
    GS.sides.forEach((side, idx) => {
        if (side.length > 0) {
            activeSideSet.add(idx);
            if (side.some(c => c.role === 'OFFENSE')) {
                effectiveSideSet.add(idx);
            }
        }
    });

    // End war if only one side remains, or one side has lost all offensive capability against active enemies
    if (GS.gameState === 'SIMULATING') {
        if (activeSideSet.size <= 1) {
            const winnerIdx = activeSideSet.size === 1 ? Array.from(activeSideSet)[0] : 0;
            const winnerPole = winnerIdx % 2 === 0 ? 'A' : 'B';
            applyTreaty(winnerPole === 'A' ? 'FULL_CAPITULATION_A' : 'FULL_CAPITULATION_B', winnerPole);
            return true;
        }

        // Support Clause: If only one side still fields offensive countries, the others collapse
        if (effectiveSideSet.size === 1) {
            const winnerIdx = Array.from(effectiveSideSet)[0];
            const winnerPole = winnerIdx % 2 === 0 ? 'A' : 'B';
            applyTreaty(winnerPole === 'A' ? 'FULL_CAPITULATION_A' : 'FULL_CAPITULATION_B', winnerPole);
            return true;
        }
    }

    // Revolution / mid-war-reinforcement grace: a nation deliberately released into an
    // ongoing war is dropped onto an already-lopsided board, so the global "decided
    // board" enders below would sweep it away in the first couple of seconds before it
    // can field a fight — the "every time i make a revolution it immediately removes it"
    // bug. While ANY belligerent is still inside its grace window, stand those enders
    // down and keep their anchors reset. The per-nation capitulation floor (which already
    // respects graceTicks) and the one-side-left ender still apply, so a genuinely
    // eliminated side still ends the war; only the size-agnostic board-share sweep waits.
    const inReleaseGrace = GS.gameState === 'SIMULATING' &&
        GS.sides.some(side => side && side.some(c => c && c.graceTicks > 0));
    if (inReleaseGrace) {
        GS.dominanceAnchorFrame = undefined;
        GS.decisiveAnchorFrame = undefined;
    }

    // LOSER-RETENTION GATE (the "small nation auto-annexed vs a big one" fix): the
    // board-share enders below (front 99.9, Tier1 ≥95%, Tier2 ≥85%) all measure GLOBAL
    // pole dominance, which is ALREADY lopsided on the FIRST tick of a big-vs-small war —
    // a large nation owns ≥85-95% of the combined belligerent land before a shot is fired.
    // That tripped the enders in ~2-7s with or without troop contact and annexed the small
    // nation on the spot (owner-relayed report). Fix: additionally require the LOSING pole
    // to have actually been conquered off most of ITS OWN starting homeland — retention =
    // currently-held / initialCells, measured on the SAME primaryOccupierMap grid as the
    // cachedPoleXHeld tally. At war start every pole retains ~100% of its own land → retain
    // ≈ 1 → the enders stand down until real conquest happens; a genuine rout still drives
    // the loser's retention → 0 and ends fast. This only ADDS a necessary condition, so it
    // can never cause a new softlock (the all-cities-fallen backstop + stalemate net still
    // catch genuinely decided boards). germany-vs-poland (loser sealed into ~15-25% of its
    // own homeland) still trips Tier2; a fresh big-vs-small war with no fighting no longer
    // trips anything.
    const haveBoard = GS.cachedPoleAHeld !== undefined;
    let poleAInitial = 0, poleBInitial = 0;
    GS.sides.forEach((side, idx) => {
        if (!side) return;
        const isA = idx % 2 === 0;
        side.forEach(c => {
            if (!c) return;
            if (isA) poleAInitial += (c.initialCells || 0);
            else poleBInitial += (c.initialCells || 0);
        });
    });
    // Default to 1 (fully retained → enders blocked) whenever the board tally or a pole's
    // starting count is missing, so a lack of data never green-lights a premature end.
    const poleARetain = (haveBoard && poleAInitial > 0) ? GS.cachedPoleAHeld / poleAInitial : 1;
    const poleBRetain = (haveBoard && poleBInitial > 0) ? GS.cachedPoleBHeld / poleBInitial : 1;

    if (!inReleaseGrace) {
        if (p1LandScore >= 99.9 && poleBRetain <= 0.10) {
            applyTreaty('FULL_CAPITULATION_A'); return true;
        } else if (p1LandScore <= 0.1 && poleARetain <= 0.10) {
            applyTreaty('FULL_CAPITULATION_B'); return true;
        }
    }

    // OWNER ASK (2026-07-03): restore the old negotiated-peace system — "nations demand peace,
    // the other side accepts or rejects, otherwise fight to the death." This off-ramp was stripped
    // during the softlock rewrite (replaced by the deterministic board-control enders below). It's
    // back as FLAVOR, not the only ender: even if no offer fires or every offer is rejected, the
    // deterministic enders still terminate a decided war, so it can't re-open the softlock. When
    // FIGHT TO THE DEATH (no-peace) is on, offers are suppressed entirely → they fight to the death.
    if (GS.gameState === 'SIMULATING' && !inReleaseGrace &&
        timeSinceTreaty > 6000 && DOM.treatyAlert.style.display === 'none' &&
        !GS.peaceTreatiesDisabled && Math.random() < 0.001) {
        // A random active side sues for peace; the receiver accepts more readily the more ground
        // it has lost. Reject → the war grinds on (they fight to the death until actually overrun).
        const proposerSideIdx = Math.floor(Math.random() * GS.sides.length);
        if (GS.sides[proposerSideIdx] && GS.sides[proposerSideIdx].length > 0) {
            const proposerPole = proposerSideIdx % 2 === 0 ? 'A' : 'B';
            const receiverPole = proposerPole === 'A' ? 'B' : 'A';
            const receiverLand = receiverPole === 'A' ? p1LandScore : (100 - p1LandScore);
            const acceptChance = Math.max(0.1, (100 - receiverLand) / 100);
            showTreatyOffer(proposerPole, Math.random() < acceptChance, proposerSideIdx);
        }
    }

    // DECISIVE DOMINANCE WAR-ENDER (the real softlock fix): every earlier war-end
    // path can miss a plainly-decided board. The per-nation capitulation floor is
    // relative to a nation's OWN homeland, so a small nation clinging to a big
    // fraction of a small pocket never trips it; and a fully-SEALED pocket has no
    // contested (landMask===2) front, so p1LandScore sits at 50 and the 99.9 ender
    // never fires either. Result: a decided war hangs forever on one stubborn holdout
    // — exactly the repeated "softlock" reports. Backstop on TOTAL held land: once one
    // pole owns ≥95% of ALL combatant-held land for a sustained window, the outcome is
    // decided; absorb the holdouts and end it. Tuned high + sustained so a genuine
    // two-sided war (which never sits at 95% while still contested) is never cut short.
    if (GS.gameState === 'SIMULATING' && !inReleaseGrace && GS.cachedPoleAHeld !== undefined) {
        // Use the decay-immune PHYSICAL board-control tally (primaryOccupierMap, computed in
        // the land-count pass), NOT a sum of stats.controlled. stats.controlled only counts a
        // cell for a country that DE-JURE OWNS it, so land the winner has militarily occupied
        // but not yet annexed counts for NEITHER pole — which deflated the share below 85% and
        // is exactly why germany-vs-poland (two roughly-equal nations, lots of occupied-but-
        // -unannexed land) hung forever while small losers resolved fine.
        const poleAOwned = GS.cachedPoleAHeld, poleBOwned = GS.cachedPoleBHeld;
        const totalOwned = poleAOwned + poleBOwned;
        const majorityShare = totalOwned > 0 ? Math.max(poleAOwned, poleBOwned) / totalOwned : 0;
        const winnerPole = poleAOwned >= poleBOwned ? 'A' : 'B';
        // Loser retention of its OWN homeland (see the LOSER-RETENTION GATE note above): the
        // size-independent "has the loser actually been conquered" check that stops a
        // big-vs-small war ending before any fighting.
        const loserRetain = winnerPole === 'A' ? poleBRetain : poleARetain;
        // TIER 1 — overwhelming (≥95%): a lone small holdout on an otherwise-owned board.
        // Nothing is genuinely contested at 95% physical hold, so end it FAST — owner
        // repeatedly reported the ~30s drag (the old 600-frame window ≈ 12s) reading as a
        // softlock even after the war was decided. ~120 frames (≈2.4s at the observed
        // ~50fps) still absorbs a one-frame blip but is effectively instant for a blowout
        // like the FRANCE-vs-SPAIN shot (Spain at <1% manpower).
        if (majorityShare >= 0.95 && loserRetain <= 0.10) {
            if (GS.dominanceAnchorFrame === undefined) {
                GS.dominanceAnchorFrame = GS.simFrameCount;
            } else if (GS.simFrameCount - GS.dominanceAnchorFrame > 120) {
                DOM.statusText.innerText = 'WAR DECIDED — dominant power absorbs the last holdouts';
                applyTreaty(winnerPole === 'A' ? 'FULL_CAPITULATION_A' : 'FULL_CAPITULATION_B', winnerPole);
                return true;
            }
        } else {
            GS.dominanceAnchorFrame = undefined; // still genuinely contested — reset the clock
        }
        // TIER 2 — decisive (≥85%): the GERMANY-vs-POLAND softlock. Two roughly-equal
        // nations where the loser clings to ~10-30% of ITS OWN homeland in a sealed/lopsided
        // pocket. The COMBINED land ratio then tops out around 88-93% — under the 95% Tier-1
        // bar — and a sealed pocket has no active front, so p1LandScore sits at 50 and the
        // 99.9 front-ender never fires either. (For a SMALL loser the pocket is small enough
        // that the combined ratio clears 95%, which is why small countries already resolve.)
        // Require a sustained window that self-resets the instant the loser claws back above
        // 15% — so a genuine comeback is never cut short, only a war that stays decisively
        // lost. Trimmed 1500→360 frames (≈7s): the old ~30s window is exactly what the owner
        // kept reporting as "it eventually ends but takes 30s". A side sitting at ≥85% of all
        // board control for 7 continuous seconds is a rout, not a contest, and the anchor
        // reset still protects any real swing back under 85%.
        if (majorityShare >= 0.85 && loserRetain <= 0.30) {
            if (GS.decisiveAnchorFrame === undefined) {
                GS.decisiveAnchorFrame = GS.simFrameCount;
            } else if (GS.simFrameCount - GS.decisiveAnchorFrame > 360) {
                DOM.statusText.innerText = 'WAR DECIDED — the losing side is spent; the victor annexes the remnant';
                applyTreaty(winnerPole === 'A' ? 'FULL_CAPITULATION_A' : 'FULL_CAPITULATION_B', winnerPole);
                return true;
            }
        } else {
            GS.decisiveAnchorFrame = undefined; // loser recovered above 15% — reset the clock
        }
    }

    // STALEMATE SAFETY NET: with the old negotiated-peace off-ramp removed, a truly
    // frozen front — the land split sitting in a narrow band for a long stretch —
    // could otherwise run forever and never end (the case in the screenshot). Detect
    // a genuine deadlock: a long-running war whose territorial balance has barely
    // moved for a sustained window, and resolve it decisively toward whichever side
    // holds the most ground. Tuned conservatively so a real tug-of-war (which keeps
    // moving) is never cut short — only a dead-stuck front collapses.
    if (GS.gameState === 'SIMULATING' && !inReleaseGrace && GS.simFrameCount > 8000) {
        const anchor = GS.stalemateAnchorScore;
        if (anchor === undefined || Math.abs(p1LandScore - anchor) > 5) {
            // Front is still shifting — reset the deadlock clock.
            GS.stalemateAnchorScore = p1LandScore;
            GS.stalemateAnchorFrame = GS.simFrameCount;
        } else if (GS.simFrameCount - (GS.stalemateAnchorFrame || 0) > 10000) {
            // Frozen inside a ±5 band for a long sustained window → decide by ground held.
            const winnerPole = p1LandScore >= 50 ? 'A' : 'B';
            DOM.statusText.innerText = 'STALEMATE — exhausted front collapses, decided by ground held';
            applyTreaty(winnerPole === 'A' ? 'FULL_CAPITULATION_A' : 'FULL_CAPITULATION_B', winnerPole);
            return true;
        }
    }
    // OLD PEACE SYSTEM REMOVED: the AI no longer randomly offers negotiated peace
    // treaties mid-war. Wars now resolve only through combat — total defeat of a
    // side, individual capitulation of a crushed country, or the capital-capture
    // politics (annex / puppet / fight-on).

    // Rebellion victory check
    if (GS.activeRebellion && GS.simFrameCount % 15 === 0) {
        const { rebelId, overlordId, startTime } = GS.activeRebellion;

        // Goliath Buff Decay: Rebels lose their initial combat bonus after ~20 seconds at 1x speed
        if (GS.simFrameCount - startTime > 1200) {
            GS.sides.flat().filter(Boolean).forEach(c => {
                if (c.id === rebelId && c.buffState === 'buff') {
                    c.buffState = 'none';
                    DOM.statusText.innerText = `${c.name.toUpperCase()} REVOLUTIONARY FERVOR SUBSIDING`;
                }
            });
            const meta = GS.countryMetadata.find(m => m && m.id === rebelId);
            if (meta && meta.buffState === 'buff') meta.buffState = 'none';
        }

        let rebelDeJureCount = 0;
        let rebelReclaimedCount = 0;

        // Check if rebel has reclaimed its original borders
        // Use a much higher density scan for this to ensure small countries (like Portugal) hit the trigger reliably.
        // When many sides are active, we can safely sample more sparsely.
        const optimizationFactor = getOptimizationFactor();
        const winCheckStep = Math.max(1, Math.floor((GS.deJureMap.length / 100000) * optimizationFactor));
        const rebelSide = GS.sides.find(s => s.some(c => c.id === rebelId));
        const rebelIsTeamA = rebelSide && rebelSide.indexOf(rebelSide.find(c => c.id === rebelId)) !== -1 && GS.sides.indexOf(rebelSide) % 2 === 0;

        for (let i = 0; i < GS.deJureMap.length; i += winCheckStep) {
            if (GS.deJureMap[i] === rebelId) {
                rebelDeJureCount++;
                // A cell is "reclaimed" if:
                // 1. It is owned by the rebel in worldControlMap (starting pocket)
                // 2. OR it is occupied by the rebel's side/pole with high confidence
                const occ = GS.occupationMap[i];
                const isOccupiedByRebel = GS.worldControlMap[i] === rebelId || 
                                          (rebelIsTeamA ? occ > 0.15 : occ < -0.15);
                if (isOccupiedByRebel) {
                    rebelReclaimedCount++;
                }
            }
        }

        // Robust threshold (85%) and high scan density to ensure peace triggers even with scattered islands/tiny pockets
        if (rebelDeJureCount > 0 && rebelReclaimedCount > rebelDeJureCount * 0.85) { 
            handleRebellionPeace();
            return true;
        }
    }

    if (GS.units.length === 0 && GS.gameState === 'SIMULATING') {
         applyTreaty('WHITE_PEACE'); return true;
    }

    // 5. Update Bombs & Explosions
    if (GS.bombsDisabled) {
        GS.bombs = [];
    }
    for (let i = GS.bombs.length - 1; i >= 0; i--) {
        const b = GS.bombs[i];
        // Slower step for smoother movement, accelerating slightly on descent
        const step = 0.0055 * (b.state === 'falling' ? (1 + (b.progress - 0.5) * 2.5) : 1);
        b.progress += step;

        if (b.state === 'rising' && b.progress >= 0.5) {
            b.state = 'falling';
        }

        const t = b.progress;
        const latBase = b.startLat + (b.targetLat - b.startLat) * t;
        const lngBase = b.startLng + (b.targetLng - b.startLng) * t;
        
        const alt = Math.sin(Math.PI * t) * b.peakAlt;
        b.currentLat = latBase + alt;
        b.currentLng = lngBase;

        // Predict next position for rotation calculation
        const nextT = Math.min(1.0, t + 0.005);
        const nextLatBase = b.startLat + (b.targetLat - b.startLat) * nextT;
        const nextLngBase = b.startLng + (b.targetLng - b.startLng) * nextT;
        const nextAlt = Math.sin(Math.PI * nextT) * b.peakAlt;
        b.nextLat = nextLatBase + nextAlt;
        b.nextLng = nextLngBase;

        // Trail logic
        b.trail.push({ lat: b.currentLat, lng: b.currentLng });
        if (b.trail.length > 40) b.trail.shift();

        if (b.progress >= 1.0) {
            // Impact!
            playExplosionSound();
            GS.explosions.push({
                lat: b.targetLat,
                lng: b.targetLng,
                life: 30,
                maxRadius: 20
            });

            // Damage units in radius instead of instantly killing them
            const killRadiusSq = 0.5 * 0.5;
            const killRadius = Math.sqrt(killRadiusSq);
            for (let j = 0; j < GS.units.length; j++) {
                const victim = GS.units[j];
                const dSq = (victim.lat - b.targetLat) ** 2 + (victim.lng - b.targetLng) ** 2;
                if (dSq < killRadiusSq) {
                    const dist = Math.sqrt(dSq);
                    const falloff = 1 - (dist / killRadius); // 1 at center, 0 at edge
                    // Base missile damage scaled by distance; strong but non‑lethal except near center
                    const baseDamage = CONFIG.COMBAT_DAMAGE * 4;
                    const damage = baseDamage * Math.max(0.2, falloff); // ensure a minimum chunk
                    recordDamage(victim, damage);
                    // Do NOT splice here; units will be removed later when their health <= 0
                }
            }
            GS.bombs.splice(i, 1);
        }
    }

    // AI Bomb Launching (Restored and buffed frequency)
    const simYear = GS.gameTimeDate ? GS.gameTimeDate.year : 2024;
    // Enforce 1942 technology gate for missiles/bombs
    const canFireMissiles = !GS.gameTimeEnabled || simYear >= 1942;

    if (!GS.bombsDisabled && canFireMissiles) {
        const poleAExists = GS.sides.some((s, idx) => idx % 2 === 0 && s.length > 0);
        const poleBExists = GS.sides.some((s, idx) => idx % 2 !== 0 && s.length > 0);
        
        if (poleAExists && poleBExists) {
            // Missile AI (Buffed frequency: 0.0025 -> 0.01)
            if (GS.bases.length > 0 && Math.random() < 0.01) {
                const launcherTeam = Math.random() > 0.5 ? 'A' : 'B';
                const targetTeam = launcherTeam === 'A' ? 'B' : 'A';
                const myBases = GS.bases.filter(b => b.team === launcherTeam);
                const enemyUnits = GS.units.filter(u => u.team === targetTeam);
                if (myBases.length > 0 && enemyUnits.length > 0) {
                    const launcher = myBases[Math.floor(Math.random() * myBases.length)];
                    const target = enemyUnits[Math.floor(Math.random() * enemyUnits.length)];
                    launchBomb(launcher.lat, launcher.lng, target.lat, target.lng, launcherTeam);
                }
            }
        }
    }

    for (let i = GS.explosions.length - 1; i >= 0; i--) {
        GS.explosions[i].life--;
        if (GS.explosions[i].life <= 0) GS.explosions.splice(i, 1);
    }

    if (GS.encirclePops) {
        for (let i = GS.encirclePops.length - 1; i >= 0; i--) {
            GS.encirclePops[i].life--;
            if (GS.encirclePops[i].life <= 0) GS.encirclePops.splice(i, 1);
        }
    }

    return false;
}

export function updateLoop(now) {
    const shouldSimulate = GS.gameState === 'SIMULATING' || (GS.godModeActive && (GS.preGodModeState === 'SIMULATING' || GS.preGodModeState === 'WAR_OVER'));
    if (!shouldSimulate) return;
    // Avoid running the visual loop while a background tick loop is active
    if (document.hidden) return;

    // Attract-mode menu demo runs on the front door behind the main menu. At full
    // rAF speed the sim+render pegged the main thread (~95% blocked, ~1.6fps on a
    // mid-range phone) — a "living war" that froze the menu and read as lag. Cap the
    // demo to ~15fps: it stays visibly alive (fronts shifting, units moving) while
    // leaving the main thread free for scroll/taps. Real gameplay is unthrottled.
    if (GS.menuDemoActive && typeof now === 'number') {
        if (GS._demoLastFrame && (now - GS._demoLastFrame) < 66) {
            GS.animationFrameId = requestAnimationFrame(updateLoop);
            return;
        }
        GS._demoLastFrame = now;
    }

    if (!GS.isPaused) {
        // Run sub-ticks based on simSpeed (handles both fast-forward and slow-motion)
        GS.frameAccumulator += GS.simSpeed;
        while (GS.frameAccumulator >= 1) {
            const warEnded = performSimulationTick();
            if (warEnded) {
                GS.frameAccumulator = 0;
                return;
            }
            GS.frameAccumulator -= 1;
        }

        // Advance in-game date by real time
        if (typeof now === 'number') {
            // Because we don't track previous timestamp, approximate per-frame using 16ms if undefined
            tickGameTime(16.67);
        }
    }

    // Advance simulation frame counter once per visual loop
    GS.simFrameCount++;

    // Aggressive Render Skipping: At high sim speeds, process mechanics multiple times without painting
    let skipRenderThisFrame = false;
    if (GS.simSpeed >= 4) {
        skipRenderThisFrame = (GS.simFrameCount % 4 !== 0);
    } else if (GS.simSpeed >= 3) {
        skipRenderThisFrame = (GS.simFrameCount % 3 !== 0);
    } else if (GS.simSpeed >= 2) {
        skipRenderThisFrame = (GS.simFrameCount % 2 !== 0);
    }

    if (skipRenderThisFrame && document.hidden === false) {
        GS.animationFrameId = requestAnimationFrame(updateLoop);
        return;
    }

    // HUD stat readouts (soldier estimate, unit counts, city counts). These are display-only
    // — nothing downstream consumes them — and recomputing them every frame meant scanning
    // EVERY unit plus sampling getControlValue for EVERY city 60x/sec, cost that scales with
    // war/map size right where weak phones already struggle. The numbers change slowly, so
    // refreshing them ~every 5th frame (~10-12Hz) is visually identical but cuts the scans.
    if (GS.simFrameCount % 5 === 0) {
        // Derive displayed personnel directly from live unit health so it never shows 0
        // while divisions are still present on the map, and correctly scales with damage.
        const spA = GS.soldiersPerUnitA || CONFIG.UNIT_TO_SOLDIER_RATIO;
        const spB = GS.soldiersPerUnitB || CONFIG.UNIT_TO_SOLDIER_RATIO;
        let estSoldiersA = 0;
        let estSoldiersB = 0;
        let p1Units = 0;
        let p2Units = 0;

        for (let i = 0; i < GS.units.length; i++) {
            const u = GS.units[i];
            if (u.team === 'A') {
                p1Units++;
                estSoldiersA += (u.health / CONFIG.UNIT_HEALTH) * spA;
            } else {
                p2Units++;
                estSoldiersB += (u.health / CONFIG.UNIT_HEALTH) * spB;
            }
        }

        document.getElementById('p1-soldiers-ui').innerText = GS.influenceLayer.formatSoldiers(estSoldiersA > 0 && estSoldiersA < 1 ? 1 : estSoldiersA);
        document.getElementById('p2-soldiers-ui').innerText = GS.influenceLayer.formatSoldiers(estSoldiersB > 0 && estSoldiersB < 1 ? 1 : estSoldiersB);

        DOM.p1UnitsDisp.innerText = p1Units;
        DOM.p2UnitsDisp.innerText = p2Units;

        let p1CityCount = 0;
        let p2CityCount = 0;
        GS.activeTheaterCities.forEach(c => {
            const val = getControlValue(c.lat, c.lng);
            if (val > 0.3) p1CityCount++;
            else if (val < -0.3) p2CityCount++;
        });
        DOM.p1CitiesDisp.innerText = p1CityCount;
        DOM.p2CitiesDisp.innerText = p2CityCount;
    }

    // Throttled UI rendering in Flag mode to maintain responsive interaction and framerate
    GS.simFrameCount++;
    
    // Throttled Combatants UI update
    if (GS.simFrameCount % 30 === 0) {
        updateCombatantsUI();
    }

    // Update Casualty UI (Every frame for "live" counting effect)
    const updateSideCasualties = (poleIdx, containerId) => {
        // The DOM here only changes on the % 5 cadence below, but the entry set was being
        // rebuilt (filter + nested .some scans + sides.flat) every frame and thrown away.
        // Gate the whole thing on the same cadence so we don't pay for work we discard.
        if (GS.simFrameCount % 5 !== 0) return;

        const container = document.getElementById(containerId);
        if (!container) return;

        // Use initialCombatants to ensure consistency, but also check sides for any mid-war joiners
        let entries = GS.initialCombatants.filter(c => c.pole === poleIdx);
        
        // Check for any currently warring countries not in initialCombatants
        GS.sides.forEach((side, sIdx) => {
            if (sIdx % 2 === poleIdx) {
                side.forEach(c => {
                    if (!entries.some(e => e.id === c.id)) {
                        entries.push({ id: c.id, name: c.name, pole: poleIdx });
                    }
                });
            }
        });

        if (entries.length === 0) {
            if (!GS._casualtyStructCache) GS._casualtyStructCache = {};
            if (GS._casualtyStructCache[containerId] !== '') {
                container.innerHTML = '';
                GS._casualtyStructCache[containerId] = '';
            }
            return;
        }

        // Compute per-entry render data once. The STRUCTURE (which countries, primary/defeated
        // state, flag image) changes rarely; only the casualty COUNT ticks every update. Rebuilding
        // innerHTML whenever the count changed tore down and recreated each flag <img> ~10x/sec, so
        // the flags strobed during battle — a real photosensitive-seizure hazard. So: rebuild the DOM
        // only when the structure changes; otherwise update just the count text in place, leaving the
        // <img>s untouched. Generated puppet/custom flags are canvases whose pixels never change, so
        // toDataURL() is memoized per country instead of being re-serialized on every rebuild.
        const rows = entries.map((c, i) => {
            const casualties = GS.countryCasualties.get(c.id) || 0;
            const formatted = GS.influenceLayer.formatSoldiers(casualties);

            // Determine if country is capitulated (no longer in any side)
            const isDefeated = !GS.sides.flat().some(active => active.id === c.id);
            const isPrimary = (i === 0 && !isDefeated); // Germany is primary only if still fighting

            const meta = GS.countryMetadata[c.id - 1];
            let flagSrc = meta?.flagUrl || '';
            if (meta?.tempFlag instanceof HTMLCanvasElement) {
                // Memoize keyed on the canvas object so a reassigned (regenerated) flag recomputes.
                if (meta._flagDataUrlSrc !== meta.tempFlag) {
                    try { meta._flagDataUrl = meta.tempFlag.toDataURL(); } catch(e) { meta._flagDataUrl = ''; }
                    meta._flagDataUrlSrc = meta.tempFlag;
                }
                flagSrc = meta._flagDataUrl;
            }

            return { formatted, isDefeated, isPrimary, flagSrc };
        });

        // Signature of everything that affects the DOM EXCEPT the volatile count, so count-only
        // ticks reuse the existing nodes instead of replacing the flag <img>s.
        const structSig = rows.map(r => `${r.isPrimary ? 1 : 0}|${r.isDefeated ? 1 : 0}|${r.flagSrc}`).join('~');

        if (!GS._casualtyStructCache) GS._casualtyStructCache = {};
        const valueNodes = container.querySelectorAll('.cas-value');
        if (GS._casualtyStructCache[containerId] === structSig && valueNodes.length === rows.length) {
            // Structure unchanged — update only the ticking numbers, never the flag <img>s (no flicker).
            for (let i = 0; i < rows.length; i++) {
                if (valueNodes[i].textContent !== rows[i].formatted) valueNodes[i].textContent = rows[i].formatted;
            }
            return;
        }

        // Structure changed (war start, a country capitulated, a flag regenerated) — rebuild once.
        container.innerHTML = rows.map(r => `
                <div class="casualty-item ${r.isPrimary ? 'primary' : 'secondary'}" style="opacity: ${r.isDefeated ? 0.45 : 1};">
                    <img src="${r.flagSrc}" class="cas-flag ${r.isPrimary ? '' : 'small'}" alt="" style="${r.isDefeated ? 'filter: grayscale(1);' : ''}">
                    <div class="cas-value team-${poleIdx === 0 ? 'a' : 'b'}" style="font-size: ${r.isPrimary ? '18px' : '12px'};">${r.formatted}</div>
                </div>
            `).join('');
        GS._casualtyStructCache[containerId] = structSig;
    };

    updateSideCasualties(0, 'casualty-list-a');
    updateSideCasualties(1, 'casualty-list-b');

    if (GS.viewMode === 'FLAG') {
        // In flag view, force the canvas layer to fully update each frame so units and borders
        // keep animating even when the camera is stationary.
        GS.influenceLayer._forceRender = true;
        GS.influenceLayer._update();
    } else {
        GS.influenceLayer.render();
    }
    
    GS.animationFrameId = requestAnimationFrame(updateLoop);
}

export function updateCombatantsUI() {
    // Combatants list removed from stats panel to reduce clutter.
    // Users can click nations directly on the map to buff them via the inspector.
}
