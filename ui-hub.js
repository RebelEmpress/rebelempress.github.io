// Extracted from main.js — ui-hub UI module
import { parseColorToRGBA } from './utils.js';
import { CONFIG } from './config.js';
import { getProvinceId } from './geometry.js';
import { GS } from './state.js';
import * as DOM from './dom.js';
import { getGridIndex } from './main.js';
import { openInspector } from './ui-inspector.js';

export function openHub(initialTab = 'scenarios') {
    const fade = document.getElementById('fade-transition-overlay');
    const isFromEditor = (GS.gameState === 'EDITOR_ACTIVE' || GS.gameState === 'EDITOR_PAINTING' || GS.godModeActive || GS.gameState === 'SIMULATING' || GS.gameState === 'SELECTING_P1' || GS.gameState === 'SELECTING_P2');

    GS.hubWasInEditor = isFromEditor;
    if (isFromEditor) GS.hubReturnState = GS.gameState;

    const performOpen = () => {
        // Switch to Menu background visuals for the hub context if coming from the map
        if (isFromEditor) {
            DOM.mapUi.style.display = 'none';
            DOM.countryInspector.style.display = 'none';
            DOM.mainMenu.style.display = 'flex';
            // Set state to main menu so the background looks correct under the modal
            GS.gameState = 'MAIN_MENU'; 
        }

        DOM.scenarioHubModal.style.display = 'flex';
        switchHubTab(initialTab);
        
        // Refresh content
        renderHub(GS.room.collection('scenario_v1').getList());
        renderCountryLibrary(GS.room.collection('country_library_v1').getList());
        renderFlagLibrary(GS.room.collection('flag_library_v1').getList());
    };

    if (isFromEditor && fade) {
        fade.style.display = 'block';
        requestAnimationFrame(() => { fade.style.opacity = '1'; });
        
        setTimeout(() => {
            performOpen();
            fade.style.opacity = '0';
            setTimeout(() => { fade.style.display = 'none'; }, 600);
        }, 600);
    } else {
        performOpen();
    }
}

export function closeHub() {
    DOM.scenarioHubModal.style.display = 'none';
    if (GS.hubWasInEditor) {
        DOM.mainMenu.style.display = 'none';
        DOM.mapUi.style.display = 'flex';
        if (GS.hubReturnState) GS.gameState = GS.hubReturnState;
        GS.hubWasInEditor = false;
        GS.hubReturnState = null;
    }
}

export function switchHubTab(tab) {
    DOM.tabScenariosBtn.classList.remove('active');
    DOM.tabCountriesBtn.classList.remove('active');
    DOM.tabFlagsBtn.classList.remove('active');
    DOM.hubList.style.display = 'none';
    DOM.libraryList.style.display = 'none';
    DOM.flagLibraryList.style.display = 'none';

    if (tab === 'scenarios') {
        DOM.tabScenariosBtn.classList.add('active');
        DOM.hubList.style.display = 'grid';
    } else if (tab === 'countries') {
        DOM.tabCountriesBtn.classList.add('active');
        DOM.libraryList.style.display = 'grid';
    } else if (tab === 'flags') {
        DOM.tabFlagsBtn.classList.add('active');
        DOM.flagLibraryList.style.display = 'grid';
    }
}

export function renderHub(scenarios) {
    // scenarios is now an array from the database
    const list = scenarios; 
    GS.hubScenarioCache = {};
    if (list.length === 0) {
        DOM.hubList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px;">No scenarios uploaded yet. Be the first!</div>`;
        return;
    }

    const myUsername = GS.currentUsername;

    // Compute comment counts per scenario id
    let commentCounts = {};
    try {
        const allComments = GS.room.collection('hub_comment_v1').getList();
        allComments.forEach(c => {
            if (c.item_type === 'scenario' && c.item_id) {
                commentCounts[c.item_id] = (commentCounts[c.item_id] || 0) + 1;
            }
        });
    } catch (e) {
        commentCounts = {};
    }

    DOM.hubList.innerHTML = list.map((s) => {
        GS.hubScenarioCache[s.id] = s;
        const safeName = (s.name || '').replace(/'/g, "\\'");
        const safeOwner = (s.username || '').replace(/'/g, "\\'");
        const cCount = commentCounts[s.id] || 0;
        const cLabel = cCount === 1 ? '1 comment' : `${cCount} comments`;
        const canDelete = myUsername && s.username === myUsername;
        return `
        <div class="hub-item" data-item-type="scenario" data-item-id="${s.id}">
            <img src="${s.previewUrl || 'https://images.websim.ai/v1/projects/placeholder/landscape'}" class="hub-preview-img">
            <div class="hub-content">
                <div class="hub-info">
                    <div class="hub-name">${s.name}</div>
                    <div class="hub-meta">
                        <img src="https://images.websim.com/avatar/${s.username}" class="hub-author-img">
                        <span>${s.username}</span>
                    </div>
                    ${s.remixed_from_name ? `
                        <div style="font-size: 9px; color: #8e44ad; text-transform: uppercase; font-weight: 900; letter-spacing: 1px; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                            <span>🔄</span> REMIXED FROM ${s.remixed_from_name}
                        </div>
                    ` : ''}
                </div>
                <div class="hub-description">${s.description || 'No description provided.'}</div>
                <div class="hub-comment-count">💬 ${cLabel}</div>
                <div class="hub-actions" style="margin-top: auto; display: flex; justify-content: space-between; align-items: center;">
                    <div class="hub-actions-buttons" style="display:flex; gap:6px;">
                        ${canDelete ? `<button class="mini-btn" style="background:#c0392b; padding:6px 10px; font-size:9px;" onclick="window.deleteScenario('${s.id}')">DEL</button>` : ''}
                    </div>
                    <span style="font-size: 10px; color: #555;">${new Date(s.created_at).toLocaleDateString()}</span>
                </div>
            </div>
        </div>
    `;
    }).join('');

    // Attach click handlers to open item modal when clicking the card background
    DOM.hubList.querySelectorAll('.hub-item').forEach(card => {
        if (card.dataset.boundClick) return;
        card.dataset.boundClick = '1';
        card.addEventListener('click', (ev) => {
            // Ignore clicks on buttons inside the card
            if (ev.target.closest('.hub-actions-buttons') || ev.target.closest('button')) return;
            const id = card.getAttribute('data-item-id');
            if (!id) return;
            const item = GS.hubScenarioCache[id];
            if (!item) return;
            openItemModal('scenario', item);
        });
    });
}

export function renderCountryLibrary(countries) {
    GS.hubCountryCache = {};
    if (countries.length === 0) {
        DOM.libraryList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px;">Library is empty. Contribute your nations!</div>`;
        return;
    }

    const myUsername = GS.currentUsername;
    const canImport = GS.gameMode === 'EDITOR' || GS.godModeActive;

    DOM.libraryList.innerHTML = countries.map((c) => {
        GS.hubCountryCache[c.id] = c;
        return `
        <div class="hub-item" data-item-type="country" data-item-id="${c.id}">
            <div style="height: 120px; position: relative; display: flex; align-items: center; justify-content: center; background: #000; border-bottom: 1px solid rgba(255,255,255,0.1); overflow: hidden;">
                 <img src="${c.previewUrl || 'https://images.websim.ai/v1/projects/placeholder/landscape'}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.6;">
                 <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(circle, transparent 30%, #000 100%);"></div>
                 <div style="position: absolute; display: flex; align-items: center; justify-content: center; z-index: 2;">
                    ${c.flagUrl ? `<img src="${c.flagUrl}" style="max-height: 40px; max-width: 60px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2);">` : '<span style="font-size: 30px;">🏳️</span>'}
                 </div>
                 <div style="position: absolute; bottom: 5px; left: 5px; right: 5px; height: 3px; background: ${c.color || '#fff'}; border-radius: 2px;"></div>
            </div>
            <div class="hub-content">
                <div class="hub-info">
                    <div class="hub-name">${c.name}</div>
                    <div class="hub-meta">
                        <img src="https://images.websim.com/avatar/${c.username}" class="hub-author-img">
                        <span>${c.username}</span>
                    </div>
                </div>
                <div class="hub-description">${c.description || 'No description provided.'}</div>
                <div class="hub-actions" style="margin-top: auto; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 5px;" class="hub-actions-buttons">
                        ${canImport ? `<button class="mini-btn" style="background: #27ae60; padding: 6px 12px;" onclick="event.stopPropagation(); window.importFromLibrary('${c.id}')">IMPORT</button>` : ''}
                        ${c.username === myUsername ? 
                            `<button class="mini-btn" style="background: #c0392b; padding: 6px 12px;" onclick="window.deleteCountry('${c.id}')">DEL</button>` : 
                            ''
                        }
                    </div>
                    <span style="font-size: 10px; color: #555;">${new Date(c.created_at).toLocaleDateString()}</span>
                </div>
            </div>
        </div>
    `;
    }).join('');

    DOM.libraryList.querySelectorAll('.hub-item').forEach(card => {
        if (card.dataset.boundClick) return;
        card.dataset.boundClick = '1';
        card.addEventListener('click', (ev) => {
            if (ev.target.closest('.hub-actions-buttons') || ev.target.closest('button')) return;
            const id = card.getAttribute('data-item-id');
            if (!id) return;
            const item = GS.hubCountryCache[id];
            if (!item) return;
            openItemModal('country', item);
        });
    });
}

export function renderFlagLibrary(flags) {
    GS.hubFlagCache = {};
    if (flags.length === 0) {
        DOM.flagLibraryList.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px;">No custom flags shared yet. Be the first!</div>`;
        return;
    }

    const myUsername = GS.currentUsername;
    const canImport = GS.gameMode === 'EDITOR' || GS.godModeActive;

    DOM.flagLibraryList.innerHTML = flags.map((f) => {
        GS.hubFlagCache[f.id] = f;
        return `
        <div class="hub-item" data-item-type="flag" data-item-id="${f.id}">
            <div style="height: 100px; display: flex; align-items: center; justify-content: center; background: #000; border-bottom: 1px solid rgba(255,255,255,0.1); padding: 15px;">
                 <img src="${f.flagUrl}" style="max-height: 100%; max-width: 100%; box-shadow: 0 4px 15px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2);">
            </div>
            <div class="hub-content">
                <div class="hub-info">
                    <div class="hub-name">${f.name}</div>
                    <div class="hub-meta">
                        <img src="https://images.websim.com/avatar/${f.username}" class="hub-author-img">
                        <span>${f.username}</span>
                    </div>
                </div>
                <div class="hub-description">${f.description || 'No description.'}</div>
                <div class="hub-actions" style="margin-top: auto; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 5px;" class="hub-actions-buttons">
                        ${canImport ? `<button class="mini-btn" style="background: #2e86de; padding: 6px 12px;" onclick="event.stopPropagation(); window.importFlagFromLibrary('${f.id}')">USE</button>` : ''}
                        ${f.username === myUsername ? 
                            `<button class="mini-btn" style="background: #c0392b; padding: 6px 12px;" onclick="window.deleteFlag('${f.id}')">DEL</button>` : 
                            ''
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
    }).join('');

    DOM.flagLibraryList.querySelectorAll('.hub-item').forEach(card => {
        if (card.dataset.boundClick) return;
        card.dataset.boundClick = '1';
        card.addEventListener('click', (ev) => {
            if (ev.target.closest('.hub-actions-buttons') || ev.target.closest('button')) return;
            const id = card.getAttribute('data-item-id');
            if (!id) return;
            const item = GS.hubFlagCache[id];
            if (!item) return;
            openItemModal('flag', item);
        });
    });
}

export function saveCountryLocally(countryId) {
    const meta = GS.countryMetadata.find(m => m && m.id === countryId);
    if (!meta) return;

    const countryData = {
        id: meta.id,
        name: meta.name,
        color: meta.color,
        flagUrl: meta.flagUrl,
        isCustom: meta.isCustom || false,
        role: meta.role || 'OFFENSE',
        overlordId: meta.overlordId || null
    };

    const cells = [];
    for (let i = 0; i < GS.worldControlMap.length; i++) {
        if (GS.worldControlMap[i] === countryId) {
            const y = Math.floor(i / GS.gridWidth);
            const x = i % GS.gridWidth;
            cells.push([x, y]);
        }
    }

    // Cache cells on metadata so releasables and multi-export can reuse them
    meta.savedCells = cells;

    const presetData = {
        name: `${meta.name}_country`,
        metadata: countryData,
        cells: cells,
        gridRes: CONFIG.GRID_RES,
        version: "1.0"
    };

    const blob = new Blob([JSON.stringify(presetData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meta.name.replace(/\s+/g, '_')}_country.json`;
    a.click();
    URL.revokeObjectURL(url);

    DOM.statusText.innerText = `SAVED: ${meta.name} exported locally`;
}

export function loadCountryFromPC() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        loadingStatus.innerText = "Loading Country Data...";
        DOM.loadingOverlay.style.display = 'flex';

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.metadata || !data.cells) {
                throw new Error("Invalid country file structure");
            }

            const currentRes = CONFIG.GRID_RES;
            const sourceRes = data.gridRes || currentRes;

            // Find next available country ID
            const maxId = GS.countryMetadata.reduce((max, m) => m ? Math.max(max, m.id) : max, 0);
            const newId = maxId + 1;

            // Create metadata entry
            const meta = {
                id: newId,
                name: data.metadata.name || "Imported Nation",
                color: data.metadata.color || 'rgba(150, 150, 150, 0.5)',
                rgba: parseColorToRGBA(data.metadata.color || 'rgba(150, 150, 150, 0.5)'),
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

            // Place cells on map with resolution conversion if needed
            for (const [sx, sy] of data.cells) {
                if (sourceRes === currentRes) {
                    const idx = sy * GS.gridWidth + sx;
                    if (idx < GS.worldControlMap.length) {
                        GS.worldControlMap[idx] = newId;
                        GS.provinceMap[idx] = getProvinceId(sx, sy, newId);
                        if (GS.landMask[idx] === 0) GS.landMask[idx] = 1;
                        
                        // Update bounds
                        meta.bounds.minX = Math.min(meta.bounds.minX, sx);
                        meta.bounds.maxX = Math.max(meta.bounds.maxX, sx);
                        meta.bounds.minY = Math.min(meta.bounds.minY, sy);
                        meta.bounds.maxY = Math.max(meta.bounds.maxY, sy);
                    }
                } else {
                    // Convert coordinates
                    const baseLat = (sy * sourceRes) - 90;
                    const baseLng = (sx * sourceRes) - 180;
                    
                    if (sourceRes > currentRes) {
                        for (let lat = baseLat; lat < baseLat + sourceRes; lat += currentRes) {
                            for (let lng = baseLng; lng < baseLng + sourceRes; lng += currentRes) {
                                const tIdx = getGridIndex(lat + currentRes/2, lng + currentRes/2);
                                if (tIdx !== -1) {
                                    GS.worldControlMap[tIdx] = newId;
                                    GS.provinceMap[tIdx] = getProvinceId(Math.floor((lng + currentRes/2 + 180) / currentRes), Math.floor((lat + currentRes/2 + 90) / currentRes), newId);
                                    if (GS.landMask[tIdx] === 0) GS.landMask[tIdx] = 1;
                                }
                            }
                        }
                    } else {
                        const tIdx = getGridIndex(baseLat + sourceRes/2, baseLng + sourceRes/2);
                        if (tIdx !== -1) {
                            GS.worldControlMap[tIdx] = newId;
                            const tx = Math.floor((baseLng + sourceRes/2 + 180) / currentRes);
                            const ty = Math.floor((baseLat + sourceRes/2 + 90) / currentRes);
                            GS.provinceMap[tIdx] = getProvinceId(tx, ty, newId);
                            if (GS.landMask[tIdx] === 0) GS.landMask[tIdx] = 1;
                            
                            // Update bounds
                            meta.bounds.minX = Math.min(meta.bounds.minX, tx);
                            meta.bounds.maxX = Math.max(meta.bounds.maxX, tx);
                            meta.bounds.minY = Math.min(meta.bounds.minY, ty);
                            meta.bounds.maxY = Math.max(meta.bounds.maxY, ty);
                        }
                    }
                }
            }

            DOM.loadingOverlay.style.display = 'none';
            
            // Check if bounds were updated, if not set reasonable defaults
            if (meta.bounds.minX === Infinity) {
                meta.bounds = { minX: 0, maxX: GS.gridWidth-1, minY: 0, maxY: GS.gridHeight-1 };
            }

            openInspector(newId);
            DOM.statusText.innerText = `IMPORTED: ${meta.name} from local file`;
            GS.influenceLayer.render();
        } catch (err) {
            console.error("Country import error:", err);
            alert(`Failed to import country: ${err.message}`);
            DOM.loadingOverlay.style.display = 'none';
        }
    };
    input.click();
}

export function renderCommentsList(comments) {
    if (!DOM.itemCommentsList) return;
    if (!comments || comments.length === 0) {
        DOM.itemCommentsList.innerHTML = `<div style="padding:10px; font-size:11px; color:#777; text-align:center;">No comments yet. Be the first to brief this item.</div>`;
        return;
    }

    // Sort newest -> oldest from collection (already newest-first) but keep parent/replies grouped
    const byParent = new Map();
    comments.forEach(c => {
        const parentId = c.parent_id || null;
        if (!byParent.has(parentId)) byParent.set(parentId, []);
        byParent.get(parentId).push(c);
    });

    const renderThread = (parentId, depth = 0) => {
        const arr = byParent.get(parentId) || [];
        return arr.map(c => {
            const created = new Date(c.created_at).toLocaleString();
            const safeText = (c.text || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            const isMine = GS.currentUsername && c.username === GS.currentUsername;
            return `
                <div class="item-comment" data-comment-id="${c.id}" style="padding:6px 8px; border-bottom:1px solid rgba(255,255,255,0.05); margin-left:${depth*12}px;">
                    <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                        <img src="https://images.websim.com/avatar/${c.username}" style="width:16px; height:16px; border-radius:50%; background:#000;">
                        <span style="font-size:11px; color:#ddd;">${c.username}</span>
                        <span style="font-size:9px; color:#555; margin-left:auto;">${created}</span>
                    </div>
                    <div class="item-comment-text" style="font-size:12px; color:#ccc; white-space:pre-wrap;">${safeText}</div>
                    <div style="margin-top:4px; display:flex; gap:4px;">
                        <button class="mini-btn item-reply-btn" style="padding:2px 6px; font-size:9px;">Reply</button>
                        ${isMine ? `
                            <button class="mini-btn item-edit-btn" style="padding:2px 6px; font-size:9px;">Edit</button>
                            <button class="mini-btn item-delete-btn" style="padding:2px 6px; font-size:9px; background:#c0392b;">Delete</button>
                        ` : ''}
                    </div>
                </div>
                ${renderThread(c.id, depth+1)}
            `;
        }).join('');
    };

    DOM.itemCommentsList.innerHTML = renderThread(null);

    // Wire reply buttons
    DOM.itemCommentsList.querySelectorAll('.item-reply-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const commentEl = btn.closest('.item-comment');
            if (!commentEl) return;
            GS.currentReplyParentId = commentEl.getAttribute('data-comment-id');
            GS.currentEditingCommentId = null;
            DOM.itemReplyIndicator.style.display = 'inline-block';
            DOM.itemReplyIndicator.textContent = 'Replying...';
            DOM.itemCancelReplyBtn.style.display = 'inline-block';
            DOM.itemCommentSubmit.textContent = 'Post';
            DOM.itemCommentInput.focus();
        });
    });

    // Wire edit buttons (only for own comments)
    DOM.itemCommentsList.querySelectorAll('.item-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const commentEl = btn.closest('.item-comment');
            if (!commentEl) return;
            const id = commentEl.getAttribute('data-comment-id');
            const comment = comments.find(c => c.id === id);
            if (!comment || comment.username !== GS.currentUsername) return;
            GS.currentEditingCommentId = id;
            GS.currentReplyParentId = comment.parent_id || null;
            const textEl = commentEl.querySelector('.item-comment-text');
            const currentText = textEl ? textEl.textContent : (comment.text || '');
            DOM.itemCommentInput.value = currentText;
            DOM.itemReplyIndicator.style.display = 'inline-block';
            DOM.itemReplyIndicator.textContent = 'Editing...';
            DOM.itemCancelReplyBtn.style.display = 'inline-block';
            DOM.itemCommentSubmit.textContent = 'Save';
            DOM.itemCommentInput.focus();
        });
    });

    // Wire delete buttons (only for own comments)
    DOM.itemCommentsList.querySelectorAll('.item-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const commentEl = btn.closest('.item-comment');
            if (!commentEl) return;
            const id = commentEl.getAttribute('data-comment-id');
            const comment = comments.find(c => c.id === id);
            if (!comment || comment.username !== GS.currentUsername) return;
            if (!confirm('Delete this comment?')) return;
            (async () => {
                try {
                    await GS.room.collection('hub_comment_v1').delete(id);
                } catch (e) {
                    console.error('Failed to delete comment', e);
                    alert('Failed to delete comment.');
                }
            })();
        });
    });
}

export async function openItemModal(type, item) {
    GS.currentCommentItemType = type;
    GS.currentCommentItemId = item.id;
    GS.currentReplyParentId = null;
    GS.currentEditingCommentId = null;
    if (GS.commentsUnsubscribe) {
        GS.commentsUnsubscribe();
        GS.commentsUnsubscribe = null;
    }

    // Title / desc / preview
    DOM.itemModalTitle.textContent = (item.name || 'Item Details').toUpperCase();
    const desc = item.description || item.desc || '';
    DOM.itemModalDesc.textContent = desc;
    
    const authorEl = document.getElementById('item-modal-author-name');
    if (authorEl) {
        authorEl.textContent = item.username || "Intel Report";
    }

    if (item.previewUrl || item.flagUrl) {
        DOM.itemModalPreview.src = item.previewUrl || item.flagUrl;
        DOM.itemModalPreview.style.display = 'block';
    } else {
        DOM.itemModalPreview.style.display = 'none';
    }

    // Configure big-card actions for all item types
    if (DOM.itemModalActions) {
        const canImport = (GS.gameMode === 'EDITOR' || GS.godModeActive);
        const itemModalDeleteBtn = document.getElementById('item-modal-delete');
        const isOwner = GS.currentUsername && item.username === GS.currentUsername;

        if (itemModalDeleteBtn) {
            itemModalDeleteBtn.style.display = isOwner ? 'inline-flex' : 'none';
            itemModalDeleteBtn.onclick = () => {
                if (type === 'scenario') window.deleteScenario(item.id);
                else if (type === 'country') window.deleteCountry(item.id);
                else if (type === 'flag') window.deleteFlag(item.id);
                DOM.itemCommentModal.style.display = 'none';
            };
        }

        if (type === 'scenario') {
            // Play / Remix a scenario
            DOM.itemModalActions.style.display = 'flex';
            if (DOM.itemModalPlayBtn) {
                DOM.itemModalPlayBtn.style.display = 'inline-flex';
                DOM.itemModalPlayBtn.textContent = 'Play';
                DOM.itemModalPlayBtn.onclick = () => {
                    if (window.playFromHub) {
                        window.playFromHub(item.blobUrl, item.id, item.name || '', item.username || '');
                        DOM.itemCommentModal.style.display = 'none';
                        closeHub();
                    }
                };
            }
            if (DOM.itemModalRemixBtn) {
                DOM.itemModalRemixBtn.style.display = 'inline-flex';
                DOM.itemModalRemixBtn.textContent = 'Remix';
                DOM.itemModalRemixBtn.onclick = () => {
                    if (window.remixFromHub) {
                        window.remixFromHub(item.blobUrl, item.id, item.name || '', item.username || '');
                        DOM.itemCommentModal.style.display = 'none';
                        closeHub();
                    }
                };
            }
        } else if (type === 'country') {
            // Import a country into the current editor map
            DOM.itemModalActions.style.display = (canImport || isOwner) ? 'flex' : 'none';
            if (DOM.itemModalPlayBtn) {
                DOM.itemModalPlayBtn.style.display = canImport ? 'inline-flex' : 'none';
                DOM.itemModalPlayBtn.textContent = 'Import';
                DOM.itemModalPlayBtn.onclick = () => {
                    if (window.importFromLibrary) {
                        window.importFromLibrary(item.id);
                        DOM.itemCommentModal.style.display = 'none';
                    }
                };
            }
            if (DOM.itemModalRemixBtn) {
                DOM.itemModalRemixBtn.style.display = 'none';
                DOM.itemModalRemixBtn.onclick = null;
            }
        } else if (type === 'flag') {
            // Use a flag from the library on the currently selected country
            DOM.itemModalActions.style.display = (canImport || isOwner) ? 'flex' : 'none';
            if (DOM.itemModalPlayBtn) {
                DOM.itemModalPlayBtn.style.display = canImport ? 'inline-flex' : 'none';
                DOM.itemModalPlayBtn.textContent = 'Use Flag';
                DOM.itemModalPlayBtn.onclick = () => {
                    if (window.importFlagFromLibrary) {
                        window.importFlagFromLibrary(item.id);
                        DOM.itemCommentModal.style.display = 'none';
                    }
                };
            }
            if (DOM.itemModalRemixBtn) {
                DOM.itemModalRemixBtn.style.display = 'none';
                DOM.itemModalRemixBtn.onclick = null;
            }
        } else {
            DOM.itemModalActions.style.display = isOwner ? 'flex' : 'none';
            if (DOM.itemModalPlayBtn) DOM.itemModalPlayBtn.style.display = 'none';
            if (DOM.itemModalRemixBtn) DOM.itemModalRemixBtn.style.display = 'none';
        }
    }

    // Clear composer
    DOM.itemCommentInput.value = '';
    DOM.itemReplyIndicator.style.display = 'none';
    DOM.itemCancelReplyBtn.style.display = 'none';
    DOM.itemCommentSubmit.textContent = 'Post';

    // Subscribe to comments for this item (using records)
    try {
        const coll = GS.room.collection('hub_comment_v1').filter({
            item_type: type,
            item_id: item.id
        });
        GS.commentsUnsubscribe = coll.subscribe((records) => {
            renderCommentsList(records || []);
        });
        // Initial render
        renderCommentsList(coll.getList());
    } catch (e) {
        console.warn('Comment subscription failed', e);
        renderCommentsList([]);
    }

    DOM.itemCommentModal.style.display = 'flex';
}
