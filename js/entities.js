/**
 * entities.js
 * Entity hitbox dimensions, category classification, 3D→2D projection, and name label overlay.
 */

// ─── Hitbox Dimensions ────────────────────────────────────────────────────────
// Width (w) is the diameter used for both X and Z. Height (h) is the full height.
const ENTITY_DIMENSIONS = {
    // Players / Humanoids
    'player':               { w: 0.6,    h: 1.8 },
    'armor_stand':          { w: 0.5,    h: 1.975 },

    // Undead / Hostile Humanoids
    'zombie':               { w: 0.6,    h: 1.95 },
    'zombie_villager':      { w: 0.6,    h: 1.95 },
    'husk':                 { w: 0.6,    h: 1.95 },
    'drowned':              { w: 0.6,    h: 1.95 },
    'skeleton':             { w: 0.6,    h: 1.99 },
    'stray':                { w: 0.6,    h: 1.99 },
    'wither_skeleton':      { w: 0.7,    h: 2.4  },
    'bogged':               { w: 0.6,    h: 1.99 },

    // Other Hostile
    'creeper':              { w: 0.6,    h: 1.7  },
    'witch':                { w: 0.6,    h: 1.95 },
    'evoker':               { w: 0.6,    h: 1.95 },
    'vindicator':           { w: 0.6,    h: 1.95 },
    'pillager':             { w: 0.6,    h: 1.95 },
    'illusioner':           { w: 0.6,    h: 1.95 },
    'enderman':             { w: 0.6,    h: 2.9  },
    'spider':               { w: 1.4,    h: 0.9  },
    'cave_spider':          { w: 0.7,    h: 0.5  },
    'blaze':                { w: 0.6,    h: 1.8  },
    'ghast':                { w: 4.0,    h: 4.0  },
    'phantom':              { w: 0.9,    h: 0.5  },
    'silverfish':           { w: 0.4,    h: 0.3  },
    'endermite':            { w: 0.4,    h: 0.3  },
    'shulker':              { w: 1.0,    h: 1.0  },
    'ravager':              { w: 1.95,   h: 2.2  },
    'guardian':             { w: 0.85,   h: 0.85 },
    'elder_guardian':       { w: 1.9975, h: 1.9975 },
    'slime':                { w: 2.04,   h: 2.04 },
    'magma_cube':           { w: 2.04,   h: 2.04 },
    'vex':                  { w: 0.4,    h: 0.8  },
    'warden':               { w: 0.9,    h: 2.9  },
    'breeze':               { w: 0.6,    h: 1.7  },
    'creaking':             { w: 0.9,    h: 2.7  },

    // Bosses
    'ender_dragon':         { w: 16.0,   h: 8.0  },
    'wither':               { w: 0.9,    h: 3.5  },

    // Passive / Neutral Humanoids
    'villager':             { w: 0.6,    h: 1.95 },
    'wandering_trader':     { w: 0.6,    h: 1.95 },
    'piglin':               { w: 0.6,    h: 1.95 },
    'piglin_brute':         { w: 0.6,    h: 1.95 },
    'zombified_piglin':     { w: 0.6,    h: 1.95 },
    'hoglin':               { w: 1.3965, h: 1.4  },
    'zoglin':               { w: 1.3965, h: 1.4  },

    // Passive Animals (quadrupeds)
    'cow':                  { w: 0.9,    h: 1.4  },
    'mooshroom':            { w: 0.9,    h: 1.4  },
    'sheep':                { w: 0.9,    h: 1.3  },
    'pig':                  { w: 0.9,    h: 0.9  },
    'chicken':              { w: 0.4,    h: 0.7  },
    'cat':                  { w: 0.6,    h: 0.7  },
    'ocelot':               { w: 0.6,    h: 0.7  },
    'wolf':                 { w: 0.6,    h: 0.85 },
    'fox':                  { w: 0.6,    h: 0.7  },
    'panda':                { w: 1.3,    h: 1.25 },
    'polar_bear':           { w: 1.3,    h: 1.4  },
    'horse':                { w: 1.396,  h: 1.6  },
    'donkey':               { w: 1.396,  h: 1.6  },
    'mule':                 { w: 1.396,  h: 1.6  },
    'skeleton_horse':       { w: 1.396,  h: 1.6  },
    'zombie_horse':         { w: 1.396,  h: 1.6  },
    'llama':                { w: 0.9,    h: 1.87 },
    'trader_llama':         { w: 0.9,    h: 1.87 },
    'rabbit':               { w: 0.4,    h: 0.5  },
    'bee':                  { w: 0.7,    h: 0.6  },
    'bat':                  { w: 0.5,    h: 0.9  },
    'parrot':               { w: 0.5,    h: 0.9  },
    'turtle':               { w: 1.2,    h: 0.4  },
    'axolotl':              { w: 0.75,   h: 0.42 },
    'goat':                 { w: 0.9,    h: 1.3  },
    'frog':                 { w: 0.5,    h: 0.5  },
    'tadpole':              { w: 0.4,    h: 0.3  },
    'allay':                { w: 0.35,   h: 0.6  },
    'camel':                { w: 1.7,    h: 2.375 },
    'sniffer':              { w: 1.9,    h: 1.75 },
    'armadillo':            { w: 0.7,    h: 0.65 },

    // Aquatic
    'squid':                { w: 0.8,    h: 0.8  },
    'glow_squid':           { w: 0.8,    h: 0.8  },
    'dolphin':              { w: 0.9,    h: 0.6  },
    'cod':                  { w: 0.5,    h: 0.3  },
    'salmon':               { w: 0.7,    h: 0.4  },
    'pufferfish':           { w: 0.7,    h: 0.7  },
    'tropical_fish':        { w: 0.5,    h: 0.4  },

    // Golems
    'iron_golem':           { w: 1.4,    h: 2.7  },
    'snow_golem':           { w: 0.7,    h: 1.9  },

    // ─── Boats ─────────────────────────────────────────────────────────────────
    // All standard boats share the same hitbox
    'oak_boat':             { w: 1.375,  h: 0.5625 },
    'spruce_boat':          { w: 1.375,  h: 0.5625 },
    'birch_boat':           { w: 1.375,  h: 0.5625 },
    'jungle_boat':          { w: 1.375,  h: 0.5625 },
    'acacia_boat':          { w: 1.375,  h: 0.5625 },
    'dark_oak_boat':        { w: 1.375,  h: 0.5625 },
    'mangrove_boat':        { w: 1.375,  h: 0.5625 },
    'cherry_boat':          { w: 1.375,  h: 0.5625 },
    'bamboo_raft':          { w: 1.375,  h: 0.5625 },
    // Chest boat variants
    'oak_chest_boat':       { w: 1.375,  h: 0.5625 },
    'spruce_chest_boat':    { w: 1.375,  h: 0.5625 },
    'birch_chest_boat':     { w: 1.375,  h: 0.5625 },
    'jungle_chest_boat':    { w: 1.375,  h: 0.5625 },
    'acacia_chest_boat':    { w: 1.375,  h: 0.5625 },
    'dark_oak_chest_boat':  { w: 1.375,  h: 0.5625 },
    'mangrove_chest_boat':  { w: 1.375,  h: 0.5625 },
    'cherry_chest_boat':    { w: 1.375,  h: 0.5625 },
    'bamboo_chest_raft':    { w: 1.375,  h: 0.5625 },
    // Legacy "boat" key (some schematics use this)
    'boat':                 { w: 1.375,  h: 0.5625 },

    // ─── Minecarts ─────────────────────────────────────────────────────────────
    'minecart':             { w: 0.98,   h: 0.7  },
    'chest_minecart':       { w: 0.98,   h: 0.7  },
    'furnace_minecart':     { w: 0.98,   h: 0.7  },
    'hopper_minecart':      { w: 0.98,   h: 0.7  },
    'tnt_minecart':         { w: 0.98,   h: 0.7  },
    'spawner_minecart':     { w: 0.98,   h: 0.7  },
    'command_block_minecart': { w: 0.98, h: 0.7  },

    // ─── Misc / Projectile / Display ───────────────────────────────────────────
    'item_frame':           { w: 0.5,    h: 0.5  },
    'glow_item_frame':      { w: 0.5,    h: 0.5  },
    'painting':             { w: 0.0625, h: 0.0625 },
    'item':                 { w: 0.25,   h: 0.25 },
    'experience_orb':       { w: 0.5,    h: 0.5  },
    'arrow':                { w: 0.5,    h: 0.5  },
    'spectral_arrow':       { w: 0.5,    h: 0.5  },
    'trident':              { w: 0.5,    h: 0.5  },
    'fireball':             { w: 1.0,    h: 1.0  },
    'small_fireball':       { w: 0.3125, h: 0.3125 },
    'dragon_fireball':      { w: 1.0,    h: 1.0  },
    'wither_skull':         { w: 0.3125, h: 0.3125 },
    'primed_tnt':           { w: 0.98,   h: 0.98 },
    'falling_block':        { w: 0.98,   h: 0.98 },
    'fishing_bobber':       { w: 0.25,   h: 0.25 },
    'display':              { w: 0.0,    h: 0.0  },
    'text_display':         { w: 0.0,    h: 0.0  },
    'item_display':         { w: 0.0,    h: 0.0  },
    'block_display':        { w: 0.0,    h: 0.0  },
    'interaction':          { w: 1.0,    h: 1.0  },
    'marker':               { w: 0.0,    h: 0.0  },
};

const HOSTILE_ENTITIES = new Set([
    'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider', 'witch', 'enderman',
    'slime', 'magma_cube', 'zombified_piglin', 'piglin', 'piglin_brute', 'hoglin',
    'zoglin', 'blaze', 'ghast', 'wither_skeleton', 'guardian', 'elder_guardian',
    'phantom', 'drowned', 'husk', 'stray', 'silverfish', 'endermite', 'shulker',
    'ravager', 'pillager', 'vindicator', 'evoker', 'illusioner', 'vex', 'warden',
    'breeze', 'zombie_villager', 'bogged', 'creaking',
]);

const PASSIVE_ENTITIES = new Set([
    'villager', 'wandering_trader', 'cow', 'sheep', 'pig', 'chicken', 'cat', 'ocelot',
    'wolf', 'horse', 'donkey', 'mule', 'skeleton_horse', 'zombie_horse', 'llama',
    'trader_llama', 'rabbit', 'fox', 'panda', 'bee', 'turtle', 'parrot', 'squid',
    'glow_squid', 'dolphin', 'polar_bear', 'iron_golem', 'snow_golem', 'axolotl',
    'goat', 'frog', 'tadpole', 'allay', 'camel', 'sniffer', 'armadillo',
    'mooshroom', 'cod', 'salmon', 'pufferfish', 'tropical_fish', 'bat',
]);

const BOSS_ENTITIES = new Set(['ender_dragon', 'wither']);

/**
 * Returns width and height dimensions of an entity based on its ID.
 * Falls back to a generic 0.6×1.8 (player-sized) hitbox for unknown entities.
 * @param {string} rawId  e.g. "minecraft:zombie" or "zombie"
 * @returns {{ w: number, h: number }}
 */
function getEntityDimension(rawId) {
    const id = rawId.replace('minecraft:', '').toLowerCase();
    // Also handle variants like "oak_boat" → "boat"
    if (ENTITY_DIMENSIONS[id]) return ENTITY_DIMENSIONS[id];
    // Try suffix matching (e.g. "spruce_boat" matches "boat")
    for (const key of Object.keys(ENTITY_DIMENSIONS)) {
        if (id.endsWith(key)) return ENTITY_DIMENSIONS[key];
    }
    return { w: 0.6, h: 1.8 };
}

/**
 * Returns the category classification of an entity.
 * @param {string} rawId
 * @returns {'boss' | 'hostile' | 'passive' | 'misc'}
 */
function getEntityCategory(rawId) {
    const id = rawId.replace('minecraft:', '').toLowerCase();
    if (BOSS_ENTITIES.has(id))    return 'boss';
    if (HOSTILE_ENTITIES.has(id)) return 'hostile';
    if (PASSIVE_ENTITIES.has(id)) return 'passive';
    return 'misc';
}

/**
 * Returns a human-readable display name from a raw entity ID.
 * e.g. "minecraft:zombie_villager" → "Zombie Villager"
 * @param {string} rawId
 * @returns {string}
 */
function getEntityDisplayName(rawId) {
    return rawId
        .replace('minecraft:', '')
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

/**
 * Returns a CSS color string for the entity label border based on category.
 * @param {string} rawId
 * @returns {string} hex color
 */
function getEntityLabelColor(rawId) {
    const cat = getEntityCategory(rawId);
    if (cat === 'boss')    return '#c084fc'; // purple
    if (cat === 'hostile') return '#f87171'; // red
    if (cat === 'passive') return '#4ade80'; // green
    return '#94a3b8';                        // slate (misc)
}

/**
 * Projects a 3D world-space point to 2D canvas pixel coordinates.
 * @param {number[]} pos3D   [x, y, z] in structure space
 * @param {Float32Array} viewMatrix
 * @param {Float32Array} projMatrix
 * @param {HTMLCanvasElement} canvas
 * @returns {{ x: number, y: number } | null}
 */
function project3DTo2D(pos3D, viewMatrix, projMatrix, canvas) {
    const temp = glMatrix.vec4.fromValues(pos3D[0], pos3D[1], pos3D[2], 1.0);
    glMatrix.vec4.transformMat4(temp, temp, viewMatrix);
    glMatrix.vec4.transformMat4(temp, temp, projMatrix);

    if (temp[3] === 0) return null;

    const ndcX = temp[0] / temp[3];
    const ndcY = temp[1] / temp[3];
    const ndcZ = temp[2] / temp[3];

    if (ndcZ < -1 || ndcZ > 1) return null; // behind near/far clip plane

    const x = (ndcX *  0.5 + 0.5) * canvas.clientWidth;
    const y = (ndcY * -0.5 + 0.5) * canvas.clientHeight;
    return { x, y };
}

/**
 * Renders floating entity name labels above hitboxes as HTML overlays.
 * Called every frame from renderWebGL().
 *
 * @param {Float32Array} viewMatrix  Current view matrix
 * @param {Float32Array} projMatrix  Current projection matrix
 */
function updateEntityLabels(viewMatrix, projMatrix) {
    const container = document.getElementById('entity-labels-container');
    if (!container) return;

    container.innerHTML = '';

    if (window.showEntities === false || !window.activeSchematic || !window.activeSchematic.entities) {
        container.innerHTML = '';
        return;
    }

    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;

    const { minX, minY, minZ } = window.activeSchematic.bounds;

    // Collect all label data with depth info for sorting
    const labelData = [];

    window.activeSchematic.entities.forEach(ent => {
        if (window.regionVisibility && window.regionVisibility[ent.region] === false) {
            return;
        }
        const ry = ent.y - minY;
        if (window.renderSliceY && (ry < window.renderSliceY.min || ry > window.renderSliceY.max)) {
            return;
        }
        const rx = ent.x - minX;
        const rz = ent.z - minZ;
        const dim = getEntityDimension(ent.id);

        // Project entity top point
        const topY = ry + dim.h + 0.15;

        // Compute clip-space position to get depth
        const temp = glMatrix.vec4.fromValues(rx, topY, rz, 1.0);
        glMatrix.vec4.transformMat4(temp, temp, viewMatrix);
        glMatrix.vec4.transformMat4(temp, temp, projMatrix);

        if (temp[3] === 0) return;

        const ndcX = temp[0] / temp[3];
        const ndcY = temp[1] / temp[3];
        const ndcZ = temp[2] / temp[3];  // depth: -1 (near) … +1 (far)

        // Cull entities behind camera or outside frustum
        if (ndcZ < -1 || ndcZ > 1.05) return;

        const x = (ndcX *  0.5 + 0.5) * canvas.clientWidth;
        const y = (ndcY * -0.5 + 0.5) * canvas.clientHeight;

        labelData.push({ ent, x, y, ndcZ });
    });

    // Sort: far first so near labels are drawn on top (higher z-index)
    labelData.sort((a, b) => b.ndcZ - a.ndcZ);

    labelData.forEach(({ ent, x, y, ndcZ }, i) => {
        const color = getEntityLabelColor(ent.id);
        const name  = getEntityDisplayName(ent.id);

        const label = document.createElement('div');
        label.style.cssText = `
            position: absolute;
            left: ${x}px;
            top:  ${y}px;
            transform: translate(-50%, -100%);
            pointer-events: none;
            font-family: 'Plus Jakarta Sans', monospace, sans-serif;
            font-size: 10px;
            font-weight: 700;
            color: ${color};
            background: rgba(15,23,42,0.80);
            border: 1px solid ${color}55;
            border-radius: 4px;
            padding: 2px 6px;
            white-space: nowrap;
            backdrop-filter: blur(4px);
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            line-height: 1.4;
            letter-spacing: 0.02em;
            z-index: ${i + 1};
        `;
        label.textContent = name;
        container.appendChild(label);
    });
}
