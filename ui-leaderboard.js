// Extracted from main.js — ui-leaderboard UI module
import L from 'leaflet';
import { getCookie } from './utils.js';
import { getTranslation } from './translations.js';
import { CONFIG } from './config.js';
import { GS } from './state.js';
import * as DOM from './dom.js';
import { map, estimateUnitsForCountry, findCodeByName, getFlagUrl } from './main.js';

export function openLeaderboard() {
    if (!DOM.leaderboardOverlay || !DOM.leaderboardList || !GS.countryMetadata || !GS.worldControlMap) return;

    // Single pass over the control map: per-country tile counts AND a bounding box
    // (min/max grid x,y) so the "go to" button can frame a nation without a second scan.
    const maxId = GS.countryMetadata.reduce((max, m) => m ? Math.max(max, m.id) : max, 0);
    const tileCounts = new Int32Array(maxId + 1);
    const minX = new Int32Array(maxId + 1).fill(2147483647);
    const minY = new Int32Array(maxId + 1).fill(2147483647);
    const maxX = new Int32Array(maxId + 1).fill(-1);
    const maxY = new Int32Array(maxId + 1).fill(-1);
    const gw = GS.gridWidth;
    let totalLand = 0;
    for (let i = 0; i < GS.worldControlMap.length; i++) {
        const id = GS.worldControlMap[i];
        if (id > 0 && id <= maxId) {
            tileCounts[id]++;
            totalLand++;
            const x = i % gw;
            const y = (i / gw) | 0;
            if (x < minX[id]) minX[id] = x;
            if (x > maxX[id]) maxX[id] = x;
            if (y < minY[id]) minY[id] = y;
            if (y > maxY[id]) maxY[id] = y;
        }
    }

    const lang = getCookie('mw_lang') || 'en';

    const rows = [];
    for (let i = 0; i < GS.countryMetadata.length; i++) {
        const meta = GS.countryMetadata[i];
        if (!meta) continue;
        const id = meta.id;
        const tiles = tileCounts[id] || 0;

        // Exclude Antarctica from the leaderboard to avoid it dominating due to map area
        const rawName = meta.name || 'Unknown';
        if (rawName === 'Antarctica') continue;

        // Size zero: still show (releasables / dead states), but mark as 0 tiles
        const estUnits = estimateUnitsForCountry ? estimateUnitsForCountry(id) : 0;

        const displayName = getTranslation(rawName, lang, 'NATIONS');
        const flagUrl = (meta.tempFlag && meta.tempFlag.src) ? meta.tempFlag.src : (meta.flagUrl || getFlagUrl(findCodeByName(meta.name), meta.name));
        rows.push({
            id,
            meta,
            name: displayName,
            rawName,
            tiles,
            estUnits,
            flagUrl,
            bounds: maxX[id] >= 0 ? { minX: minX[id], minY: minY[id], maxX: maxX[id], maxY: maxY[id] } : null
        });
    }

    // Primary sort: estimated units desc, secondary: tiles desc, tertiary: name
    rows.sort((a, b) => {
        if (b.estUnits !== a.estUnits) return b.estUnits - a.estUnits;
        if (b.tiles !== a.tiles) return b.tiles - a.tiles;
        return a.name.localeCompare(b.name);
    });

    DOM.leaderboardList.innerHTML = rows.map((row, idx) => {
        const unitsLabel = row.estUnits > 0 ? GS.influenceLayer.formatSoldiers(row.estUnits) : '—';
        const tilesLabel = row.tiles.toLocaleString();
        const rank = idx + 1;
        const flagSrc = row.flagUrl || '';
        return `
            <div class="scroller-card lb-card" data-idx="${idx}" style="padding: 0; display: block; overflow: hidden; flex-shrink: 0;">
                <div class="lb-row" style="padding: 10px; display: flex; align-items: center; gap: 10px; cursor: pointer;">
                    <div class="leaderboard-rank" style="width: 30px; font-family: 'Playfair Display'; font-size: 18px;">${rank}</div>
                    ${flagSrc ? `<img src="${flagSrc}" class="leaderboard-flag" style="width: 35px; height: 22px;">` : `<div class="leaderboard-flag" style="width: 35px; height: 22px; background:#111;"></div>`}
                    <div class="scroller-card-name" style="flex: 2; font-size: 16px; margin: 0;">${row.name}</div>
                    <div class="leaderboard-tiles" style="flex: 1; text-align: right; color: #888; font-size: 12px;">${tilesLabel}</div>
                    <div class="leaderboard-units" style="flex: 1; text-align: right; font-weight: bold; font-size: 13px;">${unitsLabel}</div>
                    <div class="lb-caret" style="width: 16px; text-align: center; color: #888; font-size: 12px;">▾</div>
                </div>
                <div class="lb-detail" style="display: none; padding: 0 12px 12px 12px;"></div>
            </div>
        `;
    }).join('');

    // Build the expanded detail panel for a row on demand.
    const buildDetail = (row) => {
        const fmt = (n) => (n > 0 ? GS.influenceLayer.formatSoldiers(n) : '—');
        const share = totalLand > 0 ? ((row.tiles / totalLand) * 100) : 0;
        const shareLabel = share >= 0.1 ? share.toFixed(1) + '%' : (row.tiles > 0 ? '<0.1%' : '—');

        // Status line: in-war side / puppet / sovereign
        let status = 'Sovereign';
        const meta = row.meta;
        if (meta && meta.overlordId) {
            const oMeta = GS.countryMetadata.find(m => m && m.id === meta.overlordId);
            status = 'Puppet of ' + (oMeta ? getTranslation(oMeta.name, lang, 'NATIONS') : 'another power');
        }
        if (GS.gameState === 'SIMULATING' && Array.isArray(GS.sides)) {
            const sideIdx = GS.sides.findIndex(s => s.some(c => c.id === row.id));
            if (sideIdx !== -1) status = 'At war — Side ' + String.fromCharCode(65 + sideIdx);
        }

        // Capital (de-jure), if this nation has one marked
        let capitalName = null;
        if (Array.isArray(GS.cities)) {
            const cap = GS.cities.find(c => c && c.isCapital && (c.ownerId || c.sovereignId) === row.id);
            if (cap && cap.name) capitalName = cap.name;
        }

        const alliesCount = Array.isArray(meta && meta.allies) ? meta.allies.length : 0;

        const stat = (label, val) => `
            <div style="flex:1; min-width:80px;">
                <div style="font-size:9px; letter-spacing:0.5px; text-transform:uppercase; color:#888;">${label}</div>
                <div style="font-size:15px; font-weight:700; color:#eee;">${val}</div>
            </div>`;

        return `
            <div style="display:flex; flex-wrap:wrap; gap:10px 14px; padding:10px 2px 12px 2px; border-top:1px solid rgba(255,255,255,0.08);">
                ${stat('Manpower', fmt(row.estUnits))}
                ${stat('Territory', row.tiles.toLocaleString() + ' tiles')}
                ${stat('World share', shareLabel)}
                ${capitalName ? stat('Capital', capitalName) : ''}
                ${alliesCount ? stat('Allies', alliesCount) : ''}
                <div style="flex-basis:100%; font-size:11px; color:#aaa; margin-top:-2px;">${status}</div>
            </div>
            <button class="lb-goto mini-btn" style="width:100%; background:#c0392b; color:#fff; font-weight:900; letter-spacing:0.5px; padding:12px; font-size:13px; white-space:normal; line-height:1.2;">
                📍 GO TO ${row.name}
            </button>
        `;
    };

    const flyToRow = (row) => {
        const b = row.bounds;
        try {
            // Make sure Leaflet's cached viewport size is current before we frame the
            // nation (the map is the live full-screen view in-game, but this guards any
            // edge state where its size went stale).
            map.invalidateSize(false);
            if (b) {
                const res = CONFIG.GRID_RES;
                const sw = [b.minY * res - 90, b.minX * res - 180];
                const ne = [(b.maxY + 1) * res - 90, (b.maxX + 1) * res - 180];
                map.fitBounds(L.latLngBounds(sw, ne).pad(0.15), { animate: true });
            } else if (Array.isArray(GS.cities)) {
                // Dead/zero-tile state: fall back to its capital if we have one
                const cap = GS.cities.find(c => c && c.isCapital && (c.ownerId || c.sovereignId) === row.id);
                if (cap) map.setView([cap.lat, cap.lng], 5, { animate: true });
            }
        } catch (e) { /* keep current view on any projection error */ }
    };

    // ── Strength model (for the "who would win" comparison) ─────────────────
    // Combat power = standing manpower + a territory reserve (bigger land = more
    // reinforcements/economy), lifted slightly by allies who might pile in. The
    // territory term is scaled by the map's own average units-per-tile so it stays
    // sensible on any scenario (few troops per tile or many).
    let unitsSum = 0, tilesSum = 0;
    for (const r of rows) { unitsSum += r.estUnits; tilesSum += r.tiles; }
    const avgUnitsPerTile = tilesSum > 0 ? unitsSum / tilesSum : 0;
    const powerOf = (row) => {
        const terrReserve = row.tiles * avgUnitsPerTile * 0.25;
        const allies = Array.isArray(row.meta && row.meta.allies) ? row.meta.allies.length : 0;
        const allyMod = 1 + Math.min(allies, 5) * 0.06;
        return Math.max(1, (row.estUnits + terrReserve) * allyMod);
    };

    // ── Compare mode state (reset every open) ───────────────────────────────
    let compareMode = false;
    let compareSel = [];   // holds up to 2 row indices
    const searchInput = document.getElementById('leaderboard-search');
    const compareBtn = document.getElementById('leaderboard-compare-btn');
    const comparePanel = document.getElementById('leaderboard-compare-panel');
    const compareHint = document.getElementById('leaderboard-compare-hint');

    const highlightSelected = () => {
        DOM.leaderboardList.querySelectorAll('.lb-card').forEach(c => {
            const i = parseInt(c.getAttribute('data-idx'), 10);
            const on = compareSel.includes(i);
            c.style.boxShadow = on ? 'inset 0 0 0 2px #2ec77a' : '';
            c.style.background = on ? 'rgba(46,199,122,0.08)' : '';
        });
    };

    const renderComparePanel = () => {
        if (!comparePanel) return;
        if (compareSel.length < 2) {
            comparePanel.style.display = 'none';
            comparePanel.innerHTML = '';
            return;
        }
        const a = rows[compareSel[0]], b = rows[compareSel[1]];
        const pa = powerOf(a), pb = powerOf(b);
        const wa = pa / (pa + pb);
        const pctA = Math.round(wa * 100), pctB = 100 - pctA;
        let verdict, vColor;
        if (Math.abs(wa - 0.5) < 0.04) { verdict = 'Too close to call'; vColor = '#ccc'; }
        else if (wa > 0.5) { verdict = '🏆 ' + a.name + ' likely wins (~' + pctA + '%)'; vColor = '#4a9eff'; }
        else { verdict = '🏆 ' + b.name + ' likely wins (~' + pctB + '%)'; vColor = '#ff6b5b'; }
        const fmt = (n) => (n > 0 ? GS.influenceLayer.formatSoldiers(n) : '—');
        const allyN = (r) => Array.isArray(r.meta && r.meta.allies) ? r.meta.allies.length : 0;
        const col = (r, accent) => {
            const flag = r.flagUrl
                ? `<img src="${r.flagUrl}" style="width:44px;height:28px;object-fit:cover;border-radius:3px;">`
                : `<div style="width:44px;height:28px;background:#111;border-radius:3px;"></div>`;
            return `
                <div style="flex:1; min-width:0; text-align:center;">
                    <div style="display:flex; justify-content:center; margin-bottom:4px;">${flag}</div>
                    <div style="font-size:14px; font-weight:800; color:${accent}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.name}</div>
                    <div style="font-size:12px; color:#ddd; margin-top:4px;">${fmt(r.estUnits)}<span style="color:#888;"> troops</span></div>
                    <div style="font-size:12px; color:#ddd;">${r.tiles.toLocaleString()}<span style="color:#888;"> tiles</span></div>
                    <div style="font-size:12px; color:#ddd;">${allyN(r)}<span style="color:#888;"> allies</span></div>
                </div>`;
        };
        comparePanel.innerHTML = `
            <div style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.12); border-radius:10px; padding:12px 12px 14px 12px;">
                <div style="display:flex; align-items:flex-start; gap:8px;">
                    ${col(a, '#4a9eff')}
                    <div style="align-self:center; font-size:16px; font-weight:900; color:#888;">VS</div>
                    ${col(b, '#ff6b5b')}
                </div>
                <div style="display:flex; height:12px; border-radius:6px; overflow:hidden; margin:12px 0 6px 0; background:#222;">
                    <div style="width:${pctA}%; background:#4a9eff;"></div>
                    <div style="width:${pctB}%; background:#ff6b5b;"></div>
                </div>
                <div style="text-align:center; font-size:13px; font-weight:800; color:${vColor};">${verdict}</div>
            </div>`;
        comparePanel.style.display = 'block';
    };

    const exitCompareMode = () => {
        compareMode = false;
        compareSel = [];
        if (compareBtn) { compareBtn.style.background = '#2e7d5b'; compareBtn.textContent = '⚔ COMPARE'; }
        if (compareHint) compareHint.style.display = 'none';
        if (comparePanel) { comparePanel.style.display = 'none'; comparePanel.innerHTML = ''; }
        highlightSelected();
    };

    if (compareBtn) {
        compareBtn.onclick = () => {
            if (compareMode) { exitCompareMode(); return; }
            compareMode = true;
            compareSel = [];
            compareBtn.style.background = '#c0392b';
            compareBtn.textContent = '✕ DONE';
            if (compareHint) compareHint.style.display = 'block';
            // Collapse any open accordion row so the two modes don't visually clash.
            DOM.leaderboardList.querySelectorAll('.lb-detail').forEach(d => { d.style.display = 'none'; d.innerHTML = ''; });
            DOM.leaderboardList.querySelectorAll('.lb-caret').forEach(c => { c.textContent = '▾'; });
            highlightSelected();
        };
    }

    // Live name filter. Hidden cards can't be tapped, so compare/accordion just
    // operate on whatever is visible.
    if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = () => {
            const q = searchInput.value.trim().toLowerCase();
            DOM.leaderboardList.querySelectorAll('.lb-card').forEach(c => {
                const i = parseInt(c.getAttribute('data-idx'), 10);
                const row = rows[i];
                const hit = !q || (row && (row.name.toLowerCase().includes(q) || (row.rawName && row.rawName.toLowerCase().includes(q))));
                c.style.display = hit ? '' : 'none';
            });
        };
    }

    // Delegated click handling (reassigned each open, so no listener buildup).
    DOM.leaderboardList.onclick = (e) => {
        const card = e.target.closest('.lb-card');
        if (!card) return;
        const idx = parseInt(card.getAttribute('data-idx'), 10);
        const row = rows[idx];
        if (!row) return;

        // Compare mode: tap toggles selection (max 2, oldest drops out).
        if (compareMode) {
            const pos = compareSel.indexOf(idx);
            if (pos !== -1) compareSel.splice(pos, 1);
            else { compareSel.push(idx); if (compareSel.length > 2) compareSel.shift(); }
            highlightSelected();
            renderComparePanel();
            return;
        }

        // GO TO button: fly the camera to the nation and close the rankings.
        if (e.target.closest('.lb-goto')) {
            flyToRow(row);
            DOM.leaderboardOverlay.style.display = 'none';
            return;
        }

        // Otherwise toggle the row's detail panel (accordion: only one open at a time).
        const detail = card.querySelector('.lb-detail');
        const caret = card.querySelector('.lb-caret');
        const isOpen = detail.style.display !== 'none';
        // Collapse any other open row
        DOM.leaderboardList.querySelectorAll('.lb-detail').forEach(d => {
            if (d !== detail) { d.style.display = 'none'; d.innerHTML = ''; }
        });
        DOM.leaderboardList.querySelectorAll('.lb-caret').forEach(c => { if (c !== caret) c.textContent = '▾'; });

        if (isOpen) {
            detail.style.display = 'none';
            detail.innerHTML = '';
            if (caret) caret.textContent = '▾';
        } else {
            detail.innerHTML = buildDetail(row);
            detail.style.display = 'block';
            if (caret) caret.textContent = '▴';
        }
    };

    // Fresh open starts in plain ranking mode with no stale filter/selection.
    exitCompareMode();
    if (searchInput && searchInput.oninput) searchInput.oninput();

    DOM.leaderboardOverlay.style.display = 'flex';
}
