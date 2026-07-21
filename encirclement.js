// Encirclement topology — pure, dependency-free so it can be unit-tested.
//
// A friendly region is ENCIRCLED iff BOTH:
//   (1) it cannot reach the "free outside" — the map border, open water, or
//       contested no-man's-land — without crossing enemy land OR a non-belligerent
//       NEUTRAL country, and
//   (2) its perimeter is predominantly enemy land (it's actually ringed by the
//       enemy, not just sitting alone inland or backed against a neutral border).
//
// Why both tests, and why neutral land matters:
//   The original code modelled only (1) and treated neutral (non-theater) land as a
//   passable escape route — so the border flood leaked in through neutral ground and
//   a pocket that touched any neutral land never tripped. In a small REGIONAL war
//   (e.g. Czechia vs Slovakia, ringed by neutral Poland/Austria/Hungary) that meant
//   encirclements almost never fired — the exact bug the owner kept reporting. But
//   units cannot retreat or be supplied across a country that isn't in the war, so
//   neutral land is NOT a supply route: it must block (1). Open WATER / coastline IS
//   a supply route (naval), so it stays passable — a pocket with a sea lane is free.
//   Test (2) is what stops over-detection that (1)-with-neutral-as-barrier would
//   cause: a whole landlocked combatant at war start is "cut off from open ground"
//   too, but it isn't enemy-ringed, so it must not collapse.
//
// Scale-free (works for a 2-cell pocket or a sealed continent) and cheap: O(coarse
// cells) at a low cadence, no per-frame full-grid scan. occupationMap is the field
// the on-screen fill/frontline draw from, so detection matches what the player sees.

const A_LAND = 2;       // team-A-controlled theater land
const B_LAND = -2;      // team-B-controlled theater land
const OPEN = 0;         // open water — a free naval supply route
const NEUTRAL = 1;      // non-belligerent country land — NOT a supply route (blocks, but doesn't ring)
const EMPTY = 3;        // contested theater land with no owner yet — still a free route for unit
                        // pockets, but a patch of it can itself be captured if a team seals it off
const RING_FRAC = 0.6;  // a pocket must be >=60% enemy along its non-friendly perimeter to collapse

// Classify one coarse cell by sampling the fine grid at its centre.
function classify(occ, landMask, gridWidth, gridHeight, step, cw, ch, cls) {
    const half = step >> 1;
    for (let cy = 0; cy < ch; cy++) {
        const fy = Math.min(gridHeight - 1, cy * step + half);
        const rowBase = fy * gridWidth;
        const cRowBase = cy * cw;
        for (let cx = 0; cx < cw; cx++) {
            const fx = Math.min(gridWidth - 1, cx * step + half);
            const fi = rowBase + fx;
            const m = landMask[fi];
            if (m === 2) {                       // active theater land — occupation decides
                const o = occ[fi];
                cls[cRowBase + cx] = o > 0.1 ? A_LAND : (o < -0.1 ? B_LAND : EMPTY);
            } else if (m === 1) {                // non-theater land = neutral country
                cls[cRowBase + cx] = NEUTRAL;
            } else {                             // water (m===0) = open sea route
                cls[cRowBase + cx] = OPEN;
            }
        }
    }
}

// 4-neighbours of coarse cell i, longitude wrapping at the dateline; -1 = pole edge.
function nbrs(i, cw, ch, out4) {
    const x = i % cw, y = (i - x) / cw;
    out4[0] = y > 0 ? i - cw : -1;               // up   (-1 at north pole edge = outside)
    out4[1] = y < ch - 1 ? i + cw : -1;          // down (-1 at south pole edge = outside)
    out4[2] = x > 0 ? i - 1 : y * cw + (cw - 1); // left  wraps across the dateline
    out4[3] = x < cw - 1 ? i + 1 : y * cw;       // right wraps across the dateline
}

// Flood the "free outside" for one team from every passable border cell.
// Passable = own land OR OPEN water OR EMPTY contested ground (all are supply routes).
// Enemy land and NEUTRAL land both block. Fills `reached` with 1 for every cell the
// free outside touches.
function freeFlood(cls, cw, ch, friendlyVal, reached, stack) {
    reached.fill(0);
    const passable = (v) => v === friendlyVal || v === OPEN || v === EMPTY;
    let sp = 0;
    const seed = (i) => { if (!reached[i] && passable(cls[i])) { reached[i] = 1; stack[sp++] = i; } };
    for (let x = 0; x < cw; x++) { seed(x); seed((ch - 1) * cw + x); }
    for (let y = 0; y < ch; y++) { seed(y * cw); seed(y * cw + (cw - 1)); }
    const nb = [0, 0, 0, 0];
    while (sp > 0) {
        const i = stack[--sp];
        nbrs(i, cw, ch, nb);
        for (let k = 0; k < 4; k++) {
            const j = nb[k];
            if (j >= 0 && !reached[j] && passable(cls[j])) { reached[j] = 1; stack[sp++] = j; }
        }
    }
}

// Split one side's land into connected components; mark every component that is
// (a) NOT reached by the free flood and (b) >=RING_FRAC enemy along its perimeter.
function markEncircledComponents(cls, cw, ch, friendlyVal, enemyVal, out, mark, reached, visited, stack) {
    visited.fill(0);
    const n = cw * ch;
    const nb = [0, 0, 0, 0];
    for (let s = 0; s < n; s++) {
        if (visited[s] || cls[s] !== friendlyVal) continue;
        // Flood this component, tallying perimeter + whether any cell is "free".
        let sp = 0; stack[sp++] = s; visited[s] = 1;
        let head = 0; const comp = [];
        let enemyEdges = 0, otherEdges = 0, free = false;
        while (sp > 0) {
            const i = stack[--sp]; comp.push(i);
            if (reached[i]) free = true;
            nbrs(i, cw, ch, nb);
            for (let k = 0; k < 4; k++) {
                const j = nb[k];
                if (j < 0) { otherEdges++; continue; }          // pole edge = open outside
                const cv = cls[j];
                if (cv === friendlyVal) { if (!visited[j]) { visited[j] = 1; stack[sp++] = j; } }
                else if (cv === enemyVal) enemyEdges++;
                else otherEdges++;                              // OPEN or NEUTRAL = non-enemy edge
            }
        }
        if (free) continue;                                     // has a real supply route → not sealed
        const peri = enemyEdges + otherEdges;
        if (peri > 0 && enemyEdges / peri >= RING_FRAC) {
            for (let m = 0; m < comp.length; m++) out[comp[m]] = mark;
        }
    }
}

// Flood the "free outside" through water + empty ground only (NO team land, NO
// neutral). An EMPTY patch the flood can't reach is sealed off from sea/border by
// land on every side — a hole inside someone's territory.
function freeFloodEmpty(cls, cw, ch, reached, stack) {
    reached.fill(0);
    const passable = (v) => v === OPEN || v === EMPTY;
    let sp = 0;
    const seed = (i) => { if (!reached[i] && passable(cls[i])) { reached[i] = 1; stack[sp++] = i; } };
    for (let x = 0; x < cw; x++) { seed(x); seed((ch - 1) * cw + x); }
    for (let y = 0; y < ch; y++) { seed(y * cw); seed(y * cw + (cw - 1)); }
    const nb = [0, 0, 0, 0];
    while (sp > 0) {
        const i = stack[--sp];
        nbrs(i, cw, ch, nb);
        for (let k = 0; k < 4; k++) {
            const j = nb[k];
            if (j >= 0 && !reached[j] && passable(cls[j])) { reached[j] = 1; stack[sp++] = j; }
        }
    }
}

// Owner request: detect patches of empty (unit-less, contested) land that are sealed
// off by one team's land and flip them to that team. Split EMPTY cells into connected
// components; a component collapses to side T iff (a) it can't reach the free outside
// (sea/border) without crossing land, and (b) >=RING_FRAC of its land perimeter is T's.
// Marks +2 (captured by A) / -2 (captured by B) so the engine can flip the ground with
// no units to wipe — distinct from the ±1 unit-pocket marks.
function markEmptyComponents(cls, cw, ch, out, reached, visited, stack) {
    visited.fill(0);
    const n = cw * ch;
    const nb = [0, 0, 0, 0];
    for (let s = 0; s < n; s++) {
        if (visited[s] || cls[s] !== EMPTY) continue;
        let sp = 0; stack[sp++] = s; visited[s] = 1;
        const comp = [];
        let aEdges = 0, bEdges = 0, otherEdges = 0, free = false;
        while (sp > 0) {
            const i = stack[--sp]; comp.push(i);
            if (reached[i]) free = true;
            nbrs(i, cw, ch, nb);
            for (let k = 0; k < 4; k++) {
                const j = nb[k];
                if (j < 0) { otherEdges++; continue; }        // pole edge = open outside
                const cv = cls[j];
                if (cv === EMPTY) { if (!visited[j]) { visited[j] = 1; stack[sp++] = j; } }
                else if (cv === A_LAND) aEdges++;
                else if (cv === B_LAND) bEdges++;
                else otherEdges++;                            // OPEN water or NEUTRAL
            }
        }
        if (free) continue;                                   // touches sea/border → not sealed
        const peri = aEdges + bEdges + otherEdges;
        if (peri === 0) continue;
        const mark = aEdges / peri >= RING_FRAC ? 2 : (bEdges / peri >= RING_FRAC ? -2 : 0);
        if (mark !== 0) for (let m = 0; m < comp.length; m++) out[comp[m]] = mark;
    }
}

// Returns { out, cw, ch } where out is an Int8Array over the coarse grid:
//   +1 = cell is team-A territory encircled here   (units trapped → wiped, flips to B)
//   -1 = cell is team-B territory encircled here   (units trapped → wiped, flips to A)
//   +2 = empty land patch sealed off by team A      (no units → just flips to A)
//   -2 = empty land patch sealed off by team B      (no units → just flips to B)
//    0 = not encircled
// `cache` (optional) holds reusable typed-array buffers to avoid per-call GC.
export function computeEncircledCoarse(occ, landMask, gridWidth, gridHeight, step, cache) {
    const cw = Math.ceil(gridWidth / step);
    const ch = Math.ceil(gridHeight / step);
    const n = cw * ch;
    const c = cache || {};
    if (!c.out || c.out.length !== n) {
        c.out = new Int8Array(n);
        c.cls = new Int8Array(n);
        c.reached = new Uint8Array(n);
        c.visited = new Uint8Array(n);
        c.stack = new Int32Array(n);
    }
    c.out.fill(0);
    classify(occ, landMask, gridWidth, gridHeight, step, cw, ch, c.cls);
    // Team A.
    freeFlood(c.cls, cw, ch, A_LAND, c.reached, c.stack);
    markEncircledComponents(c.cls, cw, ch, A_LAND, B_LAND, c.out, 1, c.reached, c.visited, c.stack);
    // Team B.
    freeFlood(c.cls, cw, ch, B_LAND, c.reached, c.stack);
    markEncircledComponents(c.cls, cw, ch, B_LAND, A_LAND, c.out, -1, c.reached, c.visited, c.stack);
    // Empty-land patches sealed off by one side (owner: switch surrounded unit-less land).
    freeFloodEmpty(c.cls, cw, ch, c.reached, c.stack);
    markEmptyComponents(c.cls, cw, ch, c.out, c.reached, c.visited, c.stack);
    return { out: c.out, cw, ch };
}
