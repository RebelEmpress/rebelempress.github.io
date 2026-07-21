// Extracted from main.js — ui-global-chat UI module
import { GS } from './state.js';
import * as DOM from './dom.js';
import { initMultiplayer } from './main.js';

export function renderGlobalChatList(messages) {
    if (!DOM.globalChatList) return;
    if (!messages || messages.length === 0) {
        DOM.globalChatList.innerHTML = `<div style="text-align:center; font-size:11px; color:#666; padding:16px;">No messages yet. Say hello!</div>`;
        return;
    }
    // oldest at top
    const sorted = messages.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    DOM.globalChatList.innerHTML = sorted.map(m => {
        const created = new Date(m.created_at).toLocaleTimeString();
        const safeText = (m.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const isMine = GS.currentUsername && m.username === GS.currentUsername;
        return `
            <div style="margin-bottom:6px; font-size:12px; ${isMine ? 'text-align:right;' : ''}">
                <div style="display:flex; ${isMine ? 'flex-direction:row-reverse;' : ''} align-items:center; gap:6px;">
                    <img src="https://images.websim.com/avatar/${m.username}" style="width:16px; height:16px; border-radius:50%; background:#000;">
                    <span style="font-size:11px; color:#ddd;">${m.username}</span>
                    <span style="font-size:9px; color:#555;">${created}</span>
                </div>
                <div style="margin-top:2px; color:#ccc; white-space:pre-wrap;">${safeText}</div>
            </div>
        `;
    }).join('');
    DOM.globalChatList.scrollTop = DOM.globalChatList.scrollHeight;
}

export async function openGlobalChat() {
    if (!DOM.globalChatModal) return;
    if (!GS.room) {
        try {
            await initMultiplayer();
        } catch (e) {
            console.warn('Failed to init multiplayer for chat', e);
        }
    }
    DOM.globalChatModal.style.display = 'flex';
    if (GS.room && !GS.globalChatUnsubscribe) {
        const coll = GS.room.collection('global_chat_v1');
        GS.globalChatUnsubscribe = coll.subscribe((records) => {
            renderGlobalChatList(records || []);
        });
        renderGlobalChatList(coll.getList());
    }
}
