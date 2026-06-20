/**
 * renderer-2d.js
 * Voxel rendering fallback module using HTML5 2D Canvas.
 * Draws isometric grids and colored blocks when WebGL/Deepslate is unavailable.
 */

/**
 * Main isometric fallback drawer for standard 2D Canvas.
 */
function renderVoxelCanvasFallback() {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;
    
    // Clear WebGL entity labels overlay
    const container = document.getElementById('entity-labels-container');
    if (container) container.innerHTML = '';
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    
    if (!window.activeSchematic || !window.activeSchematic.voxels || window.activeSchematic.voxels.length === 0) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No voxel data.", width / 2, height / 2);
        return;
    }
    
    const cameraAngle = window.cameraAngle || { x: -35, y: 45 };
    
    const cosY = Math.cos(cameraAngle.y * Math.PI / 180);
    const sinY = Math.sin(cameraAngle.y * Math.PI / 180);
    
    const pitchRad = -cameraAngle.x * Math.PI / 180;
    const sinPitch = Math.sin(pitchRad);
    const cosPitch = Math.cos(pitchRad);
    
    const factorY = sinPitch / 0.57735;
    const factorZ = cosPitch / 0.81649;
    
    const { w, h, d } = window.activeSchematic.dimensions;
    const { minX, maxX, minY, maxY, minZ, maxZ } = window.activeSchematic.bounds;
    
    // Transform coordinates and store depths for Painters Algorithm
    const voxelsWithDepth = window.activeSchematic.voxels.map(v => {
        // Translation from center of bounds to align rotate pivots correctly
        const cx = v.x - (minX + w / 2);
        const cy = v.y - (minY + h / 2);
        const cz = v.z - (minZ + d / 2);
        
        const rx = cx * cosY - cz * sinY;
        const rz = cx * sinY + cz * cosY;
        const ry = cy;
        
        // Compute rendering depth value
        const depth = rx + rz + ry * 1.5;
        
        return { voxel: v, rx, ry, rz, depth };
    });
    
    // Sort from back to front
    voxelsWithDepth.sort((a, b) => a.depth - b.depth);
    
    // Adaptive voxel scaling based on building size
    const maxDimension = Math.max(w, h, d);
    const scale = Math.max(6, Math.min(22, 220 / maxDimension));
    
    // Draw floor grid lines
    drawGridFloor(ctx, width, height, minX, maxX, minY, maxY, minZ, maxZ, scale, cosY, sinY, factorY, factorZ);
    
    // Render sorted voxels sequentially
    voxelsWithDepth.forEach(vd => {
        const vx = width / 2 + (vd.rx - vd.rz) * 0.866025 * scale;
        const vy = height / 2 + 30 + (vd.rx + vd.rz) * 0.5 * factorY * scale - vd.ry * factorZ * scale;
        drawVoxel(ctx, vx, vy, scale, vd.voxel.type);
    });
}

/**
 * Draws coordinate grids beneath the voxel bounding box space.
 */
function drawGridFloor(ctx, width, height, minX, maxX, minY, maxY, minZ, maxZ, scale, cosY, sinY, factorY, factorZ) {
    ctx.strokeStyle = "rgba(226, 232, 240, 0.15)";
    ctx.lineWidth = 1;
    
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const d = maxZ - minZ + 1;
    
    const project = (x, z) => {
        const cx = x - (minX + w / 2);
        const cz = z - (minZ + d / 2);
        const cy = minY - (minY + h / 2) - 0.5; // Positions grid 0.5 units below structure bottom
        
        const rx = cx * cosY - cz * sinY;
        const rz = cx * sinY + cz * cosY;
        const ry = cy;
        
        const vx = width / 2 + (rx - rz) * 0.866025 * scale;
        const vy = height / 2 + 30 + (rx + rz) * 0.5 * factorY * scale - ry * factorZ * scale;
        return { x: vx, y: vy };
    };
    
    // Draw grid wires running along X-axis bounds
    for (let z = minZ; z <= maxZ + 1; z++) {
        const p1 = project(minX, z);
        const p2 = project(maxX + 1, z);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
    
    // Draw grid wires running along Z-axis bounds
    for (let x = minX; x <= maxX + 1; x++) {
        const p1 = project(x, minZ);
        const p2 = project(x, maxZ + 1);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
}

/**
 * Draws a single flat-colored 2.5D isometric voxel face by face.
 */
function drawVoxel(ctx, x, y, size, type) {
    // Defaults: Light slate
    let topColor = "#cbd5e1";
    let leftColor = "#94a3b8";
    let rightColor = "#64748b";
    
    // Classify colors based on block namespace IDs
    if (type.includes("glass_pane") || type.includes("glass") || type.includes("bars")) {
        topColor = "rgba(186, 230, 253, 0.4)"; leftColor = "rgba(125, 211, 252, 0.4)"; rightColor = "rgba(56, 189, 248, 0.4)";
    } else if (type.includes("torch") || type.includes("redstone")) {
        topColor = "#fde047"; leftColor = "#ca8a04"; rightColor = "#ea580c";
    } else if (type.includes("obsidian")) {
        topColor = "#3b0764"; leftColor = "#2e0249"; rightColor = "#1a0033";
    } else if (type.includes("hopper") || type.includes("dropper") || type.includes("lightning_rod")) {
        topColor = "#52525b"; leftColor = "#3f3f46"; rightColor = "#27272a";
    } else if (type.includes("water")) {
        topColor = "rgba(59, 130, 246, 0.6)"; leftColor = "rgba(37, 99, 235, 0.6)"; rightColor = "rgba(29, 78, 216, 0.6)";
    } else if (type.includes("lava")) {
        topColor = "#f97316"; leftColor = "#ea580c"; rightColor = "#b91c1c";
    } else if (type.includes("grass_block")) {
        topColor = "#4ade80"; leftColor = "#854d0e"; rightColor = "#713f12";
    } else if (type.includes("dirt")) {
        topColor = "#a16207"; leftColor = "#854d0e"; rightColor = "#713f12";
    } else if (type.includes("cobblestone")) {
        topColor = "#a1a1aa"; leftColor = "#71717a"; rightColor = "#52525b";
    } else if (type.includes("stone")) {
        topColor = "#94a3b8"; leftColor = "#64748b"; rightColor = "#475569";
    } else if (type.includes("iron")) {
        topColor = "#f1f5f9"; leftColor = "#e2e8f0"; rightColor = "#cbd5e1";
    } else if (type.includes("bed") || type.includes("carpet")) {
        topColor = "#f8fafc"; leftColor = "#e2e8f0"; rightColor = "#ef4444";
    } else if (type.includes("wood") || type.includes("plank") || type.includes("chest") || type.includes("sign") || type.includes("trapdoor") || type.includes("fence") || type.includes("gate") || type.includes("ladder")) {
        topColor = "#d97706"; leftColor = "#b45309"; rightColor = "#78350f";
    }
    
    const S = size;
    const cos30 = 0.866025;
    
    // Top face polygon
    ctx.beginPath();
    ctx.moveTo(x, y - S);
    ctx.lineTo(x + cos30 * S, y - 0.5 * S);
    ctx.lineTo(x, y);
    ctx.lineTo(x - cos30 * S, y - 0.5 * S);
    ctx.closePath();
    ctx.fillStyle = topColor;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
    
    // Left face polygon
    ctx.beginPath();
    ctx.moveTo(x - cos30 * S, y - 0.5 * S);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + S);
    ctx.lineTo(x - cos30 * S, y + 0.5 * S);
    ctx.closePath();
    ctx.fillStyle = leftColor;
    ctx.fill();
    ctx.stroke();
    
    // Right face polygon
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + cos30 * S, y - 0.5 * S);
    ctx.lineTo(x + cos30 * S, y + 0.5 * S);
    ctx.lineTo(x, y + S);
    ctx.closePath();
    ctx.fillStyle = rightColor;
    ctx.fill();
    ctx.stroke();
}
