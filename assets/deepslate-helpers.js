var deepslateResources;

function normalizeBlockstateJson(json) {
    if (!json) return json;
    const copy = JSON.parse(JSON.stringify(json));
    if (Array.isArray(copy.multipart)) {
        copy.multipart.forEach(part => {
            if (part.when) {
                normalizeWhenObject(part.when);
            }
        });
    }
    return copy;
}

function normalizeWhenObject(when) {
    if (!when || typeof when !== 'object') return;
    if (Array.isArray(when.OR)) {
        when.OR.forEach(sub => normalizeWhenObject(sub));
    } else if (Array.isArray(when.AND)) {
        when.AND.forEach(sub => normalizeWhenObject(sub));
    } else {
        Object.keys(when).forEach(key => {
            const val = when[key];
            if (val !== null && val !== undefined && typeof val !== 'object') {
                when[key] = String(val);
            }
        });
    }
}

function upperPowerOfTwo(x) {
	x -= 1
	x |= x >> 1
	x |= x >> 2
	x |= x >> 4
	x |= x >> 8
	x |= x >> 18
	x |= x >> 32
	return x + 1
}

const OPPOSITE_DIRECTIONS = {
    up: 'down',
    down: 'up',
    north: 'south',
    south: 'north',
    east: 'west',
    west: 'east'
};

// In-memory model modifier to duplicate single-sided faces in opposite directions
function makeModelJsonDoubleSided(modelJson) {
    if (!modelJson || !modelJson.elements) return;
    if (modelJson._doubleSidedProcessed) return; // Prevent duplicate execution
    modelJson._doubleSidedProcessed = true;
    
    const duplicatedElements = [];
    modelJson.elements.forEach(element => {
        if (!element.faces) return;
        const duplicate = {
            from: element.from,
            to: element.to,
            shade: element.shade,
            rotation: element.rotation,
            faces: {}
        };
        let hasOpposite = false;
        const currentDirs = Object.keys(element.faces);
        currentDirs.forEach(dir => {
            const opp = OPPOSITE_DIRECTIONS[dir];
            if (opp && element.faces[dir]) {
                duplicate.faces[opp] = { ...element.faces[dir] };
                if (duplicate.faces[opp].cullface) {
                    delete duplicate.faces[opp].cullface;
                }
                hasOpposite = true;
            }
        });
        if (hasOpposite) {
            duplicatedElements.push(duplicate);
        }
    });
    modelJson.elements.push(...duplicatedElements);
}

// Determines if a model needs to be made double-sided in-memory (excluding rails)
function needsDoubleSiding(modelId) {
    const clean = modelId.toLowerCase();
    
    // Torches and redstone components are 3D volumetric models, double-siding is not needed.
    if (clean.includes('torch') || clean.includes('repeater') || clean.includes('comparator')) {
        return false;
    }
    // Grass blocks are full solid 3D blocks, double-siding is not needed.
    if (clean.includes('grass_block')) {
        return false;
    }
    
    return clean.includes('chest') || 
           clean.includes('hopper') || 
           clean.includes('pane') || 
           clean.includes('sapling') || 
           clean.includes('flower') || 
           clean.includes('grass') || 
           clean.includes('fern') || 
           clean.includes('tulip') || 
           clean.includes('dandelion') || 
           clean.includes('poppy') || 
           clean.includes('orchid') || 
           clean.includes('allium') || 
           clean.includes('bluet') || 
           clean.includes('daisy') || 
           clean.includes('cornflower') || 
           clean.includes('valley') || 
           clean.includes('rose') || 
           clean.includes('sunflower') || 
           clean.includes('lilac') || 
           clean.includes('peony') || 
           clean.includes('bush') || 
           clean.includes('vine') || 
           clean.includes('crop') || 
           clean.includes('wheat') || 
           clean.includes('carrot') || 
           clean.includes('potato') || 
           clean.includes('beetroot') || 
           clean.includes('stem') || 
           clean.includes('wart') || 
           clean.includes('cane') || 
           clean.includes('bamboo') || 
           clean.includes('cactus') || 
           clean.includes('spore') || 
           clean.includes('lichen') || 
           clean.includes('vein') || 
           clean.includes('dripleaf') || 
           clean.includes('roots') || 
           clean.includes('seagrass') || 
           clean.includes('door') || 
           clean.includes('trapdoor') || 
           clean.includes('ladder') || 
           clean.includes('iron_bars') || 
           clean.includes('chain');
}

// Override BlockDefinition.prototype.getModelVariants to robustly handle missing state properties (like lit, powered, facing, etc.)
if (typeof deepslate !== 'undefined' && deepslate.BlockDefinition) {
    const originalGetModelVariants = deepslate.BlockDefinition.prototype.getModelVariants;
    deepslate.BlockDefinition.prototype.getModelVariants = function(props) {
        // 1. Try matching with original properties
        let models = originalGetModelVariants.call(this, props);
        if (models && models.length > 0) {
            return models;
        }
        
        // 2. If no match, try default properties for common blockstates
        const fallbackProps = { ...props };
        if (!('lit' in fallbackProps)) fallbackProps['lit'] = 'true';
        if (!('powered' in fallbackProps)) fallbackProps['powered'] = 'false';
        if (!('facing' in fallbackProps)) fallbackProps['facing'] = 'north';
        if (!('half' in fallbackProps)) fallbackProps['half'] = 'lower';
        if (!('open' in fallbackProps)) fallbackProps['open'] = 'false';
        if (!('axis' in fallbackProps)) fallbackProps['axis'] = 'y';
        
        models = originalGetModelVariants.call(this, fallbackProps);
        if (models && models.length > 0) {
            return models;
        }
        
        // 3. Fall back to the first available variant in the definition to prevent invisible block models
        if (this.variants) {
            const keys = Object.keys(this.variants);
            if (keys.length > 0) {
                const variant = this.variants[keys[0]];
                return [Array.isArray(variant) ? variant[0] : variant];
            }
        }
        
        return [];
    };
}

function cloneVertex(v) {
    const pos = new v.pos.constructor(v.pos.x, v.pos.y, v.pos.z);
    const color = v.color ? [...v.color] : undefined;
    const texture = v.texture ? [...v.texture] : undefined;
    const textureLimit = v.textureLimit ? [...v.textureLimit] : undefined;
    const normal = v.normal ? new v.normal.constructor(v.normal.x, v.normal.y, v.normal.z) : undefined;
    const blockPos = v.blockPos ? (Array.isArray(v.blockPos) ? [...v.blockPos] : new v.blockPos.constructor(v.blockPos.x ?? v.blockPos[0], v.blockPos.y ?? v.blockPos[1], v.blockPos.z ?? v.blockPos[2])) : undefined;
    return new v.constructor(pos, color, texture, textureLimit, normal, blockPos);
}

function cloneQuad(q) {
    return new q.constructor(
        cloneVertex(q.v1),
        cloneVertex(q.v2),
        cloneVertex(q.v3),
        cloneVertex(q.v4)
    );
}

function makeMeshDoubleSided(mesh) {
    if (!mesh || !mesh.quads) return;
    try {
        const extraQuads = [];
        mesh.quads.forEach(q => {
            extraQuads.push(cloneQuad(q).reverse());
        });
        mesh.quads.push(...extraQuads);
    } catch (e) {
        console.error("⚠️ Failed to make mesh double sided:", e);
    }
}

// Hook BlockDefinition.prototype.getMesh to make standalone water meshes double-sided
if (typeof deepslate !== 'undefined' && deepslate.BlockDefinition) {
    const originalGetMesh = deepslate.BlockDefinition.prototype.getMesh;
    deepslate.BlockDefinition.prototype.getMesh = function(name, props, atlas, blockModelProvider, cull) {
        const mesh = originalGetMesh.call(this, name, props, atlas, blockModelProvider, cull);
        if (name && name.toString().includes('water') && mesh) {
            makeMeshDoubleSided(mesh);
        }
        return mesh;
    };
}

window.isWaterloggedWaterGeneration = false;
window.activeRenderingChunk = null;
window.activeRenderingChunkBuilder = null;
window.activeRenderingBlock = null;

// Hook Structure.prototype.getBlocks to track the current block being built
if (typeof deepslate !== 'undefined' && deepslate.Structure) {
    const originalGetBlocks = deepslate.Structure.prototype.getBlocks;
    deepslate.Structure.prototype.getBlocks = function() {
        const blocks = originalGetBlocks.call(this);
        return blocks.map(block => {
            return new Proxy(block, {
                get(target, prop, receiver) {
                    if (prop === 'state' || prop === 'pos' || prop === 'nbt') {
                        window.activeRenderingBlock = target;
                    }
                    return Reflect.get(target, prop, receiver);
                }
            });
        });
    };
}

// Hook BlockModel.prototype.getMesh to flag compiled waterlogged water meshes
if (typeof deepslate !== 'undefined' && deepslate.BlockModel) {
    const originalBlockModelGetMesh = deepslate.BlockModel.prototype.getMesh;
    deepslate.BlockModel.prototype.getMesh = function(atlas, cull, tintindex) {
        const mesh = originalBlockModelGetMesh.call(this, atlas, cull, tintindex);
        if (mesh && window.isWaterloggedWaterGeneration) {
            mesh.isWaterloggedWater = true;
        }
        return mesh;
    };
}

// Helper to query liquid level at a specific coordinate. Returns -1 if no liquid.
function getLiquidLevel(structure, pos, type) {
    const block = structure.getBlock(pos)?.state;
    if (!block) return -1;
    if (!block.is(type)) return -1;
    const levelProp = block.getProperties()['level'];
    if (levelProp === undefined) return 0;
    return parseInt(levelProp);
}

// Helper to check if a diagonal neighbor is connected to the corner's fluid system
// via at least one cardinal (orthogonal) liquid block. Directly cardinal neighbors are always connected.
function isOffsetConnected(structure, cx, cy, cz, type, dx, dz) {
    if (dx === 0 || dz === 0) return true; // Direct cardinal neighbor
    
    // Diagonal neighbor -> connected only if at least one cardinal block adjacent to both is liquid
    const hasCardinal1 = getLiquidLevel(structure, [cx + dx, cy, cz], type) >= 0;
    const hasCardinal2 = getLiquidLevel(structure, [cx, cy, cz + dz], type) >= 0;
    return hasCardinal1 || hasCardinal2;
}

// Calculate flow direction angle (radians) from neighboring liquid level gradients.
// Returns null if the liquid is still (no gradient) or falling.
function getLiquidFlowAngle(structure, cx, cy, cz, type) {
    const LEVEL_TO_H = [14.2, 12.5, 10.5, 9.0, 7.0, 5.3, 3.7, 1.9];
    
    function getH(dx, dz) {
        const lvl = getLiquidLevel(structure, [cx + dx, cy, cz + dz], type);
        if (lvl < 0) return null;
        return lvl >= 8 ? 16.0 : LEVEL_TO_H[lvl];
    }
    
    const h0 = getH(0, 0);
    if (h0 === null || h0 >= 16.0) return null; // falling or no liquid
    
    // Sample heights in 4 cardinal directions; use current height as fallback
    const hE = getH(1, 0) ?? h0;
    const hW = getH(-1, 0) ?? h0;
    const hS = getH(0, 1) ?? h0;
    const hN = getH(0, -1) ?? h0;
    
    // Flow vector: liquid flows from high to low (negative gradient)
    const fdx = hW - hE; // positive → flowing east
    const fdz = hN - hS; // positive → flowing south
    
    const mag = Math.sqrt(fdx * fdx + fdz * fdz);
    if (mag < 0.5) return null; // negligible gradient, no visible flow
    return Math.atan2(fdz, fdx);
}

// Helper to determine the corner height by scanning 4 adjacent block columns.
// Minecraft-faithful algorithm: only average positions that actually contain the same liquid.
// Air, solid blocks, and different fluid types are all IGNORED (not pulled into the average).
// This correctly preserves height at walls (solid neighbors are skipped, not averaged as 0).
function getCornerHeight(structure, cx, cy, cz, type, offsets) {
    // Symmetrically filter offsets so that diagonals that aren't cardinally connected are ignored
    const connectedOffsets = offsets.filter(([dx, dz]) => isOffsetConnected(structure, cx, cy, cz, type, dx, dz));

    // If any neighbor above has the same liquid, this corner is at max height (falling liquid)
    for (let [dx, dz] of connectedOffsets) {
        const aboveBlock = structure.getBlock([cx + dx, cy + 1, cz + dz])?.state;
        if (aboveBlock && aboveBlock.is(type)) {
            return 16.0;
        }
    }
    
    // Check if any of the 4 corner-adjacent blocks contains this liquid AND has the same liquid directly below it.
    // This symmetrical check ensures adjacent water blocks calculate identical corner heights.
    let hasBelowWater = false;
    for (let [dx, dz] of connectedOffsets) {
        const lvl = getLiquidLevel(structure, [cx + dx, cy, cz + dz], type);
        if (lvl > 0) {
            const belowBlock = structure.getBlock([cx + dx, cy - 1, cz + dz])?.state;
            if (belowBlock && belowBlock.is(type)) {
                hasBelowWater = true;
                break;
            }
        }
    }
    
    let sumHeight = 0;
    let count = 0;
    const LEVEL_TO_HEIGHT = [14.2, 12.5, 10.5, 9.0, 7.0, 5.3, 3.7, 1.9];
    const MIN_HEIGHT = 0.0; // Minimum liquid height (0.0 to create a steep waterfall slope at boundaries)
    
    for (let [dx, dz] of connectedOffsets) {
        const lvl = getLiquidLevel(structure, [cx + dx, cy, cz + dz], type);
        if (lvl < 0) {
            // If at least one adjacent column has liquid going down, treat dry neighbors
            // as having the minimum height to slope the water surface downwards.
            if (hasBelowWater) {
                sumHeight += MIN_HEIGHT;
                count++;
            }
            continue;
        }
        
        // Falling liquid (level 8-15) gets max height
        const h = lvl >= 8 ? 16.0 : LEVEL_TO_HEIGHT[lvl];
        sumHeight += h;
        count++;
    }
    
    // If no liquid found in any of the 4 surrounding cells, return level-0 default
    if (count === 0) return 14.2;
    return sumHeight / count;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIQUID MESH COMBINER
// Removes internal (back-to-back) faces between adjacent liquid blocks so that
// two connected water boxes look like one continuous body of water.
//
// Algorithm:
//   After ALL quads are merged into the transparent mesh, removeLiquidInternalFaces()
//   scans for pairs of liquid quads that are:
//     • at the same world-space face-center position (within tolerance)
//     • have opposite normals (facing each other = internal face)
//   Both quads in such a pair are discarded, leaving only the outer shell.
//
// This is triggered in the Mesh.prototype.rebuild hook (see below).
// ─────────────────────────────────────────────────────────────────────────────

// Remove all internal face pairs from a mesh's liquid quads.
// mesh.quads that are tagged _isLiquid=true are eligible for deduplication.
function removeLiquidInternalFaces(mesh) {
    if (!mesh?.quads?.length) return 0;
    
    const PREC = 1e4; // round to 4 decimal places
    const r = v => Math.round(v * PREC) / PREC;
    
    // Build a map: faceKey → quad index
    const faceMap = new Map();
    const toRemove = new Set();
    
    mesh.quads.forEach((q, idx) => {
        if (!q._isLiquid) return; // only process tagged liquid quads
        
        // Face center (rounded for stability)
        const cx = r((q.v1.pos.x + q.v2.pos.x + q.v3.pos.x + q.v4.pos.x) * 0.25);
        const cy = r((q.v1.pos.y + q.v2.pos.y + q.v3.pos.y + q.v4.pos.y) * 0.25);
        const cz = r((q.v1.pos.z + q.v2.pos.z + q.v3.pos.z + q.v4.pos.z) * 0.25);
        
        // Face normal (rounded to nearest integer — always ±1 or 0 for flat faces)
        const n = (typeof q.normal === 'function') ? q.normal() : (q.v1.normal || { x: 0, y: 0, z: 0 });
        const nx = Math.round(n.x || 0), ny = Math.round(n.y || 0), nz = Math.round(n.z || 0);
        
        const fwdKey = `${cx},${cy},${cz},${nx},${ny},${nz}`;
        const revKey = `${cx},${cy},${cz},${-nx},${-ny},${-nz}`;
        
        if (faceMap.has(revKey)) {
            // Found the opposing face → both are internal, remove them
            toRemove.add(idx);
            toRemove.add(faceMap.get(revKey));
            faceMap.delete(revKey); // prevent further matches against this pair
        } else {
            faceMap.set(fwdKey, idx);
        }
    });
    
    if (toRemove.size > 0) {
        mesh.quads = mesh.quads.filter((_, i) => !toRemove.has(i));
    }
    return toRemove.size / 2; // number of pairs removed
}

// Helper to warp liquid mesh vertices based on computed corner heights.
// IMPORTANT: deepslate's getBlockMesh returns mesh in [0,1] space (already scaled by 0.0625).
// Heights (H_nw etc.) and defaultHeight must also be in [0,1] space.
//
// Handles two cases:
//  - Top face:   all 4 vertices at defaultHeight → all get warped → sloped surface
//  - Side faces: only the 2 top-edge vertices are at defaultHeight → warped to match
//               the sloped top surface → eliminates gaps between top and side faces
function warpLiquidMesh(mesh, H_nw, H_ne, H_se, H_sw, defaultHeight, structure, cx, cy, cz, type) {
    if (!mesh || !mesh.quads) return 0;
    const EPS = 0.01;
    let warped = 0;
    
    // Determine the flowing direction of the water surface
    let flowAngle = null;
    if (structure && cx !== undefined && cy !== undefined && cz !== undefined && type) {
        flowAngle = getLiquidFlowAngle(structure, cx, cy, cz, type);
    }
    
    mesh.quads.forEach(q => {
        // Tag every quad as liquid so the combiner can find them later
        q._isLiquid = true;
        
        // Detect if this is a side face by checking the Y-coordinate range of its vertices before warping
        const yCoords = [q.v1.pos.y, q.v2.pos.y, q.v3.pos.y, q.v4.pos.y];
        const isSideFace = (Math.max(...yCoords) - Math.min(...yCoords)) > 0.05;
        
        if (isSideFace) {
            // 1. Warp upper vertices first
            [q.v1, q.v2, q.v3, q.v4].forEach(v => {
                if (Math.abs(v.pos.y - defaultHeight) >= EPS * 2) return;
                
                const x = v.pos.x;
                const z = v.pos.z;
                let newH = null;
                
                if      (Math.abs(x)     < EPS && Math.abs(z)     < EPS) newH = H_nw;
                else if (Math.abs(x - 1) < EPS && Math.abs(z)     < EPS) newH = H_ne;
                else if (Math.abs(x - 1) < EPS && Math.abs(z - 1) < EPS) newH = H_se;
                else if (Math.abs(x)     < EPS && Math.abs(z - 1) < EPS) newH = H_sw;
                
                if (newH === null) return;
                v.pos.y = newH;
                warped++;
            });
            
            // 2. Symmetrically scale all 4 vertices' V coordinate.
            // Scale by 0.5 to fix the 2x texture quality bug, multiplied by the height ratio of the side face.
            const vAnchor = Math.min(q.v1.texture[1], q.v2.texture[1], q.v3.texture[1], q.v4.texture[1]);
            const maxYAfterWarp = Math.max(q.v1.pos.y, q.v2.pos.y, q.v3.pos.y, q.v4.pos.y);
            const ratio = maxYAfterWarp / defaultHeight;
            
            [q.v1, q.v2, q.v3, q.v4].forEach(v => {
                if (v.texture && v.texture.length >= 2) {
                    v.texture[1] = vAnchor + (v.texture[1] - vAnchor) * 0.5 * ratio;
                }
            });
        } else {
            // Top face: warp Y coordinates only
            [q.v1, q.v2, q.v3, q.v4].forEach(v => {
                if (Math.abs(v.pos.y - defaultHeight) >= EPS * 2) return;
                
                const x = v.pos.x;
                const z = v.pos.z;
                let newH = null;
                
                if      (Math.abs(x)     < EPS && Math.abs(z)     < EPS) newH = H_nw;
                else if (Math.abs(x - 1) < EPS && Math.abs(z)     < EPS) newH = H_ne;
                else if (Math.abs(x - 1) < EPS && Math.abs(z - 1) < EPS) newH = H_se;
                else if (Math.abs(x)     < EPS && Math.abs(z - 1) < EPS) newH = H_sw;
                
                if (newH === null) return;
                v.pos.y = newH;
                warped++;
            });
            
            // Apply Minecraft-faithful flow direction rotation to the top-face UVs
            if (flowAngle !== null) {
                const theta = -flowAngle; // Reverse the flow angle direction to correct orientation
                const cos = Math.cos(theta);
                const sin = Math.sin(theta);
                const scale = 1.0; // Use 1.0 to preserve native pixel resolution/sharpness
                
                const uCoords = [q.v1.texture[0], q.v2.texture[0], q.v3.texture[0], q.v4.texture[0]];
                const vCoords = [q.v1.texture[1], q.v2.texture[1], q.v3.texture[1], q.v4.texture[1]];
                const u_min = Math.min(...uCoords);
                const u_max = Math.max(...uCoords);
                const v_min = Math.min(...vCoords);
                const v_max = Math.max(...vCoords);
                const u_span = u_max - u_min;
                const v_span = v_max - v_min;
                
                // Dynamically detect which liquid texture this quad maps to by checking bounds overlap
                let bounds3x3 = null;
                const centerU = (u_min + u_max) * 0.5;
                const centerV = (v_min + v_max) * 0.5;
                for (const key of Object.keys(window.liquidUvBounds)) {
                    const b = window.liquidUvBounds[key];
                    if (b && centerU >= b[0] && centerU <= b[2] && centerV >= b[1] && centerV <= b[3]) {
                        bounds3x3 = b;
                        break;
                    }
                }
                if (!bounds3x3) {
                    const boundsKey = (type && type.includes('lava')) ? 'minecraft:block/lava_still' : 'minecraft:block/water_flow';
                    bounds3x3 = window.liquidUvBounds[boundsKey] || window.liquidUvBounds['minecraft:block/water_still'];
                }
                
                // Epsilon sub-pixel padding
                const PAD = 0.0001;
                let u_limit_min = u_min + PAD;
                let u_limit_max = u_max - PAD;
                let v_limit_min = v_min + PAD;
                let v_limit_max = v_max - PAD;
                
                if (bounds3x3) {
                    u_limit_min = bounds3x3[0] + PAD;
                    v_limit_min = bounds3x3[1] + PAD;
                    u_limit_max = bounds3x3[2] - PAD;
                    v_limit_max = bounds3x3[3] - PAD;
                }
                
                [q.v1, q.v2, q.v3, q.v4].forEach(v => {
                    if (v.texture && v.texture.length >= 2) {
                        const u_local = u_span > 0 ? (v.texture[0] - u_min) / u_span : 0.5;
                        const v_local = v_span > 0 ? (v.texture[1] - v_min) / v_span : 0.5;
                        
                        // Shrink towards center (0.5, 0.5) to keep rotation within [0,1] bounds
                        const us = 0.5 + (u_local - 0.5) * scale;
                        const vs = 0.5 + (v_local - 0.5) * scale;
                        
                        // Rotate around center
                        const ur = 0.5 + (us - 0.5) * cos - (vs - 0.5) * sin;
                        const vr = 0.5 + (us - 0.5) * sin + (vs - 0.5) * cos;
                        
                        // Map back to atlas space and clamp strictly inside expanded bounds
                        v.texture[0] = Math.max(u_limit_min, Math.min(u_limit_max, u_min + ur * u_span));
                        v.texture[1] = Math.max(v_limit_min, Math.min(v_limit_max, v_min + vr * v_span));
                    }
                });
            }
        }
    });
    return warped;
}



// Hook SpecialRenderers.getBlockMesh to intercept waterlogged water mesh compilation,
// skip SpecialRenderers for beds and signs, and dynamically connect adjacent liquid heights.
if (typeof deepslate !== 'undefined' && deepslate.SpecialRenderers && deepslate.SpecialRenderers.getBlockMesh) {
    const originalGetBlockMesh = deepslate.SpecialRenderers.getBlockMesh;
    deepslate.SpecialRenderers.getBlockMesh = function(block, nbt, atlas, cull) {
        window.activeRenderingCull = cull;
        try {
            const blockName = (typeof block === 'string') ? block : (block && typeof block.getName === 'function' ? block.getName().toString() : '');
            const cleanName = blockName.toLowerCase();
            
            // Skip SpecialRenderers for beds and signs because they are already fully and beautifully
            // rendered by normal block models.
            if ((cleanName.includes('bed') && !cleanName.includes('bedrock')) || cleanName.includes('sign')) {
                return new deepslate.Mesh();
            }



            // Check if this block is water or lava itself
            const isWater = cleanName === 'water' || cleanName === 'minecraft:water';
            const isLava = cleanName === 'lava' || cleanName === 'minecraft:lava';
            
            if ((isWater || isLava) && window.structure && window.activeRenderingBlock) {
                const type = isWater ? 'water' : 'lava';
                const pos = window.activeRenderingBlock.pos;
                const levelProp = block.getProperties()['level'];
                const level = levelProp !== undefined ? parseInt(levelProp) : 0;
                
                // Heights in [0,16] space (as used by deepslate's hi() function internally)
                const LEVEL_TO_HEIGHT_16 = [14.2, 12.5, 10.5, 9.0, 7.0, 5.3, 3.7, 1.9, 16.0, 16.0, 16.0, 16.0, 16.0, 16.0, 16.0, 16.0];
                const rawDefaultHeight = cull['up'] ? 16.0 : LEVEL_TO_HEIGHT_16[level];
                
                // Build flat liquid mesh using original renderer
                // The returned mesh is in [0,1] space (deepslate applies ×0.0625 internally)
                const mesh = originalGetBlockMesh.call(this, block, nbt, atlas, cull);
                
                // Convert defaultHeight to [0,1] space to match returned mesh coordinates
                const defaultHeight01 = rawDefaultHeight / 16.0;
                
                // Calculate corner heights in [0,1] space
                const cx = pos[0];
                const cy = pos[1];
                const cz = pos[2];
                const mcType = 'minecraft:' + type;
                
                const H_nw = getCornerHeight(window.structure, cx, cy, cz, mcType, [[0, 0], [-1, 0], [0, -1], [-1, -1]]) / 16.0;
                const H_ne = getCornerHeight(window.structure, cx, cy, cz, mcType, [[0, 0], [1, 0], [0, -1], [1, -1]]) / 16.0;
                const H_se = getCornerHeight(window.structure, cx, cy, cz, mcType, [[0, 0], [1, 0], [0, 1], [1, 1]]) / 16.0;
                const H_sw = getCornerHeight(window.structure, cx, cy, cz, mcType, [[0, 0], [-1, 0], [0, 1], [-1, 1]]) / 16.0;
                
                // Warp top-face vertices to produce sloped liquid surface and rotate UV based on flow direction
                warpLiquidMesh(mesh, H_nw, H_ne, H_se, H_sw, defaultHeight01, window.structure, cx, cy, cz, mcType);
                
                return mesh;
            }

            // Check if this block is waterlogged (and not water/lava itself)
            const isWaterlogged = (block && typeof block.isWaterlogged === 'function' && block.isWaterlogged());
            const isWaterloggedParent = isWaterlogged && !isWater && !isLava;
            
            if (isWaterloggedParent) {
                window.isWaterloggedWaterGeneration = true;
                try {
                    return originalGetBlockMesh.call(this, block, nbt, atlas, cull);
                } finally {
                    window.isWaterloggedWaterGeneration = false;
                }
            }
            
            return originalGetBlockMesh.call(this, block, nbt, atlas, cull);
        } finally {
            window.activeRenderingCull = null;
        }
    };
}

// Hook Mesh.prototype.merge to scale down and redirect waterlogged water meshes
if (typeof deepslate !== 'undefined' && deepslate.Mesh) {
    const originalMerge = deepslate.Mesh.prototype.merge;
    deepslate.Mesh.prototype.merge = function(other) {
        if (other && other.isWaterloggedWater) {
            try {
                // Warp waterlogged water mesh vertices to connect heights smoothly.
                // NOTE: at this point 'other' is still in [0,16] space (before the 0.0625 unit scale).
                // So we use raw [0,16] heights from getCornerHeight, and [0,16] defaultHeight.
                if (window.structure && window.activeRenderingBlock) {
                    const pos = window.activeRenderingBlock.pos;
                    const cull = window.activeRenderingCull || {};
                    // Default top height in [0,16] space
                    const defaultHeight16 = cull['up'] ? 16.0 : 14.2;
                    const cx = pos[0];
                    const cy = pos[1];
                    const cz = pos[2];
                    
                    // getCornerHeight returns [0,16] range values — pass directly
                    const H_nw = getCornerHeight(window.structure, cx, cy, cz, 'minecraft:water', [[0, 0], [-1, 0], [0, -1], [-1, -1]]);
                    const H_ne = getCornerHeight(window.structure, cx, cy, cz, 'minecraft:water', [[0, 0], [1, 0], [0, -1], [1, -1]]);
                    const H_se = getCornerHeight(window.structure, cx, cy, cz, 'minecraft:water', [[0, 0], [1, 0], [0, 1], [1, 1]]);
                    const H_sw = getCornerHeight(window.structure, cx, cy, cz, 'minecraft:water', [[0, 0], [-1, 0], [0, 1], [-1, 1]]);
                    
                    // Warp top-face and side-face top-edge vertices in [0,16] space
                    const EPS16 = 0.5;
                    other.quads && other.quads.forEach(q => {
                        // Tag waterlogged quads as liquid so they can be merged/deduplicated as well
                        q._isLiquid = true;
                        
                        // Detect if this is a side face by checking the Y-coordinate range of its vertices before warping
                        const yCoords = [q.v1.pos.y, q.v2.pos.y, q.v3.pos.y, q.v4.pos.y];
                        const isSideFace = (Math.max(...yCoords) - Math.min(...yCoords)) > 1.0;
                        
                        if (isSideFace) {
                            // 1. Warp upper vertices first in [0,16] space
                            [q.v1, q.v2, q.v3, q.v4].forEach(v => {
                                if (Math.abs(v.pos.y - defaultHeight16) >= EPS16) return;
                                const x = v.pos.x, z = v.pos.z;
                                let newH = null;
                                if      (Math.abs(x)    < EPS16 && Math.abs(z)    < EPS16) newH = H_nw;
                                else if (Math.abs(x-16) < EPS16 && Math.abs(z)    < EPS16) newH = H_ne;
                                else if (Math.abs(x-16) < EPS16 && Math.abs(z-16) < EPS16) newH = H_se;
                                else if (Math.abs(x)    < EPS16 && Math.abs(z-16) < EPS16) newH = H_sw;
                                if (newH !== null) v.pos.y = newH;
                            });
                            
                            // 2. Symmetrically scale all 4 vertices' V coordinate.
                            // Scale by 0.5 to fix the 2x texture quality bug, multiplied by the height ratio.
                            const vAnchor = Math.min(q.v1.texture[1], q.v2.texture[1], q.v3.texture[1], q.v4.texture[1]);
                            const maxYAfterWarp = Math.max(q.v1.pos.y, q.v2.pos.y, q.v3.pos.y, q.v4.pos.y);
                            const ratio = maxYAfterWarp / defaultHeight16;
                            
                            [q.v1, q.v2, q.v3, q.v4].forEach(v => {
                                if (v.texture && v.texture.length >= 2) {
                                    v.texture[1] = vAnchor + (v.texture[1] - vAnchor) * 0.5 * ratio;
                                }
                            });
                        } else {
                            // Top face: warp Y coordinates only, leaving UV mapping unchanged
                            [q.v1, q.v2, q.v3, q.v4].forEach(v => {
                                if (Math.abs(v.pos.y - defaultHeight16) >= EPS16) return;
                                const x = v.pos.x, z = v.pos.z;
                                let newH = null;
                                if      (Math.abs(x)    < EPS16 && Math.abs(z)    < EPS16) newH = H_nw;
                                else if (Math.abs(x-16) < EPS16 && Math.abs(z)    < EPS16) newH = H_ne;
                                else if (Math.abs(x-16) < EPS16 && Math.abs(z-16) < EPS16) newH = H_se;
                                else if (Math.abs(x)    < EPS16 && Math.abs(z-16) < EPS16) newH = H_sw;
                                if (newH !== null) v.pos.y = newH;
                            });
                            
                            // Apply flow direction rotation to the waterlogged top-face UVs
                            const flowAngle = getLiquidFlowAngle(window.structure, cx, cy, cz, 'minecraft:water');
                            if (flowAngle !== null) {
                                const theta = -flowAngle; // Reverse the flow angle direction to correct orientation
                                const cos = Math.cos(theta);
                                const sin = Math.sin(theta);
                                const scale = 1.0;
                                
                                const uCoords = [q.v1.texture[0], q.v2.texture[0], q.v3.texture[0], q.v4.texture[0]];
                                const vCoords = [q.v1.texture[1], q.v2.texture[1], q.v3.texture[1], q.v4.texture[1]];
                                const u_min = Math.min(...uCoords);
                                const u_max = Math.max(...uCoords);
                                const v_min = Math.min(...vCoords);
                                const v_max = Math.max(...vCoords);
                                const u_span = u_max - u_min;
                                const v_span = v_max - v_min;
                                
                                // Dynamically detect which liquid texture this quad maps to by checking bounds overlap
                                let bounds3x3 = null;
                                const centerU = (u_min + u_max) * 0.5;
                                const centerV = (v_min + v_max) * 0.5;
                                for (const key of Object.keys(window.liquidUvBounds)) {
                                    const b = window.liquidUvBounds[key];
                                    if (b && centerU >= b[0] && centerU <= b[2] && centerV >= b[1] && centerV <= b[3]) {
                                        bounds3x3 = b;
                                        break;
                                    }
                                }
                                if (!bounds3x3) {
                                    bounds3x3 = window.liquidUvBounds['minecraft:block/water_still'] || window.liquidUvBounds['minecraft:block/water_flow'];
                                }
                                
                                const PAD = 0.0001;
                                let u_limit_min = u_min + PAD;
                                let u_limit_max = u_max - PAD;
                                let v_limit_min = v_min + PAD;
                                let v_limit_max = v_max - PAD;
                                
                                if (bounds3x3) {
                                    u_limit_min = bounds3x3[0] + PAD;
                                    v_limit_min = bounds3x3[1] + PAD;
                                    u_limit_max = bounds3x3[2] - PAD;
                                    v_limit_max = bounds3x3[3] - PAD;
                                }
                                
                                [q.v1, q.v2, q.v3, q.v4].forEach(v => {
                                    if (v.texture && v.texture.length >= 2) {
                                        const u_local = u_span > 0 ? (v.texture[0] - u_min) / u_span : 0.5;
                                        const v_local = v_span > 0 ? (v.texture[1] - v_min) / v_span : 0.5;
                                        const us = 0.5 + (u_local - 0.5) * scale;
                                        const vs = 0.5 + (v_local - 0.5) * scale;
                                        const ur = 0.5 + (us - 0.5) * cos - (vs - 0.5) * sin;
                                        const vr = 0.5 + (us - 0.5) * sin + (vs - 0.5) * cos;
                                        v.texture[0] = Math.max(u_limit_min, Math.min(u_limit_max, u_min + ur * u_span));
                                        v.texture[1] = Math.max(v_limit_min, Math.min(v_limit_max, v_min + vr * v_span));
                                    }
                                });
                            }
                        }
                    });
                }

                // Scale the water mesh slightly to prevent Z-fighting.
                // The water mesh inside getBlockMesh is in [0, 16] space, so we scale around [8, 8, 8].
                const shrinkMat = glMatrix.mat4.create();
                glMatrix.mat4.translate(shrinkMat, shrinkMat, [8, 8, 8]);
                glMatrix.mat4.scale(shrinkMat, shrinkMat, [0.995, 0.995, 0.995]);
                glMatrix.mat4.translate(shrinkMat, shrinkMat, [-8, -8, -8]);
                const scaledWater = other.transform(shrinkMat);
                
                // Make the waterlogged water double-sided so it renders from inside/outside.
                makeMeshDoubleSided(scaledWater);
                
                if (window.activeRenderingChunk && window.activeRenderingChunk.transparentMesh && window.activeRenderingChunkBuilder && window.activeRenderingBlock) {
                    // Scale the waterlogged water down to unit [0, 1] scale since we are bypassing ChunkBuilder's
                    // default scaling step and merging it directly into the chunk's transparentMesh.
                    const unitScaleMat = glMatrix.mat4.create();
                    glMatrix.mat4.scale(unitScaleMat, unitScaleMat, [0.0625, 0.0625, 0.0625]);
                    const unitScaledWater = scaledWater.transform(unitScaleMat);

                    // Call finishChunkMesh manually to translate the water mesh to block position and assign normals/blockPos!
                    window.activeRenderingChunkBuilder.finishChunkMesh(unitScaledWater, window.activeRenderingBlock.pos);
                    
                    // Merge directly into the chunk's transparent mesh (rendered in the transparent pass).
                    originalMerge.call(window.activeRenderingChunk.transparentMesh, unitScaledWater);
                    // Return this (the parent mesh) without merging the water quads into it.
                    return this;
                } else {
                    // Fallback for standalone rendering outside chunk builder: merge scaled water normally.
                    return originalMerge.call(this, scaledWater);
                }
            } catch (err) {
                console.error("⚠️ Error handling waterlogged water mesh merge:", err);
            }
        }
        return originalMerge.call(this, other);
    };
}

// Hook ChunkBuilder.prototype.getChunk to track the active chunk being built
if (typeof deepslate !== 'undefined' && deepslate.ChunkBuilder) {
    const originalGetChunk = deepslate.ChunkBuilder.prototype.getChunk;
    deepslate.ChunkBuilder.prototype.getChunk = function(m) {
        const chunk = originalGetChunk.call(this, m);
        window.activeRenderingChunk = chunk;
        window.activeRenderingChunkBuilder = this;
        return chunk;
    };
}

// Determines if a block name belongs in the transparent rendering pass
function shouldBeTransparent(name) {
    const clean = name.toLowerCase();
    if (clean.includes('packed_ice') || clean.includes('blue_ice')) {
        return false;
    }
    return clean.includes('stained_glass') || 
           clean.includes('water') || 
           clean.includes('slime') || 
           clean.includes('honey') || 
           clean.includes('portal') ||
           (clean.includes('ice') && !clean.includes('packed_ice') && !clean.includes('blue_ice'));
}

var cachedBlockDefinitionsVanilla = null;
var cachedBlockModelsVanilla = null;
var cachedBlockDefinitionsTech = null;
var cachedBlockModelsTech = null;

// Load Deepslate resources from texture atlas image
// Compatible with Deepslate 0.26.0
function loadDeepslateResources(textureImage) {
  console.log("🎨 Loading block definitions and models into Deepslate...");
  
  const isTech = !!window.useTechnicalMode;
  let currentDefs = isTech ? cachedBlockDefinitionsTech : cachedBlockDefinitionsVanilla;
  let currentModels = isTech ? cachedBlockModelsTech : cachedBlockModelsVanilla;
  
  // Decide which blockstates/models data source to use
  let sourceBlockstates = null;
  let sourceModels = null;
  
  if (isTech) {
      sourceBlockstates = window.ATLAS_TECHNICAL_BLOCKSTATES || assets.blockstates;
      sourceModels = window.ATLAS_TECHNICAL_MODELS || assets.models;
  } else {
      sourceBlockstates = window.ATLAS_BLOCKSTATES || assets.blockstates;
      sourceModels = window.ATLAS_MODELS || assets.models;
  }
  
  if (!currentDefs || !currentModels) {
    currentDefs = {};
    Object.keys(sourceBlockstates).forEach(id => {
      const normalizedState = normalizeBlockstateJson(sourceBlockstates[id]);
      currentDefs['minecraft:' + id] = deepslate.BlockDefinition.fromJson(normalizedState);
    });

    currentModels = {};
    Object.keys(sourceModels).forEach(id => {
      const rawModel = sourceModels[id];
      // Perform deep copy to prevent mutating the original global object
      const rawModelClone = JSON.parse(JSON.stringify(rawModel));
      
      // Normalize custom texture objects (e.g. { force_translucent: true, sprite: "..." }) to simple strings for Deepslate compatibility
      if (rawModelClone.textures) {
          Object.keys(rawModelClone.textures).forEach(key => {
              const val = rawModelClone.textures[key];
              if (val && typeof val === 'object' && val.sprite) {
                  rawModelClone.textures[key] = val.sprite;
              }
          });
      }
      
      if (needsDoubleSiding(id)) {
          makeModelJsonDoubleSided(rawModelClone);
      }
      currentModels['minecraft:' + id] = deepslate.BlockModel.fromJson(rawModelClone);
    });
    Object.values(currentModels).forEach(m => m.flatten({ getBlockModel: id => currentModels[id.toString()] }));
    
    // Cache the parsed models
    if (isTech) {
        cachedBlockDefinitionsTech = currentDefs;
        cachedBlockModelsTech = currentModels;
    } else {
        cachedBlockDefinitionsVanilla = currentDefs;
        cachedBlockModelsVanilla = currentModels;
    }
    console.log(`📦 Parsed block models and definitions for ${isTech ? "Technical" : "Vanilla"} (cached).`);
  } else {
    console.log(`⚡ Reusing cached block models and definitions for ${isTech ? "Technical" : "Vanilla"}.`);
  }

  window.liquidUvBounds = {};

  const originalSize = upperPowerOfTwo((textureImage.width >= textureImage.height) ? textureImage.width : textureImage.height);
  // Expand atlas to 2x size to provide clean, isolated empty spaces for 3x3 tiling
  const atlasSize = originalSize * 2;
  
  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = atlasSize;
  atlasCanvas.height = atlasSize;

  const atlasCtx = atlasCanvas.getContext('2d');
  atlasCtx.clearRect(0, 0, atlasSize, atlasSize);
  atlasCtx.drawImage(textureImage, 0, 0);

  // Helper to clone and stitch 3x3 tiles at the clean padding area of the expanded atlas
  function create3x3Liquid(key, new_u, new_v) {
      const mapData = activeMapping[key];
      if (!mapData) return null;
      const [u, v, du, dv] = mapData;
      const real_dv = (du !== dv) ? du : dv; // Use single frame height for animated flows
      
      try {
          const imgData = atlasCtx.getImageData(u, v, du, real_dv);
          for (let i = 0; i < 3; i++) {
              for (let j = 0; j < 3; j++) {
                  atlasCtx.putImageData(imgData, new_u + i * du, new_v + j * real_dv);
              }
          }
          // Save the 3x3 expanded bounds in atlas space
          window.liquidUvBounds['minecraft:' + key] = [
              new_u / atlasSize,
              new_v / atlasSize,
              (new_u + 3 * du) / atlasSize,
              (new_v + 3 * real_dv) / atlasSize
          ];
          // Return the central 1x1 tile bounds
          return [new_u + du, new_v + real_dv, du, real_dv];
      } catch (e) {
          console.error("⚠️ Failed to generate 3x3 liquid texture for " + key, e);
          return null;
      }
  }

  // Choose the mapping coordinates based on active texture mode
  const activeMapping = isTech ? (window.ATLAS_TECHNICAL_MAP || {}) : (window.ATLAS_MAP || {});

  // Generate 3x3 water/lava textures in clean expanded region
  const waterStill3x3 = create3x3Liquid('block/water_still', originalSize + 32, originalSize + 32);
  const waterFlow3x3 = create3x3Liquid('block/water_flow', originalSize + 512, originalSize + 32);
  const lavaStill3x3 = create3x3Liquid('block/lava_still', originalSize + 1024, originalSize + 32);
  const lavaFlow3x3 = create3x3Liquid('block/lava_flow', originalSize + 1536, originalSize + 32);

  const idMap = {};
  Object.keys(activeMapping).forEach(id => {
        let coords = activeMapping[id];
        if (id === 'block/water_still' && waterStill3x3) coords = waterStill3x3;
        else if (id === 'block/water_flow' && waterFlow3x3) coords = waterFlow3x3;
        else if (id === 'block/lava_still' && lavaStill3x3) coords = lavaStill3x3;
        else if (id === 'block/lava_flow' && lavaFlow3x3) coords = lavaFlow3x3;
        
        const [u, v, du, dv] = coords;
        const dv2 = (du !== dv && id.startsWith('block/')) ? du : dv;
        idMap['minecraft:' + id] = [u / atlasSize, v / atlasSize, (u + du) / atlasSize, (v + dv2) / atlasSize];
    });

  const atlasData = atlasCtx.getImageData(0, 0, atlasSize, atlasSize);

  const textureAtlas = new deepslate.TextureAtlas(atlasData, idMap);

  window.deepslateResources = {
    getBlockDefinition(id) { return currentDefs[id.toString()] },
    getBlockModel(id) { return currentModels[id.toString()] },
    getTextureUV(id) {
        const idStr = id.toString();
        let uv = textureAtlas.getTextureUV(id);
        
        if (!uv) {
            // Intelligent Fallback for Bed entity textures: map to corresponding Wool block textures
            if (idStr.startsWith('minecraft:entity/bed/')) {
                const color = idStr.substring('minecraft:entity/bed/'.length);
                const woolId = `minecraft:block/${color}_wool`;
                uv = textureAtlas.getTextureUV(woolId) || 
                     textureAtlas.getTextureUV('minecraft:block/red_wool') || 
                     textureAtlas.getTextureUV('minecraft:block/white_wool');
                if (uv) {
                    console.log(`💡 Antigravity: Applied wool fallback for bed texture '${idStr}' -> '${woolId}'`);
                }
            }
            // Intelligent Fallback for Sign entity textures: map to corresponding Planks block textures
            else if (idStr.startsWith('minecraft:entity/signs/')) {
                const wood = idStr.substring('minecraft:entity/signs/'.length);
                const planksId = `minecraft:block/${wood}_planks`;
                uv = textureAtlas.getTextureUV(planksId) || 
                     textureAtlas.getTextureUV('minecraft:block/oak_planks');
                if (uv) {
                    console.log(`💡 Antigravity: Applied planks fallback for sign texture '${idStr}' -> '${planksId}'`);
                }
            }
        }
        return uv;
    },
    getTextureAtlas() { return textureAtlas.getTextureAtlas() },
    getBlockFlags(id) {
        const name = id.toString();
        return {
            opaque: OPAQUE_BLOCKS.has(name),
            semi_transparent: shouldBeTransparent(name),
            self_culling: !NON_SELF_CULLING.has(name)
        }
    },
    getBlockProperties(id) { return null },
    getDefaultBlockProperties(id) { return null },
  }

  console.log("✅ Deepslate resources loaded. Mapped texture count:", Object.keys(activeMapping).length);
  return window.deepslateResources;
}

// Hook ChunkBuilder.prototype.needsCull to fix see-through gaps on partial blocks (slabs, stairs, fences, etc.)
if (typeof deepslate !== 'undefined' && deepslate.ChunkBuilder) {
    const originalNeedsCull = deepslate.ChunkBuilder.prototype.needsCull;
    
    // Helper to check if two block property objects are identical
    function arePropertiesEqual(p1, p2) {
        if (!p1 || !p2) return true;
        const keys1 = Object.keys(p1);
        const keys2 = Object.keys(p2);
        if (keys1.length !== keys2.length) return false;
        for (let k of keys1) {
            if (p1[k] !== p2[k]) return false;
        }
        return true;
    }
    
    deepslate.ChunkBuilder.prototype.needsCull = function(block, dir) {
        const neighbor = this.structure.getBlock(deepslate.BlockPos.towards(block.pos, dir))?.state;
        if (!neighbor) return false;
        
        const currentName = block.state.getName().toString();
        const neighborName = neighbor.getName().toString();
        const neighborFlags = this.resources.getBlockFlags(neighbor.getName());
        
        // 1. Same block culling: Only cull if properties are identical (except for liquids)
        if (block.state.getName().equals(neighbor.getName()) && neighborFlags?.self_culling) {
            const isLiquid = currentName.includes('water') || currentName.includes('lava');
            if (isLiquid) {
                return true; // Always cull adjacent liquid faces of the same type to prevent internal separating meshes
            }
            const currentProps = block.state.getProperties();
            const neighborProps = neighbor.getProperties();
            if (!arePropertiesEqual(currentProps, neighborProps)) {
                return false; // Do not cull if properties (like slab type bottom/top/double) differ
            }
            return true;
        }
        
        // 2. Fix partial blocks (slabs, stairs, etc.) adjacent to solid blocks:
        const isPartial = currentName.includes('slab') || 
                          currentName.includes('stairs') || 
                          currentName.includes('fence') || 
                          currentName.includes('pane') || 
                          currentName.includes('wall') || 
                          currentName.includes('door') || 
                          currentName.includes('trapdoor') || 
                          currentName.includes('carpet') ||
                          currentName.includes('chest') ||
                          currentName.includes('hopper') ||
                          currentName.includes('glass') ||
                          currentName.includes('scaffolding');
                          
        if (isPartial) {
            return false;
        }
        
        // 3. Fallback to original culling logic for standard solid blocks
        return originalNeedsCull.call(this, block, dir);
    };
}

// Hook Mesh.prototype.rebuild to automatically deduplicate back-to-back liquid faces
if (typeof deepslate !== 'undefined' && deepslate.Mesh) {
    const originalRebuild = deepslate.Mesh.prototype.rebuild;
    deepslate.Mesh.prototype.rebuild = function(gl, options) {
        // Run internal liquid face removal just before GPU buffer compilation
        removeLiquidInternalFaces(this);
        return originalRebuild.call(this, gl, options);
    };
}

