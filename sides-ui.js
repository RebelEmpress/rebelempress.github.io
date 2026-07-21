// Engine module extracted from main.js — sides-ui
import { getCookie } from './utils.js';
import { getTranslation } from './translations.js';
import { BUFF_METADATA, CONFIG } from './config.js';
import { GS } from './state.js';
import * as DOM from './dom.js';
import { getOptimizationFactor, map } from './main.js';
import { cycleBuffState } from './flags.js';
import { getGridIndex } from './map-geo.js';
import { openReleaseModal } from './war-diplomacy.js';

// Per-side palette. Sides 0/1 stay red/blue so 2-side wars look exactly as before;
// 3+ sides get distinct colors for the setup columns.
export const SIDE_COLORS = ['#ff4757', '#2e86de', '#2ecc71', '#e67e22', '#9b59b6', '#f1c40f', '#1abc9c', '#fd79a8'];
export function sideColor(idx) { return SIDE_COLORS[idx % SIDE_COLORS.length]; }

export function updateSidesUI() {
    DOM.sidesContainer.innerHTML = '';
    
    GS.sides.forEach((sideList, sideIdx) => {
        const sideCol = document.createElement('div');
        sideCol.className = 'side-col';

        // Compute total estimated troops for this side/front
        const sideTotalTroops = sideList.reduce((sum, country) => {
            const est = estimateUnitsForCountry(country.id);
            return sum + (est || 0);
        }, 0);
        
        const sideHeader = document.createElement('div');
        sideHeader.className = `side-header ${GS.activeSideIndex === sideIdx ? 'active' : ''}`;
        sideHeader.dataset.side = sideIdx;
        
        // Use A, B, C, D labels
        const sideLabel = String.fromCharCode(65 + sideIdx);
        if (sideList.length > 0 && sideTotalTroops > 0) {
            sideHeader.innerHTML = `
                <div style="font-size:11px; font-weight:900;">SIDE ${sideLabel}</div>
                <div style="font-size:9px; color:#777; margin-top:2px; text-transform:uppercase; letter-spacing:0.5px;">
                    ~ ${GS.influenceLayer.formatSoldiers(sideTotalTroops)} troops
                </div>
            `;
        } else {
            sideHeader.innerText = `SIDE ${sideLabel}`;
        }
        const sColor = sideColor(sideIdx);
        sideHeader.style.color = sColor;
        if (GS.activeSideIndex === sideIdx) {
            sideHeader.style.backgroundColor = sColor + '33';
            sideHeader.style.borderColor = sColor;
        }

        sideHeader.onclick = () => {
            GS.activeSideIndex = sideIdx;
            updateSidesUI();
        };

        const listContainer = document.createElement('div');
        listContainer.className = 'side-country-list';

        sideList.forEach((country, i) => {
            const meta = GS.countryMetadata.find(m => m && m.id === country.id);
            const slot = document.createElement('div');
            slot.className = `setup-slot active-${sideIdx % 2 === 0 ? 'a' : 'b'}`;
            slot.style.borderColor = country.color.replace(/[\d.]+\)$/g, '1)');
            
            const buffState = country.buffState || meta?.buffState || 'none';
            const bMeta = BUFF_METADATA[buffState] || BUFF_METADATA['none'];
            const hiddenBuffState = (country.hiddenBuffState !== undefined ? country.hiddenBuffState : (meta?.hiddenBuffState ?? 'none')) || 'none';
            const hiddenMeta = BUFF_METADATA[hiddenBuffState] || BUFF_METADATA['none'];

            // Find flag for setup UI from live object or metadata
            const flagUrl = country.flag?.src || meta?.flagUrl || '';

            // Estimated troop size based on current density slider and map ownership
            const estTroops = estimateUnitsForCountry(country.id);
            const estLabel = estTroops ? GS.influenceLayer.formatSoldiers(estTroops) : 'UNKNOWN';

            const releasables = GS.countryMetadata.filter(m => m && m.releasableBy === country.id);

            const displayName = getTranslation(country.name, getCookie('mw_lang') || 'en', 'NATIONS');
            slot.innerHTML = `
                <div class="slot-name" title="${country.name}" style="display: flex; flex-direction: column; gap: 2px; align-items: center; justify-content: center; margin-bottom: 5px;">
                    <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
                        ${flagUrl ? `<img src="${flagUrl}" style="width: 22px; height: 13px; object-fit: cover; border: 1px solid rgba(255,255,255,0.2); flex-shrink: 0; border-radius: 1px;">` : ''}
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayName}</span>
                    </div>
                    <div style="font-size: 9px; color: #777; text-transform: uppercase; letter-spacing: 0.5px;">~ ${estLabel} troops</div>
                    <button class="mini-btn buff-toggle-btn" style="margin-top: 4px; background:${bMeta.color}; color:${bMeta.textColor}; font-size:8px; padding:2px 6px; display:flex; align-items:center; gap:4px; justify-content:center;" title="Adjust combat buffs: use ◀ / ▶ to move between CRIPPLED, WEAKENED, NONE, GOLIATH, DEITY, GODLY. Hold ALT while clicking to change an invisible buff that only affects combat.">
                        <span class="buff-arrow" data-dir="-1" style="font-size:10px;">◀</span>
                        <span class="buff-label">BUFF: ${bMeta.label}</span>
                        <span class="buff-arrow" data-dir="1" style="font-size:10px;">▶</span>
                    </button>
                    <button class="mini-btn add-allies-btn" style="margin-top: 4px; background:#16a085; font-size: 8px; padding: 2px 6px;" title="Recruit all formal allies (overlord and vassals) of this nation into this side.">ADD ALLIES</button>
                    
                    ${releasables.length > 0 ? `<button class="mini-btn release-btn" style="background: #27ae60; font-size: 8px; padding: 2px 6px; margin-top: 4px;" title="Release a releasable core from this country into the war.">RELEASE...</button>` : ''}
                </div>
                <div class="slot-controls">
                    <select class="mini-select role-select" title="OFF: Leads attacks and creates new fronts. SUP: Sends expeditionary support to allied offensives instead of opening its own invasions.">
                        <option value="OFFENSE" ${country.role === 'OFFENSE' ? 'selected' : ''} title="OFF: Offensive main participant, pushes its own fronts.">OFF</option>
                        <option value="SUPPORT" ${country.role === 'SUPPORT' ? 'selected' : ''} title="SUP: Support nation; mostly sends troops to help allies instead of starting new invasions.">SUP</option>
                    </select>
                    <select class="mini-select strategy-select" title="Per-country behavior: BAL = mixed; AGG = push hard; DEF = hold cores; BLZ = fast spearheads; URB = city road wars.">
                        <option value="BALANCED" ${country.strategy === 'BALANCED' ? 'selected' : ''} title="BAL: Balanced offense and defense along the whole front.">BAL</option>
                        <option value="AGGRESSIVE" ${country.strategy === 'AGGRESSIVE' ? 'selected' : ''} title="AGG: Very aggressive, tries to push hard even when risky.">AGG</option>
                        <option value="DEFENSIVE" ${country.strategy === 'DEFENSIVE' ? 'selected' : ''} title="DEF: Focuses on defending own cores and reclaiming lost land.">DEF</option>
                        <option value="BLITZ" ${country.strategy === 'BLITZ' ? 'selected' : ''} title="BLZ: Blitz-style spearheads that seek breakthroughs and deep pushes.">BLZ</option>
                        <option value="URBAN" ${country.strategy === 'URBAN' ? 'selected' : ''} title="URB: Urban warfare; pushes along roads into cities in thin invasion lines.">URB</option>
                    </select>
                    <button class="clear-slot-btn" title="Remove this country from the selected side.">×</button>
                </div>
            `;

            const buffBtn = slot.querySelector('.buff-toggle-btn');
            if (buffBtn) {
                const buffLabelEl = buffBtn.querySelector('.buff-label');
                const buffArrows = buffBtn.querySelectorAll('.buff-arrow');

                const applyBuffState = (newState) => {
                    country.buffState = newState;
                    if (meta) meta.buffState = newState;
                    const metaBuff = BUFF_METADATA[newState] || BUFF_METADATA['none'];
                    if (buffLabelEl) buffLabelEl.textContent = `BUFF: ${metaBuff.label}`;
                    buffBtn.style.background = metaBuff.color;
                    buffBtn.style.color = metaBuff.textColor;
                };

                buffArrows.forEach(span => {
                    span.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const dir = parseInt(span.getAttribute('data-dir'), 10) || 1;
                        const current = country.buffState || 'none';
                        const nextState = cycleBuffState(current, dir);
                        applyBuffState(nextState);
                    });
                });

                // Clicking the center label still cycles forward for convenience
                if (buffLabelEl) {
                    buffLabelEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const current = country.buffState || 'none';
                        const nextState = cycleBuffState(current, 1);
                        applyBuffState(nextState);
                    });
                }
            }

            // "Add Allies" button: pull overlord + vassals into this side when available
            const addAlliesBtn = slot.querySelector('.add-allies-btn');
            if (addAlliesBtn) {
                addAlliesBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const thisMeta = GS.countryMetadata.find(m => m && m.id === country.id);
                    if (!thisMeta) return;

                    const alliesSet = new Set();
                    // 1) This country itself
                    alliesSet.add(country.id);

                    // 2) Its overlord chain root
                    let rootId = country.id;
                    let guard = 0;
                    while (guard < 16) {
                        const rootMeta = GS.countryMetadata[rootId - 1];
                        if (!rootMeta || !rootMeta.overlordId || rootMeta.overlordId === rootId) break;
                        rootId = rootMeta.overlordId;
                        guard++;
                    }
                    alliesSet.add(rootId);

                    // 3) Direct vassals of this country
                    GS.countryMetadata.forEach(m => {
                        if (m && m.overlordId === country.id) {
                            alliesSet.add(m.id);
                        }
                    });

                    // 4) Direct vassals of the root (same wider alliance)
                    GS.countryMetadata.forEach(m => {
                        if (m && m.overlordId === rootId) {
                            alliesSet.add(m.id);
                        }
                    });

                    // 5) Explicit allies defined in the editor (mutual alliance graph)
                    const explicitAllies = Array.isArray(thisMeta.allies) ? thisMeta.allies : [];
                    explicitAllies.forEach(aid => {
                        if (aid > 0) alliesSet.add(aid);
                    });

                    // Remove ids that don't exist in metadata
                    const validAllies = Array.from(alliesSet).filter(id => GS.countryMetadata[id - 1]);

                    if (validAllies.length <= 1) {
                        DOM.statusText.innerText = "No allies linked via overlord/vassal or editor alliances for this nation.";
                        return;
                    }

                    // Add all valid allies to this side if not already present anywhere
                    const alreadyInAnySide = new Set(GS.sides.flat().filter(Boolean).map(c => c.id));
                    let addedCount = 0;
                    validAllies.forEach(id => {
                        if (alreadyInAnySide.has(id)) return;
                        const m = GS.countryMetadata[id - 1];
                        if (!m) return;
                        GS.sides[sideIdx].push({
                            id: m.id,
                            name: m.name,
                            color: m.color,
                            role: 'OFFENSE',
                            strategy: 'BALANCED',
                            buffState: m.buffState || 'none',
                            overlordId: m.overlordId || null,
                            flag: (m.tempFlag || null)
                        });
                        alreadyInAnySide.add(id);
                        addedCount++;
                    });

                    if (addedCount > 0) {
                        DOM.statusText.innerText = `Alliance Mobilized: Added ${addedCount} allied member${addedCount === 1 ? '' : 's'} to Side ${String.fromCharCode(65 + sideIdx)}.`;
                        updateSidesUI();
                        GS.influenceLayer.render();
                    } else {
                        DOM.statusText.innerText = "All linked allies are already committed to a side.";
                    }
                });
            }

            slot.querySelector('.role-select').onchange = (e) => {
                country.role = e.target.value;
            };

            slot.querySelector('.strategy-select').onchange = (e) => {
                country.strategy = e.target.value;
            };
            
            slot.querySelector('.clear-slot-btn').onclick = (e) => {
                e.stopPropagation();
                sideList.splice(i, 1);
                updateSidesUI();
                GS.influenceLayer.render();
            };

            const releaseBtn = slot.querySelector('.release-btn');
            if (releaseBtn) {
                releaseBtn.onclick = (e) => {
                    e.stopPropagation();
                    openReleaseModal(country.id, sideIdx);
                };
            }
            
            listContainer.appendChild(slot);
        });

        sideCol.appendChild(sideHeader);
        
        // Add "Delete Side" button for sides beyond the first two
        if (GS.sides.length > 2) {
            const delBtn = document.createElement('button');
            delBtn.className = 'mini-btn';
            delBtn.innerText = 'Remove Side';
            delBtn.style.fontSize = '8px';
            delBtn.style.padding = '2px';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                GS.sides.splice(sideIdx, 1);
                if (GS.activeSideIndex >= GS.sides.length) GS.activeSideIndex = GS.sides.length - 1;
                updateSidesUI();
            };
            sideCol.appendChild(delBtn);
        }

        sideCol.appendChild(listContainer);
        DOM.sidesContainer.appendChild(sideCol);

        if (sideIdx < GS.sides.length - 1) {
            const divider = document.createElement('div');
            divider.className = 'vs-divider';
            divider.innerText = 'VS';
            divider.style.alignSelf = 'center';
            DOM.sidesContainer.appendChild(divider);
        }
    });

    const activeSidesCount = GS.sides.filter(s => s && s.length > 0).length;
    const allSelectedCountries = GS.sides.flat().filter(c => !!c);
    
    // Rebellions are disabled: ensure button (if present) stays hidden and inert.
    if (DOM.rebellionBtn) {
        DOM.rebellionBtn.style.display = 'none';
        DOM.rebellionBtn.disabled = true;
    }

    DOM.setupOptions.style.display = (activeSidesCount >= 1) ? 'block' : 'none';
    const canStart = activeSidesCount >= 2;
    DOM.startBtn.disabled = !canStart;
    DOM.startBtn.style.opacity = canStart ? "1" : "0.5";
    DOM.startBtn.style.cursor = canStart ? "pointer" : "not-allowed";

    const attackers = GS.sides[0] || [];
    const defenders = GS.sides[1] || [];

    // Find the primary sides to display in the UI stats panel (p1NameDisp/p2NameDisp)
    // If indices 0 and 1 are empty (common in mid-game random wars), look for the first non-empty sides
    let primaryA = attackers;
    let primaryB = defenders;

    if (primaryA.length === 0 || primaryB.length === 0) {
        const activeSideIndices = [];
        GS.sides.forEach((s, i) => { if (s.length > 0) activeSideIndices.push(i); });
        
        if (primaryA.length === 0 && activeSideIndices.length > 0) {
            primaryA = GS.sides[activeSideIndices[0]];
        }
        if (primaryB.length === 0 && activeSideIndices.length > 1) {
            primaryB = GS.sides[activeSideIndices[1]];
        }
    }

    if (primaryA.length > 0) {
        const main = primaryA[0];
        DOM.p1NameDisp.innerText = primaryA.length > 1 ? `${main.name} + ${primaryA.length-1}` : main.name;
        DOM.p1NameDisp.style.color = main.color.replace(/[\d.]+\)$/g, '1)');
    } else {
        DOM.p1NameDisp.innerText = "Side A";
        DOM.p1NameDisp.style.color = "#ff4757";
    }
    
    if (primaryB.length > 0) {
        const main = primaryB[0];
        DOM.p2NameDisp.innerText = primaryB.length > 1 ? `${main.name} + ${primaryB.length-1}` : main.name;
        DOM.p2NameDisp.style.color = main.color.replace(/[\d.]+\)$/g, '1)');
    } else {
        DOM.p2NameDisp.innerText = "Side B";
        DOM.p2NameDisp.style.color = "#2e86de";
    }
}

export function updatePersistentInfluence(p1Count, p2Count, countryToSideMap) {
    let baseInfluence = CONFIG.INFLUENCE_RATE;
    
    // Dynamic optimization: More sides => fewer expensive samples / unit updates
    const optimizationFactor = getOptimizationFactor();
    
    // Mobilization Ramp: Influence starts at 5% and climbs to 100% over 600 frames (~10 seconds)
    const rampDuration = 600;
    const rampScale = Math.min(1.0, 0.05 + (GS.simFrameCount / rampDuration) * 0.95);
    baseInfluence *= rampScale;

    // Boost expansion when unopposed
    if (p1Count > 0 && p2Count === 0) baseInfluence *= 6;
    if (p2Count > 0 && p1Count === 0) baseInfluence *= 6;

    // Optimization: Interleave unit influence updates to prevent frame spikes
    // Each unit only updates its influence 1 in 3 ticks.
    const frameStride = 3;
    const currentTickOffset = GS.simFrameCount % frameStride;

    // Territory Diffusion Pass: Spread occupation laterally to prevent thin "fingers" and jagged borders
    // Increased samples and blur strength to ensure smoother, more solid frontline shapes.
    // This diffusion blur is a fixed ~35k random samples EVERY frame regardless of grid size,
    // and profiling a sprawling far war showed it eats ~16% of frame time — a top cause of the
    // freezing on phones. Occupation changes slowly, so run it every other frame: halves the cost
    // for a frontline that still reads as smooth (it just updates its smoothing one tick later).
    if (GS.simFrameCount % 2 === 0) {
        const smoothingBase = 35000;
        const smoothingSamples = Math.max(5000, Math.floor(smoothingBase / optimizationFactor));
        for (let s = 0; s < smoothingSamples; s++) {
            const idx = Math.floor(Math.random() * GS.landMask.length);
            if (GS.landMask[idx] !== 2) continue;

            const y = Math.floor(idx / GS.gridWidth);
            const x = idx % GS.gridWidth;
            if (x <= 0 || x >= GS.gridWidth - 1 || y <= 0 || y >= GS.gridHeight - 1) continue;

            let sum = 0;
            let count = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nIdx = idx + dy * GS.gridWidth + dx;
                    if (nIdx >= 0 && nIdx < GS.occupationMap.length) {
                        sum += GS.occupationMap[nIdx];
                        count++;
                    }
                }
            }

            const blur = 0.25; // Increased from 0.15 for stronger lateral smoothing
            GS.occupationMap[idx] = (GS.occupationMap[idx] * (1 - blur)) + ((sum / count) * blur);
        }
    }

    // Strategic Batching: Process a fixed max number of units per frame for influence
    // This prevents framerate drops when unit counts explode (e.g. 1000+ units)
    const maxUnitsBase = 300;
    const maxUnitsToProcess = Math.max(50, Math.floor(maxUnitsBase / optimizationFactor)); 
    let unitsProcessed = 0;
    
    // Start index rotates through the unit list
    const startIndex = (GS.simFrameCount * 30) % Math.max(1, GS.units.length);

    for (let i = 0; i < GS.units.length; i++) {
        const idx = (startIndex + i) % GS.units.length;
        const u = GS.units[idx];
        if (u.deployTicks > 0) continue;

        // If this unit is currently in active combat, it should not exert territorial influence
        if (typeof u.lastCombatTick === 'number' && (GS.simFrameCount - u.lastCombatTick) <= 5) {
            continue;
        }
        
        unitsProcessed++;
        if (unitsProcessed > maxUnitsToProcess) break;

        if (u.deployTicks > 0) continue;
        let r = CONFIG.INFLUENCE_RADIUS;
        let teamMult = 1.0;

        const gridIdx = getGridIndex(u.lat, u.lng);
        const isAtSea = gridIdx === -1 || GS.landMask[gridIdx] === 0;
        const mountainIntensity = (GS.mountainsEnabled && gridIdx !== -1) ? GS.terrainMask[gridIdx] : 0;
        
        // Naval units exert less influence on territory capture than land units
        if (isAtSea) teamMult *= 0.4;

        if (mountainIntensity > 0) {
            // Nerf advancement size (radius) and expansion rate (influence power) in mountains
            // Higher intensity mountains require units to be significantly closer to the border to flip it
            r *= (1.0 - (mountainIntensity * 0.65));
            teamMult *= (1.0 - (mountainIntensity * 0.5));
        }

        const sideList = GS.sides[u.sideIndex] || [];
        const countryObj = sideList.find(c => c.id === u.sovereignId);
        const role = countryObj?.role || 'OFFENSE';
        const isUrbanStrategy = countryObj?.strategy === 'URBAN';
        
        if (countryObj) {
            if (countryObj.buffState === 'buff') teamMult = 2.5;
            else if (countryObj.buffState === 'super') teamMult = 8.0;
            else if (countryObj.buffState === 'godly') { teamMult = 45.0; r *= 0.5; }
            else if (countryObj.buffState === 'weakened') teamMult = 0.7;
            else if (countryObj.buffState === 'crippled') teamMult = 0.4;

            // Apply continuous attack modifier to influence strength as well
            const atkPct = typeof countryObj.attackBuffPercent === 'number' ? countryObj.attackBuffPercent : 0;
            const atkFactor = 1 + (atkPct / 100);
            if (atkFactor > 0) teamMult *= atkFactor;
        }

        if (u.victoryBoostTicks > 0) {
            teamMult *= 3.0; // Buffed influence capture power
            r *= 1.4;        // Increased capture radius
        }

        // Organic Push: Randomize push intensity per unit to create ragged, non-linear salients
        const organicNoise = 0.8 + (Math.sin(u.id * 1000 + GS.simFrameCount * 0.05) * 0.4);
        const delta = (u.team === 'A' ? baseInfluence : -baseInfluence) * teamMult * organicNoise;
        const isTeamA = u.team === 'A';
        const mySide = GS.sides[u.sideIndex];
        
        // Ragged Frontiers: Perturb the influence radius slightly to create "fingers" and "bubbles"
        const rVar = r * (0.9 + Math.sin(u.id * 500 + GS.simFrameCount * 0.1) * 0.2);

        const startLat = Math.max(0, Math.floor((u.lat - rVar + 90) / CONFIG.GRID_RES));
        const endLat = Math.min(GS.gridHeight - 1, Math.floor((u.lat + rVar + 90) / CONFIG.GRID_RES));
        const startLng = Math.max(0, Math.floor((u.lng - rVar + 180) / CONFIG.GRID_RES));
        const endLng = Math.min(GS.gridWidth - 1, Math.floor((u.lng + rVar + 180) / CONFIG.GRID_RES));

        for (let y = startLat; y <= endLat; y++) {
            for (let x = startLng; x <= endLng; x++) {
                const idx = y * GS.gridWidth + x;
                if (idx < 0 || idx >= GS.landMask.length || GS.landMask[idx] === 0 || GS.landMask[idx] !== 2) continue;
                
                // City Resistance: Cells containing cities are much harder for frontlines to pass through
                let cellDelta = delta;
                const cellHasCity = GS.cityCellSet ? GS.cityCellSet.has(idx) : GS.activeTheaterCities.some(c => getGridIndex(c.lat, c.lng) === idx);
                if (cellHasCity) cellDelta *= 0.35;

                const cellLat = (y * CONFIG.GRID_RES) - 90;
                const cellLng = (x * CONFIG.GRID_RES) - 180;
                const dSq = (u.lat - cellLat) ** 2 + (u.lng - cellLng) ** 2;
                if (dSq < rVar * rVar) {
                    const dist = Math.sqrt(dSq);
                    // Strategic Concentration: Units push harder when clustered or in spearheads
                    const concentrationBonus = Math.min(2.5, (u.lastAllyCount || 1) / 5);
                    const weight = Math.pow(1 - dist / rVar, 2.0) * concentrationBonus;
                    
                    let newVal = GS.occupationMap[idx] + cellDelta * weight;
                    if (newVal > 1) newVal = 1;
                    else if (newVal < -1) newVal = -1;

                    // Restriction for rebels: Do not expand influence into land that is not your de jure territory
                    const isRebelUnit = GS.activeRebellion && u.sovereignId === GS.activeRebellion.rebelId;
                    if (isRebelUnit && GS.deJureMap[idx] !== GS.activeRebellion.rebelId) {
                        // Rebels only push borders within their own historical land.
                        // They can defend themselves (delta logic prevents enemy from taking their land),
                        // but they won't push forward into the overlord's core territory.
                        if (u.team === 'A' ? newVal > GS.occupationMap[idx] : newVal < GS.occupationMap[idx]) {
                            newVal = GS.occupationMap[idx];
                        }
                    }
                    
                    const ownerId = GS.worldControlMap[idx];
                    const isOwnerAlly = mySide.some(c => c.id === ownerId);
                    
                    // If owner is a SUPPORT nation on the other side and we are OFFENSE, don't invade (skip influence)
                    // unless we already have established some occupation in that cell.
                    if (!isOwnerAlly && ownerId > 0 && role === 'OFFENSE') {
                        const ownerSideIdx = countryToSideMap.get(ownerId);
                        if (ownerSideIdx !== undefined && (ownerSideIdx !== u.sideIndex)) {
                            const ownerObj = GS.sides[ownerSideIdx].find(c => c.id === ownerId);
                            if (ownerObj?.role === 'SUPPORT') {
                                const occ = GS.occupationMap[idx];
                                const isAlreadyInvaded = (isTeamA && occ > 0.1) || (!isTeamA && occ < -0.1);
                                if (!isAlreadyInvaded) continue;
                            }
                        }
                    }

                    const currentOccupierId = GS.primaryOccupierMap[idx];
                    const oldVal = GS.occupationMap[idx];
                    
                    if (!isOwnerAlly) {
                        // Support System: Use beneficiaryId instead of sovereignId for land credit
                        const creditToId = u.beneficiaryId || u.sovereignId;
                        
                        // Prevent flickering between allies:
                        // Only update the occupier tag if the cell is neutral or occupied by an enemy.
                        const currentOccSideIdx = countryToSideMap.get(currentOccupierId);
                        const isCurrentOccAlly = currentOccSideIdx !== undefined && (currentOccSideIdx === u.sideIndex);

                        if (!isCurrentOccAlly) {
                            // AGGRESSIVE ALLIED CONSOLIDATION:
                            // To prevent border gore, we force units to expand existing allied fronts 
                            // rather than creating many tiny isolated pixels of their own color.
                            const counts = new Map();
                            const checkDirs = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
                            for (const [dx, dy] of checkDirs) {
                                const nx = x + dx; const ny = y + dy;
                                if (nx >= 0 && nx < GS.gridWidth && ny >= 0 && ny < GS.gridHeight) {
                                    const nId = GS.primaryOccupierMap[ny * GS.gridWidth + nx];
                                    const nSide = countryToSideMap.get(nId);
                                    if (nId > 0 && nSide !== undefined && (nSide === u.sideIndex)) {
                                        counts.set(nId, (counts.get(nId) || 0) + 1);
                                    }
                                }
                            }

                            let bestAllyId = 0;
                            let maxCount = 0;
                            counts.forEach((count, id) => {
                                // If a neighboring ally has 3 or more adjacent cells, they take the "credit"
                                // for this expansion to keep the map color-blocks contiguous.
                                if (count > maxCount && count >= 3) { maxCount = count; bestAllyId = id; }
                            });
                            
                            const finalCreditId = bestAllyId || creditToId;

                            // Restriction: Rebels cannot get land credit outside their de jure territory
                            const isRebelFinalCredit = GS.activeRebellion && finalCreditId === GS.activeRebellion.rebelId;
                            const canReceiveCredit = !isRebelFinalCredit || GS.deJureMap[idx] === GS.activeRebellion.rebelId;

                            if (canReceiveCredit) {
                                // Multi-side capture-by-presence: with 3+ sides, two sides can share the
                                // same occupation pole (idx % 2) yet still be enemies. The signed tug-of-war
                                // can't erode an ally-pole cell, so let a present enemy side claim a cell that
                                // already sits on its own pole. Gated to >2 sides => exact 2-side behavior.
                                const poleAligned = GS.sides.length > 2 && (isTeamA ? newVal >= 0.05 : newVal <= -0.05);
                                if (isTeamA && ((newVal > oldVal && (newVal >= 0.05 || currentOccupierId === 0)) || poleAligned)) {
                                    GS.primaryOccupierMap[idx] = finalCreditId;
                                } else if (!isTeamA && ((newVal < oldVal && (newVal <= -0.05 || currentOccupierId === 0)) || poleAligned)) {
                                    GS.primaryOccupierMap[idx] = finalCreditId;
                                }
                            }
                        }
                    }
                    
                    GS.occupationMap[idx] = newVal;
                }
            }
        }
    }
}

export function estimateUnitsForCountry(countryId) {
    if (!GS.worldControlMap || !GS.worldControlMap.length || !countryId) return 0;

    // Count how many grid cells this country controls on the current map
    let cellCount = 0;
    for (let i = 0; i < GS.worldControlMap.length; i++) {
        if (GS.worldControlMap[i] === countryId) cellCount++;
    }
    if (cellCount === 0) return 0;

    const multiplier = parseFloat(DOM.densitySlider.value) || 1.0;
    const sizeFactor = Math.max(1, cellCount / 1500);
    const densityScale = 1.0 / Math.pow(sizeFactor, 0.45);

    let count = Math.floor(cellCount * CONFIG.UNIT_DENSITY_FACTOR * multiplier * densityScale);
    const flatFloor = 3;
    count = Math.max(flatFloor, Math.min(count, CONFIG.MAX_UNITS_PER_SIDE));

    return count * CONFIG.UNIT_TO_SOLDIER_RATIO;
}
