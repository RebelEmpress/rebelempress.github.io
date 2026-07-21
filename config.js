// Tunable gameplay/simulation constants and buff definitions.

export const CONFIG = {
    GEOJSON_BASE: 'https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/',
    GRID_RES: 0.1,
    INFLUENCE_RATE: 0.18, 
    INFLUENCE_RADIUS: 0.40, 
    UNIT_SPAWN_COUNT: 60, // Base count
    MAX_UNITS_PER_SIDE: 1800,
    PER_COUNTRY_SPAWN_CAP: 100, // Max units a single nation spawns with (prevents giants like Russia flooding the field)
    UNIT_DENSITY_FACTOR: 0.022, // Slightly increased density for modestly more units
    // Chance a nation chooses to FIGHT ON (keep a real army) instead of collapsing when its capital falls.
    // Higher = wars keep going after a capital is taken instead of the defender instantly folding.
    CAPITAL_FIGHT_ON_CHANCE: 0.7,
    HOI4_COLORS: {
        'Germany': '#6e6e6e',
        'Russia': '#911c1c',
        'Soviet Union': '#911c1c',
        'United Kingdom': '#bd9c61',
        'United States of America': '#3a5c32',
        'United States': '#3a5c32',
        'France': '#304f9e',
        'Italy': '#4d6e35',
        'Japan': '#d4d4d4',
        'China': '#ded433',
        'Poland': '#f59595',
        'Turkey': '#8f1d1d',
        'Brazil': '#3da33d',
        'Canada': '#e31e24',
        'Australia': '#2e41a3',
        'India': '#e39d3b',
        'Spain': '#d1bc4d',
        'Mexico': '#d3a550',
        'Argentina': '#75aadb',
        'Chile': '#d43b3b',
        'Egypt': '#e3d17d',
        'South Africa': '#de8664',
        'Israel': '#2e86de',
        'Mongolia': '#943821',
        'Iran': '#1a8227',
        'Iraq': '#7a6021',
        'Saudi Arabia': '#2e7a3e',
        'Sweden': '#3a7bad',
        'Norway': '#4e5b8a',
        'Finland': '#7798ab',
        'Romania': '#b59b31',
        'Hungary': '#396b41',
        'Yugoslavia': '#bd8c42',
        'Greece': '#4a7ea3',
        'South Korea': '#2e86de',
        'North Korea': '#ff4757',
        'Vietnam': '#cc3333',
        'Ukraine': '#ffdd00'
    },
    UNIT_SPEED: 0.003,
    UNIT_NAVAL_SPEED: 0.025, // Significantly faster for swift naval invasions
    // --- Naval revamp (owner): ships stop-and-fire at range instead of colliding ---
    NAVAL_FIRE_RANGE: 0.55,   // deg — a ship opens fire on an enemy ship within this range
    NAVAL_STANDOFF: 0.30,     // deg — the distance it holds at (stops short, trades fire)
    NAVAL_FIRE_DAMAGE: 0.34,  // per-tick ranged damage at standoff (falls off toward max range)
    NAVAL_ENCIRCLE_STEP: 0.35,// extra kill speed per additional ship ganging up on one target
    NAVAL_ENCIRCLE_MAX: 1.75, // cap on the encircle damage bonus (so a swarm kills fast, not instant)
    NAVAL_GHOST_TICKS: 210,   // ticks a landed ship lingers on the coast before it despawns
    // --- Transport boats (owner): dedicated ferries wait on a country's coast at war
    // start, load nearby troops, cross to an enemy shore, unload, and return for more.
    // The old "unit swims across on its own" model is kept as an anti-deadlock fallback. ---
    BOAT_ENABLED: true,
    BOATS_PER_COUNTRY: 3,     // transport boats spawned per coastal warring nation
    BOAT_GLOBAL_CAP: 44,      // hard ceiling on total boats (phone perf)
    BOAT_CAPACITY: 6,         // troops one boat ferries per trip
    BOAT_SPEED: 0.030,        // deg/tick while crossing (a touch faster than swimming)
    BOAT_LOAD_RADIUS: 1.4,    // deg — troops within this of an idle boat walk aboard
    BOAT_LOAD_TICKS: 60,      // max load window before an at-least-partly-full boat departs
    BOAT_LAND_DIST: 0.35,     // deg — distance from the target shore at which troops disembark
    BOAT_UNLOAD_EVERY: 6,     // ticks between each troop stepping off onto the beach
    BOAT_LINGER_TICKS: 150,   // ticks the boat holds on the enemy shore after the last troop is out
    BOAT_IDLE_COOLDOWN: 120,  // ticks a returned boat rests before seeking a new mission
    BOAT_STUCK_TICKS: 1200,   // failsafe: abandon a leg (dump troops, reset) if it drags this long
    UNIT_TO_SOLDIER_RATIO: 5000,
    UNIT_HEALTH: 100,
    // Alpenjäger tuning: small, subtle advantages
    ALPEN_HEALTH_MULT: 1.25,           // +25% health
    ALPEN_MTN_SPEED_MULT: 1.4,         // faster in mountains
    ALPEN_COMBAT_MULT: 1.12,           // +12% damage, -12% damage taken
    COMBAT_DAMAGE: 0.7, 
    ATTRITION_DAMAGE: 0.06, 
    REINFORCEMENT_RATE: 0.006,
    ENCIRCLEMENT_DAMAGE_MULT: 2.5,
    ENCIRCLEMENT_RADIUS: 0.7,
    TEAM_A_COLOR: 'rgba(255, 50, 50, 0.5)',
    TEAM_B_COLOR: 'rgba(50, 100, 255, 0.5)',
    FRONTLINE_COLOR: 'rgba(0, 0, 0, 1.0)'
};

export const BUFF_STATES = ['crippled', 'weakened', 'none', 'buff', 'super', 'godly'];
export const BUFF_METADATA = {
    'crippled': { label: 'MAJOR PENALTY', color: '#7b241c', textColor: '#fff', class: 'crippled-active' },
    'weakened': { label: 'MINOR PENALTY', color: '#a04000', textColor: '#fff', class: 'weakened-active' },
    'none': { label: 'NONE', color: '#444', textColor: '#fff', class: '' },
    'buff': { label: 'SMALL BUFF', color: '#f1c40f', textColor: '#000', class: 'active' },
    'super': { label: 'MEDIUM BUFF', color: '#9b59b6', textColor: '#fff', class: 'super-active' },
    'godly': { label: 'LARGE BUFF', color: '#ffffff', textColor: '#000', class: 'godly-active' }
};
