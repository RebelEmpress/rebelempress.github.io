// Engine module extracted from main.js — map-geo
import L from 'leaflet';
import { parseColorToRGBA } from './utils.js';
import { CONFIG } from './config.js';
import { getFeatureBBox, getProvinceId, isPointInFeature } from './geometry.js';
import { GS } from './state.js';
import * as DOM from './dom.js';
import { loadingBar, loadingStatus, map, setImageryProvider } from './main.js';
import { findCodeByName, getFlagUrl } from './flags.js';

export function generateProvinces() {
    if (!GS.provinceMap || !GS.worldControlMap) return;
    for (let y = 0; y < GS.gridHeight; y++) {
        const rowOffset = y * GS.gridWidth;
        for (let x = 0; x < GS.gridWidth; x++) {
            const idx = rowOffset + x;
            GS.provinceMap[idx] = getProvinceId(x, y, GS.worldControlMap[idx]);
        }
    }
}

export function applyWorldBounds(widthDeg, heightDeg, allowImagerySwitch = true) {
    // Clamp to safe ranges
    const w = Math.max(10, Math.min(360, widthDeg || 360));
    const h = Math.max(10, Math.min(180, heightDeg || 180));
    GS.worldWidthDeg = w;
    GS.worldHeightDeg = h;

    // If changing size while not in Simplified mode, force switch to Simplified (wargames)
    if (allowImagerySwitch && DOM.imagerySelect && DOM.imagerySelect.value !== 'wargames') {
        setImageryProvider('wargames', false);
        if (DOM.disableCountryGradientCheckbox) {
            DOM.disableCountryGradientCheckbox.checked = true;
            GS.disableCountryGradient = true;
        }
    }

    const halfW = w / 2;
    const halfH = h / 2;
    const bounds = L.latLngBounds(
        L.latLng(-halfH, -halfW),
        L.latLng(halfH, halfW)
    );
    map.setMaxBounds(bounds);

    // If current center is outside new bounds, fit map into the new box
    if (!bounds.contains(map.getCenter())) {
        map.fitBounds(bounds, { animate: true });
    }

    // Force bounding box redraw
    if (GS.influenceLayer) {
        GS.influenceLayer._forceRender = true;
        if (typeof GS.influenceLayer._update === 'function') {
            GS.influenceLayer._update();
        } else {
            GS.influenceLayer.render();
        }
    }
}

export function isInsideWorldBoxLatLng(lat, lng) {
    if (!GS.worldWidthDeg || !GS.worldHeightDeg) return true;
    const halfW = GS.worldWidthDeg / 2;
    const halfH = GS.worldHeightDeg / 2;
    return lat >= -halfH && lat <= halfH && lng >= -halfW && lng <= halfW;
}

export function getAllianceRootId(startId) {
    if (!startId || startId <= 0 || !GS.countryMetadata) return null;
    const visited = new Set();
    const queue = [startId];
    let rootId = startId;
    while (queue.length) {
        const cid = queue.shift();
        if (visited.has(cid)) continue;
        visited.add(cid);
        if (cid < rootId) rootId = cid;
        const meta = GS.countryMetadata[cid - 1];
        const allies = (meta && Array.isArray(meta.allies)) ? meta.allies : [];
        allies.forEach(aid => {
            if (aid > 0 && !visited.has(aid)) queue.push(aid);
        });
    }
    return rootId;
}

export function getAllianceMembers(startId) {
    if (!startId || startId <= 0 || !GS.countryMetadata) return [];
    const visited = new Set();
    const queue = [startId];
    while (queue.length) {
        const cid = queue.shift();
        if (visited.has(cid)) continue;
        visited.add(cid);
        const meta = GS.countryMetadata[cid - 1];
        const allies = (meta && Array.isArray(meta.allies)) ? meta.allies : [];
        allies.forEach(aid => {
            if (aid > 0 && !visited.has(aid)) queue.push(aid);
        });
    }
    return Array.from(visited);
}

export function getCountryColor(feature, alpha = 1) {
    if (!feature) return `rgba(150, 150, 150, ${alpha})`;
    const name = feature.properties.NAME || feature.properties.name || feature.properties.admin || feature.properties.NAME_LONG || "Unknown";
    
    // Check for predefined HOI4 colors
    if (CONFIG.HOI4_COLORS[name]) {
        const hex = CONFIG.HOI4_COLORS[name];
        // Convert hex to rgba
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Fallback to deterministic hash-based HSL
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    const s = 60 + Math.abs((hash >> 8) % 30); // 60-90%
    const l = 45 + Math.abs((hash >> 16) % 20); // 45-65%
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
}

export function getControlValue(lat, lng) {
    const idx = getGridIndex(lat, lng);
    if (idx === -1 || GS.landMask[idx] === 0) return 0;
    // For combat logic, return occupation if in active warzone
    if (GS.gameState === 'SIMULATING' && GS.landMask[idx] === 2) return GS.occupationMap[idx];
    return 0;
}

export function getGridIndex(lat, lng) {
    // Normalize longitude to [-180, 180] before indexing to handle wrap-around coordinates
    let wrappedLng = ((lng + 180) % 360 + 360) % 360 - 180;
    const x = Math.floor((wrappedLng + 180) / CONFIG.GRID_RES);
    const y = Math.floor((lat + 90) / CONFIG.GRID_RES);
    if (x < 0 || x >= GS.gridWidth || y < 0 || y >= GS.gridHeight) return -1;
    return y * GS.gridWidth + x;
}

export function recalculateAllBounds(forceFullScan = false) {
    if (!GS.countryMetadata || !GS.worldControlMap) return;
    const isWar = (GS.gameState === 'SIMULATING' || (GS.godModeActive && GS.preGodModeState === 'SIMULATING'));
    
    // Performance optimization: when zoomed in deep, we only scan a slightly larger padding of the view
    // to update labels, rather than the entire 6.4 million cell world grid.
    // However, for critical systems like defining a war theater, we MUST scan the full world.
    const view = map.getBounds();
    const res = CONFIG.GRID_RES;
    
    let vXMin = 0, vXMax = GS.gridWidth - 1, vYMin = 0, vYMax = GS.gridHeight - 1;
    
    if (!forceFullScan) {
        vXMin = Math.max(0, Math.floor((view.getWest() + 180) / res) - 10);
        vXMax = Math.min(GS.gridWidth - 1, Math.ceil((view.getEast() + 180) / res) + 10);
        vYMin = Math.max(0, Math.floor((view.getSouth() + 90) / res) - 10);
        vYMax = Math.min(GS.gridHeight - 1, Math.ceil((view.getNorth() + 90) / res) + 10);
    }

    GS.countryMetadata.forEach(meta => {
        if (!meta) return;
        // Store last bounds for stable binning
        meta.prevBounds = meta.bounds ? { ...meta.bounds } : null;
        meta.bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
        meta.labelBins = Array.from({length: 4}, () => ({ latSum: 0, lngSum: 0, count: 0 }));
        meta.totalLatSum = 0;
        meta.totalLngSum = 0;
        meta.totalCount = 0;
    });

    // Scan viewport only for label updates to drastically reduce CPU pressure
    for (let y = vYMin; y <= vYMax; y++) {
        const rowOffset = y * GS.gridWidth;
        const lat = (y * res) - 90;
        for (let x = vXMin; x <= vXMax; x++) {
            const i = rowOffset + x;
            const lng = (x * res) - 180;
            let id = GS.worldControlMap[i];
            
            if (isWar && GS.landMask[i] === 2) {
                const occ = GS.occupationMap[i];
                if (Math.abs(occ) > 0.05) {
                    const occupierId = GS.primaryOccupierMap[i];
                    if (occupierId > 0) id = occupierId;
                }
            }

            if (id > 0 && id <= GS.countryMetadata.length) {
                const meta = GS.countryMetadata[id - 1];
                if (meta) {
                    const b = meta.bounds;
                    if (x < b.minX) b.minX = x;
                    if (x > b.maxX) b.maxX = x;
                    if (y < b.minY) b.minY = y;
                    if (y > b.maxY) b.maxY = y;

                    // Stable Label Data Accumulation
                    meta.totalLatSum += lat;
                    meta.totalLngSum += lng;
                    meta.totalCount++;

                    // Use prev bounds to determine stable binning during this pass
                    if (meta.prevBounds && meta.prevBounds.minX !== Infinity) {
                        const width = Math.max(1, meta.prevBounds.maxX - meta.prevBounds.minX);
                        const binIdx = Math.max(0, Math.min(3, Math.floor(((x - meta.prevBounds.minX) / width) * 4)));
                        const bin = meta.labelBins[binIdx];
                        bin.latSum += lat;
                        bin.lngSum += lng;
                        bin.count++;
                    }
                }
            }
        }
    }

    // Finalize stable centers
    GS.countryMetadata.forEach(meta => {
        if (meta && meta.totalCount > 0) {
            meta.stableCenter = { lat: meta.totalLatSum / meta.totalCount, lng: meta.totalLngSum / meta.totalCount };
            // If prev bounds weren't available, the bins will be empty; Pass 7 will handle fallback
        }
    });
}

export async function updateLandMask(features, maskValue = 1, isBlank = false) {
    if (!isBlank) {
        GS.countryMetadata = features.map((f, i) => {
            const color = getCountryColor(f);
            const name = f.properties.NAME || f.properties.name || f.properties.admin || f.properties.NAME_LONG || "Unknown";
            
            const getCode = (feat) => {
                if (!feat || !feat.properties) return null;
                const p = feat.properties;
                let code = p.ISO_A2 || p.iso_a2 || p.ISO_A2_EH || p.iso_a2_eh || p.ADDR_A2 || null;
                if (code === "-99") return null;
                return code;
            };

            const code = findCodeByName(name) || getCode(f);
            return {
                id: i + 1,
                name: name,
                feature: f,
                color: color,
                rgba: parseColorToRGBA(color),
                flagUrl: getFlagUrl(code, name),
                bounds: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
                buffState: 'none',
                hiddenBuffState: 'none'
            };
        });
    } else {
        GS.countryMetadata = [];
    }

    const total = features.length;
    // Process features in small async chunks so the main thread can breathe and the UI stays responsive.
    const CHUNK = 12; // number of features per micro-batch; tuned for responsiveness vs. throughput
    let processedFeatures = 0;
    while (processedFeatures < features.length) {
        const end = Math.min(processedFeatures + CHUNK, features.length);
        for (let i = processedFeatures; i < end; i++) {
            const feature = features[i];
            const id = i + 1;

            // Update loading UI for this micro-batch
            const percent = Math.floor((i / total) * 100);
            if (loadingBar) loadingBar.style.width = `${percent}%`;
            if (loadingStatus) loadingStatus.innerText = isBlank ? `Scanning Landmasses: ${percent}%` : `Mapping Borders: ${percent}%`;

            // Cheap cached bbox from the feature's exterior rings — avoids building a full
            // Leaflet GeoJSON layer (which allocates a LatLng per coordinate) just for bounds.
            // The same cache backs the per-cell point-in-polygon test below.
            const bbox = getFeatureBBox(feature) || { minX: -180, minY: -90, maxX: 180, maxY: 90 };

            const startLat = Math.max(0, Math.floor((bbox.minY + 90) / CONFIG.GRID_RES));
            const endLat = Math.min(GS.gridHeight - 1, Math.ceil((bbox.maxY + 90) / CONFIG.GRID_RES));
            const startLng = Math.max(0, Math.floor((bbox.minX + 180) / CONFIG.GRID_RES));
            const endLng = Math.min(GS.gridWidth - 1, Math.ceil((bbox.maxX + 180) / CONFIG.GRID_RES));

            for (let y = startLat; y <= endLat; y++) {
                const rowOffset = y * GS.gridWidth;
                for (let x = startLng; x <= endLng; x++) {
                    const lat = (y * CONFIG.GRID_RES) - 90 + (CONFIG.GRID_RES * 0.5);
                    const lng = (x * CONFIG.GRID_RES) - 180 + (CONFIG.GRID_RES * 0.5);
                    if (isPointInFeature(lat, lng, feature)) {
                        const idx = rowOffset + x;
                        if (idx >= 0 && idx < GS.landMask.length) {
                            GS.landMask[idx] = maskValue;
                            // Always populate De Jure map as a historical reference for rebellions, even in "blank" editor mode
                            GS.deJureMap[idx] = id;
                            if (!isBlank) {
                                GS.worldControlMap[idx] = id;
                                const meta = GS.countryMetadata[id - 1];
                                if (meta) {
                                    meta.bounds.minX = Math.min(meta.bounds.minX, x);
                                    meta.bounds.maxX = Math.max(meta.bounds.maxX, x);
                                    meta.bounds.minY = Math.min(meta.bounds.minY, y);
                                    meta.bounds.maxY = Math.max(meta.bounds.maxY, y);
                                }
                            }
                        }
                    }
                }
            }
        }

        processedFeatures = end;

        // Yield back to the browser to keep UI responsive
        // micro-delay (0) allows the event loop to handle input/paint/other tasks
        // while keeping throughput reasonable.
        await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    if (loadingBar) loadingBar.style.width = `100%`;
    if (loadingStatus) loadingStatus.innerText = `Optimization Complete`;

    // Automatically apply desert biomes to Earth-based scenarios for visual depth in Simple Mode
    if (!GS.isCustomTerrain) {
        applyEarthDeserts();
    }
}

export function applyEarthDeserts() {
    if (!GS.biomeMask) return;
    
    // Bounding boxes for major global deserts
    const deserts = [
        { lat: [14, 31], lng: [-17, 35] },   // Sahara
        { lat: [12, 32], lng: [35, 59] },    // Arabian
        { lat: [36, 48], lng: [75, 115] },   // Gobi / Taklamakan
        { lat: [-34, -18], lng: [114, 150] },// Australian Outback
        { lat: [-30, -18], lng: [14, 28] },  // Kalahari / Namib
        { lat: [23, 37], lng: [-118, -102] },// Mojave / Sonoran / Chihuahuan
        { lat: [-27, -15], lng: [-72, -66] }, // Atacama
        { lat: [24, 32], lng: [68, 77] },    // Thar
        { lat: [35, 45], lng: [52, 72] }     // Central Asian (Kyzylkum/Kara-Kum)
    ];

    for (let i = 0; i < GS.landMask.length; i++) {
        if (GS.landMask[i] === 0) continue; 

        const y = Math.floor(i / GS.gridWidth);
        const x = i % GS.gridWidth;
        const lat = (y * CONFIG.GRID_RES) - 90;
        const lng = (x * CONFIG.GRID_RES) - 180;

        for (const d of deserts) {
            if (lat >= d.lat[0] && lat <= d.lat[1] && lng >= d.lng[0] && lng <= d.lng[1]) {
                // Apply a sinus-based noise threshold to prevent perfectly rectangular deserts
                const n = Math.sin(lat * 3.5) * Math.cos(lng * 3.5);
                if (n > -0.85) { 
                    GS.biomeMask[i] = 1;
                }
                break;
            }
        }
    }
}

export function computeAdjacency() {
    const adj = new Map();
    const total = GS.worldControlMap.length;
    for (let i = 0; i < total; i++) {
        const id1 = GS.worldControlMap[i];
        if (id1 <= 0) continue;
        
        const x = i % GS.gridWidth;
        const y = Math.floor(i / GS.gridWidth);
        
        // Only check right and down to avoid redundant pairs
        const neighbors = [];
        if (x < GS.gridWidth - 1) neighbors.push(i + 1);
        if (y < GS.gridHeight - 1) neighbors.push(i + GS.gridWidth);
        
        for (const nIdx of neighbors) {
            const id2 = GS.worldControlMap[nIdx];
            if (id2 > 0 && id1 !== id2) {
                if (!adj.has(id1)) adj.set(id1, new Set());
                if (!adj.has(id2)) adj.set(id2, new Set());
                adj.get(id1).add(id2);
                adj.get(id2).add(id1);
            }
        }
    }
    return adj;
}
