import L from 'leaflet';
import JSZip from 'jszip';
import { getCookie, setCookie, parseColorToRGBA, deepClone } from './utils.js';
import { TRANSLATIONS, getTranslation } from './translations.js';
import { CONFIG, BUFF_STATES, BUFF_METADATA } from './config.js';
import {
    initAudio, resumeAudio,
    playWarAmbiance, stopWarAmbiance,
    playExplosionSound, playClickSound, playWarStartSound, playPeaceSound,
    setMusicVolume, toggleMute, setCustomTrack, clearCustomTrack
} from './audio.js';
import { FLAG_CDN_MAPPING } from './flag-data.js';
import { conquestTutorialSteps, editorTutorialSteps, SCENARIO_MENU_BGS } from './menu-data.js';
import { getProvinceId, isPointInFeature } from './geometry.js';

import { GS } from "./state.js";

import * as DOM from "./dom.js";

import { advanceTutorial, endTutorial, startTutorial, updateTutorialUI } from './ui-tutorial.js';
import { openLeaderboard } from './ui-leaderboard.js';
import { openGlobalChat } from './ui-global-chat.js';
import { findCityAtLatLng, openCityInspector } from './ui-city-inspector.js';
import { openInspector } from './ui-inspector.js';
import { closeHub, loadCountryFromPC, openHub, renderCountryLibrary, renderFlagLibrary, renderHub, saveCountryLocally, switchHubTab } from './ui-hub.js';
import { importSingleCountryFromScenario, loadScenarioForCountryImportFromBlob, loadScenarioForCountryImportFromUrl, openImportCountryModal, renderImportCountryCards } from './ui-import-country.js';

// --- engine module imports ---
import { cycleBuffState, findCodeByName, updateCountryFlag } from './flags.js';
import { applyWorldBounds, getAllianceMembers, getAllianceRootId, getControlValue, getGridIndex, recalculateAllBounds, updateLandMask } from './map-geo.js';
import { generatePresetData, loadCities, loadCountries, loadTerrain, performPresetLoad, preloadAssets } from './scenario-loader.js';
import { activateCountryMidWar, formatGameDate, launchBomb, performSimulationTick, startWar, tickGameTime, triggerRandomWar, updateLoop } from './engine-simulation.js';
import { applyTreaty, setAsReleasable, setVassalage, signSelectivePeace, unclaimSelectedCountry } from './war-diplomacy.js';
import { annexFeatureToCountry, applyPaintAt, clearRefHandles, fillAt, fillTerrainAt, paintAt, placeDivisionAt, placeNewCountry, updateEditorToolPage, updateRefHandles } from './editor-tools.js';
import { updateSidesUI } from './sides-ui.js';

// --- re-exports for previously-extracted UI modules ---
export { estimateUnitsForCountry } from './sides-ui.js';
export { findCodeByName } from './flags.js';
export { getFlagUrl } from './flags.js';
export { openReleaseModal } from './war-diplomacy.js';
export { recruitNeutralMidWar } from './war-diplomacy.js';
export { unilateralExitConflict } from './war-diplomacy.js';
export { getGridIndex } from './map-geo.js';
export { recalculateAllBounds } from './map-geo.js';

/**
 * TRANSLATION SYSTEM (i18n)
 */


function applyLanguage(lang) {
    if (!lang) lang = getCookie('mw_lang') || 'en';
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) {
            el.innerText = dict[key];
        }
    });
    
    // Update dynamic status messages if they are currently set to default strings
    if (DOM.statusText) {
        const currentText = DOM.statusText.innerText;
        
        // Handle complex status strings like "REMIXING: World"
        if (currentText.includes(': ')) {
            const parts = currentText.split(': ');
            const prefixKey = parts[0] === 'REMIXING' ? 'REMIXING' : (parts[0] === 'PLAYING' ? 'PLAYING' : null);
            if (prefixKey && dict[prefixKey]) {
                DOM.statusText.innerText = `${dict[prefixKey]}: ${parts[1]}`;
            }
        } else {
            for (const [key, val] of Object.entries(TRANSLATIONS.en)) {
                if (currentText === val && dict[key]) {
                    DOM.statusText.innerText = dict[key];
                    break;
                }
            }
        }
    }

    const select = document.getElementById('language-select');
    if (select) select.value = lang;
    setCookie('mw_lang', lang);
    
    // Re-translate country metadata
    if (GS.countryMetadata) {
        GS.countryMetadata.forEach(m => {
            if (m && m.name) {
                const trans = getTranslation(m.name, lang, 'NATIONS');
                if (trans !== m.name) m.displayName = trans;
                else m.displayName = m.name;
            }
        });
    }
    
    // Re-translate current simulation side UI
    updateSidesUI();
}


document.getElementById('language-select')?.addEventListener('change', (e) => {
    applyLanguage(e.target.value);
});

/**
 * HELPERS
 */


/**
 * Updates a country's flag across all data structures and UI components.
 */


/**
 * Ensure we have a drawable flag image object for a country metadata entry.
 * This prefers any existing tempFlag, otherwise tries to load from flagUrl.
 */

/**
 * Generate a dynamic puppet flag: left half = puppet, right half = overlord.
 * This is only used for vassalages created after the game has started.
 */


// Global click listener (capture phase) — first gesture unlocks audio + fullscreen.
document.addEventListener('click', (e) => {
    // Auto-fullscreen on first gesture to comply with browser security policies
    if (!GS.disableFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    }

    // Unlock the audio context and start music on first interaction.
    resumeAudio();
    initAudio();

    const interactiveSelector = 'button, .menu-card, input, select, [role="button"], .side-header';
    if (e.target.closest(interactiveSelector)) {
        playClickSound();
    }
}, true);

/**
 * CONFIGURATION & STATE
 */


/**
 * Returns the buff state that should actually affect combat:
 * - If invisible buffs are enabled and a hidden buff exists (not 'none'), it overrides the visible buff.
 * - Otherwise, falls back to the visible buff or 'none'.
 */

/**
 * Cycle a buff state forwards (direction = 1) or backwards (direction = -1).
 */


export function getOptimizationFactor() {
    // More active sides => higher factor => more aggressive optimization
    const activeSides = GS.sides.filter(s => s && s.length > 0).length || 1;
    return Math.max(1, activeSides / 2);
}

GS.gameState = 'MAIN_MENU';
GS.gameMode = 'CONQUEST'; // 'CONQUEST' or 'EDITOR'
GS.mapName = "Untitled Map";
GS.worldWidthDeg = 360;
GS.worldHeightDeg = 180;
GS.missilesEnabled = true;
GS.gameTimeEnabled = false;
GS.gameTimeDate = null; // {year, month, day}
GS.gameTimeAccumulatorMs = 0;
GS.viewMode = 'POLITICAL'; // 'POLITICAL' or 'FLAG'
GS.allianceViewEnabled = false; // when true, alliances override colors/flags in political/flag views
GS.showCountryLabels = true;
GS.showNonCapitalCities = true;

// Cache for screen-space label curves so they don't move with the camera
GS.countryLabelAnchors = new Map(); // key: `${countryId}:${regionIndex}` -> { name, points, fontSize }

GS.showBattleIndicators = false;
GS.cityFocusMode = false;
GS.warDoctrine = 'standard';
GS.doctrineMods = null;

// High‑level commanders ("generals") for each side, used to model strong plans.
GS.generals = [];

GS.sides = [[], []]; // Array of arrays of countries (2 sides — Side A / Side B; multi-side removed per owner)
GS.attackers = GS.sides[0];
GS.defenders = GS.sides[1];
GS.teamAId = -1;
GS.activeSideIndex = 0;
GS.activeScenarioId = null;
GS.ffaMode = false;
GS.randomWarMode = false;
GS.menuDemoActive = false;   // attract-mode: a demo war is auto-playing behind the menu
GS.menuDemoBusy = false;     // re-entrancy guard while a demo is (re)loading
GS.adjacencyCache = null;
GS.teamAColor = 'rgba(255, 50, 50, 0.5)';
GS.teamBColor = 'rgba(50, 100, 255, 0.5)';
GS.lastSelectionTime = 0;
GS.lastSelectedId = -1;
GS.buffedTeam = null; // 'A' or 'B'

// Current remaining manpower for each side (shown as PERSONNEL)
GS.teamASoldiers = 0;

GS.teamBSoldiers = 0;

// Starting manpower snapshot, used to keep casualties consistent with PERSONNEL
GS.initialTeamASoldiers = 0;

GS.initialTeamBSoldiers = 0;

// Dynamic soldiers-per-unit scaling per side (computed at war start)
GS.soldiersPerUnitA = CONFIG.UNIT_TO_SOLDIER_RATIO;

GS.soldiersPerUnitB = CONFIG.UNIT_TO_SOLDIER_RATIO;

// Optional manual manpower overrides entered in the Conflict Setup panel
GS.manualSideAManpower = null;

GS.manualSideBManpower = null;
GS.units = [];
GS.activeBattles = [];
GS.capitalLostCountries = new Set();
GS.bombs = [];
GS.explosions = [];
GS.encirclePops = [];
GS.bases = [];
GS.cities = [];
GS.activeTheaterCities = [];
GS.influenceLayer = null;
GS.rawGeoJsonData = null;

GS.customCountryData = {
    name: '',
    color: '',
    flagUrl: null
};

GS.editingCountryId = -1;
GS.editingCityId = -1;
GS.selectedCountryIds = new Set();
GS.selectingOverlordForId = -1;
GS.selectingAllyForId = -1;
GS.peaceSelection1 = null;
GS.isPainting = false;
GS.lastPaintLatLng = null;
GS.brushSize = 0.5;
GS.isCustomTerrain = false;
GS.cinematicMode = false;
GS.mediaRecorder = null;
GS.recordedChunks = [];

// Overlay System State
GS.customSatelliteUrl = null;

GS.customSatelliteImg = null;
GS.referenceImageUrl = null;
GS.referenceOverlay = null; // L.imageOverlay
GS.refHandles = []; // Array of Leaflet markers
GS.refOpacity = 0.5;
GS.refScale = 1.0;
GS.refAboveTerrain = false;
GS.paintMaskId = -1; // -1 means no mask, >= 0 restricts painting to that ID
GS.peaceTreatiesDisabled = false;
GS.bombsDisabled = false;
GS.activeRebellion = null; // { rebelId, overlordId }
GS.mountainsEnabled = true;
GS.provincesEnabled = false;
GS.showUnitsVisually = true;
GS.disableCountryGradient = false;

// --- Naval revamp (owner): directional warship sprites ---
// 8 pre-rotated frames (owner art), one per compass octant. Loaded lazily on the
// first naval draw so there's zero boot cost for land-only games / cheap phones.
const SHIP_SPRITE_DIRS = ['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se']; // index = round(atan2(dLat,dLng)/45) mod 8
const _shipSprites = {};
let _shipSpritesRequested = false;
function getShipSprite(headingLat, headingLng) {
    if (!_shipSpritesRequested) {
        _shipSpritesRequested = true;
        // In the ?v=N editor preview a bare image src resolves against the page URL with the
        // query dropped (ship-e.png → /ship-e.png), which serves the LIVE revision — where these
        // frames don't exist yet → 404 → ships render as plain dots. Pin the page's own ?v= onto
        // the src so the versioned frames load in preview. Live/promoted players have no ?v=.
        const pageV = new URLSearchParams(location.search).get('v');
        const vq = pageV ? '?v=' + encodeURIComponent(pageV) : '';
        for (const d of SHIP_SPRITE_DIRS) {
            const img = new Image();
            img.src = `ship-${d}.png` + vq;
            _shipSprites[d] = img;
        }
    }
    // atan2(y=north, x=east): 0 = East, 90 = North. Snap to nearest octant.
    let oct = Math.round(Math.atan2(headingLat, headingLng) / (Math.PI / 4));
    oct = ((oct % 8) + 8) % 8;
    const img = _shipSprites[SHIP_SPRITE_DIRS[oct]];
    return (img && img.complete && img.naturalWidth > 0) ? img : null;
}
// Modern Day era shows real satellite imagery (ArcGIS); when on, the political
// country tint is thinned so the actual city/street layout reads through (owner request).
GS.modernEarthImagery = false;

// When false, hiddenBuffState is ignored and only visible buffState is used.
GS.invisibleBuffsEnabled = getCookie('mw_disable_invis_buffs') === 'true' ? false : true;

GS.cityEditMode = null; // 'CREATE' | 'MOVE' | null
GS.animationFrameId = null;
GS.backgroundTickId = null;
GS.simFrameCount = 0;
GS.simSpeed = 0.5;
GS.isPaused = false;
GS.frameAccumulator = 0;
GS.lastTreatyTime = 0;
GS.sideACasualties = 0;
GS.sideBCasualties = 0;
GS.countryCasualties = new Map();
GS.initialCombatants = []; // Tracks nations that started the war for stable casualty menu display
GS.room = null;
GS.currentUsername = null;
GS.flagCodes = null;
GS.currentScenarioContext = null; // { id, name, ownerUsername }
GS.hubReturnState = null;
GS.hubWasInEditor = false;
GS.godModeActive = false;
GS.godBombActive = false;
GS.godBombSourceId = -1;
GS.preGodModeState = 'SIMULATING';
GS.latestCountryStats = new Map();
GS.disableFullscreen = getCookie('mw_disable_fullscreen') === 'true';

// High-performance spatial cache for unit culling and combat
GS.unitSpatialHash = new Map();

export const UNIT_HASH_CELL_SIZE = 2.5; // Degrees per spatial bucket

// Snapshots of borders at scenario start for quick restart
GS.initialWorldControlMapSnapshot = null;

GS.initialDeJureMapSnapshot = null;
GS.initialProvinceMapSnapshot = null;
GS.initialLandMaskSnapshot = null;
GS.initialBiomeMaskSnapshot = null;

// Snapshots for releasables and metadata at scenario start so annexed nations are still releasable on quick restart
GS.initialCountryMetadataSnapshot = null;

GS.initialCitiesSnapshot = null;
GS.countryMetadata = []; // Stores {feature, color, id}

// Multi-side wars are supported: expose the add-side and FFA controls so players can
// run 3+ mutually-hostile sides (each side is an allied team; distinct sides fight each other).

// Hub caches for item details
GS.hubScenarioCache = {};

GS.hubCountryCache = {};

GS.hubFlagCache = {};

// Comment state

GS.currentCommentItemType = null;
GS.currentCommentItemId = null;
GS.currentReplyParentId = null;
GS.currentEditingCommentId = null;
GS.commentsUnsubscribe = null;

// Global chat state
GS.globalChatUnsubscribe = null;

// Temporary holder for loaded scenario used for country import
GS.importScenarioBuffer = null; // { metadata, mapData, gridRes }
GS.selectedImportCountryId = null;
GS.importScenarioCountriesCache = []; // [{id,name,tiles,flagUrl}]

// Remember which scenario option was last used for import (e.g. builtin:modern_2022)
GS.lastImportScenarioKey = null;


// Hook search box once
if (DOM.importCountrySearch) {
    DOM.importCountrySearch.addEventListener('input', () => {
        renderImportCountryCards(DOM.importCountrySearch.value);
    });
}

// Persist core engine settings the moment they change
if (DOM.mapResSelect) {
    DOM.mapResSelect.addEventListener('change', (e) => {
        setCookie('mw_map_res', e.target.value);
    });
}
if (DOM.gridResSelect) {
    DOM.gridResSelect.addEventListener('change', (e) => {
        setCookie('mw_grid_res', e.target.value);
    });
}
if (DOM.unitLimitSelect) {
    DOM.unitLimitSelect.addEventListener('change', (e) => {
        setCookie('mw_unit_limit', e.target.value);
    });
}
if (DOM.disableUnitsVisuallyCheckbox) {
    DOM.disableUnitsVisuallyCheckbox.addEventListener('change', (e) => {
        setCookie('mw_disable_units_visually', e.target.checked ? 'true' : 'false');
    });
}
if (DOM.disableCountryGradientCheckbox) {
    DOM.disableCountryGradientCheckbox.addEventListener('change', (e) => {
        setCookie('mw_disable_country_gradient', e.target.checked ? 'true' : 'false');
    });
}
if (DOM.saveSkipCheckbox) {
    DOM.saveSkipCheckbox.addEventListener('change', (e) => {
        setCookie('mw_skip_settings', e.target.checked ? 'true' : 'false');
    });
}

if (DOM.disableAutoFullscreenCheckbox) {
    DOM.disableAutoFullscreenCheckbox.addEventListener('change', (e) => {
        GS.disableFullscreen = e.target.checked;
        setCookie('mw_disable_fullscreen', GS.disableFullscreen ? 'true' : 'false');
    });
}

// Helper to update loading UI across both standard and thematic containers
const updateLoadingText = (status, progress = null, tip = null) => {
    if (status !== undefined) {
        document.querySelectorAll('.loading-status-text').forEach(el => { el.innerText = status; });
    }
    if (progress !== null) {
        const pct = typeof progress === 'string' ? progress : `${progress}%`;
        document.querySelectorAll('.loading-bar-fill-el').forEach(el => { el.style.width = pct; });
    }
    if (tip !== null) {
        document.querySelectorAll('.loading-tip-text').forEach(el => { el.innerText = tip; });
    }
};

// Define proxy objects for backward compatibility with existing code
export const loadingStatus = {
    set innerText(val) { updateLoadingText(val); },
    get innerText() { return document.querySelector('.loading-status-text')?.innerText; },
    style: { set color(val) { document.querySelectorAll('.loading-status-text').forEach(el => el.style.color = val); } }
};
export const loadingBar = {
    style: {
        set width(val) {
            updateLoadingText(undefined, val);
        }
    }
};
export const loadingTip = {
    set innerText(val) { updateLoadingText(undefined, null, val); },
    get innerText() { return document.querySelector('.loading-tip-text')?.innerText; }
};

export function setLoadingThematic(enabled) {
    if (enabled) {
        DOM.loadingOverlay.classList.add('thematic-overlay');
    } else {
        DOM.loadingOverlay.classList.remove('thematic-overlay');
    }
}

GS.currentTutorialStep = 0;
GS.tutorialActive = false;
GS.activeTutorialSet = [];
GS.activeTutorialKey = 'mw_tutorial_finished';






document.getElementById('tutorial-skip-btn').onclick = () => {
    endTutorial();
};

DOM.tutorialPrevBtn.onclick = () => {
    if (GS.currentTutorialStep > 0) {
        GS.currentTutorialStep--;
        updateTutorialUI();
    }
};

DOM.tutorialBtn.onclick = () => {
    startTutorial(conquestTutorialSteps, 'mw_tutorial_finished');
};
if (DOM.rebellionBtn) {
    // Rebellions are disabled; hide the button and prevent use.
    DOM.rebellionBtn.style.display = 'none';
}

// Buttons use clear text, ensure visibility is correct
if (DOM.quickRestartBtn) {
    DOM.quickRestartBtn.textContent = 'QUICK RESTART';
}
if (DOM.resetBtn) {
    DOM.resetBtn.textContent = 'RESET';
}

export function updateRestartVisibility() {
    if (!DOM.restartScenarioBtn || !DOM.mainMenuBtn || !DOM.quickRestartBtn) return;
    const inEditorLikeMode = (GS.gameMode === 'EDITOR' || GS.godModeActive);
    const hasSnapshots = !!(GS.initialWorldControlMapSnapshot && GS.initialDeJureMapSnapshot);

    // Hide restart + menu + leaderboard while in editor / godmode, show them during normal scenarios
    if (inEditorLikeMode) {
        DOM.restartScenarioBtn.style.display = 'none';
        DOM.quickRestartBtn.style.display = 'none';
        DOM.mainMenuBtn.style.display = 'none';
        if (DOM.leaderboardBtn) DOM.leaderboardBtn.style.display = 'none';
    } else {
        DOM.restartScenarioBtn.style.display = 'block';
        // Only show quick restart if we have the data to do it instantly
        DOM.quickRestartBtn.style.display = hasSnapshots ? 'block' : 'none';
        DOM.mainMenuBtn.style.display = 'block';
        if (DOM.leaderboardBtn) DOM.leaderboardBtn.style.display = 'block';
    }
}

/**
 * INITIALIZATION
 */
export const map = L.map('map', {
    zoomControl: false,
    center: [37, 18],
    zoom: 3,
    minZoom: 2,
    maxZoom: 12,
    worldCopyJump: true,
    dragging: true,
    // Use viscosity so panning against the world-size box feels smooth instead of snapping back
    maxBoundsViscosity: 1.0
});

GS.baseImageryLayer = null;

export function setImageryProvider(provider, persist = true) {
    if (!provider || provider === 'undefined') provider = 'arcgis';
    // Google Earth (satellite) and Google Hybrid (Modern Day city/street) layers were
    // removed — ArcGIS World Imagery is the satellite replacement. Coerce any legacy
    // saved preference or programmatic call over to arcgis so old cookies keep working.
    if (provider === 'google' || provider === 'google_hybrid') provider = 'arcgis';

    if (GS.baseImageryLayer) {
        map.removeLayer(GS.baseImageryLayer);
        GS.baseImageryLayer = null;
    }

    if (provider === 'arcgis') {
        GS.baseImageryLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 19, attribution: 'Tiles &copy; Esri', crossOrigin: 'anonymous' }
        );
        GS.baseImageryLayer.addTo(map);
    } else if (provider === 'google_cartoon') {
        GS.baseImageryLayer = L.tileLayer(
            'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
            { opacity: 1.0, maxZoom: 19, attribution: '&copy; Google', crossOrigin: 'anonymous' }
        );
        GS.baseImageryLayer.addTo(map);
    }
    // 'wargames' / simplified mode has no tile layer, so baseImageryLayer stays null.

    if (persist) {
        setCookie('mw_imagery', provider);
    }
    
    if (DOM.imagerySelect) DOM.imagerySelect.value = provider;
    
    const c = map.getContainer();
    if (c) c.style.background = '#000';

    if (GS.influenceLayer) {
        GS.influenceLayer._forceRender = true;
        if (typeof GS.influenceLayer._update === 'function') GS.influenceLayer._update();
    }
}

/*
 * Initialize imagery style based on saved preference.
 */
setImageryProvider(getCookie('mw_imagery') || 'arcgis');

if (DOM.imagerySelect) {
    DOM.imagerySelect.addEventListener('change', (e) => {
        setImageryProvider(e.target.value);
    });
}

const ControlMapLayer = L.Layer.extend({
    onAdd: function(map) {
        // Create a canvas that is viewport-locked rather than layer-locked to ensure
        // screen-space coordinates (container points) map 1:1 without parent transform interference.
        this._container = L.DomUtil.create('canvas', '');
        this._container.style.position = 'absolute';
        this._container.style.top = '0';
        this._container.style.left = '0';
        this._container.style.pointerEvents = 'none';
        this._container.style.zIndex = '400';
        
        this._lastZoom = map.getZoom();
        this._renderRequested = false;
        this._visitId = 0;
        this._zooming = false;
        
        // Append to map container directly to avoid double-transforms from mapPane/overlayPane
        map.getContainer().appendChild(this._container);
        
        this._update();

        this._onMove = () => {
            if (!this._renderRequested) {
                this._renderRequested = true;
                requestAnimationFrame(() => {
                    this._update();
                    this._renderRequested = false;
                });
            }
        };

        map.on('move', this._onMove, this);
        map.on('moveend', this._onMove, this);
        // Track active drag-panning. While the user is dragging, the viewport bounds
        // shift every frame, which otherwise forces the heavy label flood-fill to
        // recompute on every single frame (the main source of pan stutter in big
        // wars). During the drag we reuse the cached grid-space segmentation instead
        // — labels reproject from lat/lng every frame regardless, so it looks
        // identical — then recompute fresh on moveend once the pan settles.
        map.on('movestart', () => { this._panning = true; }, this);
        map.on('moveend', () => { this._panning = false; }, this);
        map.on('zoomstart', () => { this._zooming = true; }, this);
        map.on('zoomend', () => { 
            this._zooming = false; 
            this._update(); 
            // Satellite stabilization: trigger a delayed cleanup render to ensure 
            // grid projection aligns with final post-zoom viewport coordinates.
            setTimeout(() => {
                this._forceRender = true;
                this._onMove();
            }, 100);
        }, this);
    },
    onRemove: function(map) {
        if (this._container && this._container.parentNode) {
            this._container.parentNode.removeChild(this._container);
        }
        map.off('move', this._onMove, this);
        map.off('zoomstart');
        map.off('zoomend');
    },
    _update: function() {
        const size = map.getSize();
        const dpr = window.devicePixelRatio || 1;
        const newW = Math.round(size.x * dpr);
        const newH = Math.round(size.y * dpr);

        if (this._container.width !== newW || this._container.height !== newH) {
            this._container.width = newW;
            this._container.height = newH;
            this._container.style.width = size.x + 'px';
            this._container.style.height = size.y + 'px';
        }

        const isSimulating = (GS.gameState === 'SIMULATING' || (GS.godModeActive && GS.preGodModeState === 'SIMULATING')) && !GS.isPaused;
        const mapMoved = !this._lastBounds || !this._lastBounds.equals(map.getBounds());
        
        if (isSimulating || mapMoved || this._forceRender) {
            this.render();
            this._lastBounds = map.getBounds();
            this._forceRender = false;
        }
    },
    render: function() {
        if (!GS.worldControlMap || !GS.landMask) return;
        const viewBounds = map.getBounds();
        const bounds = viewBounds; 
        const res = CONFIG.GRID_RES;
        const currentZoom = map.getZoom();
        
        // SATELLITE ENGINE STABILIZATION:
        // Handle longitude wrap-around (e.g. crossing the 180 meridian).
        // If the viewport wraps or is zoomed out enough to see the whole world, 
        // we default to the full horizontal grid span to prevent negative width RangeErrors.
        let xMin = Math.max(0, Math.floor((bounds.getWest() + 180) / res));
        let xMax = Math.min(GS.gridWidth - 1, Math.ceil((bounds.getEast() + 180) / res));
        
        if (xMin > xMax || (bounds.getEast() - bounds.getWest() >= 360)) {
            xMin = 0;
            xMax = GS.gridWidth - 1;
        }

        const yMin = Math.max(0, Math.floor((bounds.getSouth() + 90) / res));
        const yMax = Math.min(GS.gridHeight - 1, Math.ceil((bounds.getNorth() + 90) / res));

        const terrain = GS.terrainMask;
        const ctx = this._container.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const isWar = GS.gameState === 'SIMULATING' || (GS.godModeActive && GS.preGodModeState === 'SIMULATING');
        // Use the active dropdown value rather than the cookie to support non-persisted session-only mode switches
        const currentImagery = DOM.imagerySelect ? DOM.imagerySelect.value : (getCookie('mw_imagery') || 'arcgis');
        const isSimplifiedMode = currentImagery === 'wargames';
        // Custom terrain maps always use the Simplified/WarGames base (ocean/neutral land) for visual clarity
        const useSimplifiedBase = isSimplifiedMode || GS.isCustomTerrain;

        ctx.clearRect(0, 0, this._container.width, this._container.height);
        ctx.save();
        ctx.scale(dpr, dpr);

        // --- COMPOSITE LEAFLET TILES INTO CANVAS ---
        // Optimization: Only draw tiles into canvas if we are actively capturing for Hub/Video.
        // Leaflet already renders these to the screen; re-drawing them on canvas is a huge redundant GPU hit.
        if (!useSimplifiedBase && (GS.cinematicMode || this._isCapturing)) {
            const tilePane = map.getPane('tilePane');
            if (tilePane) {
                const tiles = tilePane.querySelectorAll('img.leaflet-tile');
                const mapRect = map.getContainer().getBoundingClientRect();
                tiles.forEach(tile => {
                    if (tile.complete && tile.naturalWidth > 0) {
                        const rect = tile.getBoundingClientRect();
                        const x = rect.left - mapRect.left;
                        const y = rect.top - mapRect.top;
                        
                        if (x + rect.width > 0 && y + rect.height > 0 && x < mapRect.width && y < mapRect.height) {
                            const opacity = window.getComputedStyle(tile).opacity;
                            ctx.globalAlpha = parseFloat(opacity) || 1.0;
                            try {
                                ctx.drawImage(tile, x, y, rect.width, rect.height);
                            } catch (e) {
                                // Silent catch for CORS
                            }
                            ctx.globalAlpha = 1.0;
                        }
                    }
                });
            }
        }
        
        // Optimization: Pre-calculate pole map for faster lookups in render loop
        // Optimization: Pre-calculate pole map for faster lookups in render loop
        const metaMaxId = GS.countryMetadata.reduce((max, m) => m ? Math.max(max, m.id) : max, 0);
        const sovereignPoleMap = new Int8Array(metaMaxId + 1); // 1 for A, -1 for B, 0 otherwise
        GS.sides.forEach((side, idx) => {
            const pole = (idx % 2 === 0) ? 1 : -1;
            side.forEach(c => {
                if (c.id > 0 && c.id <= metaMaxId) sovereignPoleMap[c.id] = pole;
            });
        });

        // Alliance mapping: group countries into alliances via mutual allies graph.
        // Root = smallest id in connected component. Every country gets a key so “non‑aligned” shows too.
        const allianceKeyById = new Int32Array(metaMaxId + 1); // root id per country
        const allianceColorByRoot = {}; // rootId -> [r,g,b,a]
        const allianceFlagMetaByRoot = {}; // rootId -> meta used for alliance flag

        // These maps are consumed only under `GS.allianceViewEnabled` (region fill, flags,
        // labels). When alliance view is off — the common case — the BFS below is pure wasted
        // work recomputed every painted frame, so skip it and leave the maps empty.
        if (GS.allianceViewEnabled && GS.countryMetadata && GS.countryMetadata.length) {
            const visitedAlliance = new Uint8Array(metaMaxId + 1);

            for (let i = 0; i < GS.countryMetadata.length; i++) {
                const m = GS.countryMetadata[i];
                if (!m || !m.id) continue;
                const id = m.id;
                if (visitedAlliance[id]) continue;

                // BFS over allies graph to find connected component
                const queue = [id];
                const component = [];
                visitedAlliance[id] = 1;
                while (queue.length) {
                    const cid = queue.shift();
                    component.push(cid);
                    const cMeta = GS.countryMetadata[cid - 1];
                    const allies = (cMeta && Array.isArray(cMeta.allies)) ? cMeta.allies : [];
                    allies.forEach(aid => {
                        if (aid > 0 && aid <= metaMaxId && !visitedAlliance[aid]) {
                            visitedAlliance[aid] = 1;
                            queue.push(aid);
                        }
                    });
                }

                // Root = minimum id in this component
                const rootId = component.reduce((min, v) => Math.min(min, v), component[0]);
                component.forEach(cid => {
                    allianceKeyById[cid] = rootId;
                });

                const rootMeta = GS.countryMetadata[rootId - 1];
                const rgba = rootMeta && rootMeta.rgba ? rootMeta.rgba : [180, 180, 180, 1];
                allianceColorByRoot[rootId] = rgba;
                allianceFlagMetaByRoot[rootId] = rootMeta || null;
            }
        }

        if (useSimplifiedBase) {
            const size = map.getSize();
            // Always render the procedural ocean/land gradient; custom satellite imagery is disabled.
            const centerLng = map.getCenter().lng;
            const grad = ctx.createLinearGradient(0, 0, 0, size.y);
            
            // Generate a latitude-aware gradient by sampling the viewport's geographic coordinates
            const stops = 12;
            for (let i = 0; i <= stops; i++) {
                const pct = i / stops;
                const screenY = size.y * pct;
                let lat = 0;
                try {
                    // Convert screen position to latitude for color calculation
                    lat = map.containerPointToLatLng([0, screenY]).lat;
                } catch(e) {}
                
                // Add noise to the equator logic so transitions aren't perfectly uniform
                // Noise is tied to longitude and screen stop index for a dynamic, non-perfect feel
                const noise = Math.sin(i * 0.7 + centerLng * 0.04) * 3.5;
                const absLat = Math.min(90, Math.max(0, Math.abs(lat) + noise));
                const t = Math.min(1, Math.max(0, absLat / 90));
                
                // Narrower, more subtle ocean color spectrum
                // Equator (0): rgb(5, 52, 72)
                // Poles (1): rgb(2, 18, 34)
                const r = Math.round(5 * (1 - t) + 2 * t);
                const g = Math.round(52 * (1 - t) + 18 * t);
                const b = Math.round(72 * (1 - t) + 34 * t);
                
                grad.addColorStop(pct, `rgb(${r},${g},${b})`);
            }
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, size.x, size.y);
        }

        // Draw reference image underneath terrain/countries but above ocean/background
        // when "Draw Above Terrain" is disabled. This now runs after both tile and
        // simplified ocean rendering so the guide is never hidden by the water layer.
        if (
            !this._isCapturing &&
            !GS.refAboveTerrain &&
            GS.referenceImageUrl &&
            GS.referenceOverlay &&
            (GS.gameMode === 'EDITOR' || GS.gameMode === 'EDITOR_TEST' || GS.godModeActive)
        ) {
            const img = GS.referenceOverlay.getElement();
            if (img && img.complete && img.naturalWidth > 0) {
                const b = GS.referenceOverlay.getBounds();
                const pTL = map.latLngToContainerPoint(b.getNorthWest());
                const pBR = map.latLngToContainerPoint(b.getSouthEast());
                ctx.save();
                ctx.globalAlpha = GS.refOpacity;
                ctx.drawImage(img, pTL.x, pTL.y, pBR.x - pTL.x, pBR.y - pTL.y);
                ctx.restore();
            }
        }

        // Performance optimization: Downsample grid sampling dynamically.
        // During active zoom animations or ultra-high speeds, we use a coarser step.
        let step = 1;
        const vArea = (xMax - xMin) * (yMax - yMin);
        
        // Dynamic sampling based on zoom level and engine load
        const isEditing = GS.gameMode === 'EDITOR' || GS.gameMode === 'EDITOR_TEST' || GS.godModeActive;
        if (isEditing) {
            step = 1;
        } else if (this._zooming) {
            step = currentZoom <= 3 ? 4 : (currentZoom <= 5 ? 2 : 1);
        } else {
            if (currentZoom <= 3) step = 4;
            else if (currentZoom <= 4) step = 2;
            // Load-adaptive downsampling: a war that sprawls across the map blows up the
            // visible-grid scan (the fill, frontline and border passes all walk every cell),
            // which is what makes far-apart-country wars chug on phones. Coarsen the render grid
            // by how much area we're drawing, regardless of sim speed — a small zoomed-in war
            // (e.g. germany vs poland) keeps full detail, a sprawling far war draws coarser but
            // stays smooth. Render-only: the simulation is untouched so war outcomes are identical.
            else if (vArea > 600000) step = 3;
            else if (vArea > 150000) step = 2;
            else step = 1;
        }

        const getGridPoint = (gx, gy) => {
            const lat = (gy * CONFIG.GRID_RES) - 90;
            const lng = (gx * CONFIG.GRID_RES) - 180;
            return map.latLngToContainerPoint([lat, lng]);
        };

        // --- REGION SEGMENTATION & DATA COLLECTION ---
        // Performance Fix: "only render parts of flags that are onscreen"
        // We limit contiguous blob detection to a slightly padded viewport and use global metadata
        // bounds for UV mapping, preventing the engine from walking entire massive nations like Russia.
        let regions = [];

        // Label-region throttle (weak-phone perf). In POLITICAL view (the default
        // most mobile players see) `regions` is consumed ONLY to anchor country
        // LABELS, whose screen positions get re-projected from lat/lng every frame
        // regardless — so the underlying grid-space segmentation can be reused for a
        // few frames with no visible change. This flood-fill + per-region 4-bin
        // centroid pass is the heaviest per-frame allocator here (a fresh pixel array
        // + bin pass per country, every painted frame), so recomputing it every Nth
        // frame instead of every frame cuts that GC/CPU churn ~80% in big sprawling
        // wars. Territory paint (PASS 1 below) stays fresh every frame, so the map
        // itself never stutters. FLAG view is EXEMPT: there `region.pixels` is the
        // flag clip mask and must match live territory exactly, so it always recomputes.
        const wantRegions = (GS.viewMode === 'FLAG' || GS.showCountryLabels) && GS.flagProcessedBuffer;
        const LABEL_THROTTLE_N = 5;
        this._labelFrame = (this._labelFrame || 0) + 1;
        const labelBoundsChanged =
            !this._labelCacheBounds ||
            !this._labelCacheBounds.equals(viewBounds) ||
            this._labelCacheZoom !== currentZoom;
        const canReuseRegions =
            wantRegions &&
            GS.viewMode !== 'FLAG' &&
            !isEditing &&
            this._cachedRegions &&
            (
                // Active drag-pan (but not a zoom): always reuse the cached segmentation
                // so the heavy flood-fill doesn't re-run on every panned frame.
                (this._panning && !this._zooming) ||
                // Otherwise, the existing every-Nth-frame throttle while the view is still.
                (!labelBoundsChanged && (this._labelFrame % LABEL_THROTTLE_N !== 0))
            );

        if (!wantRegions) {
            this._cachedRegions = null;
        }

        if (canReuseRegions) {
            regions = this._cachedRegions;
        } else if (wantRegions) {
            this._visitId = (this._visitId || 0) + 1;
            const visitId = this._visitId;

            // In FLAG view we always sample at full resolution to avoid blocky / dotted flags.
            // For label-only mode we still downsample for performance when zoomed out.
            let samplingStep = 1;
            if (GS.viewMode !== 'FLAG') {
                if (currentZoom < 4) samplingStep = 4;
                else if (currentZoom < 6) samplingStep = 2;
            }

            const startX = Math.floor(xMin / samplingStep) * samplingStep;
            const startY = Math.floor(yMin / samplingStep) * samplingStep;

            for (let y = startY; y <= yMax; y += samplingStep) {
                const rowOffset = y * GS.gridWidth;
                for (let x = startX; x <= xMax; x += samplingStep) {
                    const idx = rowOffset + x;
                    if (GS.flagProcessedBuffer[idx] === visitId) continue;

                    const sovereignId = GS.worldControlMap[idx];
                    if (sovereignId <= 0) continue;
                    
                    let effectiveOwner = sovereignId;
                    if (isWar && GS.landMask[idx] === 2) {
                        const occ = GS.occupationMap[idx];
                        const sPole = sovereignPoleMap[sovereignId] || 0;
                        const isOccupiedByEnemy = (sPole === 1) ? (occ < -0.1) : (occ > 0.1);
                        if (isOccupiedByEnemy) {
                            effectiveOwner = GS.primaryOccupierMap[idx] || effectiveOwner;
                        }
                    }
                    
                    if (effectiveOwner > 0) {
                        const regionPixels = [];
                        const queue = [idx];
                        GS.flagProcessedBuffer[idx] = visitId;
                        
                        let latSum = 0, lngSum = 0, count = 0;
                        
                        // Contiguous search limited to viewport + padding to fulfill "only onscreen" directive
                        const pad = 25; 
                        const vXMin = Math.max(0, xMin - pad);
                        const vXMax = Math.min(GS.gridWidth - 1, xMax + pad);
                        const vYMin = Math.max(0, yMin - pad);
                        const vYMax = Math.min(GS.gridHeight - 1, yMax + pad);

                        while (queue.length > 0) {
                            const curr = queue.pop();
                            const cy = Math.floor(curr / GS.gridWidth);
                            const cx = curr % GS.gridWidth;
                            
                            if (cx >= xMin && cx <= xMax && cy >= yMin && cy <= yMax) {
                                regionPixels.push(curr);
                            }
                            
                            const lat = (cy * CONFIG.GRID_RES) - 90;
                            const lng = (cx * CONFIG.GRID_RES) - 180;
                            latSum += lat; lngSum += lng; count++;

                            const neighbors = [curr + samplingStep, curr - samplingStep, curr + GS.gridWidth * samplingStep, curr - GS.gridWidth * samplingStep];
                            for (const nIdx of neighbors) {
                                if (nIdx < 0 || nIdx >= GS.gridWidth * GS.gridHeight || GS.flagProcessedBuffer[nIdx] === visitId) continue;
                                
                                const ny = Math.floor(nIdx / GS.gridWidth);
                                const nx = nIdx % GS.gridWidth;
                                if (nx < vXMin || nx > vXMax || ny < vYMin || ny > vYMax) continue;

                                const nSovereign = GS.worldControlMap[nIdx];
                                let nEffectiveOwner = nSovereign;
                                if (isWar && GS.landMask[nIdx] === 2) {
                                    const occ = GS.occupationMap[nIdx];
                                    const sPole = sovereignPoleMap[nSovereign] || 0;
                                    const isOccupiedByEnemy = (sPole === 1) ? (occ < -0.1) : (occ > 0.1);
                                    if (isOccupiedByEnemy) nEffectiveOwner = GS.primaryOccupierMap[nIdx] || nEffectiveOwner;
                                }

                                if (nEffectiveOwner === effectiveOwner) {
                                    GS.flagProcessedBuffer[nIdx] = visitId;
                                    queue.push(nIdx);
                                }
                            }
                        }

                        if (regionPixels.length > 0) {
                            // Calculate local Lat/Lng bounds for label scaling
                            let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
                            let regMinX = Infinity, regMaxX = -Infinity, regMinY = Infinity, regMaxY = -Infinity;
                            regionPixels.forEach(pxIdx => {
                                const py = Math.floor(pxIdx / GS.gridWidth);
                                const px = pxIdx % GS.gridWidth;
                                const lat = (py * CONFIG.GRID_RES) - 90;
                                const lng = (px * CONFIG.GRID_RES) - 180;
                                if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
                                if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
                                if (px < regMinX) regMinX = px;
                                if (px > regMaxX) regMaxX = px;
                                if (py < regMinY) regMinY = py;
                                if (py > regMaxY) regMaxY = py;
                            });

                            // Build 4 bins along the region's width so each disconnected landmass
                            // gets its own curved label spine independent of overseas territories.
                            const bins = Array.from({ length: 4 }, () => ({ latSum: 0, lngSum: 0, count: 0 }));
                            const width = Math.max(1, regMaxX - regMinX + 1);
                            regionPixels.forEach(pxIdx => {
                                const py = Math.floor(pxIdx / GS.gridWidth);
                                const px = pxIdx % GS.gridWidth;
                                const lat = (py * CONFIG.GRID_RES) - 90;
                                const lng = (px * CONFIG.GRID_RES) - 180;
                                const rel = (px - regMinX) / width;
                                const binIdx = Math.max(0, Math.min(3, Math.floor(rel * 4)));
                                const b = bins[binIdx];
                                b.latSum += lat;
                                b.lngSum += lng;
                                b.count++;
                            });

                            // Fallback for empty bins: interpolate from neighbors or region center
                            const centerLat = latSum / count;
                            const centerLng = lngSum / count;
                            for (let i = 0; i < 4; i++) {
                                if (bins[i].count === 0) {
                                    let left = null, right = null;
                                    for (let j = i - 1; j >= 0; j--) {
                                        if (bins[j].count > 0) { left = bins[j]; break; }
                                    }
                                    for (let j = i + 1; j < 4; j++) {
                                        if (bins[j].count > 0) { right = bins[j]; break; }
                                    }
                                    if (left && right) {
                                        bins[i].latSum = (left.latSum / left.count + right.latSum / right.count) / 2;
                                        bins[i].lngSum = (left.lngSum / left.count + right.lngSum / right.count) / 2;
                                        bins[i].count = 1;
                                    } else if (left && left.count > 0) {
                                        bins[i].latSum = left.latSum;
                                        bins[i].lngSum = left.lngSum;
                                        bins[i].count = left.count;
                                    } else if (right && right.count > 0) {
                                        bins[i].latSum = right.latSum;
                                        bins[i].lngSum = right.lngSum;
                                        bins[i].count = right.count;
                                    } else {
                                        bins[i].latSum = centerLat;
                                        bins[i].lngSum = centerLng;
                                        bins[i].count = 1;
                                    }
                                }
                            }

                            regions.push({
                                id: effectiveOwner,
                                sovereignId: sovereignId,
                                pixels: regionPixels,
                                latSum, lngSum, count,
                                minLat, maxLat, minLng, maxLng,
                                regMinX,
                                regMaxX,
                                regMinY,
                                regMaxY,
                                bins
                            });
                        }
                    }
                }
            }

            // Cache this fresh segmentation so the next few painted frames can reuse
            // it (POLITICAL/label view only — see throttle note above).
            this._cachedRegions = regions;
            this._labelCacheBounds = viewBounds;
            this._labelCacheZoom = currentZoom;
        }

        // PASS 1: Base Background & Topography Rendering (Greedy Meshing)
        {
            const vWidth = xMax - xMin + 1;
            const vHeight = yMax - yMin + 1;
            
            // GC Optimization: Pre-allocate reusable buffers for the greedy mesh pass instead of new Array().fill(null)
            const maxVSize = GS.gridWidth * GS.gridHeight;
            if (!this._viewportFills || this._viewportFills.length < maxVSize) {
                this._viewportFills = new Array(maxVSize);
                this._processedCells = new Uint8Array(maxVSize);
            }
            
            // Only clear the specific bounds we are iterating over
            for (let vy = 0; vy < vHeight; vy += step) {
                const rowOffset = vy * vWidth;
                for (let vx = 0; vx < vWidth; vx += step) {
                    this._viewportFills[rowOffset + vx] = null;
                    this._processedCells[rowOffset + vx] = 0;
                }
            }
            
            const viewportFills = this._viewportFills;
            
            // 1. Pass: Pre-calculate fill styles and Label Data
            for (let vy = 0; vy < vHeight; vy += step) {
                const y = yMin + vy;
                const rowOffset = vy * vWidth;
                for (let vx = 0; vx < vWidth; vx += step) {
                    const x = xMin + vx;
                    if (x >= GS.gridWidth || y >= GS.gridHeight) continue;
                    
                    const idx = y * GS.gridWidth + x;
                    const sovereignId = GS.worldControlMap[idx];
                    const occ = GS.occupationMap[idx];
                    const lMask = GS.landMask[idx];
                    const isWarZone = lMask === 2;
                    const isStable = lMask === 1;

                    if (isWarZone || isStable) {
                        let fillStyle = null;
                        let baseRgba = [150, 150, 150];
                        let alpha = (isSimplifiedMode && !GS.isCustomTerrain) ? 1.0 : (GS.modernEarthImagery ? 0.45 : 0.65);
                        let effectiveId = sovereignId;

                        // FLAG MODE OVERRIDE: Render all land using the neutral "Map" palette so topography
                        // and biomes are visible behind the country flags.
                        let isBackgroundPass = GS.viewMode === 'FLAG';

                        if (sovereignId === 0 || isBackgroundPass) {
                            if (useSimplifiedBase) {
                                const isDesert = GS.biomeMask[idx] === 1;
                                baseRgba = isDesert ? [140, 120, 70] : [20, 38, 20];
                                alpha = 1.0;
                            } else if (!isBackgroundPass) {
                                continue;
                            }
                        }
                        
                        if (sovereignId > 0 && !isBackgroundPass) {
                            // Alliance view: collapse members into a single color
                            if (GS.allianceViewEnabled) {
                                const rootId = allianceKeyById[sovereignId] || sovereignId;
                                const allianceRgba = allianceColorByRoot[rootId] || [180, 180, 180, 1];
                                baseRgba = [allianceRgba[0], allianceRgba[1], allianceRgba[2]];
                                alpha = (isSimplifiedMode && !GS.isCustomTerrain) ? 1.0 : 0.85;
                            } else {
                                let meta = GS.countryMetadata[sovereignId - 1];
                                if (!meta) {
                                    baseRgba = [150, 150, 150];
                                    alpha = 0.600;
                                } else {
                                    let effectiveRgba = meta.rgba;
                                    if (meta.overlordId) {
                                        const overlordMeta = GS.countryMetadata[meta.overlordId - 1];
                                        if (overlordMeta) {
                                            effectiveRgba = [
                                                Math.round(overlordMeta.rgba[0] * 0.75 + meta.rgba[0] * 0.25),
                                                Math.round(overlordMeta.rgba[1] * 0.75 + meta.rgba[1] * 0.25),
                                                Math.round(overlordMeta.rgba[2] * 0.75 + meta.rgba[2] * 0.25),
                                                meta.rgba[3] || 1
                                            ];
                                        }
                                    }

                                    baseRgba = [effectiveRgba[0], effectiveRgba[1], effectiveRgba[2]];
                                    alpha = (isSimplifiedMode && !GS.isCustomTerrain) ? 1.0 : (GS.modernEarthImagery ? 0.45 : 0.65);

                                    if (isWar && isWarZone && Math.abs(occ) > 0.01) {
                                        const isTeamAOccupying = occ > 0;
                                        const sPole = sovereignPoleMap[sovereignId] || 0;
                                        const isOccupiedLand = isTeamAOccupying ? sPole !== 1 : sPole !== -1;

                                        if (isOccupiedLand) {
                                            const occupierId = GS.primaryOccupierMap[idx];
                                            const occMeta = occupierId > 0 ? GS.countryMetadata[occupierId - 1] : null;
                                            if (occupierId > 0) effectiveId = occupierId;
                                            const occColor = occMeta ? occMeta.rgba : (isTeamAOccupying ? [255, 50, 50, 0.5] : [50, 100, 255, 0.5]);
                                            baseRgba = [
                                                Math.round(occColor[0] * 0.7 + 255 * 0.3),
                                                Math.round(occColor[1] * 0.7 + 255 * 0.3),
                                                Math.round(occColor[2] * 0.7 + 255 * 0.3)
                                            ];
                                            alpha = 0.85;
                                        } else {
                                            alpha = 0.7;
                                        }
                                    } 
                                }
                            }
                        }

                        // Apply mountain visuals across all states (War or Peace), including neutral land
                        if (GS.mountainsEnabled && terrain && terrain[idx] > 0) {
                            const intensity = terrain[idx];
                            
                            if (useSimplifiedBase && sovereignId === 0) {
                                // In Simplified Mode on neutral land, use a "highlight" for mountains to make them pop
                                // instead of just darkening, since the base color is already quite dark.
                                const lift = intensity * 42;
                                baseRgba[0] = Math.min(255, baseRgba[0] + lift);
                                baseRgba[1] = Math.min(255, baseRgba[1] + lift * 1.1);
                                baseRgba[2] = Math.min(255, baseRgba[2] + lift);
                                alpha = 0.95;
                            } else {
                                const dim = 0.7 - (intensity * 0.25);
                                baseRgba[0] = Math.floor(baseRgba[0] * dim);
                                baseRgba[1] = Math.floor(baseRgba[1] * dim);
                                baseRgba[2] = Math.floor(baseRgba[2] * dim);
                                
                                if (isWar) {
                                    alpha *= 0.75; 
                                } else {
                                    alpha = 0.75; 
                                }
                            }
                        }

                        if (useSimplifiedBase) {
                             fillStyle = `WG_${effectiveId}_${baseRgba.join(',')}_${alpha.toFixed(3)}_${GS.biomeMask[idx]}`;
                        } else {
                             fillStyle = `rgba(${baseRgba[0]},${baseRgba[1]},${baseRgba[2]},${alpha.toFixed(3)})`;
                        }
                        viewportFills[rowOffset + vx] = fillStyle;
                    }
                }
            }

            // 2. Pass: Greedy Mesh Rendering
            const processed = this._processedCells;
            const gridXPositions = new Float32Array(vWidth + 1);
            const gridYPositions = new Float32Array(vHeight + 1);
            for (let x = 0; x <= vWidth; x++) gridXPositions[x] = getGridPoint(xMin + x, yMin).x;
            for (let y = 0; y <= vHeight; y++) gridYPositions[y] = getGridPoint(xMin, yMin + y).y;

            for (let vy = 0; vy < vHeight; vy += step) {
                const rowOffset = vy * vWidth;
                for (let vx = 0; vx < vWidth; vx += step) {
                    const vIdx = rowOffset + vx;
                    const fill = viewportFills[vIdx];
                    if (fill === null || processed[vIdx]) continue;

                    // Mesh Width (respecting sampling step)
                    let mw = step;
                    while (vx + mw < vWidth && viewportFills[rowOffset + vx + mw] === fill && !processed[rowOffset + vx + mw]) {
                        mw += step;
                    }
                    if (vx + mw > vWidth) mw = vWidth - vx;

                    // Mesh Height (respecting sampling step)
                    let mh = step;
                    while (vy + mh < vHeight) {
                        let rowMatch = true;
                        const nextRowOffset = (vy + mh) * vWidth;
                        for (let k = 0; k < mw; k += step) {
                            if (viewportFills[nextRowOffset + vx + k] !== fill || processed[nextRowOffset + vx + k]) {
                                rowMatch = false;
                                break;
                            }
                        }
                        if (!rowMatch) break;
                        mh += step;
                    }
                    if (vy + mh > vHeight) mh = vHeight - vy;

                    // Draw Mesh
                    const pX1 = gridXPositions[vx];
                    const pX2 = gridXPositions[vx + mw];
                    const pY1 = gridYPositions[vy];
                    const pY2 = gridYPositions[vy + mh];
                    
                    const drawX = Math.min(pX1, pX2);
                    const drawY = Math.min(pY1, pY2);
                    const drawW = Math.abs(pX2 - pX1);
                    const drawH = Math.abs(pY2 - pY1);

                    if (drawW > 0 && drawH > 0) {
                        if (typeof fill === 'string' && fill.startsWith('WG_')) {
                            const parts = fill.split('_');
                            const sid = parseInt(parts[1]);
                            const colorParts = parts[2].split(',').map(Number);
                            const a = parts[3] || '1';
                            const biome = parseInt(parts[4]) || 0;

                            if (biome === 1) {
                                // Apply desert tint to country color: lighter, yellower, and desaturated
                                colorParts[0] = Math.min(255, colorParts[0] * 1.1 + 30);
                                colorParts[1] = Math.min(255, colorParts[1] * 1.1 + 10);
                                colorParts[2] = Math.max(0, colorParts[2] * 0.85);
                            }

                            const meta = GS.countryMetadata[sid - 1];
                            if (!GS.disableCountryGradient && meta && meta.bounds) {
                                const pTop = getGridPoint(0, meta.bounds.minY).y;
                                const pBottom = getGridPoint(0, meta.bounds.maxY).y;
                                const g = ctx.createLinearGradient(0, pTop, 0, pBottom);
                                g.addColorStop(0, `rgba(${Math.min(255, colorParts[0] + 25)},${Math.min(255, colorParts[1] + 25)},${Math.min(255, colorParts[2] + 25)},${a})`);
                                g.addColorStop(0.3, `rgba(${colorParts[0]},${colorParts[1]},${colorParts[2]},${a})`);
                                g.addColorStop(1, `rgba(${Math.floor(colorParts[0] * 0.65)},${Math.floor(colorParts[1] * 0.65)},${Math.floor(colorParts[2] * 0.65)},${a})`);
                                ctx.fillStyle = g;
                            } else {
                                ctx.fillStyle = `rgba(${colorParts[0]},${colorParts[1]},${colorParts[2]},${a})`;
                            }
                        } else {
                            ctx.fillStyle = fill;
                        }
                        // Removed Math.floor to allow smooth subpixel rendering, relying on larger 
                        // overlap (+0.5px) to ensure no gaps appear during camera transitions.
                        ctx.fillRect(drawX - 0.25, drawY - 0.25, drawW + 0.5, drawH + 0.5);
                    }

                    // Mark as processed
                    for (let j = 0; j < mh; j += step) {
                        const targetRowOffset = (vy + j) * vWidth;
                        for (let i = 0; i < mw; i += step) {
                            processed[targetRowOffset + vx + i] = 1;
                        }
                    }
                }
            }
        }

        // PASS 1.5: Flag Overlays (Only in Flag View)
        if (GS.viewMode === 'FLAG') {
            // Group regions by alliance root when alliance view is enabled, so each alliance
            // gets a single merged clipping mask and flag overlay.
            if (GS.allianceViewEnabled) {
                const allianceGroups = new Map();
                regions.forEach(region => {
                    const rootId = allianceKeyById[region.id] || region.id;
                    if (!allianceGroups.has(rootId)) allianceGroups.set(rootId, []);
                    allianceGroups.get(rootId).push(region);
                });

                allianceGroups.forEach((group, rootId) => {
                    const rootMeta = allianceFlagMetaByRoot[rootId] || GS.countryMetadata[rootId - 1];
                    if (!rootMeta) return;

                    let flagMeta = rootMeta;
                    ctx.save();
                    ctx.beginPath();

                    const pixelsByRow = new Map();
                    let regMinX = Infinity, regMaxX = -Infinity, regMinY = Infinity, regMaxY = -Infinity;

                    group.forEach(region => {
                        region.pixels.forEach(idx => {
                            const py = Math.floor(idx / GS.gridWidth);
                            const px = idx % GS.gridWidth;
                            let row = pixelsByRow.get(py);
                            if (!row) {
                                row = [];
                                pixelsByRow.set(py, row);
                            }
                            row.push(px);
                            if (px < regMinX) regMinX = px;
                            if (px > regMaxX) regMaxX = px;
                            if (py < regMinY) regMinY = py;
                            if (py > regMaxY) regMaxY = py;
                        });
                    });

                    pixelsByRow.forEach((rowPixels, py) => {
                        rowPixels.sort((a, b) => a - b);
                        let spanStart = rowPixels[0];
                        const pY1 = getGridPoint(0, py).y;
                        const pY2 = getGridPoint(0, py + step).y;
                        const drawY = Math.min(pY1, pY2);
                        const drawH = Math.abs(pY2 - pY1) + 0.5;

                        for (let i = 0; i < rowPixels.length; i++) {
                            if (i === rowPixels.length - 1 || rowPixels[i + 1] !== rowPixels[i] + step) {
                                const pXStart = getGridPoint(spanStart, py).x;
                                const pXEnd = getGridPoint(rowPixels[i] + step, py).x;
                                ctx.rect(pXStart, drawY, (pXEnd - pXStart) + 0.5, drawH);
                                if (i < rowPixels.length - 1) spanStart = rowPixels[i + 1];
                            }
                        }
                    });
                    ctx.clip();

                    const p1 = getGridPoint(regMinX, regMinY);
                    const p2 = getGridPoint(regMaxX + step, regMaxY + step);
                    const drawX = Math.min(p1.x, p2.x);
                    const drawY = Math.min(p1.y, p2.y);
                    const drawW = Math.abs(p1.x - p2.x);
                    const drawH = Math.abs(p1.y - p2.y);

                    let flagImg = null;
                    const isFrance = flagMeta.name === 'France';
                    const suppressFlag = isFrance && !isWar;

                    if (!suppressFlag) {
                        const countryObj = GS.sides.flat().find(c => c.id === flagMeta.id);
                        if (flagMeta.allianceFlagTempFlag && flagMeta.allianceFlagTempFlag.complete) {
                            flagImg = flagMeta.allianceFlagTempFlag;
                        } else if (countryObj && countryObj.flag && countryObj.flag.complete && countryObj.flag.naturalWidth > 0) {
                            flagImg = countryObj.flag;
                        } else {
                            if (!flagMeta.tempFlag && flagMeta.flagUrl) {
                                flagMeta.tempFlag = new Image();
                                flagMeta.tempFlag.crossOrigin = "anonymous";
                                flagMeta.tempFlag.onload = () => { if (GS.influenceLayer) GS.influenceLayer.render(); };
                                flagMeta.tempFlag.src = flagMeta.flagUrl;
                            }
                            if (flagMeta.tempFlag && flagMeta.tempFlag.complete && flagMeta.tempFlag.naturalWidth > 0) {
                                flagImg = flagMeta.tempFlag;
                            }
                        }
                    }

                    if (flagImg && drawW > 0 && drawH > 0 && isFinite(drawX) && isFinite(drawY)) {
                        const viewW = this._container.width / dpr;
                        const viewH = this._container.height / dpr;

                        const vL = Math.max(0, drawX);
                        const vT = Math.max(0, drawY);
                        const vR = Math.min(viewW, drawX + drawW);
                        const vB = Math.min(viewH, drawY + drawH);

                        const vW = vR - vL;
                        const vH = vB - vT;

                        if (vW > 0 && vH > 0 && isFinite(vW) && isFinite(vH)) {
                            const sx = ((vL - drawX) / drawW) * flagImg.naturalWidth;
                            const sy = ((vT - drawY) / drawH) * flagImg.naturalHeight;
                            const sw = (vW / drawW) * flagImg.naturalWidth;
                            const sh = (vH / drawH) * flagImg.naturalHeight;

                            if (isFinite(sx) && isFinite(sy) && isFinite(sw) && isFinite(sh) && sw > 0 && sh > 0) {
                                ctx.globalAlpha = 0.55;
                                ctx.drawImage(flagImg, sx, sy, sw, sh, vL, vT, vW, vH);
                                ctx.globalAlpha = 1.0;
                            }
                        }
                    } else if (isFinite(drawX) && isFinite(drawY) && isFinite(drawW) && isFinite(drawH)) {
                        const c = flagMeta.rgba || [180, 180, 180, 1];
                        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.35)`;
                        ctx.fillRect(drawX, drawY, drawW, drawH);
                    }

                    ctx.restore();
                });
            } else {
                regions.forEach(region => {
                    const id = region.id;
                    const pixels = region.pixels;
                    const meta = GS.countryMetadata[id - 1];
                    if (!meta) return;

                    // Determine which metadata should supply the flag for this region
                    // (alliance root in alliance view, otherwise the country itself)
                    let flagMeta = meta;
                    if (GS.allianceViewEnabled) {
                        const rootId = allianceKeyById[id] || id;
                        const rootMeta = GS.countryMetadata[rootId - 1];
                        if (rootMeta) flagMeta = rootMeta;
                    }

                    ctx.save();
                    ctx.beginPath();

                    const pixelsByRow = new Map();
                    let regMinX = Infinity, regMaxX = -Infinity, regMinY = Infinity, regMaxY = -Infinity;

                    pixels.forEach(idx => {
                        const py = Math.floor(idx / GS.gridWidth);
                        const px = idx % GS.gridWidth;
                        if (!pixelsByRow.has(py)) pixelsByRow.set(py, []);
                        pixelsByRow.get(py).push(px);
                        if (px < regMinX) regMinX = px;
                        if (px > regMaxX) regMaxX = px;
                        if (py < regMinY) regMinY = py;
                        if (py > regMaxY) regMaxY = py;
                    });

                    pixelsByRow.forEach((rowPixels, py) => {
                        rowPixels.sort((a, b) => a - b);
                        let spanStart = rowPixels[0];
                        const pY1 = getGridPoint(0, py).y;
                        const pY2 = getGridPoint(0, py + step).y;
                        const drawY = Math.min(pY1, pY2);
                        const drawH = Math.abs(pY2 - pY1) + 0.5;

                        for (let i = 0; i < rowPixels.length; i++) {
                            if (i === rowPixels.length - 1 || rowPixels[i + 1] !== rowPixels[i] + step) {
                                const pXStart = getGridPoint(spanStart, py).x;
                                const pXEnd = getGridPoint(rowPixels[i] + step, py).x;
                                ctx.rect(pXStart, drawY, (pXEnd - pXStart) + 0.5, drawH);
                                if (i < rowPixels.length - 1) spanStart = rowPixels[i + 1];
                            }
                        }
                    });
                    ctx.clip();

                    const p1 = getGridPoint(region.regMinX, region.regMinY);
                    const p2 = getGridPoint(region.regMaxX + step, region.regMaxY + step);
                    const drawX = Math.min(p1.x, p2.x);
                    const drawY = Math.min(p1.y, p2.y);
                    const drawW = Math.abs(p1.x - p2.x);
                    const drawH = Math.abs(p1.y - p2.y);

                    let flagImg = null;
                    const isFrance = meta.name === 'France';
                    const suppressFlag = isFrance && !isWar;

                    if (!suppressFlag) {
                        const countryObj = GS.sides.flat().find(c => c.id === flagMeta.id);
                        if (GS.allianceViewEnabled && flagMeta.allianceFlagTempFlag && flagMeta.allianceFlagTempFlag.complete) {
                            flagImg = flagMeta.allianceFlagTempFlag;
                        } else if (countryObj && countryObj.flag && countryObj.flag.complete && countryObj.flag.naturalWidth > 0) {
                            flagImg = countryObj.flag;
                        } else {
                            if (!flagMeta.tempFlag && flagMeta.flagUrl) {
                                flagMeta.tempFlag = new Image();
                                flagMeta.tempFlag.crossOrigin = "anonymous";
                                flagMeta.tempFlag.onload = () => { if (GS.influenceLayer) GS.influenceLayer.render(); };
                                flagMeta.tempFlag.src = flagMeta.flagUrl;
                            }
                            if (flagMeta.tempFlag && flagMeta.tempFlag.complete && flagMeta.tempFlag.naturalWidth > 0) {
                                flagImg = flagMeta.tempFlag;
                            }
                        }
                    }

                    if (flagImg && drawW > 0 && drawH > 0 && isFinite(drawX) && isFinite(drawY)) {
                        const viewW = this._container.width / dpr;
                        const viewH = this._container.height / dpr;

                        const vL = Math.max(0, drawX);
                        const vT = Math.max(0, drawY);
                        const vR = Math.min(viewW, drawX + drawW);
                        const vB = Math.min(viewH, drawY + drawH);

                        const vW = vR - vL;
                        const vH = vB - vT;

                        if (vW > 0 && vH > 0 && isFinite(vW) && isFinite(vH)) {
                            const sx = ((vL - drawX) / drawW) * flagImg.naturalWidth;
                            const sy = ((vT - drawY) / drawH) * flagImg.naturalHeight;
                            const sw = (vW / drawW) * flagImg.naturalWidth;
                            const sh = (vH / drawH) * flagImg.naturalHeight;

                            if (isFinite(sx) && isFinite(sy) && isFinite(sw) && isFinite(sh) && sw > 0 && sh > 0) {
                                ctx.globalAlpha = 0.55;
                                ctx.drawImage(flagImg, sx, sy, sw, sh, vL, vT, vW, vH);
                                ctx.globalAlpha = 1.0;
                            }
                        }
                    } else if (isFinite(drawX) && isFinite(drawY) && isFinite(drawW) && isFinite(drawH)) {
                        const c = meta.rgba;
                        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.35)`;
                        ctx.fillRect(drawX, drawY, drawW, drawH);
                    }

                    ctx.restore();
                });
            }
        }

        // PASS 2: Frontlines (Organic borders during war)
        if (isWar) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            // Adaptive line width: Thinner at distance to prevent "blobby" lines
            ctx.lineWidth = Math.max(0.8, 1.6 * (currentZoom / 5));
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.beginPath();
            
            const lineStep = step; // Downsample frontline calculations matching the greedy mesh

            for (let y = yMin; y < yMax; y += lineStep) {
                for (let x = xMin; x < xMax; x += lineStep) {
                    const i1 = y * GS.gridWidth + x;
                    const i2 = y * GS.gridWidth + (x + 1);
                    const i3 = (y + 1) * GS.gridWidth + (x + 1);
                    const i4 = (y + 1) * GS.gridWidth + x;

                    if (GS.landMask[i1] !== 2 && GS.landMask[i2] !== 2 && GS.landMask[i3] !== 2 && GS.landMask[i4] !== 2) continue;

                    const v1 = GS.occupationMap[i1];
                    const v2 = GS.occupationMap[i2];
                    const v3 = GS.occupationMap[i3];
                    const v4 = GS.occupationMap[i4];

                    const b1 = v1 >= 0 ? 1 : 0;
                    const b2 = v2 >= 0 ? 1 : 0;
                    const b3 = v3 >= 0 ? 1 : 0;
                    const b4 = v4 >= 0 ? 1 : 0;

                    // Split each quad into two triangles for more organic Marching Triangles calculation
                    // Triangle 1: Corners (v1, v2, v4) - Top Left
                    // Triangle 2: Corners (v2, v3, v4) - Bottom Right
                    const lerp = (a, b) => {
                        const t = Math.abs(a) / (Math.abs(a) + Math.abs(b));
                        return isNaN(t) ? 0.5 : t;
                    };

                    const pT = getGridPoint(x + lerp(v1, v2), y);
                    const pR = getGridPoint(x + 1, y + lerp(v2, v3));
                    const pB = getGridPoint(x + lerp(v4, v3), y + 1);
                    const pL = getGridPoint(x, y + lerp(v1, v4));
                    const pD = getGridPoint(x + 1 - lerp(v2, v4), y + lerp(v2, v4)); // Point on common diagonal (v2 to v4)

                    // Tri 1 Analysis
                    const b1p = v1 >= 0 ? 1 : 0;
                    const b2p = v2 >= 0 ? 1 : 0;
                    const b4p = v4 >= 0 ? 1 : 0;
                    const id1 = (b1p << 2) | (b2p << 1) | b4p;
                    if (id1 !== 0 && id1 !== 7) {
                        switch (id1) {
                            case 1: case 6: ctx.moveTo(pL.x, pL.y); ctx.lineTo(pD.x, pD.y); break;
                            case 2: case 5: ctx.moveTo(pT.x, pT.y); ctx.lineTo(pD.x, pD.y); break;
                            case 3: case 4: ctx.moveTo(pT.x, pT.y); ctx.lineTo(pL.x, pL.y); break;
                        }
                    }

                    // Tri 2 Analysis
                    const b2pp = v2 >= 0 ? 1 : 0;
                    const b3pp = v3 >= 0 ? 1 : 0;
                    const b4pp = v4 >= 0 ? 1 : 0;
                    const id2 = (b2pp << 2) | (b3pp << 1) | b4pp;
                    if (id2 !== 0 && id2 !== 7) {
                        switch (id2) {
                            case 1: case 6: ctx.moveTo(pB.x, pB.y); ctx.lineTo(pD.x, pD.y); break;
                            case 2: case 5: ctx.moveTo(pR.x, pR.y); ctx.lineTo(pB.x, pB.y); break;
                            case 3: case 4: ctx.moveTo(pR.x, pR.y); ctx.lineTo(pD.x, pD.y); break;
                        }
                    }
                }
            }
            ctx.stroke();
        }

        // PASS 3: Borders
        // PASS 3: Dynamic Borders & Coastlines
        // Outlines of annexed nations disappear because they now share the same owner ID in the grid.
        const isFlag = GS.viewMode === 'FLAG';
        ctx.strokeStyle = isFlag ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.8)';
        ctx.lineWidth = isFlag ? 1.5 : 1;
        ctx.beginPath();
        
        // Coarsen the border scan together with the fill/frontline downsampling, so this
        // full-viewport pass doesn't stay at high resolution while everything else is downsampled.
        // Coarsen the border scan together with the fill/frontline downsampling, so this
        // full-viewport pass doesn't stay at high resolution while everything else is downsampled.
        let borderStep = currentZoom < 5 ? 2 : 1;
        if (step > borderStep) borderStep = step;

        const getEffectiveId = (idx) => {
            if (idx < 0 || idx >= GS.worldControlMap.length || GS.landMask[idx] === 0) return -1; // -1 represents water
            if (!isFlag) return GS.worldControlMap[idx];
            
            const sovereignId = GS.worldControlMap[idx];
            if (sovereignId <= 0) return 0;
            if (isWar && GS.landMask[idx] === 2) {
                const occ = GS.occupationMap[idx];
                const sPole = sovereignPoleMap[sovereignId] || 0;
                const isOccupiedByEnemy = (sPole === 1) ? (occ < -0.1) : (occ > 0.1);
                if (isOccupiedByEnemy) return GS.primaryOccupierMap[idx] || sovereignId;
            }
            return sovereignId;
        };

        for (let y = yMin; y < yMax; y += borderStep) {
            for (let x = xMin; x < xMax; x += borderStep) {
                const i = y * GS.gridWidth + x;
                const id = getEffectiveId(i);

                if (x + borderStep < GS.gridWidth) {
                    const idR = getEffectiveId(i + borderStep);
                    // Draw if IDs differ and at least one is land
                    if (id !== idR && (id !== -1 || idR !== -1)) {
                        const p1 = getGridPoint(x + borderStep, y);
                        const p2 = getGridPoint(x + borderStep, y + borderStep);
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                    }
                }
                if (y + borderStep < GS.gridHeight) {
                    const idD = getEffectiveId(i + GS.gridWidth * borderStep);
                    if (id !== idD && (id !== -1 || idD !== -1)) {
                        const p1 = getGridPoint(x, y + borderStep);
                        const p2 = getGridPoint(x + borderStep, y + borderStep);
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                    }
                }
            }
        }
        ctx.stroke();

        

        // Pass 4: Selection Highlight
        if (GS.gameState !== 'SIMULATING') {
            const drawInspectorHighlight = (id) => {
                if (id <= 0) return;
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.setLineDash([5, 5]);
                ctx.lineWidth = 2;
                for (let y = yMin; y < yMax; y++) {
                    for (let x = xMin; x < xMax; x++) {
                        const i1 = y * GS.gridWidth + x;
                        const i2 = y * GS.gridWidth + (x + 1);
                        const i3 = (y + 1) * GS.gridWidth + (x + 1);
                        const i4 = (y + 1) * GS.gridWidth + x;
                        const b1 = GS.worldControlMap[i1] === id ? 1 : 0;
                        const b2 = GS.worldControlMap[i2] === id ? 1 : 0;
                        const b3 = GS.worldControlMap[i3] === id ? 1 : 0;
                        const b4 = GS.worldControlMap[i4] === id ? 1 : 0;
                        
                        const pT = getGridPoint(x + 0.5, y);
                        const pR = getGridPoint(x + 1, y + 0.5);
                        const pB = getGridPoint(x + 0.5, y + 1);
                        const pL = getGridPoint(x, y + 0.5);
                        const pD = getGridPoint(x + 0.5, y + 0.5);

                        // Split quad highlight into triangles for smoother inspector visuals
                        const id1 = (b1 << 2) | (b2 << 1) | b4;
                        if (id1 !== 0 && id1 !== 7) {
                            switch (id1) {
                                case 1: case 6: ctx.moveTo(pL.x, pL.y); ctx.lineTo(pD.x, pD.y); break;
                                case 2: case 5: ctx.moveTo(pT.x, pT.y); ctx.lineTo(pD.x, pD.y); break;
                                case 3: case 4: ctx.moveTo(pT.x, pT.y); ctx.lineTo(pL.x, pL.y); break;
                            }
                        }
                        const id2 = (b2 << 2) | (b3 << 1) | b4;
                        if (id2 !== 0 && id2 !== 7) {
                            switch (id2) {
                                case 1: case 6: ctx.moveTo(pB.x, pB.y); ctx.lineTo(pD.x, pD.y); break;
                                case 2: case 5: ctx.moveTo(pR.x, pR.y); ctx.lineTo(pB.x, pB.y); break;
                                case 3: case 4: ctx.moveTo(pR.x, pR.y); ctx.lineTo(pD.x, pD.y); break;
                            }
                        }
                    }
                }
                ctx.stroke();
                ctx.setLineDash([]);
            };

            if (GS.editingCountryId > 0) drawInspectorHighlight(GS.editingCountryId);

            const drawSelectionHighlight = (input, team) => {
                let id = -1;
                if (typeof input === 'number') {
                    id = input;
                } else if (input && input.properties) {
                    id = GS.countryMetadata.findIndex(m => m.feature === input) + 1;
                }
                if (id <= 0) return;

                ctx.beginPath();
                ctx.strokeStyle = team === 'A' ? GS.teamAColor.replace(/[\d.]+\)$/g, '1)') : GS.teamBColor.replace(/[\d.]+\)$/g, '1)');
                ctx.lineWidth = 3;

                for (let y = yMin; y < yMax; y++) {
                    for (let x = xMin; x < xMax; x++) {
                        const i1 = y * GS.gridWidth + x;
                        const i2 = y * GS.gridWidth + (x + 1);
                        const i3 = (y + 1) * GS.gridWidth + (x + 1);
                        const i4 = (y + 1) * GS.gridWidth + x;
                        const b1 = GS.worldControlMap[i1] === id ? 1 : 0;
                        const b2 = GS.worldControlMap[i2] === id ? 1 : 0;
                        const b3 = GS.worldControlMap[i3] === id ? 1 : 0;
                        const b4 = GS.worldControlMap[i4] === id ? 1 : 0;
                        const mid = (b1 << 3) | (b2 << 2) | (b3 << 1) | b4;
                        if (mid === 0 || mid === 15) continue;
                        const pT = getGridPoint(x + 0.5, y); const pR = getGridPoint(x + 1, y + 0.5);
                        const pB = getGridPoint(x + 0.5, y + 1); const pL = getGridPoint(x, y + 0.5);
                        switch (mid) {
                            case 1: case 14: ctx.moveTo(pL.x, pL.y); ctx.lineTo(pB.x, pB.y); break;
                            case 2: case 13: ctx.moveTo(pR.x, pR.y); ctx.lineTo(pB.x, pB.y); break;
                            case 3: case 12: ctx.moveTo(pL.x, pL.y); ctx.lineTo(pR.x, pR.y); break;
                            case 4: case 11: ctx.moveTo(pT.x, pT.y); ctx.lineTo(pR.x, pR.y); break;
                            case 5: ctx.moveTo(pL.x, pL.y); ctx.lineTo(pT.x, pT.y); ctx.moveTo(pR.x, pR.y); ctx.lineTo(pB.x, pB.y); break;
                            case 6: case 9: ctx.moveTo(pT.x, pT.y); ctx.lineTo(pB.x, pB.y); break;
                            case 7: case 8: ctx.moveTo(pL.x, pL.y); ctx.lineTo(pT.x, pT.y); break;
                            case 10: ctx.moveTo(pT.x, pT.y); ctx.lineTo(pR.x, pR.y); ctx.moveTo(pL.x, pL.y); ctx.lineTo(pB.x, pB.y); break;
                        }
                    }
                }
                ctx.stroke();
            };
            GS.sides.forEach((side, idx) => {
                const pole = (idx % 2 === 0) ? 'A' : 'B';
                side.forEach(c => {
                    if (c.feature) drawSelectionHighlight(c.feature, pole);
                    else if (c.id) drawSelectionHighlight(c.id, pole);
                });
            });
        }

        // Draw Explosions - Viewport Culled
        const drawBounds = viewBounds.pad(0.1);
        GS.explosions.forEach(exp => {
            if (isNaN(exp.lat) || isNaN(exp.lng) || !drawBounds.contains([exp.lat, exp.lng])) return;
            let p;
            try {
                p = map.latLngToContainerPoint([exp.lat, exp.lng]);
            } catch(e) { return; }
            
            const lifePct = exp.life / 30; // 30 frames life
            const radius = exp.maxRadius * (1 - lifePct) * (map.getZoom() / 5);
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
            gradient.addColorStop(0, `rgba(255, 255, 255, ${lifePct})`);
            gradient.addColorStop(0.3, `rgba(255, 200, 50, ${lifePct * 0.8})`);
            gradient.addColorStop(1, `rgba(255, 50, 0, 0)`);
            ctx.fillStyle = gradient;
            ctx.fill();
        });

        // Draw Encirclement popups - rising + fading "+N Encircled" text
        if (GS.encirclePops && GS.encirclePops.length) {
            ctx.save();
            ctx.textAlign = 'center';
            for (let ei = 0; ei < GS.encirclePops.length; ei++) {
                const pop = GS.encirclePops[ei];
                if (isNaN(pop.lat) || isNaN(pop.lng) || !drawBounds.contains([pop.lat, pop.lng])) continue;
                let pp;
                try { pp = map.latLngToContainerPoint([pop.lat, pop.lng]); } catch (e) { continue; }
                const t = pop.life / pop.maxLife;          // 1 -> 0 over life
                const alpha = Math.min(1, t * 1.6);          // hold, then fade out
                // City-capture events get a pulsing white outline ring that expands outward.
                if (pop.pulse) {
                    ctx.save();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 3;
                    const age = 1 - t;                       // 0 -> 1 over life
                    for (let r = 0; r < 2; r++) {            // two staggered rings = repeating pulse-out
                        const ph = (age * 2 + r * 0.5) % 1;  // each sweeps 6px -> 40px then resets
                        ctx.globalAlpha = alpha * (1 - ph) * 0.9;
                        ctx.beginPath();
                        ctx.arc(pp.x, pp.y, 6 + ph * 34, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                    ctx.restore();
                }
                const rise = (1 - t) * 34;                   // drift upward as it ages
                const y = pp.y - rise;
                ctx.globalAlpha = alpha;
                ctx.font = 'bold 15px sans-serif';
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'rgba(0,0,0,0.85)';
                ctx.fillStyle = pop.pulse ? '#ffffff' : '#ffe14d';
                ctx.strokeText(pop.text, pp.x, y);
                ctx.fillText(pop.text, pp.x, y);
            }
            ctx.restore();
        }


        // Draw Bombs - Viewport Culled
        GS.bombs.forEach(b => {
            if (isNaN(b.currentLat) || isNaN(b.currentLng) || !drawBounds.contains([b.currentLat, b.currentLng])) return;
            let p, pn;
            try {
                p = map.latLngToContainerPoint([b.currentLat, b.currentLng]);
                pn = map.latLngToContainerPoint([b.nextLat ?? b.currentLat, b.nextLng ?? b.currentLng]);
            } catch(e) { return; }
            const zoomScale = Math.pow(1.2, map.getZoom() - 3);
            
            // Draw trail - Improved glowing plume with better tapering
            b.trail.forEach((t, i) => {
                const tp = map.latLngToContainerPoint([t.lat, t.lng]);
                const progress = i / b.trail.length;
                const opacity = progress * 0.7;
                const baseRadius = 2.5 * zoomScale * progress;
                
                // Outer Glow
                ctx.beginPath();
                ctx.arc(tp.x, tp.y, baseRadius * 3, 0, Math.PI * 2);
                ctx.fillStyle = b.team === 'A' ? `rgba(255, 70, 0, ${opacity * 0.2})` : `rgba(0, 130, 255, ${opacity * 0.2})`;
                ctx.fill();

                // Core Plume
                ctx.beginPath();
                ctx.arc(tp.x, tp.y, baseRadius, 0, Math.PI * 2);
                ctx.fillStyle = b.team === 'A' ? `rgba(255, 180, 80, ${opacity})` : `rgba(100, 210, 255, ${opacity})`;
                ctx.fill();

                // White-hot core
                if (progress > 0.8) {
                    ctx.beginPath();
                    ctx.arc(tp.x, tp.y, baseRadius * 0.5, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                    ctx.fill();
                }
            });

            // Draw Bomb (Missile shape)
            ctx.save();
            ctx.translate(p.x, p.y);
            
            // Calculate smooth rotation based on screen-space trajectory
            const angle = Math.atan2(pn.y - p.y, pn.x - p.x);
            ctx.rotate(angle);
            
            // Bomb Body
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = b.team === 'A' ? '#ff4757' : '#2e86de';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(10 * zoomScale, 0); // Nose
            ctx.lineTo(-2 * zoomScale, -4 * zoomScale); // Top fin
            ctx.lineTo(-6 * zoomScale, -4 * zoomScale); // Back top
            ctx.lineTo(-6 * zoomScale, 4 * zoomScale); // Back bottom
            ctx.lineTo(-2 * zoomScale, 4 * zoomScale); // Bottom fin
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Engine Glow
            ctx.beginPath();
            ctx.arc(-6 * zoomScale, 0, 3 * zoomScale, 0, Math.PI * 2);
            ctx.fillStyle = b.team === 'A' ? '#ff4757' : '#2e86de';
            ctx.fill();
            
            ctx.restore();
        });

        // Calculate theater stats
        if (isWar && GS.animationFrameId % 10 === 0) {
            let p1T = 0, p2T = 0;
            for (let i = 0; i < GS.occupationMap.length; i++) {
                if (GS.landMask[i] === 2) {
                    if (GS.occupationMap[i] > 0.05) p1T++;
                    else if (GS.occupationMap[i] < -0.05) p2T++;
                }
            }
            const total = p1T + p2T;
            if (total > 0) {
                const p1Percent = Math.round((p1T / total) * 100);
                DOM.p1ControlDisp.innerText = `${p1Percent}%`;
                DOM.p2ControlDisp.innerText = `${100 - p1Percent}%`;
                DOM.progressBar.style.width = `${p1Percent}%`;
            }
        }

        // Draw Bases (Missile Silos & Airports) - Viewport Culled
        if (isWar) {
            const zoom = map.getZoom();
            const baseSize = Math.max(4, zoom * 1.5);
            
            GS.bases.forEach(base => {
                if (!drawBounds.contains([base.lat, base.lng])) return;
                const p = map.latLngToContainerPoint([base.lat, base.lng]);
                ctx.beginPath();
                ctx.arc(p.x, p.y, baseSize * 1.2, 0, Math.PI * 2);
                ctx.fillStyle = base.team === 'A' ? 'rgba(255, 71, 87, 0.3)' : 'rgba(46, 134, 222, 0.3)';
                ctx.fill();
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = base.team === 'A' ? '#ff4757' : '#2e86de';
                ctx.lineWidth = 2;
                ctx.fillRect(p.x - baseSize/2, p.y - baseSize/2, baseSize, baseSize);
                ctx.strokeRect(p.x - baseSize/2, p.y - baseSize/2, baseSize, baseSize);
                ctx.beginPath();
                ctx.moveTo(p.x - baseSize/2, p.y); ctx.lineTo(p.x + baseSize/2, p.y);
                ctx.moveTo(p.x, p.y - baseSize/2); ctx.lineTo(p.x, p.y + baseSize/2);
                ctx.stroke();
            });


        }

        // Draw cities
        const zoom = map.getZoom();
        const citySize = Math.max(2, zoom - 2);
        
        // Show all cities if zoomed in, or major cities/theater cities if zoomed out
        let citiesToDraw = [];
        if (zoom >= 6) {
            citiesToDraw = GS.cities.filter(c => viewBounds.contains([c.lat, c.lng]));
        } else if (zoom >= 3) {
            const minPop = zoom === 5 ? 100000 : (zoom === 4 ? 400000 : 1000000);
            citiesToDraw = GS.cities.filter(c => (c.pop > minPop && viewBounds.contains([c.lat, c.lng])) || GS.activeTheaterCities.includes(c));
        } else {
            citiesToDraw = GS.activeTheaterCities;
        }

        // Filter out non-capital cities if toggle is off (always hide non-capitals, even in wars)
        if (!GS.showNonCapitalCities) {
            citiesToDraw = citiesToDraw.filter(city => city.isCapital);
        }

        citiesToDraw.forEach(city => {
            let p;
            try {
                p = map.latLngToContainerPoint([city.lat, city.lng]);
            } catch(e) { return; }
            const val = getControlValue(city.lat, city.lng);
            const isCapital = city.isCapital;
            const actualSize = isCapital ? citySize * 1.6 : citySize;
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, actualSize, 0, Math.PI * 2);
            
            if (val > 0.3) {
                ctx.fillStyle = GS.teamAColor.replace(/[\d.]+\)$/g, '1)');
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            } else if (val < -0.3) {
                ctx.fillStyle = GS.teamBColor.replace(/[\d.]+\)$/g, '1)');
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            } else {
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            }
            
            ctx.lineWidth = 1;
            ctx.fill();
            ctx.stroke();

            // City labels at high zoom
            if (zoom >= 6) {
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 10px monospace';
                ctx.shadowBlur = 4;
                ctx.shadowColor = 'black';
                ctx.fillText(city.name, p.x + citySize + 2, p.y + 4);
                ctx.shadowBlur = 0;
            }
        });

        // Draw units - Small flags for land, ships for water
        if (GS.showUnitsVisually) {
            const currentZoom = map.getZoom();
            const zoomScale = Math.pow(1.3, currentZoom - 3);
            const w = 7 * zoomScale;
            const h = 4.5 * zoomScale;

            const drawProb = currentZoom < 3 ? 0.2 : (currentZoom < 4 ? 0.5 : 1.0);
            const uDrawBounds = viewBounds.pad(0.02); // Tight culling

            // O(Visible) RENDERING: Use spatial hash to only iterate over units in visible buckets.
            const b = viewBounds;
            const minKx = Math.floor((b.getWest() + 180) / UNIT_HASH_CELL_SIZE);
            const maxKx = Math.floor((b.getEast() + 180) / UNIT_HASH_CELL_SIZE);
            const minKy = Math.floor((b.getSouth() + 90) / UNIT_HASH_CELL_SIZE);
            const maxKy = Math.floor((b.getNorth() + 90) / UNIT_HASH_CELL_SIZE);

            const visibleUnits = [];
            for (let kx = minKx; kx <= maxKx; kx++) {
                // Handle longitude wrap
                const wrappedKx = ((kx % 144) + 144) % 144; // 360/2.5 = 144 buckets
                for (let ky = minKy; ky <= maxKy; ky++) {
                    const bucket = GS.unitSpatialHash.get(wrappedKx + '_' + ky);
                    if (bucket) {
                        for (let bu = 0; bu < bucket.length; bu++) {
                            const u = bucket[bu];
                            if (uDrawBounds.contains([u.lat, u.lng])) {
                                visibleUnits.push(u);
                            }
                        }
                    }
                }
            }

            visibleUnits.forEach(u => {
                if (drawProb < 1.0 && (u.id % 1) > drawProb) return;
                let p;
                try {
                    p = map.latLngToContainerPoint([u.lat, u.lng]);
                } catch(e) { return; }
                
                // Safety: check resulting container points
                if (isNaN(p.x) || isNaN(p.y) || !isFinite(p.x) || !isFinite(p.y)) return;

                const isAtSea = u.isAtSea;
                const isMountain = u.mountainIntensity > 0;
                const mountainIntensity = u.mountainIntensity || 0;

                if (isAtSea) {
                    // Naval revamp (owner): directional warship sprite that faces its
                    // travel direction, over a team-coloured glow so red vs blue reads
                    // at a glance. Falls back to a coloured dot while the art streams in.
                    const size = 16 * zoomScale;
                    const sprite = getShipSprite(u.dirLat || 0, (u.dirLng !== undefined ? u.dirLng : (u.team === 'A' ? 1 : -1)));
                    ctx.save();
                    ctx.globalAlpha = 0.5;
                    ctx.fillStyle = u.team === 'A' ? '#ff4757' : '#2e86de';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, size * 0.33, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                    if (sprite) {
                        ctx.drawImage(sprite, p.x - size / 2, p.y - size / 2, size, size);
                    } else {
                        ctx.fillStyle = u.team === 'A' ? '#ff4757' : '#2e86de';
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, Math.max(1.2, w * 0.45), 0, Math.PI * 2);
                        ctx.fill();
                    }
                    // Brief tracer toward the ship it's firing on (zoomed-in only, keeps it cheap).
                    if (currentZoom >= 4 && u._navFireFxTick && (GS.simFrameCount - u._navFireFxTick) < 4
                        && u._navFireTargetLat !== undefined) {
                        try {
                            const tp = map.latLngToContainerPoint([u._navFireTargetLat, u._navFireTargetLng]);
                            ctx.save();
                            ctx.strokeStyle = u.team === 'A' ? 'rgba(255,170,110,0.7)' : 'rgba(150,205,255,0.7)';
                            ctx.lineWidth = Math.max(0.5, 0.6 * zoomScale);
                            ctx.beginPath();
                            ctx.moveTo(p.x, p.y);
                            ctx.lineTo(tp.x, tp.y);
                            ctx.stroke();
                            ctx.restore();
                        } catch (e) {}
                    }
                } else {
                    let country = null;

                    // Mountain Visuals: Units are "snow-capped" for visibility
                    const sw = w;
                    const sh = h;

                    // Robust lookup: first try assigned side, then search all sides as fallback
                    if (u.sideIndex !== undefined && GS.sides[u.sideIndex]) {
                        country = GS.sides[u.sideIndex].find(c => c.id === u.sovereignId);
                    }
                    
                    if (!country) {
                        // Deep search fallback
                        for (let s = 0; s < GS.sides.length; s++) {
                            country = GS.sides[s].find(c => c.id === u.sovereignId);
                            if (country) break;
                        }
                    }

                    // If still not found, try searching the metadata (for dead countries)
                    let flagMeta = null;
                    if (country && country.id) {
                        flagMeta = GS.countryMetadata[country.id - 1] || null;
                    } else if (u.sovereignId > 0) {
                        flagMeta = GS.countryMetadata[u.sovereignId - 1] || null;
                    }

                    // If alliance view is enabled during war, show the alliance flag instead of per‑nation
                    if (GS.allianceViewEnabled && isWar && flagMeta) {
                        const rootId = allianceKeyById[flagMeta.id] || flagMeta.id;
                        const rootMeta = GS.countryMetadata[rootId - 1];
                        if (rootMeta) flagMeta = rootMeta;
                    }

                    if (flagMeta) {
                        // In alliance view, prefer a dedicated alliance flag if one exists
                        if (GS.allianceViewEnabled && flagMeta.allianceFlagTempFlag && flagMeta.allianceFlagTempFlag.complete) {
                            // nothing to preload
                        } else if (!flagMeta.tempFlag && flagMeta.flagUrl) {
                            flagMeta.tempFlag = new Image();
                            flagMeta.tempFlag.crossOrigin = "anonymous";
                            flagMeta.tempFlag.src = flagMeta.flagUrl;
                        }
                    }

                    const flag = (GS.allianceViewEnabled && flagMeta?.allianceFlagTempFlag)
                        ? flagMeta.allianceFlagTempFlag
                        : (flagMeta?.tempFlag || country?.flag || country?.tempFlag);
                    if (flag && flag.complete && flag.naturalWidth > 0) {
                        ctx.drawImage(flag, p.x - sw/2, p.y - sh/2, sw, sh);
                        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                        ctx.lineWidth = Math.max(0.3, 0.3 * zoomScale);
                        ctx.strokeRect(p.x - sw/2, p.y - sh/2, sw, sh);
                    } else {
                        ctx.fillStyle = u.team === 'A' ? '#ff4757' : '#2e86de';
                        ctx.fillRect(p.x - sw/2, p.y - sh/2, sw, sh);
                    }


                    // Victory Boost Visual (Star)
                    if (GS.showBattleIndicators && u.victoryBoostTicks > 0) {
                        ctx.save();
                        const starSize = 10 * zoomScale;
                        ctx.font = `${starSize}px serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.shadowBlur = 6;
                        ctx.shadowColor = 'gold';
                        ctx.fillText('⭐', p.x, p.y - sh - 2);
                        ctx.restore();
                    }

                    if (isMountain) {
                        // Floating triangle indicator well above the unit to signify mountain traversal
                        const triSize = 5 * zoomScale;
                        const triOffset = 10 * zoomScale;
                        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + (mountainIntensity * 0.3)})`;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y - sh/2 - triOffset);
                        ctx.lineTo(p.x - triSize/2, p.y - sh/2 - triOffset + triSize);
                        ctx.lineTo(p.x + triSize/2, p.y - sh/2 - triOffset + triSize);
                        ctx.closePath();
                        ctx.fill();
                        
                        // Subtle outline for visibility against various backgrounds
                        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
                        ctx.lineWidth = 0.5 * zoomScale;
                        ctx.stroke();
                    }
                }
            });

            // Naval landing ghosts (owner naval revamp): ships that dropped their troops
            // on the coast linger a few seconds then fade out and despawn. Cheap: a short
            // decaying list pruned each sim tick, drawn only when in view.
            if (GS.navalLandings && GS.navalLandings.length) {
                const gZoom = map.getZoom();
                const gScale = Math.pow(1.3, gZoom - 3);
                const gSize = 16 * gScale;
                for (let gi = 0; gi < GS.navalLandings.length; gi++) {
                    const g = GS.navalLandings[gi];
                    if (!uDrawBounds.contains([g.lat, g.lng])) continue;
                    let gp;
                    try { gp = map.latLngToContainerPoint([g.lat, g.lng]); } catch (e) { continue; }
                    if (isNaN(gp.x) || isNaN(gp.y)) continue;
                    const remain = g.expireTick - GS.simFrameCount;
                    const fade = Math.max(0, Math.min(1, remain / 90)); // fade over the last ~90 ticks
                    const sprite = getShipSprite(g.dirLat || 0, (g.dirLng !== undefined ? g.dirLng : 1));
                    ctx.save();
                    ctx.globalAlpha = 0.35 + 0.45 * fade;
                    if (sprite) {
                        ctx.drawImage(sprite, gp.x - gSize / 2, gp.y - gSize / 2, gSize, gSize);
                    } else {
                        ctx.fillStyle = g.team === 'A' ? '#ff4757' : '#2e86de';
                        ctx.beginPath();
                        ctx.arc(gp.x, gp.y, gSize * 0.2, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.restore();
                }
            }

            // Transport boats (owner feature): dedicated ferries waiting on the
            // coast / crossing to an enemy shore. Same directional ship sprite as
            // the naval units, over a team-coloured glow. Viewport culled + only
            // while a war is actually running.
            if (GS.gameState === 'SIMULATING' && GS.boats && GS.boats.length) {
                const bZoom = map.getZoom();
                const bScale = Math.pow(1.3, bZoom - 3);
                const bSize = 18 * bScale;
                for (let bi = 0; bi < GS.boats.length; bi++) {
                    const boat = GS.boats[bi];
                    if (!uDrawBounds.contains([boat.lat, boat.lng])) continue;
                    let bp;
                    try { bp = map.latLngToContainerPoint([boat.lat, boat.lng]); } catch (e) { continue; }
                    if (isNaN(bp.x) || isNaN(bp.y)) continue;
                    const sprite = getShipSprite(boat.dirLat || 0, (boat.dirLng !== undefined ? boat.dirLng : (boat.team === 'A' ? 1 : -1)));
                    ctx.save();
                    // Team glow — brighter when loaded so a full ferry reads at a glance.
                    ctx.globalAlpha = 0.5;
                    ctx.fillStyle = boat.team === 'A' ? '#ff4757' : '#2e86de';
                    ctx.beginPath();
                    ctx.arc(bp.x, bp.y, bSize * (boat.passengers.length ? 0.42 : 0.3), 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                    if (sprite) {
                        ctx.drawImage(sprite, bp.x - bSize / 2, bp.y - bSize / 2, bSize, bSize);
                    } else {
                        ctx.fillStyle = boat.team === 'A' ? '#ff4757' : '#2e86de';
                        ctx.beginPath();
                        ctx.arc(bp.x, bp.y, bSize * 0.25, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    // Small load pips so you can see troops aboard when zoomed in.
                    if (bZoom >= 5 && boat.passengers.length) {
                        ctx.save();
                        ctx.fillStyle = 'rgba(255,255,255,0.9)';
                        ctx.font = `${Math.max(7, 7 * bScale)}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.fillText('×' + boat.passengers.length, bp.x, bp.y - bSize * 0.6);
                        ctx.restore();
                    }
                }
            }
        }

        // PASS 5: Battle Clusters (Sword Emojis) - Viewport Culled
        if (isWar && GS.showBattleIndicators) {
            const zoomScale = Math.pow(1.3, map.getZoom() - 3);
            GS.activeBattles.forEach(b => {
                if (!drawBounds.contains([b.lat, b.lng])) return;
                let p;
                try {
                    p = map.latLngToContainerPoint([b.lat, b.lng]);
                } catch(e) { return; }

                ctx.save();
                // Scale based on zoom and number of units in the battle
                const sizeMult = Math.min(2.0, 1.0 + (b.participants / 15));
                const emojiSize = Math.max(18, 26 * zoomScale * sizeMult);
                
                ctx.font = `${emojiSize}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(255,255,255,0.4)';
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                // Pulsing animation
                const pulse = 0.9 + Math.sin(GS.simFrameCount * 0.2) * 0.1;
                ctx.translate(p.x, p.y);
                ctx.scale(pulse, pulse);
                
                ctx.fillText('⚔️', 0, 0);
                ctx.restore();
            });
        }

        // PASS 6: Curved Soldier Labels (HOI4 Style)
        // Drawn AFTER units so they appear on top
        if (isWar) {
            this.drawCurvedLabel(ctx, 'A');
            this.drawCurvedLabel(ctx, 'B');
            // Only bake the casualty list into the map canvas during Cinematic Mode
            // so it appears in the WebM recording while the standard HTML UI is hidden.
            if (GS.cinematicMode) {
                this.drawCasualtiesOnCanvas(ctx);
            }
        }

        // PASS 7: Country Labels (HOI4 Curved Style)
        // Drawn per contiguous region so overseas territories get their own labels,
        // recomputed every frame in map-space so they move naturally with the camera.
        if (GS.showCountryLabels && regions && regions.length && GS.countryMetadata) {
            const mapSize = map.getSize();
            const viewBounds = map.getBounds();
            const res = CONFIG.GRID_RES;

            const safeLatLngToPoint = (lat, lng) => {
                if (isNaN(lat) || isNaN(lng)) return null;
                try {
                    return map.latLngToContainerPoint([lat, lng]);
                } catch (e) {
                    return null;
                }
            };

            regions.forEach((region) => {
                const meta = GS.countryMetadata[region.id - 1];
                if (!meta) return;

                const centerLat = region.latSum / region.count;
                const centerLng = region.lngSum / region.count;

                // Skip regions far from the current view
                if (!viewBounds.pad(0.5).contains([centerLat, centerLng])) return;
                const pCenter = safeLatLngToPoint(centerLat, centerLng);
                if (!pCenter ||
                    pCenter.x < -400 || pCenter.x > mapSize.x + 400 ||
                    pCenter.y < -400 || pCenter.y > mapSize.y + 400) {
                    return;
                }

                const nameRaw = meta.displayName || meta.name || "Unknown";
                const name = nameRaw.toUpperCase();

                // Area scale based on this region only
                const pMin = safeLatLngToPoint((region.regMinY * res) - 90, (region.regMinX * res) - 180);
                const pMax = safeLatLngToPoint((region.regMaxY * res) - 90, (region.regMaxX * res) - 180);
                if (!pMin || !pMax) return;
                const areaScale = Math.sqrt(Math.abs(pMax.x - pMin.x) * Math.abs(pMax.y - pMin.y));

                const zoom = map.getZoom();
                let fontSize = Math.max(8, Math.min(zoom * 12, areaScale / 4.5));

                // Build control points from region bins in lat/lng -> screen space
                const points = (region.bins || []).map(bin => {
                    if (!bin || bin.count <= 0) return null;
                    const lat = bin.latSum / bin.count;
                    const lng = bin.lngSum / bin.count;
                    return safeLatLngToPoint(lat, lng);
                });

                if (!points || points.length < 4) return;

                // Fill any missing points by interpolating neighbours, or fall back to center
                for (let i = 0; i < 4; i++) {
                    if (!points[i]) {
                        let left = null, right = null;
                        for (let j = i - 1; j >= 0; j--) {
                            if (points[j]) { left = { p: points[j], idx: j }; break; }
                        }
                        for (let j = i + 1; j < 4; j++) {
                            if (points[j]) { right = { p: points[j], idx: j }; break; }
                        }
                        if (left && right) {
                            const t = (i - left.idx) / (right.idx - left.idx);
                            points[i] = {
                                x: left.p.x + (right.p.x - left.p.x) * t,
                                y: left.p.y + (right.p.y - left.p.y) * t
                            };
                        } else if (left) {
                            points[i] = { ...left.p };
                        } else if (right) {
                            points[i] = { ...right.p };
                        } else {
                            points[i] = { ...pCenter };
                        }
                    }
                }

                // Measure curve length to fit text nicely
                let pathLength = 0;
                let prev = points[0];
                for (let i = 1; i <= 10; i++) {
                    const curr = this.getBezierPoint(i / 10, points[0], points[1], points[2], points[3]);
                    pathLength += Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
                    prev = curr;
                }

                const charFactor = 0.65;
                const spacingFactor = 0.35;
                const idealFontSize = (pathLength * 0.9) / (name.length * (charFactor + spacingFactor));
                fontSize = Math.min(idealFontSize, fontSize);
                if (fontSize < 7) return;

                this.drawTextOnCurve(
                    ctx,
                    name,
                    points[0],
                    points[1],
                    points[2],
                    points[3],
                    fontSize,
                    fontSize * spacingFactor
                );
            });
        }

        // Draw a white frame around the custom map extent so you can see where the world ends.
        // For custom maps, this should match the world size set before the map loads:
        // use explicit maxBounds if configured (blank canvas size), otherwise the full world.
        if (GS.isCustomTerrain) {
            let boundsToUse = null;
            if (map.options.maxBounds) {
                boundsToUse = map.options.maxBounds;
            } else {
                const halfW = (GS.worldWidthDeg || 360) / 2;
                const halfH = (GS.worldHeightDeg || 180) / 2;
                boundsToUse = L.latLngBounds(
                    L.latLng(-halfH, -halfW),
                    L.latLng(halfH, halfW)
                );
            }

            if (boundsToUse) {
                try {
                    const nw = boundsToUse.getNorthWest();
                    const ne = boundsToUse.getNorthEast();
                    const se = boundsToUse.getSouthEast();
                    const sw = boundsToUse.getSouthWest();

                    const pNW = map.latLngToContainerPoint(nw);
                    const pNE = map.latLngToContainerPoint(ne);
                    const pSE = map.latLngToContainerPoint(se);
                    const pSW = map.latLngToContainerPoint(sw);

                    ctx.save();
                    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
                    ctx.lineWidth = 2.0;
                    ctx.setLineDash([6, 4]);
                    ctx.beginPath();
                    ctx.moveTo(pNW.x, pNW.y);
                    ctx.lineTo(pNE.x, pNE.y);
                    ctx.lineTo(pSE.x, pSE.y);
                    ctx.lineTo(pSW.x, pSW.y);
                    ctx.closePath();
                    ctx.stroke();
                    ctx.restore();
                } catch (e) {
                    // If projection fails (e.g. bounds offscreen), just skip drawing the frame.
                }
            }
        }

        // Draw Reference Image Guide (Over everything) when "Draw Above Terrain" is enabled.
        // Hidden during preview capture to ensure clean Hub thumbnails and exports.
        // This pass runs last so the reference image sits on top of terrain, countries, oceans, and units.
        if (
            !this._isCapturing &&
            GS.refAboveTerrain &&
            GS.referenceImageUrl &&
            GS.referenceOverlay &&
            (GS.gameMode === 'EDITOR' || GS.gameMode === 'EDITOR_TEST' || GS.godModeActive)
        ) {
            const img = GS.referenceOverlay.getElement();
            if (img && img.complete && img.naturalWidth > 0) {
                const b = GS.referenceOverlay.getBounds();
                const pTL = map.latLngToContainerPoint(b.getNorthWest());
                const pBR = map.latLngToContainerPoint(b.getSouthEast());
                ctx.save();
                ctx.globalAlpha = GS.refOpacity;
                ctx.drawImage(img, pTL.x, pTL.y, pBR.x - pTL.x, pBR.y - pTL.y);
                ctx.restore();
            }
        }

        // --- WAR GOAL CLAIM OVERLAY (pre-war territory marking) ---
        // Draw the marked claim as a bold red FRONTLINE outline (like a battle map front),
        // over a faint red tint, so the boundary of the land being claimed reads clearly on
        // a small screen. Active only while marking war goals before a war starts, so it
        // costs nothing during the actual simulation.
        if (GS.warGoalMode && GS.warGoalCells && GS.warGoalCells.size > 0) {
            const cells = GS.warGoalCells;
            const gw = GS.gridWidth;
            const gh = GS.gridHeight;
            ctx.save();

            // 1) Faint red interior tint so the claimed area is still legible as a region.
            ctx.fillStyle = 'rgba(226,59,59,0.22)';
            cells.forEach(idx => {
                const gx = idx % gw;
                const gy = Math.floor(idx / gw);
                if (gx < xMin - 1 || gx > xMax + 1 || gy < yMin - 1 || gy > yMax + 1) return;
                const p1 = getGridPoint(gx, gy);
                const p2 = getGridPoint(gx + 1, gy + 1);
                ctx.fillRect(p1.x, p1.y, (p2.x - p1.x) + 0.5, (p2.y - p1.y) + 0.5);
            });

            // 2) Claim boundary drawn with the SAME rendering system as the in-game war
            //    frontline (PASS 2) / selection highlight (PASS 4): a smooth Marching-Triangles
            //    isoline over the claimed-cell membership, instead of blocky axis-aligned cell
            //    edges. Binary membership (claimed=inside), so the crossing point on each edge is
            //    the midpoint (0.5), exactly like the selection-highlight pass. This traces the
            //    claim as an organic front that visually matches the real frontline.
            const lineStep = step; // match the greedy-mesh downsampling like the frontline pass
            const wgIn = (gx, gy) => (gx >= 0 && gy >= 0 && gx < gw && gy < gh && cells.has(gy * gw + gx)) ? 1 : 0;
            ctx.beginPath();
            for (let y = yMin; y < yMax; y += lineStep) {
                for (let x = xMin; x < xMax; x += lineStep) {
                    const b1 = wgIn(x, y);
                    const b2 = wgIn(x + lineStep, y);
                    const b3 = wgIn(x + lineStep, y + lineStep);
                    const b4 = wgIn(x, y + lineStep);
                    if (b1 === 0 && b2 === 0 && b3 === 0 && b4 === 0) continue;
                    if (b1 === 1 && b2 === 1 && b3 === 1 && b4 === 1) continue;

                    const pT = getGridPoint(x + lineStep * 0.5, y);
                    const pR = getGridPoint(x + lineStep, y + lineStep * 0.5);
                    const pB = getGridPoint(x + lineStep * 0.5, y + lineStep);
                    const pL = getGridPoint(x, y + lineStep * 0.5);
                    const pD = getGridPoint(x + lineStep * 0.5, y + lineStep * 0.5);

                    // Triangle 1: corners (b1, b2, b4)
                    const id1 = (b1 << 2) | (b2 << 1) | b4;
                    if (id1 !== 0 && id1 !== 7) {
                        switch (id1) {
                            case 1: case 6: ctx.moveTo(pL.x, pL.y); ctx.lineTo(pD.x, pD.y); break;
                            case 2: case 5: ctx.moveTo(pT.x, pT.y); ctx.lineTo(pD.x, pD.y); break;
                            case 3: case 4: ctx.moveTo(pT.x, pT.y); ctx.lineTo(pL.x, pL.y); break;
                        }
                    }
                    // Triangle 2: corners (b2, b3, b4)
                    const id2 = (b2 << 2) | (b3 << 1) | b4;
                    if (id2 !== 0 && id2 !== 7) {
                        switch (id2) {
                            case 1: case 6: ctx.moveTo(pB.x, pB.y); ctx.lineTo(pD.x, pD.y); break;
                            case 2: case 5: ctx.moveTo(pR.x, pR.y); ctx.lineTo(pB.x, pB.y); break;
                            case 3: case 4: ctx.moveTo(pR.x, pR.y); ctx.lineTo(pD.x, pD.y); break;
                        }
                    }
                }
            }
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            // Soft dark halo first so the red line stays visible over any terrain colour.
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            ctx.lineWidth = Math.max(3.5, 5 * (currentZoom / 5));
            ctx.stroke();
            // Bright red frontline on top, width scaled to zoom like the real frontline pass.
            ctx.strokeStyle = 'rgba(230,40,40,0.95)';
            ctx.lineWidth = Math.max(1.6, 2.5 * (currentZoom / 5));
            ctx.stroke();
            ctx.restore();
        }

        ctx.restore();
    },

    drawCurvedLabel: function(ctx, team) {
        // Only consider units that are currently within the map's viewport
        const viewBounds = map.getBounds();
        const vS = viewBounds.getSouth();
        const vN = viewBounds.getNorth();
        const vW = viewBounds.getWest();
        const vE = viewBounds.getEast();
        const isWrapped = vW > vE;

        const teamUnits = GS.units.filter(u => {
            if (u.team !== team) return false;
            if (u.lat < vS || u.lat > vN) return false;
            if (isWrapped) {
                if (u.lng < vW && u.lng > vE) return false;
            } else {
                if (u.lng < vW || u.lng > vE) return false;
            }
            return true;
        });
        
        if (teamUnits.length < 1) return;

        // Calculate centroid and current active manpower of the visible unit cluster
        let avgLat = 0, avgLng = 0;
        let clusterManpower = 0;
        const sp = (team === 'A' ? (GS.soldiersPerUnitA || CONFIG.UNIT_TO_SOLDIER_RATIO) : (GS.soldiersPerUnitB || CONFIG.UNIT_TO_SOLDIER_RATIO));

        teamUnits.forEach(u => { 
            avgLat += u.lat; 
            avgLng += u.lng; 
            // Factor in current health for the manpower display
            clusterManpower += (u.health / CONFIG.UNIT_HEALTH) * sp;
        });
        avgLat /= teamUnits.length;
        avgLng /= teamUnits.length;

        if (isNaN(avgLat) || isNaN(avgLng)) return;
        let p;
        try {
            p = map.latLngToContainerPoint([avgLat, avgLng]);
        } catch(e) { return; }
        const zoom = map.getZoom();
        
        // Stable label height offset
        const yOffset = -Math.max(30, zoom * 5);

        // Determine general trend of the unit cluster for rotation
        let angle = 0;
        if (teamUnits.length > 5) {
            // Find two points that represent the "spread"
            let furthest = teamUnits[0];
            let maxDist = -1;
            teamUnits.forEach(u => {
                const d = (u.lat - avgLat)**2 + (u.lng - avgLng)**2;
                if (d > maxDist) { maxDist = d; furthest = u; }
            });
            const pStart = map.latLngToContainerPoint([avgLat, avgLng]);
            const pEnd = map.latLngToContainerPoint([furthest.lat, furthest.lng]);
            angle = Math.atan2(pEnd.y - pStart.y, pEnd.x - pStart.x);
            
            // Normalize angle to be horizontal-ish and upright
            if (angle > Math.PI/2) angle -= Math.PI;
            if (angle < -Math.PI/2) angle += Math.PI;
            // Dampen rotation to prevent extreme jitters
            angle *= 0.3; 
        }

        // Show a minimum of 1 if there are still units in the cluster
        const text = this.formatSoldiers(clusterManpower > 0 && clusterManpower < 1 ? 1 : clusterManpower);
        
        ctx.save();
        ctx.translate(p.x, p.y + yOffset);
        ctx.rotate(angle);
        
        const fontSize = Math.max(12, zoom * 4);
        ctx.font = `900 ${fontSize}px "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Background stroke for maximum legibility
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 5;
        ctx.strokeText(text, 0, 0);
        
        ctx.fillStyle = team === 'A' ? '#ff4757' : '#2e86de';
        ctx.fillText(text, 0, 0);
        
        ctx.restore();
    },

    getBezierPoint: function(t, p0, p1, p2, p3) {
        const cx = 3 * (p1.x - p0.x);
        const bx = 3 * (p2.x - p1.x) - cx;
        const ax = p3.x - p0.x - cx - bx;
        const cy = 3 * (p1.y - p0.y);
        const by = 3 * (p2.y - p1.y) - cy;
        const ay = p3.y - p0.y - cy - by;
        const x = (ax * Math.pow(t, 3)) + (bx * Math.pow(t, 2)) + (cx * t) + p0.x;
        const y = (ay * Math.pow(t, 3)) + (by * Math.pow(t, 2)) + (cy * t) + p0.y;
        return { x, y };
    },

    getBezierTangent: function(t, p0, p1, p2, p3) {
        const cx = 3 * (p1.x - p0.x);
        const bx = 3 * (p2.x - p1.x) - cx;
        const ax = p3.x - p0.x - cx - bx;
        const cy = 3 * (p1.y - p0.y);
        const by = 3 * (p2.y - p1.y) - cy;
        const ay = p3.y - p0.y - cy - by;
        const dx = (3 * ax * Math.pow(t, 2)) + (2 * bx * t) + cx;
        const dy = (3 * ay * Math.pow(t, 2)) + (2 * by * t) + cy;
        return Math.atan2(dy, dx);
    },

    drawTextOnCurve: function(ctx, text, p0, p1, p2, p3, fontSize, letterSpacing) {
        if (!text || isNaN(fontSize) || fontSize <= 0) return;
        ctx.font = `bold ${fontSize}px "Times New Roman", Times, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const chars = text.split('');
        const charCount = chars.length;
        
        // Calculate total path length roughly
        const samples = 10;
        let length = 0;
        let prev = p0;
        for (let i = 1; i <= samples; i++) {
            const curr = this.getBezierPoint(i / samples, p0, p1, p2, p3);
            length += Math.sqrt((curr.x - prev.x)**2 + (curr.y - prev.y)**2);
            prev = curr;
        }

        const charWidth = fontSize * 0.6;
        const totalTextWidth = charCount * (charWidth + letterSpacing);
        
        // Center the text on the path
        const startT = 0.5 - (totalTextWidth / length) * 0.5;
        const stepT = (totalTextWidth / length) / charCount;

        const isZooming = this._zooming;
        chars.forEach((char, i) => {
            const t = startT + i * stepT + stepT/2;
            if (t < 0 || t > 1) return;
            
            const pos = this.getBezierPoint(t, p0, p1, p2, p3);
            const angle = this.getBezierTangent(t, p0, p1, p2, p3);
            
            ctx.save();
            ctx.translate(pos.x, pos.y);
            ctx.rotate(angle);
            
            // Optimization: Skip expensive stroke operations for labels during active zoom/pan
            if (!isZooming) {
                ctx.strokeStyle = 'rgba(0,0,0,0.8)';
                ctx.lineWidth = Math.max(2, fontSize / 5);
                ctx.strokeText(char, 0, 0);
            }
            ctx.fillStyle = 'white';
            ctx.fillText(char, 0, 0);
            
            ctx.restore();
        });
    },

    formatSoldiers: function(n) {
        return Math.floor(Math.max(0, n)).toLocaleString();
    },

    drawCasualtiesOnCanvas: function(ctx) {
        if (GS.gameState !== 'SIMULATING' && GS.gameState !== 'WAR_OVER') return;

        const padding = 15;
        const boxWidth = 160;
        const entryHeight = 25;
        const dpr = window.devicePixelRatio || 1;
        
        // Background for casualties panel
        const drawSidePanel = (poleIdx, x, y) => {
            let entries = GS.initialCombatants.filter(c => c.pole === poleIdx);
            // Check for mid-war joiners
            GS.sides.forEach((side, sIdx) => {
                if (sIdx % 2 === poleIdx) {
                    side.forEach(c => {
                        if (!entries.some(e => e.id === c.id)) {
                            entries.push({ id: c.id, name: c.name, pole: poleIdx });
                        }
                    });
                }
            });

            if (entries.length === 0) return 0;

            const totalHeight = 30 + (entries.length * entryHeight);
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            // Fallback for roundRect which is missing in some older browsers/webviews
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(x, y, boxWidth, totalHeight, 8);
            } else {
                ctx.rect(x, y, boxWidth, totalHeight);
            }
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.font = '900 12px "Segoe UI", Arial';
            ctx.textAlign = 'center';
            ctx.fillText('CASUALTIES', x + boxWidth / 2, y + 20);

            entries.forEach((c, i) => {
                const casualties = GS.countryCasualties.get(c.id) || 0;
                const formatted = this.formatSoldiers(casualties);
                const isDefeated = !GS.sides.flat().some(active => active && active.id === c.id);
                const isPrimary = (i === 0 && !isDefeated);
                const itemY = y + 45 + (i * entryHeight);

                ctx.save();
                if (isDefeated) ctx.globalAlpha = 0.45;

                // Draw Flag
                const meta = GS.countryMetadata[c.id - 1];
                const flag = meta?.tempFlag;
                if (flag && flag.complete && flag.naturalWidth > 0) {
                    const fw = isPrimary ? 28 : 20;
                    const fh = isPrimary ? 16 : 12;
                    ctx.drawImage(flag, x + 10, itemY - fh / 2 - 2, fw, fh);
                }

                // Draw Value
                ctx.fillStyle = poleIdx === 0 ? '#ff4757' : '#2e86de';
                ctx.font = `900 ${isPrimary ? '16px' : '11px'} monospace`;
                ctx.textAlign = 'left';
                ctx.fillText(formatted, x + 45, itemY);

                ctx.restore();
            });

            return totalHeight;
        };

        const mapSize = map.getSize();
        const startY = mapSize.y * 0.15;
        const startX = mapSize.x * 0.05;
        
        const hA = drawSidePanel(0, startX, startY);
        drawSidePanel(1, startX, startY + hA + 15);
    }
});

GS.influenceLayer = new ControlMapLayer().addTo(map);

// Create dedicated pane for reference images to ensure they stay behind the control map but above base imagery
map.createPane('refImagePane');
map.getPane('refImagePane').style.zIndex = 350;

/**
 * PERSISTENT GRID LOGIC
 */






/**
 * Returns all member country IDs in the same alliance graph as the given startId,
 * including the startId itself.
 */








DOM.addSideBtn.onclick = () => {
    if (GS.sides.length >= 8) {
        alert("Maximum 8 sides supported.");
        return;
    }
    GS.sides.push([]);
    GS.activeSideIndex = GS.sides.length - 1;
    updateSidesUI();
};

DOM.ffaToggleBtn.onclick = () => {
    GS.ffaMode = !GS.ffaMode;
    DOM.ffaToggleBtn.style.border = GS.ffaMode ? '2px solid #fff' : 'none';
    DOM.ffaToggleBtn.innerText = GS.ffaMode ? 'FFA: ON' : 'FFA Mode';
    if (GS.ffaMode) {
        // Explode all countries into their own sides
        const allCountries = GS.sides.flat();
        GS.sides = allCountries.map(c => [c]);
        if (GS.sides.length < 2) GS.sides = [[], []];
        GS.activeSideIndex = 0;
    } else {
        // Group back into 2 sides if FFA turned off
        const allCountries = GS.sides.flat();
        GS.sides = [[], []];
        allCountries.forEach((c, i) => {
            GS.sides[i % 2].push(c);
        });
    }
    updateSidesUI();
};

DOM.randomWarBtn.onclick = () => {
    GS.randomWarMode = !GS.randomWarMode;
    DOM.randomWarBtn.innerText = GS.randomWarMode ? "Random War: ON" : "Random War: OFF";
    DOM.randomWarBtn.style.background = GS.randomWarMode ? "#8e44ad" : "#9b59b6";
    
    if (GS.randomWarMode && (GS.gameState === 'SELECTING_P1' || GS.gameState === 'SELECTING_P2')) {
        triggerRandomWar({ balanced: true });
    }
};




/**
 * Procedurally generates desert biomes based on known global geographical coordinates.
 * This provides visual variety in 'Simplified Mode' for real-earth scenarios.
 */








function handleCountryClick(feature, layer, latlng, originalEvent = null) {
    const idx = getGridIndex(latlng.lat, latlng.lng);

    const isCtrlClick = !!(originalEvent && (originalEvent.ctrlKey || originalEvent.metaKey));

    if (GS.godModeActive && GS.godBombActive) {
        const ownerIdAtClick = idx !== -1 ? GS.worldControlMap[idx] : 0;
        const isShift = originalEvent && originalEvent.shiftKey;

        // Selection Phase: Pick a source country if none selected, or if Shift-clicking a new country
        if (GS.godBombSourceId <= 0 || (isShift && ownerIdAtClick > 0)) {
            if (ownerIdAtClick > 0) {
                GS.godBombSourceId = ownerIdAtClick;
                const meta = GS.countryMetadata[GS.godBombSourceId - 1];
                DOM.statusText.innerText = `GOD BOMB: ${meta?.name || 'Nation'} is the bomber. Click anywhere to target.`;
                playClickSound();
            } else {
                DOM.statusText.innerText = "GOD BOMB: Click a country to select who fires.";
            }
        } else {
            // Firing Phase: Launch bomb from the source country to the clicked location
            const senderMeta = GS.countryMetadata[GS.godBombSourceId - 1];
            const sideIdx = GS.sides.findIndex(s => s.some(c => c.id === GS.godBombSourceId));
            const team = (sideIdx !== -1 && (sideIdx % 2 !== 0)) ? 'B' : 'A';
            
            // Try to find an existing missile base in the sender's territory
            const myBases = GS.bases.filter(b => b.team === team && getGridIndex(b.lat, b.lng) !== -1 && GS.worldControlMap[getGridIndex(b.lat, b.lng)] === GS.godBombSourceId);
            let fromLat, fromLng;
            
            if (myBases.length > 0) {
                const b = myBases[Math.floor(Math.random() * myBases.length)];
                fromLat = b.lat; fromLng = b.lng;
            } else if (senderMeta && senderMeta.stableCenter) {
                fromLat = senderMeta.stableCenter.lat; fromLng = senderMeta.stableCenter.lng;
            } else {
                // Fallback for nations with no center or land
                fromLat = latlng.lat + 5; fromLng = latlng.lng + 5;
            }
            
            launchBomb(fromLat, fromLng, latlng.lat, latlng.lng, team);
            playClickSound();
            DOM.statusText.innerText = `GOD BOMB: ${senderMeta?.name || 'Nation'} strike launched. (Shift+Click to change bomber)`;
        }
        return;
    }

    // Defensive normalization: when God Mode is OFF and we're in a Conquest game, a
    // *leftover* EDITOR_* paint/active state is never valid. If one leaks past the
    // God-Mode-exit handler (e.g. a paint stroke whose mouseup landed off the map, or
    // a tool sub-state that wasn't sanitized), the EDITOR_* branches below would silently
    // swallow this click and the country would never get added to the conflict setup —
    // exactly the "can't add countries after painting then exiting god mode" symptom.
    // BUT the inspector exposes intentional one-click tools during setup (Annex, place
    // division, select ally/overlord/releaser, place country). Those legitimately set an
    // EDITOR_* state and need this very click to complete, so they must be allowed
    // through — resetting them is what broke "absorbing countries doesn't work". Only
    // snap back the passive leftover states; let the intentional tool states fall through.
    const INTENTIONAL_TOOL_STATES = new Set([
        'EDITOR_ANNEXING', 'EDITOR_PLACING', 'EDITOR_PLACING_DIVISION',
        'EDITOR_SELECTING_OVERLORD', 'EDITOR_SELECTING_ALLY', 'EDITOR_SELECTING_RELEASER',
    ]);
    // The inspector's paint/fill/unclaim tools also set an EDITOR_* state, and unlike the
    // others they can be entered without god mode (via the country inspector during setup).
    // They count as intentional ONLY while a country is actively selected for editing
    // (editingCountryId > 0) — leftover strokes after a god-mode exit always have
    // editingCountryId reset to -1 (see god-mode-exit sanitizer), so this keeps the
    // leftover-cleanup intact while letting a live paint session survive each tap. Without
    // this, the trailing click after every paint tap reset EDITOR_PAINTING -> SELECTING_P1,
    // so on mobile the brush deactivated after a single dab and the user had to re-press
    // PAINT for every tile (commenter bug, 2026-06-20).
    const ACTIVE_EDIT_STATES = new Set(['EDITOR_PAINTING', 'EDITOR_FILLING', 'EDITOR_UNCLAIMING']);
    const isActiveInspectorEdit = GS.editingCountryId > 0 && ACTIVE_EDIT_STATES.has(GS.gameState);
    if (!GS.godModeActive && GS.gameMode === 'CONQUEST' &&
        typeof GS.gameState === 'string' && GS.gameState.startsWith('EDITOR') &&
        !INTENTIONAL_TOOL_STATES.has(GS.gameState) && !isActiveInspectorEdit) {
        GS.gameState = 'SELECTING_P1';
        GS.isPainting = false;
        GS.editingCountryId = -1;
        if (map.dragging && !map.dragging.enabled()) map.dragging.enable();
        if (DOM.setupPanel && DOM.setupPanel.style.display === 'none') {
            DOM.setupPanel.style.display = 'block';
            updateSidesUI();
        }
    }

    if (GS.gameState === 'EDITOR_PLACING') {
        placeNewCountry(latlng);
        return;
    }

    if (GS.gameState === 'EDITOR_PAINTING_TERRAIN') {
        // paintAt already handles the actual landMask modification via mousedown/mousemove
        return;
    }

    if (GS.gameState === 'EDITOR_PLACING_DIVISION') {
        const countryIdAtClick = idx !== -1 ? GS.worldControlMap[idx] : 0;
        if (GS.editingCountryId <= 0) {
            if (countryIdAtClick > 0) {
                GS.editingCountryId = countryIdAtClick;
                const meta = GS.countryMetadata[GS.editingCountryId - 1];
                DOM.statusText.innerText = `DEPLOYMENT: ${meta.name} (Click map to deploy divisions)`;
            } else {
                DOM.statusText.innerText = "SELECT SOURCE: Click a nation on the map first";
            }
        } else {
            placeDivisionAt(latlng, GS.editingCountryId);
        }
        return;
    }

    if (GS.gameState === 'EDITOR_ANNEXING') {
        const targetId = idx !== -1 ? GS.worldControlMap[idx] : 0;
        if (targetId > 0 && targetId !== GS.editingCountryId) {
            const victimMeta = GS.countryMetadata[targetId - 1];
            const victimName = victimMeta ? victimMeta.name : "Target";
            
            // RELEASABLE TRANSFER: Transfer victim's releasables to the annexer
            GS.countryMetadata.forEach(m => {
                if (m && m.releasableBy === targetId) {
                    m.releasableBy = GS.editingCountryId;
                }
            });

            // Transfer all territory
            for (let i = 0; i < GS.worldControlMap.length; i++) {
                if (GS.worldControlMap[i] === targetId) {
                    GS.worldControlMap[i] = GS.editingCountryId;
                }
            }
            
            // Clean up live simulation data for the victim
            GS.sides.forEach(side => {
                const sIdx = side.findIndex(c => c.id === targetId);
                if (sIdx > -1) side.splice(sIdx, 1);
            });
            GS.units = GS.units.filter(u => u.sovereignId !== targetId);

            DOM.statusText.innerText = `ANNEXED: ${victimName} absorbed.`;
            recalculateAllBounds();
            GS.influenceLayer.render();
            updateSidesUI();
            
            // Return to inspector
            openInspector(GS.editingCountryId);
            GS.gameState = 'EDITOR_ACTIVE';
            map.getContainer().classList.remove('painting-cursor');
        } else {
            DOM.statusText.innerText = "Selection Cancelled: Clicked neutral land or self.";
            openInspector(GS.editingCountryId);
            GS.gameState = 'EDITOR_ACTIVE';
            map.getContainer().classList.remove('painting-cursor');
        }
        return;
    }

    if (GS.gameState === 'EDITOR_SELECTING_OVERLORD') {
        const sovereignId = idx !== -1 ? GS.worldControlMap[idx] : 0;
        if (sovereignId > 0 && sovereignId !== GS.selectingOverlordForId) {
            setVassalage(GS.selectingOverlordForId, sovereignId);
        } else {
            DOM.statusText.innerText = "Selection Cancelled";
        }
        GS.gameState = GS.godModeActive ? 'EDITOR_ACTIVE' : 'EDITOR_ACTIVE'; 
        if (GS.godModeActive) GS.gameState = 'EDITOR_ACTIVE'; 
        GS.selectingOverlordForId = -1;
        map.getContainer().classList.remove('painting-cursor');
        return;
    }

    if (GS.gameState === 'EDITOR_SELECTING_ALLY') {
        const targetId = idx !== -1 ? GS.worldControlMap[idx] : 0;
        if (targetId > 0 && targetId !== GS.selectingAllyForId) {
            const aMeta = GS.countryMetadata[GS.selectingAllyForId - 1];
            const bMeta = GS.countryMetadata[targetId - 1];
            if (aMeta && bMeta) {
                aMeta.allies = Array.from(new Set([...(aMeta.allies || []), targetId]));
                bMeta.allies = Array.from(new Set([...(bMeta.allies || []), GS.selectingAllyForId]));
                DOM.statusText.innerText = `Alliance formed: ${aMeta.name} ↔ ${bMeta.name}`;
            }
        } else {
            DOM.statusText.innerText = "Ally selection cancelled";
        }
        GS.selectingAllyForId = -1;
        GS.gameState = 'EDITOR_ACTIVE';
        map.getContainer().classList.remove('painting-cursor');
        recalculateAllBounds();
        GS.influenceLayer.render();
        return;
    }

    if (GS.gameState === 'EDITOR_SELECTING_RELEASER') {
        const sovereignId = idx !== -1 ? GS.worldControlMap[idx] : 0;
        if (sovereignId > 0 && sovereignId !== GS.selectingOverlordForId) {
            setAsReleasable(GS.selectingOverlordForId, sovereignId);
        } else {
            DOM.statusText.innerText = "Selection Cancelled";
        }
        GS.gameState = 'EDITOR_ACTIVE';
        GS.selectingOverlordForId = -1;
        map.getContainer().classList.remove('painting-cursor');
        return;
    }

    if (idx === -1) return;
    
    let sovereignId = GS.worldControlMap[idx];

    // Ctrl-click multi-select support in editor / god mode
    if (isCtrlClick && sovereignId > 0 && (GS.gameMode === 'EDITOR' || GS.godModeActive)) {
        if (GS.selectedCountryIds.has(sovereignId)) {
            GS.selectedCountryIds.delete(sovereignId);
        } else {
            GS.selectedCountryIds.add(sovereignId);
        }
        const count = GS.selectedCountryIds.size;
        DOM.statusText.innerText = count > 0
            ? `Selected ${count} countr${count === 1 ? 'y' : 'ies'} for ZIP export`
            : "Map Editor (Alpha)";
        // Keep normal inspector / setup logic from running on Ctrl-click
        GS.influenceLayer.render();
        return;
    }
    
    // In God Mode or Simulation, clicking occupied land selects the current occupier
    if (GS.gameState === 'SIMULATING' || GS.godModeActive) {
        const occ = GS.occupationMap[idx];
        if (GS.landMask[idx] === 2 && Math.abs(occ) > 0.1) {
            const occupierId = GS.primaryOccupierMap[idx];
            if (occupierId > 0) sovereignId = occupierId;
        }
    }

    if (GS.gameState === 'PEACE_SELECT_1') {
        if (sovereignId > 0) {
            const sideCountry = GS.sides.flat().filter(Boolean).find(c => c.id === sovereignId);
            if (sideCountry) {
                GS.peaceSelection1 = sideCountry;
                GS.gameState = 'PEACE_SELECT_2';
                DOM.statusText.innerText = `Peace for ${sideCountry.name}: Select Opponent`;
                GS.influenceLayer.render();
            }
        }
        return;
    }

    if (GS.gameState === 'PEACE_SELECT_2') {
        if (sovereignId > 0) {
            const sideCountry = GS.sides.flat().filter(Boolean).find(c => c.id === sovereignId);
            if (sideCountry) {
                signSelectivePeace(GS.peaceSelection1, sideCountry);
            }
        }
        return;
    }


    if (GS.gameState === 'SIMULATING') {
        if (sovereignId > 0) {
            openInspector(sovereignId);
        }
        return;
    }

    if (GS.gameState === 'WAR_OVER') return;
    
    if (GS.gameState === 'EDITOR_ACTIVE' || GS.gameState === 'EDITOR_PAINTING' || GS.gameState === 'EDITOR_FILLING' || GS.gameState === 'EDITOR_FILLING_TERRAIN') {
        if (GS.gameState === 'EDITOR_FILLING') {
            fillAt(latlng);
        } else if (GS.gameState === 'EDITOR_FILLING_TERRAIN') {
            fillTerrainAt(latlng);
        } else if (GS.gameState === 'EDITOR_PAINTING') {
            // The brush paints in mousedown/mousemove and always targets the already-selected
            // editingCountryId, so the trailing click after a paint dab must be a no-op: do NOT
            // reopen the inspector (it would pop the panel over the map after every tap) and do
            // NOT reselect whatever country sits under the tap. Stay in paint mode so the user
            // can keep dabbing without re-pressing PAINT (the mobile single-dab bug, 2026-06-20).
        } else if (sovereignId > 0) {
            // EDITOR_ACTIVE: select the nation and open the inspector
            GS.editingCountryId = sovereignId;
            openInspector(sovereignId);

            if (GS.godModeActive && GS.gameState === 'EDITOR_ACTIVE') {
                const meta = GS.countryMetadata[sovereignId - 1];
                DOM.statusText.innerText = `GOD MODE: ${meta.name || 'Selected Nation'} selected.`;
            }
        }
        return;
    }

    // Conquest Selection Logic
    if (sovereignId <= 0) return; // Must click a country in Conquest mode
    
    const meta = GS.countryMetadata[sovereignId - 1];
    if (!meta) return;

    const targetFeature = meta.feature;
    const countryName = meta.name || targetFeature?.properties?.NAME || targetFeature?.properties?.name || "Unknown";
    const color = meta.color;

    // Smart Reassignment Logic: If country is already in a side, move it or open inspector
    let existingSideIdx = -1;
    GS.sides.forEach((side, idx) => {
        if (side && side.some(c => c && c.id === sovereignId)) existingSideIdx = idx;
    });

    if (existingSideIdx !== -1) {
        if (existingSideIdx === GS.activeSideIndex) {
            // Already in active side: open inspector for editing, with double-click protection
            if (Date.now() - GS.lastSelectionTime > 350 || GS.lastSelectedId !== sovereignId) {
                openInspector(sovereignId);
            }
        } else {
            // In a different side: transfer to active side instead of blocking or opening inspector
            const countryToMove = GS.sides[existingSideIdx].find(c => c.id === sovereignId);
            GS.sides[existingSideIdx] = GS.sides[existingSideIdx].filter(c => c.id !== sovereignId);
            GS.sides[GS.activeSideIndex].push(countryToMove);
            updateSidesUI();
            DOM.statusText.innerText = `REASSIGNED: ${countryName} moved to Side ${String.fromCharCode(65 + GS.activeSideIndex)}`;
            GS.influenceLayer.render();
        }
        GS.lastSelectionTime = Date.now();
        GS.lastSelectedId = sovereignId;
        return;
    }

    if (GS.ffaMode) {
        // In FFA, every new click creates a new side if the current active side isn't empty
        if (GS.sides[GS.activeSideIndex] && GS.sides[GS.activeSideIndex].length > 0) {
            GS.sides.push([]);
            GS.activeSideIndex = GS.sides.length - 1;
        }
    }

    // Guard against a stale active-side index (e.g. left over from a prior setup or a
    // mode switch) silently dropping the click instead of adding the country.
    if (!Array.isArray(GS.sides) || GS.sides.length === 0) GS.sides = [[], []];
    if (GS.activeSideIndex < 0 || GS.activeSideIndex >= GS.sides.length) {
        GS.activeSideIndex = 0;
    }
    const targetList = GS.sides[GS.activeSideIndex];
    if (!targetList) return;

    const newCountry = {
        feature: targetFeature,
        id: sovereignId,
        color: color,
        name: countryName,
        buffState: meta.buffState || 'none', // Carry over buff state from meta
        flag: null,
        strategy: 'BALANCED',
        role: 'OFFENSE'
    };

    targetList.push(newCountry);

    // In alliance view, automatically recruit other members of the same alliance
    // into the same side when one member is selected.
    if (GS.allianceViewEnabled) {
        const allianceMembers = getAllianceMembers(sovereignId);
        const alreadyInAnySide = new Set(GS.sides.flat().filter(Boolean).map(c => c.id));
        allianceMembers.forEach(aid => {
            if (aid === sovereignId) return;
            if (alreadyInAnySide.has(aid)) return;
            const m = GS.countryMetadata[aid - 1];
            if (!m) return;
            // Only add members that actually have territory on the current map
            const hasLand = GS.worldControlMap && GS.worldControlMap.some && GS.worldControlMap.some(v => v === aid);
            if (!hasLand) return;
            targetList.push({
                feature: m.feature,
                id: m.id,
                color: m.color,
                name: m.name,
                buffState: m.buffState || 'none',
                flag: m.tempFlag || null,
                strategy: 'BALANCED',
                role: 'OFFENSE'
            });
            alreadyInAnySide.add(aid);
        });
    }

    GS.lastSelectionTime = Date.now();
    GS.lastSelectedId = sovereignId;
    updateSidesUI();
    DOM.statusText.innerText = "Conflict Setup (Select more or click Inaugurate)";
    GS.influenceLayer.render();

    // Tutorial Progression Logic
    if (GS.tutorialActive) {
        const step = GS.activeTutorialSet[GS.currentTutorialStep];
        if (step.actionRequired === "SELECT_GERMANY" && countryName.toLowerCase() === "germany") {
            advanceTutorial();
        } else if (step.actionRequired === "SELECT_POLAND" && countryName.toLowerCase() === "poland" && GS.activeSideIndex === 1) {
            advanceTutorial();
        }
    }
}



















/**
 * Build and show global leaderboard of all countries with current size and estimated unit strength.
 */





export function resetToSelection() {
    stopWarAmbiance();
    // Stop in‑game time progression but keep the last war date visible in the setup
    GS.gameTimeEnabled = false;
    GS.gameTimeAccumulatorMs = 0;
    if (GS.gameTimeDate && DOM.timeYearInput && DOM.timeMonthInput && DOM.timeDayInput) {
        DOM.timeYearInput.value = GS.gameTimeDate.year;
        DOM.timeMonthInput.value = GS.gameTimeDate.month;
        DOM.timeDayInput.value = GS.gameTimeDate.day;
        if (DOM.gameDateDisplay) {
            DOM.gameDateDisplay.textContent = formatGameDate();
            DOM.gameDateDisplay.style.display = 'block';
        }
    }
    
    // If in God Mode, we reset the underlying state that will be restored on exit
    if (GS.godModeActive) {
        GS.preGodModeState = 'SELECTING_P1';
    }

    if (GS.gameMode === 'EDITOR' || GS.gameMode === 'EDITOR_TEST') {
        if (GS.gameMode === 'EDITOR_TEST') {
            GS.gameMode = 'EDITOR';
            DOM.editorToolbox.style.display = 'flex';
        }
        if (!GS.godModeActive) {
            GS.gameState = 'EDITOR_ACTIVE';
            DOM.statusText.innerText = "Map Editor (Alpha)";
        }
        DOM.setupPanel.style.display = 'none';
        DOM.statsPanel.style.display = 'none';
        DOM.resetBtn.style.display = 'block';
        DOM.ffBtn.style.display = 'none';
        DOM.forcePeaceBtn.style.display = 'none';
        DOM.unitCountsDiv.style.display = 'none';
        updateRestartVisibility();
        GS.influenceLayer.render();
        if (!GS.godModeActive) return;
    }
    GS.gameState = 'SELECTING_P1';
    GS.sides = [[], []]; // 2 empty sides (Side A / Side B); empty sides ignored at war start
    GS.attackers = GS.sides[0];
    GS.defenders = GS.sides[1];
    GS.activeSideIndex = 0;
    GS.ffaMode = false;
    DOM.ffaToggleBtn.style.border = 'none';
    DOM.ffaToggleBtn.innerText = 'FFA Mode';
    GS.buffedTeam = null;
    GS.units = [];
    GS.unitSpatialHash.clear();
    GS.activeBattles = [];
    GS.bombs = [];
    GS.explosions = [];
    GS.encirclePops = [];
    GS.bases = [];
    // Clear naval leftovers so no ship ghost/boat survives into the next selection.
    GS.navalLandings = [];
    GS.boats = [];
    setSpeed(0);
    GS.frameAccumulator = 0;
    
    DOM.statusText.innerText = "Select First Country";
    DOM.setupPanel.style.display = 'block';
    DOM.setupOptions.style.display = 'none';
    
    updateSidesUI();

    DOM.statsPanel.style.display = 'none';
    document.getElementById('game-status').style.display = 'flex'; // Restore if cinematic
    DOM.casualtyPanel.style.display = 'none';
    DOM.resetBtn.style.display = GS.currentScenarioContext ? 'block' : 'none';
    DOM.restartScenarioBtn.style.display = 'block';
    document.getElementById('speed-controls').style.display = 'none';
    DOM.godModeBtn.style.display = (GS.gameMode === 'CONQUEST' || GS.godModeActive) ? 'block' : 'none';
    DOM.godBombBtn.style.display = 'none';
    GS.godBombActive = false;
    GS.godBombSourceId = -1;
    DOM.godBombBtn.innerText = "GOD BOMB: OFF";
    DOM.godBombBtn.classList.remove('active');
    DOM.forcePeaceBtn.style.display = 'none';
    DOM.unitCountsDiv.style.display = 'none';
    DOM.treatyAlert.style.display = 'none';
    const _pab = document.getElementById('play-again-btn');
    if (_pab) _pab.style.display = 'none';
}

async function resetGame() {
    cancelAnimationFrame(GS.animationFrameId);
    
    // Scenario-specific reset: Reload the original preset if available
    if (GS.currentScenarioContext && GS.currentScenarioContext.blobUrl) {
        loadingStatus.innerText = "Reloading Scenario Assets...";
        DOM.loadingOverlay.style.display = 'flex';
        try {
            const response = await fetch(GS.currentScenarioContext.blobUrl);
            if (!response.ok) throw new Error("Reload failed");
            const blob = await response.blob();
            await performPresetLoad(blob, GS.gameMode);
            return;
        } catch (e) {
            console.error("Satellite Reset Failed:", e);
        }
    }

    GS.worldControlMap.fill(0);
    GS.occupationMap.fill(0);
    GS.landMask.fill(0);
    resetToSelection();
    updateRestartVisibility();
    // Re-initialize landmask from features
    const mapRes = document.getElementById('map-res-select').value;
    const geoUrl = `${CONFIG.GEOJSON_BASE}${mapRes}/cultural/ne_${mapRes}_admin_0_countries.json`;
    loadCountries(geoUrl, GS.gameMode === 'EDITOR');
}

/**
 * INTERACTION
 */

map.on('click', (e) => {
    const originalEvent = e.originalEvent || e;

    // War-goal claim marking takes priority over all other click handling.
    if (GS.warGoalMode) {
        handleWarGoalClick(e.latlng);
        return;
    }

    // City move / create modes take priority
    if ((GS.gameMode === 'EDITOR' || GS.godModeActive) && GS.cityEditMode === 'MOVE' && GS.editingCityId > 0) {
        const city = GS.cities.find(c => c.id === GS.editingCityId);
        if (city) {
            city.lat = e.latlng.lat;
            city.lng = e.latlng.lng;
            DOM.statusText.innerText = `Moved ${city.name} to new position`;
            GS.cityEditMode = null;
            DOM.cityInspector.style.display = 'block';
            GS.influenceLayer.render();
            return;
        }
        GS.cityEditMode = null;
    }

    if ((GS.gameMode === 'EDITOR' || GS.godModeActive) && GS.cityEditMode === 'CREATE') {
        const newId = (GS.cities.length ? Math.max(...GS.cities.map(c => c.id || 0)) : 0) + 1;
        const idx = getGridIndex(e.latlng.lat, e.latlng.lng);
        const ownerId = idx !== -1 ? GS.worldControlMap[idx] : null;
        const newCity = {
            id: newId,
            name: "New City",
            lat: e.latlng.lat,
            lng: e.latlng.lng,
            pop: 0,
            isCapital: false,
            ownerId: ownerId,
            isCustom: true
        };
        GS.cities.push(newCity);
        GS.activeTheaterCities = GS.cities;
        DOM.statusText.innerText = "New city created. Use the City Inspector to name and assign it.";
        GS.cityEditMode = null;
        openCityInspector(newId);
        GS.influenceLayer.render();
        return;
    }

    // City click detection (editor / god mode)
    if (GS.gameMode === 'EDITOR' || GS.godModeActive) {
        const city = findCityAtLatLng(e.latlng);
        if (city) {
            openCityInspector(city.id);
            return;
        }
    }
    // Outside editor/god mode, city clicks do nothing (no popup)

    handleCountryClick(null, null, e.latlng, originalEvent);
});

map.on('mousemove', (e) => {
    DOM.coordsDisplay.textContent = `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
});

DOM.viewModeBtn.addEventListener('click', () => {
    // Cycle between POLITICAL <-> FLAG; alliance overlay is controlled separately by its own toggle
    if (GS.viewMode === 'POLITICAL') {
        GS.viewMode = 'FLAG';
        DOM.viewModeBtn.innerText = "FLAG VIEW";
        DOM.viewModeBtn.style.background = "#8e44ad";
    } else {
        GS.viewMode = 'POLITICAL';
        DOM.viewModeBtn.innerText = "POLITICAL";
        DOM.viewModeBtn.style.background = "#3498db";
    }

    // When switching view modes mid‑war, force a fresh recompute of country
    // bounds and occupation visuals so frontlines don't appear to vanish.
    if (GS.gameState === 'SIMULATING' || (GS.godModeActive && GS.preGodModeState === 'SIMULATING')) {
        if (typeof recalculateAllBounds === 'function') {
            recalculateAllBounds();
        }
    }

    if (GS.influenceLayer && typeof GS.influenceLayer._update === 'function') {
        GS.influenceLayer._forceRender = true;
        GS.influenceLayer._update();
    } else if (GS.influenceLayer) {
        GS.influenceLayer.render();
    }
});


if (DOM.allianceViewCheckbox) {
    DOM.allianceViewCheckbox.checked = GS.allianceViewEnabled;
    DOM.allianceViewCheckbox.addEventListener('change', (e) => {
        GS.allianceViewEnabled = e.target.checked;
        if (GS.influenceLayer) {
            GS.influenceLayer._forceRender = true;
            if (typeof GS.influenceLayer._update === 'function') GS.influenceLayer._update();
            else GS.influenceLayer.render();
        }
    });
}

DOM.battlesToggleBtn.addEventListener('click', () => {
    GS.showBattleIndicators = !GS.showBattleIndicators;
    DOM.battlesToggleBtn.classList.toggle('active', GS.showBattleIndicators);
    GS.influenceLayer.render();
});

if (DOM.labelsToggleBtn) {
    DOM.labelsToggleBtn.classList.toggle('active', GS.showCountryLabels);
    DOM.labelsToggleBtn.addEventListener('click', () => {
        GS.showCountryLabels = !GS.showCountryLabels;
        // Clear cached anchors whenever label mode changes so they can be re-anchored once
        GS.countryLabelAnchors.clear();
        DOM.labelsToggleBtn.classList.toggle('active', GS.showCountryLabels);
        // Force a full redraw so labels respond instantly, even outside active wars
        if (GS.influenceLayer) {
            GS.influenceLayer._forceRender = true;
            if (typeof GS.influenceLayer._update === 'function') {
                GS.influenceLayer._update();
            } else {
                GS.influenceLayer.render();
            }
        }
    });
}

if (DOM.citiesToggleBtn) {
    DOM.citiesToggleBtn.classList.toggle('active', GS.showNonCapitalCities);
    DOM.citiesToggleBtn.addEventListener('click', () => {
        GS.showNonCapitalCities = !GS.showNonCapitalCities;
        DOM.citiesToggleBtn.classList.toggle('active', GS.showNonCapitalCities);
        if (GS.influenceLayer) GS.influenceLayer.render();
    });
}

// Sync mountain toggles
if (DOM.noPeaceCheckbox) {
    DOM.noPeaceCheckbox.addEventListener('change', () => {
        GS.peaceTreatiesDisabled = DOM.noPeaceCheckbox.checked;
    });
}

if (DOM.cityFocusCheckbox) {
    DOM.cityFocusCheckbox.addEventListener('change', () => {
        GS.cityFocusMode = DOM.cityFocusCheckbox.checked;
    });
}

DOM.setupDisableMountainsCheckbox.addEventListener('change', async (e) => {
    const disabled = e.target.checked;
    GS.mountainsEnabled = !disabled;
    DOM.mainDisableMountainsCheckbox.checked = disabled;
    // Persist immediately
    setCookie('mw_disable_mountains', disabled ? 'true' : 'false');
    
    if (GS.mountainsEnabled && GS.terrainMask.every(v => v === 0)) {
        const currentMapRes = document.getElementById('map-res-select').value;
        await loadTerrain(currentMapRes);
    }
    GS.influenceLayer.render();
});

DOM.mainDisableMountainsCheckbox.addEventListener('change', (e) => {
    DOM.setupDisableMountainsCheckbox.checked = e.target.checked;
    GS.mountainsEnabled = !e.target.checked;
    // Persist immediately
    setCookie('mw_disable_mountains', e.target.checked ? 'true' : 'false');
    GS.influenceLayer.render();
});

// Sync province toggles
DOM.setupDisableProvincesCheckbox.addEventListener('change', (e) => {
    const disabled = e.target.checked;
    GS.provincesEnabled = !disabled;
    DOM.mainDisableProvincesCheckbox.checked = disabled;
    // Persist immediately
    setCookie('mw_disable_provinces', disabled ? 'true' : 'false');
    GS.influenceLayer.render();
});

DOM.mainDisableProvincesCheckbox.addEventListener('change', (e) => {
    const disabled = e.target.checked;
    DOM.setupDisableProvincesCheckbox.checked = disabled;
    GS.provincesEnabled = !disabled;
    // Persist immediately
    setCookie('mw_disable_provinces', disabled ? 'true' : 'false');
    GS.influenceLayer.render();
});


DOM.restartScenarioBtn.addEventListener('click', resetGame);

// QUICK RESTART: instant in‑memory reset back to scenario start without loading overlay.
// Returns true if it restored from snapshots (lands in SELECTING_P1 with the pristine
// map), false if it had to fall back to the heavy resetGame() path.
export function quickRestartToSelection() {
        // If we never captured a snapshot (e.g. user hits quick restart before a war),
        // just fall back to the heavy reset.
        if (!GS.initialWorldControlMapSnapshot || !GS.initialDeJureMapSnapshot || !GS.initialProvinceMapSnapshot || !GS.initialLandMaskSnapshot) {
            resetGame();
            return false;
        }

        // Stop any running simulation loops and sounds but do NOT show the loading overlay.
        if (GS.animationFrameId !== null) {
            cancelAnimationFrame(GS.animationFrameId);
            GS.animationFrameId = null;
        }
        if (GS.backgroundTickId) {
            clearInterval(GS.backgroundTickId);
            GS.backgroundTickId = null;
        }
        stopWarAmbiance();

        // Defense-in-depth: any path back to a fresh selection clears the
        // auto-continue PLAY AGAIN button so it can't linger onto setup.
        const _pab = document.getElementById('play-again-btn');
        if (_pab) _pab.style.display = 'none';

        // Restore core grid state
        GS.worldControlMap.set(GS.initialWorldControlMapSnapshot);
        GS.deJureMap.set(GS.initialDeJureMapSnapshot);
        GS.provinceMap.set(GS.initialProvinceMapSnapshot);
        GS.landMask.set(GS.initialLandMaskSnapshot);
        if (GS.initialBiomeMaskSnapshot) GS.biomeMask.set(GS.initialBiomeMaskSnapshot);

        // Restore metadata and cities from snapshots
        // Note: we avoid deepClone (JSON) here because it breaks Infinity values in bounds and loses Image references
        if (GS.initialCountryMetadataSnapshot) {
            GS.countryMetadata = GS.initialCountryMetadataSnapshot.map(m => {
                if (!m) return null;
                // Create a fresh shallow copy to avoid mutating the snapshot
                const newMeta = { ...m };
                // Re-initialize bounds correctly if they were lost or corrupted
                newMeta.bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
                
                // Restore the Drawable Image object for flags
                if (newMeta.flagUrl) {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.onload = () => { if (GS.influenceLayer) GS.influenceLayer.render(); };
                    img.src = newMeta.flagUrl;
                    newMeta.tempFlag = img;
                }
                return newMeta;
            });
        }
        
        if (GS.initialCitiesSnapshot) {
            GS.cities = GS.initialCitiesSnapshot.map(c => ({ ...c }));
        }

        // Hide loading screen just in case it was triggered by a fallback
        DOM.loadingOverlay.style.display = 'none';

        // Clear all dynamic war state
        GS.occupationMap.fill(0);
        GS.primaryOccupierMap.fill(0);
        GS.units = [];
        GS.bombs = [];
        GS.explosions = [];
        GS.encirclePops = [];
        GS.bases = [];
        GS.activeBattles = [];
        GS.capitalLostCountries = new Set();
        GS.activeRebellion = null;
        GS.countryCasualties.clear();
        GS.latestCountryStats.clear();
        GS.selectedCountryIds.clear();

        // Reset time system and manpower to pristine state
        GS.gameTimeEnabled = false;
        GS.gameTimeDate = null;
        GS.gameTimeAccumulatorMs = 0;
        if (DOM.gameDateDisplay) {
            DOM.gameDateDisplay.style.display = 'none';
        }
        GS.conflictName = '';
        if (DOM.conflictNameBanner) {
            DOM.conflictNameBanner.textContent = '';
            DOM.conflictNameBanner.style.display = 'none';
        }
        GS.teamASoldiers = 0;
        GS.teamBSoldiers = 0;
        GS.initialTeamASoldiers = 0;
        GS.initialTeamBSoldiers = 0;
        GS.soldiersPerUnitA = CONFIG.UNIT_TO_SOLDIER_RATIO;
        GS.soldiersPerUnitB = CONFIG.UNIT_TO_SOLDIER_RATIO;

        // Reset sides / selection but keep the active scenario context
        GS.sides = [[], []]; // 2 empty sides (Side A / Side B); empty sides ignored at war start
        GS.attackers = GS.sides[0];
        GS.defenders = GS.sides[1];
        GS.activeSideIndex = 0;
        GS.teamAId = -1;
        GS.ffaMode = false;
        GS.buffedTeam = null;

        // Reset UI back to conflict setup with no loading screen
        GS.gameState = 'SELECTING_P1';
        DOM.statusText.innerText = getTranslation('SELECT_P1');
        DOM.setupPanel.style.display = 'block';
        DOM.setupOptions.style.display = 'none';
        DOM.statsPanel.style.display = 'none';
        DOM.casualtyPanel.style.display = 'none';
        document.getElementById('speed-controls').style.display = 'none';
        DOM.godModeBtn.style.display = (GS.gameMode === 'CONQUEST') ? 'block' : 'none';
        DOM.forcePeaceBtn.style.display = 'none';
        DOM.unitCountsDiv.style.display = 'none';
        DOM.treatyAlert.style.display = 'none';
        GS.frameAccumulator = 0;
        GS.simFrameCount = 0;
        setSpeed(0);
        updateSidesUI();
        updateRestartVisibility();
        recalculateAllBounds();
        
        // Force an immediate high-priority redraw of the canvas layer
        if (GS.influenceLayer) {
            GS.influenceLayer._forceRender = true;
            if (typeof GS.influenceLayer._update === 'function') {
                GS.influenceLayer._update();
            } else {
                GS.influenceLayer.render();
            }
        }
        return true;
}

if (DOM.quickRestartBtn) {
    DOM.quickRestartBtn.addEventListener('click', () => { quickRestartToSelection(); });
}

// AUTO-CONTINUE: one-tap "PLAY AGAIN" from the war-over screen. Instantly restores
// the pristine map (reusing the tested quick-restart path) and drops the finisher
// straight into a fresh random adjacent war, instead of dumping them to an empty
// select screen. Returns true if a new war actually started.
function startFreshRandomWar() {
    const restored = quickRestartToSelection();
    if (!restored) return false; // heavy resetGame() already ran; leave player at the reload
    const prev = GS.randomWarMode;
    GS.randomWarMode = true;
    triggerRandomWar({ preferSmall: true });
    GS.randomWarMode = prev;
    const activeSides = (GS.sides || []).filter(s => s.length > 0).length;
    return activeSides >= 2;
}

const playAgainBtn = document.getElementById('play-again-btn');
if (playAgainBtn) {
    playAgainBtn.addEventListener('click', () => {
        playAgainBtn.style.display = 'none';
        DOM.treatyAlert.style.display = 'none';
        // If no valid adjacent pair / no snapshot, fall back to the clean select screen.
        if (!startFreshRandomWar()) resetToSelection();
    });
}

DOM.resetBtn.addEventListener('click', resetGame);

// In‑game MENU button: return to main menu without full page reload
DOM.mainMenuBtn.addEventListener('click', () => {
    // Stop any running simulation loops
    if (GS.animationFrameId !== null) {
        cancelAnimationFrame(GS.animationFrameId);
        GS.animationFrameId = null;
    }
    if (GS.backgroundTickId) {
        clearInterval(GS.backgroundTickId);
        GS.backgroundTickId = null;
    }
    stopWarAmbiance();

    // Hide the auto-continue PLAY AGAIN button — it must never leak past WAR_OVER
    // onto the menu/conflict-setup screen (commenter bug 2026-06-22: button stuck
    // on the conflict-setup screen after MENU → era → setup).
    const _pab = document.getElementById('play-again-btn');
    if (_pab) _pab.style.display = 'none';

    // Reset high‑level state to menu
    GS.gameState = 'MAIN_MENU';
    GS.gameMode = 'CONQUEST';
    GS.isPaused = false;

    // Hide in‑game UI and show main menu
    DOM.mapUi.style.display = 'none';
    DOM.settingsOverlay.style.display = 'none';
    DOM.loadingOverlay.style.display = 'none';
    DOM.scenarioHubModal.style.display = 'none';
    DOM.tutorialOverlay.style.display = 'none';
    DOM.creditsModal.style.display = 'none';
    if (DOM.leaderboardOverlay) DOM.leaderboardOverlay.style.display = 'none';
    DOM.mainMenu.style.display = 'flex';

    // Ensure background music resumes when returning to the main menu
    initAudio();

    // Make sure restart/menu visibility is updated for when you re‑enter a scenario
    updateRestartVisibility();
});

// ===== WAR GOALS: pre-war territorial claim marking =====
// The set of defender (pole B) country ids whose land can be claimed this session.
function wgDefenderIdSet() {
    const ids = new Set();
    (GS.sides || []).forEach((side, idx) => {
        if (idx % 2 === 1) side.forEach(c => ids.add(c.id));
    });
    return ids;
}
function wgAttackerRgba() {
    const a = (GS.sides && GS.sides[0] && GS.sides[0][0]) ? GS.sides[0][0] : null;
    if (a && GS.countryMetadata) {
        const m = GS.countryMetadata.find(mm => mm && mm.id === a.id);
        if (m && m.rgba) return m.rgba;
    }
    return [46, 134, 222, 1];
}
function updateWarGoalCount() {
    const el = document.getElementById('war-goal-count');
    if (el) el.innerText = (((GS.warGoalCells && GS.warGoalCells.size) || 0)) + ' tiles marked';
}
function enterWarGoalMarking() {
    GS.warGoalCells = new Set();
    GS.warGoalMode = true;
    GS.warGoalDefenderIds = wgDefenderIdSet();
    GS.warGoalAttackerRgba = wgAttackerRgba();
    const bar = document.getElementById('war-goal-bar');
    if (bar) bar.style.display = 'block';
    // Hide the setup panel so the whole map is visible and paintable while claiming.
    const sp = document.getElementById('setup-panel');
    if (sp) { GS._warGoalPanelDisplay = sp.style.display; sp.style.display = 'none'; }
    // Disable single-finger pan so a drag paints the claim instead of moving the map.
    // Pinch-zoom (two fingers) is untouched.
    try { if (map.dragging) map.dragging.disable(); } catch (e) {}
    updateWarGoalCount();
    if (GS.influenceLayer) GS.influenceLayer.render();
}
function exitWarGoalMarking() {
    GS.warGoalMode = false;
    const bar = document.getElementById('war-goal-bar');
    if (bar) bar.style.display = 'none';
    const sp = document.getElementById('setup-panel');
    if (sp) sp.style.display = GS._warGoalPanelDisplay || '';
    try { if (map.dragging) map.dragging.enable(); } catch (e) {}
    if (GS.influenceLayer) GS.influenceLayer.render();
}
// A tap claims a generous, mobile-friendly disc of the tapped enemy land.
function handleWarGoalClick(latlng) {
    if (!GS.warGoalCells) GS.warGoalCells = new Set();
    const res = CONFIG.GRID_RES;
    const radius = 2.2; // degrees — big touch target, so no precise gestures needed
    const gLatStart = Math.max(0, Math.floor((latlng.lat - radius + 90) / res));
    const gLatEnd = Math.min(GS.gridHeight - 1, Math.ceil((latlng.lat + radius + 90) / res));
    const gLngStart = Math.max(0, Math.floor((latlng.lng - radius + 180) / res));
    const gLngEnd = Math.min(GS.gridWidth - 1, Math.ceil((latlng.lng + radius + 180) / res));
    for (let y = gLatStart; y <= gLatEnd; y++) {
        for (let x = gLngStart; x <= gLngEnd; x++) {
            const cellLat = (y + 0.5) * res - 90;
            const cellLng = (x + 0.5) * res - 180;
            const dLat = latlng.lat - cellLat;
            const dLng = latlng.lng - cellLng;
            if (dLat * dLat + dLng * dLng > radius * radius) continue;
            const idx = y * GS.gridWidth + x;
            const owner = GS.worldControlMap[idx];
            if (owner > 0 && GS.warGoalDefenderIds && GS.warGoalDefenderIds.has(owner)) {
                GS.warGoalCells.add(idx);
            }
        }
    }
    updateWarGoalCount();
    if (GS.influenceLayer) GS.influenceLayer.render();
}

DOM.startBtn.addEventListener('click', () => {
    GS.activeRebellion = null;
    // If War Goals is enabled, first enter the claim-marking phase instead of starting.
    const wg = document.getElementById('war-goals-checkbox');
    if (wg && wg.checked && !GS.warGoalMode) {
        const haveA = GS.sides && GS.sides[0] && GS.sides[0].length > 0;
        const haveB = GS.sides && GS.sides[1] && GS.sides[1].length > 0;
        if (haveA && haveB) {
            enterWarGoalMarking();
            return;
        }
    }
    startWar();
});

document.getElementById('war-goal-confirm')?.addEventListener('click', () => {
    // Keep the marked cells; they flow into startWar() which locks them in.
    GS.warGoalMode = false;
    const bar = document.getElementById('war-goal-bar');
    if (bar) bar.style.display = 'none';
    try { if (map.dragging) map.dragging.enable(); } catch (e) {}
    startWar();
});

// Drag-to-paint the claim: while in war-goal mode, a single-pointer drag across
// the map marks land continuously (not just discrete taps). Two pointers = pinch
// zoom, so we back off and let Leaflet handle it.
(function initWarGoalPaint() {
    const container = (map && map.getContainer) ? map.getContainer() : null;
    if (!container) return;
    const active = new Set();
    let painting = false;
    function paintAt(ev) {
        if (!GS.warGoalMode) return;
        try {
            const ll = map.mouseEventToLatLng(ev);
            if (ll) handleWarGoalClick(ll);
        } catch (e) {}
    }
    container.addEventListener('pointerdown', (ev) => {
        if (!GS.warGoalMode) return;
        active.add(ev.pointerId);
        if (active.size > 1) { painting = false; return; } // pinch → let map zoom
        painting = true;
        paintAt(ev);
    });
    container.addEventListener('pointermove', (ev) => {
        if (!GS.warGoalMode || !painting || active.size !== 1) return;
        paintAt(ev);
    });
    function endPointer(ev) {
        active.delete(ev.pointerId);
        if (active.size === 0) painting = false;
    }
    container.addEventListener('pointerup', endPointer);
    container.addEventListener('pointercancel', endPointer);
})();
document.getElementById('war-goal-clear')?.addEventListener('click', () => {
    GS.warGoalCells = new Set();
    updateWarGoalCount();
    if (GS.influenceLayer) GS.influenceLayer.render();
});
document.getElementById('war-goal-cancel')?.addEventListener('click', () => {
    GS.warGoalCells = new Set();
    exitWarGoalMarking();
});

if (DOM.rebellionBtn) {
    // Rebellions are disabled; keep this button inert.
    DOM.rebellionBtn.addEventListener('click', () => {
        alert("Rebellions have been disabled in this build.");
    });
}

DOM.editorUpdateBtn.addEventListener('click', async () => {
    if (!GS.activeScenarioId) return;
    if (!confirm("Update existing scenario? This will overwrite the map file and thumbnail on the Hub.")) return;

    setLoadingThematic(false);
    loadingStatus.innerText = "Updating Scenario...";
    DOM.loadingOverlay.style.display = 'flex';

    try {
        // 1. Generate updated preview
        let previewUrl = null;
        if (GS.influenceLayer && GS.influenceLayer._container) {
            GS.influenceLayer._isCapturing = true;
            GS.influenceLayer.render();
            const canvas = GS.influenceLayer._container;
            const previewBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
            GS.influenceLayer._isCapturing = false;
            GS.influenceLayer.render();
            if (previewBlob) {
                const previewFile = new File([previewBlob], "update_preview.jpg", { type: "image/jpeg" });
                previewUrl = await websim.upload(previewFile);
            }
        }

        // 2. Generate updated preset data
        const currentName = DOM.statusText.innerText.replace("REMIXING: ", "").replace("Map Editor (Alpha)", "Updated Scenario");
        const saveData = generatePresetData(currentName);
        const blob = new Blob([JSON.stringify(saveData)], { type: 'application/json' });
        const file = new File([blob], "updated_scenario.json", { type: "application/json" });
        const blobUrl = await websim.upload(file);

        // 3. Update existing record
        await GS.room.collection('scenario_v1').update(GS.activeScenarioId, {
            previewUrl: previewUrl,
            blobUrl: blobUrl
        });

        DOM.loadingOverlay.style.display = 'none';
        alert("Scenario updated successfully!");
    } catch (e) {
        console.error(e);
        alert("Update failed. You can only update scenarios you created.");
        DOM.loadingOverlay.style.display = 'none';
    }
});

DOM.godModeBtn.addEventListener('click', () => {
    if (!GS.godModeActive) {
        // Activate God Mode
        GS.godModeActive = true;
        GS.godBombActive = false;
        if (DOM.godBombBtn) {
            DOM.godBombBtn.innerText = "GOD BOMB: OFF";
            DOM.godBombBtn.classList.remove('active');
        }
        GS.preGodModeState = GS.gameState;
        GS.gameState = 'EDITOR_ACTIVE';
        
        DOM.godModeBtn.innerText = getTranslation('GOD_ACTIVE');
        DOM.godModeBtn.style.background = "#27ae60";
        
        // Setup UI
        DOM.editorToolbox.style.display = 'flex';
        DOM.setupPanel.style.display = 'none';
        DOM.statsPanel.style.display = 'none';
        // Allow sharing and saving any current map state from God Mode, including official presets
        DOM.editorShareBtn.style.display = 'block';
        DOM.editorSaveBtn.style.display = 'block';
        DOM.editorHubBtn.style.display = 'block';
        DOM.editorLibraryBtn.style.display = 'block';
        DOM.shareFlagBtn.style.display = 'block';
        DOM.editorExitBtn.style.display = 'none';
        DOM.editorTestBtn.style.display = 'none';
        DOM.editorUpdateBtn.style.display = GS.activeScenarioId ? 'block' : 'none';
        DOM.editorUnclaimBtn.style.display = 'block';
        
        if (GS.preGodModeState === 'SIMULATING') {
            DOM.godBombBtn.style.display = 'block';
        }

        // Ensure alliance view toggle always remains visible while in God Mode
        if (DOM.allianceViewCheckbox && DOM.allianceViewCheckbox.parentElement) {
            DOM.allianceViewCheckbox.style.display = 'inline-block';
            DOM.allianceViewCheckbox.parentElement.style.display = 'inline-flex';
        }

        DOM.statusText.innerText = GS.currentScenarioContext ? `GOD MODE // REMIXING: ${GS.currentScenarioContext.name}` : "GOD MODE: Map Editing Active";
        updateRestartVisibility();
    } else {
        // Deactivate God Mode
        GS.godModeActive = false;
        GS.godBombActive = false;
        GS.godBombSourceId = -1;

        // Sanitize editor interaction state: an active paint/edit tool leaves several
        // flags set (the selected nation, an in-progress paint stroke, the paint mask,
        // multi-select, sub-tool selections). If these leak back into conflict setup
        // they can make map clicks behave oddly — e.g. a stuck paint stroke leaving the
        // map un-pannable, or a lingering selection swallowing the next setup click.
        // Always clear them when leaving God Mode so setup starts from a clean slate.
        GS.editingCountryId = -1;
        GS.isPainting = false;
        GS.lastPaintLatLng = null;
        GS.paintMaskId = -1;
        GS.cityEditMode = null;
        GS.selectingOverlordForId = -1;
        GS.selectingAllyForId = -1;
        if (GS.selectedCountryIds && GS.selectedCountryIds.clear) GS.selectedCountryIds.clear();
        if (map.dragging && !map.dragging.enabled()) map.dragging.enable();

        // Sanitize state: ensure that exiting from an active editor tool (like painting)
        // doesn't leave the engine in an "EDITOR" state if we were previously in selection mode.
        if (GS.gameMode === 'CONQUEST' && GS.preGodModeState !== 'SIMULATING') {
            GS.gameState = 'SELECTING_P1';
        } else {
            GS.gameState = GS.preGodModeState;
        }
        
        DOM.godModeBtn.innerText = getTranslation('GOD_MODE');
        DOM.godModeBtn.style.background = "#d35400";
        
        // Hide editor UI & Reset Tool Classes to prevent sticky sub-states
        DOM.editorToolbox.style.display = 'none';
        [DOM.editorPaintBtn, DOM.editorFillBtn, DOM.editorUnclaimBtn, DOM.editorTerrainBtn, DOM.editorPlaceDivisionBtn].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        if (DOM.brushControls) DOM.brushControls.style.display = 'none';
        if (DOM.terrainControls) DOM.terrainControls.style.display = 'none';
        
        DOM.godBombBtn.style.display = 'none';
        DOM.godBombBtn.innerText = "GOD BOMB: OFF";
        DOM.godBombBtn.classList.remove('active');
        DOM.countryInspector.style.display = 'none';
        DOM.shareFlagBtn.style.display = 'none';
        map.getContainer().classList.remove('painting-cursor');
        
        // Make sure the alliance view checkbox + label are visible again when returning to normal play
        if (DOM.allianceViewCheckbox && DOM.allianceViewCheckbox.parentElement) {
            DOM.allianceViewCheckbox.style.display = 'inline-block';
            DOM.allianceViewCheckbox.parentElement.style.display = 'inline-flex';
        }

        // Refresh simulation caches in case land changed
        if (GS.gameState === 'SIMULATING') {
            DOM.statsPanel.style.display = 'block';
            GS.activeTheaterCities = GS.cities.filter(c => {
                const idx = getGridIndex(c.lat, c.lng);
                return idx !== -1 && GS.landMask[idx] === 2;
            });
            // Ensure loop restarts if it was stopped
            cancelAnimationFrame(GS.animationFrameId);
            requestAnimationFrame(updateLoop);
        }
        
        if (GS.gameState.startsWith('SELECTING') || GS.gameState === 'WAR_OVER') {
            if (GS.gameState === 'WAR_OVER') {
                GS.gameState = 'SELECTING_P1';
                DOM.treatyAlert.style.display = 'none';
                const _pab = document.getElementById('play-again-btn');
                if (_pab) _pab.style.display = 'none';
            }
            DOM.setupPanel.style.display = 'block';
            DOM.statusText.innerText = GS.currentScenarioContext ? `PLAYING: ${GS.currentScenarioContext.name}` : getTranslation('SELECT_P1');
            updateSidesUI();
        } else if (GS.gameState === 'SIMULATING') {
            DOM.statsPanel.style.display = 'block';
            DOM.statusText.innerText = GS.ffaMode ? "Free For All Active" : "Global Conflict Active";
        } else {
            // Safety fallback: transition any orphaned state to setup mode
            GS.gameState = 'SELECTING_P1';
            DOM.setupPanel.style.display = 'block';
            DOM.statusText.innerText = getTranslation('SELECT_P1');
            updateSidesUI();
        }
        updateRestartVisibility();
    }
});

DOM.godBombBtn.addEventListener('click', () => {
    GS.godBombActive = !GS.godBombActive;
    DOM.godBombBtn.innerText = GS.godBombActive ? "GOD BOMB: ON" : "GOD BOMB: OFF";
    DOM.godBombBtn.classList.toggle('active', GS.godBombActive);
    
    if (GS.godBombActive) {
        GS.godBombSourceId = -1;
        DOM.statusText.innerText = "GOD BOMB ACTIVE: Click a country to set as sender";
        map.getContainer().classList.add('painting-cursor');
        DOM.countryInspector.style.display = 'none';
    } else {
        GS.godBombSourceId = -1;
        DOM.statusText.innerText = GS.godModeActive ? "GOD MODE: Map Editing Active" : "Simulation Continued";
        map.getContainer().classList.remove('painting-cursor');
    }
});

DOM.forcePeaceBtn.addEventListener('click', () => {
    if (GS.gameState === 'SIMULATING') {
        GS.gameState = 'PEACE_SELECT_1';
        DOM.statusText.innerText = "DIPLOMACY: Click nation to withdraw from war";
        GS.peaceSelection1 = null;
    } else if (GS.gameState === 'PEACE_SELECT_1' || GS.gameState === 'PEACE_SELECT_2') {
        // Double click/cancel to just do a global peace
        if (confirm("Sign global white peace for all remaining combatants?")) {
            applyTreaty('PEACE_TREATY');
        } else {
            GS.gameState = 'SIMULATING';
            DOM.statusText.innerText = "Conflict Continued";
            requestAnimationFrame(updateLoop);
        }
    }
});



export const SPEED_STEPS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 5];
GS.currentSpeedIndex = 0; // Index for "0.1x"

function togglePause() {
    GS.isPaused = !GS.isPaused;
    DOM.pauseBtn.innerText = GS.isPaused ? '▶' : '⏸';
    DOM.pauseBtn.style.background = GS.isPaused ? '#27ae60' : '#f39c12';
    DOM.statusText.innerText = GS.isPaused ? getTranslation('SIM_PAUSED') : (GS.ffaMode ? getTranslation('STABLE') : getTranslation('STABLE'));
}

DOM.pauseBtn.addEventListener('click', togglePause);


// Keybinds
document.addEventListener('keydown', (e) => {
    // Don't trigger if user is typing in an input or textarea
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.code === 'Space') {
        if (GS.gameState === 'SIMULATING') {
            e.preventDefault();
            togglePause();
        }
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
        if ((GS.gameMode === 'EDITOR' || GS.godModeActive) && GS.editingCountryId > 0) {
            e.preventDefault();
            unclaimSelectedCountry();
        }
    }

    // Z key: instantly zoom out to a global view of the entire world
    if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        // Fit the whole world into view with a small padding for aesthetics
        map.fitWorld({ animate: true, padding: [20, 20] });
    }

    if (e.key === 'Escape') {
        if (GS.gameState === 'PEACE_SELECT_1' || GS.gameState === 'PEACE_SELECT_2') {
            e.preventDefault();
            GS.gameState = 'SIMULATING';
            DOM.statusText.innerText = "Conflict Continued";
            requestAnimationFrame(updateLoop);
        } else if (DOM.countryInspector.style.display === 'block') {
            DOM.closeInspectorBtn.click();
        }
    }
});


export function setSpeed(index) {
    GS.currentSpeedIndex = Math.max(0, Math.min(index, SPEED_STEPS.length - 1));
    GS.simSpeed = SPEED_STEPS[GS.currentSpeedIndex];
    DOM.ffBtn.innerText = GS.simSpeed + "x";
    if (GS.simSpeed === 1) {
        DOM.ffBtn.classList.remove('active');
    } else {
        DOM.ffBtn.classList.add('active');
    }
    GS.frameAccumulator = 0;
}

DOM.ffBtn.addEventListener('click', () => {
    let nextIndex = (GS.currentSpeedIndex + 1) % SPEED_STEPS.length;
    setSpeed(nextIndex);
});

DOM.speedDownBtn.addEventListener('click', () => {
    setSpeed(GS.currentSpeedIndex - 1);
});

DOM.speedUpBtn.addEventListener('click', () => {
    setSpeed(GS.currentSpeedIndex + 1);
});

if (DOM.customTrackInput) {
    DOM.customTrackInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        loadingStatus.innerText = "Uploading Soundtrack...";
        DOM.loadingOverlay.style.display = 'flex';
        
        try {
            const url = await websim.upload(file);
            setCustomTrack(url);
            DOM.loadingOverlay.style.display = 'none';
            alert("Custom soundtrack applied and saved!");
        } catch (err) {
            console.error(err);
            alert("Failed to upload soundtrack.");
            DOM.loadingOverlay.style.display = 'none';
        }
    });
}

if (DOM.clearCustomTrackBtn) {
    DOM.clearCustomTrackBtn.addEventListener('click', () => {
        if (DOM.customTrackInput) DOM.customTrackInput.value = '';
        clearCustomTrack();
        alert("Soundtrack reset to original.");
    });
}

export async function initMultiplayer() {
    if (GS.room) return;
    // WebsimSocket is injected by the platform at serve time. If it is absent
    // (e.g. the raw serving URL outside the websim iframe), degrade gracefully:
    // the single-player core works without multiplayer/hub features.
    if (typeof WebsimSocket === 'undefined') {
        console.warn('WebsimSocket unavailable; multiplayer/hub features disabled.');
        return;
    }
    GS.room = new WebsimSocket();
    await GS.room.initialize();

    try {
        const currentUser = await window.websim.getCurrentUser();
        GS.currentUsername = currentUser?.username || null;
    } catch (e) {
        console.warn('Failed to get current user for comments', e);
        GS.currentUsername = null;
    }
    
    // Subscribe to persistent scenario records
    GS.room.collection('scenario_v1').subscribe((scenarios) => {
        if (DOM.scenarioHubModal.style.display === 'flex') {
            renderHub(scenarios);
        }
    });

    // Subscribe to persistent country records
    GS.room.collection('country_library_v1').subscribe((countries) => {
        if (DOM.scenarioHubModal.style.display === 'flex') {
            renderCountryLibrary(countries);
        }
    });

    // Subscribe to persistent flag records
    GS.room.collection('flag_library_v1').subscribe((flags) => {
        if (DOM.scenarioHubModal.style.display === 'flex') {
            renderFlagLibrary(flags);
        }
    });

    // Subscribe to comments so hub cards show live comment counts
    GS.room.collection('hub_comment_v1').subscribe(() => {
        // Only bother re-rendering when the hub is visible
        if (DOM.scenarioHubModal.style.display === 'flex') {
            const scenarios = GS.room.collection('scenario_v1').getList();
            renderHub(scenarios || []);
        }
    });
}




DOM.tabScenariosBtn.onclick = () => switchHubTab('scenarios');
DOM.tabCountriesBtn.onclick = () => switchHubTab('countries');
DOM.tabFlagsBtn.onclick = () => switchHubTab('flags');


window.deleteScenario = async (id) => {
    if (!confirm("Are you sure you want to delete this scenario?")) return;
    try {
        await GS.room.collection('scenario_v1').delete(id);
    } catch (e) {
        console.error(e);
        alert("Failed to delete scenario. You can only delete your own posts.");
    }
};



window.deleteFlag = async (id) => {
    if (!confirm("Remove this flag from the library?")) return;
    try {
        await GS.room.collection('flag_library_v1').delete(id);
    } catch (e) {
        console.error(e);
        alert("Delete failed.");
    }
};

/**
 * GLOBAL EXPORTS FOR HUB INTERACTION
 */
window.importFlagFromLibrary = async (id) => {
    // Robust lookup to ensure we have the data
    let list = GS.room.collection('flag_library_v1').getList();
    let flagData = list.find(f => f.id === id);
    
    if (!flagData || GS.editingCountryId <= 0) {
        if (GS.editingCountryId <= 0) {
            alert("SATELLITE INTERFACE: You must select a nation on the map first to designate a target for the new national identity.");
        } else {
            alert("SATELLITE ERROR: Could not retrieve flag data from the hub archives.");
        }
        return;
    }

    const meta = GS.countryMetadata.find(m => m && m.id === GS.editingCountryId);
    if (meta) {
        updateCountryFlag(GS.editingCountryId, flagData.flagUrl);
        closeHub();
        // Visual confirmation
        DOM.statusText.innerText = `IDENTIFIED: ${meta.name} now using community flag '${flagData.name}'`;
    }
};



window.deleteCountry = async (id) => {
    if (!confirm("Are you sure you want to delete this country from the library?")) return;
    try {
        await GS.room.collection('country_library_v1').delete(id);
    } catch (e) {
        console.error(e);
        alert("Failed to delete.");
    }
};

window.importFromLibrary = async (id) => {
    const list = GS.room.collection('country_library_v1').getList();
    const countryData = list.find(c => c.id === id);
    if (!countryData) return;

    loadingStatus.innerText = `Importing ${countryData.name}...`;
    DOM.loadingOverlay.style.display = 'flex';
    closeHub();

    // Allow UI to update
    await new Promise(r => setTimeout(r, 100));

    try {
        const newId = GS.countryMetadata.length + 1;
        const newMeta = {
            id: newId,
            name: countryData.name,
            color: countryData.color,
            rgba: parseColorToRGBA(countryData.color),
            isCustom: true,
            flagUrl: countryData.flagUrl
        };
        GS.countryMetadata.push(newMeta);

        // Fetch cells from URL if they aren't in the record (new format to avoid 250KB limit)
        let cells = countryData.cells;
        if (!cells && countryData.cellsUrl) {
            try {
                const resp = await fetch(countryData.cellsUrl);
                cells = await resp.json();
            } catch (e) {
                console.error("Failed to fetch country cells", e);
                alert("Error importing country geography.");
                DOM.loadingOverlay.style.display = 'none';
                return;
            }
        }

        if (!cells) {
            alert("This country has no geography data.");
            DOM.loadingOverlay.style.display = 'none';
            return;
        }

        // Map relative cells to current grid
        const sourceRes = countryData.gridRes || CONFIG.GRID_RES;
        const targetRes = CONFIG.GRID_RES;
        
        cells.forEach(([cx, cy]) => {
            // Robust conversion: Fill all target cells that overlap with the source cell
            const baseLat = (cy * sourceRes) - 90;
            const baseLng = (cx * sourceRes) - 180;
            
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
                    GS.worldControlMap[tIdx] = newId;
                    if (GS.landMask[tIdx] === 0) GS.landMask[tIdx] = 1;
                }
            }
        });

        recalculateAllBounds();
        DOM.loadingOverlay.style.display = 'none';
        GS.influenceLayer.render();
        alert(`${countryData.name} imported successfully!`);
    } catch (e) {
        console.error(e);
        alert("Import failed.");
        DOM.loadingOverlay.style.display = 'none';
    }
};

window.playFromHub = async (url, id, name, ownerUsername) => {
    initAudio();
    setLoadingThematic(true);
    loadingStatus.innerText = "Downloading Scenario...";
    DOM.loadingOverlay.style.display = 'flex';
    DOM.scenarioHubModal.style.display = 'none';
    
    const currentUser = await window.websim.getCurrentUser();
    const myUsername = currentUser.username;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch");
        const blob = await response.blob();
        
        GS.currentScenarioContext = { id, name, ownerUsername, blobUrl: url };
        GS.activeScenarioId = (ownerUsername === myUsername) ? id : null;
        
        await performPresetLoad(blob, 'CONQUEST');
        
        if (GS.activeScenarioId) {
            DOM.editorUpdateBtn.style.display = 'block';
        } else {
            DOM.editorUpdateBtn.style.display = 'none';
        }
    } catch (e) {
        console.error(e);
        alert("Failed to download scenario.");
        DOM.loadingOverlay.style.display = 'none';
    }
};

window.remixFromHub = async (url, sourceId, sourceName, ownerUsername) => {
    initAudio();
    setLoadingThematic(true);
    loadingStatus.innerText = "Downloading for Remix...";
    DOM.loadingOverlay.style.display = 'flex';
    DOM.scenarioHubModal.style.display = 'none';
    
    const currentUser = await window.websim.getCurrentUser();
    const myUsername = currentUser.username;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch");
        const blob = await response.blob();
        await performPresetLoad(blob, 'EDITOR');
        
        GS.currentScenarioContext = { id: sourceId, name: sourceName, ownerUsername, blobUrl: url };
        DOM.statusText.innerText = `REMIXING: ${sourceName}`;
        
        // If we remix our OWN work, allow updating it
        GS.activeScenarioId = (ownerUsername === myUsername) ? sourceId : null;
        if (GS.activeScenarioId) {
            DOM.editorUpdateBtn.style.display = 'block';
        } else {
            DOM.editorUpdateBtn.style.display = 'none';
        }
    } catch (e) {
        console.error(e);
        alert("Failed to download scenario for remix.");
        DOM.loadingOverlay.style.display = 'none';
    }
};

/**
 * PRELOAD CORE VISUAL ASSETS
 * Caches large menu backgrounds and thematic overlays to prevent flickering during transitions.
 */

// Initial preload trigger — DEFERRED until first interaction off the boot critical path.
// EXP(defer-preload): the boot-to-map funnel (v1161) skips the menu on a fresh visit, so
// the ~11MB of menu/era background images preloadAssets() fetches are never shown up front,
// yet were downloading at boot and competing for network bandwidth with the map data during
// the ~1.3s–8s time-to-interactive window (where the mobile median bounces). Defer the warm
// until the first user pointer/key (or a fallback timeout): a visitor who bounces without
// tapping never pays the 11MB at all, and an engaged player only triggers it AFTER their
// first country tap — by which point the map is already up, so no contention with the
// critical load. Revert to a bare preloadAssets() if it loses.
(function deferPreloadAssets() {
    let done = false;
    const run = () => {
        if (done) return;
        done = true;
        try { window.removeEventListener('pointerdown', run, true); } catch (e) {}
        try { window.removeEventListener('keydown', run, true); } catch (e) {}
        try { preloadAssets(); } catch (e) {}
    };
    try {
        window.addEventListener('pointerdown', run, { capture: true, once: true });
        window.addEventListener('keydown', run, { capture: true, once: true });
    } catch (e) { /* fall through to timeout */ }
    setTimeout(run, 10000); // fallback: warm even if the visitor never interacts
})();

// Device-aware grid-density default. High (Smooth) grid is ~2.25x heavier per tick than
// Standard, and most visitors are on phones — so mobile/low-end devices default to Standard
// to stay smooth, while capable desktops keep High (Smooth). Only the *default* changes
// (and only downward); a saved cookie / explicit pick always wins. See checkAutoLaunch.
function deviceDefaultGridRes() {
    try {
        const coarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
        const touch = (navigator.maxTouchPoints || 0) > 0 || ('ontouchstart' in window);
        const smallScreen = Math.min(window.innerWidth || 9999, window.innerHeight || 9999) < 820;
        const fewCores = (navigator.hardwareConcurrency || 8) <= 4;
        const lowMem = (navigator.deviceMemory || 8) <= 4;
        const isMobileLike = coarsePointer && touch && smallScreen;
        if (isMobileLike || fewCores || lowMem) return '0.25'; // Light — grid-lite (shipped winner, +11%): fewer cells on cheap phones vs 0.1 desktop default.
    } catch (e) { /* fall through to High */ }
    return '0.1'; // High (Smooth)
}

// Initialization logic
export function initializeEngine() {
    const gridRes = parseFloat(document.getElementById('grid-res-select').value);
    const unitLimit = parseInt(document.getElementById('unit-limit-select').value);
    
    // Sync global toggles from both main settings and setup panel sources
    const mtDisabled = document.getElementById('disable-mountains-checkbox').checked || document.getElementById('setup-disable-mountains-checkbox').checked;
    GS.mountainsEnabled = !mtDisabled;

    const provDisabled = document.getElementById('disable-provinces-checkbox').checked || document.getElementById('setup-disable-provinces-checkbox').checked;
    GS.provincesEnabled = !provDisabled;

    GS.showUnitsVisually = !document.getElementById('disable-units-visually-checkbox').checked;
    GS.disableCountryGradient = !!document.getElementById('disable-country-gradient-checkbox')?.checked;

    // Check if configuration changed enough to require re-allocation
    if (CONFIG.GRID_RES !== gridRes || !GS.worldControlMap) {
        CONFIG.GRID_RES = gridRes;
        CONFIG.MAX_UNITS_PER_SIDE = unitLimit;
        
        // Allocate Grid
        GS.gridWidth = Math.ceil(360 / CONFIG.GRID_RES);
        GS.gridHeight = Math.ceil(180 / CONFIG.GRID_RES);
        GS.worldControlMap = new Int32Array(GS.gridWidth * GS.gridHeight);
        GS.deJureMap = new Int32Array(GS.gridWidth * GS.gridHeight);
        GS.provinceMap = new Int32Array(GS.gridWidth * GS.gridHeight);
        GS.occupationMap = new Float32Array(GS.gridWidth * GS.gridHeight);
        GS.primaryOccupierMap = new Int32Array(GS.gridWidth * GS.gridHeight);
        GS.landMask = new Uint8Array(GS.gridWidth * GS.gridHeight);
        GS.biomeMask = new Uint8Array(GS.gridWidth * GS.gridHeight);
        GS.terrainMask = new Float32Array(GS.gridWidth * GS.gridHeight);
        GS.flagProcessedBuffer = new Int32Array(GS.gridWidth * GS.gridHeight);
        
        // If we are already in a mode that has geography loaded, we should refresh it
        if (GS.rawGeoJsonData) {
            const isBlank = GS.gameMode === 'EDITOR';
            updateLandMask(GS.rawGeoJsonData.features, 1, isBlank);
        }
    } else {
        CONFIG.MAX_UNITS_PER_SIDE = unitLimit;
    }
}

DOM.musicVolumeSlider.addEventListener('input', (e) => {
    const vol = parseFloat(e.target.value);
    DOM.musicVolVal.innerText = Math.round(vol * 100) + '%';
    setMusicVolume(vol);
});

DOM.muteBtn.addEventListener('click', () => {
    const nowMuted = toggleMute(GS.gameState === 'SIMULATING');
    DOM.muteBtn.innerText = nowMuted ? '🔇' : '🔊';
});

DOM.presetLowBtn.addEventListener('click', () => {
    DOM.mapResSelect.value = '110m';
    DOM.gridResSelect.value = '0.15';
    DOM.unitLimitSelect.value = '100';
    
    // Switch to Simplified mode without gradients for low performance
    setImageryProvider('wargames');
    if (DOM.disableCountryGradientCheckbox) {
        DOM.disableCountryGradientCheckbox.checked = true;
        GS.disableCountryGradient = true;
    }
    
    document.getElementById('disable-mountains-checkbox').checked = true;
    DOM.setupDisableMountainsCheckbox.checked = true;
    GS.mountainsEnabled = false;
    
    // Visual feedback
    DOM.presetLowBtn.style.boxShadow = "0 0 15px rgba(192, 57, 43, 0.5)";
    DOM.presetDefaultBtn.style.boxShadow = "none";
});

DOM.presetDefaultBtn.addEventListener('click', () => {
    DOM.mapResSelect.value = '110m';
    DOM.gridResSelect.value = '0.1';
    DOM.unitLimitSelect.value = '250';
    
    // Reset to ArcGIS satellite with gradients for default
    setImageryProvider('arcgis');
    if (DOM.disableCountryGradientCheckbox) {
        DOM.disableCountryGradientCheckbox.checked = false;
        GS.disableCountryGradient = false;
    }
    
    document.getElementById('disable-mountains-checkbox').checked = false;
    DOM.setupDisableMountainsCheckbox.checked = false;
    GS.mountainsEnabled = true;
    
    // Visual feedback
    DOM.presetDefaultBtn.style.boxShadow = "0 0 15px rgba(46, 134, 222, 0.5)";
    DOM.presetLowBtn.style.boxShadow = "none";
});

DOM.launchBtn.addEventListener('click', () => {
    initAudio();
    initMultiplayer();
    initializeEngine();

    if (DOM.saveSkipCheckbox.checked) {
        setCookie('mw_skip_settings', 'true');
        setCookie('mw_map_res', DOM.mapResSelect.value);
        setCookie('mw_grid_res', DOM.gridResSelect.value);
        setCookie('mw_unit_limit', DOM.unitLimitSelect.value);
        setCookie('mw_disable_mountains', document.getElementById('disable-mountains-checkbox').checked ? 'true' : 'false');
        setCookie('mw_disable_provinces', document.getElementById('disable-provinces-checkbox').checked ? 'true' : 'false');
        setCookie('mw_disable_units_visually', document.getElementById('disable-units-visually-checkbox').checked ? 'true' : 'false');
        setCookie('mw_disable_country_gradient', DOM.disableCountryGradientCheckbox.checked ? 'true' : 'false');
        if (DOM.disableInvisibleBuffsCheckbox) {
            setCookie('mw_disable_invis_buffs', DOM.disableInvisibleBuffsCheckbox.checked ? 'true' : 'false');
        }
        if (DOM.disableAutoFullscreenCheckbox) {
            setCookie('mw_disable_fullscreen', DOM.disableAutoFullscreenCheckbox.checked ? 'true' : 'false');
        }
    } else {
        setCookie('mw_skip_settings', 'false');
    }

    DOM.settingsOverlay.style.display = 'none';
    if (GS.gameState === 'MAIN_MENU') {
        DOM.mainMenu.style.display = 'flex';
    } else {
        DOM.mapUi.style.display = 'flex';
        DOM.mapUi.style.display = 'flex';
        if (GS.currentScenarioContext && GS.gameMode === 'EDITOR') {
            DOM.statusText.innerText = `REMIXING: ${GS.currentScenarioContext.name}`;
        } else if (GS.currentScenarioContext && GS.gameMode === 'CONQUEST') {
            DOM.statusText.innerText = `PLAYING: ${GS.currentScenarioContext.name}`;
        }
    }
    DOM.launchBtn.innerText = "Apply Changes"; // Change for subsequent opens
});

// --- Autosave / Resume (retention lever) ---
// Periodically persist the in-progress conquest to localStorage so a returning
// player can jump straight back into their war with one tap instead of losing
// it. Reuses the proven preset serialization (generatePresetData) + load path
// (performPresetLoad) — the exact machinery built-in scenarios + LOAD FILE use.
const AUTOSAVE_KEY = 'mw_autosave_v1';   // full preset, gzip+base64 (prefix 'g:') or raw JSON (prefix 'r:')
const AUTOSAVE_META_KEY = 'mw_autosave_meta'; // tiny {v,savedAt,scenarioName} — cheap sync existence check
// A full-world grid serializes to ~4.7M chars of JSON (every land cell), which
// blows past the ~5MB localStorage quota raw. We gzip it (repetitive integer
// arrays compress ~10x) so real scenarios fit. Guards below are post-compression.
const AUTOSAVE_MAX_CHARS = 4_000_000; // safety cap on the STORED (compressed) string
const AUTOSAVE_INTERVAL_MS = 25000;
let _autosaveTimer = null;

// gzip a string → base64 (async; CompressionStream is in all modern mobile
// browsers — Chrome 80+/Safari 16.4+). Returns null if unsupported.
async function gzipToBase64(str) {
    if (typeof CompressionStream === 'undefined') return null;
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(new TextEncoder().encode(str));
    writer.close();
    const buf = await new Response(cs.readable).arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
}
async function gunzipFromBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const buf = await new Response(ds.readable).arrayBuffer();
    return new TextDecoder().decode(buf);
}

async function writeAutosave() {
    try {
        if (GS.gameMode !== 'CONQUEST') return;
        if (GS.gameState !== 'SIMULATING') return;
        if (GS.menuDemoActive) return;
        const liveNations = (GS.countryMetadata || []).filter(m => m && m.id);
        if (liveNations.length < 2) return;
        const preset = generatePresetData('Autosave');
        const ctx = GS.currentScenarioContext || {};
        const meta = { v: 1, savedAt: Date.now(), scenarioName: ctx.name || 'Your War' };
        const payload = JSON.stringify({ ...meta, preset });
        const gz = await gzipToBase64(payload);
        let stored;
        if (gz !== null) stored = 'g:' + gz;
        else if (payload.length <= AUTOSAVE_MAX_CHARS) stored = 'r:' + payload; // no CompressionStream — store raw if it fits
        else return; // can't compress and too big to store raw — skip, best-effort
        if (stored.length > AUTOSAVE_MAX_CHARS) return; // still too big — skip
        localStorage.setItem(AUTOSAVE_KEY, stored);
        localStorage.setItem(AUTOSAVE_META_KEY, JSON.stringify(meta));
    } catch (e) {
        // storage full / serialization error — autosave is best-effort, never break the game.
        try { localStorage.removeItem(AUTOSAVE_KEY); localStorage.removeItem(AUTOSAVE_META_KEY); } catch (_) {}
    }
}

// Cheap sync check used to decide whether to show RESUME — reads only the tiny meta key.
function readAutosaveMeta() {
    try {
        const raw = localStorage.getItem(AUTOSAVE_META_KEY);
        if (!raw || !localStorage.getItem(AUTOSAVE_KEY)) return null;
        const m = JSON.parse(raw);
        return (m && m.savedAt) ? m : null;
    } catch (e) {
        return null;
    }
}

// Full async load: decompress + parse + validate. Returns the {scenarioName,preset} object or null.
async function readAutosaveFull() {
    try {
        const stored = localStorage.getItem(AUTOSAVE_KEY);
        if (!stored) return null;
        let json;
        if (stored.startsWith('g:')) json = await gunzipFromBase64(stored.slice(2));
        else if (stored.startsWith('r:')) json = stored.slice(2);
        else return null;
        const data = JSON.parse(json);
        if (!data || !data.preset || !data.preset.metadata || !data.preset.mapData) return null;
        return data;
    } catch (e) {
        return null;
    }
}

function refreshResumeButton() {
    const btn = document.getElementById('menu-resume-btn');
    if (!btn) return;
    btn.style.display = readAutosaveMeta() ? 'block' : 'none';
}

async function resumeAutosave() {
    const data = await readAutosaveFull();
    if (!data) { refreshResumeButton(); return; }
    initAudio();
    setLoadingThematic(true);
    loadingStatus.innerText = 'Resuming your war...';
    DOM.loadingOverlay.style.display = 'flex';
    try {
        const blob = new Blob([JSON.stringify(data.preset)], { type: 'application/json' });
        GS.currentScenarioContext = { id: 'autosave', name: data.scenarioName || 'Your War', ownerUsername: 'you', blobUrl: null };
        GS.activeScenarioId = null;
        await performPresetLoad(blob, 'CONQUEST');
        DOM.mainMenu.style.display = 'none';
    } catch (e) {
        console.error('Resume failed', e);
        DOM.loadingOverlay.style.display = 'none';
        alert('Could not resume your saved war.');
    }
}

function startAutosaveLoop() {
    if (_autosaveTimer) return;
    _autosaveTimer = setInterval(writeAutosave, AUTOSAVE_INTERVAL_MS);
}

const _menuResumeBtn = document.getElementById('menu-resume-btn');
if (_menuResumeBtn) _menuResumeBtn.addEventListener('click', resumeAutosave);

// Auto-load settings on boot
function checkAutoLaunch() {
    // Attempt to initialize audio context immediately on load (though it may be blocked until a click)
    initAudio();

    // Always restore saved settings, initialize the engine, and land on the main
    // menu. The settings overlay is opt-in via the settings button — it is never
    // the landing screen, even on a first visit (defaults are used until changed).
    {
        DOM.mapResSelect.value = getCookie('mw_map_res') || '50m';
        DOM.gridResSelect.value = getCookie('mw_grid_res') || deviceDefaultGridRes(); // device-aware: High on desktop, Standard on mobile/low-end
        DOM.unitLimitSelect.value = getCookie('mw_unit_limit') || '500';
        const mtSaved = getCookie('mw_disable_mountains');
        if (mtSaved === 'true') {
            document.getElementById('disable-mountains-checkbox').checked = true;
            DOM.setupDisableMountainsCheckbox.checked = true;
            GS.mountainsEnabled = false;
        } else {
            document.getElementById('disable-mountains-checkbox').checked = false;
            DOM.setupDisableMountainsCheckbox.checked = false;
            GS.mountainsEnabled = true;
        }

        const provSaved = getCookie('mw_disable_provinces');
        if (provSaved === 'false') {
            DOM.mainDisableProvincesCheckbox.checked = false;
            DOM.setupDisableProvincesCheckbox.checked = false;
            GS.provincesEnabled = true;
        } else {
            // Default to disabled (checked) if 'true' or not yet set
            DOM.mainDisableProvincesCheckbox.checked = true;
            DOM.setupDisableProvincesCheckbox.checked = true;
            GS.provincesEnabled = false;
        }

        const unitsVisSaved = getCookie('mw_disable_units_visually');
        if (unitsVisSaved === 'true') {
            document.getElementById('disable-units-visually-checkbox').checked = true;
            GS.showUnitsVisually = false;
        } else {
            document.getElementById('disable-units-visually-checkbox').checked = false;
            GS.showUnitsVisually = true;
        }

        const gradSaved = getCookie('mw_disable_country_gradient');
        if (gradSaved === 'true') {
            DOM.disableCountryGradientCheckbox.checked = true;
            GS.disableCountryGradient = true;
        } else {
            DOM.disableCountryGradientCheckbox.checked = false;
            GS.disableCountryGradient = false;
        }

        const invisSaved = getCookie('mw_disable_invis_buffs');
        if (DOM.disableInvisibleBuffsCheckbox) {
            DOM.disableInvisibleBuffsCheckbox.checked = (invisSaved === 'true');
        }
        GS.invisibleBuffsEnabled = invisSaved === 'true' ? false : true;

        const fullscreenSaved = getCookie('mw_disable_fullscreen');
        if (DOM.disableAutoFullscreenCheckbox) {
            DOM.disableAutoFullscreenCheckbox.checked = (fullscreenSaved === 'true');
        }
        GS.disableFullscreen = (fullscreenSaved === 'true');

        DOM.saveSkipCheckbox.checked = true;

        initMultiplayer();
        initializeEngine();
        
        DOM.settingsOverlay.style.display = 'none';
        DOM.mainMenu.style.display = 'flex';
        GS.gameState = 'MAIN_MENU';
        DOM.launchBtn.innerText = "Apply Changes";
        // Ensure background music is running as soon as the main menu is shown
        initAudio();

        // Retention: surface a one-tap RESUME if a prior war was autosaved, and
        // start the throttled autosave loop that persists in-progress conquests.
        refreshResumeButton();
        startAutosaveLoop();

        // Tutorial is opt-in via the TUTORIAL button (declutters the landing menu so
        // the WELCOME popup no longer auto-covers PLAY on every visit).
        // if (getCookie('mw_tutorial_finished') !== 'true') {
        //     startTutorial(conquestTutorialSteps, 'mw_tutorial_finished');
        // }

        // Bring the menu to life: auto-play a demo war on the map behind it.
        // A/B CONTROL ARM: this revision disables the menu demo so it can be
        // measured against the live demo build (v1125). Everything else —
        // annex paint-fix, banner removal — is identical to v1125. Re-enable
        // (or just promote v1125) once the experiment picks a winner.
        // startMenuDemo();
    }
}

// Settings Tab Logic
document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        // Buttons UI
        document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Panes UI
        document.querySelectorAll('.settings-tab-pane').forEach(pane => pane.style.display = 'none');
        const target = document.getElementById(`settings-tab-${tab}`);
        if (target) target.style.display = 'block';
    });
});

if (DOM.disableCountryGradientCheckbox) {
    DOM.disableCountryGradientCheckbox.addEventListener('change', (e) => {
        GS.disableCountryGradient = e.target.checked;
        setCookie('mw_disable_country_gradient', e.target.checked ? 'true' : 'false');
        GS.influenceLayer.render();
    });
}

// Global invisible buffs toggle wiring
if (DOM.disableInvisibleBuffsCheckbox) {
    // Initialize from current global state
    DOM.disableInvisibleBuffsCheckbox.checked = !GS.invisibleBuffsEnabled;
    DOM.disableInvisibleBuffsCheckbox.addEventListener('change', (e) => {
        // When checked, invisible buffs are turned off
        GS.invisibleBuffsEnabled = !e.target.checked;
        setCookie('mw_disable_invis_buffs', e.target.checked ? 'true' : 'false');
        // Force a re-render so combat previews / UI respond immediately
        GS.influenceLayer.render();
    });
}

checkAutoLaunch();
// Initial language application must happen after all DOM is ready and checkAutoLaunch is done
applyLanguage();
updateRestartVisibility();

// EXPERIMENT (boot-to-map funnel): a new session (no saved war — the search/short
// drive-by cohort) skips the menu entirely and lands straight on the modern-day
// map at "tap a country to pick your nation", cutting the PLAY → era card → ENTER
// taps+screens that prior tests pinned as the setup wall. Now viable because the
// delta-encoded preset (v1160) cut the modern map's after-PLAY payload ~82%
// (5.9MB→~1MB gz), so front-loading it onto boot no longer recreates the load
// wall that sank every earlier auto-start. Returning players WITH an autosave keep
// the menu so their one-tap RESUME stays visible (they drive ~77% of pageviews —
// don't regress them); the in-game MENU button reaches era selection for everyone.
// Reuses the tested choiceModernDay load path (performPresetLoad → SELECTING_P1).
function maybeBootToMap() {
    try {
        if (readAutosaveMeta()) return;            // returning player: keep menu + RESUME
        // Owner ask: don't force returning players straight into modern-day every
        // visit — greet them with the menu so they can find the other scenarios.
        // Only a genuine first-time drive-by (no prior visit flag) gets the
        // streamlined boot-to-map; everyone who's been here before lands on the menu.
        try { if (localStorage.getItem('mw_has_played') === 'true') return; } catch (_) {}
        if (GS.gameState !== 'MAIN_MENU') return;  // only from a clean menu landing
        try { localStorage.setItem('mw_has_played', 'true'); } catch (_) {}
        requestAnimationFrame(() => {              // let menu/engine init settle one frame
            if (GS.gameState !== 'MAIN_MENU') return;
            if (DOM.choiceModernDay) DOM.choiceModernDay.click();
        });
    } catch (e) { /* any failure → fall back to the normal menu */ }
}
maybeBootToMap();

// Initialize editor tools page if toolbox exists
if (DOM.editorToolbox) {
    updateEditorToolPage(1);
}


DOM.mainSettingsBtn.addEventListener('click', () => {
    DOM.settingsOverlay.style.display = 'flex';
    DOM.mainMenu.style.display = 'none';
});

DOM.ingameSettingsBtn.addEventListener('click', () => {
    DOM.settingsOverlay.style.display = 'flex';
    DOM.mapUi.style.display = 'none';
});

if (DOM.closeSettingsBtn) {
    DOM.closeSettingsBtn.addEventListener('click', () => {
        DOM.settingsOverlay.style.display = 'none';
        if (GS.gameState === 'MAIN_MENU') {
            DOM.mainMenu.style.display = 'flex';
        } else {
            DOM.mapUi.style.display = 'flex';
        }
    });
}

// ---------------------------------------------------------------------------
// ATTRACT MODE — a self-running demo war plays on the real map behind the main
// menu, so a search drive-by lands on a MOVING "living war sim" instead of a
// static menu image. They watch it for a beat, then tap PLAY and set up their
// own game exactly as before. The demo is a normal 2-country Random War; the
// menu-demo-live body class (see style.css) keeps the menu visible+transparent
// over the map and hides the in-game HUD/loading screen. Any real scenario load
// tears it down (see performPresetLoad in scenario-loader.js).
// NOTE: keep the scenario URL inline (not a module const) — startMenuDemo is called
// from checkAutoLaunch during module eval, before a top-level const would initialise.

async function startMenuDemo() {
    if (GS.gameState !== 'MAIN_MENU') return;     // only ever from a clean menu
    if (GS.menuDemoActive || GS.menuDemoBusy) return;
    GS.menuDemoBusy = true;
    try {
        const scenarioUrl = 'data/world map 2022.json';
        const response = await fetch(scenarioUrl);
        if (!response.ok) throw new Error('demo scenario fetch failed');
        const blob = await response.blob();
        if (GS.gameState !== 'MAIN_MENU') return;  // visitor left the menu while fetching

        GS.currentScenarioContext = { id: 'world_map_2022', name: 'Modern Day', ownerUsername: 'System', blobUrl: scenarioUrl };
        GS.activeScenarioId = null;

        // Reveal the live map behind the menu + suppress HUD/loading, THEN load.
        document.body.classList.add('menu-demo-live');
        GS.menuDemoActive = true;
        await performPresetLoad(blob, 'CONQUEST', { demoMode: true });

        // Bail if a real load began during the await, or the load didn't reach setup.
        if (!GS.menuDemoActive || GS.gameState !== 'SELECTING_P1') { stopMenuDemo(); return; }

        // Start a self-running war between two random neighbours (reuses the tested
        // Random War picker + startWar path).
        const prevRandomWarMode = GS.randomWarMode;
        GS.randomWarMode = true;
        triggerRandomWar({ preferSmall: true });
        GS.randomWarMode = prevRandomWarMode;

        // If no valid adjacent pair was found, no war started — revert to static menu.
        const activeSides = (GS.sides || []).filter(s => s.length > 0).length;
        if (activeSides < 2) { stopMenuDemo(); return; }

        // Once units have spawned, gently frame the fighting (best-effort).
        setTimeout(frameMenuDemoWar, 900);
    } catch (e) {
        console.warn('Menu attract demo failed, falling back to static menu:', e);
        stopMenuDemo();
    } finally {
        GS.menuDemoBusy = false;
    }
}

function frameMenuDemoWar() {
    if (!GS.menuDemoActive || !Array.isArray(GS.units) || GS.units.length === 0) return;
    const pts = [];
    let sumLat = 0, sumLng = 0;
    for (const u of GS.units) {
        if (typeof u.lat === 'number' && typeof u.lng === 'number') {
            pts.push([u.lat, u.lng]); sumLat += u.lat; sumLng += u.lng;
        }
    }
    if (pts.length === 0) return;
    const center = [sumLat / pts.length, sumLng / pts.length];
    try {
        // Frame the actual war: zoom in as tight as the units fit, but never looser
        // than 5 (the old fixed view was 4) so a drive-by always lands close on the
        // fighting. Capped so a tiny war doesn't blow up past readable detail.
        let zoom = 6;
        if (pts.length > 1) {
            const bounds = L.latLngBounds(pts).pad(0.35);
            zoom = map.getBoundsZoom(bounds);
        }
        zoom = Math.max(5, Math.min(7, zoom));
        map.setView(center, zoom, { animate: true });
    } catch (e) { /* keep world view */ }
}

// Revert to a normal static main menu (used by the demo's own error/war-over paths,
// where we STAY on the menu — never by a real scenario load, which hides the menu).
function stopMenuDemo() {
    GS.menuDemoActive = false;
    document.body.classList.remove('menu-demo-live');
    GS.isPaused = true;                 // freeze the demo sim until a real game (re)starts it
    if (DOM.mainMenu) {
        // The demo's performPresetLoad left an inline display:none (the class overrode it);
        // restore it so dropping the class doesn't make the menu vanish.
        DOM.mainMenu.style.display = 'flex';
        DOM.mainMenu.style.background = '';   // clear inline bg → CSS restores the menu art
        // Never leave the scenario picker open over a reverted menu.
        DOM.mainMenu.classList.remove('scenario-active');
        const navMain = document.getElementById('nav-links-container');
        const selector = document.getElementById('menu-scenario-selector');
        if (navMain) { navMain.style.display = 'flex'; navMain.classList.remove('hidden'); }
        if (selector) selector.style.display = 'none';
        if (DOM.enterScenarioBtn) DOM.enterScenarioBtn.disabled = true;
    }
}

// If the demo war ends while a visitor is still on the menu, reload a fresh one so
// the map keeps moving. Cheap, well-guarded, and only ever touches the menu state.
setInterval(() => {
    if (GS.menuDemoActive && GS.gameState === 'WAR_OVER' && !GS.menuDemoBusy &&
        DOM.mainMenu && getComputedStyle(DOM.mainMenu).display !== 'none') {
        stopMenuDemo();
        GS.gameState = 'MAIN_MENU';
        startMenuDemo();
    }
}, 4000);

DOM.playModeBtn.addEventListener('click', () => {
    // Leave the attract demo running behind the selector — the menu stays alive while
    // the player picks a scenario. The real scenario load (ENTER → performPresetLoad)
    // tears the demo down and starts a fresh game, so we deliberately DON'T stop it here.
    const navMain = document.getElementById('nav-links-container');
    const selector = document.getElementById('menu-scenario-selector');

    // Fresh picker each time: clear any prior selection, then pre-arm the default
    // modern-day era so the already-red-highlighted card IS the live selection and
    // START CAMPAIGN works on the first tap (no dead tap on a disabled button).
    document.querySelectorAll('.scroller-card').forEach(c => c.classList.remove('selected'));
    const defaultEraCard = document.getElementById('scroller-choice-modern');
    if (defaultEraCard) defaultEraCard.classList.add('selected');
    GS.queuedScenarioAction = () => DOM.choiceModernDay.click();
    if (DOM.enterScenarioBtn) DOM.enterScenarioBtn.disabled = false;
    if (DOM.mainMenu) DOM.mainMenu.classList.add('scenario-active');

    navMain.classList.add('hidden');
    setTimeout(() => {
        navMain.style.display = 'none';
        selector.style.display = 'flex';
    }, 500);
});

document.getElementById('back-to-nav-btn').addEventListener('click', () => {
    const navMain = document.getElementById('nav-links-container');
    const selector = document.getElementById('menu-scenario-selector');
    
    selector.style.opacity = '0';
    selector.style.transform = 'translateX(50px)';
    
    setTimeout(() => {
        selector.style.display = 'none';
        selector.style.opacity = '1';
        selector.style.transform = 'none';
        if (DOM.mainMenu) DOM.mainMenu.classList.remove('scenario-active');
        navMain.style.display = 'flex';
        setTimeout(() => navMain.classList.remove('hidden'), 10);
    }, 400);
});

/**
 * DYNAMIC MENU BACKGROUND SYSTEM
 */


GS.queuedScenarioAction = null;

function selectScenario(cardId, action) {
    // 1. Update UI Selection
    document.querySelectorAll('.scroller-card').forEach(card => card.classList.remove('selected'));
    const selectedCard = document.getElementById(cardId);
    if (selectedCard) selectedCard.classList.add('selected');

    // 2. Change Menu Background
    const bgUrl = SCENARIO_MENU_BGS[cardId] || '/assets/img/menu/2022.webp';
    if (DOM.mainMenu) {
        DOM.mainMenu.style.backgroundImage = `url('${bgUrl}')`;
    }

    // 3. Arm the persistent START CAMPAIGN button
    if (DOM.enterScenarioBtn) {
        DOM.enterScenarioBtn.disabled = false;
        GS.queuedScenarioAction = action;
    }

    playClickSound();
}

DOM.enterScenarioBtn.onclick = () => {
    if (GS.queuedScenarioAction) {
        GS.queuedScenarioAction();
    }
};

// Wire Scroller Cards
document.getElementById('scroller-choice-modern').onclick = () => selectScenario('scroller-choice-modern', () => DOM.choiceModernDay.click());
document.getElementById('scroller-choice-1974').onclick = () => selectScenario('scroller-choice-1974', () => DOM.choice1974Scenario.click());

document.getElementById('scroller-choice-1942').onclick = () => selectScenario('scroller-choice-1942', () => DOM.choice1942Scenario.click());
document.getElementById('scroller-choice-1936').onclick = () => selectScenario('scroller-choice-1936', () => DOM.choice1936Scenario.click());
document.getElementById('scroller-choice-1914').onclick = () => selectScenario('scroller-choice-1914', () => DOM.choiceWW1Scenario.click());
document.getElementById('scroller-choice-1804').onclick = () => selectScenario('scroller-choice-1804', () => DOM.choice1804Scenario.click());
document.getElementById('scroller-choice-1492').onclick = () => selectScenario('scroller-choice-1492', () => DOM.choice1492Scenario.click());
document.getElementById('scroller-choice-1ad').onclick = () => selectScenario('scroller-choice-1ad', () => DOM.choice1ADScenario.click());

document.getElementById('scroller-choice-canada')?.addEventListener('click', () => {
    selectScenario('scroller-choice-canada', () => {
        if (typeof DOM.choiceCanadaStates !== 'undefined') DOM.choiceCanadaStates.click();
    });
});
document.getElementById('scroller-choice-germany')?.addEventListener('click', () => {
    selectScenario('scroller-choice-germany', () => {
        if (typeof DOM.choiceGermanyStates !== 'undefined') DOM.choiceGermanyStates.click();
    });
});
document.getElementById('scroller-choice-england')?.addEventListener('click', () => {
    selectScenario('scroller-choice-england', () => {
        if (typeof DOM.choiceEnglandStates !== 'undefined') DOM.choiceEnglandStates.click();
    });
});
document.getElementById('scroller-choice-us').onclick = () => selectScenario('scroller-choice-us', () => DOM.choiceUSStates.click());

document.getElementById('scroller-choice-poland')?.addEventListener('click', () => {
    selectScenario('scroller-choice-poland', async () => {
        const selector = document.getElementById('menu-scenario-selector');
        if (selector) {
            selector.style.opacity = '0';
            selector.style.transform = 'translateX(50px)';
            selector.style.transition = 'all 0.4s ease';
        }
        initAudio();
        setLoadingThematic(true);
        loadingStatus.innerText = "Loading Poland States Preset...";
        DOM.loadingOverlay.style.display = 'flex';
        try {
            const url = 'data/My_Custom_Scenario_preset (5) (2).json';
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch Poland preset");
            const blob = await response.blob();
            GS.currentScenarioContext = { id: 'poland_states', name: 'Poland States', ownerUsername: 'local', blobUrl: url };
            GS.activeScenarioId = null;
            await performPresetLoad(blob, 'CONQUEST');
            DOM.mainMenu.style.display = 'none';
        } catch (e) {
            console.error(e);
            alert("Failed to load Poland States preset.");
            DOM.loadingOverlay.style.display = 'none';
        }
    });
});

document.getElementById('scroller-choice-kaiserreich')?.addEventListener('click', () => {
    selectScenario('scroller-choice-kaiserreich', () => {
        DOM.choiceKaiserreichScenario.click();
    });
});

document.getElementById('scroller-choice-fire')?.addEventListener('click', () => {
    selectScenario('scroller-choice-fire', () => {
        DOM.choiceFireRisesScenario.click();
    });
});

document.getElementById('scroller-choice-1984-alt')?.addEventListener('click', () => {
    selectScenario('scroller-choice-1984-alt', () => {
        DOM.choice1984Scenario.click();
    });
});

// --- COMMUNITY MAPS (owner-supplied presets) ---
// Loaded on demand from data/ the same way the Poland preset is: only fetched
// when the player picks the card, so the big preset JSON never touches boot time.
function loadCommunityPreset(url, statusText, ctx, failMsg) {
    const selector = document.getElementById('menu-scenario-selector');
    if (selector) {
        selector.style.opacity = '0';
        selector.style.transform = 'translateX(50px)';
        selector.style.transition = 'all 0.4s ease';
    }
    initAudio();
    setLoadingThematic(true);
    loadingStatus.innerText = statusText;
    DOM.loadingOverlay.style.display = 'flex';
    // In the ?v=N editor preview a bare sub-resource fetch gets 302-redirected and
    // fetch() rejects it; pin the page's own ?v= onto the URL so it 200s (same fix
    // as the built-in scenarios). Live/promoted players have no ?v= → unchanged.
    const pageV = new URLSearchParams(location.search).get('v');
    const fetchUrl = pageV ? url + (url.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(pageV) : url;
    return (async () => {
        try {
            const response = await fetch(fetchUrl);
            if (!response.ok) throw new Error('Failed to fetch ' + ctx.name + ' (HTTP ' + response.status + ')');
            const blob = await response.blob();
            GS.currentScenarioContext = { id: ctx.id, name: ctx.name, ownerUsername: ctx.owner, blobUrl: url };
            GS.activeScenarioId = null;
            await performPresetLoad(blob, 'CONQUEST');
            DOM.mainMenu.style.display = 'none';
        } catch (e) {
            console.error(e);
            alert(failMsg);
            DOM.loadingOverlay.style.display = 'none';
        }
    })();
}

document.getElementById('scroller-choice-continental')?.addEventListener('click', () => {
    selectScenario('scroller-choice-continental', () => loadCommunityPreset(
        'data/The_Continental_Project_preset.json',
        'Loading The Continental Project...',
        { id: 'continental_project', name: 'The Continental Project', owner: 'Community' },
        'Failed to load The Continental Project.'
    ));
});

document.getElementById('scroller-choice-tno')?.addEventListener('click', () => {
    selectScenario('scroller-choice-tno', () => loadCommunityPreset(
        'data/Finished_TNO_Map_preset.json',
        'Loading The New Order...',
        { id: 'tno_map', name: 'The New Order', owner: 'Community' },
        'Failed to load The New Order.'
    ));
});

// Double-click-to-launch removed: a single tap now selects an era (arming the
// persistent START CAMPAIGN button), which the player taps to proceed.

if (DOM.eraModernTabBtn && DOM.eraWarsTabBtn && DOM.eraHistoryTabBtn && DOM.eraStatesTabBtn && DOM.eraAltTabBtn) {
    const eraTabs = [DOM.eraModernTabBtn, DOM.eraWarsTabBtn, DOM.eraHistoryTabBtn, DOM.eraStatesTabBtn, DOM.eraAltTabBtn];
    const eraPages = [DOM.eraPageModern, DOM.eraPageWars, DOM.eraPageHistory, DOM.eraPageStates, DOM.eraPageAlt];

    const switchEraPage = (targetIndex) => {
        eraPages.forEach((page, i) => {
            if (page) page.style.display = (i === targetIndex) ? 'block' : 'none';
        });
        eraTabs.forEach((tab, i) => {
            if (tab) {
                if (i === targetIndex) tab.classList.add('active');
                else tab.classList.remove('active');
            }
        });
    };

    DOM.eraModernTabBtn.onclick = () => switchEraPage(0);
    DOM.eraWarsTabBtn.onclick = () => switchEraPage(1);
    DOM.eraHistoryTabBtn.onclick = () => switchEraPage(2);
    DOM.eraStatesTabBtn.onclick = () => switchEraPage(3);
    DOM.eraAltTabBtn.onclick = () => switchEraPage(4);
}

// --- Built-in scenario presets (the era buttons in the scenario selector) ---
// Each entry maps a DOM button to a bundled preset .json; the load flow is shared.
const BUILTIN_SCENARIOS = [
    { btn: 'choiceModernDay',           url: 'data/world map 2022.json',                        loading: 'Loading Modern World Theater...',     id: 'world_map_2022',       name: 'Modern Day',                    owner: 'System',       geoFallback: true },
    { btn: 'choice1936Scenario',        url: 'data/WW2 Peru Update.json',                       loading: 'Loading WW2 Peru Update...',          id: 'ww2_peru_update',      name: 'WW2 Peru Update',               owner: 'System' },
    { btn: 'choice1942Scenario',        url: 'data/1942.json',                                  loading: 'Loading 1942 Theater...',             id: 'ww2_1942',             name: '1942 Scenario',                 owner: 'orange' },
    { btn: 'choiceWW1Scenario',         url: 'data/world_war_1__1914_.json',                    loading: 'Loading 1914 Theater...',             id: 'ww1_1914',             name: '1914 Scenario',                 owner: 'System' },
    { btn: 'choice1804Scenario',        url: 'data/1804_map.json',                              loading: 'Loading 1804 Napoleonic Theater...',  id: 'napoleonic_1804',      name: '1804 Napoleonic Wars',          owner: 'orange' },
    { btn: 'choice1492Scenario',        url: 'data/1492_map (2).json',                          loading: 'Loading 1492 Renaissance Theater...', id: 'renaissance_1492',     name: '1492 Scenario',                 owner: 'orange' },
    { btn: 'choice1ADScenario',         url: 'data/1ad.json',                                   loading: 'Loading 1 AD Classical Theater...',   id: '1_ad',                 name: '1 AD Scenario',                 owner: 'System' },
    { btn: 'choiceUSStates',            url: 'data/Reworked_United_States_Map_preset (1).json', loading: 'Loading US States Scenario...',        id: 'us_states_scenario',   name: 'US States Scenario',            owner: 'angel' },
    { btn: 'choiceCanadaStates',        url: 'data/canada_new_preset.json',                     loading: 'Loading Canada Provinces Scenario...', id: 'canada_states_scenario', name: 'Canada Provinces Scenario',   owner: 'System' },
    { btn: 'choiceGermanyStates',       url: 'data/Germany_states_better_preset.json',          loading: 'Loading Germany States Scenario...',  id: 'germany_states_orange', name: 'Germany States',               owner: 'orange' },
    { btn: 'choiceEnglandStates',       url: 'data/England_states_preset.json',                 loading: 'Loading England States Scenario...',  id: 'england_states_scenario', name: 'England States',             owner: 'System' },
    { btn: 'choiceKaiserreichScenario', url: 'data/Kaiserreich_Finished_Map_preset.json',       loading: 'Loading Kaiserreich Scenario...',     id: 'kaiserreich_alt',      name: 'Kaiserreich',                   owner: 'angel' },
    { btn: 'choiceFireRisesScenario',   url: 'data/2ACW_-_The_Fire_Rises_preset.json',          loading: 'Loading The Fire Rises Scenario...',  id: 'fire_rises_2acw',      name: 'The Fire Rises – US Civil War', owner: 'angel' },
    { btn: 'choice1984Scenario',        url: 'data/1984_preset.json',                           loading: 'Loading 1984 Dystopian Scenario...',  id: 'orwell_1984',          name: '1984 – Oceania vs Eurasia', owner: 'Randombanana' },
    { btn: 'choice1974Scenario',        url: 'data/better_cold_war_preset.json',                loading: 'Loading 1974 Cold War Theater...',    id: 'cold_war_1974',        name: '1974 Scenario',                 owner: 'orange' },
];

function wireBuiltinScenario({ btn, url, loading, id, name, owner, geoFallback }) {
    const el = DOM[btn];
    if (!el) return;
    el.onclick = async () => {
        // Smooth transition from the selector into the loading overlay.
        const selector = document.getElementById('menu-scenario-selector');
        if (selector) {
            selector.style.opacity = '0';
            selector.style.transform = 'translateX(50px)';
            selector.style.transition = 'all 0.4s ease';
        }
        initAudio();
        setLoadingThematic(true);
        loadingStatus.innerText = loading;
        DOM.loadingOverlay.style.display = 'flex';
        // Try the bundled preset a few times before giving up — on a flaky mobile
        // connection a single dropped fetch of the (sizable) scenario JSON would
        // otherwise dump the player into the ugly raw-GeoJSON fallback (red Russia,
        // generic borders). A couple of retries with a short backoff makes the
        // Modern Day / preset load resilient to transient network blips.
        // In the websim editor/preview context the page is served at ?v=N, and a
        // bare sub-resource fetch (data/...json) gets 302-redirected to the same
        // ?v=N — a redirect that fetch() can reject with "TypeError: Failed to
        // fetch" (the response varies by Origin/Referer). Requesting the versioned
        // URL directly returns 200 with no redirect, so we pin the page's own ?v=
        // onto the scenario fetch. Live/promoted players have no ?v= → unchanged.
        const pageV = new URLSearchParams(location.search).get('v');
        const fetchUrl = pageV ? url + (url.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(pageV) : url;
        const MAX_ATTEMPTS = 3;
        let loaded = false;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS && !loaded; attempt++) {
            try {
                const response = await fetch(fetchUrl);
                if (!response.ok) throw new Error('Failed to fetch ' + name + ' (HTTP ' + response.status + ')');
                const blob = await response.blob();
                GS.currentScenarioContext = { id, name, ownerUsername: owner, blobUrl: url };
                GS.activeScenarioId = null;
                await performPresetLoad(blob, 'CONQUEST');
                DOM.mainMenu.style.display = 'none';
                loaded = true;
            } catch (e) {
                console.error('Scenario load attempt ' + attempt + '/' + MAX_ATTEMPTS + ' failed:', e);
                if (attempt < MAX_ATTEMPTS) {
                    loadingStatus.innerText = 'Network hiccup — retrying…';
                    await new Promise(r => setTimeout(r, 450 * attempt));
                }
            }
        }
        if (!loaded) {
            if (geoFallback) {
                // Fall back to a plain GeoJSON load if the bundled preset fails.
                GS.gameMode = 'CONQUEST';
                GS.gameState = 'SELECTING_P1';
                const mapRes = document.getElementById('map-res-select').value;
                const geoUrl = `${CONFIG.GEOJSON_BASE}${mapRes}/cultural/ne_${mapRes}_admin_0_countries.json`;
                DOM.mainMenu.style.display = 'none';
                loadCountries(geoUrl, false);
            } else {
                alert('Failed to load ' + name + '.');
                DOM.loadingOverlay.style.display = 'none';
            }
        }
    };
}

BUILTIN_SCENARIOS.forEach(wireBuiltinScenario);

DOM.cancelConquestChoice.onclick = () => {
    DOM.conquestChoiceModal.style.display = 'none';
};

/**
 * EDITOR LOGIC
 */

DOM.closeReleaseModalBtn.onclick = () => {
    DOM.releaseModal.style.display = 'none';
};

window.releaseNation = async (nationId, releaserId, sideIdx) => {
    const meta = GS.countryMetadata.find(m => m && m.id === nationId);
    if (!meta) return;

    // Clear releasable flag so this entry doesn’t show again until re‑set
    meta.releasableBy = null;

    const isWar = (GS.gameState === 'SIMULATING');
    const poleIdx = sideIdx !== -1 ? (sideIdx % 2) : -1;
    const targetOcc = poleIdx === 0 ? 1.0 : (poleIdx === 1 ? -1.0 : 0);

    loadingStatus.innerText = `RESTORING NATION: ${meta.name}...`;
    DOM.loadingOverlay.style.display = 'flex';
    await new Promise(r => setTimeout(r, 50));

    // Decide which cell list to use for restoration:
    // 1) explicit savedCells from when it was marked releasable
    // 2) deJure cores
    // 3) rasterized from GeoJSON feature (slowest; last resort)
    let cellList = Array.isArray(meta.savedCells) && meta.savedCells.length
        ? meta.savedCells
        : null;

    if (!cellList && GS.deJureMap) {
        const cells = [];
        for (let i = 0; i < GS.deJureMap.length; i++) {
            if (GS.deJureMap[i] === nationId) {
                const y = Math.floor(i / GS.gridWidth);
                const x = i % GS.gridWidth;
                cells.push([x, y]);
            }
        }
        if (cells.length) cellList = cells;
    }

    if (!cellList && meta.feature) {
        const bounds = L.geoJSON(meta.feature).getBounds();
        const res = CONFIG.GRID_RES;
        const sLat = Math.max(0, Math.floor((bounds.getSouth() + 90) / res));
        const eLat = Math.min(GS.gridHeight - 1, Math.ceil((bounds.getNorth() + 90) / res));
        const sLng = Math.max(0, Math.floor((bounds.getWest() + 180) / res));
        const eLng = Math.min(GS.gridWidth - 1, Math.ceil((bounds.getEast() + 180) / res));
        const cells = [];
        for (let y = sLat; y <= eLat; y++) {
            for (let x = sLng; x <= eLng; x++) {
                const lat = (y * res) - 90 + (res * 0.5);
                const lng = (x * res) - 180 + (res * 0.5);
                if (isPointInFeature(lat, lng, meta.feature)) {
                    cells.push([x, y]);
                }
            }
        }
        if (cells.length) cellList = cells;
    }

    let restoredAny = false;
    // If this nation came from a preset with savedCells, we can safely override any current owner on those cells.
    const hasExplicitSavedCells = Array.isArray(meta.savedCells) && meta.savedCells.length > 0;

    if (cellList && cellList.length) {
        for (let i = 0; i < cellList.length; i++) {
            const [x, y] = cellList[i];
            const idx = y * GS.gridWidth + x;
            if (idx < 0 || idx >= GS.worldControlMap.length) continue;

            const currentOwner = GS.worldControlMap[idx];

            // Only restrict to releaser/neutral when we don't have an explicit savedCells mask.
            if (!hasExplicitSavedCells) {
                if (currentOwner !== releaserId && currentOwner !== 0 && currentOwner !== nationId) {
                    continue;
                }
            }

            GS.worldControlMap[idx] = nationId;
            GS.deJureMap[idx] = nationId;
            GS.provinceMap[idx] = getProvinceId(x, y, nationId);

            if (isWar && sideIdx !== -1) {
                GS.landMask[idx] = 2;
                GS.occupationMap[idx] = targetOcc;
                GS.primaryOccupierMap[idx] = nationId;
            } else {
                if (GS.landMask[idx] === 0) GS.landMask[idx] = 1;
                GS.occupationMap[idx] = 0;
                GS.primaryOccupierMap[idx] = 0;
            }

            restoredAny = true;
        }
    }

    if (!restoredAny) {
        DOM.loadingOverlay.style.display = 'none';
        DOM.releaseModal.style.display = 'none';
        DOM.statusText.innerText = `No valid territory found to release for ${meta.name}.`;
        GS.influenceLayer.render();
        return;
    }

    // If in setup or mid‑war, make sure this nation actually participates on the chosen side
    const newCountry = {
        id: nationId,
        name: meta.name,
        color: meta.color,
        role: 'OFFENSE',
        strategy: 'BALANCED',
        buffState: 'none',
        overlordId: meta.overlordId || null,
        flag: meta.tempFlag || null
    };

    if (!newCountry.flag && meta.flagUrl) {
        newCountry.flag = new Image();
        newCountry.flag.crossOrigin = "anonymous";
        newCountry.flag.src = meta.flagUrl;
        meta.tempFlag = newCountry.flag;
    }

    if (sideIdx !== -1) {
        // Always register the nation as a real belligerent on its side. This was
        // previously skipped mid-war (only units were spawned), so a released
        // "revolution" was a ghost the sim never counted — the one-side-left ender
        // then read the board as decided and annexed it on the spot.
        if (!GS.sides[sideIdx]) GS.sides[sideIdx] = [];
        if (!GS.sides[sideIdx].some(c => c.id === nationId)) {
            GS.sides[sideIdx].push(newCountry);
        }
        if (GS.gameState === 'SIMULATING') {
            // A revolution is deliberately launched into an already-lopsided board
            // (that's the whole point — breaking away from a dominant power). Give
            // it a grace window so the global decisive-board enders don't sweep it
            // away in the first ~2s before it can field a fight. graceTicks is the
            // existing per-nation capitulation immunity; the board-control enders
            // now also stand down while any side member is still within grace.
            newCountry.graceTicks = Math.max(newCountry.graceTicks || 0, 1800);
            activateCountryMidWar(newCountry, sideIdx);
        }
    }

    DOM.loadingOverlay.style.display = 'none';
    DOM.releaseModal.style.display = 'none';
    recalculateAllBounds();
    updateSidesUI();
    GS.influenceLayer.render();
    DOM.statusText.innerText = `${meta.name} has been released!`;
};












map.on('mousedown', (e) => {
    // If the user is interacting with reference image handles, do NOT start painting or terrain tools.
    const targetEl = e.originalEvent && e.originalEvent.target;
    if (targetEl && targetEl.closest('.ref-handle, .ref-handle-center')) {
        return;
    }

    if (GS.gameState === 'EDITOR_PAINTING_TERRAIN') {
        // Before starting terrain paint, ensure we're in Simplified (wargames) mode unless this is a custom canvas.
        const currentImagery = DOM.imagerySelect ? DOM.imagerySelect.value : (getCookie('mw_imagery') || 'arcgis');

        // Only prompt/switch if we're NOT already wargames and NOT on a blank/custom terrain map.
        if (currentImagery !== 'wargames' && !GS.isCustomTerrain) {
            if (confirm("Satellite Directive: Terrain modification requires 'Simplified Mode' to correctly align geography. Switch now?")) {
                setImageryProvider('wargames', false);
                if (DOM.disableCountryGradientCheckbox) {
                    DOM.disableCountryGradientCheckbox.checked = true;
                    GS.disableCountryGradient = true;
                }
            }
            // After switching (or cancelling), do not treat this same click as a paint event;
            // the user can click again to start painting, which prevents stray lines.
            return;
        }
    }

    if (GS.gameState === 'EDITOR_PAINTING' || GS.gameState === 'EDITOR_UNCLAIMING' || GS.gameState === 'EDITOR_PAINTING_TERRAIN') {
        GS.isPainting = true;
        GS.lastPaintLatLng = e.latlng;
        map.dragging.disable();
        
        // Set paint mask if Alt is held down
        if (e.originalEvent && e.originalEvent.altKey) {
            const idx = getGridIndex(e.latlng.lat, e.latlng.lng);
            if (idx !== -1) {
                GS.paintMaskId = GS.worldControlMap[idx];
            } else {
                GS.paintMaskId = -1;
            }
        } else {
            GS.paintMaskId = -1;
        }

        paintAt(e.latlng);
    }
});

map.on('mousemove', (e) => {
    DOM.coordsDisplay.textContent = `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;

    // While dragging reference image handles, ignore painting logic entirely.
    const targetEl = e.originalEvent && e.originalEvent.target;
    if (targetEl && targetEl.closest('.ref-handle, .ref-handle-center')) {
        return;
    }

    if (GS.isPainting && (GS.gameState === 'EDITOR_PAINTING' || GS.gameState === 'EDITOR_UNCLAIMING' || GS.gameState === 'EDITOR_PAINTING_TERRAIN')) {
        if (GS.lastPaintLatLng) {
            // INTERPOLATION SYSTEM: "Raycast" between last and current mouse positions.
            // This prevents gaps when dragging the brush faster than the frame rate.
            const p1 = GS.lastPaintLatLng;
            const p2 = e.latlng;
            
            let dLng = p2.lng - p1.lng;
            if (dLng > 180) dLng -= 360;
            if (dLng < -180) dLng += 360;
            const dLat = p2.lat - p1.lat;
            
            const dist = Math.sqrt(dLat*dLat + dLng*dLng);
            const step = GS.brushSize * 0.35; // Step every 35% of brush radius
            
            if (dist > step) {
                const numSteps = Math.ceil(dist / step);
                let changedAny = false;
                for (let i = 1; i <= numSteps; i++) {
                    const t = i / numSteps;
                    const interpLat = p1.lat + dLat * t;
                    let interpLng = p1.lng + dLng * t;
                    if (interpLng > 180) interpLng -= 360;
                    if (interpLng < -180) interpLng += 360;
                    
                    if (applyPaintAt({ lat: interpLat, lng: interpLng })) {
                        changedAny = true;
                    }
                }
                if (changedAny) {
                    GS.influenceLayer._forceRender = true;
                    GS.influenceLayer.render();
                }
            } else {
                paintAt(e.latlng);
            }
            GS.lastPaintLatLng = e.latlng;
        } else {
            paintAt(e.latlng);
            GS.lastPaintLatLng = e.latlng;
        }
    }
});

map.on('mouseup', () => {
    if (GS.isPainting) {
        // Update label positions and territory stats after a painting stroke finishes
        recalculateAllBounds();
        GS.influenceLayer.render();
    }
    GS.isPainting = false;
    map.dragging.enable();
});

DOM.editorCreateBtn.addEventListener('click', () => {
    DOM.createCountryModal.style.display = 'flex';
});

DOM.cancelCreateBtn.addEventListener('click', () => {
    DOM.createCountryModal.style.display = 'none';
});

DOM.confirmCreateBtn.addEventListener('click', async () => {
    const name = DOM.newCountryNameInput.value || "New Nation";
    const color = DOM.newCountryColorInput.value;
    const file = DOM.newCountryFlagInput.files[0];
    
    GS.customCountryData = {
        name,
        color: color.replace('#', 'rgba(') + ')', // basic hex to rgba converter simplified
        flagUrl: null
    };

    // Correct hex to rgba
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    GS.customCountryData.color = `rgba(${r}, ${g}, ${b}, 0.5)`;
    GS.customCountryData.displayName = name;

    if (file) {
        try {
            loadingStatus.innerText = "Uploading Flag...";
            DOM.loadingOverlay.style.display = 'flex';
            GS.customCountryData.flagUrl = await websim.upload(file);
            DOM.loadingOverlay.style.display = 'none';
        } catch (e) {
            console.error("Flag upload failed", e);
        }
    }

    DOM.createCountryModal.style.display = 'none';
    GS.gameState = 'EDITOR_PLACING';
    DOM.statusText.innerText = "Click on Map to Place Capital";
    map.getContainer().classList.add('painting-cursor');
});

DOM.inspectNameInput.addEventListener('input', (e) => {
    if (GS.editingCountryId <= 0) return;
    const meta = GS.countryMetadata.find(m => m && m.id === GS.editingCountryId);
    if (meta) {
        meta.name = e.target.value;
        // Propagate to live setup/simulation objects
        GS.sides.flat().forEach(c => {
            if (c.id === GS.editingCountryId) c.name = meta.name;
        });
        updateSidesUI();
        // Ensure labels recalculate their spine/position in real-time
        recalculateAllBounds();
        GS.influenceLayer.render();
    }
});

DOM.inspectHubFlagBtn.addEventListener('click', () => {
    openHub('flags');
});

DOM.inspectFetchFlagBtn.addEventListener('click', async () => {
    if (GS.editingCountryId <= 0) return;
    const name = DOM.inspectNameInput.value.trim();
    if (!name) return;

    let code = findCodeByName(name);

    // Fallback to GeoJSON search if code mapping doesn't have it
    if (!code && GS.rawGeoJsonData) {
        const feature = GS.rawGeoJsonData.features.find(f => {
            const p = f.properties;
            const possibleNames = [
                p.NAME, p.name, p.admin, p.NAME_LONG, p.formal_en, p.name_sort
            ].filter(Boolean).map(n => n.toLowerCase());
            return possibleNames.includes(name.toLowerCase());
        });

        if (feature) {
            const getFeatCode = (feat) => {
                if (!feat || !feat.properties) return null;
                const p = feat.properties;
                let c = p.ISO_A2 || p.iso_a2 || p.ISO_A2_EH || p.iso_a2_eh || p.ADDR_A2 || null;
                if (c === "-99") c = null;
                return c ? c.toLowerCase() : null;
            };
            code = getFeatCode(feature);
        }
    }

    if (!code) {
        alert("Could not find a modern flag for '" + name + "'. Try the full English name.");
        return;
    }

    const flagUrl = `https://flagcdn.com/w160/${code}.png`;
    updateCountryFlag(GS.editingCountryId, flagUrl);
});

DOM.inspectFlagInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && GS.editingCountryId > 0) {
        try {
            loadingStatus.innerText = "Uploading Flag...";
            DOM.loadingOverlay.style.display = 'flex';
            const url = await websim.upload(file);
            
            updateCountryFlag(GS.editingCountryId, url);
            DOM.loadingOverlay.style.display = 'none';
        } catch (err) {
            console.error(err);
            DOM.loadingOverlay.style.display = 'none';
        }
    }
});

DOM.inspectColorPicker.addEventListener('input', (e) => {
    if (GS.editingCountryId <= 0) return;
    const newColorHex = e.target.value;
    const r = parseInt(newColorHex.slice(1, 3), 16);
    const g = parseInt(newColorHex.slice(3, 5), 16);
    const b = parseInt(newColorHex.slice(5, 7), 16);
    
    const meta = GS.countryMetadata.find(m => m && m.id === GS.editingCountryId);
    if (meta) {
        meta.color = `rgba(${r}, ${g}, ${b}, 0.5)`;
        meta.rgba = [r, g, b, 0.5];
        DOM.inspectColorSwatch.style.backgroundColor = meta.color;
        GS.influenceLayer.render();
    }
});

DOM.shareCountryBtn.addEventListener('click', () => {
    if (GS.editingCountryId <= 0) return;
    const meta = GS.countryMetadata.find(m => m && m.id === GS.editingCountryId);
    if (!meta) return;

    DOM.shareCountryNameInput.value = meta.name || "Custom Nation";
    DOM.shareCountryDescInput.value = "";
    DOM.shareCountryModal.style.display = 'flex';
});

DOM.shareFlagBtn.addEventListener('click', () => {
    if (GS.editingCountryId <= 0) return;
    const meta = GS.countryMetadata.find(m => m && m.id === GS.editingCountryId);
    if (!meta || !meta.flagUrl) {
        alert("This nation does not have a flag to share. Upload or fetch one first.");
        return;
    }

    DOM.shareFlagNameInput.value = `${meta.name || 'Custom'} Flag`;
    DOM.shareFlagDescInput.value = "";
    DOM.shareFlagModal.style.display = 'flex';
});

DOM.cancelShareFlagBtn.onclick = () => {
    DOM.shareFlagModal.style.display = 'none';
};

DOM.confirmShareFlagBtn.onclick = async () => {
    if (GS.editingCountryId <= 0) return;
    const meta = GS.countryMetadata.find(m => m && m.id === GS.editingCountryId);
    if (!meta || !meta.flagUrl) return;

    const publicName = DOM.shareFlagNameInput.value.trim() || "Custom Flag";
    const description = DOM.shareFlagDescInput.value.trim();

    DOM.shareFlagModal.style.display = 'none';
    loadingStatus.innerText = "Sharing Flag to Library...";
    DOM.loadingOverlay.style.display = 'flex';

    try {
        await GS.room.collection('flag_library_v1').create({
            name: publicName,
            description: description,
            flagUrl: meta.flagUrl
        });
        DOM.loadingOverlay.style.display = 'none';
        alert("Flag successfully shared!");
    } catch (e) {
        console.error(e);
        alert("Failed to share flag.");
        DOM.loadingOverlay.style.display = 'none';
    }
};

DOM.cancelShareCountryBtn.onclick = () => {
    DOM.shareCountryModal.style.display = 'none';
};

DOM.confirmShareCountryBtn.onclick = async () => {
    if (GS.editingCountryId <= 0) return;
    const meta = GS.countryMetadata.find(m => m && m.id === GS.editingCountryId);
    if (!meta) return;
    
    const publicName = DOM.shareCountryNameInput.value.trim() || meta.name || "Custom Nation";
    const description = DOM.shareCountryDescInput.value.trim();

    DOM.shareCountryModal.style.display = 'none';
    loadingStatus.innerText = `Saving ${publicName} to Library...`;
    DOM.loadingOverlay.style.display = 'flex';

    try {
        // 1. Generate Border Preview
        let previewUrl = null;
        if (GS.influenceLayer && GS.influenceLayer._container) {
            GS.influenceLayer._isCapturing = true;
            GS.influenceLayer.render();
            const canvas = GS.influenceLayer._container;
            const previewBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
            GS.influenceLayer._isCapturing = false;
            GS.influenceLayer.render();
            if (previewBlob) {
                const previewFile = new File([previewBlob], "country_preview.jpg", { type: "image/jpeg" });
                previewUrl = await websim.upload(previewFile);
            }
        }

        // 2. Collect all cells belonging to this country
        const cells = [];
        for (let i = 0; i < GS.worldControlMap.length; i++) {
            if (GS.worldControlMap[i] === GS.editingCountryId) {
                const y = Math.floor(i / GS.gridWidth);
                const x = i % GS.gridWidth;
                cells.push([x, y]);
            }
        }

        if (cells.length === 0) {
            alert("Country has no territory to share!");
            DOM.loadingOverlay.style.display = 'none';
            return;
        }

        // 3. Upload Cells Data as a file to bypass 250KB record limit
        const cellsBlob = new Blob([JSON.stringify(cells)], { type: 'application/json' });
        const cellsFile = new File([cellsBlob], "country_cells.json", { type: "application/json" });
        const cellsUrl = await websim.upload(cellsFile);

        // 4. Create Persistent Record
        await GS.room.collection('country_library_v1').create({
            name: publicName,
            description: description,
            previewUrl: previewUrl,
            color: meta.color,
            flagUrl: meta.flagUrl,
            gridRes: CONFIG.GRID_RES,
            cellsUrl: cellsUrl
        });

        DOM.loadingOverlay.style.display = 'none';
        alert("Country added to Global Library!");
    } catch (e) {
        console.error(e);
        alert("Failed to share country.");
        DOM.loadingOverlay.style.display = 'none';
    }
};

DOM.inspectPaintBtn.addEventListener('click', () => {
    GS.gameState = 'EDITOR_PAINTING';
    DOM.statusText.innerText = "PAINTING BORDERS (Drag to draw)";
    DOM.countryInspector.style.display = 'none';
    map.getContainer().classList.add('painting-cursor');
    DOM.editorPaintBtn.style.display = 'block';
    DOM.editorFillBtn.style.display = 'block';
    DOM.editorUnclaimBtn.style.display = 'block';
    DOM.editorPaintBtn.classList.add('active');
    DOM.brushControls.style.display = 'flex';
});

DOM.inspectAnnexClickBtn.addEventListener('click', () => {
    if (GS.editingCountryId <= 0) return;
    GS.gameState = 'EDITOR_ANNEXING';
    DOM.statusText.innerText = "ANNEX TOOL: Click any country on the map to absorb its land";
    DOM.countryInspector.style.display = 'none';
    map.getContainer().classList.add('painting-cursor');
});

DOM.editorPaintBtn.addEventListener('click', () => {
    if (GS.gameState === 'EDITOR_PAINTING') {
        GS.gameState = 'EDITOR_ACTIVE';
        DOM.statusText.innerText = "Map Editor (Alpha)";
        DOM.editorPaintBtn.classList.remove('active');
        map.getContainer().classList.remove('painting-cursor');
        DOM.brushControls.style.display = 'none';
    } else if (GS.editingCountryId > 0 || GS.gameState === 'EDITOR_UNCLAIMING') {
        GS.gameState = 'EDITOR_PAINTING';
        DOM.statusText.innerText = "PAINTING BORDERS (Drag to draw)";
        DOM.editorPaintBtn.classList.add('active');
        DOM.editorFillBtn.classList.remove('active');
        DOM.editorUnclaimBtn.classList.remove('active');
        map.getContainer().classList.add('painting-cursor');
        DOM.brushControls.style.display = 'flex';
    }
});

DOM.editorFillBtn.addEventListener('click', () => {
    if (GS.gameState === 'EDITOR_FILLING' || GS.gameState === 'EDITOR_FILLING_TERRAIN') {
        const wasTerrain = GS.gameState === 'EDITOR_FILLING_TERRAIN';
        GS.gameState = 'EDITOR_ACTIVE';
        DOM.statusText.innerText = "Map Editor (Alpha)";
        DOM.editorFillBtn.classList.remove('active');
        map.getContainer().classList.remove('painting-cursor');
        // If we were filling terrain, return to the terrain menu state
        if (wasTerrain) {
            GS.gameState = 'EDITOR_PAINTING_TERRAIN';
            DOM.editorTerrainBtn.classList.add('active');
            DOM.statusText.innerText = "TERRAIN BRUSH (Paint land or carve oceans)";
            map.getContainer().classList.add('painting-cursor');
            DOM.brushControls.style.display = 'flex';
            DOM.terrainControls.style.display = 'flex';
        }
    } else if (GS.gameState === 'EDITOR_PAINTING_TERRAIN') {
        GS.gameState = 'EDITOR_FILLING_TERRAIN';
        DOM.statusText.innerText = "FILL TERRAIN (Click a region)";
        DOM.editorFillBtn.classList.add('active');
        DOM.editorTerrainBtn.classList.remove('active');
        DOM.brushControls.style.display = 'none';
        map.getContainer().classList.add('painting-cursor');
    } else if (GS.editingCountryId > 0 || GS.gameState === 'EDITOR_UNCLAIMING') {
        GS.gameState = 'EDITOR_FILLING';
        DOM.statusText.innerText = "FILL TOOL (Click a region)";
        DOM.editorFillBtn.classList.add('active');
        DOM.editorPaintBtn.classList.remove('active');
        DOM.editorUnclaimBtn.classList.remove('active');
        DOM.brushControls.style.display = 'none';
        map.getContainer().classList.add('painting-cursor');
    }
});

DOM.editorUnclaimBtn.addEventListener('click', () => {
    if (GS.gameState === 'EDITOR_UNCLAIMING') {
        GS.gameState = 'EDITOR_ACTIVE';
        DOM.statusText.innerText = "Map Editor (Alpha)";
        DOM.editorUnclaimBtn.classList.remove('active');
        map.getContainer().classList.remove('painting-cursor');
        DOM.brushControls.style.display = 'none';
    } else {
        GS.gameState = 'EDITOR_UNCLAIMING';
        DOM.statusText.innerText = "UNCLAIM TOOL (Remove country ownership)";
        DOM.editorUnclaimBtn.classList.add('active');
        DOM.editorPaintBtn.classList.remove('active'); 
        DOM.editorFillBtn.classList.remove('active');
        DOM.editorTerrainBtn.classList.remove('active');
        DOM.terrainControls.style.display = 'none';
        DOM.editorPlaceDivisionBtn.classList.remove('active');
        map.getContainer().classList.add('painting-cursor');
        DOM.brushControls.style.display = 'flex';
    }
});

DOM.editorTerrainBtn.addEventListener('click', () => {
    if (GS.gameState === 'EDITOR_PAINTING_TERRAIN') {
        GS.gameState = 'EDITOR_ACTIVE';
        DOM.statusText.innerText = "Map Editor (Alpha)";
        DOM.editorTerrainBtn.classList.remove('active');
        map.getContainer().classList.remove('painting-cursor');
        DOM.brushControls.style.display = 'none';
        DOM.terrainControls.style.display = 'none';
    } else {
        GS.gameState = 'EDITOR_PAINTING_TERRAIN';
        DOM.statusText.innerText = "TERRAIN BRUSH (Paint land or carve oceans)";
        DOM.editorTerrainBtn.classList.add('active');
        DOM.editorPaintBtn.classList.remove('active');
        DOM.editorFillBtn.classList.remove('active');
        DOM.editorUnclaimBtn.classList.remove('active');
        DOM.editorPlaceDivisionBtn.classList.remove('active');
        map.getContainer().classList.add('painting-cursor');
        DOM.brushControls.style.display = 'flex';
        DOM.terrainControls.style.display = 'flex';
    }
});

DOM.editorPlaceDivisionBtn.addEventListener('click', () => {
    if (GS.gameState === 'EDITOR_PLACING_DIVISION') {
        GS.gameState = 'EDITOR_ACTIVE';
        DOM.statusText.innerText = GS.godModeActive ? "GOD MODE: Map Editing Active" : "Map Editor (Alpha)";
        DOM.editorPlaceDivisionBtn.classList.remove('active');
        map.getContainer().classList.remove('painting-cursor');
    } else {
        GS.gameState = 'EDITOR_PLACING_DIVISION';
        GS.editingCountryId = -1; // Reset to force selecting a new country source
        DOM.statusText.innerText = "SELECT SOURCE: Click a nation to deploy its divisions";
        DOM.editorPlaceDivisionBtn.classList.add('active');
        DOM.editorPaintBtn.classList.remove('active');
        DOM.editorFillBtn.classList.remove('active');
        DOM.editorUnclaimBtn.classList.remove('active');
        DOM.countryInspector.style.display = 'none';
        DOM.brushControls.style.display = 'none';
        map.getContainer().classList.add('painting-cursor');
    }
});

DOM.brushSizeSlider.addEventListener('input', (e) => {
    GS.brushSize = parseFloat(e.target.value);
    DOM.brushSizeVal.innerText = GS.brushSize.toFixed(1);
});


DOM.annexCountryBtn.addEventListener('click', async () => {
    if (!GS.rawGeoJsonData || GS.editingCountryId <= 0) return;
    const name = DOM.annexCountryInput.value.trim().toLowerCase();
    if (!name) return;

    const feature = GS.rawGeoJsonData.features.find(f => {
        const fName = (f.properties.NAME || f.properties.name || f.properties.admin || f.properties.NAME_LONG || "").toLowerCase();
        return fName === name;
    });

    if (!feature) {
        alert("Country not found in modern reference data. Try names like 'Poland', 'Ukraine', or 'United States of America'.");
        return;
    }

    await annexFeatureToCountry(feature, GS.editingCountryId);
    DOM.annexCountryInput.value = "";
});

// Ally controls
if (DOM.addAllyBtn) {
    DOM.addAllyBtn.addEventListener('click', () => {
        if (GS.editingCountryId <= 0) {
            alert("Select a nation first in the inspector to add allies.");
            return;
        }
        GS.selectingAllyForId = GS.editingCountryId;
        GS.gameState = 'EDITOR_SELECTING_ALLY';
        DOM.statusText.innerText = "Alliance: click another country on the map to ally with.";
        DOM.countryInspector.style.display = 'none';
        map.getContainer().classList.add('painting-cursor');
    });
}

if (DOM.clearAlliesBtn) {
    DOM.clearAlliesBtn.addEventListener('click', () => {
        if (GS.editingCountryId <= 0) return;
        const meta = GS.countryMetadata.find(m => m && m.id === GS.editingCountryId);
        if (!meta || !meta.allies || meta.allies.length === 0) return;
        const allies = [...meta.allies];
        allies.forEach(aid => {
            const aMeta = GS.countryMetadata[aid - 1];
            if (aMeta && Array.isArray(aMeta.allies)) {
                aMeta.allies = aMeta.allies.filter(id => id !== GS.editingCountryId);
            }
        });
        meta.allies = [];
        DOM.statusText.innerText = "All alliances for this nation have been cleared.";
        openInspector(GS.editingCountryId);
        GS.influenceLayer.render();
    });
}

// Alliance flag upload: sets a shared flag for the whole alliance group (used only in Alliance View / Flag View)
if (DOM.allianceFlagInput) {
    DOM.allianceFlagInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file || GS.editingCountryId <= 0) return;
        try {
            loadingStatus.innerText = "Uploading Alliance Flag...";
            DOM.loadingOverlay.style.display = 'flex';
            const url = await websim.upload(file);
            const rootId = getAllianceRootId(GS.editingCountryId);
            if (!rootId) {
                DOM.loadingOverlay.style.display = 'none';
                alert("Could not resolve alliance group for this nation.");
                return;
            }
            const rootMeta = GS.countryMetadata[rootId - 1];
            if (!rootMeta) {
                DOM.loadingOverlay.style.display = 'none';
                alert("Alliance root metadata missing.");
                return;
            }
            rootMeta.allianceFlagUrl = url;
            rootMeta.allianceFlagTempFlag = new Image();
            rootMeta.allianceFlagTempFlag.crossOrigin = "anonymous";
            rootMeta.allianceFlagTempFlag.onload = () => {
                DOM.loadingOverlay.style.display = 'none';
                GS.influenceLayer.render();
            };
            rootMeta.allianceFlagTempFlag.src = url;
            DOM.statusText.innerText = "Alliance flag set for this alliance group.";
        } catch (err) {
            console.error("Alliance flag upload failed", err);
            DOM.loadingOverlay.style.display = 'none';
            alert("Failed to upload alliance flag.");
        }
    });
}

document.getElementById('set-overlord-btn').onclick = () => {
    if (GS.editingCountryId <= 0) return;
    GS.selectingOverlordForId = GS.editingCountryId;
    GS.gameState = 'EDITOR_SELECTING_OVERLORD';
    DOM.statusText.innerText = "Select Overlord Country (Click map)";
    DOM.countryInspector.style.display = 'none';
    map.getContainer().classList.add('painting-cursor');
};

document.getElementById('set-releasable-btn').onclick = () => {
    if (GS.editingCountryId <= 0) return;
    GS.selectingOverlordForId = GS.editingCountryId;
    GS.gameState = 'EDITOR_SELECTING_RELEASER';
    DOM.statusText.innerText = "Select Host Nation (Releaser) on map";
    DOM.countryInspector.style.display = 'none';
    map.getContainer().classList.add('painting-cursor');
};

document.getElementById('clear-overlord-btn').onclick = () => {
    if (GS.editingCountryId <= 0) return;
    const meta = GS.countryMetadata.find(m => m && m.id === GS.editingCountryId);
    if (meta) {
        meta.overlordId = null;
        GS.sides.flat().forEach(c => { if (c.id === GS.editingCountryId) c.overlordId = null; });

        // If this country had an original flag before puppetization, restore it
        if (meta.baseFlagUrl) {
            updateCountryFlag(GS.editingCountryId, meta.baseFlagUrl);
        }

        DOM.statusText.innerText = `Vassal status cleared for ${meta.name}`;
        openInspector(GS.editingCountryId);
        GS.influenceLayer.render();
    }
};

DOM.closeInspectorBtn.addEventListener('click', () => {
    DOM.countryInspector.style.display = 'none';
    GS.editingCountryId = -1;
    GS.influenceLayer.render();
});

if (DOM.inspectBuffBtn) {
    DOM.inspectBuffBtn.addEventListener('click', (event) => {
        if (GS.editingCountryId <= 0) return;
        const meta = GS.countryMetadata.find(m => m && m.id === GS.editingCountryId);
        if (!meta) return;

        // Determine direction: clicked arrow uses its data-dir, clicking center cycles forward
        let dir = 1;
        const target = event.target;
        if (target && target.classList.contains('buff-arrow')) {
            const d = parseInt(target.getAttribute('data-dir'), 10);
            if (d === -1 || d === 1) dir = d;
        }

        // ALT-click: adjust hidden (invisible) buff that overrides visible buff during play
        if (event.altKey) {
            const currentHidden = meta.hiddenBuffState || 'none';
            const nextHidden = cycleBuffState(currentHidden, dir);
            meta.hiddenBuffState = nextHidden;

            // Propagate hidden buff to any live side objects
            GS.sides.flat().forEach(c => {
                if (c && c.id === GS.editingCountryId) {
                    c.hiddenBuffState = nextHidden;
                }
            });

            DOM.statusText.innerText = `SECRET BUFF: ${meta.name} hidden buff set to ${BUFF_METADATA[nextHidden]?.label || nextHidden}`;
            GS.influenceLayer.render();
            return;
        }

        // Normal click: adjust visible buff (what the player can see in UI)
        const current = meta.buffState || 'none';
        const nextState = cycleBuffState(current, dir);
        meta.buffState = nextState;

        // Propagate visible buff to any live side objects so setup UI matches
        GS.sides.flat().forEach(c => {
            if (c && c.id === GS.editingCountryId) {
                c.buffState = nextState;
            }
        });

        const bMeta = BUFF_METADATA[nextState] || BUFF_METADATA['none'];
        DOM.inspectBuffBtn.innerHTML = `
            <span class="buff-arrow" data-dir="-1" style="font-size:11px; margin-right:4px;">◀</span>
            <span class="buff-label">BUFF: ${bMeta.label}</span>
            <span class="buff-arrow" data-dir="1" style="font-size:11px; margin-left:4px;">▶</span>
        `;
        DOM.inspectBuffBtn.style.background = bMeta.color;
        DOM.inspectBuffBtn.style.color = bMeta.textColor;

        // Refresh setup UI so side slots show the new visible buff
        updateSidesUI();
        GS.influenceLayer.render();
    });
}

// City inspector logic


DOM.cityNameInput.addEventListener('input', (e) => {
    if (GS.editingCityId <= 0) return;
    const city = GS.cities.find(c => c.id === GS.editingCityId);
    if (!city) return;
    city.name = e.target.value;
    GS.influenceLayer.render();
});

DOM.cityOwnerSelect.addEventListener('change', () => {
    if (GS.editingCityId <= 0) return;
    const city = GS.cities.find(c => c.id === GS.editingCityId);
    if (!city) return;
    const val = parseInt(DOM.cityOwnerSelect.value || '0', 10);
    city.ownerId = val || null;
    city.sovereignId = city.ownerId;
    GS.influenceLayer.render();
});

DOM.cityCapitalCheckbox.addEventListener('change', () => {
    if (GS.editingCityId <= 0) return;
    const city = GS.cities.find(c => c.id === GS.editingCityId);
    if (!city) return;
    const ownerId = city.ownerId || city.sovereignId;
    city.isCapital = DOM.cityCapitalCheckbox.checked;
    if (ownerId && city.isCapital) {
        // Clear capital flag on other cities of this owner
        GS.cities.forEach(c => {
            if (c.id !== city.id && (c.ownerId || c.sovereignId) === ownerId) {
                c.isCapital = false;
            }
        });
    }
    GS.influenceLayer.render();
});

DOM.cityMoveBtn.addEventListener('click', () => {
    if (GS.editingCityId <= 0) return;
    DOM.statusText.innerText = "City Move: click on the map to set the new position.";
    GS.cityEditMode = 'MOVE';
    DOM.cityInspector.style.display = 'none';
});

DOM.cityDeleteBtn.addEventListener('click', () => {
    if (GS.editingCityId <= 0) return;
    const city = GS.cities.find(c => c.id === GS.editingCityId);
    if (!city) return;
    if (!confirm(`Delete city "${city.name}"?`)) return;
    GS.cities = GS.cities.filter(c => c.id !== GS.editingCityId);
    GS.activeTheaterCities = GS.activeTheaterCities.filter(c => c.id !== GS.editingCityId);
    GS.editingCityId = -1;
    DOM.cityInspector.style.display = 'none';
    GS.influenceLayer.render();
    DOM.statusText.innerText = "City deleted.";
});

DOM.cityCloseBtn.addEventListener('click', () => {
    DOM.cityInspector.style.display = 'none';
    GS.editingCityId = -1;
});

DOM.editorExitBtn.addEventListener('click', () => {
    location.reload(); // Quick reset
});

if (DOM.editorMapSettingsBtn && DOM.mapSettingsModal) {
    DOM.editorMapSettingsBtn.addEventListener('click', () => {
        // Pre-fill fields from current state
        DOM.mapSettingsNameInput.value = GS.mapName || "";
        DOM.mapSettingsWidthInput.value = GS.worldWidthDeg || 360;
        DOM.mapSettingsHeightInput.value = GS.worldHeightDeg || 180;
        DOM.mapSettingsMissilesCheckbox.checked = !!GS.missilesEnabled;
        DOM.mapSettingsModal.style.display = 'flex';
    });
}

if (DOM.mapSettingsCancelBtn && DOM.mapSettingsModal) {
    DOM.mapSettingsCancelBtn.addEventListener('click', () => {
        DOM.mapSettingsModal.style.display = 'none';
    });
}

if (DOM.mapSettingsApplyBtn && DOM.mapSettingsModal) {
    DOM.mapSettingsApplyBtn.addEventListener('click', () => {
        const newName = DOM.mapSettingsNameInput.value.trim() || "Untitled Map";
        const newW = parseFloat(DOM.mapSettingsWidthInput.value) || 360;
        const newH = parseFloat(DOM.mapSettingsHeightInput.value) || 180;
        const newMissilesEnabled = !!DOM.mapSettingsMissilesCheckbox.checked;

        const sizeChanged = (newW !== GS.worldWidthDeg) || (newH !== GS.worldHeightDeg);

        GS.mapName = newName;
        GS.missilesEnabled = newMissilesEnabled;

        // If size changed, apply bounds and force Simplified mode if not already there
        if (sizeChanged) {
            const currentImagery = DOM.imagerySelect ? DOM.imagerySelect.value : (getCookie('mw_imagery') || 'arcgis');
            const allowSwitch = currentImagery !== 'wargames';
            applyWorldBounds(newW, newH, allowSwitch);
        } else {
            // Still enforce bounding box if it was never set
            applyWorldBounds(newW, newH, false);
        }

        // Sync missiles toggle with simulation-level bombsDisabled and checkboxes
        if (DOM.disableBombsCheckbox) {
            DOM.disableBombsCheckbox.checked = !GS.missilesEnabled;
        }
        GS.bombsDisabled = (DOM.disableBombsCheckbox && DOM.disableBombsCheckbox.checked) || !GS.missilesEnabled;

        DOM.mapSettingsModal.style.display = 'none';
        DOM.statusText.innerText = `MAP SETTINGS UPDATED: ${GS.mapName}`;
        GS.influenceLayer.render();
    });
}

/**
 * Editor tools paging: split the crowded toolbox into two pages.
 * Page 1: scenario-level tools; Page 2: country library / ZIP tools.
 */



if (DOM.editorToolsPage1Btn) {
    DOM.editorToolsPage1Btn.addEventListener('click', () => updateEditorToolPage(1));
}
if (DOM.editorToolsPage2Btn) {
    DOM.editorToolsPage2Btn.addEventListener('click', () => updateEditorToolPage(2));
}
if (DOM.editorToolsPage3Btn) {
    DOM.editorToolsPage3Btn.addEventListener('click', () => updateEditorToolPage(3));
}
if (DOM.editorToolsPage4Btn) {
    DOM.editorToolsPage4Btn.addEventListener('click', () => updateEditorToolPage(4));
}
if (DOM.editorToolsPage5Btn) {
    DOM.editorToolsPage5Btn.addEventListener('click', () => updateEditorToolPage(5));
}

DOM.editorTestBtn.addEventListener('click', () => {
    if (GS.countryMetadata.length < 2) {
        alert("You need at least 2 nations to test a conflict.");
        return;
    }
    GS.gameMode = 'EDITOR_TEST';
    GS.gameState = 'SELECTING_P1';
    DOM.statusText.innerText = "Test: Select First Country";
    DOM.editorToolbox.style.display = 'none';
    DOM.setupPanel.style.display = 'block';
    DOM.setupOptions.style.display = 'none';
    DOM.resetBtn.style.display = 'block';
    
    // Clear selections
    GS.attackers = [];
    GS.defenders = [];
    GS.teamAId = -1;
    
    updateSidesUI();
    GS.influenceLayer.render();
});


DOM.editorSaveBtn.addEventListener('click', () => {
    const presetName = prompt("Enter a name for this preset:", "My Custom Scenario");
    if (!presetName) return;

    const saveData = generatePresetData(presetName);
    const blob = new Blob([JSON.stringify(saveData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${presetName.replace(/\s+/g, '_')}_preset.json`;
    a.click();
    URL.revokeObjectURL(url);
});



DOM.editorLoadBtn.addEventListener('click', () => {
    initAudio();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        GS.currentScenarioContext = null;
        setLoadingThematic(true);
        performPresetLoad(e.target.files[0], 'EDITOR');
    };
    input.click();
});

DOM.editorHubBtn.addEventListener('click', () => {
    openHub('scenarios');
});

DOM.editorLibraryBtn.addEventListener('click', () => {
    openHub('countries');
});

document.getElementById('editor-save-country-btn').addEventListener('click', () => {
    if (GS.editingCountryId <= 0) return;
    saveCountryLocally(GS.editingCountryId);
});

document.getElementById('editor-load-country-btn').addEventListener('click', () => {
    loadCountryFromPC();
});

if (DOM.editorSaveMultiBtn) {
    DOM.editorSaveMultiBtn.addEventListener('click', async () => {
        if (GS.selectedCountryIds.size === 0) {
            alert("Ctrl+click countries on the map to select them, then use this button to export a ZIP.");
            return;
        }

        const ids = Array.from(GS.selectedCountryIds);
        const zip = new JSZip();

        // Ensure each selected country has up-to-date savedCells and metadata
        ids.forEach((id) => {
            const meta = GS.countryMetadata.find(m => m && m.id === id);
            if (!meta) return;

            // Build or refresh savedCells snapshot
            const cells = [];
            for (let i = 0; i < GS.worldControlMap.length; i++) {
                if (GS.worldControlMap[i] === id) {
                    const y = Math.floor(i / GS.gridWidth);
                    const x = i % GS.gridWidth;
                    cells.push([x, y]);
                }
            }
            meta.savedCells = cells;

            const countryData = {
                id: meta.id,
                name: meta.name,
                color: meta.color,
                flagUrl: meta.flagUrl,
                isCustom: meta.isCustom || false,
                role: meta.role || 'OFFENSE',
                overlordId: meta.overlordId || null
            };

            const presetData = {
                name: `${meta.name}_country`,
                metadata: countryData,
                cells: cells,
                gridRes: CONFIG.GRID_RES,
                version: "1.0"
            };

            const safeName = (meta.name || `country_${id}`).replace(/[^\w\-]+/g, '_');
            zip.file(`${safeName}.json`, JSON.stringify(presetData, null, 2));
        });

        try {
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'selected_countries.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            DOM.statusText.innerText = `Exported ${ids.length} countr${ids.length === 1 ? 'y' : 'ies'} to selected_countries.zip`;
        } catch (err) {
            console.error("ZIP export failed:", err);
            alert("Failed to generate ZIP. Check console for details.");
        }
    });
}

/**
 * Save all countries with any territory in the scenario into a ZIP of per‑country JSONs.
 */
if (DOM.editorSaveAllZipBtn) {
    DOM.editorSaveAllZipBtn.addEventListener('click', async () => {
        if (!GS.countryMetadata || !GS.worldControlMap) {
            alert("No map is loaded yet.");
            return;
        }

        const zip = new JSZip();

        // Build a quick presence map (which ids actually have tiles)
        const hasTiles = new Set();
        for (let i = 0; i < GS.worldControlMap.length; i++) {
            const id = GS.worldControlMap[i];
            if (id > 0) hasTiles.add(id);
        }

        const candidates = GS.countryMetadata.filter(m => m && m.id && hasTiles.has(m.id));
        if (candidates.length === 0) {
            alert("No countries with territory to export.");
            return;
        }

        candidates.forEach(meta => {
            const cells = [];
            for (let i = 0; i < GS.worldControlMap.length; i++) {
                if (GS.worldControlMap[i] === meta.id) {
                    const y = Math.floor(i / GS.gridWidth);
                    const x = i % GS.gridWidth;
                    cells.push([x, y]);
                }
            }

            const countryData = {
                id: meta.id,
                name: meta.name,
                color: meta.color,
                flagUrl: meta.flagUrl,
                isCustom: meta.isCustom || false,
                role: meta.role || 'OFFENSE',
                overlordId: meta.overlordId || null
            };

            const presetData = {
                name: `${meta.name}_country`,
                metadata: countryData,
                cells: cells,
                gridRes: CONFIG.GRID_RES,
                version: "1.0"
            };

            const safeName = (meta.name || `country_${meta.id}`).replace(/[^\w\-]+/g, '_');
            zip.file(`${safeName}.json`, JSON.stringify(presetData, null, 2));
        });

        try {
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'all_countries.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            DOM.statusText.innerText = `Exported ${candidates.length} countries to all_countries.zip`;
        } catch (err) {
            console.error("ZIP export (all countries) failed:", err);
            alert("Failed to generate ZIP for all countries. Check console for details.");
        }
    });
}

/**
 * Load multiple country JSON files from a ZIP and merge them into the current scenario.
 */


// -------- Overlay Tools Implementation --------

document.getElementById('custom-sat-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    loadingStatus.innerText = "Uploading Background Overlay...";
    DOM.loadingOverlay.style.display = 'flex';
    try {
        const url = await websim.upload(file);
        GS.customSatelliteUrl = url;
        GS.customSatelliteImg = new Image();
        GS.customSatelliteImg.crossOrigin = "anonymous";
        GS.customSatelliteImg.onload = () => {
            DOM.loadingOverlay.style.display = 'none';
            GS.influenceLayer.render();
        };
        GS.customSatelliteImg.src = url;
    } catch (err) {
        console.error(err);
        DOM.loadingOverlay.style.display = 'none';
    }
});

document.getElementById('clear-sat-btn')?.addEventListener('click', () => {
    GS.customSatelliteUrl = null;
    GS.customSatelliteImg = null;
    GS.influenceLayer.render();
});

document.getElementById('ref-image-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    loadingStatus.innerText = "Processing Reference Image...";
    DOM.loadingOverlay.style.display = 'flex';
    try {
        const url = await websim.upload(file);
        GS.referenceImageUrl = url;
        if (GS.referenceOverlay) map.removeLayer(GS.referenceOverlay);
        
        // Load image to get natural dimensions for aspect ratio preservation
        const img = new Image();
        img.onload = () => {
            const aspect = img.width / img.height;
            const center = map.getCenter();
            const h = 20 * GS.refScale;
            const w = h * aspect;
            const bounds = [[center.lat - h, center.lng - w], [center.lat + h, center.lng + w]];
            
            GS.referenceOverlay = L.imageOverlay(url, bounds, { 
                opacity: GS.refOpacity, 
                interactive: false,
                pane: 'refImagePane' 
            }).addTo(map);
            updateRefHandles();
            DOM.loadingOverlay.style.display = 'none';
        };
        img.src = url;
    } catch (err) {
        console.error(err);
        DOM.loadingOverlay.style.display = 'none';
    }
});

document.getElementById('ref-opacity-slider')?.addEventListener('input', (e) => {
    GS.refOpacity = parseFloat(e.target.value);
    if (GS.referenceOverlay) GS.referenceOverlay.setOpacity(GS.refOpacity);
    if (GS.influenceLayer) {
        GS.influenceLayer._forceRender = true;
        GS.influenceLayer.render();
    }
});

if (DOM.refAboveCheckbox) {
    // Initialize checkbox from current state when opening editor
    DOM.refAboveCheckbox.checked = !!GS.refAboveTerrain;
    DOM.refAboveCheckbox.addEventListener('change', (e) => {
        GS.refAboveTerrain = !!e.target.checked;
        // No need to change Leaflet pane; we composite into the canvas.
        if (GS.influenceLayer) {
            GS.influenceLayer._forceRender = true;
            GS.influenceLayer.render();
        }
    });
}

document.getElementById('ref-scale-slider')?.addEventListener('input', (e) => {
    GS.refScale = parseFloat(e.target.value);
    if (GS.referenceOverlay && GS.referenceImageUrl) {
        const center = GS.referenceOverlay.getBounds().getCenter();
        const w = 40 * GS.refScale;
        const h = 25 * GS.refScale;
        const newBounds = [[center.lat - h, center.lng - w], [center.lat + h, center.lng + w]];
        GS.referenceOverlay.setBounds(newBounds);
        updateRefHandles();
    }
});

document.getElementById('clear-ref-btn')?.addEventListener('click', () => {
    if (GS.referenceOverlay) map.removeLayer(GS.referenceOverlay);
    GS.referenceOverlay = null;
    GS.referenceImageUrl = null;
    clearRefHandles();
});

document.getElementById('editor-download-map-btn')?.addEventListener('click', () => {
    if (!GS.worldControlMap || !GS.landMask) return;
    
    DOM.statusText.innerText = "GENERATING GLOBAL MAP EXPORT...";
    
    // GLOBAL EXPORT SYSTEM: Produces a 1:1 Plate Carree projection of the world grid.
    // This allows the resulting PNG to be re-imported as a Custom Satellite background
    // that aligns perfectly with the engine's geographical coordinate system.
    const canvas = document.createElement('canvas');
    canvas.width = GS.gridWidth;
    canvas.height = GS.gridHeight;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(GS.gridWidth, GS.gridHeight);
    const data = imgData.data;

    for (let i = 0; i < GS.worldControlMap.length; i++) {
        const sid = GS.worldControlMap[i];
        const lm = GS.landMask[i];
        
        // Base Palette (Matches 'wargames' mode)
        let r = 5, g = 52, b = 72; // Deep Ocean Blue
        
        if (lm > 0) {
            // Country colors are excluded from the terrain layout export for a cleaner reference image
            r = 20; g = 38; b = 20; // Dark Military Green (Neutral Land)
        }

        // Project grid cell index to image pixel coordinates (Flipping Y axis)
        const gx = i % GS.gridWidth;
        const gy = Math.floor(i / GS.gridWidth);
        const ty = (GS.gridHeight - 1 - gy);
        const pixelIdx = (ty * GS.gridWidth + gx) * 4;
        
        data[pixelIdx] = r;
        data[pixelIdx + 1] = g;
        data[pixelIdx + 2] = b;
        data[pixelIdx + 3] = 255;
    }
    
    ctx.putImageData(imgData, 0, 0);
    
    try {
        const link = document.createElement('a');
        const timestamp = new Date().getTime();
        link.download = `modern_wars_world_layout_${timestamp}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        DOM.statusText.innerText = "GLOBAL MAP EXPORTED";
    } catch (e) {
        console.error("Export failed:", e);
        alert("SATELLITE ERROR: Could not generate export file.");
    }
});

/**
 * Procedurally populates all land cells on the map with a specified number of random nations.
 * Uses an interleaved BFS expansion to ensure organic, relatively balanced territory sizes.
 */

// -------- Import Country From Scenario (editor / godmode) --------





if (DOM.editorImportCountryBtn) {
    DOM.editorImportCountryBtn.addEventListener('click', () => {
        openImportCountryModal();
    });
}

if (DOM.importCountryCancelBtn) {
    DOM.importCountryCancelBtn.addEventListener('click', () => {
        DOM.importCountryModal.style.display = 'none';
    });
}

if (DOM.importScenarioSelect) {
    DOM.importScenarioSelect.addEventListener('change', async (e) => {
        const val = e.target.value;
        GS.lastImportScenarioKey = val || null;
        GS.importScenarioBuffer = null;
        GS.selectedImportCountryId = null;
        if (DOM.importCountrySearch) {
            DOM.importCountrySearch.value = '';
            DOM.importCountrySearch.disabled = true;
        }
        if (DOM.importCountryCardList) {
            DOM.importCountryCardList.innerHTML = `
                <div style="font-size:11px; color:#777; text-align:center; padding:10px;">
                    Loading…
                </div>
            `;
        }

        if (val === 'file') {
            if (DOM.importScenarioFileInput) {
                DOM.importScenarioFileInput.style.display = 'block';
                DOM.importScenarioFileInput.click();
            }
            return;
        } else {
            if (DOM.importScenarioFileInput) DOM.importScenarioFileInput.style.display = 'none';
        }

        // Map built‑in keys to local preset JSONs
        const keyToUrl = {
            'builtin:modern_2022': 'data/world map 2022.json',
            'builtin:ww2_1936': 'data/WW2 Peru Update.json',
            'builtin:ww2_1942': 'data/1942.json',
            'builtin:ww1_1914': 'data/world_war_1__1914_.json',
            'builtin:coldwar_1974': 'data/better_cold_war_preset.json',
            'builtin:england_states': 'data/England_states_preset.json'
        };
        const url = keyToUrl[val];
        if (!url) {
            DOM.importScenarioSelect.innerHTML = '<option value="">Unknown source selection</option>';
            DOM.importScenarioSelect.disabled = true;
            return;
        }
        await loadScenarioForCountryImportFromUrl(url);
    });
}

if (DOM.importScenarioFileInput) {
    DOM.importScenarioFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        // Remember that we're using a file source so the select can reflect it
        GS.lastImportScenarioKey = 'file';
        await loadScenarioForCountryImportFromBlob(file);
    });
}

if (DOM.importCountryConfirmBtn) {
    DOM.importCountryConfirmBtn.addEventListener('click', () => {
        if (!GS.importScenarioBuffer) {
            alert("Choose a source scenario first.");
            return;
        }
        const cid = GS.selectedImportCountryId || 0;
        if (!cid) {
            alert("Choose a country to import.");
            return;
        }
        importSingleCountryFromScenario(GS.importScenarioBuffer, cid);
        DOM.importCountryModal.style.display = 'none';
    });
}

if (DOM.editorLoadZipBtn) {
    DOM.editorLoadZipBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            loadingStatus.innerText = "Importing countries from ZIP...";
            DOM.loadingOverlay.style.display = 'flex';

            try {
                const zip = await JSZip.loadAsync(file);
                const files = Object.values(zip.files).filter(f => !f.dir && f.name.toLowerCase().endsWith('.json'));
                if (files.length === 0) {
                    alert("ZIP file does not contain any .json country files.");
                    DOM.loadingOverlay.style.display = 'none';
                    return;
                }

                // Find current max id so we can assign new, non‑conflicting IDs
                let maxId = GS.countryMetadata.reduce((m, c) => c && c.id ? Math.max(m, c.id) : m, 0);

                for (const zf of files) {
                    try {
                        const text = await zf.async('text');
                        const data = JSON.parse(text);

                        if (!data.metadata || !data.cells) continue;

                        maxId += 1;
                        const newId = maxId;

                        const sourceRes = data.gridRes || CONFIG.GRID_RES;
                        const meta = {
                            id: newId,
                            name: data.metadata.name || "Imported Nation",
                            color: data.metadata.color || 'rgba(150,150,150,0.5)',
                            rgba: parseColorToRGBA(data.metadata.color || 'rgba(150,150,150,0.5)'),
                            isCustom: true,
                            flagUrl: data.metadata.flagUrl || null,
                            role: data.metadata.role || 'OFFENSE',
                            overlordId: data.metadata.overlordId || null,
                            bounds: { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
                        };

                        if (meta.flagUrl) {
                            meta.tempFlag = new Image();
                            meta.tempFlag.crossOrigin = "anonymous";
                            meta.tempFlag.src = meta.flagUrl;
                        }

                        GS.countryMetadata[newId - 1] = meta;

                        // Map cells to current grid
                        const currentRes = CONFIG.GRID_RES;
                        data.cells.forEach(([sx, sy]) => {
                            if (sourceRes === currentRes) {
                                const idx = sy * GS.gridWidth + sx;
                                if (idx < GS.worldControlMap.length && GS.landMask[idx] > 0) {
                                    GS.worldControlMap[idx] = newId;
                                    meta.bounds.minX = Math.min(meta.bounds.minX, sx);
                                    meta.bounds.maxX = Math.max(meta.bounds.maxX, sx);
                                    meta.bounds.minY = Math.min(meta.bounds.minY, sy);
                                    meta.bounds.maxY = Math.max(meta.bounds.maxY, sy);
                                }
                            } else {
                                const baseLat = (sy * sourceRes) - 90;
                                const baseLng = (sx * sourceRes) - 180;
                                const tIdx = getGridIndex(baseLat + sourceRes / 2, baseLng + sourceRes / 2);
                                if (tIdx !== -1 && GS.landMask[tIdx] > 0) {
                                    const tx = Math.floor((baseLng + sourceRes / 2 + 180) / currentRes);
                                    const ty = Math.floor((baseLat + sourceRes / 2 + 90) / currentRes);
                                    GS.worldControlMap[tIdx] = newId;
                                    meta.bounds.minX = Math.min(meta.bounds.minX, tx);
                                    meta.bounds.maxX = Math.max(meta.bounds.maxX, tx);
                                    meta.bounds.minY = Math.min(meta.bounds.minY, ty);
                                    meta.bounds.maxY = Math.max(meta.bounds.maxY, ty);
                                }
                            }
                        });
                    } catch (innerErr) {
                        console.warn("Failed to import one country from ZIP:", innerErr);
                    }
                }

                recalculateAllBounds();
                DOM.loadingOverlay.style.display = 'none';
                GS.influenceLayer.render();
                DOM.statusText.innerText = "Imported countries from ZIP.";
            } catch (err) {
                console.error("ZIP import failed:", err);
                alert("Failed to import ZIP of countries.");
                DOM.loadingOverlay.style.display = 'none';
            }
        };
        input.click();
    });
}

DOM.editorFlagLibraryBtn.addEventListener('click', () => {
    openHub('flags');
});

// City tools buttons
if (DOM.editorCityNewBtn) {
    DOM.editorCityNewBtn.addEventListener('click', () => {
        if (!(GS.gameMode === 'EDITOR' || GS.godModeActive)) return;
        GS.cityEditMode = 'CREATE';
        DOM.statusText.innerText = "City Tools: click on the map to create a new city.";
        DOM.cityInspector.style.display = 'none';
    });
}

if (DOM.editorCityClearBtn) {
    DOM.editorCityClearBtn.addEventListener('click', () => {
        if (!(GS.gameMode === 'EDITOR' || GS.godModeActive)) return;
        
        // Robust multi-stage verification for critical deletion
        const verify1 = confirm("SATELLITE WARNING: You are about to clear ALL cities from this scenario. This action is permanent. Proceed?");
        if (!verify1) return;
        
        const verify2 = confirm("FINAL CONFIRMATION: Are you absolutely sure you want to remove all urban centers?");
        if (!verify2) return;

        GS.cities = [];
        GS.activeTheaterCities = [];
        GS.editingCityId = -1;
        DOM.cityInspector.style.display = 'none';
        GS.influenceLayer.render();
        DOM.statusText.innerText = "CITIDEL WIPE COMPLETE: All urban centers removed.";
        playClickSound();
    });
}

DOM.menuHubBtn.addEventListener('click', () => {
    openHub('scenarios');
});

if (DOM.globalChatBtn) {
    DOM.globalChatBtn.addEventListener('click', () => {
        openGlobalChat();
    });
}

DOM.discordBtn.addEventListener('click', () => {
    window.open('https://discord.gg/R9rYX2ScXe', '_blank');
});

if (DOM.downloadBtn) {
    DOM.downloadBtn.addEventListener('click', () => {
        window.open('https://store.steampowered.com/app/4610980/Modern_Wars', '_blank');
    });
}


DOM.donateBtn.addEventListener('click', () => {
    window.open('https://ko-fi.com/man_82', '_blank');
});

DOM.creditsBtn.addEventListener('click', () => {
    DOM.creditsModal.style.display = 'flex';
});

DOM.closeCreditsBtn.addEventListener('click', () => {
    DOM.creditsModal.style.display = 'none';
});

if (DOM.leaderboardBtn) {
    DOM.leaderboardBtn.addEventListener('click', () => {
        openLeaderboard();
    });
}

if (DOM.closeLeaderboardBtn) {
    DOM.closeLeaderboardBtn.addEventListener('click', () => {
        DOM.leaderboardOverlay.style.display = 'none';
    });
}

DOM.closeHubBtn.addEventListener('click', () => {
    closeHub();
});

// -------- Item details + comments modal logic --------



// -------- Global Chat Logic --------



if (DOM.globalChatClose) {
    DOM.globalChatClose.addEventListener('click', () => {
        DOM.globalChatModal.style.display = 'none';
    });
}

if (DOM.globalChatSend) {
    DOM.globalChatSend.addEventListener('click', async () => {
        if (!GS.room || !DOM.globalChatInput) return;
        const text = DOM.globalChatInput.value.trim();
        if (!text) return;
        try {
            await GS.room.collection('global_chat_v1').create({
                text
            });
            DOM.globalChatInput.value = '';
        } catch (e) {
            console.error('Failed to send chat message', e);
        }
    });
}

if (DOM.globalChatInput) {
    DOM.globalChatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (DOM.globalChatSend) DOM.globalChatSend.click();
        }
    });
}

DOM.itemCommentSubmit.addEventListener('click', async () => {
    if (!GS.currentCommentItemType || !GS.currentCommentItemId) return;
    const text = DOM.itemCommentInput.value.trim();
    if (!text) return;
    try {
        if (GS.currentEditingCommentId) {
            // Edit existing comment
            await GS.room.collection('hub_comment_v1').update(GS.currentEditingCommentId, {
                text
            });
        } else {
            // New comment or reply
            await GS.room.collection('hub_comment_v1').create({
                item_type: GS.currentCommentItemType,
                item_id: GS.currentCommentItemId,
                parent_id: GS.currentReplyParentId || null,
                text,
            });
        }
        DOM.itemCommentInput.value = '';
        GS.currentReplyParentId = null;
        GS.currentEditingCommentId = null;
        DOM.itemReplyIndicator.style.display = 'none';
        DOM.itemCancelReplyBtn.style.display = 'none';
        DOM.itemCommentSubmit.textContent = 'Post';
    } catch (e) {
        console.error('Failed to post comment', e);
        alert('Failed to post comment. Try again.');
    }
});

DOM.itemCancelReplyBtn.addEventListener('click', () => {
    GS.currentReplyParentId = null;
    GS.currentEditingCommentId = null;
    DOM.itemReplyIndicator.style.display = 'none';
    DOM.itemCancelReplyBtn.style.display = 'none';
    DOM.itemCommentSubmit.textContent = 'Post';
});

DOM.closeItemModalBtn.addEventListener('click', () => {
    DOM.itemCommentModal.style.display = 'none';
    if (GS.commentsUnsubscribe) {
        GS.commentsUnsubscribe();
        GS.commentsUnsubscribe = null;
    }
});

DOM.editorShareBtn.addEventListener('click', () => {
    if (GS.countryMetadata.length < 2) {
        alert("Your map must have at least 2 nations to be playable.");
        return;
    }
    DOM.uploadNameInput.value = "";
    DOM.uploadDescInput.value = "";
    DOM.uploadDetailsModal.style.display = 'flex';
});

DOM.cancelUploadBtn.addEventListener('click', () => {
    DOM.uploadDetailsModal.style.display = 'none';
});

DOM.confirmUploadBtn.addEventListener('click', async () => {
    const name = DOM.uploadNameInput.value.trim() || "Untitled Scenario";
    const desc = DOM.uploadDescInput.value.trim();
    
    DOM.uploadDetailsModal.style.display = 'none';
    loadingStatus.innerText = "Uploading Scenario...";
    DOM.loadingOverlay.style.display = 'flex';

    try {
        // 1. Generate Preview Snapshot
        let previewUrl = null;
        if (GS.influenceLayer && GS.influenceLayer._container) {
            GS.influenceLayer._isCapturing = true;
            GS.influenceLayer.render();
            const canvas = GS.influenceLayer._container;
            const previewBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
            GS.influenceLayer._isCapturing = false;
            GS.influenceLayer.render();
            if (previewBlob) {
                const previewFile = new File([previewBlob], "preview.jpg", { type: "image/jpeg" });
                previewUrl = await websim.upload(previewFile);
            }
        }

        // 2. Generate and Upload JSON
        const saveData = generatePresetData(name);
        const blob = new Blob([JSON.stringify(saveData)], { type: 'application/json' });
        const file = new File([blob], "scenario.json", { type: "application/json" });
        const blobUrl = await websim.upload(file);

        // Determine if this is a remix
        const currentUser = await window.websim.getCurrentUser();
        let remixedFromId = null;
        let remixedFromName = null;

        // If current scenario context exists, it's a remix
        if (GS.currentScenarioContext) {
            remixedFromId = GS.currentScenarioContext.id;
            remixedFromName = GS.currentScenarioContext.name;
        }

        // 3. Create Persistent Record
        await GS.room.collection('scenario_v1').create({
            name: name,
            description: desc,
            previewUrl: previewUrl,
            blobUrl: blobUrl,
            remixed_from_id: remixedFromId,
            remixed_from_name: remixedFromName
        });

        DOM.loadingOverlay.style.display = 'none';
        alert("Scenario uploaded successfully to the hub!");
    } catch (e) {
        console.error(e);
        alert("Failed to upload scenario.");
        DOM.loadingOverlay.style.display = 'none';
    }
});

DOM.menuLoadPlayBtn.addEventListener('click', () => {
    initAudio();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        GS.currentScenarioContext = null;
        setLoadingThematic(true);
        performPresetLoad(e.target.files[0], 'CONQUEST');
    };
    input.click();
});

DOM.editorModeBtn.addEventListener('click', () => {
    DOM.editorChoiceModal.style.display = 'flex';
});

DOM.cancelEditorChoice.onclick = () => {
    DOM.editorChoiceModal.style.display = 'none';
};

DOM.choiceExternalEditor.onclick = () => {
    window.open('https://websim.com/@thepineguy/modern-wars-alternative-editor', '_blank');
    DOM.editorChoiceModal.style.display = 'none';
};

DOM.choiceIngameEditor.onclick = () => {
    DOM.editorChoiceModal.style.display = 'none';
    DOM.editorSourceModal.style.display = 'flex';
};

DOM.cancelSourceChoice.onclick = () => {
    DOM.editorSourceModal.style.display = 'none';
    DOM.editorChoiceModal.style.display = 'flex';
};

DOM.choiceSourceEarth.onclick = () => {
    GS.isCustomTerrain = false;
    DOM.editorSourceModal.style.display = 'none';
    initAudio();
    GS.gameMode = 'EDITOR';
    GS.gameState = 'EDITOR_ACTIVE';
    GS.currentScenarioContext = null;
    GS.activeScenarioId = null;
    DOM.editorUpdateBtn.style.display = 'none';
    DOM.mainMenu.style.display = 'none';
    DOM.mapUi.style.display = 'flex';
    DOM.editorToolbox.style.display = 'flex';
    
    // Ensure grid is ready
    if (!GS.worldControlMap) {
        GS.gridWidth = Math.ceil(360 / CONFIG.GRID_RES);
        GS.gridHeight = Math.ceil(180 / CONFIG.GRID_RES);
        GS.worldControlMap = new Int32Array(GS.gridWidth * GS.gridHeight);
        GS.deJureMap = new Int32Array(GS.gridWidth * GS.gridHeight);
        GS.provinceMap = new Int32Array(GS.gridWidth * GS.gridHeight);
        GS.occupationMap = new Float32Array(GS.gridWidth * GS.gridHeight);
        GS.primaryOccupierMap = new Int32Array(GS.gridWidth * GS.gridHeight);
        GS.landMask = new Uint8Array(GS.gridWidth * GS.gridHeight);
        GS.terrainMask = new Float32Array(GS.gridWidth * GS.gridHeight);
        GS.flagProcessedBuffer = new Int32Array(GS.gridWidth * GS.gridHeight);
    }

    loadCities();
    DOM.statusText.innerText = "Map Editor (Alpha)";
    DOM.setupPanel.style.display = 'none';
    DOM.resetBtn.style.display = 'block';
    DOM.editorUnclaimBtn.style.display = 'block';
    
    // Load real‑earth geography without establishing countries
    const mapRes = document.getElementById('map-res-select').value;
    const geoUrl = `${CONFIG.GEOJSON_BASE}${mapRes}/cultural/ne_${mapRes}_admin_0_countries.json`;
    loadCountries(geoUrl, true);

    if (getCookie('mw_editor_tutorial_finished') !== 'true') {
        startTutorial(editorTutorialSteps, 'mw_editor_tutorial_finished');
    }

    updateRestartVisibility();
};

DOM.choiceSourceBlank.onclick = () => {
    document.getElementById('blank-size-modal').style.display = 'flex';
};

document.getElementById('cancel-blank-size-btn').onclick = () => {
    document.getElementById('blank-size-modal').style.display = 'none';
};

document.getElementById('confirm-blank-size-btn').onclick = () => {
    const w = parseFloat(document.getElementById('blank-width-input').value) || 360;
    const h = parseFloat(document.getElementById('blank-height-input').value) || 180;
    
    document.getElementById('blank-size-modal').style.display = 'none';
    GS.isCustomTerrain = true;
    DOM.editorSourceModal.style.display = 'none';
    initAudio();
    GS.gameMode = 'EDITOR';
    GS.gameState = 'EDITOR_ACTIVE';
    GS.currentScenarioContext = null;
    GS.activeScenarioId = null;
    DOM.editorUpdateBtn.style.display = 'none';
    DOM.mainMenu.style.display = 'none';
    DOM.mapUi.style.display = 'flex';
    DOM.editorToolbox.style.display = 'flex';
    
    // Ensure grid is ready
    if (!GS.worldControlMap) {
        initializeEngine();
    }

    // Initialize Blank Canvas State
    GS.worldControlMap.fill(0);
    GS.deJureMap.fill(0);
    GS.landMask.fill(0);
    GS.provinceMap.fill(0);
    GS.terrainMask.fill(0);
    GS.cities = [];
    GS.activeTheaterCities = [];
    GS.countryMetadata = [];
    
    // Custom World Size Logic:
    // If w or h are smaller than full world, we restrict the view and paintable area
    if (w < 360 || h < 180) {
        const halfW = w / 2;
        const halfH = h / 2;
        const bounds = [[-halfH, -halfW], [halfH, halfW]];
        map.setMaxBounds(bounds);
        map.fitBounds(bounds);
        
        // Block painting outside these bounds by keeping landMask at 0 (Ocean) for those cells
        // Note: The paintAt logic already checks landMask[idx] > 0 for country painting.
        // We'll also update terrain brush to respect these bounds if we really wanted to be strict.
    } else {
        map.setMaxBounds(null);
    }

    // Switch to Simplified View for better "blank canvas" painting feel (temporarily)
    setImageryProvider('wargames', false);
    if (DOM.disableCountryGradientCheckbox) {
        DOM.disableCountryGradientCheckbox.checked = true;
        GS.disableCountryGradient = true;
    }

    DOM.statusText.innerText = "Blank Canvas: Draw Terrain";
    DOM.setupPanel.style.display = 'none';
    DOM.resetBtn.style.display = 'block';
    
    // Instantly jump to Page 3 tools so they see the terrain brush
    updateEditorToolPage(3);
    
    GS.influenceLayer.render();
    updateRestartVisibility();
};

DOM.minimizeSetupBtn.onclick = (e) => {
    e.stopPropagation();
    const isMinimized = DOM.setupPanel.classList.toggle('minimized');
    DOM.minimizeSetupBtn.innerText = isMinimized ? '+' : '−';
};

DOM.minimizeStatsBtn.onclick = (e) => {
    e.stopPropagation();
    const isMinimized = DOM.statsPanel.classList.toggle('minimized');
    DOM.minimizeStatsBtn.innerText = isMinimized ? '+' : '−';
};

DOM.minimizeStatusBtn.onclick = (e) => {
    e.stopPropagation();
    const isMinimized = document.getElementById('game-status').classList.toggle('minimized');
    DOM.minimizeStatusBtn.innerText = isMinimized ? '+' : '−';
};

// Keep simulation running when tab is not focused (background ticking)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Stop visual loop and start a lightweight background tick loop
        if (GS.animationFrameId !== null) {
            cancelAnimationFrame(GS.animationFrameId);
            GS.animationFrameId = null;
        }
        if (!GS.backgroundTickId && GS.gameState === 'SIMULATING') {
            GS.backgroundTickId = setInterval(() => {
                if (GS.gameState !== 'SIMULATING') return;
                // Advance simulation based on simSpeed, but skip rendering/UI-heavy work
                GS.frameAccumulator += GS.simSpeed;
                while (GS.frameAccumulator >= 1) {
                    const warEnded = performSimulationTick();
                    if (warEnded) {
                        GS.frameAccumulator = 0;
                        break;
                    }
                    GS.frameAccumulator -= 1;
                }
                // Advance in-game date based on background tick interval
                tickGameTime(100);
                GS.simFrameCount++;
            }, 100); // ~10 ticks per second while unfocused
        }
    } else {
        // Back to foreground: stop background loop and resume visual loop
        if (GS.backgroundTickId) {
            clearInterval(GS.backgroundTickId);
            GS.backgroundTickId = null;
        }
        if (GS.gameState === 'SIMULATING') {
            if (GS.animationFrameId !== null) {
                cancelAnimationFrame(GS.animationFrameId);
            }
            GS.animationFrameId = requestAnimationFrame(updateLoop);
        }
    }
});

