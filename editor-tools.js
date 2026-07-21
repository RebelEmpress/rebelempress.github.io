// Engine module extracted from main.js — editor-tools
import L from 'leaflet';
import { parseColorToRGBA } from './utils.js';
import { CONFIG } from './config.js';
import { getProvinceId, isPointInFeature } from './geometry.js';
import { GS } from './state.js';
import * as DOM from './dom.js';
import { loadingStatus, map } from './main.js';
import { getGridIndex, isInsideWorldBoxLatLng, recalculateAllBounds } from './map-geo.js';
import { openInspector } from './ui-inspector.js';
import { recruitNeutralMidWar } from './war-diplomacy.js';

export function placeDivisionAt(latlng, sovereignId) {
    let sideIdx = GS.sides.findIndex(s => s.some(c => c.id === sovereignId));
    let team = 'A';
    
    // If country not in a side, we need to assign it to one or create one if simulating
    if (sideIdx === -1) {
        if (GS.gameState === 'SIMULATING' || GS.godModeActive) {
            // Assign to first available side or default side A polarity
            sideIdx = 0;
            recruitNeutralMidWar(sovereignId, sideIdx);
        } else {
            DOM.statusText.innerText = "Nation must be assigned to a side to place units.";
            return;
        }
    }
    
    team = sideIdx % 2 === 0 ? 'A' : 'B';
    const idx = getGridIndex(latlng.lat, latlng.lng);
    const isMountainCell = idx !== -1 && GS.terrainMask && GS.terrainMask[idx] > 0.35;
    const isAlpen = isMountainCell && Math.random() < 0.4;

    GS.units.push({
        id: Math.random(),
        lat: latlng.lat,
        lng: latlng.lng,
        team,
        sideIndex: sideIdx,
        sovereignId: sovereignId,
        beneficiaryId: sovereignId,
        isAlpenjager: !!isAlpen,
        health: CONFIG.UNIT_HEALTH * (isAlpen ? CONFIG.ALPEN_HEALTH_MULT : 1),
        lastAttack: 0,
        deployTicks: 10 // Quick deploy for manual placement
    });

    if (team === 'A') GS.teamASoldiers += GS.soldiersPerUnitA;
    else GS.teamBSoldiers += GS.soldiersPerUnitB;

    DOM.statusText.innerText = `MANUAL DEPLOYMENT: Division placed for ${GS.countryMetadata[sovereignId-1]?.name || 'Nation'}`;
    GS.influenceLayer.render();
}

export async function placeNewCountry(latlng) {
    // Do not place new countries outside the world-size box
    if (!isInsideWorldBoxLatLng(latlng.lat, latlng.lng)) return;
    const idx = getGridIndex(latlng.lat, latlng.lng);
    if (idx === -1) return;

    const y = Math.floor(idx / GS.gridWidth);
    const x = idx % GS.gridWidth;

    const maxId = GS.countryMetadata.reduce((max, m) => m ? Math.max(max, m.id) : max, 0);
    const id = maxId + 1;
    const newMeta = {
        id: id,
        name: GS.customCountryData.name,
        color: GS.customCountryData.color,
        rgba: parseColorToRGBA(GS.customCountryData.color),
        isCustom: true,
        flagUrl: GS.customCountryData.flagUrl,
        bounds: { minX: x, maxX: x, minY: y, maxY: y }
    };
    
    // Ensure the array has enough space if there were gaps
    if (id > GS.countryMetadata.length) {
        GS.countryMetadata.push(newMeta);
    } else {
        GS.countryMetadata[id - 1] = newMeta;
    }
    
    // Assign initial point
    GS.worldControlMap[idx] = id;
    GS.deJureMap[idx] = id;
    GS.provinceMap[idx] = getProvinceId(x, y, id);
    // Mandatory land conversion at capital point
    GS.landMask[idx] = 1;
    
    GS.gameState = 'EDITOR_ACTIVE';
    DOM.statusText.innerText = `Nation Established: ${newMeta.name}`;
    map.getContainer().classList.remove('painting-cursor');
    
    recalculateAllBounds();
    openInspector(id);
    GS.influenceLayer.render();
}

export function fillTerrainAt(latlng) {
    // Do not start terrain fill outside the configured world-size box
    if (!isInsideWorldBoxLatLng(latlng.lat, latlng.lng)) return;
    const startIdx = getGridIndex(latlng.lat, latlng.lng);
    if (startIdx === -1) return;

    const replacementType = DOM.terrainTypeSelect.value;
    const res = CONFIG.GRID_RES;
    
    // Determine source state at click point
    const sourceIsLand = GS.landMask[startIdx] > 0;
    const sourceIsDesert = GS.biomeMask[startIdx] === 1;
    const sourceIsMtn = GS.terrainMask[startIdx] > 0.1;
    const sourceIsOcean = GS.landMask[startIdx] === 0;

    // Determine what we are trying to achieve
    const isTargetingLand = replacementType === 'LAND';
    const isTargetingDesert = replacementType === 'DESERT';
    const isTargetingMtn = replacementType === 'MOUNTAIN';
    const isTargetingOcean = replacementType === 'OCEAN';

    // Prevent redundant fills
    if (isTargetingLand && sourceIsLand && !sourceIsDesert && !sourceIsMtn) return;
    if (isTargetingDesert && sourceIsDesert) return;
    if (isTargetingMtn && sourceIsMtn) return;
    if (isTargetingOcean && sourceIsOcean) return;

    loadingStatus.innerText = "Filling Terrain...";
    DOM.loadingOverlay.style.display = 'flex';

    setTimeout(() => {
        const queue = [startIdx];
        const visited = new Uint8Array(GS.gridWidth * GS.gridHeight);
        visited[startIdx] = 1;

        while (queue.length > 0) {
            const idx = queue.pop();

            const y = Math.floor(idx / GS.gridWidth);
            const x = idx % GS.gridWidth;
            const cellLat = (y + 0.5) * res - 90;
            const cellLng = (x + 0.5) * res - 180;

            // Never modify terrain outside the world-size box
            if (!isInsideWorldBoxLatLng(cellLat, cellLng)) continue;
            
            // Apply replacement
            if (isTargetingOcean) {
                GS.landMask[idx] = 0;
                GS.worldControlMap[idx] = 0;
                GS.biomeMask[idx] = 0;
                GS.terrainMask[idx] = 0;
            } else if (isTargetingLand) {
                GS.landMask[idx] = 1;
                GS.biomeMask[idx] = 0;
                GS.terrainMask[idx] = 0;
            } else if (isTargetingDesert) {
                // Desert/Mtn fill only happens on land
                if (GS.landMask[idx] > 0) {
                    GS.biomeMask[idx] = 1;
                    GS.terrainMask[idx] = 0;
                }
            } else if (isTargetingMtn) {
                if (GS.landMask[idx] > 0) {
                    GS.terrainMask[idx] = 0.75;
                    GS.biomeMask[idx] = 0;
                }
            }

            const neighbors = [];
            if (y > 0) neighbors.push(idx - GS.gridWidth);
            if (y < GS.gridHeight - 1) neighbors.push(idx + GS.gridWidth);
            if (x > 0) neighbors.push(idx - 1);
            if (x < GS.gridWidth - 1) neighbors.push(idx + 1);
            if (x === 0) neighbors.push(idx + (GS.gridWidth - 1));
            if (x === GS.gridWidth - 1) neighbors.push(idx - (GS.gridWidth - 1));

            for (const nIdx of neighbors) {
                if (!visited[nIdx]) {
                    const ny = Math.floor(nIdx / GS.gridWidth);
                    const nx = nIdx % GS.gridWidth;
                    const nLat = (ny + 0.5) * res - 90;
                    const nLng = (nx + 0.5) * res - 180;

                    // Do not propagate fill outside the world-size box
                    if (!isInsideWorldBoxLatLng(nLat, nLng)) continue;

                    const nIsLand = GS.landMask[nIdx] > 0;
                    const nIsDesert = GS.biomeMask[nIdx] === 1;
                    const nIsMtn = GS.terrainMask[nIdx] > 0.1;
                    const nIsOcean = GS.landMask[nIdx] === 0;

                    // Match criteria: must have exact same terrain profile as start point
                    if (nIsLand === sourceIsLand && nIsDesert === sourceIsDesert && 
                        nIsMtn === sourceIsMtn && nIsOcean === sourceIsOcean) {
                        visited[nIdx] = 1;
                        queue.push(nIdx);
                    }
                }
            }
        }

        recalculateAllBounds();
        DOM.loadingOverlay.style.display = 'none';
        GS.influenceLayer.render();
    }, 10);
}

export function fillAt(latlng) {
    const isUnclaiming = GS.gameState === 'EDITOR_UNCLAIMING';
    if (!isUnclaiming && GS.editingCountryId <= 0) return;
    // Do not start fill outside the world-size box
    if (!isInsideWorldBoxLatLng(latlng.lat, latlng.lng)) return;
    const startIdx = getGridIndex(latlng.lat, latlng.lng);
    if (startIdx === -1 || GS.landMask[startIdx] === 0) return;

    const targetId = GS.worldControlMap[startIdx];
    const replacementId = isUnclaiming ? 0 : GS.editingCountryId;
    if (!isUnclaiming && targetId === replacementId) return;

    loadingStatus.innerText = isUnclaiming ? "Unclaiming Territory..." : "Filling Region...";
    DOM.loadingOverlay.style.display = 'flex';

    const res = CONFIG.GRID_RES;

    // Use a small timeout to let the UI show the loader
    setTimeout(() => {
        const queue = [startIdx];
        const visited = new Uint8Array(GS.gridWidth * GS.gridHeight);
        visited[startIdx] = 1;

        while (queue.length > 0) {
            const idx = queue.pop();

            const y = Math.floor(idx / GS.gridWidth);
            const x = idx % GS.gridWidth;
            const cellLat = (y + 0.5) * res - 90;
            const cellLng = (x + 0.5) * res - 180;

            // Never modify ownership outside the world-size box
            if (!isInsideWorldBoxLatLng(cellLat, cellLng)) continue;

            GS.worldControlMap[idx] = replacementId;
            
            // Re-sync province ID to the new country owner to prevent border-crossing provinces
            GS.provinceMap[idx] = getProvinceId(x, y, replacementId);

            // Neighbors: N, S, E, W
            const neighbors = [];
            if (y > 0) neighbors.push(idx - GS.gridWidth);
            if (y < GS.gridHeight - 1) neighbors.push(idx + GS.gridWidth);
            if (x > 0) neighbors.push(idx - 1);
            if (x < GS.gridWidth - 1) neighbors.push(idx + 1);
            
            // Handle world wrapping for East/West if necessary (optional but good for world maps)
            if (x === 0) neighbors.push(idx + (GS.gridWidth - 1));
            if (x === GS.gridWidth - 1) neighbors.push(idx - (GS.gridWidth - 1));

            for (const nIdx of neighbors) {
                if (!visited[nIdx] && GS.landMask[nIdx] > 0 && GS.worldControlMap[nIdx] === targetId) {
                    const ny = Math.floor(nIdx / GS.gridWidth);
                    const nx = nIdx % GS.gridWidth;
                    const nLat = (ny + 0.5) * res - 90;
                    const nLng = (nx + 0.5) * res - 180;

                    // Do not flood-fill outside the world-size box
                    if (!isInsideWorldBoxLatLng(nLat, nLng)) continue;

                    visited[nIdx] = 1;
                    queue.push(nIdx);
                }
            }
        }

        recalculateAllBounds();
        DOM.loadingOverlay.style.display = 'none';
        GS.influenceLayer.render();
    }, 10);
}

export function applyPaintAt(latlng) {
    const isUnclaiming = GS.gameState === 'EDITOR_UNCLAIMING';
    const isTerrain = GS.gameState === 'EDITOR_PAINTING_TERRAIN';
    if (!isUnclaiming && !isTerrain && GS.editingCountryId <= 0) return false;
    
    // Safety check for grid initialization
    if (!GS.worldControlMap) return false;

    // Do not paint outside the world-size box
    if (!isInsideWorldBoxLatLng(latlng.lat, latlng.lng)) return false;

    const radius = GS.brushSize; 
    const res = CONFIG.GRID_RES;
    
    const startLat = Math.max(0, Math.floor((latlng.lat - radius + 90) / res));
    const endLat = Math.min(GS.gridHeight - 1, Math.ceil((latlng.lat + radius + 90) / res));
    const startLng = Math.max(0, Math.floor((latlng.lng - radius + 180) / res));
    const endLng = Math.min(GS.gridWidth - 1, Math.ceil((latlng.lng + radius + 180) / res));

    let mapChanged = false;
    for (let y = startLat; y <= endLat; y++) {
        const rowOffset = y * GS.gridWidth;
        for (let x = startLng; x <= endLng; x++) {
            const idx = rowOffset + x;
            if (idx < 0 || idx >= GS.worldControlMap.length) continue;
            
            const cellCenterLat = (y + 0.5) * res - 90;
            const cellCenterLng = (x + 0.5) * res - 180;

            // Never paint or terrain-edit outside the world-size box
            if (!isInsideWorldBoxLatLng(cellCenterLat, cellCenterLng)) continue;

            // Masking logic: If a mask is active, only paint on pixels that match the mask ID
            if (GS.paintMaskId !== -1 && GS.worldControlMap[idx] !== GS.paintMaskId) continue;

            // Global Wrap Support for distance calculation
            let dlng = latlng.lng - cellCenterLng;
            if (dlng > 180) dlng -= 360;
            if (dlng < -180) dlng += 360;
            
            const dSq = (latlng.lat - cellCenterLat)**2 + dlng**2;
            
            if (dSq < radius * radius) {
                if (isUnclaiming) {
                    if (GS.landMask[idx] > 0 && GS.worldControlMap[idx] !== 0) {
                        GS.worldControlMap[idx] = 0;
                        GS.provinceMap[idx] = getProvinceId(x, y, 0);
                        mapChanged = true;
                    }
                } else if (isTerrain) {
                    const type = DOM.terrainTypeSelect.value;
                    if (type === 'LAND') {
                        if (GS.landMask[idx] === 0 || GS.biomeMask[idx] !== 0 || GS.terrainMask[idx] !== 0) {
                            GS.landMask[idx] = 1;
                            GS.biomeMask[idx] = 0;
                            GS.terrainMask[idx] = 0;
                            mapChanged = true;
                        }
                    } else if (type === 'DESERT') {
                        // Only works on existing land; does not create new land from ocean
                        if (GS.landMask[idx] > 0 && GS.biomeMask[idx] !== 1) {
                            GS.biomeMask[idx] = 1;
                            GS.terrainMask[idx] = 0;
                            mapChanged = true;
                        }
                    } else if (type === 'MOUNTAIN') {
                        if (GS.landMask[idx] > 0 && GS.terrainMask[idx] < 0.7) {
                            GS.terrainMask[idx] = 0.75;
                            GS.biomeMask[idx] = 0;
                            mapChanged = true;
                        }
                    } else { // OCEAN
                        if (GS.landMask[idx] !== 0) {
                            GS.landMask[idx] = 0;
                            GS.worldControlMap[idx] = 0;
                            GS.biomeMask[idx] = 0;
                            mapChanged = true;
                        }
                    }
                } else {
                    if (GS.landMask[idx] > 0 && GS.worldControlMap[idx] !== GS.editingCountryId) {
                        GS.worldControlMap[idx] = GS.editingCountryId;
                        GS.deJureMap[idx] = GS.editingCountryId;
                        GS.provinceMap[idx] = getProvinceId(x, y, GS.editingCountryId);
                        
                        const meta = GS.countryMetadata[GS.editingCountryId - 1];
                        if (meta) {
                            if (!meta.bounds) meta.bounds = { minX: x, maxX: x, minY: y, maxY: y };
                            meta.bounds.minX = Math.min(meta.bounds.minX, x);
                            meta.bounds.maxX = Math.max(meta.bounds.maxX, x);
                            meta.bounds.minY = Math.min(meta.bounds.minY, y);
                            meta.bounds.maxY = Math.max(meta.bounds.maxY, y);
                        }
                        mapChanged = true;
                    }
                }
            }
        }
    }
    return mapChanged;
}

export function paintAt(latlng) {
    if (applyPaintAt(latlng)) {
        // Force a render refresh to ensure the canvas visually updates while dragging
        GS.influenceLayer._forceRender = true;
        GS.influenceLayer.render();
    }
}

export async function annexFeatureToCountry(feature, countryId) {
    if (!feature || countryId <= 0) return;

    loadingStatus.innerText = `Annexing ${feature.properties.NAME || feature.properties.name || 'Region'}...`;
    DOM.loadingOverlay.style.display = 'flex';
    
    // Brief timeout to let UI update
    await new Promise(r => setTimeout(r, 50));

    const bounds = L.geoJSON(feature).getBounds();
    const res = CONFIG.GRID_RES;
    const sLat = Math.max(0, Math.floor((bounds.getSouth() + 90) / res));
    const eLat = Math.min(GS.gridHeight - 1, Math.ceil((bounds.getNorth() + 90) / res));
    const sLng = Math.max(0, Math.floor((bounds.getWest() + 180) / res));
    const eLng = Math.min(GS.gridWidth - 1, Math.ceil((bounds.getEast() + 180) / res));

    for (let y = sLat; y <= eLat; y++) {
        for (let x = sLng; x <= eLng; x++) {
            const lat = (y * res) - 90 + (res * 0.5);
            const lng = (x * res) - 180 + (res * 0.5);
            if (isPointInFeature(lat, lng, feature)) {
                const idx = y * GS.gridWidth + x;
                // Add this land to the country's world control map
                GS.worldControlMap[idx] = countryId;
                // Sync province ID immediately
                GS.provinceMap[idx] = getProvinceId(x, y, countryId);
                
                const meta = GS.countryMetadata[countryId - 1];
                if (meta) {
                    if (!meta.bounds) meta.bounds = { minX: x, maxX: x, minY: y, maxY: y };
                    meta.bounds.minX = Math.min(meta.bounds.minX, x);
                    meta.bounds.maxX = Math.max(meta.bounds.maxX, x);
                    meta.bounds.minY = Math.min(meta.bounds.minY, y);
                    meta.bounds.maxY = Math.max(meta.bounds.maxY, y);
                }
                // Ensure it's marked as land
                if (GS.landMask[idx] === 0) GS.landMask[idx] = 1;
            }
        }
    }

    DOM.loadingOverlay.style.display = 'none';
    GS.influenceLayer.render();
}

export function clearRefHandles() {
    GS.refHandles.forEach(h => map.removeLayer(h));
    GS.refHandles = [];
}

export function updateRefHandles() {
    clearRefHandles();
    if (!GS.referenceOverlay || !GS.referenceImageUrl) return;

    const bounds = GS.referenceOverlay.getBounds();
    const nw = bounds.getNorthWest();
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const se = bounds.getSouthEast();
    const center = bounds.getCenter();

    const handleIcon = L.divIcon({
        className: 'ref-handle',
        html: '<div style="width:14px; height:14px; background:#27ae60; border:2px solid #fff; border-radius:50%; box-shadow:0 0 8px rgba(0,0,0,0.6);"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });

    const centerHandleIcon = L.divIcon({
        className: 'ref-handle-center',
        html: '<div style="width:20px; height:20px; background:#2e86de; border:2px solid #fff; border-radius:50%; box-shadow:0 0 10px rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; color:white; font-size:12px; font-weight:bold;">✥</div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    // 1. Center Handle (Move)
    const mCenter = L.marker(center, { icon: centerHandleIcon, draggable: true }).addTo(map);
    mCenter.on('dragstart', () => {
        // Disable map dragging while manipulating the reference image center handle
        map.dragging.disable();
    });
    mCenter.on('drag', (e) => {
        const newCenter = e.target.getLatLng();
        const dLat = newCenter.lat - center.lat;
        const dLng = newCenter.lng - center.lng;
        const newBounds = [
            [nw.lat + dLat, nw.lng + dLng],
            [se.lat + dLat, se.lng + dLng]
        ];
        GS.referenceOverlay.setBounds(newBounds);
    });
    mCenter.on('dragend', (e) => {
        map.dragging.enable();
        updateRefHandles(e);
    });
    GS.refHandles.push(mCenter);

    // 2. Corner Handles (Resize)
    const corners = [
        { pos: nw, name: 'nw' },
        { pos: ne, name: 'ne' },
        { pos: sw, name: 'sw' },
        { pos: se, name: 'se' }
    ];

    corners.forEach(c => {
        const marker = L.marker(c.pos, { icon: handleIcon, draggable: true }).addTo(map);
        marker.on('dragstart', () => {
            // Disable map dragging while resizing the reference image with a corner handle
            map.dragging.disable();
        });
        marker.on('drag', (e) => {
            const newPos = e.target.getLatLng();
            let newBounds;
            if (c.name === 'nw') newBounds = L.latLngBounds(newPos, se);
            else if (c.name === 'ne') newBounds = L.latLngBounds(newPos, sw);
            else if (c.name === 'sw') newBounds = L.latLngBounds(newPos, ne);
            else if (c.name === 'se') newBounds = L.latLngBounds(newPos, nw);
            
            if (newBounds) GS.referenceOverlay.setBounds(newBounds);
        });
        marker.on('dragend', (e) => {
            // Re-enable map dragging once the handle drag is finished
            map.dragging.enable();
            updateRefHandles(e);
        });
        GS.refHandles.push(marker);
    });
}

export function updateEditorToolPage(page) {
    // Page 1: Scenario-level tools
    const page1Ids = [
        'editor-create-btn',
        'editor-test-btn',
        'editor-update-btn',
        'editor-save-btn',
        'editor-load-btn',
        'editor-share-btn',
        'editor-hub-btn'
    ];

    // Page 2: Library / country / ZIP tools
    const page2Ids = [
        'editor-library-btn',
        'editor-flag-library-btn',
        'editor-save-country-btn',
        'editor-load-country-btn',
        'editor-save-multi-btn',
        'editor-save-all-zip-btn',
        'editor-load-zip-btn',
        'editor-import-country-from-scenario-btn'
    ];

    // Page 3: Map painting / Unit tools
    const page3Ids = [
        'editor-paint-btn',
        'editor-fill-btn',
        'editor-unclaim-btn',
        'editor-terrain-btn',
        'editor-place-division-btn',
        'brush-controls',
        'terrain-controls'
    ];

    // Page 4: City tools
    const page4Ids = [
        'editor-city-new-btn',
        'editor-city-clear-btn'
    ];

    // Page 5: Overlay tools
    const page5Ids = [
        'overlay-tools'
    ];

    const allIds = page1Ids.concat(page2Ids, page3Ids, page4Ids, page5Ids);

    // Explicit display types so we don't depend on whatever inline style happened to be set before.
    const displayMap = {
        'brush-controls': 'flex',
        'overlay-tools': 'flex'
    };

    // Show only the tools belonging to the active page
    allIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        const isOnPage1 = page1Ids.includes(id);
        const isOnPage2 = page2Ids.includes(id);
        const isOnPage3 = page3Ids.includes(id);
        const isOnPage4 = page4Ids.includes(id);
        const isOnPage5 = page5Ids.includes(id);

        const shouldShow =
            (page === 1 && isOnPage1) ||
            (page === 2 && isOnPage2) ||
            (page === 3 && isOnPage3) ||
            (page === 4 && isOnPage4) ||
            (page === 5 && isOnPage5);

        if (shouldShow) {
            el.style.display = displayMap[id] || 'inline-flex';
        } else {
            el.style.display = 'none';
        }
    });

    // Toggle handles visibility based on whether a reference image exists
    if (GS.referenceOverlay) {
        updateRefHandles();
    } else {
        clearRefHandles();
    }

    // Highlight active page button
    if (DOM.editorToolsPage1Btn && DOM.editorToolsPage2Btn && DOM.editorToolsPage3Btn && DOM.editorToolsPage4Btn && DOM.editorToolsPage5Btn) {
        DOM.editorToolsPage1Btn.style.background = page === 1 ? '#2e86de' : '#444';
        DOM.editorToolsPage2Btn.style.background = page === 2 ? '#2e86de' : '#444';
        DOM.editorToolsPage3Btn.style.background = page === 3 ? '#2e86de' : '#444';
        DOM.editorToolsPage4Btn.style.background = page === 4 ? '#2e86de' : '#444';
        DOM.editorToolsPage5Btn.style.background = page === 5 ? '#2e86de' : '#444';
    }
}
