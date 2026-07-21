// Engine module extracted from main.js — scenario-loader
import L from 'leaflet';
import { deepClone, getCookie, parseColorToRGBA } from './utils.js';
import { getTranslation } from './translations.js';
import { CONFIG } from './config.js';
import { isPointInFeature } from './geometry.js';
import { GS } from './state.js';
import * as DOM from './dom.js';
import { initializeEngine, loadingBar, loadingStatus, loadingTip, map, setImageryProvider, setLoadingThematic, updateRestartVisibility } from './main.js';
import { updateRefHandles } from './editor-tools.js';
import { loadFlagCodes } from './flags.js';
import { applyWorldBounds, generateProvinces, getGridIndex, recalculateAllBounds, updateLandMask } from './map-geo.js';

export async function loadTerrain(res) {
    try {
        loadingStatus.innerText = "Scanning Topography...";
        loadingBar.style.width = "35%";

        // Fallback to 50m if 10m is selected for physical features, as 10m physical data is often missing/split differently
        const terrainRes = res === '110m' ? '110m' : '50m';
        const terrainUrl = `${CONFIG.GEOJSON_BASE}${terrainRes}/physical/ne_${terrainRes}_geography_regions_polys.json`;
        const response = await fetch(terrainUrl);

        // If the request fails or is blocked, fall back immediately to flat terrain
        if (!response.ok) {
            console.warn("Terrain fetch failed with status", response.status);
            GS.terrainMask.fill(0);
            loadingBar.style.width = "100%";
            loadingStatus.innerText = "Terrain data unavailable, continuing...";
            return;
        }

        const data = await response.json();
        
        const features = data.features || [];

        // PERFORMANCE GUARD:
        // On very large grids or huge terrain datasets, skip heavy per‑cell terrain processing
        // to avoid getting "stuck" on the Scanning Topography step (especially on mobile).
        const totalCells = (GS.gridWidth || 0) * (GS.gridHeight || 0);
        const isHugeGrid = totalCells > 600000;      // ~ > 600k cells
        const isHugeFeatureSet = features.length > 400;

        if (isHugeGrid || isHugeFeatureSet) {
            console.warn("Terrain processing skipped for performance (cells:", totalCells, "features:", features.length, ")");
            GS.terrainMask.fill(0);
            loadingBar.style.width = "100%";
            loadingStatus.innerText = "Terrain simplified for performance";
            return;
        }

        const mountains = [];
        const lowlands = [];

        features.forEach(f => {
            const p = f.properties;
            const name = (p.name || p.name_en || "").toLowerCase();
            const type = (p.featurecla || "").toLowerCase();
            
            const isMt = type.includes('mountain') || 
                         type.includes('range') ||
                         name.includes('mountain') || 
                         name.includes('alps') || 
                         name.includes('himalaya') || 
                         name.includes('karakoram') ||
                         name.includes('kunlun') ||
                         name.includes('pamir') ||
                         name.includes('tibet') ||
                         name.includes('hindu kush') ||
                         name.includes('tian shan') ||
                         name.includes('andes') ||
                         name.includes('rockies') ||
                         name.includes('carpathian') ||
                         name.includes('caucasus') ||
                         name.includes('atlas') ||
                         name.includes('pyrenees');

            // Categorize basins and depressions as lowlands to act as "holes" in larger mountain ranges
            const isLow = name.includes('basin') || 
                          name.includes('depression') || 
                          name.includes('plain') || 
                          name.includes('lowland') || 
                          name.includes('valley') ||
                          name.includes('transylvania') ||
                          name.includes('pannonian') ||
                          name.includes('carpathian basin');

            if (isMt) mountains.push(f);
            if (isLow) lowlands.push(f);
        });

        GS.terrainMask.fill(0);
        
        // Pass 1: Draw Mountains
        const totalMt = mountains.length;
        for (let i = 0; i < totalMt; i++) {
            if (i % 10 === 0) {
                const pct = 40 + Math.floor((i / Math.max(1, totalMt)) * 40);
                loadingBar.style.width = `${pct}%`;
                loadingStatus.innerText = `Mapping Rugged Peaks: ${pct}%`;
                await new Promise(r => setTimeout(r, 0));
            }
            
            const feature = mountains[i];
            const bounds = L.geoJSON(feature).getBounds();
            const sLat = Math.max(0, Math.floor((bounds.getSouth() + 90) / CONFIG.GRID_RES));
            const eLat = Math.min(GS.gridHeight - 1, Math.ceil((bounds.getNorth() + 90) / CONFIG.GRID_RES));
            const sLng = Math.max(0, Math.floor((bounds.getWest() + 180) / CONFIG.GRID_RES));
            const eLng = Math.min(GS.gridWidth - 1, Math.ceil((bounds.getEast() + 180) / CONFIG.GRID_RES));

            for (let y = sLat; y <= eLat; y++) {
                for (let x = sLng; x <= eLng; x++) {
                    const lat = (y * CONFIG.GRID_RES) - 90;
                    const lng = (x * CONFIG.GRID_RES) - 180;
                    if (isPointInFeature(lat, lng, feature)) {
                        const idx = y * GS.gridWidth + x;
                        if (idx >= 0 && idx < GS.terrainMask.length) {
                            const rank = feature.properties.scalerank || 5;
                            const intensity = Math.max(0.3, (11 - rank) / 10); 
                            GS.terrainMask[idx] = Math.max(GS.terrainMask[idx], intensity);
                        }
                    }
                }
            }
        }

        // Pass 2: Clear Lowlands (Holes in ranges like the Transylvanian Depression)
        const totalLow = lowlands.length;
        for (let i = 0; i < totalLow; i++) {
            if (i % 20 === 0) {
                const pct = 80 + Math.floor((i / Math.max(1, totalLow)) * 15);
                loadingBar.style.width = `${Math.min(95, pct)}%`;
                loadingStatus.innerText = `Carving Basins: ${Math.min(95, pct)}%`;
                await new Promise(r => setTimeout(r, 0));
            }

            const feature = lowlands[i];
            const bounds = L.geoJSON(feature).getBounds();
            const sLat = Math.max(0, Math.floor((bounds.getSouth() + 90) / CONFIG.GRID_RES));
            const eLat = Math.min(GS.gridHeight - 1, Math.ceil((bounds.getNorth() + 90) / CONFIG.GRID_RES));
            const sLng = Math.max(0, Math.floor((bounds.getWest() + 180) / CONFIG.GRID_RES));
            const eLng = Math.min(GS.gridWidth - 1, Math.ceil((bounds.getEast() + 180) / CONFIG.GRID_RES));

            for (let y = sLat; y <= eLat; y++) {
                for (let x = sLng; x <= eLng; x++) {
                    const lat = (y * CONFIG.GRID_RES) - 90;
                    const lng = (x * CONFIG.GRID_RES) - 180;
                    if (isPointInFeature(lat, lng, feature)) {
                        const idx = y * GS.gridWidth + x;
                        if (idx >= 0 && idx < GS.terrainMask.length) {
                            // Set mountain intensity to 0 for identified basins/lowlands
                            GS.terrainMask[idx] = 0;
                        }
                    }
                }
            }
        }

        // Finalize progress if everything succeeded
        loadingBar.style.width = "100%";
        loadingStatus.innerText = "Topography mapped";
    } catch (e) {
        console.warn("Failed to load terrain data", e);
        // On any error, fall back to flat terrain so the loader never gets stuck
        if (GS.terrainMask) GS.terrainMask.fill(0);
        loadingBar.style.width = "100%";
        loadingStatus.innerText = "Terrain data unavailable, continuing...";
    }
}

export async function loadCities() {
    try {
        // Upgrade to 50m resolution for a significantly higher city count (thousands vs hundreds)
        const response = await fetch('https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/50m/cultural/ne_50m_populated_places_simple.json');
        const data = await response.json();
        GS.cities = data.features.map((f, idx) => ({
            id: idx + 1,
            name: f.properties.name || f.properties.NAME || "City",
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            pop: f.properties.pop_max || 0,
            isCapital: f.properties.adm0cap === 1,
            ownerId: null,
            isCustom: false
        }));

        // Apply historical renames for the 1936 WW2 scenario
        if (GS.currentScenarioContext && (GS.currentScenarioContext.id === 'ww2_1936')) {
            GS.cities.forEach(city => {
                if (city.name === 'Kaliningrad') {
                    city.name = 'Koenisberg';
                }
                if (city.name === 'Gdańsk' || city.name === 'Gdansk') {
                    city.name = 'Danzig';
                }
            });
        }
    } catch (err) {
        console.error("Failed to load cities", err);
    }
}

export async function loadCountries(url, isBlank = false, suppressUi = false) {
    try {
        if (!suppressUi) {
            setLoadingThematic(false);
            DOM.loadingOverlay.style.display = 'flex';
            DOM.mapUi.style.display = 'none';
            DOM.mainMenu.style.display = 'none';
        }
        loadingStatus.innerText = "Downloading GeoData...";
        loadingBar.style.width = "10%";

        // When suppressUi is set we're being called from performPresetLoad, which will
        // load its own cities (from the preset or a fresh fetch) right after we return.
        // Skip the redundant city download here so cold scenario loads aren't paying for
        // the 50m populated-places fetch + parse twice.
        if (suppressUi) {
            await loadFlagCodes();
        } else {
            await Promise.all([loadCities(), loadFlagCodes()]);
        }
        loadingBar.style.width = "20%";
        loadingTip.innerText = "Refining city coordinates for strategic deployment...";

        const response = await fetch(url);
        const data = await response.json();
        GS.rawGeoJsonData = data;
        loadingBar.style.width = "30%";
        loadingStatus.innerText = isBlank ? "Acquiring Topography..." : "Processing Geopolitics...";

        // Static countriesLayer removed to prevent outlines of annexed nations from persisting.
        // Borders and coastlines are now entirely handled by the dynamic canvas overlay.

        // Pre-compute basic landmask for better performance
        loadingTip.innerText = isBlank ? "Cleaning political data..." : "Calculating terrain influence grids...";
        await updateLandMask(data.features, 1, isBlank);

        // Reset adjacency cache
        GS.adjacencyCache = null;

        // When suppressUi is set, performPresetLoad is about to overwrite the ownership
        // grid from the preset's mapData and will re-run generateProvinces /
        // recalculateAllBounds / snapshot capture / terrain itself. Running them here on the
        // still-blank base map is pure duplicated work (each scans the full grid), so skip it
        // and let performPresetLoad do the single authoritative pass.
        if (!suppressUi) {
            // Generate provinces after landmask is set and worldControlMap is populated
            generateProvinces();

            // Generate initial country centers and label data
            recalculateAllBounds();

            // Capture Instant Quick Restart Snapshots for the base map load
            if (GS.worldControlMap) {
                GS.initialWorldControlMapSnapshot = new Int32Array(GS.worldControlMap);
                GS.initialDeJureMapSnapshot = new Int32Array(GS.deJureMap);
                GS.initialProvinceMapSnapshot = new Int32Array(GS.provinceMap);
                GS.initialLandMaskSnapshot = new Uint8Array(GS.landMask);
                GS.initialCountryMetadataSnapshot = deepClone(GS.countryMetadata);
                GS.initialCitiesSnapshot = deepClone(GS.cities);
            }

            // Load and rasterize mountain terrain
            if (GS.mountainsEnabled) {
                const currentMapRes = document.getElementById('map-res-select').value;
                await loadTerrain(currentMapRes);
            } else {
                GS.terrainMask.fill(0);
            }
        }
        
        if (!suppressUi) {
            loadingBar.style.width = "100%";
            // Yield one frame so the full bar paints, then reveal — no fixed stall.
            await new Promise(r => setTimeout(r, 0));
            DOM.loadingOverlay.style.display = 'none';
            DOM.mapUi.style.display = 'flex';
        }

    } catch (err) {
        console.error("Failed to load geojson", err);
        loadingStatus.innerText = "Error Loading Assets";
        loadingStatus.style.color = "#ff4757";
    }
}

export function generatePresetData(name) {
    const mapData = [];
    // Save all cells that are land (mask != 0), even if they don't have a country owner (id == 0)
    for (let i = 0; i < GS.worldControlMap.length; i++) {
        if (GS.landMask[i] !== 0) {
            // Store as [index, ownerId, biomeId]
            mapData.push([i, GS.worldControlMap[i], GS.biomeMask[i] || 0]);
        }
    }

    // Save mountain/terrain intensity for custom maps to prevent losing painted peaks
    const mountainData = [];
    if (GS.isCustomTerrain) {
        for (let i = 0; i < GS.terrainMask.length; i++) {
            if (GS.terrainMask[i] > 0) {
                mountainData.push([i, parseFloat(GS.terrainMask[i].toFixed(2))]);
            }
        }
    }

    const currentImagery = getCookie('mw_imagery') || 'arcgis';

    // Filter countryMetadata to handle sparse arrays/null entries
    // Includes releasables (nations without current land but preserved in metadata)
    const cleanMetadata = GS.countryMetadata.filter(m => m && typeof m === 'object' && m.id).map(m => ({
        id: m.id,
        name: m.name || m.feature?.properties?.NAME || "Unnamed Nation",
        color: m.color || 'rgba(150, 150, 150, 0.5)',
        isCustom: !!m.isCustom,
        flagUrl: m.flagUrl || null,
        // Persist any full-alliance flag that may override member flags in Alliance View
        allianceFlagUrl: m.allianceFlagUrl || null,
        role: m.role || 'OFFENSE',
        overlordId: m.overlordId || null,
        releasableBy: m.releasableBy || null,
        savedCells: m.savedCells || null,
        buffState: m.buffState || 'none',
        hiddenBuffState: m.hiddenBuffState || 'none',
        allies: Array.isArray(m.allies) ? m.allies : []
    }));

    // Persist city data (custom + any edited capitals)
    const cleanCities = (GS.cities || []).map((c, idx) => ({
        id: c.id || idx + 1,
        name: c.name,
        lat: c.lat,
        lng: c.lng,
        isCapital: !!c.isCapital,
        ownerId: c.ownerId || c.sovereignId || null,
        isCustom: !!c.isCustom,
        pop: c.pop || 0
    }));

    return {
        name: name,
        metadata: cleanMetadata,
        mapData: mapData,
        mountainData: mountainData.length > 0 ? mountainData : null,
        mapRes: document.getElementById('map-res-select').value,
        gridRes: CONFIG.GRID_RES,
        cities: cleanCities,
        imagery: currentImagery,
        isCustomTerrain: GS.isCustomTerrain,
        disableCountryGradient: GS.disableCountryGradient,
        customSatelliteUrl: GS.customSatelliteUrl,
        worldWidthDeg: GS.worldWidthDeg,
        worldHeightDeg: GS.worldHeightDeg,
        missilesEnabled: GS.missilesEnabled,
        // Reference image persistence
        referenceImageUrl: GS.referenceImageUrl || null,
        refImageOpacity: typeof GS.refOpacity === 'number' ? GS.refOpacity : 0.5,
        refImageBounds: GS.referenceOverlay
            ? {
                  nw: GS.referenceOverlay.getBounds().getNorthWest(),
                  se: GS.referenceOverlay.getBounds().getSouthEast()
              }
            : null,
        refDrawAbove: !!GS.refAboveTerrain
    };
}

export function resetConflictSetupState() {
    // Clear any previous conflict setup or running war state so new scenarios start clean.
    // Match the boot default of 2 empty sides (Side A / Side B; empty sides ignored at war start).
    GS.sides = [[], []];
    GS.attackers = GS.sides[0];
    GS.defenders = GS.sides[1];
    GS.activeSideIndex = 0;
    GS.teamAId = -1;
    GS.buffedTeam = null;
    GS.teamASoldiers = 0;
    GS.teamBSoldiers = 0;
    GS.initialTeamASoldiers = 0;
    GS.initialTeamBSoldiers = 0;
    GS.soldiersPerUnitA = CONFIG.UNIT_TO_SOLDIER_RATIO;
    GS.soldiersPerUnitB = CONFIG.UNIT_TO_SOLDIER_RATIO;
    GS.units = [];
    GS.bases = [];
    GS.bombs = [];
    GS.explosions = [];
    GS.encirclePops = [];
    GS.activeBattles = [];
    GS.capitalLostCountries = new Set();
    GS.activeRebellion = null;
    GS.countryCasualties.clear();
    GS.latestCountryStats.clear();
    GS.selectedCountryIds.clear();
    GS.editingCountryId = -1;
    GS.editingCityId = -1;
    GS.paintMaskId = -1;
    GS.gameTimeEnabled = false;
    GS.gameTimeDate = null;
    GS.gameTimeAccumulatorMs = 0;
    if (DOM.gameDateDisplay) {
        DOM.gameDateDisplay.style.display = 'none';
    }
    DOM.treatyAlert.style.display = 'none';
    DOM.statusText.innerText = getTranslation('SELECT_P1');
    DOM.unitCountsDiv.style.display = 'none';
    DOM.statsPanel.style.display = 'none';
    DOM.casualtyPanel.style.display = 'none';
    document.getElementById('speed-controls').style.display = 'none';
    DOM.godModeBtn.style.display = (GS.gameMode === 'CONQUEST') ? 'block' : 'none';
    DOM.forcePeaceBtn.style.display = 'none';
    DOM.resetBtn.style.display = 'block';
    DOM.restartScenarioBtn.style.display = 'block';
    updateRestartVisibility();
}

// Serializes scenario loads so the background attract-demo load (startMenuDemo) can
// never overlap a real one — both mutate the shared engine grid, and concurrent runs
// would corrupt it. Each call waits for the previous to finish before touching state.
let _presetLoadChain = Promise.resolve();

export async function performPresetLoad(fileOrBlob, targetMode = 'EDITOR', opts = {}) {
    if (!fileOrBlob) return;

    const _prior = _presetLoadChain;
    let _release;
    _presetLoadChain = new Promise(r => { _release = r; });
    await _prior;   // wait out any in-flight load (e.g. the attract demo) before mutating

    // A real scenario load always fully tears the attract-mode menu demo back down
    // (restores the in-game HUD + opaque menu). The demo's own load passes demoMode,
    // so it does NOT trip this — see startMenuDemo() in main.js.
    if (!opts.demoMode && (GS.menuDemoActive || document.body.classList.contains('menu-demo-live'))) {
        GS.menuDemoActive = false;
        document.body.classList.remove('menu-demo-live');
    }

    let userChoice = { action: 'skip' };

    try {
        // Reset Selector transition state if we're coming from there
        const selector = document.getElementById('menu-scenario-selector');
        if (selector) {
            selector.style.opacity = '1';
            selector.style.transform = 'none';
        }

        DOM.loadingOverlay.style.display = 'flex';
        loadingStatus.innerText = "Processing Archives...";
        
        const text = await fileOrBlob.text();
        const data = JSON.parse(text);

        if (!data || !data.metadata || !data.mapData) {
            throw new Error("Invalid preset structure");
        }

        // Ensure engine is initialized with the CURRENT grid density before we use worldControlMap.
        // This fixes cases where a preset was saved at a low grid density, but your settings are now higher.
        const gridSelect = document.getElementById('grid-res-select');
        const desiredGridRes = gridSelect ? parseFloat(gridSelect.value) : CONFIG.GRID_RES;

        if (!GS.worldControlMap || CONFIG.GRID_RES !== desiredGridRes) {
            // Update engine config to the desired grid resolution and reallocate all grid arrays.
            CONFIG.GRID_RES = desiredGridRes;
            initializeEngine();
        } else {
            // Sync settings state (mountains/provinces) even if resolution hasn't changed
            initializeEngine();
        }

        // Always clear previous conflict setup / selection so old picks don't bleed into new scenarios
        resetConflictSetupState();

        // Visual environment restoration
        if (data.imagery) {
            // If this is a custom terrain map, we always use the preset's imagery
            if (data.isCustomTerrain) {
                setImageryProvider(data.imagery, false);
            } else {
                // If it's NOT a custom map, ignore the preset's imagery and stick to current user settings
                // But handle the case where it might need a fallback if none selected
                const currentUserImagery = DOM.imagerySelect ? DOM.imagerySelect.value : (getCookie('mw_imagery') || 'arcgis');
                setImageryProvider(currentUserImagery, true);
            }
        }

        // MODERN DAY ERA ONLY — show real satellite imagery (ArcGIS World Imagery) so the
        // present-day map reads like the actual planet (owner request). Every other
        // era/scenario keeps the stylised Simplified base. Skipped for the attract-mode
        // demo so it doesn't pull satellite tiles behind the menu.
        if (!opts.demoMode && GS.currentScenarioContext && GS.currentScenarioContext.id === 'world_map_2022') {
            setImageryProvider('arcgis', false);
            GS.modernEarthImagery = true;
        } else {
            GS.modernEarthImagery = false;
        }

        if (data.disableCountryGradient !== undefined) {
            GS.disableCountryGradient = data.disableCountryGradient;
            if (DOM.disableCountryGradientCheckbox) {
                DOM.disableCountryGradientCheckbox.checked = GS.disableCountryGradient;
            }
        }

        // World size & missile settings restoration
        if (typeof data.worldWidthDeg === 'number' && typeof data.worldHeightDeg === 'number') {
            applyWorldBounds(data.worldWidthDeg, data.worldHeightDeg, false);
        } else {
            // Default to full world if not specified
            applyWorldBounds(360, 180, false);
        }
        if (typeof data.missilesEnabled === 'boolean') {
            GS.missilesEnabled = data.missilesEnabled;
        } else {
            GS.missilesEnabled = true;
        }
        if (DOM.mapSettingsMissilesCheckbox) {
            DOM.mapSettingsMissilesCheckbox.checked = !!GS.missilesEnabled;
        }
        if (DOM.disableBombsCheckbox) {
            DOM.disableBombsCheckbox.checked = !GS.missilesEnabled;
        }
        GS.bombsDisabled = (DOM.disableBombsCheckbox && DOM.disableBombsCheckbox.checked) || !GS.missilesEnabled;

        // Restore Custom Overlays
        if (data.customSatelliteUrl) {
            GS.customSatelliteUrl = data.customSatelliteUrl;
            GS.customSatelliteImg = new Image();
            GS.customSatelliteImg.crossOrigin = "anonymous";
            GS.customSatelliteImg.src = GS.customSatelliteUrl;
        } else {
            GS.customSatelliteUrl = null;
            GS.customSatelliteImg = null;
        }

        // Reference image metadata is always loaded, but the overlay is only drawn in editor modes.
        GS.referenceImageUrl = data.referenceImageUrl || null;
        GS.refOpacity = typeof data.refImageOpacity === 'number' ? data.refImageOpacity : 0.5;
        GS.refScale = typeof data.refImageScale === 'number' ? data.refImageScale : 1.0;
        GS.refAboveTerrain = !!data.refDrawAbove;

        if (GS.referenceOverlay) {
            map.removeLayer(GS.referenceOverlay);
            GS.referenceOverlay = null;
        }

        if (GS.referenceImageUrl && targetMode === 'EDITOR') {
            let bounds;
            if (data.refImageBounds && data.refImageBounds.nw && data.refImageBounds.se) {
                // Use saved bounds to preserve proportions/position
                bounds = [
                    [data.refImageBounds.nw.lat, data.refImageBounds.nw.lng],
                    [data.refImageBounds.se.lat, data.refImageBounds.se.lng]
                ];
            } else {
                // Fallback: center on map using approximate aspect
                const center = map.getCenter();
                const h = 20 * GS.refScale;
                const w = h * 1.6;
                bounds = [[center.lat - h, center.lng - w], [center.lat + h, center.lng + w]];
            }
            GS.referenceOverlay = L.imageOverlay(GS.referenceImageUrl, bounds, {
                opacity: GS.refOpacity,
                interactive: false,
                pane: 'refImagePane'
            }).addTo(map);
            // Rebuild handles in editor
            updateRefHandles();
        } else {
            GS.referenceOverlay = null;
        }

        // Optimization: Use cached GeoJSON if available to skip redundant network requests and processing
        // But only if this isn't a custom painted map that doesn't need them
        if (!GS.rawGeoJsonData && !data.isCustomTerrain) {
            const mapRes = document.getElementById('map-res-select').value;
            const geoUrl = `${CONFIG.GEOJSON_BASE}${mapRes}/cultural/ne_${mapRes}_admin_0_countries.json`;
            await loadCountries(geoUrl, true, true);
        } else if (!data.isCustomTerrain) {
            // If we have GeoJSON, we still need to reset the masks but don't need to re-download
            GS.worldControlMap.fill(0);
            GS.occupationMap.fill(0);
            GS.primaryOccupierMap.fill(0);
            GS.landMask.fill(0);
            GS.provinceMap.fill(0);
            GS.deJureMap.fill(0);
            // Land mask is usually preserved from first boot load but ensure it is ready
        }

        // Check for empty metadata and prompt for procedural generation
        const metaList = data.metadata || [];
        if (metaList.length === 0 && targetMode !== 'EDITOR') {
            DOM.loadingOverlay.style.display = 'none';
            DOM.noNationsModal.style.display = 'flex';
            userChoice = await new Promise(resolve => {
                DOM.confirmRandomGenBtn.onclick = () => {
                    const count = parseInt(DOM.randomNationsCountInput.value) || 15;
                    resolve({ action: 'generate', count });
                };
                DOM.skipRandomGenBtn.onclick = () => {
                    resolve({ action: 'skip' });
                };
            });
            DOM.noNationsModal.style.display = 'none';
            DOM.loadingOverlay.style.display = 'flex';
        }

        // Restore metadata and reconstruct RGBA values for rendering
        const currentLang = getCookie('mw_lang') || 'en';
        
        // Reset and rebuild metadata
        GS.countryMetadata = [];
        metaList.forEach(m => {
            if (!m || !m.id) return;

            // Apply system language translation to country names in preset
            const translatedName = getTranslation(m.name, currentLang, 'NATIONS');
            if (translatedName !== m.name) {
                m.displayName = translatedName;
            }
            
            // Resolution Normalization for Releasable Saved Cells
            const sourceRes = data.gridRes || CONFIG.GRID_RES;
            const targetRes = CONFIG.GRID_RES;
            let normalizedCells = null;

            if (Array.isArray(m.savedCells) && m.savedCells.length > 0) {
                if (sourceRes === targetRes) {
                    // Same resolution: just clone the list so we don't mutate the original
                    normalizedCells = m.savedCells.map(pair => [pair[0], pair[1]]);
                } else {
                    // Remap saved cells from source grid to current grid using lat/lng centers
                    const seen = new Set();
                    normalizedCells = [];
                    m.savedCells.forEach(([sx, sy]) => {
                        const latCenter = (sy * sourceRes) - 90 + sourceRes / 2;
                        const lngCenter = (sx * sourceRes) - 180 + sourceRes / 2;
                        const idx = getGridIndex(latCenter, lngCenter);
                        if (idx === -1) return;
                        const ty = Math.floor(idx / GS.gridWidth);
                        const tx = idx % GS.gridWidth;
                        const key = `${tx},${ty}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            normalizedCells.push([tx, ty]);
                        }
                    });
                    if (!normalizedCells.length) {
                        console.log(`Satellite Notice: ${m.name} releasable cells could not be remapped; falling back to deJure/feature.`);
                        normalizedCells = null;
                    }
                }
            }

            const meta = {
                ...m,
                savedCells: normalizedCells,
                rgba: parseColorToRGBA(m.color || 'rgba(150, 150, 150, 0.5)'),
                bounds: m.bounds || { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
                buffState: m.buffState || 'none',
                hiddenBuffState: m.hiddenBuffState || 'none',
                allies: Array.isArray(m.allies) ? m.allies : []
            };

            // Load primary national flag image
            if (meta.flagUrl) {
                meta.tempFlag = new Image();
                meta.tempFlag.crossOrigin = "anonymous";
                meta.tempFlag.src = meta.flagUrl;
            }

            // Load alliance flag image (used in Alliance View for both regions and units)
            if (meta.allianceFlagUrl) {
                meta.allianceFlagTempFlag = new Image();
                meta.allianceFlagTempFlag.crossOrigin = "anonymous";
                meta.allianceFlagTempFlag.onload = () => {
                    if (GS.influenceLayer) GS.influenceLayer.render();
                };
                meta.allianceFlagTempFlag.src = meta.allianceFlagUrl;
            }

            GS.countryMetadata[m.id - 1] = meta;
        });
        
        // Clear current map
        GS.worldControlMap.fill(0);
        GS.occupationMap.fill(0);
        GS.primaryOccupierMap.fill(0);
        GS.biomeMask.fill(0);
        
        // Ensure custom terrain state is preserved
        GS.isCustomTerrain = !!data.isCustomTerrain;
        if (GS.isCustomTerrain) {
            GS.landMask.fill(0);
        }
        
        // Coordinate Remapping: If source resolution differs from current engine settings,
        // we re-project each point to the new grid coordinate system.
        const sourceRes = data.gridRes || CONFIG.GRID_RES;
        const targetRes = CONFIG.GRID_RES;
        const sourceGridWidth = Math.ceil(360 / sourceRes);

        const mapData = data.mapData;
        const totalEntries = mapData.length;

        // Delta-encoded presets store entry[0] as the gap from the previous
        // cell index instead of the absolute index. The bundled world map is
        // almost fully contiguous, so nearly every gap is 1 and the payload
        // gzips ~5.5MB -> ~1MB (lossless). Reconstruct absolute indices in
        // place so both fill paths below are unchanged. Player saves carry no
        // flag and skip this entirely.
        if (data.mapDataEnc === 'delta') {
            let acc = -1;
            for (let i = 0; i < totalEntries; i++) {
                acc += mapData[i][0];
                mapData[i][0] = acc;
            }
        }

        if (sourceRes === targetRes) {
            // Optimized bulk assignment. The big scenarios carry millions of entries, so we
            // process in chunks and yield to the event loop between them — this keeps the
            // loading bar painting and the spinner alive instead of freezing on a single
            // multi-second synchronous block.
            loadingStatus.innerText = "Rendering Territories...";
            loadingTip.innerText = "Projecting national borders onto the grid...";
            const CHUNK = 250000;
            for (let start = 0; start < totalEntries; start += CHUNK) {
                const end = Math.min(start + CHUNK, totalEntries);
                for (let i = start; i < end; i++) {
                    const entry = mapData[i];
                    const idx = entry[0];
                    const val = entry[1];
                    const bio = entry[2] || 0;

                    if (idx < GS.worldControlMap.length) {
                        GS.worldControlMap[idx] = val;
                        GS.biomeMask[idx] = bio;
                        // Any index present in the mapData array is land
                        GS.landMask[idx] = 1;
                    }
                }
                if (end < totalEntries) {
                    // Drive 35% -> 70% across the fill so the bar visibly advances.
                    const pct = 35 + Math.round((end / totalEntries) * 35);
                    loadingBar.style.width = `${pct}%`;
                    await new Promise(r => setTimeout(r, 0));
                }
            }
            loadingBar.style.width = "70%";
        } else {
            console.log(`Satellite Redrawing: Converting scenario grid (${sourceRes} -> ${targetRes})`);
            // Pre-calculate loop limits and constants for resolution conversion
            const ratio = sourceRes / targetRes;
            const isUpscaling = sourceRes > targetRes;

            for (let i = 0; i < totalEntries; i++) {
                const entry = mapData[i];
                const idx = entry[0];
                const val = entry[1];
                
                const sy = Math.floor(idx / sourceGridWidth);
                const sx = idx % sourceGridWidth;
                const baseLat = (sy * sourceRes) - 90;
                const baseLng = (sx * sourceRes) - 180;
                
                // Robust conversion: Map all target cells covered by the source cell
                const xStart = Math.floor((baseLng + 180) / targetRes);
                const xEnd = Math.floor((baseLng + sourceRes + 180 - 0.0001) / targetRes);
                const yStart = Math.floor((baseLat + 90) / targetRes);
                const yEnd = Math.floor((baseLat + sourceRes + 90 - 0.0001) / targetRes);
                
                for (let ty = yStart; ty <= yEnd; ty++) {
                    if (ty < 0 || ty >= GS.gridHeight) continue;
                    const rowOffset = ty * GS.gridWidth;
                    for (let tx = xStart; tx <= xEnd; tx++) {
                        if (tx < 0 || tx >= GS.gridWidth) continue;
                        const tIdx = rowOffset + tx;
                        if (tIdx < GS.worldControlMap.length) {
                            GS.worldControlMap[tIdx] = val;
                            GS.landMask[tIdx] = 1;
                        }
                    }
                }
            }
        }
        
        // Restore mountain data
        GS.terrainMask.fill(0);
        if (data.mountainData) {
            const mData = data.mountainData;
            for (let i = 0; i < mData.length; i++) {
                const [idx, intensity] = mData[i];
                if (idx < GS.terrainMask.length) {
                    GS.terrainMask[idx] = intensity;
                }
            }
        } else if (!data.isCustomTerrain && GS.mountainsEnabled) {
            // Earth scenario without baked mountains: trigger dynamic GeoJSON terrain scan
            const resToUse = data.mapRes || document.getElementById('map-res-select').value || '110m';
            await loadTerrain(resToUse);
        }

        // Re-generate provinces for the loaded preset to ensure they respect the new borders
        loadingStatus.innerText = "Mapping Provinces...";
        loadingBar.style.width = "80%";
        generateProvinces();

        // Reset adjacency cache whenever map changes
        GS.adjacencyCache = null;

        // Load cities from preset if present, otherwise fall back to global dataset
        loadingStatus.innerText = "Placing Cities...";
        loadingBar.style.width = "90%";
        if (Array.isArray(data.cities)) {
            GS.cities = data.cities.map((c, idx) => ({
                id: c.id || idx + 1,
                name: c.name,
                lat: c.lat,
                lng: c.lng,
                pop: c.pop || 0,
                isCapital: !!c.isCapital,
                ownerId: c.ownerId || null,
                isCustom: !!c.isCustom
            }));
        } else {
            await loadCities();
        }

        GS.gameMode = targetMode;
        DOM.mainMenu.style.display = 'none';
        DOM.mapUi.style.display = 'flex';

        if (targetMode === 'CONQUEST') {
            GS.gameState = 'SELECTING_P1';
            DOM.statusText.innerText = GS.currentScenarioContext ? `PLAYING: ${GS.currentScenarioContext.name}` : getTranslation('SELECT_P1');
            DOM.setupPanel.style.display = 'block';
            DOM.editorToolbox.style.display = 'none';
            DOM.godModeBtn.style.display = 'block';
            DOM.resetBtn.style.display = 'block';
            DOM.statsPanel.style.display = 'none';
        } else {
            GS.gameState = 'EDITOR_ACTIVE';
            DOM.statusText.innerText = GS.currentScenarioContext ? `REMIXING: ${GS.currentScenarioContext.name}` : "Map Editor (Alpha)";
            DOM.setupPanel.style.display = 'none';
            DOM.editorToolbox.style.display = 'flex';
            DOM.statsPanel.style.display = 'none';
        }
        updateRestartVisibility();

        if (GS.activeScenarioId) {
            DOM.editorUpdateBtn.style.display = 'block';
        } else {
            DOM.editorUpdateBtn.style.display = 'none';
        }

        // Capture Instant Quick Restart Snapshots immediately upon scenario load
        GS.initialWorldControlMapSnapshot = new Int32Array(GS.worldControlMap);
        GS.initialDeJureMapSnapshot = new Int32Array(GS.deJureMap);
        GS.initialProvinceMapSnapshot = new Int32Array(GS.provinceMap);
        GS.initialLandMaskSnapshot = new Uint8Array(GS.landMask);
        GS.initialCountryMetadataSnapshot = deepClone(GS.countryMetadata);
        GS.initialCitiesSnapshot = deepClone(GS.cities);

        // Finalize: bounds + first render, then reveal immediately. We yield one frame so the
        // 100% bar paints before the overlay disappears, instead of sitting on a hardcoded
        // 500ms delay that every player paid on every load.
        loadingStatus.innerText = "Finalizing Theater...";
        loadingBar.style.width = "100%";

        // If the user chose to generate random nations earlier, trigger it now after the grid is ready
        if (metaList.length === 0 && userChoice.action === 'generate') {
            await spawnRandomNationsAcrossMap(userChoice.count);
        }

        recalculateAllBounds();
        await new Promise(r => setTimeout(r, 0));
        DOM.loadingOverlay.style.display = 'none';
        DOM.mapUi.style.display = 'flex';
        GS.influenceLayer.render();
        updateRestartVisibility();
    } catch (err) {
        console.error("Satellite Load Error:", err);
        alert(`Error loading preset: ${err.message || "File may be corrupted"}`);
        DOM.loadingOverlay.style.display = 'none';
    } finally {
        _release();   // let the next queued load (if any) proceed
    }
}

export async function spawnRandomNationsAcrossMap(count) {
    if (!GS.worldControlMap || !GS.landMask) return;
    
    loadingStatus.innerText = "Generating Civilizations...";
    DOM.loadingOverlay.style.display = 'flex';
    
    // 1. Identify all valid land indices
    const landIndices = [];
    for (let i = 0; i < GS.landMask.length; i++) {
        if (GS.landMask[i] > 0) {
            landIndices.push(i);
            GS.worldControlMap[i] = 0; // Ensure unowned start
        }
    }

    if (landIndices.length === 0) {
        DOM.loadingOverlay.style.display = 'none';
        alert("SATELLITE ERROR: No landmass identified to populate with civilizations.");
        return;
    }

    const actualCount = Math.min(count, landIndices.length);
    const queues = [];
    
    // 2. Pick random seeds and initialize metadata
    GS.countryMetadata = [];
    for (let i = 0; i < actualCount; i++) {
        let randIdx;
        let attempts = 0;
        // Try to pick seeds that aren't already taken
        do {
            randIdx = landIndices[Math.floor(Math.random() * landIndices.length)];
            attempts++;
        } while (GS.worldControlMap[randIdx] !== 0 && attempts < 100);

        const id = i + 1;
        GS.worldControlMap[randIdx] = id;
        
        const h = Math.floor(Math.random() * 360);
        const s = 60 + Math.random() * 30;
        const l = 40 + Math.random() * 20;
        const color = `hsla(${h}, ${s}%, ${l}%, 0.5)`;
        
        const prefixes = ["United", "New", "Grand", "Great", "North", "South", "East", "West", "Holy", "Royal", "Federal", "Imperial", "Democratic", "People's", "Sovereign"];
        const roots = ["Balt", "Nord", "Slav", "Franc", "Goth", "Rhone", "Iber", "Sax", "Slavia", "Anglo", "Lat", "Turk", "Persia", "Indo", "Sino", "Nippon", "Austral", "Afro", "Euro", "Ameri", "Veld", "Arid", "Boreal", "Luso", "Fenn", "Celt", "Gallic", "Helvet", "Austr", "Magyar", "Pannoni", "Daci", "Thrac", "Levant", "Mesopotam"];
        const suffixes = ["ia", "stan", "land", "ica", "any", "os", "nia", "ria", "via", "dia", "zania", "ga", "tania", "onia", "esia"];
        const forms = [
            "{Prefix} {Root}{Suffix}",
            "Republic of {Root}{Suffix}",
            "Kingdom of {Root}{Suffix}",
            "{Root}{Suffix} Empire",
            "Federation of {Prefix} {Root}{Suffix}",
            "United {Root}{Suffix} States",
            "{Root}{Suffix} Commonwealth"
        ];

        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const root = roots[Math.floor(Math.random() * roots.length)];
        const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
        const form = forms[Math.floor(Math.random() * forms.length)];
        
        const name = form.replace("{Prefix}", prefix).replace("{Root}", root).replace("{Suffix}", suffix);

        const newMeta = {
            id: id,
            name: name,
            color: color,
            rgba: parseColorToRGBA(color),
            isCustom: true,
            bounds: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
        };
        GS.countryMetadata.push(newMeta);

        queues.push([randIdx]);
    }

    // 3. Interleaved Expansion (BFS)
    // We expand each nation one "step" at a time in a round-robin to prevent one nation
    // from instantly claiming a giant continent while others are stuck.
    let unclaimedLand = true;
    let iterations = 0;
    
    while (unclaimedLand) {
        unclaimedLand = false;
        iterations++;
        
        if (iterations % 100 === 0) {
            await new Promise(r => setTimeout(r, 0));
        }

        for (let i = 0; i < actualCount; i++) {
            const q = queues[i];
            const id = i + 1;
            const nextLevel = [];
            
            while (q.length > 0) {
                const curr = q.shift();
                const x = curr % GS.gridWidth;
                const y = Math.floor(curr / GS.gridWidth);

                const neighbors = [
                    curr + 1, curr - 1, curr + GS.gridWidth, curr - GS.gridWidth
                ];

                for (const nIdx of neighbors) {
                    if (nIdx < 0 || nIdx >= GS.worldControlMap.length) continue;
                    // Horizontal wrapping check
                    const nx = nIdx % GS.gridWidth;
                    if (Math.abs(nx - x) > 1) continue; 

                    if (GS.landMask[nIdx] > 0 && GS.worldControlMap[nIdx] === 0) {
                        GS.worldControlMap[nIdx] = id;
                        nextLevel.push(nIdx);
                        unclaimedLand = true;
                    }
                }
                
                // Only process one "layer" per nation per round
                if (q.length === 0) {
                    queues[i] = nextLevel;
                    break;
                }
            }
        }
    }

    generateProvinces();
    recalculateAllBounds();
    DOM.loadingOverlay.style.display = 'none';
    GS.influenceLayer.render();
    DOM.statusText.innerText = `WORLD POPULATED: ${actualCount} nations established.`;
}

export function preloadAssets() {
    const assets = [
        '/assets/img/menu/2022.webp',
        '/assets/img/menu/1974.webp',
        '/assets/img/menu/1942.webp',
        '/assets/img/menu/1936.webp',
        '/assets/img/menu/1914.webp',
        '/assets/img/menu/1804.webp',
        '/assets/img/menu/1492.webp',
        '/assets/img/menu/1.webp',
        'assets/img/Screenshot 2026-03-02 212802.webp',
        '/assets/img/other thing (1).png'
    ];
    assets.forEach(src => {
        const img = new Image();
        img.src = src;
    });
}
