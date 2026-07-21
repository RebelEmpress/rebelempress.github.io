// Extracted from main.js — ui-inspector UI module
import { getCookie } from './utils.js';
import { getTranslation } from './translations.js';
import { BUFF_METADATA } from './config.js';
import { GS } from './state.js';
import * as DOM from './dom.js';
import { openReleaseModal, recruitNeutralMidWar, unilateralExitConflict } from './main.js';

export function openInspector(id) {
    GS.editingCountryId = id;
    const meta = GS.countryMetadata.find(m => m && m.id === id);
    if (!meta) return;

    const isWar = GS.gameState === 'SIMULATING';
    const isNeutral = !GS.sides.flat().some(c => c.id === id);

    // Toggle editor-only fields, but keep the Combat Buff section visible even in war
    const buffSection = document.getElementById('buff-editor-section');
    document.querySelectorAll('#country-inspector .editor-only').forEach(el => {
        if (el === buffSection) return; // handle buff separately
        el.style.display = isWar ? 'none' : 'block';
    });
    if (buffSection) {
        buffSection.style.display = 'block';
    }

    const vassalStatusDisplay = document.getElementById('vassal-status-display');
    if (vassalStatusDisplay) {
        if (meta.overlordId) {
            vassalStatusDisplay.style.display = 'block';
            const oMeta = GS.countryMetadata.find(m => m && m.id === meta.overlordId);
            document.getElementById('overlord-name-disp').innerText = oMeta ? oMeta.name : "Unknown";
        } else {
            vassalStatusDisplay.style.display = 'none';
        }
    }

    const recruitmentDiv = document.getElementById('mid-war-recruitment');
    const vassalizeBtn = document.getElementById('vassalize-btn');
    const exitConflictBtn = document.getElementById('exit-conflict-btn');
    if (recruitmentDiv) {
        if (isWar) {
            const currentSideIdx = GS.sides.findIndex(s => s.some(c => c.id === id));
            recruitmentDiv.style.display = 'block';

            if (exitConflictBtn) {
                if (currentSideIdx !== -1) {
                    exitConflictBtn.style.display = 'block';
                    exitConflictBtn.onclick = () => {
                        const country = GS.sides[currentSideIdx].find(c => c.id === id);
                        if (country) {
                            unilateralExitConflict(country, currentSideIdx);
                            DOM.countryInspector.style.display = 'none';
                        }
                    };
                } else {
                    exitConflictBtn.style.display = 'none';
                }
            }
            const btnContainer = document.getElementById('recruit-sides-btns');
            btnContainer.innerHTML = '';
            
            GS.sides.forEach((side, idx) => {
                const isCurrentSide = currentSideIdx === idx;
                const btn = document.createElement('button');
                btn.className = 'mini-btn';
                const sideLabel = String.fromCharCode(65 + idx);
                btn.innerText = isCurrentSide ? `ON SIDE ${sideLabel}` : `JOIN SIDE ${sideLabel}`;
                btn.style.background = idx % 2 === 0 ? '#ff4757' : '#2e86de';
                btn.style.padding = '8px 12px';
                btn.style.fontSize = '10px';
                btn.style.fontWeight = '900';
                btn.style.opacity = isCurrentSide ? '0.4' : '1';
                btn.disabled = isCurrentSide;
                
                if (!isCurrentSide) {
                    btn.onclick = () => {
                        recruitNeutralMidWar(id, idx);
                        DOM.countryInspector.style.display = 'none';
                    };
                }
                btnContainer.appendChild(btn);
            });
            
            // Vassalization Logic: Check if target can be vassalized
            // Requires enough territory taken by a side
            vassalizeBtn.style.display = 'none';
            const stats = GS.latestCountryStats.get(id);
            if (stats) {
                const initial = meta.initialCells || stats.controlled + 100; // fallback if war just started
                const controlPct = (stats.controlled / initial);
                
                // If more than 50% territory taken, show vassalize button for the leading side
                if (controlPct < 0.5) {
                    vassalizeBtn.style.display = 'block';
                    vassalizeBtn.onclick = () => {
                        // Find the side that occupies the most of this country
                        let bestSideIdx = 0;
                        let maxOcc = 0;
                        const sideOccs = new Array(GS.sides.length).fill(0);
                        
                        // Sample grid to find dominant occupier
                        for(let i=0; i<GS.worldControlMap.length; i += 50) {
                            if (GS.worldControlMap[i] === id && GS.landMask[i] === 2) {
                                const occId = GS.primaryOccupierMap[i];
                                const sIdx = GS.sides.findIndex(s => s.some(c => c.id === occId));
                                if (sIdx !== -1) sideOccs[sIdx]++;
                            }
                        }
                        bestSideIdx = sideOccs.indexOf(Math.max(...sideOccs));
                        const overlord = GS.sides[bestSideIdx][0];
                        if (overlord) {
                            meta.overlordId = overlord.id;
                            recruitNeutralMidWar(id, bestSideIdx);
                            DOM.countryInspector.style.display = 'none';
                        }
                    };
                }
            }
        } else {
            recruitmentDiv.style.display = 'none';
        }
    }

    // Render current allies
    if (DOM.allyList) {
        const allies = Array.isArray(meta.allies) ? meta.allies : [];
        if (!allies.length) {
            DOM.allyList.innerHTML = `<span style="font-size: 10px; color: #666;">No allies set.</span>`;
        } else {
            const items = allies
                .map(aid => GS.countryMetadata[aid - 1])
                .filter(Boolean)
                .map(m => `<div style="font-size:11px; color:#ccc; margin-bottom:2px;">• ${m.name}</div>`)
                .join('');
            DOM.allyList.innerHTML = items;
        }
    }

    const releasables = GS.countryMetadata.filter(m => m && m.releasableBy === id);
    const releaseContainer = document.getElementById('inspector-release-container');
    const releaseBtn = document.getElementById('inspect-release-btn');
    if (releaseContainer && releaseBtn) {
        if (releasables.length > 0) {
            releaseContainer.style.display = 'block';
            releaseBtn.onclick = () => {
                const currentSideIdx = GS.sides.findIndex(s => s.some(c => c.id === id));
                openReleaseModal(id, currentSideIdx);
            };
        } else {
            releaseContainer.style.display = 'none';
        }
    }

    const inspectorDisplayName = getTranslation(meta.name || meta.feature?.properties?.NAME || "Unnamed Land", getCookie('mw_lang') || 'en', 'NATIONS');
    DOM.inspectNameInput.value = inspectorDisplayName;
    DOM.inspectNameInput.disabled = isWar;
    DOM.inspectColorSwatch.style.backgroundColor = meta.color;
    
    // Initialize Buff button state for this country (visible + hidden)
    if (DOM.inspectBuffBtn) {
        const currentBuff = meta.buffState || 'none';
        const currentHidden = meta.hiddenBuffState || 'none';
        const bMeta = BUFF_METADATA[currentBuff] || BUFF_METADATA['none'];
        const hMeta = BUFF_METADATA[currentHidden] || BUFF_METADATA['none'];
        const hiddenLabel = currentHidden !== 'none'
            ? `<div style="margin-top:4px; font-size:9px; color:#f1c40f; text-transform:uppercase; letter-spacing:0.5px;">INVISIBLE BUFF: ${hMeta.label}</div>`
            : '';
        DOM.inspectBuffBtn.innerHTML = `
            <span class="buff-arrow" data-dir="-1" style="font-size:11px; margin-right:4px;">◀</span>
            <span class="buff-label">BUFF: ${bMeta.label}</span>
            <span class="buff-arrow" data-dir="1" style="font-size:11px; margin-left:4px;">▶</span>
            ${hiddenLabel}
        `;
        DOM.inspectBuffBtn.style.background = bMeta.color;
        DOM.inspectBuffBtn.style.color = bMeta.textColor;
    }
    
    // Reset file input and update flag preview
    DOM.inspectFlagInput.value = '';
    if (meta.flagUrl) {
        DOM.inspectFlagPreview.src = meta.flagUrl;
        DOM.inspectFlagPreview.style.display = 'block';
    } else {
        DOM.inspectFlagPreview.style.display = 'none';
    }
    
    // Convert current color to Hex for the picker
    const rgba = meta.rgba;
    const toHex = (n) => n.toString(16).padStart(2, '0');
    const hex = `#${toHex(rgba[0])}${toHex(rgba[1])}${toHex(rgba[2])}`;
    DOM.inspectColorPicker.value = hex;

    DOM.countryInspector.style.display = 'block';
    GS.influenceLayer.render();
}
