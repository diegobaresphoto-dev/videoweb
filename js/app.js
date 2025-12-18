import { store } from './state.js';
import { CollectionManager } from './managers/CollectionManager.js';
import { SectionManager } from './managers/SectionManager.js';
import { TypeManager } from './managers/TypeManager.js';
import { ItemManager } from './managers/ItemManager.js';
import { DataManager } from './managers/DataManager.js';
import { UserManager } from './managers/UserManager.js';
import { FieldRegistryManager } from './managers/FieldRegistryManager.js';
import { SettingsManager } from './managers/SettingsManager.js';
import { Modal } from './ui/Modal.js';
import { Logger } from './utils/Logger.js';

// Expose Managers to Global Scope for Inline HTML Handlers
window.ItemManager = ItemManager;
window.SectionManager = SectionManager;
window.TypeManager = TypeManager;
window.CollectionManager = CollectionManager;
window.DataManager = DataManager;
window.UserManager = UserManager;
window.FieldRegistryManager = FieldRegistryManager;
window.SettingsManager = SettingsManager;
window.Modal = Modal;

// Global Image Error Handler for Grid
window.handleGridImageError = (img, itemId) => {
    Logger.error(`Image Load Failed for item ${itemId}`, { src: img.src });

    const item = store.data.items.find(i => i.id === itemId);
    if (!item || !item.gallery || item.gallery.length === 0) {
        showPlaceholder(img);
        return;
    }

    let currentIndex = parseInt(img.getAttribute('data-img-index') || '0');
    let nextIndex = currentIndex + 1;

    // Find next valid URL
    while (nextIndex < item.gallery.length) {
        let nextUrl = item.gallery[nextIndex].url;
        if (nextUrl) {
            if (/^[a-zA-Z]:\\/.test(nextUrl)) {
                nextUrl = 'file:///' + nextUrl.replace(/\\/g, '/');
            }
            img.setAttribute('data-img-index', nextIndex);
            img.src = nextUrl;
            Logger.info(`Retrying image for ${itemId} with index ${nextIndex}`, { url: nextUrl });
            return;
        }
        nextIndex++;
    }

    showPlaceholder(img, item.gallery.length);
    Logger.error(`All images failed for ${itemId}`);
};

function showPlaceholder(img, count = 0) {
    img.style.display = 'none';
    if (img.parentElement) {
        img.parentElement.innerHTML = `<div style="width:100%; height:100%; background:rgba(0,0,0,0.3); display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:1.5rem;">📦<span style="font-size:0.6rem; margin-top:5px; color:#ef4444;">${count} fallos</span></div>`;
    }
}

// Utility: Normalize platform names to uppercase
window.normalizePlatforms = () => {
    const platformMap = {
        'ps5': 'PS5', 'playstation 5': 'PS5', 'playstation5': 'PS5',
        'ps4': 'PS4', 'playstation 4': 'PS4', 'playstation4': 'PS4',
        'ps3': 'PS3', 'playstation 3': 'PS3', 'playstation3': 'PS3',
        'ps2': 'PS2', 'playstation 2': 'PS2', 'playstation2': 'PS2',
        'ps1': 'PS1', 'psx': 'PS1', 'playstation 1': 'PS1',
        'xbox series x': 'XBOX SERIES X', 'xsx': 'XBOX SERIES X',
        'xbox series s': 'XBOX SERIES S', 'xss': 'XBOX SERIES S',
        'xbox one': 'XBOX ONE', 'xone': 'XBOX ONE',
        'xbox 360': 'XBOX 360', 'xbox': 'XBOX',
        'nintendo switch': 'NINTENDO SWITCH', 'switch': 'NINTENDO SWITCH',
        'nintendo 3ds': 'NINTENDO 3DS', '3ds': 'NINTENDO 3DS',
        'nintendo wii u': 'NINTENDO WII U', 'wii u': 'NINTENDO WII U',
        'nintendo wii': 'NINTENDO WII', 'wii': 'NINTENDO WII',
        'pc': 'PC', 'windows': 'PC'

    };

    let updated = 0;
    (store.data.items || []).forEach(item => {
        ['plataforma', 'platform', 'consola'].forEach(key => {
            if (item.data?.[key]) {
                const norm = platformMap[item.data[key].toLowerCase().trim()];
                if (norm && item.data[key] !== norm) {
                    console.log(`"${item.data[key]}" → "${norm}"`);
                    item.data[key] = norm;
                    updated++;
                }
            }
        });
    });

    if (updated > 0) {
        store.save();
        console.log(`✅ ${updated} plataformas normalizadas y guardadas`);
        location.reload();
    } else {
        console.log('✅ Todas las plataformas ya están normalizadas');
    }
};

// Logic for Floating Actions
function renderFloatingActions() {
    let fab = document.getElementById('fab-actions');
    if (!fab) {
        fab = document.createElement('div');
        fab.id = 'fab-actions';
        fab.style.position = 'fixed';
        fab.style.bottom = '20px';
        fab.style.right = '20px'; // Or centered?
        fab.style.left = '50%';
        fab.style.transform = 'translateX(-50%)';
        fab.style.background = 'var(--bg-card)';
        fab.style.border = '1px solid var(--border)';
        fab.style.padding = '1rem 2rem';
        fab.style.borderRadius = '30px';
        fab.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
        fab.style.display = 'none';
        fab.style.alignItems = 'center';
        fab.style.gap = '1rem';
        fab.style.zIndex = '9999';

        document.body.appendChild(fab);
    }

    if (selectedItems.size > 0) {
        fab.style.display = 'flex';
        fab.innerHTML = `
            <span style="font-weight:bold;">${selectedItems.size} seleccionados</span>
            <button id="btn-bulk-delete" class="btn btn-sm" style="background:#ff4444; color:white; border:none;">🗑️ Eliminar Todos</button>
            <button id="btn-bulk-clear" class="btn-ghost btn-sm">Cancelar</button>
        `;

        fab.querySelector('#btn-bulk-clear').onclick = () => {
            selectedItems.clear();
            renderWorkspace(); // Re-render to clear checkboxes
            renderFloatingActions();
        };

        fab.querySelector('#btn-bulk-delete').onclick = () => {
            Modal.confirm({
                title: 'Eliminar Varios',
                message: `¿Estás seguro de que quieres eliminar PERMANENTEMENTE estos ${selectedItems.size} artículos?`,
                isDanger: true,
                confirmLabel: 'Eliminar Todos',
                onConfirm: async () => {
                    for (const id of selectedItems) {
                        await store.deleteItem(id);
                    }
                    selectedItems.clear();
                    renderWorkspace(); // Updates grid
                    renderFloatingActions();
                }
            });
        };

    } else {
        fab.style.display = 'none';
    }
}


console.log('App (Refactored) Initializing...');

// State for Bulk Actions
const selectedItems = new Set();
const activeSectionFilters = new Set();
const activeSectionFieldFilters = {}; // Global state for section field filters
const activeTypeFilters = {}; // Global state for type filters
const paginationState = { enabled: true, pageSize: 24, page: 1 };

async function init() {
    try {
        await store.load();

        UserManager.init();
        await UserManager.ensureDefaults();

        if (UserManager.restoreSession()) {
            console.log('App: Session restored for', UserManager.currentUser.username);
        } else {
            console.log('App: No session. Guest mode/Login required.');
        }

        renderAppHeader(); // Draw Custom Header
        setupSidebarFooter();
        renderUserControls(); // Draw Login/User info
        renderSidebar();
        renderWorkspace();
        // Listeners for Menu Actions (Admin)
        if (window.api) {
            window.api.on('menu-users', () => {
                if (UserManager.isAdmin()) UserManager.openManagement();
                else alert('Acceso denegado: Se requieren permisos de administrador.');
            });
            window.api.on('menu-data', () => {
                if (UserManager.isAdmin()) DataManager.open();
                else alert('Acceso denegado: Se requieren permisos de administrador.');
            });
        }
    } catch (e) {
        console.error('Init Failed:', e);
        alert('Error Crítico al iniciar: ' + e.message); // Visible alert
    }
}


function renderAppHeader() {
    const h1 = document.querySelector('.sidebar-header h1');
    if (!h1) return;

    const config = store.data.config || {};
    const title = config.appName || 'Inventario';
    const logo = config.appLogo || '🔷';

    // Check if logo is a path (contains / or \)
    const isImage = logo.includes('/') || logo.includes('\\') || logo.startsWith('http');

    if (isImage) {
        // Use Image
        h1.innerHTML = `
            <img src="${logo}" style="height:32px; width:32px; object-fit:contain; border-radius:4px;"> 
            <span>${title}</span>
        `;
    } else {
        // Use Text/Emoji
        h1.innerHTML = `${logo} <span>${title}</span>`;
    }
}

// --- USER UI ---
function renderUserControls() {
    const container = document.getElementById('user-controls');
    if (!container) return;
    container.innerHTML = '';

    if (UserManager.currentUser) {
        // Logged In: Username + Logout
        const userDiv = document.createElement('div');
        userDiv.style.display = 'flex';
        userDiv.style.flexDirection = 'column';
        userDiv.style.gap = '0.5rem';

        const nameLabel = document.createElement('div');
        nameLabel.innerHTML = `<span style="color:var(--primary); font-weight:bold;">👤 ${UserManager.currentUser.username}</span>`;
        if (UserManager.currentUser.role === 'admin') {
            nameLabel.innerHTML += ` <span style="font-size:0.75rem; color:var(--accent);">(Admin)</span>`;
        }

        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'btn btn-ghost btn-sm';
        logoutBtn.innerText = 'Cerrar Sesión';
        logoutBtn.style.textAlign = 'left';
        logoutBtn.style.padding = '0';
        logoutBtn.style.color = 'var(--text-secondary)';
        logoutBtn.onclick = () => UserManager.logout();

        userDiv.appendChild(nameLabel);
        userDiv.appendChild(logoutBtn);
        container.appendChild(userDiv);
    } else {
        // Logged Out: Login Button
        const loginBtn = document.createElement('button');
        loginBtn.className = 'btn btn-primary';
        loginBtn.style.width = '100%';
        loginBtn.innerText = 'Iniciar Sesión';
        loginBtn.onclick = () => {
            UserManager.promptLogin(() => {
                location.reload(); // Reload to refresh full state (permissions, etc)
            });
        };
        container.appendChild(loginBtn);
    }
}

// --- SIDEBAR RENDERER ---
// --- SIDEBAR RENDERER ---
function setupSidebarFooter() {
    const footer = document.querySelector('.sidebar-footer');
    if (!footer) return;

    footer.innerHTML = '';

    // 0. User Info Moved to Sidebar Header (renderUserControls)


    // 1. User Management & Data (Now moved to Main Menu)
    // Removed from here.

    // 2. Config Button (Admin Only)
    if (UserManager.isAdmin()) {
        const configBtn = document.createElement('button');
        configBtn.className = 'btn btn-ghost';
        configBtn.style.width = '100%';
        configBtn.style.textAlign = 'left';
        configBtn.style.marginBottom = '0.5rem';
        configBtn.innerHTML = '⚙️ Configuración';
        configBtn.onclick = () => SettingsManager.open();
        footer.appendChild(configBtn);
    }

    // 3. Admin Toggle (Admin Only)
    // Only Admins can toggle Admin Mode (Design Mode)
    if (UserManager.isAdmin()) {
        const toggleLabel = document.createElement('label');
        toggleLabel.style.display = 'flex';
        toggleLabel.style.alignItems = 'center';
        toggleLabel.style.justifyContent = 'space-between';
        toggleLabel.style.cursor = 'pointer';
        toggleLabel.style.width = '100%';
        toggleLabel.style.color = 'var(--text-secondary)';
        toggleLabel.innerHTML = `
            <span>🛠️ Modo Diseño</span>
            <input type="checkbox" id="toggle-admin-footer" ${store.data.adminMode ? 'checked' : ''} style="width:auto;">
        `;
        footer.appendChild(toggleLabel);

        const toggle = document.getElementById('toggle-admin-footer');
        toggle.onchange = (e) => {
            store.data.adminMode = e.target.checked;
            requestAnimationFrame(() => store.notify()); // Force update
        };
    }
}

function renderSidebar() {
    console.log('App: Rendering Sidebar...');
    const nav = document.getElementById('nav-tree');
    nav.innerHTML = '';

    // Render Collections
    store.data.collections.forEach(col => {
        // PERMISSION CHECK
        if (!UserManager.canViewCollection(col.id)) return;

        // Collection Header
        const colDiv = document.createElement('div');
        colDiv.style.marginBottom = '2rem';
        colDiv.style.paddingBottom = '1rem';
        colDiv.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)'; // More visible separator (20% white)

        const colHeader = document.createElement('div');
        colHeader.className = 'sidebar-item';
        colHeader.style.justifyContent = 'space-between';
        colHeader.style.fontWeight = '700'; // Bolder
        colHeader.style.textTransform = 'uppercase'; // Distinctive
        colHeader.style.letterSpacing = '1px';
        colHeader.style.color = 'var(--primary)'; // Accent color title
        colHeader.style.background = 'transparent';
        colHeader.style.cursor = 'default';

        colHeader.innerHTML = `<span>${col.icon} ${col.name}</span>`;

        // Admin Controls for Collection
        if (store.data.adminMode) {
            const controls = document.createElement('div');
            controls.style.display = 'flex';
            controls.style.gap = '4px';

            const editBtn = document.createElement('button');
            editBtn.className = 'btn-ghost btn-xs';
            editBtn.innerHTML = '✏️';
            editBtn.onclick = (e) => { e.stopPropagation(); CollectionManager.edit(col); };
            controls.appendChild(editBtn);

            const addSecBtn = document.createElement('button');
            addSecBtn.className = 'btn-ghost btn-xs';
            addSecBtn.innerHTML = '+ Sec';
            addSecBtn.onclick = (e) => { e.stopPropagation(); SectionManager.create(col.id); };
            controls.appendChild(addSecBtn);

            const fieldsBtn = document.createElement('button');
            fieldsBtn.className = 'btn-ghost btn-xs';
            fieldsBtn.innerHTML = '⚙️';
            fieldsBtn.title = 'Campos Comunes de Colección';
            fieldsBtn.onclick = (e) => {
                e.stopPropagation();
                import('./managers/FieldRegistryManager.js').then(m => m.FieldRegistryManager.openRegistry(col.id));
            };
            controls.appendChild(fieldsBtn);

            colHeader.appendChild(controls);
        }
        colDiv.appendChild(colHeader);

        // Sections Container
        const sectionsContainer = document.createElement('div');
        sectionsContainer.style.paddingLeft = '0.75rem';
        sectionsContainer.style.marginTop = '0.25rem';
        // Remove heavy border-left, maybe just simple indentation?
        sectionsContainer.style.borderLeft = '1px solid var(--border-light)';
        sectionsContainer.style.marginLeft = '0.75rem';

        // Find Sections for this Collection
        const sections = store.data.sections.filter(s => s.collectionId === col.id);

        sections.forEach((sec, idx) => {
            const secDiv = document.createElement('div');
            secDiv.style.marginBottom = '0.5rem';

            const secHeader = document.createElement('div');
            secHeader.className = 'sidebar-item';
            // Highlight if active
            if (store.data.currentView === 'section' && store.data.currentSectionId === sec.id) {
                secHeader.classList.add('active');
            }
            secHeader.style.justifyContent = 'space-between';
            secHeader.style.fontSize = '0.9rem';

            secHeader.innerHTML = `<span>${sec.icon || '📁'} ${sec.name}</span>`;
            secHeader.onclick = () => {
                selectedItems.clear();
                store.data.currentView = 'section';
                store.data.currentSectionId = sec.id;
                renderWorkspace();
            };

            // Admin Controls for Section
            if (store.data.adminMode) {
                const controls = document.createElement('div');
                controls.style.display = 'flex';
                controls.style.gap = '2px';
                controls.onclick = (e) => e.stopPropagation(); // prevent nav click

                // Reorder Section Up
                const btnUp = document.createElement('button');
                btnUp.className = 'btn-ghost btn-xs';
                btnUp.innerText = '▲';
                btnUp.disabled = idx === 0;
                btnUp.style.opacity = idx === 0 ? '0.3' : '1';
                btnUp.onclick = () => {
                    const globalIdx = store.data.sections.indexOf(sec);
                    const prevSec = sections[idx - 1];
                    if (!prevSec) return;
                    const prevGlobalIdx = store.data.sections.indexOf(prevSec);

                    const arr = [...store.data.sections];
                    arr[globalIdx] = prevSec;
                    arr[prevGlobalIdx] = sec;
                    store.saveAllSections(arr);
                };
                controls.appendChild(btnUp);

                // Reorder Section Down
                const btnDown = document.createElement('button');
                btnDown.className = 'btn-ghost btn-xs';
                btnDown.innerText = '▼';
                btnDown.disabled = idx === sections.length - 1;
                btnDown.style.opacity = idx === sections.length - 1 ? '0.3' : '1';
                btnDown.onclick = () => {
                    const globalIdx = store.data.sections.indexOf(sec);
                    const nextSec = sections[idx + 1];
                    if (!nextSec) return;
                    const nextGlobalIdx = store.data.sections.indexOf(nextSec);

                    const arr = [...store.data.sections];
                    arr[globalIdx] = nextSec;
                    arr[nextGlobalIdx] = sec;
                    store.saveAllSections(arr);
                };
                controls.appendChild(btnDown);

                const editBtn = document.createElement('button');
                editBtn.className = 'btn-ghost btn-xs';
                editBtn.innerHTML = '✏️';
                editBtn.onclick = () => SectionManager.edit(sec);
                controls.appendChild(editBtn);

                // Config Button (Gear) - New!
                const configBtn = document.createElement('button');
                configBtn.className = 'btn-ghost btn-xs';
                configBtn.innerText = '⚙️';
                configBtn.title = "Configurar Tipos";
                configBtn.onclick = () => {
                    import('./ui/TypeConfigModal.js').then(m => m.TypeConfigModal.open(sec.id));
                };
                controls.appendChild(configBtn);



                secHeader.appendChild(controls);
            }

            secDiv.appendChild(secHeader);

            // Item Types List (Conditional Rendering)
            const types = store.data.itemTypes.filter(t => t.sectionId === sec.id);
            // ONLY SHOW IF 2 OR MORE
            if (types.length >= 2) {
                const typesContainer = document.createElement('div');
                typesContainer.style.paddingLeft = '1rem';

                types.forEach((type, tIdx) => {
                    const typeRow = document.createElement('div');
                    typeRow.className = 'sidebar-item';
                    typeRow.style.fontSize = '0.85rem';
                    typeRow.style.padding = '0.4rem 0.75rem';

                    if (store.data.currentView === 'type' && store.data.currentTypeId === type.id) {
                        typeRow.classList.add('active');
                    }

                    // Content
                    const label = document.createElement('span');
                    label.innerHTML = `${type.icon} ${type.name}`;
                    typeRow.appendChild(label);

                    // Click to filter by this type
                    typeRow.onclick = () => {
                        selectedItems.clear();
                        store.data.currentView = 'type';
                        store.data.currentTypeId = type.id;
                        renderWorkspace();
                    };

                    // Removed Admin Controls from Tree (Moved to TypeConfigModal)

                    typesContainer.appendChild(typeRow);
                });
                secDiv.appendChild(typesContainer);
            }
            sectionsContainer.appendChild(secDiv);
        });
        colDiv.appendChild(sectionsContainer);
        nav.appendChild(colDiv);
    });
    // New Collection Button (Admin Only)
    if (store.data.adminMode) {
        const newColBtn = document.createElement('button');
        newColBtn.className = 'btn btn-ghost';
        newColBtn.style.width = '100%';
        newColBtn.style.textAlign = 'left';
        newColBtn.style.paddingLeft = '0.5rem';
        newColBtn.style.marginTop = '1rem';
        newColBtn.innerHTML = '+ 📁 Nueva Colección';
        newColBtn.onclick = () => CollectionManager.create();
        nav.appendChild(newColBtn);

    }
}


// --- WORKSPACE RENDERER ---
function renderWorkspace() {
    const container = document.getElementById('workspace-content');
    const title = document.getElementById('view-title');
    const subtitle = document.getElementById('view-subtitle');

    // Clean Workspace Actions in Header (Default state)
    const actionsContainer = document.getElementById('workspace-actions');
    if (actionsContainer) actionsContainer.innerHTML = '';

    // activeTypeFilters is now Global

    // ... (inside renderWorkspace logic)

    if (store.data.currentView === 'type' && store.data.currentTypeId) {

        // Handle Filter State Reset on Type Change
        if (activeTypeFilters._typeId !== store.data.currentTypeId) {
            for (const key in activeTypeFilters) delete activeTypeFilters[key];
            activeTypeFilters._typeId = store.data.currentTypeId;
        }

        const type = store.data.itemTypes.find(t => t.id === store.data.currentTypeId);
        if (!type) return;

        // 1. Get Base Items
        const allItems = store.data.items.filter(i => i.typeId === type.id);

        // 2. Identify Filterable Fields
        const filterableFields = type.fields.map(usage => {
            let def = (store.data.fieldDefinitions || []).find(f => f.id === usage.fieldId);

            // Fallback for Legacy Fields (missing definition)
            if (!def) {
                if (usage.filterable) {
                    const safeKey = (usage.key || usage.label || '').replace(/[^a-zA-Z0-9]/g, '_');
                    def = {
                        id: usage.fieldId || 'legacy_' + safeKey,
                        key: usage.key || usage.label,
                        label: usage.label,
                        type: 'text'
                    };
                } else {
                    return null;
                }
            }

            // Respect User Configuration
            if (usage.filterable) {
                return { ...def, label: usage.label || def.label };
            }
            return null;
        }).filter(f => f);

        // 3. Build Filter UI & Logic
        // We compute facets based on ALL items to show global counts, OR based on current filtered items?
        // Usually Facets show counts based on current other filters.
        // Let's do simple: Options show counts from ALL items in this Type.

        let filterHtml = `
    <div class="filter-panel">
        <div style="width:100%; font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.25rem;">FILTROS</div>
`;

        if (filterableFields.length === 0) {
            filterHtml += `<div style="font-size:0.8rem; color:var(--text-secondary); font-style:italic;">No hay campos filtrables configurados.</div>`;
        }

        filterableFields.forEach(def => {
            const facets = new Map();
            allItems.forEach(item => {
                let rawVal = item.data[def.key];


                if (def.type === 'boolean') {
                    rawVal = rawVal ? (def.booleanConfig?.trueLabel || 'Si') : (def.booleanConfig?.falseLabel || 'No');
                } else if (def.type === 'checklist' && Array.isArray(rawVal)) {
                    rawVal.forEach(v => {
                        const k = v.trim();
                        if (k) facets.set(k, (facets.get(k) || 0) + 1);
                    });
                    return;
                }

                // Skip empty values - don't show them in filters
                if (rawVal === undefined || rawVal === null || rawVal === '') return;

                if (def.type !== 'checklist') {
                    const k = String(rawVal);
                    facets.set(k, (facets.get(k) || 0) + 1);
                }
            });

            // Reduce Clutter: If only 1 option available (or 0), there's no point in filtering
            if (facets.size <= 1) return;

            const activeValues = activeTypeFilters[def.id] || [];

            filterHtml += `
    <div class="filter-group" style="margin-bottom: 1rem;">
                    <div class="filter-title" style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">${def.label}</div>
                    <div class="filter-options" style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            `;

            facets.forEach((count, val) => {
                const isChecked = activeValues.includes(val) ? 'checked' : '';
                // Chip Style logic relying on CSS classes would be cleaner, but inline ensures immediate result
                // We'll use a trick: input:checked + div changes style
                filterHtml += `
                    <label class="filter-chip" style="cursor: pointer; position: relative;">
                        <input type="checkbox" class="filter-chk" data-field-id="${def.id}" value="${val.replace(/"/g, '&quot;')}" ${isChecked} style="position: absolute; opacity: 0; pointer-events: none;">
                        <div class="chip-visual" style="
                            display: inline-flex; align-items: center; gap: 0.4rem;
                            padding: 0.4rem 0.8rem;
                            border-radius: 20px;
                            font-size: 0.85rem;
                            font-weight: 500;
                            border: 1px solid var(--glass-border);
                            background: ${isChecked ? 'var(--primary)' : 'rgba(255,255,255,0.05)'};
                            color: ${isChecked ? 'white' : 'var(--text-secondary)'};
                            transition: all 0.2s;
                            box-shadow: ${isChecked ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none'};
                        ">
                            <span>${val}</span>
                            <span style="opacity: 0.6; font-size: 0.75rem; background: rgba(0,0,0,0.2); padding: 0.1rem 0.4rem; border-radius: 8px;">${count}</span>
                        </div>
                    </label>
                `;
            });

            filterHtml += `</div></div>`;
        });

        // Add distinct "Clear" button if filters active
        const hasActive = Object.keys(activeTypeFilters).some(k => k !== '_typeId');
        if (hasActive) {
            filterHtml += `<button id="btn-clear-type-filters" class="btn btn-ghost btn-sm" style="color:var(--accent);">Borrar Filtros</button>`;
        }

        filterHtml += `</div>`;


        const gearBtn = store.data.adminMode
            ? `<button id="btn-edit-type" class="btn-ghost btn-sm" style="font-size:0.8rem;">⚙️</button>`
            : '';

        title.innerHTML = `${type.name} ${gearBtn} `;
        subtitle.innerText = 'Lista de Artículos';

        // Apply Filters to Render List
        let items = allItems;

        // Logic: AND (Multi-Select)
        items = items.filter(item => {
            for (const fId in activeTypeFilters) {
                if (fId === '_typeId') continue;
                const activeValues = activeTypeFilters[fId];
                if (!activeValues || activeValues.length === 0) continue;

                // Loose match
                const def = filterableFields.find(f => f.id == fId);
                if (!def) continue;

                let itemVal = item.data[def.key];

                if (def.type === 'boolean') {
                    itemVal = itemVal ? (def.booleanConfig?.trueLabel || 'Si') : (def.booleanConfig?.falseLabel || 'No');
                }

                // Skip items with empty values - they won't match any filter
                if (itemVal === undefined || itemVal === null || itemVal === '') continue;

                if (def.type === 'checklist') {
                    if (!Array.isArray(itemVal)) return false;
                    const hasMatch = itemVal.some(v => activeValues.includes(String(v).trim()));
                    if (!hasMatch) return false;
                } else {
                    if (!activeValues.includes(String(itemVal))) return false;
                }
            }
            return true;
        });

        // Update Count Display
        const countEl = container.querySelector('#filtered-count');
        if (countEl) countEl.innerText = `${items.length} artículos encontrados`;

        // Restore subtitle just in case
        subtitle.innerText = 'Lista de Artículos';

        // --- PAGINATION LOGIC ---
        let renderItems = items;
        let paginationHtml = '';

        if (paginationState.enabled) {
            const totalPages = Math.max(1, Math.ceil(items.length / paginationState.pageSize));
            if (paginationState.page > totalPages) paginationState.page = 1;

            const start = (paginationState.page - 1) * paginationState.pageSize;
            const end = start + paginationState.pageSize;
            renderItems = items.slice(start, end);

            // Build Controls
            if (totalPages > 1) {
                paginationHtml = `
    <div style="grid-column: 1 / -1; display:flex; justify-content:center; gap:1rem; align-items:center; margin-top:1.5rem;">
                        <button id="btn-page-prev" class="btn btn-sm btn-ghost" ${paginationState.page === 1 ? 'disabled' : ''}>« Anterior</button>
                        <span style="font-size:0.9rem; color:var(--text-primary);">Página ${paginationState.page} de ${totalPages}</span>
                        <button id="btn-page-next" class="btn btn-sm btn-ghost" ${paginationState.page === totalPages ? 'disabled' : ''}>Siguiente »</button>
                    </div>
    `;
            }
        }

        // --- RENDER ACTIONS IN HEADER ---
        const actionsContainer = document.getElementById('workspace-actions');
        if (actionsContainer) {
            actionsContainer.innerHTML = '';
            // if (UserManager.canEdit()) {
            const btnAdd = document.createElement('button');
            btnAdd.className = 'btn btn-primary';
            btnAdd.innerHTML = `+ ${type.name.toUpperCase()}`; // Shorter label for header
            btnAdd.style.fontSize = '0.9rem';
            btnAdd.style.marginLeft = 'auto'; // Force right
            btnAdd.style.padding = '0.5rem 1rem';
            btnAdd.onclick = () => ItemManager.createItem(type.id);
            actionsContainer.appendChild(btnAdd);
            // }
        }

        container.innerHTML = `
            ${filterableFields.length > 0 ? filterHtml : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <div style="display:flex; align-items:center; gap:1.5rem;">
                    <span id="filtered-count" style="font-family:'Rajdhani'; font-weight:600; color:var(--text-secondary); letter-spacing:0.05em; font-size:1rem;"></span>
                    <label class="filter-chip" style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                        <input type="checkbox" id="toggle-pagination" ${paginationState.enabled ? 'checked' : ''} style="transform:scale(1.2);">
                        <span class="chip-visual" style="border-radius:4px; padding:0.4rem 1rem;">Paginación</span>
                    </label>
                </div>
            </div>
            
            <div id="items-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; padding-bottom: 2rem;">
                <!-- Items -->
            </div>
            
            <!-- Floating Pagination Bar (Bottom Right fixed or sticky?)
                 Let's make it a nice glassy bar at the bottom of the content flow -->
            <div style="margin-top:2rem; display:flex; justify-content:center; padding:1.5rem; background:rgba(0,0,0,0.2); border-radius:var(--radius-lg); border:1px solid var(--glass-border);">
                ${paginationHtml}
            </div>
`;

        if (store.data.adminMode) {
            const btn = document.getElementById('btn-edit-type');
            if (btn) btn.onclick = () => TypeManager.edit(type);
        }

        // Bind Checkboxes
        container.querySelectorAll('.filter-chk').forEach(chk => {
            chk.onchange = (e) => {
                const fId = e.target.dataset.fieldId;
                const val = e.target.value;

                if (!activeTypeFilters[fId]) activeTypeFilters[fId] = [];

                if (e.target.checked) {
                    if (!activeTypeFilters[fId].includes(val)) activeTypeFilters[fId].push(val);
                } else {
                    activeTypeFilters[fId] = activeTypeFilters[fId].filter(v => v !== val);
                }

                if (activeTypeFilters[fId].length === 0) delete activeTypeFilters[fId];

                paginationState.page = 1; // Reset pagination on filter
                renderWorkspace();
            };
        });

        const btnClear = document.getElementById('btn-clear-type-filters');
        if (btnClear) {
            btnClear.onclick = () => {
                for (const key in activeTypeFilters) {
                    if (key !== '_typeId') delete activeTypeFilters[key];
                }
                paginationState.page = 1; // Reset pagination logic
                renderWorkspace();
            };
        }

        container.querySelector('#btn-add-item').onclick = () => {
            if (!UserManager.canEdit()) return;
            ItemManager.createItem(type.id);
        };

        // Bind Pagination Events
        const togglePag = container.querySelector('#toggle-pagination');
        if (togglePag) {
            togglePag.onchange = (e) => {
                paginationState.enabled = e.target.checked;
                paginationState.page = 1;
                renderWorkspace();
            };
        }

        const btnPrev = container.querySelector('#btn-page-prev');
        if (btnPrev) {
            btnPrev.onclick = () => {
                if (paginationState.page > 1) {
                    paginationState.page--;
                    renderWorkspace();
                }
            };
        }

        const btnNext = container.querySelector('#btn-page-next');
        if (btnNext) {
            btnNext.onclick = () => {
                const totalPages = Math.ceil(items.length / paginationState.pageSize);
                if (paginationState.page < totalPages) {
                    paginationState.page++;
                    renderWorkspace();
                }
            };
        }

        const grid = container.querySelector('#items-grid');

        if (renderItems.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); margin-top: 2rem;">No hay resultados con estos filtros.</div>`;
        }

        renderItems.forEach(item => {
            const type = store.data.itemTypes.find(t => t.id === item.typeId); // Ensure type is found for section view

            // --- Card Container (Witcher Style Horizontal) ---
            const card = document.createElement('div');
            card.className = 'card horizontal-card';
            card.style.display = 'flex';
            card.style.minHeight = '175px'; // Increased by 30px (145 -> 175)
            card.style.background = 'linear-gradient(to right, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)';
            card.style.border = '1px solid rgba(148, 163, 184, 0.15)';
            card.style.borderRadius = '12px';
            // card.style.marginBottom = '1rem'; /* Removed for Grid Gap */
            card.style.position = 'relative'; /* For checkbox positioning */

            // 1. LEFT: Image
            const imgDiv = document.createElement('div');
            imgDiv.style.width = '130px'; // Slightly wider to match Aspect Ratio better
            imgDiv.style.minWidth = '130px';
            imgDiv.style.alignSelf = 'stretch'; // Stretch to match card height
            imgDiv.style.position = 'relative';
            imgDiv.style.position = 'relative';
            // Enhance image container with a shadow/glow
            imgDiv.style.boxShadow = '5px 0 20px rgba(0,0,0,0.5)';
            imgDiv.style.zIndex = '2';

            // FETCH FRESH ITEM to ensure gallery is up to date
            const freshItem = store.data.items.find(i => i.id === item.id) || item;

            let imgUrl = '';

            // SIMPLIFIED LOGIC: Just take the first available URL. 
            // The handleGridImageError will handle rotation if it's broken.
            if (freshItem.gallery && freshItem.gallery.length > 0) {
                const firstImg = freshItem.gallery.find(img => img.url);
                if (firstImg) imgUrl = firstImg.url;
            }


            // Fallback for legacy items without gallery
            if (!imgUrl && freshItem.images) {
                // Generic fallback: Take the first valid string URL from ANY key (front, box, cover, whatever)
                const legacyUrl = Object.values(freshItem.images).find(val => val && typeof val === 'string' && val.length > 5);
                if (legacyUrl) imgUrl = legacyUrl;
            }

            // LOGGING VIA FILE (Moved to see finalized URL)
            Logger.debug(`Rendering Item: ${freshItem.data?.nombre || 'Unknown'}`, {
                id: freshItem.id,
                view: store.data.currentTypeId ? 'Type' : (store.data.currentSectionId ? 'Section' : 'Home'),
                sectionId: store.data.currentSectionId,
                galleryCount: freshItem.gallery?.length,
                finalUrl: imgUrl
            });

            if (imgUrl) {
                Logger.debug(`[${freshItem.id}] ENTERED IF BLOCK (Has Image)`, { url: imgUrl });
                // Fix Local Paths (Windows)
                if (imgUrl && /^[a-zA-Z]:\\/.test(imgUrl)) {
                    imgUrl = 'file:///' + imgUrl.replace(/\\/g, '/');
                }

                // Use 'cover' to ensure full image availability (no cropping)
                // Center vertically/horizontally in the 125px slot
                // imgDiv.style.background = '#000'; // Removed black background for cleaner look
                imgDiv.style.display = 'flex';
                imgDiv.style.alignItems = 'center';
                imgDiv.style.justifyContent = 'center';
                imgDiv.style.borderRadius = '12px 0 0 12px';
                imgDiv.style.overflow = 'hidden';

                imgDiv.innerHTML = `<img src="${imgUrl}" data-img-index="0" style="width:100%; height:100%; object-fit:cover;" 
                    onerror="handleGridImageError(this, '${freshItem.id}')">`;
            } else {
                Logger.debug(`[${freshItem.id}] ENTERED ELSE BLOCK (No Image)`, { url: imgUrl });
                imgDiv.innerHTML = `<div style="width:100%; height:100%; background:rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; font-size:2rem;">${(type && type.icon) || '📦'}</div>`;
            }
            card.appendChild(imgDiv);

            // 2. RIGHT: Content
            const bodyDiv = document.createElement('div');
            bodyDiv.style.flex = '1';
            bodyDiv.style.padding = '0.75rem 1.25rem'; // Tuned padding
            bodyDiv.style.display = 'flex';
            bodyDiv.style.flexDirection = 'column';
            bodyDiv.style.justifyContent = 'flex-start'; // Natural flow from top
            bodyDiv.style.position = 'relative';

            // Subtle inner glow
            bodyDiv.style.background = 'radial-gradient(ellipse at 0% 50%, rgba(59, 130, 246, 0.05), transparent 60%)';

            // Title - Robust Check
            // Title - Robust Check
            let rawName = item.data.name || item.data.nombre || item.data.Name || item.data.Nombre || item.data.title || item.data.Title || item.data.Titulo;

            // Fallback: search for a field that looks like a title
            if (!rawName && type && type.fields) {
                const titleCandidate = type.fields.find(f => {
                    // 1. Check Usage Label
                    if (f.label && /nombre|nombres|name|title|título|titulo|juego|game/i.test(f.label)) return true;
                    // 2. Check Definition Label
                    const def = store.data.fieldDefinitions.find(d => d.id === f.fieldId);
                    if (def && /nombre|nombres|name|title|título|titulo|juego|game/i.test(def.label)) return true;
                    return false;
                });

                if (titleCandidate) {
                    const def = store.data.fieldDefinitions.find(d => d.id === titleCandidate.fieldId);
                    // Data is stored under the global key defined in the registry (def.key)
                    // But legacy items might use usage.key? 
                    // Let's try both.
                    const key1 = titleCandidate.key;
                    const key2 = def ? def.key : null;

                    if (key1 && item.data[key1]) rawName = item.data[key1];
                    else if (key2 && item.data[key2]) rawName = item.data[key2];
                }
            }

            // Ultimate Fallback: First field? No, that might be "ID" or "Date". 
            // Better to show "Sin Nombre" than "2023-01-01".

            const displayName = rawName || 'Sin Nombre';

            const title = document.createElement('h3');
            title.style.margin = '0 0 0.5rem 0';
            title.style.fontSize = '1.1rem';
            title.style.fontWeight = '700';
            title.style.lineHeight = '1.25';
            title.style.color = '#f1f5f9'; // Slate 100
            title.style.textShadow = '0 2px 4px rgba(0,0,0,0.3)';
            title.style.display = '-webkit-box';
            title.style.webkitLineClamp = '2';
            title.style.webkitBoxOrient = 'vertical';
            title.style.overflow = 'hidden';
            title.innerText = displayName;
            bodyDiv.appendChild(title);

            // Details/Fields grid
            // REMOVED !f.useForImageSearch filter to show all flagged fields
            // EXCLUDE Name/Title fields to avoid redundancy (Case insensitive check on ID and potential Label)
            const relevantFields = type ? type.fields.filter(f => {
                if (!f.showInList) return false;
                const lowerId = (f.fieldId || '').toLowerCase();
                if (lowerId === 'name' || lowerId === 'nombre' || lowerId === 'title' || lowerId === 'titulo') return false;

                // Also check Label if present (common in Legacy)
                if (f.label) {
                    const lowerLabel = f.label.toLowerCase();
                    if (lowerLabel.includes('nombre') || lowerLabel.includes('name') || lowerLabel.includes('título') || lowerLabel.includes('titulo')) return false;
                }

                // If it's a legacy ID like 'legacy_Nombre (Legacy)'
                if (lowerId.includes('name') || lowerId.includes('nombre')) return false;

                return true;
            }).slice(0, 6) : [];

            if (relevantFields.length > 0) {
                const detailsGrid = document.createElement('div');
                detailsGrid.style.display = 'grid';
                detailsGrid.style.gridTemplateColumns = 'auto 1fr';
                detailsGrid.style.gap = '0.25rem 1rem'; // Row col gap
                detailsGrid.style.fontSize = '0.85rem';
                detailsGrid.style.alignItems = 'baseline';
                // detailsGrid.style.marginTop = 'auto'; // Removed to reduce gap
                detailsGrid.style.marginTop = '0.5rem'; // Small gap from title

                relevantFields.forEach(usage => {
                    let def = store.data.fieldDefinitions.find(d => d.id === usage.fieldId);

                    // FALLBACK for Legacy imports that have usage but no Global Definition
                    if (!def && usage.label) {
                        def = {
                            id: usage.fieldId || 'legacy_' + usage.label,
                            key: usage.key || usage.label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                            label: usage.label,
                            type: usage.type || 'text'
                        };
                    }

                    // console.log('[DEBUG] Rendering Field:', usage.fieldId, 'Def:', def, 'Values:', item.data);
                    if (def) {
                        let val = item.data[def.key];
                        // Try fallback if key is empty
                        if (val === undefined || val === '') {
                            val = item.data[def.label] || item.data[def.label.toLowerCase()];
                        }

                        // DEEP SEARCH: Case-insensitive fallback for ANY key match
                        if (val === undefined || val === '') {
                            const foundKey = Object.keys(item.data).find(k => k.toLowerCase() === def.key.toLowerCase());
                            if (foundKey) val = item.data[foundKey];

                            // If still not found, try matching against label (e.g. key is 'brand' but data has 'Marca')
                            if (val === undefined || val === '') {
                                const foundLabelKey = Object.keys(item.data).find(k => k.toLowerCase() === def.label.toLowerCase());
                                if (foundLabelKey) val = item.data[foundLabelKey];
                            }

                            // CRITICAL FIX: Strip "(Legacy)" suffix and search again
                            if (val === undefined || val === '') {
                                const cleanLabel = def.label.replace(/\(Legacy\)/ig, '').replace(/\(Global\)/ig, '').trim().toLowerCase();
                                const foundCleanKey = Object.keys(item.data).find(k => k.toLowerCase() === cleanLabel);
                                if (foundCleanKey) val = item.data[foundCleanKey];

                                // SYNONYM FALLBACK (The "Fix it once and for all" clause)
                                if (!val && (cleanLabel.includes('plataforma') || cleanLabel.includes('platform'))) {
                                    const syns = ['plataforma', 'platform', 'console', 'consola', 'system', 'sistema'];
                                    const foundSyn = Object.keys(item.data).find(k => syns.includes(k.toLowerCase()));
                                    if (foundSyn) val = item.data[foundSyn];
                                }
                                if (!val && (cleanLabel.includes('marca') || cleanLabel.includes('brand'))) {
                                    const syns = ['marca', 'brand', 'fabricante', 'manufacturer', 'company'];
                                    const foundSyn = Object.keys(item.data).find(k => syns.includes(k.toLowerCase()));
                                    if (foundSyn) val = item.data[foundSyn];
                                }
                            }
                        }

                        if (val !== undefined && val !== '') {
                            // Trim if string
                            if (typeof val === 'string') {
                                // If it looks like a JSON array string (bug in old imports), parse it
                                if (val.startsWith('[') && val.endsWith(']')) {
                                    try { val = JSON.parse(val).join(', '); } catch (e) { }
                                }
                                val = val.trim();
                            }

                            if (def.type === 'boolean') val = val ? 'Sí' : 'No';

                            // Clean Label for Display
                            let displayLabel = def.label.replace(/\(Legacy\)/ig, '').trim();
                            const labelDiv = document.createElement('div');
                            labelDiv.style.textTransform = 'uppercase';
                            labelDiv.style.fontSize = '0.7rem';
                            labelDiv.style.fontWeight = '700';
                            labelDiv.style.color = '#94a3b8'; // Slate 400
                            labelDiv.style.letterSpacing = '0.05em';
                            labelDiv.style.whiteSpace = 'nowrap';
                            labelDiv.innerText = displayLabel + ':';
                            detailsGrid.appendChild(labelDiv);

                            // Value
                            const valDiv = document.createElement('div');
                            valDiv.style.color = '#e2e8f0'; // Slate 200
                            valDiv.style.fontWeight = '500';
                            valDiv.style.whiteSpace = 'nowrap';
                            valDiv.style.overflow = 'hidden';
                            valDiv.style.textOverflow = 'ellipsis';
                            valDiv.innerText = val;
                            detailsGrid.appendChild(valDiv);
                        }
                    }
                });
                bodyDiv.appendChild(detailsGrid);
            }

            card.appendChild(bodyDiv);


            card.onclick = () => {
                // Only allow editing if user has permission AND is in "Design Mode" (Admin Mode toggle)
                if (UserManager.canEdit() && store.data.adminMode) {
                    ItemManager.editItem(item);
                } else {
                    ItemManager.viewItem(item);
                }
            };

            // Selection Checkbox (Admin Only)
            if (UserManager.isAdmin() && store.data.adminMode) {
                const chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.className = 'item-select-checkbox';
                chk.style.position = 'absolute';
                chk.style.top = '10px';
                chk.style.right = '10px';
                chk.style.zIndex = '20';
                chk.onclick = (e) => e.stopPropagation();

                // Sync state logic
                chk.checked = selectedItems.has(item.id);
                chk.onchange = (e) => {
                    if (e.target.checked) selectedItems.add(item.id);
                    else selectedItems.delete(item.id);
                    renderFloatingActions();
                };

                card.appendChild(chk);
            }

            grid.appendChild(card);
        });
        renderFloatingActions(); // Ensure UI exists







































    } else if (store.data.currentView === 'section' && store.data.currentSectionId) {
        // --- SECTION DASHBOARD ---
        const section = store.data.sections.find(s => s.id === store.data.currentSectionId);
        if (!section) return;

        title.innerText = section.name;
        subtitle.innerText = 'Vista General de Sección';

        // 1. Calculate Totals
        const types = store.data.itemTypes.filter(t => t.sectionId === section.id);
        const allItems = store.data.items.filter(i => types.some(t => t.id === i.typeId));

        // 2. Filter Bar (Type Selection)
        let filterHtml = `
    <div style="display:flex; gap:0.5rem; overflow-x:auto; padding-bottom:0.5rem; margin-bottom:1rem; border-bottom:1px solid var(--border);">
        <button class="btn btn-sm ${activeSectionFilters.size === 0 ? 'btn-primary' : 'btn-ghost'}"
            id="filter-all">
            Todos (${allItems.length})
        </button>
`;

        types.forEach(t => {
            const count = allItems.filter(i => i.typeId === t.id).length;
            const isActive = activeSectionFilters.has(t.id);
            const style = isActive ? 'background:var(--primary); color:white;' : 'background:var(--bg-card); color:var(--text-secondary);';
            filterHtml += `
    <button class="btn btn-sm type-filter-btn" data-id="${t.id}" style="${style} border:1px solid var(--border);">
        ${t.icon} ${t.name} (${count})
                </button>
    `;
        });
        filterHtml += '</div>';

        // 2b. FIELD FILTERS (Only if exactly 1 Type is selected)
        if (activeSectionFilters.size === 1) {
            const currentFilteredTypeId = [...activeSectionFilters][0];
            const filterType = types.find(t => t.id === currentFilteredTypeId);

            // Auto-clear logic if switching types is handled in click events usually, but robust check here:
            if (activeSectionFieldFilters._typeId !== currentFilteredTypeId) {
                for (const k in activeSectionFieldFilters) delete activeSectionFieldFilters[k];
                activeSectionFieldFilters._typeId = currentFilteredTypeId;
            }

            if (filterType) {
                // Get items for this type to calculate facets
                const typeItems = allItems.filter(i => i.typeId === filterType.id);

                const filterableFields = filterType.fields.map(usage => {
                    let def = (store.data.fieldDefinitions || []).find(f => f.id === usage.fieldId);
                    if (!def) {
                        if (usage.filterable) {
                            const safeKey = (usage.key || usage.label || '').replace(/[^a-zA-Z0-9]/g, '_');
                            def = { id: usage.fieldId || 'legacy_' + safeKey, key: usage.key || usage.label, label: usage.label, type: 'text' };
                        } else return null;
                    }
                    if (usage.filterable) return { ...def, label: usage.label || def.label };
                    return null;
                }).filter(f => f);

                if (filterableFields.length > 0) {
                    filterHtml += `<div class="filter-panel" style="margin-bottom:1.5rem; background:rgba(0,0,0,0.1); padding:1rem; border-radius:8px;">`;
                    filterHtml += `<div style="width:100%; font-size:0.8rem; color:var(--text-secondary); margin-bottom:0.5rem; text-transform:uppercase; letter-spacing:1px; font-weight:bold;">Filtrar ${filterType.name}</div>`;

                    filterableFields.forEach(def => {
                        const facets = new Map();
                        typeItems.forEach(item => {
                            let rawVal = item.data[def.key];
                            if (def.type === 'boolean') rawVal = rawVal ? (def.booleanConfig?.trueLabel || 'Si') : (def.booleanConfig?.falseLabel || 'No');
                            if (rawVal === undefined || rawVal === null || rawVal === '') return;

                            if (def.type === 'checklist' && Array.isArray(rawVal)) {
                                rawVal.forEach(v => { const k = v.trim(); if (k) facets.set(k, (facets.get(k) || 0) + 1); });
                            } else {
                                const k = String(rawVal);
                                facets.set(k, (facets.get(k) || 0) + 1);
                            }
                        });

                        if (facets.size <= 1) return;

                        const activeValues = activeSectionFieldFilters[def.id] || [];

                        filterHtml += `
                        <div class="filter-group" style="margin-bottom: 0.75rem;">
                            <div class="filter-title" style="font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.25rem;">${def.label}</div>
                            <div class="filter-options" style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                        `;

                        facets.forEach((count, val) => {
                            const isChecked = activeValues.includes(val) ? 'checked' : '';
                            filterHtml += `
                                <label class="filter-chip" style="cursor: pointer; position: relative;">
                                    <input type="checkbox" class="section-field-filter-chk" data-field-id="${def.id}" value="${val.replace(/"/g, '&quot;')}" ${isChecked} style="position: absolute; opacity: 0; pointer-events: none;">
                                    <div class="chip-visual" style="
                                        display: inline-flex; align-items: center; gap: 0.3rem;
                                        padding: 0.25rem 0.6rem;
                                        border-radius: 12px;
                                        font-size: 0.8rem;
                                        font-weight: 500;
                                        border: 1px solid var(--glass-border);
                                        background: ${isChecked ? 'var(--primary)' : 'rgba(255,255,255,0.05)'};
                                        color: ${isChecked ? 'white' : 'var(--text-secondary)'};
                                        transition: all 0.2s;
                                    ">
                                        <span>${val}</span>
                                        <span style="opacity: 0.6; font-size: 0.7rem; background: rgba(0,0,0,0.2); padding: 0 0.3rem; border-radius: 4px;">${count}</span>
                                    </div>
                                </label>
                            `;
                        });
                        filterHtml += `</div></div>`;
                    });
                    // Clear button
                    const hasActive = Object.keys(activeSectionFieldFilters).some(k => k !== '_typeId');
                    if (hasActive) {
                        filterHtml += `<button id="btn-clear-sec-filters" class="btn btn-ghost btn-sm" style="color:var(--accent); margin-top:0.5rem;">Limpiar Filtros</button>`;
                    }
                    filterHtml += `</div>`;
                }
            }
        }

        // --- RENDER ACTIONS IN HEADER (Section View) ---
        const actionsContainer = document.getElementById('workspace-actions');
        if (actionsContainer) {
            actionsContainer.innerHTML = '';
            actionsContainer.innerHTML = '';
            // Force render for debug/visibility - checking logic later
            // if (UserManager.canEdit()) {
            const btnAdd = document.createElement('button');
            btnAdd.className = 'btn btn-primary';
            btnAdd.style.marginLeft = 'auto'; // Force right
            btnAdd.innerHTML = `+ Añadir Artículo`;
            btnAdd.style.fontSize = '0.9rem';
            btnAdd.style.padding = '0.5rem 1rem';

            btnAdd.onclick = () => {
                if (types.length === 0) {
                    alert('Primero debes definir al menos un "Tipo" de artículo.');
                } else if (types.length === 1) {
                    ItemManager.createItem(types[0].id);
                } else {
                    import('./ui/Modal.js').then(({ Modal }) => {
                        Modal.show({
                            title: 'Seleccionar Tipo',
                            renderContent: (c) => {
                                c.innerHTML = `<div style="display:flex; flex-direction:column; gap:0.5rem;">
                                        ${types.map(t => `<button class="btn btn-secondary" onclick="ItemManager.createItem('${t.id}'); Modal.close();">${t.icon} ${t.name}</button>`).join('')}
                                    </div>`;
                            },
                            showCancel: true,
                            saveLabel: null
                        });
                    });
                }
            };
            actionsContainer.appendChild(btnAdd);
        }

        container.innerHTML = `
            ${filterHtml}
            <div id="items-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; padding-top:1rem;">
                <!-- Mixed Items -->
            </div>
`;


        // Filter Logic Binding
        container.querySelector('#filter-all').onclick = () => {
            activeSectionFilters.clear();
            renderWorkspace();
        };

        container.querySelectorAll('.type-filter-btn').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                if (activeSectionFilters.has(id)) {
                    activeSectionFilters.delete(id);
                } else {
                    activeSectionFilters.add(id);
                }
                // Clear field filters when type selection changes
                for (const k in activeSectionFieldFilters) delete activeSectionFieldFilters[k];
                renderWorkspace();
            };
        });

        // Field Filter Listeners
        container.querySelectorAll('.section-field-filter-chk').forEach(chk => {
            chk.onchange = (e) => {
                const fId = e.target.dataset.fieldId;
                const val = e.target.value;
                if (!activeSectionFieldFilters[fId]) activeSectionFieldFilters[fId] = [];

                if (e.target.checked) {
                    if (!activeSectionFieldFilters[fId].includes(val)) activeSectionFieldFilters[fId].push(val);
                } else {
                    activeSectionFieldFilters[fId] = activeSectionFieldFilters[fId].filter(v => v !== val);
                }
                if (activeSectionFieldFilters[fId].length === 0) delete activeSectionFieldFilters[fId];
                renderWorkspace();
            };
        });

        const btnClearSec = document.getElementById('btn-clear-sec-filters');
        if (btnClearSec) {
            btnClearSec.onclick = () => {
                const typeId = activeSectionFieldFilters._typeId;
                for (const k in activeSectionFieldFilters) delete activeSectionFieldFilters[k];
                if (typeId) activeSectionFieldFilters._typeId = typeId; // Preserve type context
                renderWorkspace();
            };
        }




        const grid = container.querySelector('#items-grid');

        // Apply Filter
        let filteredItems = allItems;
        if (activeSectionFilters.size > 0) {
            filteredItems = allItems.filter(i => activeSectionFilters.has(i.typeId));
        }

        // Apply FIELD FILTERS (AND logic)
        filteredItems = filteredItems.filter(item => {
            for (const fId in activeSectionFieldFilters) {
                if (fId === '_typeId') continue;
                const activeValues = activeSectionFieldFilters[fId] || [];
                if (activeValues.length === 0) continue;

                // Find definition (reuse logic from loop above? inefficient but safe)
                // Just grab value from item data
                let itemVal = item.data[fId]; // Try direct key
                // If undefined, we need to map fId back to key? 
                // The 'fId' stored in activeSectionFieldFilters IS the field DEFINITION ID.
                // So we should look up the definition.
                const type = store.data.itemTypes.find(t => t.id === item.typeId);
                if (type) {
                    const usage = type.fields.find(f => f.fieldId === fId);
                    if (usage) {
                        let def = (store.data.fieldDefinitions || []).find(f => f.id === fId);
                        const key = def ? def.key : (usage.key || usage.label);
                        itemVal = item.data[key];
                        if (def && def.type === 'boolean') {
                            itemVal = itemVal ? (def.booleanConfig?.trueLabel || 'Si') : (def.booleanConfig?.falseLabel || 'No');
                        }
                    }
                }

                if (itemVal === undefined || itemVal === null || itemVal === '') return false;

                if (Array.isArray(itemVal)) {
                    if (!itemVal.some(v => activeValues.includes(String(v).trim()))) return false;
                } else {
                    if (!activeValues.includes(String(itemVal))) return false;
                }
            }
            return true;
        });

        if (filteredItems.length === 0) {
            grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); margin-top: 2rem;">No hay artículos que coincidan con el filtro.</div>`;
        } else {
            filteredItems.forEach(item => {
                const type = store.data.itemTypes.find(t => t.id === item.typeId);
                const freshItem = store.data.items.find(i => i.id === item.id) || item;
                const card = document.createElement('div');
                card.className = 'card horizontal-card';
                card.style.display = 'flex';
                card.style.minHeight = '145px';
                card.style.background = 'linear-gradient(to right, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)';
                card.style.border = '1px solid rgba(148, 163, 184, 0.15)';
                card.style.borderRadius = '12px';
                card.style.position = 'relative';

                // 1. LEFT: Image
                const imgDiv = document.createElement('div');
                imgDiv.style.width = '125px';
                imgDiv.style.minWidth = '125px';
                imgDiv.style.alignSelf = 'stretch';
                imgDiv.style.position = 'relative';
                imgDiv.style.boxShadow = '5px 0 20px rgba(0,0,0,0.5)';
                imgDiv.style.zIndex = '2';

                // ROBUST IMAGE SELECTION (Unified)
                let imgUrl = '';
                let hasLegacyImages = freshItem.images && Object.keys(freshItem.images).length > 0;
                let galleryCount = (freshItem.gallery || []).length;

                // 1. Try Gallery First with Robust Check
                if (freshItem.gallery && freshItem.gallery.length > 0) {
                    const firstImg = freshItem.gallery.find(img => img.url);
                    if (firstImg) imgUrl = firstImg.url;
                }
                // 2. Fallback to Legacy
                else if (hasLegacyImages) {
                    const fallbackKey = Object.keys(freshItem.images).find(k => typeof freshItem.images[k] === 'string' && freshItem.images[k].length > 5);
                    if (fallbackKey) imgUrl = freshItem.images[fallbackKey];
                }

                // 3. Fix Local Windows Paths properly
                if (imgUrl && typeof imgUrl === 'string' && !imgUrl.startsWith('http') && !imgUrl.startsWith('file://')) {
                    if (imgUrl.match(/^[a-zA-Z]:\\/)) {
                        imgUrl = 'file:///' + imgUrl.replace(/\\/g, '/');
                    }
                }

                if (imgUrl) {
                    imgDiv.style.background = '#000';
                    imgDiv.style.display = 'flex';
                    imgDiv.style.alignItems = 'center';
                    imgDiv.style.justifyContent = 'center';
                    imgDiv.style.borderRadius = '12px 0 0 12px';
                    imgDiv.style.overflow = 'hidden';

                    imgDiv.innerHTML = `<img src="${imgUrl}" data-img-index="0" style="width:100%; height:100%; object-fit:contain;" 
                        onerror="handleGridImageError(this, '${freshItem.id}')">`;
                } else {
                    imgDiv.innerHTML = `<div style="width:100%; height:100%; background:rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; font-size:2rem;">${(type && type.icon) || '📦'}</div>`;
                }
                card.appendChild(imgDiv);

                // 2. RIGHT: Content
                const bodyDiv = document.createElement('div');
                bodyDiv.style.flex = '1';
                bodyDiv.style.padding = '0.75rem 1.25rem';
                bodyDiv.style.display = 'flex';
                bodyDiv.style.flexDirection = 'column';
                bodyDiv.style.justifyContent = 'flex-start';
                bodyDiv.style.position = 'relative';
                bodyDiv.style.background = 'radial-gradient(ellipse at 0% 50%, rgba(59, 130, 246, 0.05), transparent 60%)';

                // Validate Name/Title
                // Validate Name/Title
                let rawName = item.data.name || item.data.nombre || item.data.Name || item.data.Nombre || item.data.title || item.data.Title || item.data.Titulo;

                // Fallback: search for a field that looks like a title
                if (!rawName && type && type.fields) {
                    const titleCandidate = type.fields.find(f => {
                        if (f.label && /nombre|nombres|name|title|título|titulo|juego|game/i.test(f.label)) return true;
                        const def = store.data.fieldDefinitions.find(d => d.id === f.fieldId);
                        if (def && /nombre|nombres|name|title|título|titulo|juego|game/i.test(def.label)) return true;
                        return false;
                    });

                    if (titleCandidate) {
                        const def = store.data.fieldDefinitions.find(d => d.id === titleCandidate.fieldId);
                        const key1 = titleCandidate.key;
                        const key2 = def ? def.key : null;
                        if (key1 && item.data[key1]) rawName = item.data[key1];
                        else if (key2 && item.data[key2]) rawName = item.data[key2];
                    }
                }

                const displayName = rawName || 'Sin Nombre';

                const titleEl = document.createElement('h3');
                titleEl.style.margin = '0 0 0.5rem 0';
                titleEl.style.fontSize = '0.95rem';
                titleEl.style.fontWeight = '700';
                titleEl.style.lineHeight = '1.25';
                titleEl.style.color = '#f1f5f9';
                titleEl.style.textShadow = '0 2px 4px rgba(0,0,0,0.3)';
                titleEl.style.display = '-webkit-box';
                titleEl.style.webkitLineClamp = '2';
                titleEl.style.webkitBoxOrient = 'vertical';
                titleEl.style.overflow = 'hidden';
                titleEl.innerText = displayName;
                bodyDiv.appendChild(titleEl);



                // Render Fields (Same logic as Type View)
                const visibleFields = type.fields.filter((f, index) => index === 0 || f.showInList); // Re-using simple logic for now but layout is horizontal

                if (visibleFields.length > 0) {
                    const detailsGrid = document.createElement('div');
                    detailsGrid.style.display = 'grid';
                    detailsGrid.style.gridTemplateColumns = 'auto 1fr';
                    detailsGrid.style.gap = '0.25rem 1rem';
                    detailsGrid.style.fontSize = '0.85rem';
                    detailsGrid.style.alignItems = 'baseline';
                    detailsGrid.style.marginTop = '0.5rem';

                    visibleFields.forEach((usage, idx) => {
                        // Skip Title (idx 0)
                        if (idx === 0) return;

                        const def = (store.data.fieldDefinitions || []).find(f => f.id === usage.fieldId);
                        const label = def ? def.label : (usage.label || 'Unknown');
                        const key = def ? def.key : (usage.key || usage.label);

                        let val = item.data[key];
                        // Simple value processing (Section View style)
                        if (typeof val === 'boolean') {
                            if (def && def.booleanConfig) val = val ? def.booleanConfig.trueLabel : def.booleanConfig.falseLabel;
                            else val = val ? 'Si' : 'No';
                        } else if (Array.isArray(val)) {
                            val = val.join(', ');
                        } else if (!val && val !== 0) {
                            val = '-';
                        }

                        let displayLabel = label.replace(/\(Legacy\)/ig, '').trim();
                        const labelDiv = document.createElement('div');
                        labelDiv.style.textTransform = 'uppercase';
                        labelDiv.style.fontSize = '0.7rem';
                        labelDiv.style.fontWeight = '700';
                        labelDiv.style.color = '#94a3b8';
                        labelDiv.style.letterSpacing = '0.05em';
                        labelDiv.style.whiteSpace = 'nowrap';
                        labelDiv.innerText = displayLabel + ':';
                        detailsGrid.appendChild(labelDiv);

                        const valDiv = document.createElement('div');
                        valDiv.style.color = '#e2e8f0';
                        valDiv.style.fontWeight = '500';
                        valDiv.style.whiteSpace = 'nowrap';
                        valDiv.style.overflow = 'hidden';
                        valDiv.style.textOverflow = 'ellipsis';
                        let prevVal = val;
                        // Resolve Reference
                        if (def.type === 'reference' && val) {
                            const refItem = store.data.items.find(i => i.id === val);
                            if (refItem) {
                                // Try to find name
                                let refName = 'Item ' + refItem.id;
                                if (refItem.data) {
                                    const keys = Object.keys(refItem.data);
                                    let found = keys.find(k => k.toLowerCase().includes('nombre') || k.toLowerCase().includes('name') || k.toLowerCase().includes('título'));
                                    if (!found) found = keys[0];
                                    if (found) refName = refItem.data[found];
                                }
                                val = refName; // Display Name
                            }
                        }

                        valDiv.innerText = val;
                        detailsGrid.appendChild(valDiv);
                    });
                    bodyDiv.appendChild(detailsGrid);
                }

                card.appendChild(bodyDiv);

                card.onclick = () => {
                    if (store.data.adminMode) ItemManager.editItem(item);
                    else ItemManager.viewItem(item);
                };

                // Checkbox
                if (store.data.adminMode) {
                    const chk = document.createElement('input');
                    chk.type = 'checkbox';
                    chk.className = 'item-select-checkbox';
                    chk.style.position = 'absolute';
                    chk.style.top = '10px';
                    chk.style.right = '10px';
                    chk.style.zIndex = '20';
                    chk.style.width = '18px';
                    chk.style.height = '18px';
                    chk.style.cursor = 'pointer';

                    chk.checked = selectedItems.has(item.id);
                    chk.onclick = (e) => e.stopPropagation();
                    chk.onchange = (e) => {
                        if (e.target.checked) selectedItems.add(item.id);
                        else selectedItems.delete(item.id);
                        renderFloatingActions();
                    };
                    card.appendChild(chk);
                }

                grid.appendChild(card);
            });
            renderFloatingActions();
        }

    } else {

        title.innerText = 'Inicio';
        subtitle.innerText = 'Selecciona una colección';
        container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); margin-top: 3rem;">Bienvenido a tu Biblioteca Universal</div>';
    }
}

// Subscriptions
store.subscribe((key) => {
    if (['collections', 'sections', 'itemTypes'].includes(key)) renderSidebar();
    if (['items', 'currentView', 'currentTypeId', 'currentSectionId'].includes(key)) renderWorkspace();
    if (key === 'adminMode') {
        renderSidebar();
        renderWorkspace();
    }
});

if (window.api) {
    window.api.on('toggle-admin-mode', () => {
        store.data.adminMode = !store.data.adminMode;
        console.log('Admin Mode:', store.data.adminMode);
    });
}



document.addEventListener('DOMContentLoaded', init);
