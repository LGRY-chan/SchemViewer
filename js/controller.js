/**
 * controller.js
 * Main layout view controller and UI event binding module.
 * Coordinates parsing results, active UI state, checklist progress, and canvas drag-to-rotate events.
 */

// Shared global states across modules
window.activeSchematic = null;
window.cameraAngle = { x: -35, y: 45 };
window.isDragging = false;
window.previousMousePosition = { x: 0, y: 0 };
window.checklistStates = {};
window.regionVisibility = {};
window.showEntities = true;
window.hoveredRegion = null;
window.renderSliceY = { min: 0, max: 0 };
window.useTechnicalMode = true;


/**
 * Parses and launches the schematic analyzer flow from a local array buffer.
 * @param {ArrayBuffer|null} uploadedBuffer 
 * @param {string} fileName 
 */
async function initLitematicRenderingTest(uploadedBuffer = null, fileName = "custom_schematic") {
    console.log("----------------------------------------");
    console.log("🚀 Initializing Litematic Render Flow...");

    window.checklistStates = {};

    // Show loading indicator on landing screen
    const landingLoading = document.getElementById('landing-loading');
    const dropzoneLanding = document.getElementById('dropzone-landing');
    if (landingLoading) landingLoading.classList.remove('hidden');
    if (dropzoneLanding) dropzoneLanding.classList.add('opacity-30', 'pointer-events-none');

    const loadingStep = document.getElementById('loading-step');

    let gzippedBuffer;
    if (uploadedBuffer) {
        gzippedBuffer = uploadedBuffer;
    } else {
        // Nothing to load on first open — leave landing screen visible
        if (landingLoading) landingLoading.classList.add('hidden');
        if (dropzoneLanding) dropzoneLanding.classList.remove('opacity-30', 'pointer-events-none');
        return;
    }

    try {
        if (loadingStep) loadingStep.innerText = "Decompressing & parsing...";

        if (typeof parseLitematic !== 'function') {
            throw new Error("Parser module (parser.js) is not loaded.");
        }
        const schematic = await parseLitematic(gzippedBuffer);
        window.activeSchematic = schematic;

        // Transition to viewer
        if (typeof showViewer === 'function') showViewer();

        const { w, h, d } = schematic.dimensions;
        const setHtml = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
        const setText = (id, txt)  => { const el = document.getElementById(id); if (el) el.innerText = txt; };
        const cleanName = fileName.replace('.litematic', '');

        // Top bar
        setText('topbar-filename', cleanName);

        // Sidebar overview
        setText('sidebar-schematic-name', cleanName);
        setHtml('info-size', `${w} &times; ${h} &times; ${d}`);
        setText('info-total-blocks', schematic.metadata.totalBlocks.toLocaleString());
        setText('info-volume',       schematic.metadata.totalVolume.toLocaleString());
        setText('info-entities',     (schematic.entities?.length ?? 0).toLocaleString());
        setText('meta-author',       schematic.metadata.author   || '—');
        setText('meta-mc-version',   schematic.metadata.mcVersion || '—');
        setText('meta-regions',      (schematic.subregionsCount || 1).toString());
        setText('meta-date',         new Date().toISOString().split('T')[0]);
        setText('info-region-name',  cleanName);
        setText('material-count-badge', schematic.materials.length);

        // Canvas overlay quick stats
        setHtml('overlay-size',   `${w}&times;${h}&times;${d}`);
        setText('overlay-blocks', schematic.metadata.totalBlocks.toLocaleString());

        // Initialize visibility states for regions and entities
        window.regionVisibility = {};
        if (schematic.regions) {
            schematic.regions.forEach(r => {
                window.regionVisibility[r] = true;
            });
        }
        window.showEntities = true;
        
        const entityCheckbox = document.getElementById('toggle-entities');
        if (entityCheckbox) entityCheckbox.checked = true;
        const entityLabels = document.getElementById('entity-labels-container');
        if (entityLabels) entityLabels.classList.remove('hidden');

        // Initialize Y slicer variables & inputs
        const yHeight = h || 1;
        window.renderSliceY = { min: 0, max: yHeight - 1 };
        
        const sliderMin = document.getElementById('y-slider-min');
        const sliderMax = document.getElementById('y-slider-max');
        const sliderMinLabel = document.getElementById('y-slice-min-label');
        const sliderMaxLabel = document.getElementById('y-slice-max-label');
        const sliderTrack = document.getElementById('y-slider-track');
        
        if (sliderMin && sliderMax) {
            sliderMin.min = 0;
            sliderMin.max = yHeight - 1;
            sliderMin.value = 0;
            
            sliderMax.min = 0;
            sliderMax.max = yHeight - 1;
            sliderMax.value = yHeight - 1;
        }
        if (sliderMinLabel) {
            sliderMinLabel.innerText = '0';
        }
        if (sliderMaxLabel) {
            sliderMaxLabel.innerText = (yHeight - 1).toString();
        }
        if (sliderTrack) {
            sliderTrack.style.top = '0%';
            sliderTrack.style.height = '100%';
        }

        renderRegionsVisibilityList();
        renderMaterialsList();

        if (typeof initWebGLRenderer === 'function') {
            initWebGLRenderer();
        } else {
            console.warn("⚠️ initWebGLRenderer not found, falling back to 2D.");
            renderSchematicVoxelIsometric();
        }

    } catch (e) {
        console.error("❌ Failed to load and render schematic:", e);
        if (landingLoading) landingLoading.classList.add('hidden');
        if (dropzoneLanding) dropzoneLanding.classList.remove('opacity-30', 'pointer-events-none');
        if (loadingStep) {
            loadingStep.innerHTML = `<span class="text-red-400 font-semibold">Error: ${e.message}</span>`;
        }
    }
}

/**
 * Populates and filters the block list under the Materials tab.
 */
function renderMaterialsList() {
    const tbody = document.getElementById('material-list-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!window.activeSchematic || !window.activeSchematic.materials) return;
    
    const searchVal = document.getElementById('material-search');
    const query = searchVal ? searchVal.value.toLowerCase() : "";
    
    // Apply search filters
    const filtered = window.activeSchematic.materials.filter(m => 
        m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query)
    );
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-xs text-slate-400">No blocks match.</td></tr>`;
        updateChecklistProgress();
        return;
    }
    
    filtered.forEach(mat => {
        const isChecked = window.checklistStates[mat.id] || false;
        const stacks = getStackCount(mat.count);

        const tr = document.createElement('tr');
        tr.className = `mat-row border-b border-white/5 text-xs transition-colors ${isChecked ? 'opacity-40' : ''}`;

        const iconHtml = `<div class="w-5 h-5 rounded flex items-center justify-center font-bold text-[8px] uppercase ${getBlockColorClass(mat.id)} flex-shrink-0">
                   ${mat.name.substring(0,2)}
               </div>`;

        tr.innerHTML = `
            <td class="py-2.5 px-2 w-8">
                <input type="checkbox" ${isChecked ? 'checked' : ''}
                       onchange="toggleBlockChecklist('${mat.id}')"
                       class="w-3.5 h-3.5 accent-emerald-500 cursor-pointer">
            </td>
            <td class="py-2.5 px-2 min-w-0 overflow-hidden">
                <div class="flex items-center gap-2 min-w-0">
                    ${iconHtml}
                    <div class="min-w-0 flex-1">
                        <p class="font-semibold text-slate-200 leading-tight truncate" title="${mat.name}">${mat.name}</p>
                        <p class="text-[9px] text-slate-600 font-mono leading-tight truncate" title="${mat.id}">${mat.id}</p>
                    </div>
                </div>
            </td>
            <td class="py-2.5 px-2 w-14 text-right font-bold text-slate-300 truncate">${mat.count.toLocaleString()}</td>
            <td class="py-2.5 px-2 w-20 text-right text-slate-500 truncate">${stacks}</td>
        `;
        tbody.appendChild(tr);
    });
    
    updateChecklistProgress();
}

/**
 * Toggles checks on block checklist table rows.
 */
window.toggleBlockChecklist = function(id) {
    window.checklistStates[id] = !window.checklistStates[id];
    renderMaterialsList();
};

/**
 * Updates progress bar showing how many types of blocks are collected.
 */
function updateChecklistProgress() {
    if (!window.activeSchematic) return;
    const total = window.activeSchematic.materials.length;
    const checked = Object.values(window.checklistStates).filter(Boolean).length;
    const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
    
    const progressText = document.getElementById('checklist-progress-text');
    if (progressText) {
        progressText.innerText = `${checked} / ${total} collected (${percent}%)`;
    }
    const progressBar = document.getElementById('checklist-progress-bar');
    if (progressBar) {
        progressBar.style.width = `${percent}%`;
    }
}

/**
 * Rotates the camera coordinates from navigation button clicks.
 */
window.rotateCamera = function(direction) {
    if (!window.activeSchematic) return;
    if (direction === 'left')  window.cameraAngle.y -= 15;
    if (direction === 'right') window.cameraAngle.y += 15;
    if (direction === 'up')    window.cameraAngle.x += 10;
    if (direction === 'down')  window.cameraAngle.x -= 10;
    if (typeof renderSchematicVoxelIsometric === 'function') renderSchematicVoxelIsometric();
};

/**
 * Sets up mouse drag/rotate and scroll wheel zoom listener bindings on canvas.
 */
function setupCanvasDragRotate() {
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;

    // ── State ──────────────────────────────────────────────────────
    let dragMode   = null;  // 'rotate' | 'pan'
    let lastX = 0, lastY = 0;
    let lastPinchDist = 0;

    // ── Mouse ──────────────────────────────────────────────────────
    canvas.addEventListener('mousedown', e => {
        // Left button → rotate, Right button → pan
        dragMode = (e.button === 2) ? 'pan' : 'rotate';
        lastX = e.clientX;
        lastY = e.clientY;
        e.preventDefault();
    });

    // Suppress context menu so right-click drag works
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('mousemove', e => {
        if (!dragMode || !window.activeSchematic) return;

        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;

        if (dragMode === 'rotate') {
            // Free 360° rotation — no clamping
            window.cameraAngle.y += dx * 0.6;
            window.cameraAngle.x -= dy * 0.4;
        } else {
            // Pan: move the pan offset in 3D world space relative to camera orientation
            window.cameraPan = window.cameraPan || { x: 0, y: 0, z: 0 };
            const dist = window.cameraDistance || 5;
            let actualDist = dist;
            if (window.structure) {
                const size = window.structure.getSize();
                const maxDim = Math.max(size[0], size[1], size[2]);
                actualDist = maxDim * 0.6 + dist;
            }
            const scale = (Math.abs(actualDist) + 10) * 0.0015;

            // Calculate camera Right and Up vectors in world space using glMatrix
            const mat = glMatrix.mat4.create();
            glMatrix.mat4.rotateX(mat, mat, -window.cameraAngle.x * Math.PI / 180);
            glMatrix.mat4.rotateY(mat, mat, window.cameraAngle.y * Math.PI / 180);

            const invRot = glMatrix.mat4.create();
            glMatrix.mat4.transpose(invRot, mat);

            const rx = invRot[0], ry = invRot[1], rz = invRot[2];
            const ux = invRot[4], uy = invRot[5], uz = invRot[6];

            window.cameraPan.x -= (rx * dx - ux * dy) * scale;
            window.cameraPan.y -= (ry * dx - uy * dy) * scale;
            window.cameraPan.z -= (rz * dx - uz * dy) * scale;
        }

        if (typeof renderSchematicVoxelIsometric === 'function') renderSchematicVoxelIsometric();
    });

    document.addEventListener('mouseup', () => { dragMode = null; });

    // ── Scroll wheel zoom (no limits) ─────────────────────────────
    canvas.addEventListener('wheel', e => {
        if (!window.activeSchematic) return;
        e.preventDefault();
        // deltaY positive = zoom out (increase distance)
        window.cameraDistance += e.deltaY * 0.05;
        if (typeof renderSchematicVoxelIsometric === 'function') renderSchematicVoxelIsometric();
    }, { passive: false });

    // ── Touch: single-finger rotate, two-finger pinch/pan ─────────
    let lastTouches = [];

    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        lastTouches = Array.from(e.touches);
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastPinchDist = Math.hypot(dx, dy);
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
        e.preventDefault();
        if (!window.activeSchematic) return;
        const touches = Array.from(e.touches);

        if (touches.length === 1 && lastTouches.length === 1) {
            const dx = touches[0].clientX - lastTouches[0].clientX;
            const dy = touches[0].clientY - lastTouches[0].clientY;
            window.cameraAngle.y += dx * 0.6;
            window.cameraAngle.x -= dy * 0.4;
        } else if (touches.length === 2 && lastTouches.length === 2) {
            // Pinch to zoom
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            window.cameraDistance -= (dist - lastPinchDist) * 0.06;
            lastPinchDist = dist;

            // Two-finger pan
            window.cameraPan = window.cameraPan || { x: 0, y: 0, z: 0 };
            const midX = (touches[0].clientX + touches[1].clientX) / 2;
            const midY = (touches[0].clientY + touches[1].clientY) / 2;
            const pmidX = (lastTouches[0].clientX + lastTouches[1].clientX) / 2;
            const pmidY = (lastTouches[0].clientY + lastTouches[1].clientY) / 2;
            const tdx = midX - pmidX;
            const tdy = midY - pmidY;

            let actualDist = window.cameraDistance || 5;
            if (window.structure) {
                const size = window.structure.getSize();
                const maxDim = Math.max(size[0], size[1], size[2]);
                actualDist = maxDim * 0.6 + actualDist;
            }
            const scale = (Math.abs(actualDist) + 10) * 0.0015;

            const mat = glMatrix.mat4.create();
            glMatrix.mat4.rotateX(mat, mat, -window.cameraAngle.x * Math.PI / 180);
            glMatrix.mat4.rotateY(mat, mat, window.cameraAngle.y * Math.PI / 180);

            const invRot = glMatrix.mat4.create();
            glMatrix.mat4.transpose(invRot, mat);

            const rx = invRot[0], ry = invRot[1], rz = invRot[2];
            const ux = invRot[4], uy = invRot[5], uz = invRot[6];

            window.cameraPan.x -= (rx * tdx - ux * tdy) * scale;
            window.cameraPan.y -= (ry * tdx - uy * tdy) * scale;
            window.cameraPan.z -= (rz * tdx - uz * tdy) * scale;
        }

        lastTouches = touches;
        if (typeof renderSchematicVoxelIsometric === 'function') renderSchematicVoxelIsometric();
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
        lastTouches = Array.from(e.touches);
    });
}

/**
 * Tab switching handler.
 */
window.switchTab = function(tabName) {
    const tabOverviewBtn = document.getElementById('tab-overview');
    const tabMaterialsBtn = document.getElementById('tab-materials');
    const tabExportBtn = document.getElementById('tab-export');
    
    if (tabOverviewBtn && tabMaterialsBtn && tabExportBtn) {
        tabOverviewBtn.className = "tab-btn flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors " + 
            (tabName === 'overview' ? 'border-brand-500 text-brand-500 font-bold' : 'border-transparent text-slate-400 hover:text-slate-300');
        tabMaterialsBtn.className = "tab-btn flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center justify-center gap-1 " + 
            (tabName === 'materials' ? 'border-brand-500 text-brand-500 font-bold' : 'border-transparent text-slate-400 hover:text-slate-300');
        tabExportBtn.className = "tab-btn flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors " + 
            (tabName === 'export' ? 'border-brand-500 text-brand-500 font-bold' : 'border-transparent text-slate-400 hover:text-slate-300');
    }
        
    const panelOverview = document.getElementById('panel-overview');
    const panelMaterials = document.getElementById('panel-materials');
    const panelExport = document.getElementById('panel-export');
    
    if (panelOverview && panelMaterials && panelExport) {
        panelOverview.classList.toggle('hidden', tabName !== 'overview');
        panelMaterials.classList.toggle('hidden', tabName !== 'materials');
        panelExport.classList.toggle('hidden', tabName !== 'export');
    }
};

/**
 * Helper to export schematic block stats list as CSV.
 */
window.exportToCSV = function() {
    if (!window.activeSchematic) return;
    let csv = "Block Name,Block ID,Count,Stacks\n";
    window.activeSchematic.materials.forEach(mat => {
        csv += `"${mat.name}","${mat.id}",${mat.count},"${getStackCount(mat.count)}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `1D_3x_Iron_Farm_materials.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Downloads configured/reformatted JSON or CSV.
 */
window.downloadAs = function(format) {
    if (!window.activeSchematic) return;
    
    let content = "";
    let extension = format;
    let mime = "text/plain";
    
    if (format === 'json') {
        content = JSON.stringify(window.activeSchematic, null, 2);
        extension = 'json';
        mime = 'application/json';
    } else if (format === 'csv') {
        content = "Block Name,Block ID,Count\n" + window.activeSchematic.materials.map(m => `"${m.name}","${m.id}",${m.count}`).join("\n");
        extension = 'csv';
        mime = 'text/csv';
    } else {
        content = "MOCK_BINARY_DATA_FOR_FORMAT_" + format.toUpperCase();
        mime = 'application/octet-stream';
    }
    
    const blob = new Blob([content], { type: mime });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `1D_3x_Iron_Farm_configured.${extension}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Computes stack count representation (e.g. 64 as '1st', 65 as '1st + 1').
 */
function getStackCount(count) {
    const stackSize = 64;
    const stacks = Math.floor(count / stackSize);
    const remainder = count % stackSize;
    if (stacks === 0) {
        return `${remainder}`;
    }
    return remainder > 0 ? `${stacks}st + ${remainder}` : `${stacks}st`;
}

/**
 * Returns CSS color background classes matching item types.
 */
function getBlockColorClass(id) {
    if (id.includes('redstone') || id.includes('comparator') || id.includes('repeater') || id.includes('torch')) {
        return 'bg-red-500/10 text-red-600 border border-red-500/20';
    }
    if (id.includes('glass')) {
        return 'bg-cyan-500/10 text-cyan-600 border border-cyan-500/20';
    }
    if (id.includes('stone') || id.includes('brick')) {
        return 'bg-slate-500/10 text-slate-600 border border-slate-500/20';
    }
    if (id.includes('hopper') || id.includes('chest') || id.includes('piston') || id.includes('dropper')) {
        return 'bg-amber-500/10 text-amber-600 border border-amber-500/20';
    }
    if (id.includes('wood') || id.includes('plank') || id.includes('log') || id.includes('sign')) {
        return 'bg-orange-700/10 text-orange-700 border border-orange-700/20';
    }
    if (id.includes('water') || id.includes('lava')) {
        return 'bg-blue-500/10 text-blue-600 border border-blue-500/20';
    }
    return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20';
}

/**
 * Sets up drag-and-drop file dropzone listeners and default demo file fetching.
 */
function setupFileUpload() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('file-input');
    const loadDefaultBtn = document.getElementById('load-default-btn');
    
    if (!dropzone || !fileInput) return;
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-brand-500', 'bg-brand-50/30');
    });
    
    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('border-brand-500', 'bg-brand-50/30');
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-brand-500', 'bg-brand-50/30');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
}

/**
 * Reads the dropped/uploaded file as ArrayBuffer and passes to parser.
 */
function handleFile(file) {
    if (!file || !file.name.endsWith('.litematic')) {
        alert("Please select a valid .litematic file.");
        return;
    }
    const reader = new FileReader();
    reader.onload = e => initLitematicRenderingTest(e.target.result, file.name);
    reader.readAsArrayBuffer(file);
}

// Bind initialization lifecycle triggers
document.addEventListener('DOMContentLoaded', () => {
    initLitematicRenderingTest(); // Show landing screen with no file
    setupCanvasDragRotate();

    // Landing: file input
    const fileInputLanding = document.getElementById('file-input');
    if (fileInputLanding) {
        fileInputLanding.addEventListener('change', e => {
            if (e.target.files[0]) handleFile(e.target.files[0]);
        });
    }

    // Top bar: file input
    const fileInputTopbar = document.getElementById('file-input-topbar');
    if (fileInputTopbar) {
        fileInputTopbar.addEventListener('change', e => {
            if (e.target.files[0]) handleFile(e.target.files[0]);
        });
    }
});

/**
 * Renders the toggle checkboxes for each schematic region in the sidebar.
 */
function renderRegionsVisibilityList() {
    const listContainer = document.getElementById('regions-visibility-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = '';
    
    if (!window.activeSchematic || !window.activeSchematic.regions || window.activeSchematic.regions.length === 0) {
        listContainer.innerHTML = '<p class="text-[10px] text-slate-600 italic">No regions available</p>';
        return;
    }
    
    window.activeSchematic.regions.forEach(r => {
        const isVisible = window.regionVisibility[r] !== false;
        
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between py-1.5 text-[11px] text-slate-300 border-b border-white/5 last:border-b-0 hover:bg-white/5 px-1.5 rounded transition-colors';
        div.setAttribute('onmouseenter', `setHoveredRegion('${r.replace(/'/g, "\\'")}')`);
        div.setAttribute('onmouseleave', `setHoveredRegion(null)`);
        
        div.innerHTML = `
            <span class="truncate max-w-[180px] font-mono text-slate-300 cursor-help" title="${r}">${r}</span>
            <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" ${isVisible ? 'checked' : ''} onchange="toggleRegionVisibility('${r}')" class="sr-only peer">
                <div class="w-7 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-brand-500"></div>
            </label>
        `;
        listContainer.appendChild(div);
    });
}

/**
 * Toggles the visibility of a specific subregion, triggering a rebuild of the 3D WebGL mesh.
 */
window.toggleRegionVisibility = function(regionName) {
    window.regionVisibility[regionName] = !window.regionVisibility[regionName];
    
    // Re-setup deepslate structure with only visible regions
    if (typeof setupDeepslateStructure === 'function') {
        setupDeepslateStructure();
    }
};

/**
 * Toggles the visibility of all entities.
 */
window.toggleEntityVisibility = function() {
    const entityCheckbox = document.getElementById('toggle-entities');
    window.showEntities = entityCheckbox ? entityCheckbox.checked : !window.showEntities;
    
    // Immediately show/hide the HTML label container
    const labelContainer = document.getElementById('entity-labels-container');
    if (labelContainer) {
        if (window.showEntities) {
            labelContainer.classList.remove('hidden');
        } else {
            labelContainer.classList.add('hidden');
        }
    }
    
    // Redraw the scene
    if (typeof renderSchematicVoxelIsometric === 'function') {
        renderSchematicVoxelIsometric();
    }
};

/**
 * Temporarily highlights a region by storing its name in hoveredRegion state and redrawing.
 */
window.setHoveredRegion = function(regionName) {
    window.hoveredRegion = regionName;
    if (typeof renderSchematicVoxelIsometric === 'function') {
        renderSchematicVoxelIsometric();
    }
};

let ySliderTimeout = null;

/**
 * Handles sliding input from the Y-axis slicer dual range sliders.
 * Debounces the heavy WebGL mesh rebuild by default, but allows an instant bypass.
 */
window.onYSliderInput = function(type, isInstant = false) {
    const minInput = document.getElementById('y-slider-min');
    const maxInput = document.getElementById('y-slider-max');
    if (!minInput || !maxInput) return;
    
    let minVal = parseInt(minInput.value);
    let maxVal = parseInt(maxInput.value);
    
    if (type === 'min' && minVal > maxVal) {
        minInput.value = maxVal;
        minVal = maxVal;
    } else if (type === 'max' && maxVal < minVal) {
        maxInput.value = minVal;
        maxVal = minVal;
    }
    
    window.renderSliceY.min = minVal;
    window.renderSliceY.max = maxVal;
    
    // Update vertical dual range track display styling (top/height)
    const total = parseInt(minInput.max);
    const track = document.getElementById('y-slider-track');
    if (track && total > 0) {
        // Since vertical slider direction is rtl, max value is at top (0% top offset)
        const topPercent = ((total - maxVal) / total) * 100;
        const heightPercent = ((maxVal - minVal) / total) * 100;
        track.style.top = `${topPercent}%`;
        track.style.height = `${heightPercent}%`;
    }
    
    const minLabel = document.getElementById('y-slice-min-label');
    const maxLabel = document.getElementById('y-slice-max-label');
    if (minLabel) minLabel.innerText = minVal.toString();
    if (maxLabel) maxLabel.innerText = maxVal.toString();
    
    // Manage WebGL structure rebuilding call
    if (ySliderTimeout) {
        clearTimeout(ySliderTimeout);
    }
    
    if (isInstant) {
        if (typeof setupDeepslateStructure === 'function') {
            setupDeepslateStructure();
        }
    } else {
        ySliderTimeout = setTimeout(() => {
            if (typeof setupDeepslateStructure === 'function') {
                setupDeepslateStructure();
            }
        }, 250); // 250ms delay
    }
};

/**
 * Adjusts Min Y or Max Y slice limits step-by-step by delta layers.
 */
window.adjustSliceY = function(target, delta) {
    const minInput = document.getElementById('y-slider-min');
    const maxInput = document.getElementById('y-slider-max');
    if (!minInput || !maxInput) return;
    
    let minVal = parseInt(minInput.value);
    let maxVal = parseInt(maxInput.value);
    const total = parseInt(minInput.max);
    
    if (target === 'min') {
        minVal = Math.max(0, Math.min(total, minVal + delta));
        if (minVal > maxVal) minVal = maxVal;
        minInput.value = minVal;
    } else if (target === 'max') {
        maxVal = Math.max(0, Math.min(total, maxVal + delta));
        if (maxVal < minVal) maxVal = minVal;
        maxInput.value = maxVal;
    }
    
    // Trigger update logic instantly (bypass 250ms debounce)
    window.onYSliderInput(target, true);
};

/**
 * Toggles Technical Mode: swaps between base64 texture atlas and the custom assets/atlas.png image.
 */
window.toggleTechnicalMode = function() {
    const toggle = document.getElementById('toggle-technical-mode');
    if (!toggle) return;
    
    console.log("🔧 toggleTechnicalMode clicked! Toggle checked:", toggle.checked);
    
    // Check if technical base64 is compiled when turning on
    if (toggle.checked && (!window.ATLAS_TECHNICAL_BASE64 || window.ATLAS_TECHNICAL_BASE64 === "")) {
        console.warn("⚠️ Cannot toggle Technical Mode: window.ATLAS_TECHNICAL_BASE64 is empty/missing.");
        alert("⚠️ Custom Texture Not Compiled\n\n" +
              "Could not find compiled custom texture data.\n\n" +
              "To compile your custom texture:\n" +
              "1. Edit your custom texture in 'assets/atlas.png'\n" +
              "2. Run the script: 'node compile_atlas.js' in your project root.\n" +
              "3. Refresh this page and toggle Technical Mode again.");
        toggle.checked = false; // Reset the switch
        return;
    }
    
    window.useTechnicalMode = toggle.checked;
    console.log("🔧 Global window.useTechnicalMode state changed to:", window.useTechnicalMode);
    
    const img = document.getElementById('atlas');
    if (!img) {
        console.error("❌ Failed to switch texture: img#atlas element not found in DOM.");
        return;
    }
    
    if (typeof updateRendererStatus === 'function') {
        updateRendererStatus('loading', 'Updating texture...');
    }
    
    if (window.useTechnicalMode) {
        console.log("🔧 Swapping to Technical base64 atlas...");
        img.src = window.ATLAS_TECHNICAL_BASE64;
    } else {
        console.log("🔧 Swapping back to Vanilla base64 atlas...");
        if (window.ATLAS_BASE64) {
            img.src = window.ATLAS_BASE64;
        }
    }
    
    // Safety net: Force trigger onload if browser skips it due to instant base64 loading
    if (img.complete && typeof img.onload === 'function') {
        console.log("⚡ Cached base64 image detected, force triggering atlas load callback.");
        img.onload();
    }
};
