// Extracted from main.js — ui-city-inspector UI module
import { GS } from './state.js';
import * as DOM from './dom.js';
import { map } from './main.js';

export function findCityAtLatLng(latlng) {
    if (!GS.cities || GS.cities.length === 0) return null;
    const pt = map.latLngToContainerPoint(latlng);
    const maxDistSq = 8 * 8;
    let best = null;
    let bestDistSq = maxDistSq;

    const bounds = map.getBounds();
    GS.cities.forEach(c => {
        if (c.lat == null || c.lng == null) return;
        if (!bounds.contains([c.lat, c.lng])) return;
        const cp = map.latLngToContainerPoint([c.lat, c.lng]);
        const dx = cp.x - pt.x;
        const dy = cp.y - pt.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < bestDistSq) {
            bestDistSq = d2;
            best = c;
        }
    });
    return best;
}

export function refreshCityOwnerSelect(selectedOwnerId) {
    if (!DOM.cityOwnerSelect) return;
    DOM.cityOwnerSelect.innerHTML = '<option value="">(None)</option>';
    GS.countryMetadata.forEach(m => {
        if (!m) return;
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        if (selectedOwnerId && selectedOwnerId === m.id) opt.selected = true;
        DOM.cityOwnerSelect.appendChild(opt);
    });
}

export function openCityInspector(cityId) {
    const city = GS.cities.find(c => c.id === cityId);
    if (!city) return;
    GS.editingCityId = cityId;
    DOM.cityInspector.style.display = 'block';
    DOM.cityNameInput.value = city.name || "";
    refreshCityOwnerSelect(city.ownerId || city.sovereignId || null);
    DOM.cityCapitalCheckbox.checked = !!city.isCapital;
}
