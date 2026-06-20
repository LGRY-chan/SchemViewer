/**
 * parser.js
 * Pure Litematica (.litematic) NBT Parser Module.
 * Decompresses and extracts schematic metadata, block states, coordinates, and entities.
 */

/**
 * Decompresses and parses a .litematic file array buffer.
 * @param {ArrayBuffer} gzippedBuffer 
 * @returns {Promise<Object>} Unpacked schematic layout
 */
/**
 * Groups directional/wall-mounted block state IDs into their unified survival inventory item ID.
 * Returns null if the block state represents an extra portion of a multi-block object (like the top half of a door or the head of a bed) to avoid duplicate counts.
 */
function getRepresentativeItemId(blockId, properties = {}) {
    // 1. multi-block pieces count correction
    // Doors: Only count the lower half
    if (blockId.endsWith('_door') && properties.half === 'upper') {
        return null;
    }
    // Beds: Only count the foot half
    if (blockId.endsWith('_bed') && properties.part === 'head') {
        return null;
    }

    let itemId = blockId;

    // 2. Wall Torches -> Torches
    if (itemId === 'minecraft:redstone_wall_torch') itemId = 'minecraft:redstone_torch';
    else if (itemId === 'minecraft:soul_wall_torch') itemId = 'minecraft:soul_torch';
    else if (itemId === 'minecraft:wall_torch') itemId = 'minecraft:torch';

    // 3. Wall Heads/Skulls -> Heads/Skulls
    else if (itemId.endsWith('_wall_skull')) itemId = itemId.replace('_wall_skull', '_skull');
    else if (itemId.endsWith('_wall_head')) itemId = itemId.replace('_wall_head', '_head');

    // 4. Wall Signs & Hanging Signs -> Standard equivalents
    else if (itemId.endsWith('_wall_sign')) itemId = itemId.replace('_wall_sign', '_sign');
    else if (itemId.endsWith('_wall_hanging_sign')) itemId = itemId.replace('_wall_hanging_sign', '_hanging_sign');

    // 5. Wall Banners -> Banners
    else if (itemId.endsWith('_wall_banner')) itemId = itemId.replace('_wall_banner', '_banner');

    // 6. Placed Block wires -> Inventory Item equivalents
    else if (itemId === 'minecraft:redstone_wire') itemId = 'minecraft:redstone';
    else if (itemId === 'minecraft:tripwire') itemId = 'minecraft:string';

    // 7. Bubble Column -> Water block
    else if (itemId === 'minecraft:bubble_column') itemId = 'minecraft:water';

    return itemId;
}

/**
 * Decompresses and parses a .litematic file array buffer.
 * @param {ArrayBuffer} gzippedBuffer 
 * @returns {Promise<Object>} Unpacked schematic layout
 */
async function parseLitematic(gzippedBuffer) {
    console.log("📦 Starting .litematic decompression & parsing...");
    
    // 1. Gzip Decompression (native browser DecompressionStream)
    let decompressedBuffer;
    try {
        const ds = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        writer.write(gzippedBuffer);
        writer.close();
        
        const response = new Response(ds.readable);
        decompressedBuffer = await response.arrayBuffer();
        console.log(`   Decompression successful. Size: ${gzippedBuffer.byteLength} -> ${decompressedBuffer.byteLength} bytes.`);
    } catch (err) {
        console.error("❌ Gzip decompression failed:", err);
        throw new Error("Failed to decompress Gzip stream. Is this a valid .litematic file?");
    }

    // 2. Parse NBT structure using Deepslate
    let nbtFile;
    try {
        nbtFile = deepslate.NbtFile.read(new Uint8Array(decompressedBuffer));
        console.log("✅ NBT parsed successfully using Deepslate reader.");
    } catch (err) {
        console.error("❌ NBT parsing failed:", err);
        throw new Error("Failed to parse NBT layout with Deepslate.");
    }

    const root = nbtFile.root;
    if (!root) {
        throw new Error("Invalid NBT: No root compound found.");
    }

    // 3. Extract Metadata
    const metadataNbt = root.get('Metadata');
    const metadata = {
        name: metadataNbt?.get('Name')?.value || "Unnamed Schematic",
        author: metadataNbt?.get('Author')?.value || "Anonymous",
        description: metadataNbt?.get('Description')?.value || "",
        totalBlocks: metadataNbt?.get('TotalBlocks')?.value || 0,
        totalVolume: metadataNbt?.get('TotalVolume')?.value || 0,
        mcVersion: root.get('MinecraftDataVersion')?.value || "1.20"
    };
    console.log("   Metadata extracted:", metadata);

    // 4. Extract Regions
    const regionsNbt = root.get('Regions');
    if (!regionsNbt) {
        throw new Error("Invalid Litematica NBT: No 'Regions' compound tag found.");
    }

    const regionKeys = [...regionsNbt.keys()];
    if (regionKeys.length === 0) {
        throw new Error("Invalid Litematica NBT: 'Regions' contains no subregions.");
    }
    
    console.log(`   Found ${regionKeys.length} subregion(s):`, regionKeys);
    
    const voxels = [];
    const entities = [];
    const materialMap = {};
    const regionsData = [];
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    // Load and combine all regions
    for (const regionName of regionKeys) {
        const region = regionsNbt.get(regionName);
        
        // Extract size and position
        const posNbt = region.get('Position');
        const px = posNbt?.get('x')?.value ?? 0;
        const py = posNbt?.get('y')?.value ?? 0;
        const pz = posNbt?.get('z')?.value ?? 0;
        
        const sizeNbt = region.get('Size');
        const w = sizeNbt?.get('x')?.value ?? 0;
        const h = sizeNbt?.get('y')?.value ?? 0;
        const d = sizeNbt?.get('z')?.value ?? 0;
        
        console.log(`   Parsing subregion '${regionName}': Position=(${px},${py},${pz}), Size=(${w}x${h}x${d})`);
        
        const minX_reg = w < 0 ? px + w + 1 : px;
        const minY_reg = h < 0 ? py + h + 1 : py;
        const minZ_reg = d < 0 ? pz + d + 1 : pz;
        const absW = Math.abs(w);
        const absH = Math.abs(h);
        const absD = Math.abs(d);
        
        regionsData.push({
            name: regionName,
            minX: minX_reg,
            minY: minY_reg,
            minZ: minZ_reg,
            w: absW,
            h: absH,
            d: absD
        });
        
        // Parse block state palette
        const paletteNbt = region.get('BlockStatePalette') || region.get('PendingBlockStatePalette');
        if (!paletteNbt) continue;
        
        const palette = [];
        for (let i = 0; i < paletteNbt.length; i++) {
            const entry = paletteNbt.items[i];
            const name = entry.get('Name').value;
            const propertiesNbt = entry.get('Properties');
            const props = {};
            if (propertiesNbt) {
                propertiesNbt.forEach((key, val) => {
                    props[key] = String(val.value);
                });
            }
            palette.push({ name, properties: props });
        }
        
        const blockStatesTag = region.get('BlockStates');
        if (!blockStatesTag) continue;
        const longs = blockStatesTag.items;
        

        
        const bitsPerBlock = Math.max(2, Math.ceil(Math.log2(palette.length)));
        const totalBlocks = absW * absH * absD;
        const blockIndices = unpackLitematicaBitArray(longs, bitsPerBlock, totalBlocks);
        
        // Unpack block states YZX order
        let blockIndex = 0;
        for (let y = 0; y < absH; y++) {
            for (let z = 0; z < absD; z++) {
                for (let x = 0; x < absW; x++) {
                    const paletteIdx = blockIndices[blockIndex++];
                    const paletteEntry = palette[paletteIdx];
                    
                    if (paletteEntry && paletteEntry.name !== 'minecraft:air') {
                        const absX = minX_reg + x;
                        const absY = minY_reg + y;
                        const absZ = minZ_reg + z;
                        
                        voxels.push({
                            x: absX,
                            y: absY,
                            z: absZ,
                            type: paletteEntry.name,
                            properties: paletteEntry.properties,
                            region: regionName
                        });
                        
                        if (absX < minX) minX = absX;
                        if (absX > maxX) maxX = absX;
                        if (absY < minY) minY = absY;
                        if (absY > maxY) maxY = absY;
                        if (absZ < minZ) minZ = absZ;
                        if (absZ > maxZ) maxZ = absZ;
                        
                        const repId = getRepresentativeItemId(paletteEntry.name, paletteEntry.properties || {});
                        if (repId) {
                            const cleanName = getBlockDisplayName(repId);
                            if (!materialMap[repId]) {
                                materialMap[repId] = {
                                    name: cleanName,
                                    id: repId,
                                    count: 0
                                };
                            }
                            materialMap[repId].count++;
                        }
                    }
                }
            }
        }
        
        // Extract Entities from region NBT
        const entitiesNbt = region.get('Entities');
        if (entitiesNbt) {
            for (let i = 0; i < entitiesNbt.length; i++) {
                const ent = entitiesNbt.items[i];
                const posList = ent.getList('Pos');
                if (posList && posList.length >= 3) {
                    const ex = posList.items[0].value;
                    const ey = posList.items[1].value;
                    const ez = posList.items[2].value;
                    
                    // Calculate absolute positions of the entity inside the schematic
                    const absX = px + ex;
                    const absY = py + ey;
                    const absZ = pz + ez;
                    
                    const rawId = ent.getString('id') || ent.getString('Id') || "minecraft:entity";
                    const id = rawId.replace('minecraft:', '');
                    
                    const name = id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    
                    entities.push({
                        id: rawId,
                        name,
                        x: absX,
                        y: absY,
                        z: absZ,
                        region: regionName
                    });
                }
            }
        }
    }
    
    const finalW = minX === Infinity ? 0 : (maxX - minX + 1);
    const finalH = minY === Infinity ? 0 : (maxY - minY + 1);
    const finalD = minZ === Infinity ? 0 : (maxZ - minZ + 1);
    
    const materials = Object.values(materialMap).sort((a, b) => b.count - a.count);
    console.log(`   Parsing complete. Combined ${voxels.length} active voxels and ${entities.length} entities across all subregions.`);
    
    return {
        metadata,
        dimensions: { w: finalW, h: finalH, d: finalD },
        bounds: { minX, maxX, minY, maxY, minZ, maxZ },
        materials,
        voxels,
        entities,
        subregionsCount: regionKeys.length,
        regions: regionKeys,
        regionsData
    };
}

/**
 * Unpacks packed block state indices from a 64-bit Long array.
 * @param {BigInt64Array} longs Packed longs array
 * @param {number} bitsPerBlock Number of bits per block state index
 * @param {number} totalBlocks Size of the region bounding box (WxHxD)
 * @returns {Int32Array} Unpacked indices
 */
function unpackLitematicaBitArray(longs, bitsPerBlock, totalBlocks) {
    const indices = new Int32Array(totalBlocks);
    const valueMask = (1n << BigInt(bitsPerBlock)) - 1n;
    
    for (let i = 0; i < totalBlocks; i++) {
        const startBit = i * bitsPerBlock;
        const startLongIndex = Math.floor(startBit / 64);
        const startBitOffset = startBit % 64;
        
        if (startLongIndex >= longs.length) break;
        
        const longObj = longs[startLongIndex];
        let currentLong = (longObj && typeof longObj.toBigInt === 'function') ? longObj.toBigInt() : BigInt(longObj);
        if (currentLong < 0n) {
            currentLong = BigInt.asUintN(64, currentLong);
        }
        
        let val;
        if (startBitOffset + bitsPerBlock <= 64) {
            // Fits entirely in one Long
            val = (currentLong >> BigInt(startBitOffset)) & valueMask;
        } else {
            // Spans across two Longs
            const bitsInFirstLong = 64 - startBitOffset;
            const bitsInSecondLong = bitsPerBlock - bitsInFirstLong;
            
            const part1 = (currentLong >> BigInt(startBitOffset)) & ((1n << BigInt(bitsInFirstLong)) - 1n);
            
            let part2 = 0n;
            if (startLongIndex + 1 < longs.length) {
                const nextLongObj = longs[startLongIndex + 1];
                let nextLong = (nextLongObj && typeof nextLongObj.toBigInt === 'function') ? nextLongObj.toBigInt() : BigInt(nextLongObj);
                if (nextLong < 0n) {
                    nextLong = BigInt.asUintN(64, nextLong);
                }
                part2 = nextLong & ((1n << BigInt(bitsInSecondLong)) - 1n);
            }
            
            val = part1 | (part2 << BigInt(bitsInFirstLong));
        }
        
        indices[i] = Number(val);
    }
    
    return indices;
}

/**
 * Returns a friendly clean name from a Minecraft namespace block id.
 */
function getBlockDisplayName(id) {
    const baseId = id.split('[')[0];
    const mappings = {};  // Just some dummy code, and not gonna use
    if (mappings[baseId]) return mappings[baseId];
    
    return baseId.replace('minecraft:', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
