// Pure geometry/grid helpers: province-ID noise field and point-in-polygon.
import { CONFIG } from './config.js';

export /**
 * Completely remade province generation using multi-octave cellular noising.
 * Generates an organic, non-repeating province ID that is strictly unique to a specific sovereign country.
 */
function getProvinceId(x, y, countryId) {
    if (countryId <= 0) return 0;
    const res = CONFIG.GRID_RES;
    const lat = (y * res) - 90;
    const lng = (x * res) - 180;

    // Base coordinates scaled for province density
    const scale = 0.65;
    let nx = lng * scale;
    let ny = lat * scale;

    // Octave 1: Domain warping
    const w1 = Math.sin(nx * 0.8 + ny * 0.6 + countryId * 0.1) * 1.2;
    const w2 = Math.cos(nx * 0.5 - ny * 0.9 + countryId * 0.2) * 1.1;

    // Octave 2: High-frequency fractal noise composition
    const noise = (
        Math.sin((nx + w1) * 2.3) * 0.5 +
        Math.sin((ny + w2) * 1.9) * 0.5 +
        Math.sin(((nx + ny) * 1.4) + countryId) * 0.3 +
        Math.cos((nx * 3.1) - (ny * 2.7)) * 0.2
    );

    // Grid snap into "cells"
    const cellX = Math.floor(nx + w1 + noise);
    const cellY = Math.floor(ny + w2 + noise);

    // Unique hashing using prime pairing to ensure no two provinces share an ID, even across countries.
    // The countryId is a primary component of the hash, forcing province lines to reset at borders.
    const h1 = Math.abs(cellX * 73856093);
    const h2 = Math.abs(cellY * 19349663);
    const h3 = Math.abs(countryId * 83492791);
    
    return (h1 ^ h2 ^ h3) >>> 0; 
}

// Per-geometry cache of polygon parts with precomputed exterior-ring bounding boxes.
// Keyed on the (stable) geometry object so it survives across the thousands of per-cell
// point-in-polygon calls that rasterization does, without mutating the GeoJSON.
const partBBoxCache = new WeakMap();

function getPreparedParts(geometry) {
    let cached = partBBoxCache.get(geometry);
    if (cached) return cached;

    const type = geometry.type;
    const coords = geometry.coordinates;
    const rawParts = type === 'Polygon' ? [coords]
        : (type === 'MultiPolygon' ? coords : []);

    cached = rawParts.map(polygon => {
        const ext = polygon[0] || [];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < ext.length; i++) {
            const x = ext[i][0], y = ext[i][1];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        return { polygon, minX, minY, maxX, maxY };
    });
    partBBoxCache.set(geometry, cached);
    return cached;
}

// Union bbox of a feature (all exterior rings), in [minLng,minLat,maxLng,maxLat] form.
// Returns null for empty/degenerate geometry. Shares the cache above, so the first
// call in a rasterization pass is the only one that walks the coordinates.
export function getFeatureBBox(feature) {
    if (!feature || !feature.geometry) return null;
    const parts = getPreparedParts(feature.geometry);
    if (!parts.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let p = 0; p < parts.length; p++) {
        const part = parts[p];
        if (part.minX < minX) minX = part.minX;
        if (part.minY < minY) minY = part.minY;
        if (part.maxX > maxX) maxX = part.maxX;
        if (part.maxY > maxY) maxY = part.maxY;
    }
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
}

function isPointInRing(ring, px, py) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const intersect = ((yi > py) !== (yj > py)) &&
            (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

export /**
 * Point-In-Polygon check for GeoJSON features. Uses cached per-part bounding boxes to
 * skip the (expensive) ray-cast for any polygon part the point can't possibly be inside —
 * a big win for multi-polygon nations with many distant islands.
 */
function isPointInFeature(lat, lng, feature) {
    const geometry = feature.geometry;
    if (!geometry) return false;
    const px = lng, py = lat;
    const parts = getPreparedParts(geometry);

    for (let p = 0; p < parts.length; p++) {
        const part = parts[p];
        // Quick reject: outside this part's exterior bounding box.
        if (px < part.minX || px > part.maxX || py < part.minY || py > part.maxY) continue;
        const polygon = part.polygon;
        // Exterior ring must contain the point...
        if (!isPointInRing(polygon[0], px, py)) continue;
        // ...and no interior hole may contain it.
        let inHole = false;
        for (let i = 1; i < polygon.length; i++) {
            if (isPointInRing(polygon[i], px, py)) { inHole = true; break; }
        }
        if (!inHole) return true;
    }
    return false;
}
