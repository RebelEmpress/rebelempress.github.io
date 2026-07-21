// Verifies the dominance-ender metric fix on the exact germany-vs-poland softlock geometry.
// Two roughly-equal nations; loser (poland, pole B) reduced to a sealed pocket = 20% of its
// own homeland; the other 80% of poland's land is militarily OCCUPIED by germany (pole A) but
// NOT annexed (worldControlMap still = poland). Germany (pole A) holds its full homeland.
// Occupation has FADED to ~0 in the frozen interior (the realistic endgame).

const H = 1000;                 // germany homeland cells
const P = 1000;                 // poland homeland cells (roughly equal nation)
const pocketFrac = 0.20;        // poland clings to 20% of its own homeland
const GERMANY = 1, POLAND = 2;
const countryToSideMap = new Map([[GERMANY, 0 /*poleA*/], [POLAND, 1 /*poleB*/]]);

// Build synthetic maps.
const worldControlMap = [], primaryOccupierMap = [], occupationMap = [], landMask = [];
function push(owner, occupier, occ) { worldControlMap.push(owner); primaryOccupierMap.push(occupier); occupationMap.push(occ); landMask.push(2); }

// Germany homeland: germany owns + holds. Frozen interior → occupation faded toward 0.
for (let i = 0; i < H; i++) push(GERMANY, GERMANY, 0.0);
// Poland's surviving pocket: poland owns + holds. Sealed → occupation faded toward 0.
const pocket = Math.round(P * pocketFrac);
for (let i = 0; i < pocket; i++) push(POLAND, POLAND, 0.0);
// Poland's lost land: poland still de-jure owner, but germany physically occupies it.
// Occupation faded toward 0 in the now-static rear area (worst realistic case).
for (let i = 0; i < P - pocket; i++) push(POLAND, GERMANY, 0.0);

// --- OLD metric: sum of stats.controlled (de-jure owned AND occupied-in-favor) ---
// A cell counts for a country only if worldControlMap===country AND occupation in its favor.
// With occupation faded to 0, NOTHING counts — but even with fresh occupation, occupied-but-
// -unannexed land counts for neither pole. Simulate the fresh-occupation best case for OLD:
let oldA = 0, oldB = 0;
for (let i = 0; i < landMask.length; i++) {
    const sid = worldControlMap[i];
    const side = countryToSideMap.get(sid);
    const isTeamA = side % 2 === 0;
    // best-case: pretend occupation still reflects the holder's pole
    const holderSide = countryToSideMap.get(primaryOccupierMap[i]);
    const occFavor = holderSide % 2 === 0 ? 1 : -1;
    if ((isTeamA && occFavor > 0) || (!isTeamA && occFavor < 0)) {
        if (side % 2 === 0) oldA++; else oldB++;
    }
}
const oldShare = Math.max(oldA, oldB) / (oldA + oldB || 1);

// --- NEW metric: physical board control by primaryOccupierMap (decay-immune) ---
let poleAHeld = 0, poleBHeld = 0;
for (let i = 0; i < landMask.length; i++) {
    if (landMask[i] !== 2) continue;
    const occId = primaryOccupierMap[i];
    if (occId > 0) {
        const occSide = countryToSideMap.get(occId);
        if (occSide !== undefined) { if (occSide % 2 === 0) poleAHeld++; else poleBHeld++; }
    }
}
const newShare = Math.max(poleAHeld, poleBHeld) / (poleAHeld + poleBHeld || 1);

console.log('OLD (stats.controlled) share:', oldShare.toFixed(3), '→ tier-2 (>=0.85) fires?', oldShare >= 0.85);
console.log('NEW (primaryOccupierMap) share:', newShare.toFixed(3), 'poleA(ger)=', poleAHeld, 'poleB(pol)=', poleBHeld, '→ tier-2 fires?', newShare >= 0.85);
console.log('');
console.log(oldShare < 0.85 && newShare >= 0.85
  ? 'PASS: old metric hung this board (<0.85), new metric decisively ends it (>=0.85).'
  : 'FAIL: metric did not behave as expected.');
