// Extracted from main.js — ui-import-country UI module
import { parseColorToRGBA } from './utils.js';
import { CONFIG } from './config.js';
import { getProvinceId } from './geometry.js';
import { GS } from './state.js';
import * as DOM from './dom.js';
import { recalculateAllBounds } from './main.js';

export function renderImportCountryCards(filterText = '') {
    if (!DOM.importCountryCardList) return;
    const ft = (filterText || '').toLowerCase();
    const filtered = GS.importScenarioCountriesCache.filter(c =>
        !ft || c.name.toLowerCase().includes(ft)
    );

    if (!filtered.length) {
        DOM.importCountryCardList.innerHTML = `
            <div style="font-size:11px; color:#777; text-align:center; padding:10px;">
                No countries match that search.
            </div>
        `;
        return;
    }

    DOM.importCountryCardList.innerHTML = filtered.map(c => {
        const selectedClass = (c.id === GS.selectedImportCountryId) ? ' selected' : '';
        const tilesLabel = c.tiles.toLocaleString();
        const flagHtml = c.flagUrl
            ? `<img src="${c.flagUrl}" class="import-country-flag">`
            : `<div class="import-country-flag" style="background:#000;"></div>`;
        return `
            <div class="import-country-card${selectedClass}" data-country-id="${c.id}">
                ${flagHtml}
                <div style="flex:1; min-width:0;">
                    <div class="import-country-name">${c.name}</div>
                    <div class="import-country-tiles">${tilesLabel} tiles</div>
                </div>
            </div>
        `;
    }).join('');

    // Wire selection handlers
    DOM.importCountryCardList.querySelectorAll('.import-country-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = parseInt(card.getAttribute('data-country-id') || '0', 10);
            if (!id) return;
            GS.selectedImportCountryId = id;
            DOM.importCountryCardList.querySelectorAll('.import-country-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });
}

export async function loadScenarioForCountryImportFromBlob(blob) {
    try {
        const text = await blob.text();
        const data = JSON.parse(text);
        if (!data || !data.metadata || !data.mapData) {
            throw new Error("Invalid preset structure");
        }
        GS.importScenarioBuffer = {
            metadata: data.metadata,
            mapData: data.mapData,
            gridRes: data.gridRes || CONFIG.GRID_RES
        };
        populateImportCountrySelect();
        // Restore the last selected scenario key in the dropdown if we have one
        if (DOM.importScenarioSelect && GS.lastImportScenarioKey) {
            DOM.importScenarioSelect.value = GS.lastImportScenarioKey;
        }
    } catch (e) {
        console.error("Import scenario load failed:", e);
        alert("Could not read that scenario file. Make sure it is a preset exported from this engine.");
        GS.importScenarioBuffer = null;
        GS.selectedImportCountryId = null;
        if (DOM.importCountrySearch) {
            DOM.importCountrySearch.value = '';
            DOM.importCountrySearch.disabled = true;
        }
        if (DOM.importCountryCardList) {
            DOM.importCountryCardList.innerHTML = `
                <div style="font-size:11px; color:#777; text-align:center; padding:10px;">
                    Failed to load scenario
                </div>
            `;
        }
    }
}

export async function loadScenarioForCountryImportFromUrl(url) {
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        const blob = await resp.blob();
        await loadScenarioForCountryImportFromBlob(blob);
    } catch (e) {
        console.error("Import built‑in scenario load failed:", e);
        alert("Failed to load built‑in scenario for import.");
    }
}

export function populateImportCountrySelect() {
    if (!GS.importScenarioBuffer || !DOM.importCountryCardList || !DOM.importCountrySearch) return;
    const metaList = GS.importScenarioBuffer.metadata || [];
    if (!metaList.length) {
        DOM.importCountryCardList.innerHTML = `
            <div style="font-size:11px; color:#777; text-align:center; padding:10px;">
                No countries found in scenario
            </div>
        `;
        DOM.importCountrySearch.disabled = true;
        GS.selectedImportCountryId = null;
        GS.importScenarioCountriesCache = [];
        return;
    }

    // Count tiles per country id in the source scenario for a useful size hint
    const mapData = GS.importScenarioBuffer.mapData || [];
    const tileCounts = new Map();
    mapData.forEach(([idx, val]) => {
        if (!val) return;
        tileCounts.set(val, (tileCounts.get(val) || 0) + 1);
    });

    const sortedMeta = metaList
        .filter(m => m && m.id)
        .map(m => {
            const tiles = tileCounts.get(m.id) || 0;
            // Try to find a flagUrl from metadata if present
            const flagUrl = m.flagUrl || null;
            return {
                id: m.id,
                name: m.name || `Country ${m.id}`,
                tiles,
                flagUrl
            };
        })
        .filter(m => m.tiles > 0)
        .sort((a, b) => b.tiles - a.tiles || a.name.localeCompare(b.name));

    if (!sortedMeta.length) {
        DOM.importCountryCardList.innerHTML = `
            <div style="font-size:11px; color:#777; text-align:center; padding:10px;">
                No countries with territory found
            </div>
        `;
        DOM.importCountrySearch.disabled = true;
        GS.selectedImportCountryId = null;
        GS.importScenarioCountriesCache = [];
        return;
    }

    GS.importScenarioCountriesCache = sortedMeta;
    GS.selectedImportCountryId = null;
    DOM.importCountrySearch.disabled = false;
    DOM.importCountrySearch.value = '';
    renderImportCountryCards('');
}

export function openImportCountryModal() {
    if (!DOM.importCountryModal) return;
    if (!(GS.gameMode === 'EDITOR' || GS.godModeActive)) {
        alert("You can only import from scenario while in the editor or God Mode.");
        return;
    }

    // If we already have a loaded source scenario, reuse it and its country list
    if (GS.importScenarioBuffer && GS.importScenarioCountriesCache.length > 0) {
        DOM.importCountryModal.style.display = 'flex';
        if (DOM.importScenarioSelect && GS.lastImportScenarioKey) {
            DOM.importScenarioSelect.value = GS.lastImportScenarioKey;
        }
        if (DOM.importScenarioFileInput) {
            DOM.importScenarioFileInput.style.display = 'none';
        }
        if (DOM.importCountrySearch) {
            // Keep any existing search text; just ensure the field is enabled
            DOM.importCountrySearch.disabled = false;
        }
        // Re-render cards from cache (filtered by current search if any)
        renderImportCountryCards(DOM.importCountrySearch ? DOM.importCountrySearch.value : '');
        return;
    }

    // Fresh open with no cached source scenario
    GS.importScenarioBuffer = null;
    GS.selectedImportCountryId = null;
    GS.importScenarioCountriesCache = [];
    if (DOM.importScenarioSelect) DOM.importScenarioSelect.value = '';
    if (DOM.importScenarioFileInput) {
        DOM.importScenarioFileInput.value = '';
        DOM.importScenarioFileInput.style.display = 'none';
    }
    if (DOM.importCountrySearch) {
        DOM.importCountrySearch.value = '';
        DOM.importCountrySearch.disabled = true;
    }
    if (DOM.importCountryCardList) {
        DOM.importCountryCardList.innerHTML = `
            <div style="font-size:11px; color:#777; text-align:center; padding:10px;">
                Choose a source scenario first
            </div>
        `;
    }
    DOM.importCountryModal.style.display = 'flex';
}

export function importSingleCountryFromScenario(source, sourceCountryId) {
    if (!GS.worldControlMap || !GS.countryMetadata) return;

    const metaList = source.metadata || [];
    const sourceMeta = metaList.find(m => m && m.id === sourceCountryId);
    if (!sourceMeta) {
        alert("Country not found in source scenario.");
        return;
    }

    // Allocate a fresh ID in the current scenario
    const maxId = GS.countryMetadata.reduce((max, m) => m ? Math.max(max, m.id) : max, 0);
    const newId = maxId + 1;

    // Build new metadata entry
    const newMeta = {
        id: newId,
        name: sourceMeta.name || `Imported ${sourceCountryId}`,
        color: sourceMeta.color || 'rgba(150,150,150,0.5)',
        rgba: parseColorToRGBA(sourceMeta.color || 'rgba(150,150,150,0.5)'),
        isCustom: true,
        flagUrl: sourceMeta.flagUrl || null,
        role: sourceMeta.role || 'OFFENSE',
        overlordId: sourceMeta.overlordId || null,
        bounds: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    };
    if (newMeta.flagUrl) {
        newMeta.tempFlag = new Image();
        newMeta.tempFlag.crossOrigin = "anonymous";
        newMeta.tempFlag.onload = () => GS.influenceLayer && GS.influenceLayer.render();
        newMeta.tempFlag.src = newMeta.flagUrl;
    }
    GS.countryMetadata[newId - 1] = newMeta;

    const sourceRes = source.gridRes || CONFIG.GRID_RES;
    const targetRes = CONFIG.GRID_RES;
    const sourceGridWidth = Math.ceil(360 / sourceRes);

    const mapData = source.mapData || [];
    let paintedAny = false;

    // Map each source cell belonging to the selected country into our grid
    for (let i = 0; i < mapData.length; i++) {
        const [idx, val] = mapData[i];
        if (val !== sourceCountryId) continue;

        const sy = Math.floor(idx / sourceGridWidth);
        const sx = idx % sourceGridWidth;
        const baseLat = (sy * sourceRes) - 90;
        const baseLng = (sx * sourceRes) - 180;

        if (sourceRes === targetRes) {
            const gx = sx;
            const gy = sy;
            const tIdx = gy * GS.gridWidth + gx;
            if (tIdx >= 0 && tIdx < GS.worldControlMap.length && GS.landMask[tIdx] > 0) {
                GS.worldControlMap[tIdx] = newId;
                GS.deJureMap[tIdx] = newId;
                GS.provinceMap[tIdx] = getProvinceId(gx, gy, newId);
                newMeta.bounds.minX = Math.min(newMeta.bounds.minX, gx);
                newMeta.bounds.maxX = Math.max(newMeta.bounds.maxX, gx);
                newMeta.bounds.minY = Math.min(newMeta.bounds.minY, gy);
                newMeta.bounds.maxY = Math.max(newMeta.bounds.maxY, gy);
                paintedAny = true;
            }
        } else {
            // Convert source cell area into one or more target cells
            const xStart = Math.floor((baseLng + 180) / targetRes);
            const xEnd = Math.floor((baseLng + sourceRes + 180 - 0.0001) / targetRes);
            const yStart = Math.floor((baseLat + 90) / targetRes);
            const yEnd = Math.floor((baseLat + sourceRes + 90 - 0.0001) / targetRes);
            for (let gy = yStart; gy <= yEnd; gy++) {
                if (gy < 0 || gy >= GS.gridHeight) continue;
                const rowOffset = gy * GS.gridWidth;
                for (let gx = xStart; gx <= xEnd; gx++) {
                    if (gx < 0 || gx >= GS.gridWidth) continue;
                    const tIdx = rowOffset + gx;
                    GS.worldControlMap[tIdx] = newId;
                    GS.deJureMap[tIdx] = newId;
                    GS.provinceMap[tIdx] = getProvinceId(gx, gy, newId);
                    GS.landMask[tIdx] = GS.landMask[tIdx] || 1;
                    newMeta.bounds.minX = Math.min(newMeta.bounds.minX, gx);
                    newMeta.bounds.maxX = Math.max(newMeta.bounds.maxX, gx);
                    newMeta.bounds.minY = Math.min(newMeta.bounds.minY, gy);
                    newMeta.bounds.maxY = Math.max(newMeta.bounds.maxY, gy);
                    paintedAny = true;
                }
            }
        }
    }

    if (!paintedAny) {
        alert("No territory for that country was found in the source scenario at this resolution.");
        return;
    }

    recalculateAllBounds();
    GS.influenceLayer.render();
    DOM.statusText.innerText = `Imported ${newMeta.name} from scenario into this map.`;
}
