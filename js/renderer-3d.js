/**
 * renderer-3d.js
 * 3D WebGL renderer module using Deepslate.
 * Handles WebGL context initialization, Deepslate structure building, camera projection, culling, and wireframe hitboxes.
 */

// WebGL shaderSource patch to fix black border/edge darkening issues at grazing angles.
// Raises alpha discard threshold from 0.01 to 0.15 to reject bleed-through dark pixels on cutout blocks.
(function() {
    if (typeof WebGLRenderingContext !== 'undefined') {
        const originalShaderSource = WebGLRenderingContext.prototype.shaderSource;
        WebGLRenderingContext.prototype.shaderSource = function(shader, source) {
            if (source && source.includes('texColor.a < 0.01')) {
                console.log("🔧 Antigravity: Patching shader transparent discard threshold (0.01 -> 0.15) to prevent dark edges.");
                source = source.replace('texColor.a < 0.01', 'texColor.a < 0.15');
            }
            return originalShaderSource.call(this, shader, source);
        };
    }
})();

// Global state variables for WebGL/Deepslate (shared across modules)
window.gl = null;
window.deepslateRenderer = null;
window.structure = null;
window.webglFailed = false;
window.cameraDistance = 5;

/**
 * Orchestrates rendering: uses WebGL if successfully initialized, falls back to 2D Canvas.
 */
function renderSchematicVoxelIsometric() {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;
    
    // If WebGL is initialized and deepslate resources are loaded, use the WebGL renderer!
    if (window.gl && window.deepslateRenderer) {
        renderWebGL();
        return;
    }
    
    // If WebGL context is initialized but resources are still loading, do not obtain 2D context (prevents context lock)
    if (window.gl && !window.webglFailed) {
        console.log("⏳ WebGL active, waiting for Deepslate resources. Skipping 2D context lookup.");
        return;
    }
    
    // Otherwise, fall back to the 2.5D canvas voxel renderer
    if (typeof renderVoxelCanvasFallback === 'function') {
        renderVoxelCanvasFallback();
    }
}

/**
 * Updates status bar under canvas.
 */
function updateRendererStatus(status, text) {
    const dot = document.getElementById('renderer-status-dot');
    const label = document.getElementById('renderer-status-text');
    if (!dot || !label) return;
    
    dot.className = "h-1.5 w-1.5 rounded-full transition-all duration-300";
    if (status === 'loading') {
        dot.classList.add('bg-amber-500', 'animate-pulse');
    } else if (status === 'success') {
        dot.classList.add('bg-emerald-500');
    } else if (status === 'warning') {
        dot.classList.add('bg-orange-500');
    } else if (status === 'error') {
        dot.classList.add('bg-red-500');
    }
    label.innerText = text;
}

/**
 * Initializes the WebGL context and loads Deepslate resources.
 */
function initWebGLRenderer() {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;
    
    updateRendererStatus('loading', 'Initializing WebGL...');
    window.webglFailed = false;
    
    // Attempt WebGL context initialization with high-precision depth buffer to prevent Z-fighting
    window.gl = canvas.getContext('webgl', { alpha: false, depth: true, antialias: true });
    if (!window.gl) {
        console.warn("⚠️ WebGL context could not be initialized. Sticking with 2D fallback.");
        window.webglFailed = true;
        updateRendererStatus('warning', '2D Canvas (Fallback)');
        renderSchematicVoxelIsometric();
        return;
    }
    
    console.log("🎮 WebGL context successfully initialized.");
    
    const img = document.getElementById('atlas');
    if (!img) {
        console.error("❌ Atlas image element not found.");
        window.webglFailed = true;
        updateRendererStatus('error', '2D Canvas (Fallback)');
        renderSchematicVoxelIsometric();
        return;
    }
    
    const onAtlasLoaded = () => {
        try {
            console.log("📦 Texture atlas image loaded successfully. Active Mode:", window.useTechnicalMode ? "Technical" : "Vanilla");
            updateRendererStatus('loading', 'Building resources...');
            window.deepslateResources = loadDeepslateResources(img);
            console.log("🔧 Deepslate resources bound to window.deepslateResources.");
            setupDeepslateStructure();
            console.log("🎮 setupDeepslateStructure complete.");
        } catch (err) {
            console.error("❌ Failed to build Deepslate resources:", err);
            window.webglFailed = true;
            updateRendererStatus('error', '2D Canvas (Fallback - Atlas Load Error)');
            renderSchematicVoxelIsometric();
        }
    };
    
    img.onload = onAtlasLoaded;
    img.onerror = (e) => {
        console.error("❌ Failed to load atlas image source:", e);
        window.webglFailed = true;
        updateRendererStatus('error', '2D Canvas (Fallback)');
        renderSchematicVoxelIsometric();
    };

    // Initialize source if not loaded
    if (!img.src || img.src === "") {
        if (window.useTechnicalMode && window.ATLAS_TECHNICAL_BASE64) {
            img.src = window.ATLAS_TECHNICAL_BASE64;
        } else if (window.ATLAS_BASE64) {
            img.src = window.ATLAS_BASE64;
        } else {
            console.warn("⚠️ No Base64 texture bundle loaded yet.");
        }
    } else if (img.complete && img.naturalWidth !== 0) {
        onAtlasLoaded();
    }
}

/**
 * Loads block coordinates from the parsed schematic into Deepslate Structure and sets up the renderer.
 */
function setupDeepslateStructure() {
    if (!window.gl || !window.deepslateResources || !window.activeSchematic) {
        updateRendererStatus('warning', '2D Canvas (Fallback)');
        return;
    }
    
    try {
        const { w, h, d } = window.activeSchematic.dimensions;
        const { minX, minY, minZ } = window.activeSchematic.bounds;
        
        // Clean up previous renderer WebGL texture and objects to prevent memory leak & stale texture rendering
        if (window.deepslateRenderer) {
            const gl = window.gl;
            if (window.deepslateRenderer.atlasTexture) {
                try {
                    gl.deleteTexture(window.deepslateRenderer.atlasTexture);
                } catch(e) {
                    console.warn("⚠️ Failed to delete WebGL texture:", e);
                }
                window.deepslateRenderer.atlasTexture = null;
            }
            window.deepslateRenderer = null;
        }
        
        window.structure = new deepslate.Structure([w, h, d]);
        
        window.activeSchematic.voxels.forEach(v => {
            if (window.regionVisibility && window.regionVisibility[v.region] === false) {
                return;
            }
            const relY = v.y - minY;
            if (window.renderSliceY && (relY < window.renderSliceY.min || relY > window.renderSliceY.max)) {
                return;
            }
            const relX = v.x - minX;
            const relZ = v.z - minZ;
            window.structure.addBlock([relX, relY, relZ], v.type, v.properties || {});
        });
        
        // Entities are rendered as WebGL wireframe hitboxes + HTML labels (see renderWebGL).
        // No block-based entity models are placed in the structure.
        
        window.deepslateRenderer = new deepslate.StructureRenderer(window.gl, window.structure, window.deepslateResources, {
            chunkSize: 8,
            useInvisibleBlockBuffer: false
        });

        // Prevent mipmap bleed-through (excessive darkening on steep angles / grazing angles)
        // by setting texture min filter to NEAREST instead of NEAREST_MIPMAP_LINEAR.
        const gl = window.gl;
        if (window.deepslateRenderer.atlasTexture) {
            gl.bindTexture(gl.TEXTURE_2D, window.deepslateRenderer.atlasTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        }

        // Override drawStructure to split opaque and transparent mesh rendering:
        // - Opaque meshes: Cull backfaces to optimize performance (only front faces drawn)
        // - Transparent/Cutout meshes: Disable culling for double-sided rendering (torches, repeaters, comparators, glass, etc.)
        window.deepslateRenderer.drawStructure = function(viewMatrix) {
            const gl = this.gl;
            const r = this.resources;
            this.setShader(this.shaderProgram);
            this.setTexture(this.atlasTexture, r.getPixelSize ? r.getPixelSize() : undefined);
            this.prepareDraw(viewMatrix);

            if (!this.chunkBuilder || !this.chunkBuilder.chunks) return;

            const chunks = this.chunkBuilder.chunks.flatMap(e => 
                e ? e.flatMap(y => 
                    y ? y.flatMap(z => z != null ? [z] : []) : []
                ) : []
            );
            const opaqueMeshes = chunks.flatMap(e => e.mesh && !e.mesh.isEmpty() ? [e.mesh] : []);
            const transparentMeshes = chunks.flatMap(e => e.transparentMesh && !e.transparentMesh.isEmpty() ? [e.transparentMesh] : []);

            // Enable WebGL backface culling globally for both passes
            // - Fixes Z-fighting on flat elements (redstone dust, scaffolding)
            // - Preserves the glowing effect of redstone torches by culling their front-facing inward geometry
            // - Keeps rendering performance optimal across the entire model
            gl.enable(gl.CULL_FACE);
            gl.cullFace(gl.BACK);

            // 1. Render opaque blocks (including regular glass, glass panes, leaves, chests, hoppers, repeaters, torches, etc.)
            opaqueMeshes.forEach(s => {
                this.drawMesh(s, { pos: true, color: true, texture: true, normal: true });
            });

            // 2. Render transparent blocks (stained glass, water, slime, honey, ice, portals)
            // with alpha blending enabled
            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
            gl.depthMask(false);
            
            transparentMeshes.forEach(s => {
                this.drawMesh(s, { pos: true, color: true, texture: true, normal: true });
            });
            
            gl.depthMask(true);
            gl.disable(gl.BLEND);
        };
        
        console.log("🎮 WebGL StructureRenderer initialized with optimized culling overrides.");
        updateRendererStatus('success', 'WebGL 3D');
        renderSchematicVoxelIsometric();
    } catch (err) {
        console.error("❌ Failed to setup Deepslate structure WebGL rendering:", err);
        window.webglFailed = true;
        updateRendererStatus('error', '2D Canvas (Fallback)');
        renderSchematicVoxelIsometric();
    }
}

/**
 * WebGL Draw Loop function.
 */
function renderWebGL() {
    if (!window.deepslateRenderer || !window.gl || !window.structure) return;
    
    const gl = window.gl;
    const canvas = gl.canvas;
    const deepslateRenderer = window.deepslateRenderer;
    const structure = window.structure;
    
    // Scale canvas back-buffer to match High-DPI (Retina) device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = Math.floor(canvas.clientWidth * dpr);
    const displayHeight = Math.floor(canvas.clientHeight * dpr);
    
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }
    
    // Set viewport matching the high-DPI buffer width and height
    deepslateRenderer.setViewport(0, 0, canvas.width, canvas.height);
    
    // Explicitly configure depth buffer testing to prevent co-planar Z-fighting
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    
    gl.clearColor(0.06, 0.09, 0.16, 1.0); // Slate 900 (`#0f172a`)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    const view = glMatrix.mat4.create();
    const size = structure.getSize();
    const w = size[0];
    const h = size[1];
    const d = size[2];
    
    // Position camera closer (maxDim * 0.6 instead of 1.0)
    const maxDim = Math.max(w, h, d);
    const dist = maxDim * 0.6 + window.cameraDistance;
    
    const cameraAngle = window.cameraAngle || { x: -35, y: 45 };
    const pan = window.cameraPan || { x: 0, y: 0, z: 0 };
    const px = pan.x ?? 0;
    const py = pan.y ?? 0;
    const pz = pan.z ?? 0;

    glMatrix.mat4.translate(view, view, [0, 0, -dist]);
    glMatrix.mat4.rotateX(view, view, -cameraAngle.x * Math.PI / 180);
    glMatrix.mat4.rotateY(view, view, cameraAngle.y * Math.PI / 180);
    glMatrix.mat4.translate(view, view, [-w / 2 - px, -h / 2 - py, -d / 2 - pz]);
    
    deepslateRenderer.drawStructure(view);
    
    // Draw the overall structure bounding box wireframe (without the floor grid checkerboard)
    if (window.structure) {
        const gl = window.gl;
        const colorLoc = gl.getAttribLocation(deepslateRenderer.gridShaderProgram, 'vertColor');
        const boxMatrix = glMatrix.mat4.create();
        glMatrix.mat4.copy(boxMatrix, view);
        glMatrix.mat4.scale(boxMatrix, boxMatrix, [w, h, d]);
        
        deepslateRenderer.setShader(deepslateRenderer.gridShaderProgram);
        deepslateRenderer.prepareDraw(boxMatrix);
        
        // Set subtle slate gray color for the outer bounding box
        if (colorLoc !== -1) {
            gl.disableVertexAttribArray(colorLoc);
            gl.vertexAttrib3f(colorLoc, 0.3, 0.35, 0.45);
        }
        
        deepslateRenderer.drawMesh(deepslateRenderer.outlineMesh, { pos: true, color: false });
    }
    
    // Draw region bounding boxes as mint green wireframes (only for the temporarily hovered region)
    if (window.hoveredRegion && window.activeSchematic && window.activeSchematic.regionsData && window.activeSchematic.regionsData.length > 0) {
        const { minX, minY, minZ } = window.activeSchematic.bounds;
        const gl = window.gl;
        const colorLoc = gl.getAttribLocation(deepslateRenderer.gridShaderProgram, 'vertColor');
        
        window.activeSchematic.regionsData.forEach(reg => {
            // Only draw for the temporarily hovered region
            if (reg.name !== window.hoveredRegion) {
                return;
            }
            
            const rx = reg.minX - minX;
            const ry = reg.minY - minY;
            const rz = reg.minZ - minZ;
            
            const boxMatrix = glMatrix.mat4.create();
            glMatrix.mat4.copy(boxMatrix, view);
            glMatrix.mat4.translate(boxMatrix, boxMatrix, [rx, ry, rz]);
            glMatrix.mat4.scale(boxMatrix, boxMatrix, [reg.w, reg.h, reg.d]);
            
            deepslateRenderer.setShader(deepslateRenderer.gridShaderProgram);
            deepslateRenderer.prepareDraw(boxMatrix);
            
            // Set Mint Green color for outline (R=0.1, G=0.85, B=0.55)
            if (colorLoc !== -1) {
                gl.disableVertexAttribArray(colorLoc);
                gl.vertexAttrib3f(colorLoc, 0.1, 0.85, 0.55);
            }
            
            deepslateRenderer.drawMesh(deepslateRenderer.outlineMesh, { pos: true, color: false });
        });
    }

    // Draw entity wireframe hitboxes (always visible regardless of model registration status)
    if (window.showEntities !== false && window.activeSchematic && window.activeSchematic.entities && window.activeSchematic.entities.length > 0) {
        const { minX, minY, minZ } = window.activeSchematic.bounds;
        
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
            
            const dim = typeof getEntityDimension === 'function' ? getEntityDimension(ent.id) : { w: 0.6, h: 1.8 };
            const ew = dim.w;
            const eh = dim.h;
            
            const boxMatrix = glMatrix.mat4.create();
            glMatrix.mat4.copy(boxMatrix, view);
            glMatrix.mat4.translate(boxMatrix, boxMatrix, [rx - ew / 2, ry, rz - ew / 2]);
            glMatrix.mat4.scale(boxMatrix, boxMatrix, [ew, eh, ew]);
            
            deepslateRenderer.setShader(deepslateRenderer.gridShaderProgram);
            deepslateRenderer.prepareDraw(boxMatrix);
            deepslateRenderer.drawMesh(deepslateRenderer.outlineMesh, { pos: true, color: true });
        });
    }
    
    if (typeof updateEntityLabels === 'function') {
        updateEntityLabels(view, deepslateRenderer.projMatrix);
    }
}
