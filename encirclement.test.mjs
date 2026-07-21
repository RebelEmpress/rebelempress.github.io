import { computeEncircledCoarse } from './encirclement.js';

// Build a W×H fine grid. land[]=2 everywhere by default (theater land), occ[]=0.
function grid(W, H) {
    const occ = new Float32Array(W * H);
    const land = new Uint8Array(W * H).fill(2);
    return { W, H, occ, land,
        set(x, y, o, l = 2) { occ[y * W + x] = o; land[y * W + x] = l; },
        // paint a filled rect [x0..x1]×[y0..y1]
        rect(x0, y0, x1, y1, o, l = 2) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { occ[y * W + x] = o; land[y * W + x] = l; } }
    };
}
function countSign(out, sign) { let n = 0; for (let i = 0; i < out.length; i++) if (out[i] === sign) n++; return n; }

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name); } };

// The old per-unit ring test, reproduced, to demonstrate WHY large salients were missed.
function oldRingEnemyFraction(occ, land, W, H, cx, cy, ringR, team) {
    const dirs = [[0,ringR],[0,-ringR],[ringR,0],[-ringR,0],[ringR,ringR],[-ringR,-ringR],[ringR,-ringR],[-ringR,ringR]];
    let enemy = 0, landN = 0;
    for (const [dx, dy] of dirs) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || x >= W || y < 0 || y >= H) continue;
        const i = y * W + x;
        if (land[i] !== 2) continue;
        landN++;
        const v = occ[i];
        if (team === 'A' ? v < -0.1 : v > 0.1) enemy++;
    }
    return landN ? enemy / landN : 0;
}

// --- Scenario 1: small A pocket fully ringed by B land, no escape → encircled.
{
    const g = grid(40, 40);
    g.rect(0, 0, 39, 39, 0);           // neutral land all around (passable)
    g.rect(14, 14, 25, 25, -1);        // B ring block
    g.rect(17, 17, 22, 22, 1);         // A pocket inside the B block
    const { out } = computeEncircledCoarse(g.occ, g.land, g.W, g.H, 1);
    check('small sealed pocket: A cells flagged encircled', countSign(out, 1) === 36);
    check('small sealed pocket: no B flagged', countSign(out, -1) === 0);
}

// --- Scenario 2: LARGE A salient (20×20) fully ringed by B → still encircled.
//     This is the owner's case. The old ring test on the salient's CENTRE sees zero
//     enemy (all friendly locally) and never fires — flood-fill catches it.
{
    const g = grid(60, 60);
    g.rect(0, 0, 59, 59, 0);
    g.rect(8, 8, 51, 51, -1);          // thick B wall
    g.rect(18, 18, 41, 41, 1);         // big A salient (24×24)
    const ringFrac = oldRingEnemyFraction(g.occ, g.land, g.W, g.H, 29, 29, 5, 'A'); // centre, ±5 cells
    check('large salient: OLD ring at centre sees 0% enemy (the bug)', ringFrac === 0);
    const { out } = computeEncircledCoarse(g.occ, g.land, g.W, g.H, 1);
    check('large salient: flood flags the whole A interior encircled', countSign(out, 1) === 24 * 24);
}

// --- Scenario 3: same large salient, but a water channel breaches the B ring to the
//     outside → it has a supply route → NOT encircled.
{
    const g = grid(60, 60);
    g.rect(0, 0, 59, 59, 0);
    g.rect(8, 8, 51, 51, -1);
    g.rect(18, 18, 41, 41, 1);
    g.rect(29, 0, 30, 41, 0, 0);       // water channel from top edge into the salient
    const { out } = computeEncircledCoarse(g.occ, g.land, g.W, g.H, 1);
    check('salient with water escape: NOT encircled', countSign(out, 1) === 0);
}

// --- Scenario 4: A salient connected to friendly A mainland by a land corridor → not sealed.
{
    const g = grid(60, 60);
    g.rect(0, 0, 59, 59, 0);
    g.rect(8, 8, 51, 51, -1);
    g.rect(18, 18, 41, 41, 1);
    g.rect(29, 0, 30, 41, 1);          // A corridor from edge to salient (own supply line)
    const { out } = computeEncircledCoarse(g.occ, g.land, g.W, g.H, 1);
    check('salient with friendly corridor to edge: NOT encircled', countSign(out, 1) === 0);
}

// --- Scenario 5: nothing encircled in an open front (A left half, B right half).
{
    const g = grid(40, 40);
    g.rect(0, 0, 19, 39, 1);
    g.rect(20, 0, 39, 39, -1);
    const { out } = computeEncircledCoarse(g.occ, g.land, g.W, g.H, 1);
    check('open front: nobody encircled', countSign(out, 1) === 0 && countSign(out, -1) === 0);
}

// --- Scenario 6: symmetric — a B pocket sealed by A → B flagged.
{
    const g = grid(40, 40);
    g.rect(0, 0, 39, 39, 0);
    g.rect(14, 14, 25, 25, 1);         // A wall
    g.rect(17, 17, 22, 22, -1);        // B pocket
    const { out } = computeEncircledCoarse(g.occ, g.land, g.W, g.H, 1);
    check('symmetric: B pocket sealed by A is flagged', countSign(out, -1) === 36 && countSign(out, 1) === 0);
}

// --- Scenario 7: THE OWNER'S BUG. A B pocket inside A territory, but the pocket
//     also TOUCHES NEUTRAL non-theater land (mask 1) on one side. The old code let
//     the border flood leak in through neutral land, so it never flagged. Neutral
//     land is not a supply route → must be flagged now.
{
    const g = grid(40, 40);
    g.rect(0, 0, 39, 39, 0, 1);        // neutral non-theater land everywhere (mask 1)
    g.rect(10, 10, 29, 29, 1, 2);      // A theater block, 20×20
    g.rect(10, 15, 13, 18, -1, 2);     // B pocket flush against the LEFT edge of A (x=9 is neutral)
    const { out } = computeEncircledCoarse(g.occ, g.land, g.W, g.H, 1);
    check('regional bug: B pocket bordering neutral land IS flagged', countSign(out, -1) === 16);
    check('regional bug: A not flagged', countSign(out, 1) === 0);
}

// --- Scenario 8: OVER-DETECTION GUARD. A whole landlocked combatant at war start,
//     fully ringed by NEUTRAL land, no enemy anywhere. It can't reach open ground
//     either — but it is NOT enemy-ringed, so it must NOT collapse.
{
    const g = grid(40, 40);
    g.rect(0, 0, 39, 39, 0, 1);        // neutral land
    g.rect(15, 15, 24, 24, 1, 2);      // lone A country, no enemy
    const { out } = computeEncircledCoarse(g.occ, g.land, g.W, g.H, 1);
    check('war-start landlocked combatant NOT flagged', countSign(out, 1) === 0 && countSign(out, -1) === 0);
}

// --- Scenario 9: a B pocket ringed by A on land but with a WATER lane to the map
//     edge (naval supply). Water still frees a pocket; only neutral land doesn't.
{
    const g = grid(40, 40);
    g.rect(0, 0, 39, 39, 0, 1);        // neutral land
    g.rect(10, 10, 29, 29, 1, 2);      // A block
    g.rect(15, 12, 18, 15, -1, 2);     // B pocket inside A
    g.rect(16, 0, 17, 12, 0, 0);       // water channel from top border down to the pocket
    const { out } = computeEncircledCoarse(g.occ, g.land, g.W, g.H, 1);
    check('B pocket with a sea lane NOT flagged', countSign(out, -1) === 0);
}

// --- Scenario 10: EMPTY land patch (no owner) sealed inside A territory → captured by A (+2).
//     Owner: "detect patches of land without units surrounded by enemy land and switch those".
{
    const g = grid(40, 40);
    // background defaults to EMPTY theater land (mask 2, occ 0), connected to the border → free.
    g.rect(10, 10, 29, 29, 1);         // solid A block 20×20
    g.rect(17, 17, 22, 22, 0);         // 6×6 empty hole inside A (occ 0)
    const { out } = computeEncircledCoarse(g.occ, g.land, g.W, g.H, 1);
    check('empty hole inside A: captured by A (+2)', countSign(out, 2) === 36);
    check('empty hole: A ring itself not flagged', countSign(out, 1) === 0);
    check('empty hole: nothing captured by B', countSign(out, -2) === 0);
}

// --- Scenario 11: empty patch with a WATER lane to the border → free → NOT captured.
{
    const g = grid(40, 40);
    g.rect(10, 10, 29, 29, 1);         // A block
    g.rect(17, 17, 22, 22, 0);         // empty hole
    g.rect(19, 0, 20, 17, 0, 0);       // water channel from top border into the hole
    const { out } = computeEncircledCoarse(g.occ, g.land, g.W, g.H, 1);
    check('empty hole with sea lane: NOT captured', countSign(out, 2) === 0 && countSign(out, -2) === 0);
}

// --- Scenario 12: empty patch on an even A/B front → ~50/50 perimeter, below RING_FRAC → NOT captured.
{
    const g = grid(40, 40);
    g.rect(0, 0, 19, 39, 1);           // A left
    g.rect(20, 0, 39, 39, -1);         // B right
    g.rect(18, 18, 21, 21, 0);         // empty pocket straddling the seam (≈half A, half B)
    const { out } = computeEncircledCoarse(g.occ, g.land, g.W, g.H, 1);
    check('empty pocket on even front: NOT captured by either', countSign(out, 2) === 0 && countSign(out, -2) === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
