// Engine module extracted from main.js — war-diplomacy
import { playPeaceSound, playWarStartSound } from './audio.js';
import { GS } from './state.js';
import * as DOM from './dom.js';
import { map, resetToSelection } from './main.js';
import { activateCountryMidWar, formatGameDate, triggerRandomWar } from './engine-simulation.js';
import { generatePuppetFlag } from './flags.js';
import { generateProvinces, recalculateAllBounds } from './map-geo.js';
import { updateSidesUI } from './sides-ui.js';
import { openInspector } from './ui-inspector.js';

// WAR GOALS: restore one defeated defender's original territory, transferring ONLY the
// tiles the attacker pre-marked to the winner. Snapshot-based and idempotent, so it can run
// at final war-end regardless of which defeat route (grind / capital / board-share) fired.
// Returns true if a partition was applied.
export function applyWarGoalPartition(loserId, winnerId) {
    if (!GS.warGoalsEnabled || !GS.warGoalCells || GS.warGoalCells.size === 0) return false;
    if (!winnerId || winnerId <= 0 || !loserId || loserId <= 0) return false;
    const snap = GS.initialWorldControlMapSnapshot;
    if (!snap) return false;
    for (let i = 0; i < GS.worldControlMap.length; i++) {
        if (snap[i] !== loserId) continue;
        const newOwner = GS.warGoalCells.has(i) ? winnerId : loserId;
        GS.worldControlMap[i] = newOwner;
        GS.primaryOccupierMap[i] = newOwner;
        GS.landMask[i] = 1;
        GS.occupationMap[i] = 0;
    }
    return true;
}

export function showTreatyOffer(proposer, willAccept, proposerSideIdx = null) {
    GS.lastTreatyTime = Date.now();
    let name = proposer === 'A' ? DOM.p1NameDisp.innerText : DOM.p2NameDisp.innerText;
    
    // In FFA/Multi-side, try to find the specific side's name for the UI
    if (proposerSideIdx !== null && GS.sides[proposerSideIdx] && GS.sides[proposerSideIdx][0]) {
        const side = GS.sides[proposerSideIdx];
        name = side.length > 1 ? `${side[0].name} Allies` : side[0].name;
    }

    DOM.treatyMsg.innerText = `${name} requests peace`;
    DOM.treatyAlert.style.display = 'block';
    document.getElementById('treaty-status').innerText = "Considering proposal...";
    
    setTimeout(() => {
        if (willAccept) {
            document.getElementById('treaty-status').innerText = "Treaty Accepted";
            setTimeout(() => applyTreaty('PEACE_TREATY'), 1500);
        } else {
            document.getElementById('treaty-status').innerText = "Proposal Rejected";
            setTimeout(() => {
                DOM.treatyAlert.style.display = 'none';
                GS.lastTreatyTime = Date.now();
            }, 1500);
        }
    }, 2000);
}

export function capitulateCountry(country, sideIndex) {
    const side = GS.sides[sideIndex];
    if (!side) return;

    // Announce the individual fall
    DOM.statusText.innerText = `${country.name} HAS CAPITULATED`;
    DOM.treatyMsg.innerText = "NATION ANNEXED";
    document.getElementById('treaty-status').innerText = `${country.name} territory has been seized.`;
    DOM.treatyAlert.style.display = 'block';
    
    // Auto-hide the alert after a delay if war is still going
    setTimeout(() => { 
        if (GS.gameState === 'SIMULATING') {
            DOM.treatyAlert.style.display = 'none';
        }
    }, 4000);

    // Build owner -> side index map once for this operation
    const ownerToSideMap = new Map();
    GS.sides.forEach((s, idx) => {
        s.forEach(c => ownerToSideMap.set(c.id, idx));
    });

    // Snapshot all tiles currently owned by the capitulating country so it can be released later
    const victimTerritorySnapshot = [];
    for (let i = 0; i < GS.worldControlMap.length; i++) {
        if (GS.worldControlMap[i] === country.id) {
            const y = Math.floor(i / GS.gridWidth);
            const x = i % GS.gridWidth;
            victimTerritorySnapshot.push([x, y]);
        }
    }

    // Transfer territory logic
    const opposingPoleIdx = sideIndex % 2 === 0 ? 1 : 0;
    
    // Find a fallback winner on the opposing pole to inherit land not claimed by specific occupiers
    let fallbackWinnerId = 0;
    for (let j = 0; j < GS.sides.length; j++) {
        if (j % 2 === opposingPoleIdx && GS.sides[j].length > 0) {
            fallbackWinnerId = GS.sides[j][0].id;
            break;
        }
    }

    // Track which indices were part of the capitulated country's warzone so we can
    // decide afterwards if they should remain active fronts or be stabilized.
    const affectedIndices = [];

    for (let i = 0; i < GS.worldControlMap.length; i++) {
        if (GS.worldControlMap[i] === country.id && GS.landMask[i] === 2) {
            const occupierId = GS.primaryOccupierMap[i];
            
            // Verify if the occupier belongs to the winning side of this specific engagement
            let occupierOnOpposingPole = false;
            GS.sides.forEach((s, idx) => {
                if (idx % 2 === opposingPoleIdx && s.some(c => c.id === occupierId)) {
                    occupierOnOpposingPole = true;
                }
            });

            const newOwner = occupierOnOpposingPole ? occupierId : fallbackWinnerId;
            GS.worldControlMap[i] = newOwner;
            GS.primaryOccupierMap[i] = newOwner || 0;
            affectedIndices.push(i);
        }
    }

    // Re-evaluate warzone status for newly annexed tiles so winners can keep pushing
    const totalCells = GS.worldControlMap.length;
    const gridW = GS.gridWidth;
    const gridH = GS.gridHeight;
    affectedIndices.forEach(idx => {
        const ownerId = GS.worldControlMap[idx];
        if (ownerId <= 0) {
            GS.landMask[idx] = 1;
            GS.occupationMap[idx] = 0;
            GS.primaryOccupierMap[idx] = 0;
            return;
        }

        const ownerSideIdx = ownerToSideMap.get(ownerId);
        const ownerPole = ownerSideIdx !== undefined ? (ownerSideIdx % 2) : null;

        let stillFront = false;
        const x = idx % gridW;
        const y = Math.floor(idx / gridW);

        const neighborOffsets = [
            1, -1, gridW, -gridW
        ];

        for (const off of neighborOffsets) {
            const nIdx = idx + off;
            if (nIdx < 0 || nIdx >= totalCells) continue;
            if (GS.landMask[nIdx] === 0) continue; // ignore sea

            const nOwner = GS.worldControlMap[nIdx];
            if (nOwner <= 0 || nOwner === ownerId) continue;

            const nSideIdx = ownerToSideMap.get(nOwner);
            if (nSideIdx === undefined) continue;

            const nPole = nSideIdx % 2;

            // If neighbor belongs to an opposing pole that still has forces, this cell
            // remains an active frontline.
            if (ownerPole !== null && nPole !== ownerPole && GS.sides[nSideIdx].length > 0) {
                stillFront = true;
                break;
            }
        }

        if (stillFront) {
            GS.landMask[idx] = 2;
            // Set occupation polarity so the annexer can push further from this border
            const poleIsA = ownerPole === 0;
            GS.occupationMap[idx] = poleIsA ? 1 : -1;
            GS.primaryOccupierMap[idx] = ownerId;
        } else {
            GS.landMask[idx] = 1;
            GS.occupationMap[idx] = 0;
            // keep primaryOccupierMap[idx] as ownerId is harmless, but clear to be safe
            GS.primaryOccupierMap[idx] = 0;
        }
    });

    // RELEASABLE TRANSFER: Transfer any releasables owned by the capitulating country to the primary annexer
    GS.countryMetadata.forEach(m => {
        if (m && m.releasableBy === country.id) {
            m.releasableBy = fallbackWinnerId;
        }
    });

    // Make the capitulated country itself a releasable of the annexer and remember its old territory
    if (fallbackWinnerId > 0) {
        const victimMeta = GS.countryMetadata.find(m => m && m.id === country.id);
        if (victimMeta) {
            victimMeta.releasableBy = fallbackWinnerId;

            // Prefer the precise snapshot we made before any transfer; if empty, fall back to deJure cores
            if (victimTerritorySnapshot.length > 0) {
                victimMeta.savedCells = victimTerritorySnapshot;
            } else {
                const cells = [];
                for (let i = 0; i < GS.deJureMap.length; i++) {
                    if (GS.deJureMap[i] === country.id) {
                        const y = Math.floor(i / GS.gridWidth);
                        const x = i % GS.gridWidth;
                        cells.push([x, y]);
                    }
                }
                victimMeta.savedCells = cells;
            }
        }
    }

    // Remove the country from its alliance list
    const cIdx = side.indexOf(country);
    if (cIdx > -1) side.splice(cIdx, 1);

    // Clear targets for any units that were focusing on this specific country's theater
    GS.units.forEach(u => {
        if (u.lastMopUpId === country.id) {
            u.mopUpTarget = null;
            u.lastMopUpId = null;
            u.targetSearchCooldown = 0;
        }
    });

    // Filter out all units belonging to the capitulated nation
    GS.units = GS.units.filter(u => u.sovereignId !== country.id);

    // Sync provinces to new ownership
    generateProvinces();

    // Refresh UI
    recalculateAllBounds();
    updateSidesUI();
    GS.influenceLayer.render();
}

export function applyTreaty(type, winnerPoleOverride = null) {
    GS.gameState = 'WAR_OVER';
    playPeaceSound();

    // Stop recording if active
    if (GS.mediaRecorder && GS.mediaRecorder.state !== 'inactive') {
        GS.mediaRecorder.onstop = () => {
            const blob = new Blob(GS.recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ModernWars_${new Date().getTime()}.webm`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            GS.recordedChunks = [];
        };
        GS.mediaRecorder.stop();
    }

    // Freeze time system at war end and reflect final date in the setup inputs
    if (GS.gameTimeDate && DOM.timeYearInput && DOM.timeMonthInput && DOM.timeDayInput) {
        GS.gameTimeEnabled = false;
        GS.gameTimeAccumulatorMs = 0;
        DOM.timeYearInput.value = GS.gameTimeDate.year;
        DOM.timeMonthInput.value = GS.gameTimeDate.month;
        DOM.timeDayInput.value = GS.gameTimeDate.day;
        if (DOM.gameDateDisplay) {
            DOM.gameDateDisplay.textContent = formatGameDate();
            DOM.gameDateDisplay.style.display = 'block';
        }
    }
    
    let p1T = 0, p2T = 0;
    for (let i = 0; i < GS.occupationMap.length; i++) {
        if (GS.landMask[i] === 2) {
            if (GS.occupationMap[i] > 0) p1T++; else if (GS.occupationMap[i] < 0) p2T++;
        }
    }
    
    let winA = p1T >= p2T;
    if (winnerPoleOverride === 'A') winA = true;
    if (winnerPoleOverride === 'B') winA = false;
    
    let winnerName = "The Winner";
    const sideUnitCounts = GS.sides.map((s, i) => ({
        idx: i,
        units: GS.units.filter(u => u.sideIndex === i).length,
        side: s
    }));

    DOM.casualtyPanel.style.display = 'none';

    if (winA) {
        const strongest = sideUnitCounts.filter(s => s.idx % 2 === 0).sort((a,b) => b.units - a.units)[0];
        winnerName = strongest && strongest.side[0] ? (strongest.side.length > 1 ? `${strongest.side[0].name} Allies` : strongest.side[0].name) : DOM.p1NameDisp.innerText;
    } else {
        const strongest = sideUnitCounts.filter(s => s.idx % 2 !== 0).sort((a,b) => b.units - a.units)[0];
        winnerName = strongest && strongest.side[0] ? (strongest.side.length > 1 ? `${strongest.side[0].name} Allies` : strongest.side[0].name) : DOM.p2NameDisp.innerText;
    }
    
    const isTotalCapitulation = type.includes('FULL_CAPITULATION') || type === 'ANNEXATION';
    const isNegotiatedPeace = type === 'PEACE_TREATY';

    if (isTotalCapitulation) {
        DOM.statusText.innerText = winA ? `Victory! Multiple nations annexed by ${winnerName}` : (DOM.p1NameDisp.innerText !== "Side A" ? `${DOM.p1NameDisp.innerText} was conquered.` : "The conquest is complete.");
        DOM.treatyMsg.innerText = "TOTAL ANNEXATION";
        document.getElementById('treaty-status').innerText = "The conflict has concluded";
        DOM.treatyAlert.style.display = 'block';
    } else if (isNegotiatedPeace) {
        DOM.statusText.innerText = "Peace Treaty Signed";
        DOM.treatyMsg.innerText = "BORDERS REDRAWN";
        document.getElementById('treaty-status').innerText = "Territorial adjustments finalized";
        DOM.treatyAlert.style.display = 'block';
    } else {
        DOM.statusText.innerText = "White Peace Signed";
    }
    
    const countryToSideMap = new Map();
    const countryToRoleMap = new Map();
    GS.sides.forEach((side, idx) => {
        side.forEach(c => {
            countryToSideMap.set(c.id, idx);
            countryToRoleMap.set(c.id, c.role || 'OFFENSE');
        });
    });

    for (let i = 0; i < GS.worldControlMap.length; i++) {
        if (GS.landMask[i] === 2) {
            const originalOwner = GS.worldControlMap[i];
            const occupierId = GS.primaryOccupierMap[i];
            const val = GS.occupationMap[i];
            
            const ownerSideIdx = countryToSideMap.get(originalOwner);
            const occupierSideIdx = countryToSideMap.get(occupierId);

            const isTeamAOccupying = val > 0;
            const isTeamBOccupying = val < 0;

            // Organic land shift: Transfer if side currently holding it is different from original owner
            let cellNewOwner = originalOwner;
            if (isTeamAOccupying && (ownerSideIdx === undefined || ownerSideIdx % 2 !== 0)) {
                cellNewOwner = (occupierSideIdx !== undefined && occupierSideIdx % 2 === 0) ? occupierId : (GS.sides[0][0]?.id || originalOwner);
            } else if (isTeamBOccupying && (ownerSideIdx === undefined || ownerSideIdx % 2 === 0)) {
                cellNewOwner = (occupierSideIdx !== undefined && occupierSideIdx % 2 !== 0) ? occupierId : (GS.sides[1][0]?.id || originalOwner);
            }
            
            // Transfer land to new owner
            if (cellNewOwner !== originalOwner && cellNewOwner > 0) {
                GS.worldControlMap[i] = cellNewOwner;
            }

            if (isTotalCapitulation) {
                const currentOwner = GS.worldControlMap[i];
                const currentSideIdx = countryToSideMap.get(currentOwner);
                const currentRole = countryToRoleMap.get(currentOwner);
                
                let newOwnerId = 0;
                if (winA && (currentSideIdx !== undefined && currentSideIdx % 2 !== 0) && currentRole !== 'SUPPORT') {
                    newOwnerId = (occupierSideIdx !== undefined && occupierSideIdx % 2 === 0) ? occupierId : (GS.sides[0][0]?.id || 0);
                } else if (!winA && (currentSideIdx !== undefined && currentSideIdx % 2 === 0) && currentRole !== 'SUPPORT') {
                    newOwnerId = (occupierSideIdx !== undefined && occupierSideIdx % 2 !== 0) ? occupierId : (GS.sides[1][0]?.id || 0);
                }

                if (newOwnerId > 0) {
                    GS.worldControlMap[i] = newOwnerId;
                    // Note: Releasable transfer handled once per country outside this loop for performance
                }
            }

            // Clean up theater masks
            GS.landMask[i] = 1;
            GS.occupationMap[i] = 0;
        }
    }

    // WAR GOALS override: if the attacker pre-marked land and the attacking pole (A) won,
    // the winner keeps ONLY the marked tiles of each defeated defender; every defender's
    // remaining original territory is handed back to it (it survives, gutted, not absorbed).
    // Runs after the normal redraw so it authoritatively overrides those defender tiles.
    if (winA && GS.warGoalsEnabled && GS.warGoalCells && GS.warGoalCells.size > 0 && GS.warGoalDefenderIds) {
        const strongestA = sideUnitCounts.filter(s => s.idx % 2 === 0).sort((a, b) => b.units - a.units)[0];
        const winnerId = (strongestA && strongestA.side[0]) ? strongestA.side[0].id : (GS.sides[0] && GS.sides[0][0] ? GS.sides[0][0].id : 0);
        if (winnerId > 0) {
            GS.warGoalDefenderIds.forEach(lid => applyWarGoalPartition(lid, winnerId));
        }
    }

    // Re-sync province map to final treaty borders to remove ghost province lines
    generateProvinces();

    // High-Performance Organic Border Smoothing: Uses frequency array to avoid GC pressure
    const smoothingPasses = 3;
    const maxId = GS.countryMetadata.reduce((max, m) => m ? Math.max(max, m.id) : max, 0);
    const sideLookup = new Int8Array(maxId + 1).fill(-1);
    countryToSideMap.forEach((side, id) => { if(id <= maxId) sideLookup[id] = side; });
    
    // Static buffers to avoid re-allocation in loops
    const freq = new Uint16Array(maxId + 1);
    const activeIds = new Uint32Array(9); 

    // Transfer Releasables: Move all releasables belonging to defeated countries to their new primary owners
    const ownerTransferMap = new Map();
    // Use sample points to find which countries lost land and who took it
    for (let i = 0; i < GS.worldControlMap.length; i += 500) {
        if (GS.landMask[i] === 2) {
            const currentOwner = GS.worldControlMap[i];
            const originalOwner = GS.deJureMap[i]; // Approximate previous owner
            if (currentOwner !== originalOwner && originalOwner > 0) {
                ownerTransferMap.set(originalOwner, currentOwner);
            }
        }
    }
    GS.countryMetadata.forEach(m => {
        if (m && m.releasableBy && ownerTransferMap.has(m.releasableBy)) {
            m.releasableBy = ownerTransferMap.get(m.releasableBy);
        }
    });

    for (let p = 0; p < smoothingPasses; p++) {
        const tempMap = new Int32Array(GS.worldControlMap);
        for (let y = 1; y < GS.gridHeight - 1; y++) {
            const rowIdx = y * GS.gridWidth;
            for (let x = 1; x < GS.gridWidth - 1; x++) {
                const idx = rowIdx + x;
                if (GS.landMask[idx] === 0) continue;

                let activeCount = 0;
                let maxFreq = 0;
                let winner = GS.worldControlMap[idx];

                // Sample 3x3 neighborhood
                for (let dy = -1; dy <= 1; dy++) {
                    const rOff = dy * GS.gridWidth;
                    for (let dx = -1; dx <= 1; dx++) {
                        const owner = GS.worldControlMap[idx + rOff + dx];
                        if (owner > 0) {
                            if (freq[owner] === 0) activeIds[activeCount++] = owner;
                            freq[owner]++;
                            if (freq[owner] > maxFreq) {
                                maxFreq = freq[owner];
                                winner = owner;
                            }
                        }
                    }
                }

                // Apply majority rule
                if (maxFreq >= 6) tempMap[idx] = winner;

                // Cleanup frequency array for next pixel
                for (let i = 0; i < activeCount; i++) freq[activeIds[i]] = 0;
            }
        }
        GS.worldControlMap.set(tempMap);
    }

    GS.units = [];
    GS.unitSpatialHash.clear();
    GS.activeBattles = [];
    GS.bombs = [];
    GS.explosions = [];
    GS.encirclePops = [];
    GS.bases = [];
    // Naval cleanup: ships must vanish when the war ends. Landing "ghost" sprites
    // draw ungated by gameState and are pruned only in the sim tick (stopped at
    // WAR_OVER); transport boats hold stale data. Clear both so no ship lingers
    // frozen on the aftermath board.
    GS.navalLandings = [];
    GS.boats = [];
    recalculateAllBounds();
    GS.influenceLayer.render();

    setTimeout(() => {
        DOM.treatyAlert.style.display = 'none';
        resetToSelection();
        if (GS.randomWarMode) {
            setTimeout(triggerRandomWar, 1500);
        }
    }, 2500);
}

export function handleRebellionPeace() {
    if (!GS.activeRebellion) return;
    const { rebelId, overlordId } = GS.activeRebellion;
    
    GS.gameState = 'WAR_OVER';
    playPeaceSound();

    // Freeze time system at war end and reflect final date in the setup inputs
    if (GS.gameTimeDate && DOM.timeYearInput && DOM.timeMonthInput && DOM.timeDayInput) {
        GS.gameTimeEnabled = false;
        GS.gameTimeAccumulatorMs = 0;
        DOM.timeYearInput.value = GS.gameTimeDate.year;
        DOM.timeMonthInput.value = GS.gameTimeDate.month;
        DOM.timeDayInput.value = GS.gameTimeDate.day;
        if (DOM.gameDateDisplay) {
            DOM.gameDateDisplay.textContent = formatGameDate();
            DOM.gameDateDisplay.style.display = 'block';
        }
    }
    
    DOM.statusText.innerText = "Rebellion Successful: Borders Restored";
    DOM.treatyMsg.innerText = "INDEPENDENCE RECOGNIZED";
    document.getElementById('treaty-status').innerText = "Post-colonial borders enforced";
    DOM.treatyAlert.style.display = 'block';

    // Special Peace Condition:
    // 1. Rebel gets its de jure land back.
    // 2. Overlord gets its de jure land back (even if captured by rebel during war).
    // 3. Any other land involved stabilized.
    
    for (let i = 0; i < GS.worldControlMap.length; i++) {
        if (GS.landMask[i] === 2) {
            const djId = GS.deJureMap[i];
            if (djId === rebelId) {
                GS.worldControlMap[i] = rebelId;
            } else if (djId === overlordId) {
                GS.worldControlMap[i] = overlordId;
            } else {
                // If it was some other land captured during the chaos, return to original
                if (djId > 0) GS.worldControlMap[i] = djId;
            }
            
            GS.landMask[i] = 1;
            GS.occupationMap[i] = 0;
            GS.primaryOccupierMap[i] = 0;
        }
    }

    GS.activeRebellion = null;
    GS.units = [];
    GS.bombs = [];
    // Ships must vanish when the war ends (see applyTreaty note).
    GS.navalLandings = [];
    GS.boats = [];

    // Sync provinces back to restored de jure borders
    generateProvinces();
    GS.explosions = [];
    GS.encirclePops = [];
    GS.bases = [];
    recalculateAllBounds();
    GS.influenceLayer.render();
    
    setTimeout(() => {
        DOM.treatyAlert.style.display = 'none';
        resetToSelection();
    }, 3000);
}

export function signSelectivePeace(exiter, target) {
    let exiterSideIdx = -1;
    let targetSideIdx = -1;
    
    GS.sides.forEach((s, i) => {
        if (s.some(c => c.id === exiter.id)) exiterSideIdx = i;
        if (s.some(c => c.id === target.id)) targetSideIdx = i;
    });

    if (exiterSideIdx === -1 || targetSideIdx === -1 || (exiterSideIdx % 2 === targetSideIdx % 2)) {
        alert("Diplomatic error: Negotiating nations must be on opposing sides.");
        GS.gameState = 'SIMULATING';
        DOM.statusText.innerText = "Conflict Continued";
        requestAnimationFrame(updateLoop);
        return;
    }

    // The 'target' (second nation clicked) is the one exiting the specific conflict engagement
    const exiterPoleIdx = exiterSideIdx % 2;
    const targetPoleIdx = targetSideIdx % 2; 

    // 1. Redraw borders for the TARGET nation as it exits the war
    // As per user request: "work like normal peace treatys where the occupied land gets annexed and only the occupied parts"
    for (let i = 0; i < GS.worldControlMap.length; i++) {
        if (GS.landMask[i] !== 2) continue;

        const ownerId = GS.worldControlMap[i];
        const occupierId = GS.primaryOccupierMap[i];
        const occ = GS.occupationMap[i];
        
        // A) If the target (leaving nation) owns this land, and it's being occupied by enemies
        if (ownerId === target.id) {
            const isOccupiedByEnemy = (targetPoleIdx === 0) ? (occ < -0.05) : (occ > 0.05);
            if (isOccupiedByEnemy) {
                // Annexation: Give land to the specific occupier
                GS.worldControlMap[i] = occupierId > 0 ? occupierId : exiter.id;
                GS.landMask[i] = 1; // Stabilize
                GS.occupationMap[i] = 0;
                GS.primaryOccupierMap[i] = 0;
            }
        } 
        // B) If the target (leaving nation) is occupying someone else's land, it gets annexed by the target
        else if (occupierId === target.id) {
            const isOccupyingEnemy = (targetPoleIdx === 0) ? (occ > 0.05) : (occ < -0.05);
            if (isOccupyingEnemy) {
                GS.worldControlMap[i] = target.id;
                GS.landMask[i] = 1; // Stabilize
                GS.occupationMap[i] = 0;
            } else {
                // Retreat from allies or neutral land
                GS.occupationMap[i] = 0;
            }
            GS.primaryOccupierMap[i] = 0;
        }
    }

    // 2. Remove the target country from its alliance list
    const targetSide = GS.sides[targetSideIdx];
    const idx = targetSide.findIndex(c => c.id === target.id);
    if (idx > -1) targetSide.splice(idx, 1);

    // 3. Purge units belonging to the target nation
    GS.units = GS.units.filter(u => u.sovereignId !== target.id);
    
    // Reset beneficiary IDs for units that were supporting the leaving nation
    GS.units.forEach(u => {
        if (u.beneficiaryId === target.id) u.beneficiaryId = u.sovereignId;
    });

    // 4. Final Sweep: Stabilize land owned by nations no longer in the war
    const combatantIds = new Set(GS.sides.flat().map(c => c.id));
    for (let i = 0; i < GS.worldControlMap.length; i++) {
        if (GS.landMask[i] === 2) {
            const ownerId = GS.worldControlMap[i];
            // If owner is not a combatant AND no one else is currently occupying it, stabilize it
            if (!combatantIds.has(ownerId) && Math.abs(GS.occupationMap[i]) < 0.01) {
                GS.landMask[i] = 1;
                GS.occupationMap[i] = 0;
                GS.primaryOccupierMap[i] = 0;
            }
        }
    }

    // 5. Separate Peace Smoothing Pass - Optimized to avoid GC thrashing
    const smoothingPasses = 2;
    for (let p = 0; p < smoothingPasses; p++) {
        const tempMap = new Int32Array(GS.worldControlMap);
        const uniqueIds = new Int32Array(9); 
        const idCounts = new Int32Array(9);
        
        for (let y = 1; y < GS.gridHeight - 1; y++) {
            const rowIdx = y * GS.gridWidth;
            for (let x = 1; x < GS.gridWidth - 1; x++) {
                const i = rowIdx + x;
                if (GS.landMask[i] !== 1) continue; 
                
                uniqueIds.fill(0);
                idCounts.fill(0);
                let numUnique = 0;

                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nId = GS.worldControlMap[i + dy * GS.gridWidth + dx];
                        if (nId > 0) {
                            let found = false;
                            for (let k = 0; k < numUnique; k++) {
                                if (uniqueIds[k] === nId) {
                                    idCounts[k]++;
                                    found = true;
                                    break;
                                }
                            }
                            if (!found && numUnique < 9) {
                                uniqueIds[numUnique] = nId;
                                idCounts[numUnique] = 1;
                                numUnique++;
                            }
                        }
                    }
                }
                
                let bestId = GS.worldControlMap[i];
                let maxC = 0;
                for (let k = 0; k < numUnique; k++) {
                    if (idCounts[k] > maxC) {
                        maxC = idCounts[k];
                        bestId = uniqueIds[k];
                    }
                }
                if (maxC >= 5) tempMap[i] = bestId;
            }
        }
        GS.worldControlMap.set(tempMap);
    }

    // 6. Update UI and check for total conflict end
    generateProvinces();
    recalculateAllBounds();
    updateSidesUI();
    GS.influenceLayer.render();
    
    const activeSideSet = new Set();
    GS.sides.forEach((side, idx) => {
        if (side.length > 0) activeSideSet.add(idx);
    });

    if (activeSideSet.size < 2) {
        applyTreaty('PEACE_TREATY');
    } else {
        playPeaceSound();
        GS.gameState = 'SIMULATING';
        DOM.statusText.innerText = `${target.name} signed separate peace. Conflict continues.`;
        cancelAnimationFrame(GS.animationFrameId);
        requestAnimationFrame(updateLoop);
    }
}

export function unilateralExitConflict(country, sideIdx) {
    if (sideIdx === -1) return;

    const poleIdx = sideIdx % 2;

    // Redraw borders: Keep all currently occupied land
    for (let i = 0; i < GS.worldControlMap.length; i++) {
        if (GS.landMask[i] !== 2) continue;

        const ownerId = GS.worldControlMap[i];
        const occupierId = GS.primaryOccupierMap[i];
        const occ = GS.occupationMap[i];
        
        // A) If exiting nation is occupying someone else's land, they annex it
        if (occupierId === country.id) {
            const isOccupyingEnemy = (poleIdx === 0) ? (occ > 0.05) : (occ < -0.05);
            if (isOccupyingEnemy) {
                GS.worldControlMap[i] = country.id;
            }
            GS.landMask[i] = 1; // Stabilize
            GS.occupationMap[i] = 0;
            GS.primaryOccupierMap[i] = 0;
        } 
        // B) If someone else is occupying the exiting nation's land, they keep it (unilateral exit logic)
        else if (ownerId === country.id) {
            const isOccupiedByEnemy = (poleIdx === 0) ? (occ < -0.05) : (occ > 0.05);
            if (isOccupiedByEnemy) {
                // If they are exiting, they lose this land to the current occupier
                GS.worldControlMap[i] = occupierId > 0 ? occupierId : ownerId;
            }
            GS.landMask[i] = 1; // Stabilize
            GS.occupationMap[i] = 0;
            GS.primaryOccupierMap[i] = 0;
        }
    }

    // Remove from sides
    const side = GS.sides[sideIdx];
    const idx = side.findIndex(c => c.id === country.id);
    if (idx > -1) side.splice(idx, 1);

    // Purge units
    GS.units = GS.units.filter(u => u.sovereignId !== country.id);
    GS.units.forEach(u => { if (u.beneficiaryId === country.id) u.beneficiaryId = u.sovereignId; });

    // Global cleanup for neutral land that might be stuck in war state
    const combatantIds = new Set(GS.sides.flat().map(c => c.id));
    for (let i = 0; i < GS.worldControlMap.length; i++) {
        if (GS.landMask[i] === 2 && !combatantIds.has(GS.worldControlMap[i]) && Math.abs(GS.occupationMap[i]) < 0.01) {
            GS.landMask[i] = 1;
            GS.occupationMap[i] = 0;
            GS.primaryOccupierMap[i] = 0;
        }
    }

    generateProvinces();
    recalculateAllBounds();
    updateSidesUI();
    GS.influenceLayer.render();

    playPeaceSound();
    DOM.statusText.innerText = `${country.name} has exited the conflict and annexed occupied land.`;

    const activeSideSet = new Set();
    GS.sides.forEach((s, idx) => { if (s.length > 0) activeSideSet.add(idx); });

    if (activeSideSet.size < 2) {
        applyTreaty('PEACE_TREATY');
    }
}

export function recruitNeutralMidWar(id, sideIdx) {
    // 1. Remove from existing side if present (handle mid-war switching)
    let oldSideIdx = -1;
    GS.sides.forEach((side, sIdx) => {
        const idx = side.findIndex(c => c.id === id);
        if (idx > -1) {
            oldSideIdx = sIdx;
            side.splice(idx, 1);
        }
    });

    const meta = GS.countryMetadata.find(m => m && m.id === id);
    if (!meta) return;
    
    const newCountry = {
        id: id,
        name: meta.name,
        color: meta.color,
        role: 'OFFENSE',
        strategy: 'BALANCED',
        buffState: meta.buffState || 'none',
        overlordId: meta.overlordId || null
    };
    
    if (!GS.sides[sideIdx]) GS.sides[sideIdx] = [];
    GS.sides[sideIdx].push(newCountry);
    activateCountryMidWar(newCountry, sideIdx);
    
    updateSidesUI();
    GS.influenceLayer.render();
    
    const sideLabel = String.fromCharCode(65 + sideIdx);
    if (oldSideIdx !== -1) {
        DOM.statusText.innerText = `${newCountry.name} HAS SWITCHED TO SIDE ${sideLabel}`;
    } else {
        DOM.statusText.innerText = `${newCountry.name} HAS DEPLOYED TO SIDE ${sideLabel}`;
    }
    
    // Play sound if possible
    playWarStartSound();
}

export function openReleaseModal(releaserId, sideIdx) {
    const releasables = GS.countryMetadata.filter(m => m && m.releasableBy === releaserId);
    if (releasables.length === 0) return;

    DOM.releasableListContainer.innerHTML = releasables.map(m => `
        <button class="menu-card" style="padding: 10px; width: 100%; text-align: left;" onclick="window.releaseNation(${m.id}, ${releaserId}, ${sideIdx})">
            <img src="${m.flagUrl || ''}" style="width: 30px; height: 18px; object-fit: cover; border: 1px solid #444; margin-right: 10px;">
            <div class="card-body">
                <span class="btn-text" style="font-size: 12px;">${m.name}</span>
            </div>
        </button>
    `).join('');

    DOM.releaseModal.style.display = 'flex';
}

export function setAsReleasable(releasableId, releaserId) {
    const rMeta = GS.countryMetadata.find(m => m && m.id === releasableId);
    const hostMeta = GS.countryMetadata.find(m => m && m.id === releaserId);
    if (!rMeta || !hostMeta) return;

    rMeta.releasableBy = releaserId;
    
    // Capture territory snapshot for future restoration.
    // IMPORTANT: Only touch cells that are currently owned by the releasable.
    // This makes it visually look like the host fully annexed the releasable,
    // and we restore exactly these cells on release.
    const cells = [];
    for (let i = 0; i < GS.worldControlMap.length; i++) {
        if (GS.worldControlMap[i] === releasableId) {
            const y = Math.floor(i / GS.gridWidth);
            const x = i % GS.gridWidth;
            cells.push([x, y]);
            // Hand this land to the host nation for now so it looks annexed
            GS.worldControlMap[i] = releaserId;
        }
    }
    rMeta.savedCells = cells;

    // Remove from active sides
    GS.sides.forEach(side => {
        const idx = side.findIndex(c => c.id === releasableId);
        if (idx > -1) side.splice(idx, 1);
    });

    DOM.statusText.innerText = `${rMeta.name} is now a releasable of ${hostMeta.name}`;
    DOM.countryInspector.style.display = 'none';
    recalculateAllBounds();
    updateSidesUI();
    GS.influenceLayer.render();
}

export function setVassalage(vassalId, overlordId) {
    const vassalMeta = GS.countryMetadata.find(m => m && m.id === vassalId);
    if (!vassalMeta) return;

    // Preserve the original flag the first time this country becomes a puppet
    if (!vassalMeta.baseFlagUrl) {
        vassalMeta.baseFlagUrl = vassalMeta.flagUrl || null;
    }

    vassalMeta.overlordId = overlordId;
    
    // Propagate to sides if active
    GS.sides.flat().filter(Boolean).forEach(c => {
        if (c.id === vassalId) c.overlordId = overlordId;
    });

    const overlordMeta = GS.countryMetadata.find(m => m && m.id === overlordId);
    DOM.statusText.innerText = `${vassalMeta.name} is now a vassal of ${overlordMeta ? overlordMeta.name : 'Unknown'}`;

    // Generate a dynamic half-and-half puppet flag for vassals created after game start
    // (existing historical puppets keep their original flags unless re-vassalized through this function).
    generatePuppetFlag(vassalId, overlordId);

    openInspector(vassalId);
    GS.influenceLayer.render();
}

export function unclaimSelectedCountry() {
    if (GS.editingCountryId <= 0) return;
    
    const meta = GS.countryMetadata.find(m => m && m.id === GS.editingCountryId);
    const name = meta ? meta.name : "Nation";
    
    // Visual confirmation is good for destructive actions
    if (!confirm(`Satellite Directive: Are you sure you want to unclaim all territory for ${name}?`)) return;

    for (let i = 0; i < GS.worldControlMap.length; i++) {
        if (GS.worldControlMap[i] === GS.editingCountryId) {
            GS.worldControlMap[i] = 0;
        }
    }
    
    // Also remove from any active conflict sides
    GS.sides.forEach(side => {
        const idx = side.findIndex(c => c.id === GS.editingCountryId);
        if (idx > -1) side.splice(idx, 1);
    });
    
    updateSidesUI();
    DOM.countryInspector.style.display = 'none';
    GS.editingCountryId = -1;
    recalculateAllBounds();
    GS.influenceLayer.render();
    DOM.statusText.innerText = `UNCLAIMED: ${name} territory has been returned to neutral status.`;
}
