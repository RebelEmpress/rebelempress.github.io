// Engine module extracted from main.js — flags
import { BUFF_STATES } from './config.js';
import { FLAG_CDN_MAPPING } from './flag-data.js';
import { GS } from './state.js';
import * as DOM from './dom.js';
import { map } from './main.js';
import { updateSidesUI } from './sides-ui.js';

export function updateCountryFlag(countryId, url) {
    if (countryId <= 0 || !url) return;
    
    const meta = GS.countryMetadata.find(m => m && m.id === countryId);
    if (meta) {
        meta.flagUrl = url;
        // Re-initialize image object to ensure the source change is picked up by the renderer
        meta.tempFlag = new Image();
        meta.tempFlag.crossOrigin = "anonymous";
        meta.tempFlag.onload = () => GS.influenceLayer.render();
        meta.tempFlag.src = url;
    }

    // Propagate to live simulation/setup objects (units use these references)
    GS.sides.flat().forEach(c => {
        if (c && c.id === countryId) {
            c.flag = new Image();
            c.flag.crossOrigin = "anonymous";
            c.flag.onload = () => GS.influenceLayer.render();
            c.flag.src = url;
        }
    });

    // Update Inspector UI if currently viewing this country
    if (GS.editingCountryId === countryId && DOM.countryInspector.style.display !== 'none') {
        DOM.inspectFlagPreview.src = url;
        DOM.inspectFlagPreview.style.display = 'block';
    }

    updateSidesUI();
    GS.influenceLayer.render();
}

export function ensureFlagImage(meta) {
    return new Promise((resolve) => {
        if (!meta) return resolve(null);

        // If we already have a canvas or image ready, use it
        if (meta.tempFlag && (meta.tempFlag.complete === undefined || meta.tempFlag.complete)) {
            return resolve(meta.tempFlag);
        }

        if (!meta.flagUrl) return resolve(null);

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            meta.tempFlag = img;
            resolve(img);
        };
        img.onerror = () => resolve(null);
        img.src = meta.flagUrl;
    });
}

export async function generatePuppetFlag(puppetId, overlordId) {
    if (!puppetId || !overlordId) return;
    const puppetMeta = GS.countryMetadata.find(m => m && m.id === puppetId);
    const overlordMeta = GS.countryMetadata.find(m => m && m.id === overlordId);
    if (!puppetMeta || !overlordMeta) return;

    const puppetImg = await ensureFlagImage(puppetMeta);
    const overlordImg = await ensureFlagImage(overlordMeta);
    if (!puppetImg || !overlordImg) return;

    // Create composite canvas
    const width = 160;
    const height = 100;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Base background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);

    // Draw puppet flag covering the whole flag area
    ctx.drawImage(
        puppetImg,
        0, 0, puppetImg.naturalWidth || puppetImg.width, puppetImg.naturalHeight || puppetImg.height,
        0, 0, width, height
    );

    // Draw overlord flag as a canton in the top‑left corner
    const cantonWidth = Math.floor(width * 0.35);
    const cantonHeight = Math.floor(height * 0.45);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cantonWidth, cantonHeight);
    ctx.clip();

    ctx.drawImage(
        overlordImg,
        0, 0, overlordImg.naturalWidth || overlordImg.width, overlordImg.naturalHeight || overlordImg.height,
        0, 0, cantonWidth, cantonHeight
    );
    ctx.restore();

    // Border around the canton
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0.5, 0.5, cantonWidth - 1, cantonHeight - 1);

    // Slight border around whole flag
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);

    // Use the canvas as the in‑memory flag immediately so units render correctly
    puppetMeta.tempFlag = canvas;
    GS.sides.flat().forEach(c => {
        if (c && c.id === puppetId) {
            c.flag = canvas;
        }
    });

    // Export as a data:image URL so all UI elements can use it without uploading
    try {
        const dataUrl = canvas.toDataURL('image/png');
        updateCountryFlag(puppetId, dataUrl);
    } catch (e) {
        console.warn('Failed to generate data URL for puppet flag', e);
    }

    // Force a re-render so the new flag is visible on map and in UI
    if (GS.influenceLayer) GS.influenceLayer.render();
}

export function getEffectiveBuffState(countryObj, meta) {
    const visible = (countryObj && countryObj.buffState) || (meta && meta.buffState) || 'none';

    // If global invisible buffs are disabled, always use the visible buff only.
    if (!GS.invisibleBuffsEnabled) return visible;

    const hidden =
        (countryObj && countryObj.hiddenBuffState !== undefined ? countryObj.hiddenBuffState : null) ??
        (meta && meta.hiddenBuffState !== undefined ? meta.hiddenBuffState : null);
    if (hidden && hidden !== 'none') return hidden;
    return visible;
}

export function cycleBuffState(current, direction) {
    if (!BUFF_STATES.length) return 'none';
    const dir = direction === -1 ? -1 : 1;
    const idx = BUFF_STATES.indexOf(current);
    const baseIndex = idx === -1 ? 0 : idx;
    let nextIndex = (baseIndex + dir + BUFF_STATES.length) % BUFF_STATES.length;
    return BUFF_STATES[nextIndex];
}

export function getFlagUrl(code, name) {
    if (!code || code === "-99") {
        code = findCodeByName(name);
    }
    if (!code || code === "-99") return null;
    return `https://flagcdn.com/w320/${code.toLowerCase()}.png`;
}

export function findCodeByName(name) {
    if (!name) return null;
    const search = name.toLowerCase().trim();
    
    // Check comprehensive static mapping first
    for (const [code, fullName] of Object.entries(FLAG_CDN_MAPPING)) {
        if (fullName.toLowerCase() === search) return code;
    }

    // Then check dynamically fetched codes if available
    if (GS.flagCodes) {
        for (const [code, fullName] of Object.entries(GS.flagCodes)) {
            if (fullName.toLowerCase() === search) return code;
        }
    }
    
    // Also check for common aliases or shortened names
    const aliases = {
        "united states": "us",
        "united states of america": "us",
        "russia": "ru",
        "russian federation": "ru",
        "soviet union": "ru",
        "united kingdom": "gb",
        "great britain": "gb",
        "britain": "gb",
        "south korea": "kr",
        "north korea": "kp",
        "vietnam": "vn",
        "iran": "ir",
        "syria": "sy",
        "czech republic": "cz",
        "ivory coast": "ci",
        "republic of the congo": "cg",
        "democratic republic of the congo": "cd",
        "congo, republic of the": "cg",
        "congo, democratic republic of the": "cd",
        "czechia": "cz",
        "eswatini": "sz",
        "swaziland": "sz"
    };
    return aliases[search] || null;
}

export async function loadFlagCodes() {
    if (GS.flagCodes) return;
    try {
        const resp = await fetch('https://flagcdn.com/en/codes.json');
        GS.flagCodes = await resp.json();
    } catch (e) {
        console.error("Failed to load flag codes", e);
    }
}
