import { store } from '../state.js';
import { Modal } from '../ui/Modal.js';
import { ImageManager } from './ImageManager.js';
import { ImageSelector } from '../ui/ImageSelector.js';
import { UserManager } from './UserManager.js';
import { SettingsManager } from './SettingsManager.js';


export const ItemManager = {
    createItem(typeId) {
        const type = store.data.itemTypes.find(t => t.id === typeId);
        if (!type) return;

        const draft = {
            id: 'item_' + Date.now(),
            typeId: typeId, // Linked to Type, not Inventory
            sectionId: type.sectionId, // Denormalized for easier querying if needed
            createdAt: new Date().toISOString(),
            data: {},
            gallery: [{
                id: 'img_' + Date.now(),
                label: 'Portada',
                url: ''
            }] // Initialize with default empty slot
        };

        // Initialize default values based on fields
        type.fields.forEach(fieldUsage => {
            // Handle both reference (fieldId) and embedded definition
            let fieldDef = fieldUsage;
            if (fieldUsage.fieldId) {
                fieldDef = store.data.fieldDefinitions.find(f => f.id === fieldUsage.fieldId);
            }

            if (fieldDef && fieldDef.key) {
                draft.data[fieldDef.key] = '';
            }
        });

        this.openEditor(draft, type);
    },

    editItem(item) {
        const type = store.data.itemTypes.find(t => t.id === item.typeId);
        if (!type) return;

        const draft = JSON.parse(JSON.stringify(item));
        this.openEditor(draft, type);
    },

    openEditor(draft, type) {
        Modal.show({
            title: draft.createdAt ? `Editar ${type.name}` : `Nuevo ${type.name}`,
            saveLabel: UserManager.canEdit() ? 'Guardar' : null,
            renderContent: (container) => {
                container.innerHTML = ''; // Clean

                // Header Actions (Duplicate/Delete/Barcode)
                if (UserManager.canEdit()) {
                    const headerActions = document.createElement('div');
                    headerActions.style.display = 'flex';
                    headerActions.style.justifyContent = 'space-between'; // Spread
                    headerActions.style.marginBottom = '0.5rem';

                    // Left: Barcode
                    const btnBarcode = document.createElement('button');
                    btnBarcode.className = 'btn btn-sm btn-ghost';
                    btnBarcode.innerHTML = '📟 Código de Barras';
                    btnBarcode.title = "Escanear o Asociar Código";
                    btnBarcode.onclick = () => {
                        this.handleBarcodeAction(draft);
                    };
                    headerActions.appendChild(btnBarcode);

                    // Right: Dup/Del
                    const rightGroup = document.createElement('div');
                    rightGroup.style.display = 'flex';

                    if (draft.createdAt) {
                        const btnDup = document.createElement('button');
                        btnDup.className = 'btn btn-sm btn-ghost';
                        btnDup.innerHTML = '📋 Duplicar';
                        btnDup.onclick = () => {
                            this.duplicateItem(draft);
                        };
                        rightGroup.appendChild(btnDup);

                        const btnDel = document.createElement('button');
                        btnDel.className = 'btn btn-sm btn-ghost';
                        btnDel.style.color = 'var(--accent, #ff4444)';
                        btnDel.style.marginLeft = '0.5rem';
                        btnDel.innerHTML = '🗑️ Eliminar';
                        btnDel.onclick = () => {
                            Modal.confirm({
                                title: 'Eliminar Artículo',
                                message: '¿Seguro que quieres borrar este artículo permanentemente?',
                                isDanger: true,
                                confirmLabel: 'Borrar',
                                onConfirm: async () => {
                                    await store.deleteItem(draft.id);
                                    document.querySelector('.modal-overlay')?.remove();
                                }
                            });
                        };
                        rightGroup.appendChild(btnDel);
                    }
                    headerActions.appendChild(rightGroup);
                    container.appendChild(headerActions);
                }

                // Tabs
                const tabsDiv = document.createElement('div');
                tabsDiv.style.display = 'flex';
                tabsDiv.style.borderBottom = '1px solid var(--border)';
                tabsDiv.style.marginBottom = '1rem';

                const tabGeneral = document.createElement('button');
                tabGeneral.className = 'btn-ghost';
                tabGeneral.innerText = 'General';
                tabGeneral.style.borderBottom = '2px solid var(--primary)';

                const tabMedia = document.createElement('button');
                tabMedia.className = 'btn-ghost';
                tabMedia.innerText = 'Multimedia';
                tabMedia.style.opacity = '0.7';

                tabsDiv.appendChild(tabGeneral);
                tabsDiv.appendChild(tabMedia);
                container.appendChild(tabsDiv);

                const contentGeneral = document.createElement('div');
                const contentMedia = document.createElement('div');
                contentMedia.style.display = 'none';

                container.appendChild(contentGeneral);
                container.appendChild(contentMedia);

                const switchTab = (t) => {
                    if (t === 'general') {
                        contentGeneral.style.display = 'block';
                        contentMedia.style.display = 'none';
                        tabGeneral.className = 'btn-ghost active-tab';
                        tabGeneral.style.borderBottom = '2px solid var(--primary)';
                        tabGeneral.style.color = 'var(--primary)';
                        tabMedia.className = 'btn-ghost';
                        tabMedia.style.borderBottom = 'none';
                        tabMedia.style.color = 'var(--text-secondary)';
                    } else {
                        contentGeneral.style.display = 'none';
                        contentMedia.style.display = 'block';
                        tabMedia.className = 'btn-ghost active-tab';
                        tabMedia.style.borderBottom = '2px solid var(--primary)';
                        tabMedia.style.color = 'var(--primary)';
                        tabGeneral.className = 'btn-ghost';
                        tabGeneral.style.borderBottom = 'none';
                        tabGeneral.style.color = 'var(--text-secondary)';
                    }
                };

                tabGeneral.onclick = () => switchTab('general');
                tabMedia.onclick = () => switchTab('media');

                // --- General Content ---
                const form = document.createElement('div');
                form.className = 'item-form';
                form.style.display = 'flex';
                form.style.flexDirection = 'column';
                form.style.gap = '1rem';

                // We need to track field dependencies
                const fieldInputs = {}; // Map fieldId -> Input Element
                const dependentFields = []; // List of { wrapper, usage } to check updates

                type.fields.forEach(usage => {
                    // usage: { fieldId, mandatory, showIf, ... }
                    const def = (store.data.fieldDefinitions || []).find(f => f.id === usage.fieldId);

                    // Fallback for legacy
                    const fieldLabel = def ? def.label : (usage.label || 'Campo Desconocido');
                    const fieldKey = def ? def.key : (usage.key || usage.label); // Legacy usage might not have key
                    const fieldType = def ? def.type : (usage.type || 'text');

                    const fieldWrapper = document.createElement('div');
                    fieldWrapper.className = 'field-wrapper';
                    fieldWrapper.dataset.fieldId = usage.fieldId; // For dependency lookup

                    // Dependency tracking
                    if (usage.showIf) {
                        dependentFields.push({ wrapper: fieldWrapper, rule: usage.showIf });
                        // Initially hide? We'll run an update loop at the end
                    }

                    const label = document.createElement('label');
                    label.innerText = fieldLabel + (usage.mandatory ? ' *' : '');
                    label.style.display = 'block';
                    label.style.marginBottom = '0.5rem';
                    label.style.color = 'var(--text-secondary)';

                    let input;
                    const val = draft.data[fieldKey];

                    // --- RENDERERS ---
                    if (fieldType === 'boolean') {
                        // Custom Boolean as Select
                        input = document.createElement('select');
                        input.style.width = '100%';
                        input.style.padding = '0.5rem';
                        input.style.background = 'var(--bg-input)';
                        input.style.border = '1px solid var(--border)';
                        input.style.color = 'var(--text-main)';

                        const opts = [
                            { val: '', label: '-- Seleccionar --' },
                            { val: 'true', label: def?.booleanConfig?.trueLabel || 'Si' },
                            { val: 'false', label: def?.booleanConfig?.falseLabel || 'No' }
                        ];

                        opts.forEach(o => {
                            const opt = document.createElement('option');
                            opt.value = o.val;
                            opt.text = o.label;
                            // Handle string vs boolean conversion
                            if (String(val) === o.val) opt.selected = true;
                            input.appendChild(opt);
                        });

                        input.onchange = (e) => {
                            // Save as actual boolean if possible, or string?
                            // Let's stick to string 'true'/'false' for consistency in Selects, or parse.
                            // The store treats data as JSON, so boolean is fine.
                            if (e.target.value === 'true') draft.data[fieldKey] = true;
                            else if (e.target.value === 'false') draft.data[fieldKey] = false;
                            else draft.data[fieldKey] = null;

                            checkDependencies();
                        };

                    } else if (fieldType === 'textarea') {
                        input = document.createElement('textarea');
                        input.rows = 4;
                        input.value = val || '';
                        input.style.width = '100%';
                        input.style.padding = '0.5rem';
                        input.style.background = 'var(--bg-input)';
                        input.style.border = '1px solid var(--border)';
                        input.style.color = 'var(--text-main)';
                        input.oninput = (e) => draft.data[fieldKey] = e.target.value;

                    } else if (fieldType === 'select') {
                        input = document.createElement('select');
                        input.style.width = '100%';
                        input.style.padding = '0.5rem';
                        input.style.background = 'var(--bg-input)';
                        input.style.border = '1px solid var(--border)';
                        input.style.color = 'var(--text-main)';

                        const defaultOpt = document.createElement('option');
                        defaultOpt.value = '';
                        defaultOpt.text = '-- Seleccionar --';
                        input.appendChild(defaultOpt);

                        (def?.options || []).forEach(optVal => {
                            const opt = document.createElement('option');
                            opt.value = optVal;
                            opt.text = optVal;
                            if (val === optVal) opt.selected = true;
                            input.appendChild(opt);
                        });

                        input.onchange = (e) => {
                            draft.data[fieldKey] = e.target.value;
                            checkDependencies();
                        };

                    } else if (fieldType === 'reference') {
                        // Dynamic Reference Dropdown
                        input = document.createElement('select');
                        input.style.width = '100%';
                        input.style.padding = '0.5rem';
                        input.style.background = 'var(--bg-input)';
                        input.style.border = '1px solid var(--border)';
                        input.style.color = 'var(--text-main)';

                        const targetTypeId = def?.referenceConfig?.targetTypeId;
                        const defaultOpt = document.createElement('option');
                        defaultOpt.value = '';
                        defaultOpt.text = targetTypeId ? '-- Seleccionar Artículo --' : '-- Sin configuración de destino --';
                        input.appendChild(defaultOpt);

                        if (targetTypeId) {
                            // Fetch all items of target type
                            const candidates = store.data.items.filter(i => i.typeId === targetTypeId);
                            candidates.forEach(c => {
                                const opt = document.createElement('option');
                                opt.value = c.id;
                                // Use first text field as label if possible, or ID
                                // We can use the logic "getName(c)" but here we don't have it easily.
                                // Let's rely on configured key 'name' or fallback.
                                let name = 'Sin Nombre';
                                // Try to find a sensible name
                                // 1. Scan fields of target type for "Name/Nombre"
                                // 2. Or just take first key in data.
                                // Quick fix: Use first non-empty string value in data
                                if (c.data && typeof c.data === 'object') {
                                    // Priority keys
                                    const keys = Object.keys(c.data);
                                    let found = keys.find(k => k.toLowerCase().includes('nombre') || k.toLowerCase().includes('name') || k.toLowerCase().includes('título'));
                                    if (!found) found = keys[0]; // First key
                                    if (found) name = c.data[found];
                                }
                                opt.text = name || c.id;
                                if (val === c.id) opt.selected = true;
                                input.appendChild(opt);
                            });
                        }

                        input.onchange = (e) => {
                            draft.data[fieldKey] = e.target.value;
                            checkDependencies();
                        };

                    } else if (fieldType === 'checklist') {
                        // Multi-select Checkboxes
                        input = document.createElement('div');
                        input.style.display = 'grid';
                        input.style.gap = '0.5rem';
                        input.style.padding = '0.5rem';
                        input.style.background = 'var(--bg-input)';
                        input.style.border = '1px solid var(--border)';
                        input.style.borderRadius = '4px';

                        // Ensure current val is array
                        const currentArr = Array.isArray(val) ? val : [];

                        (def?.options || []).forEach(optVal => {
                            const row = document.createElement('label');
                            row.style.display = 'flex';
                            row.style.alignItems = 'center';
                            row.style.gap = '0.5rem';
                            row.style.cursor = 'pointer';

                            const chk = document.createElement('input');
                            chk.type = 'checkbox';
                            chk.value = optVal;
                            chk.checked = currentArr.includes(optVal);

                            chk.onchange = (e) => {
                                let newArr = Array.isArray(draft.data[fieldKey]) ? [...draft.data[fieldKey]] : [];
                                if (e.target.checked) newArr.push(optVal);
                                else newArr = newArr.filter(x => x !== optVal);
                                draft.data[fieldKey] = newArr;
                                checkDependencies(); // Checklist usually doesn't trigger dependencies but could
                            };

                            row.appendChild(chk);
                            row.appendChild(document.createTextNode(optVal));
                            input.appendChild(row);
                        });

                    } else if (fieldType === 'rating') {
                        // Simple 1-5 Select for now to be robust
                        input = document.createElement('select');
                        input.style.width = '100px';
                        input.style.padding = '0.5rem';
                        input.style.background = 'var(--bg-input)';
                        input.style.color = '#F59E0B'; // Gold color (Tailwind amber-500)
                        input.innerHTML = '<option value="">-</option>';
                        [1, 2, 3, 4, 5].forEach(n => {
                            const o = document.createElement('option');
                            o.value = n;
                            o.text = '★'.repeat(n);
                            if (Number(val) === n) o.selected = true;
                            input.appendChild(o);
                        });
                        input.onchange = (e) => draft.data[fieldKey] = Number(e.target.value);

                    } else {
                        // Default: Text, Number, Date, URL
                        input = document.createElement('input');
                        input.type = fieldType === 'number' ? 'number' : (fieldType === 'date' ? 'date' : (fieldType === 'url' ? 'url' : 'text'));
                        input.name = fieldKey; // Add name attribute for barcode scanner
                        input.value = val || '';
                        input.style.width = '100%';
                        input.style.padding = '0.5rem';
                        input.style.background = 'var(--bg-input)';
                        input.style.border = '1px solid var(--border)';
                        input.style.color = 'var(--text-main)';

                        input.oninput = (e) => {
                            draft.data[fieldKey] = e.target.value;
                            checkDependencies(); // Text input usually doesn't trigger unless exact match needed
                        };
                    }

                    fieldWrapper.appendChild(label);
                    fieldWrapper.appendChild(input);
                    form.appendChild(fieldWrapper);

                    // Register for dependency check
                    if (usage.fieldId) {
                        fieldInputs[usage.fieldId] = { input, key: fieldKey, type: fieldType };
                    }
                });

                // Dependency Logic System
                const checkDependencies = () => {
                    dependentFields.forEach(({ wrapper, rule }) => {
                        // rule: { fieldId: 'parent_id', value: 'expected_val' }
                        const parent = fieldInputs[rule.fieldId];
                        if (!parent) return; // Parent not found in this form

                        // Get current value of parent from draft.data (source of truth)
                        const parentVal = draft.data[parent.key];

                        // Compare. 
                        // If parent is boolean, parentVal is true/false. rule.value is likely string 'true'/'false' from input.
                        const match = String(parentVal) === String(rule.value);

                        wrapper.style.display = match ? 'block' : 'none';

                        // Optional: Clear child value if hidden?
                        // if (!match) draft.data[childKey] = null; // Maybe too aggressive
                    });
                };

                // contentGeneral.appendChild(form); // Already appended? No, replace logic.
                contentGeneral.appendChild(form);

                // Initial check
                setTimeout(checkDependencies, 0); // Next tick to ensure values are bound

                // --- Multimedia Content ---
                // --- Multimedia Content (Dynamic Gallery) ---

                // MIGRATION: Convert old fixed slots to dynamic array if needed
                if (!draft.gallery) {
                    draft.gallery = [];
                    if (draft.images) {
                        const labelMap = { front: 'Portada', back: 'Contraportada', disc: 'Disco/Cartucho', box: 'Caja Completa' };
                        Object.keys(draft.images).forEach(key => {
                            if (draft.images[key]) {
                                draft.gallery.push({
                                    id: 'img_' + Date.now() + Math.random().toString(36).substr(2, 5),
                                    label: labelMap[key] || key,
                                    url: draft.images[key]
                                });
                            }
                        });
                        // Clear old structure to avoid confusion (optional, but cleaner)
                        // delete draft.images; 
                    }
                }

                const renderGallery = () => {
                    contentMedia.innerHTML = '';

                    // Toolbar
                    const tools = document.createElement('div');
                    tools.style.marginBottom = '1rem';
                    tools.style.textAlign = 'right';

                    const btnAdd = document.createElement('button');
                    btnAdd.className = 'btn btn-primary btn-sm';
                    btnAdd.innerText = '+ Añadir Imagen';
                    btnAdd.onclick = () => {
                        draft.gallery.push({
                            id: 'img_' + Date.now(),
                            label: 'Nueva Imagen',
                            url: ''
                        });
                        renderGallery();
                    };

                    tools.appendChild(btnAdd);
                    contentMedia.appendChild(tools);

                    // List
                    const list = document.createElement('div');
                    list.style.display = 'flex';
                    list.style.flexDirection = 'column';
                    list.style.gap = '1rem';

                    if (draft.gallery.length === 0) {
                        list.innerHTML = '<div style="text-align:center; color:var(--text-secondary); padding:2rem; border:1px dashed var(--border); border-radius:8px;">No hay imágenes. Añade una.</div>';
                    }

                    draft.gallery.forEach((imgData, idx) => {
                        const row = document.createElement('div');
                        row.style.display = 'flex';
                        row.style.gap = '1rem';
                        row.style.background = 'var(--bg-input)';
                        row.style.padding = '0.75rem';
                        row.style.borderRadius = '8px';
                        row.style.border = '1px solid var(--border)';
                        row.style.alignItems = 'center';

                        // 0. Sort Controls (Left of Image)
                        const sortCol = document.createElement('div');
                        sortCol.style.display = 'flex';
                        sortCol.style.flexDirection = 'column';
                        sortCol.style.gap = '4px';
                        sortCol.style.marginRight = '0.5rem';

                        const btnUp = document.createElement('button');
                        btnUp.type = 'button'; // Prevent form submission
                        btnUp.className = 'btn btn-ghost btn-xs';
                        btnUp.innerHTML = '▲';
                        btnUp.title = "Mover Arriba";
                        // Rule: Cannot move Main (0) Up (obviously).
                        // Rule: Cannot move Second (1) Up into Main.
                        const canMoveUp = idx > 1;

                        btnUp.disabled = !canMoveUp;
                        btnUp.style.opacity = canMoveUp ? '1' : '0.2';
                        btnUp.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (canMoveUp) {
                                const item = draft.gallery.splice(idx, 1)[0];
                                draft.gallery.splice(idx - 1, 0, item);
                                renderGallery();
                            }
                        };

                        const btnDown = document.createElement('button');
                        btnDown.type = 'button'; // Prevent form submission
                        btnDown.className = 'btn btn-ghost btn-xs';
                        btnDown.innerHTML = '▼';
                        btnDown.title = "Mover Abajo";

                        // Rule: Cannot move Main (0) Down.
                        // Rule: Cannot move Last item Down.
                        const canMoveDown = idx > 0 && idx < draft.gallery.length - 1;

                        btnDown.disabled = !canMoveDown;
                        btnDown.style.opacity = canMoveDown ? '1' : '0.2';
                        btnDown.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (canMoveDown) {
                                const item = draft.gallery.splice(idx, 1)[0];
                                draft.gallery.splice(idx + 1, 0, item);
                                renderGallery();
                            }
                        };

                        sortCol.appendChild(btnUp);
                        sortCol.appendChild(btnDown);

                        // 1. Preview
                        const preview = document.createElement('div');
                        preview.style.width = '80px';
                        preview.style.height = '80px';
                        preview.style.background = '#000';
                        preview.style.borderRadius = '4px';
                        preview.style.overflow = 'hidden';
                        preview.style.display = 'flex';
                        preview.style.alignItems = 'center';
                        preview.style.justifyContent = 'center';
                        preview.style.flexShrink = '0'; // Prevent shrinking

                        if (imgData.url) {
                            preview.innerHTML = `<img src="${imgData.url}" style="width:100%; height:100%; object-fit:contain;">`;
                        } else {
                            preview.innerHTML = '<span style="font-size:1.5rem; opacity:0.3;">📷</span>';
                        }

                        // 2. Details (Label + Actions)
                        const details = document.createElement('div');
                        details.style.flex = '1';
                        details.style.display = 'flex';
                        details.style.flexDirection = 'column';
                        details.style.gap = '0.5rem';

                        // Label Input
                        const labelInput = document.createElement('input');
                        labelInput.type = 'text';
                        labelInput.value = imgData.label;
                        labelInput.placeholder = 'Nombre de la imagen (ej: Portada)';
                        labelInput.style.padding = '0.25rem 0.5rem';
                        labelInput.style.background = 'transparent';
                        labelInput.style.border = '1px solid transparent'; // Invisible border normally
                        labelInput.style.borderBottom = '1px solid var(--text-secondary)';
                        labelInput.style.color = 'var(--text-main)';
                        labelInput.style.fontWeight = 'bold';

                        labelInput.onfocus = () => labelInput.style.border = '1px solid var(--primary)';
                        labelInput.onblur = () => labelInput.style.border = '1px solid transparent';
                        labelInput.oninput = (e) => imgData.label = e.target.value;

                        // Actions Row
                        const actions = document.createElement('div');
                        actions.style.display = 'flex';
                        actions.style.gap = '0.5rem';

                        const btnSearch = document.createElement('button');
                        btnSearch.className = 'btn btn-ghost btn-xs';
                        btnSearch.innerHTML = '🔍 Buscar ver';

                        const btnUpload = document.createElement('button');
                        btnUpload.className = 'btn btn-ghost btn-xs';
                        btnUpload.innerHTML = '📂 Subir';

                        const btnDelete = document.createElement('button');
                        btnDelete.className = 'btn btn-ghost btn-xs';
                        btnDelete.style.color = 'var(--accent, #ff4444)';
                        btnDelete.style.marginLeft = 'auto'; // Push to right
                        btnDelete.innerHTML = '🗑️';

                        // --- Handlers ---

                        // Make Main (Star) - Only if not already first
                        if (idx > 0) {
                            const btnMain = document.createElement('button');
                            btnMain.className = 'btn btn-ghost btn-xs';
                            btnMain.style.color = 'gold';
                            btnMain.title = "Hacer Principal (Portada)";
                            btnMain.innerHTML = '⭐';

                            btnMain.onclick = () => {
                                // Swap [0] and [idx]
                                const temp = draft.gallery[0];
                                draft.gallery[0] = draft.gallery[idx];
                                draft.gallery[idx] = temp;
                                renderGallery();
                            };
                            actions.appendChild(btnMain);
                        } else {
                            // Indicator for Main
                            const badge = document.createElement('span');
                            badge.style.fontSize = '0.75rem';
                            badge.style.color = 'gold';
                            badge.style.fontWeight = 'bold';
                            badge.innerText = '★ PRINCIPAL';
                            actions.appendChild(badge);
                        }

                        // Sort buttons moved to left column

                        // Search
                        btnSearch.onclick = () => {
                            // Find relevant keywords from item data based on configuration
                            let searchTerms = [];

                            if (type.fields) {
                                type.fields.forEach(usage => {
                                    // Resolve definition
                                    let def = (store.data.fieldDefinitions || []).find(d => d.id === usage.fieldId);

                                    // Check if this field should be used for search
                                    // Priority: Usage override > Definition default
                                    const isSearchable = usage.useForImageSearch || (def && def.defaultSearchable);

                                    if (isSearchable) {
                                        const key = def ? def.key : (usage.key || usage.label); // Legacy fallback
                                        const val = draft.data[key];
                                        if (val && String(val).trim()) {
                                            searchTerms.push(String(val).trim());
                                        }
                                    }
                                });
                            }

                            // Fallback if no specific search fields are configured or populated
                            if (searchTerms.length === 0) {
                                let mainName = '';
                                if (type.fields) {
                                    // Try to find a 'Name' or 'Title' field (Smart Fallback)
                                    const titleField = type.fields.find(f => {
                                        const label = f.label || '';
                                        return f.mandatory || label.includes('Nombre') || label.includes('Título') || label.includes('Title');
                                    });

                                    if (titleField) {
                                        let def = (store.data.fieldDefinitions || []).find(d => d.id === titleField.fieldId);
                                        const key = def ? def.key : (titleField.key || titleField.label);
                                        mainName = draft.data[key] || '';
                                    }
                                }
                                if (!mainName) mainName = Object.values(draft.data)[0] || ''; // Ultimate fallback
                                if (mainName) searchTerms.push(mainName);
                            }

                            const query = `${searchTerms.join(' ')} ${imgData.label}`;

                            ImageSelector.show({
                                initialQuery: query,
                                onSearch: async (q) => await ImageManager.search(q),
                                onSelect: async (url) => {
                                    // 1. Show temporary specific placeholder/loading
                                    imgData.url = url; // Show remote first for instant feedback
                                    renderGallery();

                                    // 2. Download in background
                                    try {
                                        const localPath = await window.api.invoke('download-image', url);
                                        if (localPath) {
                                            imgData.url = 'file:///' + localPath.replace(/\\/g, '/');
                                            console.log('Image cached locally:', imgData.url);
                                            renderGallery(); // Re-render with local path
                                        }
                                    } catch (e) {
                                        console.error('Failed to cache image locally:', e);
                                        // Keep remote URL as fallback
                                    }
                                }
                            });
                        };

                        // Upload
                        const fileInput = document.createElement('input');
                        fileInput.type = 'file';
                        fileInput.accept = 'image/*';
                        fileInput.style.display = 'none';
                        fileInput.onchange = (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                                imgData.url = evt.target.result;
                                renderGallery();
                            };
                            reader.readAsDataURL(file);
                        };
                        btnUpload.onclick = () => fileInput.click();

                        fileInput.onchange = async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;

                            // WEB MODE FALLBACK
                            if (!window.api) {
                                const reader = new FileReader();
                                reader.onload = (evt) => {
                                    imgData.url = evt.target.result; // Use Base64 directly
                                    console.log('Web Upload: Using Base64 Data URL');
                                    renderGallery();
                                };
                                reader.readAsDataURL(file);
                                return;
                            }

                            // ELECTRON MODE
                            try {
                                const buffer = await file.arrayBuffer();
                                const uint8Array = new Uint8Array(buffer);

                                // Send to Main Process
                                const savedPath = await window.api.invoke('save-image', {
                                    buffer: uint8Array,
                                    name: file.name
                                });

                                imgData.url = savedPath; // Storing the path received
                                renderGallery();

                            } catch (err) {
                                console.error(err);
                                alert('Error al guardar imagen: ' + err.message);
                            }
                        };

                        // Delete
                        btnDelete.onclick = () => {
                            Modal.confirm({
                                title: 'Borrar Imagen',
                                message: '¿Borrar esta imagen de la lista?',
                                isDanger: true,
                                confirmLabel: 'Borrar',
                                onConfirm: () => {
                                    draft.gallery.splice(idx, 1);
                                    renderGallery();
                                }
                            });
                        };

                        actions.appendChild(btnSearch);
                        actions.appendChild(btnUpload);
                        actions.appendChild(btnDelete);

                        details.appendChild(labelInput);
                        details.appendChild(actions);

                        row.appendChild(sortCol);
                        row.appendChild(preview);
                        row.appendChild(details);
                        row.appendChild(fileInput); // Hidden

                        list.appendChild(row);
                    });

                    contentMedia.appendChild(list);
                };

                // Initial Render
                renderGallery();

                container.appendChild(contentMedia);
            },
            onSave: async () => {
                await store.saveItem(draft);
                return true;
            }
        });
    },

    deleteItem(itemId) {
        Modal.confirm({
            title: 'Borrar Artículo',
            message: '¿Seguro que quieres borrar este artículo?',
            isDanger: true,
            confirmLabel: 'Borrar',
            onConfirm: () => store.deleteItem(itemId)
        });
    },

    viewItem(item) {
        const type = store.data.itemTypes.find(t => t.id === item.typeId);
        if (!type) return;
        this.openViewer(item, type);
    },

    duplicateItem(sourceItem) {
        const type = store.data.itemTypes.find(t => t.id === sourceItem.typeId);
        if (!type) return;

        // Use custom modal instead of prompt
        Modal.show({
            title: 'Duplicar Artículo',
            saveLabel: 'Duplicar',
            renderContent: (container) => {
                container.innerHTML = `
                    <div style="margin-bottom:1rem;">
                        <label style="display:block; margin-bottom:0.5rem; color:var(--text-secondary);">¿Cuántas copias quieres crear?</label>
                        <input type="number" id="dup-count" value="1" min="1" max="100" style="width:100%; padding:0.5rem; background:var(--bg-main); border:1px solid var(--border); color:white; font-size:1.1rem;">
                    </div>
                `;
            },
            onSave: async () => {
                const input = document.querySelector('#dup-count');
                const val = input ? parseInt(input.value) : 1;

                if (isNaN(val) || val <= 0) {
                    alert('Número inválido');
                    return false; // Keep open
                }

                return await this._performDuplicate(sourceItem, val);
            }
        });
    },

    async _performDuplicate(sourceItem, count) {
        const process = async () => {
            try {
                for (let i = 0; i < count; i++) {
                    const draft = {
                        id: 'item_' + Date.now() + '_' + i,
                        typeId: sourceItem.typeId,
                        sectionId: sourceItem.sectionId,
                        createdAt: new Date().toISOString(),
                        data: { ...sourceItem.data }, // Shallow copy
                        images: { ...sourceItem.images }
                    };

                    const suffix = count > 1 ? ` (Copia ${i + 1})` : ' (Copia)';
                    if (draft.data.nombre) draft.data.nombre += suffix;
                    else if (draft.data.name) draft.data.name += suffix;

                    await store.saveItem(draft);
                }
                store.notify(); // Force UI update
                // Optional: Alert success via toast or custom, avoid native alert
                console.log(`${count} artículos duplicados.`);
            } catch (e) {
                console.error(e);
                alert('Error al duplicar: ' + e.message);
            }
        };

        if (count > 10) {
            Modal.confirm({
                title: 'Confirmar Duplicación Masiva',
                message: `Vas a crear ${count} copias. ¿Estás seguro?`,
                onConfirm: async () => {
                    await process();
                }
            });
            return true; // Return true to close the quantity modal immediately
        }

        await process();
        return true;
    },

    openViewer(item, type) {
        // Robust Name Resolution (Same as app.js)
        let rawName = item.data.name || item.data.nombre || item.data.Name || item.data.Nombre || item.data.title || item.data.Title || item.data.Titulo;

        if (!rawName && type && type.fields) {
            const titleCandidate = type.fields.find(f => {
                if (f.label && /nombre|nombres|name|title|título|titulo|juego|game/i.test(f.label)) return true;
                const def = (store.data.fieldDefinitions || []).find(d => d.id === f.fieldId);
                if (def && /nombre|nombres|name|title|título|titulo|juego|game/i.test(def.label)) return true;
                return false;
            });

            if (titleCandidate) {
                const def = (store.data.fieldDefinitions || []).find(d => d.id === titleCandidate.fieldId);
                const key1 = titleCandidate.key;
                const key2 = def ? def.key : null;
                if (key1 && item.data[key1]) rawName = item.data[key1];
                else if (key2 && item.data[key2]) rawName = item.data[key2];
            }
        }

        const displayName = rawName || 'Sin Nombre';

        Modal.show({
            title: displayName,
            saveLabel: 'Cerrar',
            showCancel: false, // Hide Cancel button
            renderContent: (container) => {
                // Read-Only Layout
                container.innerHTML = `
                    <div style="display:flex; gap:2rem;">
                        <!-- Left: Images -->
                        <div style="width: 300px; display:flex; flex-direction:column; gap:1rem;">
                            ${this.renderReadOnlyImages(item)}
                        </div>

                        <!-- Right: Data -->
                        <div style="flex:1;">
                            <h2 style="margin-top:0; border-bottom:1px solid var(--border); padding-bottom:0.5rem; margin-bottom:1rem; color:var(--text-primary);">
                                ${displayName}
                            </h2>
                            <div style="display:grid; grid-template-columns: auto 1fr; gap: 0.5rem 1rem; align-items:baseline;">
                                ${type.fields.map(usage => {
                    // Resolve definition
                    let def = (store.data.fieldDefinitions || []).find(d => d.id === usage.fieldId);

                    // Fallbacks
                    const label = def ? def.label : (usage.label || 'Unknown');
                    const key = def ? def.key : (usage.key || usage.label);

                    // Value
                    let val = item.data[key];
                    if (val === undefined || val === null || val === '') val = '-';

                    // Formatting
                    if (def && def.type === 'boolean') {
                        if (val !== '-') {
                            val = val ? (def.booleanConfig?.trueLabel || 'Si') : (def.booleanConfig?.falseLabel || 'No');
                        }
                    }

                    return `
                                    <div style="color:var(--text-secondary); font-weight:bold; text-align:right; text-transform:uppercase; font-size:0.8rem;">${label}:</div>
                                    <div style="font-size:1rem; color:var(--text-primary);">${val}</div>
                                `;
                }).join('')}
                            </div>
                        </div>
                    </div>
                `;
            },
            onSave: () => {
                // Just close
                return true;
            }
        });
    },

    openImagePreview(url) {
        Modal.show({
            title: 'Vista Previa',
            saveLabel: 'Cerrar',
            showCancel: false,
            renderContent: (container) => {
                container.style.display = 'flex';
                container.style.justifyContent = 'center';
                container.style.alignItems = 'center';
                container.style.background = '#000';
                container.innerHTML = `
                    <img src="${url}" 
                        style="max-width:100%; max-height:80vh; object-fit:contain; box-shadow:0 0 20px rgba(0,0,0,0.5);"
                        onerror="this.style.display='none'; this.parentElement.innerHTML = '<div style=\'color:#bfbfbf; display:flex; flex-direction:column; align-items:center; gap:1rem;\'><span style=\'font-size:3rem;\'>⚠️</span><span>No se pudo cargar la imagen</span><span style=\'font-size:0.8rem; color:#666;\'>${url.split('/').pop()}</span></div>'">
                `;
            },
            onSave: () => true
        });
    },

    renderReadOnlyImages(item) {
        let images = [];

        // 1. Dynamic Gallery (New Standard)
        if (item.gallery && Array.isArray(item.gallery)) {
            images = item.gallery.map(img => ({ label: img.label, url: img.url }));
        }
        // 2. Legacy Fallback
        else if (item.images) {
            if (item.images.front) images.push({ label: 'Portada', url: item.images.front });
            if (item.images.back) images.push({ label: 'Contraportada', url: item.images.back });
            if (item.images.disc) images.push({ label: 'Disco', url: item.images.disc });
            if (item.images.box) images.push({ label: 'Caja', url: item.images.box });
            // Filter out empty URLs
            images = images.filter(i => i.url && i.url.length > 5);
        }

        if (images.length === 0) return '<div style="background:var(--bg-main); height:200px; display:flex; align-items:center; justify-content:center; border-radius:8px; color:var(--text-secondary);">Sin Imágenes</div>';

        // Render Grid
        return `
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:0.5rem;">
                ${images.map(img => `
                    <div style="background:#000; border-radius:8px; overflow:hidden; border:1px solid var(--border); position:relative; aspect-ratio:1; cursor:pointer;" onclick="ItemManager.openImagePreview('${img.url.replace(/'/g, "\\'")}')">
                        <img src="${img.url}" style="width:100%; height:100%; object-fit:contain; display:block;" 
                            onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2NjYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSIvPjwvc3ZnPg=='; this.style.padding='2rem'; this.style.opacity='0.5';">
                        <div style="
                            position:absolute; bottom:0; left:0; right:0; 
                            background:rgba(0,0,0,0.7); color:white; 
                            font-size:0.75rem; padding:0.25rem; text-align:center;
                            white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                        ">
                            ${img.label}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    handleBarcodeAction(draft) {
        Modal.show({
            title: 'Escáner Mágico (Beta)',
            saveLabel: 'Cerrar',
            renderContent: (c) => {
                c.innerHTML = `
                    <div style="text-align:center; padding:1rem; display:flex; flex-direction:column; gap:1.5rem;">
                        
                        <div style="display:flex; justify-content:flex-end; padding-right:1rem;">
                            <button id="btn-settings" class="btn btn-ghost btn-sm" title="Configurar IA (API Keys)">⚙️ Configurar IA</button>
                        </div>
                        
                        <!-- 1. Image Upload Zone -->
                        <div style="background:rgba(255,255,255,0.05); padding:2rem; border-radius:12px; border:2px dashed var(--border); transition:all 0.3s;"
                             onmouseover="this.style.borderColor='var(--accent-primary)'; this.style.background='rgba(255,255,255,0.1)'"
                             onmouseout="this.style.borderColor='var(--border)'; this.style.background='rgba(255,255,255,0.05)'">
                            
                            <div style="font-size:3rem; margin-bottom:1rem;">📸</div>
                            <h3 style="margin-bottom:0.5rem;">Sube una foto del código de barras</h3>
                            <p style="color:var(--text-secondary); font-size:0.9rem; margin-bottom:1.5rem;">
                                La Inteligencia Artificial leerá el código y buscará los datos en internet.
                            </p>
                            
                            <button id="btn-upload-scan" class="btn btn-primary" style="padding:0.75rem 2rem; font-size:1.1rem;">
                                📂 Seleccionar Imagen
                            </button>
                            <input type="file" id="file-scan" accept="image/*" style="display:none;">
                        </div>

                        <!-- 2. Manual Fallback -->
                        <div style="border-top:1px solid var(--border); padding-top:1.5rem;">
                            <p style="margin-bottom:0.5rem; font-size:0.9rem; color:var(--text-secondary);">O escribe el código manualmente:</p>
                            <div style="display:flex; gap:0.5rem; justify-content:center;">
                                <input type="text" id="manual-code" placeholder="Ej: 711719..." 
                                    style="width:200px; text-align:center; padding:0.5rem; border-radius:6px; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:white;">
                                <button id="btn-manual-search" class="btn btn-ghost">🔍</button>
                            </div>
                        </div>

                        <!-- Status Log -->
                        <div id="scan-status" style="min-height:2rem; font-weight:bold; color:var(--accent-secondary);"></div>
                    </div>
                `;

                const btnUpload = c.querySelector('#btn-upload-scan');
                const fileInput = c.querySelector('#file-scan');
                const status = c.querySelector('#scan-status');
                const manualInput = c.querySelector('#manual-code');
                const btnManual = c.querySelector('#btn-manual-search');
                const btnSettings = c.querySelector('#btn-settings');

                btnUpload.onclick = () => fileInput.click();
                if (btnSettings) btnSettings.onclick = () => SettingsManager.openSettings();

                const processCode = async (code) => {
                    status.innerHTML = `🔍 Buscando datos para: ${code}...`;

                    try {
                        const data = await window.api.invoke('lookup-barcode', code);

                        if (data) {
                            status.innerHTML = `<span style="color:#4ade80;">¡Encontrado!</span> ${data.title}`;

                            // ===== INTELLIGENT DATA MAPPER =====

                            // 1. TITLE CLEANUP & EXTRACTION
                            let cleanTitle = data.title || '';
                            let detectedPlatform = null;
                            let detectedRegion = null;

                            // Extract platform from title (common patterns)
                            const platformPatterns = {
                                'PS5': /\b(ps5|playstation\s*5)\b/i,
                                'PS4': /\b(ps4|playstation\s*4)\b/i,
                                'PS3': /\b(ps3|playstation\s*3)\b/i,
                                'PS2': /\b(ps2|playstation\s*2)\b/i,
                                'PS1': /\b(ps1|psx|playstation\s*1)\b/i,
                                'XBOX SERIES X': /\b(xbox\s*series\s*x|xsx)\b/i,
                                'XBOX SERIES S': /\b(xbox\s*series\s*s|xss)\b/i,
                                'XBOX ONE': /\b(xbox\s*one|xone)\b/i,
                                'XBOX 360': /\b(xbox\s*360)\b/i,
                                'XBOX': /\b(xbox)\b/i,
                                'NINTENDO SWITCH': /\b(switch|nintendo\s*switch)\b/i,
                                'NINTENDO 3DS': /\b(3ds|nintendo\s*3ds)\b/i,
                                'NINTENDO WII U': /\b(wii\s*u)\b/i,
                                'NINTENDO WII': /\b(wii)\b/i,
                                'PC': /\b(pc|windows)\b/i
                            };

                            for (const [platform, pattern] of Object.entries(platformPatterns)) {
                                if (pattern.test(cleanTitle)) {
                                    detectedPlatform = platform;
                                    // Remove platform from title
                                    cleanTitle = cleanTitle.replace(pattern, '').trim();
                                    break;
                                }
                            }

                            // Extract region codes
                            const regionPatterns = {
                                'España': /\(sp\)/i,
                                'Europa': /\(eu\)/i,
                                'USA': /\(us\)/i,
                                'Japón': /\(jp\)/i
                            };

                            for (const [region, pattern] of Object.entries(regionPatterns)) {
                                if (pattern.test(cleanTitle)) {
                                    detectedRegion = region;
                                    cleanTitle = cleanTitle.replace(pattern, '').trim();
                                    break;
                                }
                            }

                            // Remove common suffixes
                            cleanTitle = cleanTitle
                                .replace(/\s*-\s*complete\s+edition/i, ' - Complete Edition')
                                .replace(/\s*-\s*goty/i, ' - GOTY')
                                .replace(/\s*-\s*definitive\s+edition/i, ' - Definitive Edition')
                                .replace(/\s+/g, ' ')
                                .trim();

                            // 2. PLATFORM DETECTION (fallback to category)
                            if (!detectedPlatform && data.category) {
                                const cat = data.category.toLowerCase();
                                if (cat.includes('playstation 5') || cat.includes('ps5')) detectedPlatform = 'PS5';
                                else if (cat.includes('playstation 4') || cat.includes('ps4')) detectedPlatform = 'PS4';
                                else if (cat.includes('playstation 3') || cat.includes('ps3')) detectedPlatform = 'PS3';
                                else if (cat.includes('xbox series x')) detectedPlatform = 'XBOX SERIES X';
                                else if (cat.includes('xbox series s')) detectedPlatform = 'XBOX SERIES S';
                                else if (cat.includes('xbox one')) detectedPlatform = 'XBOX ONE';
                                else if (cat.includes('xbox 360')) detectedPlatform = 'XBOX 360';
                                else if (cat.includes('xbox')) detectedPlatform = 'XBOX';
                                else if (cat.includes('switch')) detectedPlatform = 'NINTENDO SWITCH';
                                else if (cat.includes('3ds')) detectedPlatform = 'NINTENDO 3DS';
                                else if (cat.includes('pc') || cat.includes('windows')) detectedPlatform = 'PC';
                            }

                            // 3. MAP TO DATABASE FIELDS
                            // Get the type definition to know which fields exist
                            const type = store.data.itemTypes.find(t => t.id === draft.typeId);

                            if (type) {
                                type.fields.forEach(fieldUsage => {
                                    const fieldDef = store.data.fieldDefinitions.find(f => f.id === fieldUsage.fieldId);
                                    if (!fieldDef) return;

                                    const fieldKey = fieldDef.key;
                                    // Normalize: lowercase + remove accents (NFD)
                                    const fieldLabel = fieldDef.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                                    // Smart mapping based on field name/label
                                    if (fieldLabel.includes('nombre') || fieldLabel.includes('titulo') || fieldLabel.includes('title')) {
                                        draft.data[fieldKey] = cleanTitle;
                                    }
                                    else if (fieldLabel.includes('plataforma') || fieldLabel.includes('platform') || fieldLabel.includes('consola')) {
                                        if (detectedPlatform) draft.data[fieldKey] = detectedPlatform;
                                    }
                                    else if (fieldLabel.includes('region')) { // región -> region
                                        if (detectedRegion) draft.data[fieldKey] = detectedRegion;
                                    }
                                    else if (fieldLabel.includes('marca') || fieldLabel.includes('brand') || fieldLabel.includes('fabricante')) {
                                        if (data.brand) draft.data[fieldKey] = data.brand;
                                    }
                                    else if (fieldLabel.includes('precio') || fieldLabel.includes('price')) {
                                        if (data.lowest_recorded_price) {
                                            draft.data[fieldKey] = `$${data.lowest_recorded_price}`;
                                        }
                                    }
                                    else if (fieldLabel.includes('descripcion') || fieldLabel.includes('description')) { // descripción -> descripcion
                                        if (data.description) draft.data[fieldKey] = data.description;
                                    }
                                    else if (fieldLabel.includes('codigo') || fieldLabel.includes('barcode') || fieldLabel.includes('upc') || fieldLabel.includes('ean')) {
                                        draft.data[fieldKey] = code;
                                    }
                                });
                            }

                            // Fallback for common field names (if no type fields matched)
                            if (!draft.data.nombre && !draft.data.name) {
                                draft.data.nombre = cleanTitle;
                                draft.data.name = cleanTitle;
                            }
                            if (!draft.data.plataforma && detectedPlatform) {
                                draft.data.plataforma = detectedPlatform;
                            }

                            // 4. WIKIPEDIA ENRICHMENT
                            status.innerHTML = `<span style="color:#4ade80;">¡Encontrado!</span> Buscando datos adicionales...`;
                            console.log('Initiating Wikipedia lookup for:', cleanTitle);

                            try {
                                const wikiData = await window.api.invoke('lookup-wikipedia', cleanTitle);
                                console.log('Wikipedia result:', wikiData);

                                if (wikiData) {
                                    // Map Wikipedia data to fields
                                    if (type) {
                                        type.fields.forEach((fieldUsage, index) => {
                                            // Handle both reference (fieldId) and embedded definition
                                            let fieldDef = fieldUsage;
                                            if (fieldUsage.fieldId) {
                                                fieldDef = store.data.fieldDefinitions.find(f => f.id === fieldUsage.fieldId);
                                            }

                                            if (!fieldDef || !fieldDef.key) {
                                                return;
                                            }

                                            const fieldKey = fieldDef.key;
                                            // Normalize to handle encoding issues
                                            const fieldLabel = fieldDef.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                                            const currentValue = draft.data[fieldKey];

                                            // Only fill if field is truly empty
                                            const isEmpty = !currentValue || currentValue.toString().trim() === '';

                                            if (isEmpty) {
                                                // DESARROLLADOR
                                                if (fieldLabel.includes('desarrollador') || fieldLabel.includes('developer') || fieldLabel.includes('estudio')) {
                                                    if (wikiData.developer) {
                                                        draft.data[fieldKey] = wikiData.developer;
                                                    }
                                                }
                                                // AÑO (año without tilde = ano)
                                                else if (fieldLabel.includes('ano') || fieldLabel.includes('year') || fieldLabel.includes('fecha')) {
                                                    if (wikiData.year) {
                                                        draft.data[fieldKey] = wikiData.year;
                                                    }
                                                }
                                                // GÉNERO (género without tilde = genero)
                                                else if (fieldLabel.includes('genero') || fieldLabel.includes('genre') || fieldLabel.includes('categoria')) {
                                                    if (wikiData.genre) {
                                                        draft.data[fieldKey] = wikiData.genre;
                                                    }
                                                }
                                                // JUGADORES
                                                else if (fieldLabel.includes('jugador') || fieldLabel.includes('player') || fieldLabel.includes('modo')) {
                                                    if (wikiData.players) {
                                                        draft.data[fieldKey] = wikiData.players;
                                                    }
                                                }
                                                // DESCRIPCIÓN (descripción without tilde = descripcion)
                                                else if (fieldLabel.includes('descripcion') || fieldLabel.includes('description') || fieldLabel.includes('sinopsis')) {
                                                    if (wikiData.description) {
                                                        draft.data[fieldKey] = wikiData.description;
                                                    }
                                                }
                                            }
                                        });
                                    }
                                }
                            } catch (wikiError) {
                                console.warn('Wikipedia lookup failed:', wikiError);
                            }

                            // 5. AUTOMATIC COVER IMAGE SEARCH
                            status.innerHTML = `<span style="color:#4ade80;">¡Encontrado!</span> Buscando portada...`;

                            try {
                                // Build search query: "game title platform cover"
                                const searchQuery = `${cleanTitle} ${detectedPlatform || ''} cover art`.trim();
                                const images = await ImageManager.search(searchQuery);

                                if (images && images.length > 0) {
                                    // Take the first image as cover
                                    const coverUrl = images[0].url;

                                    // Initialize gallery array if needed
                                    if (!draft.gallery) draft.gallery = [];

                                    // Add as primary image (index 0)
                                    draft.gallery.unshift({
                                        id: 'img_' + Date.now(),
                                        label: 'Portada',
                                        url: coverUrl
                                    });

                                    status.innerHTML = `<span style="color:#4ade80;">✓ Datos y portada cargados</span>`;
                                } else {
                                    status.innerHTML = `<span style="color:#4ade80;">✓ Datos cargados</span> <span style="color:#f59e0b;">(sin portada)</span>`;
                                }
                            } catch (imgError) {
                                console.warn('Image search failed:', imgError);
                                status.innerHTML = `<span style="color:#4ade80;">✓ Datos cargados</span> <span style="color:#f59e0b;">(sin portada)</span>`;
                            }

                            // 6. UPDATE EDITOR FIELDS AND CLOSE SCANNER
                            setTimeout(() => {
                                // Close scanner modal
                                const scannerModal = document.querySelector('.modal-overlay:last-child');
                                if (scannerModal) scannerModal.remove();

                                // Update all input fields in the editor
                                const editorModal = document.querySelector('.modal-overlay');
                                if (editorModal) {
                                    Object.keys(draft.data).forEach(key => {
                                        const input = editorModal.querySelector(`[name="${key}"]`);
                                        if (input && draft.data[key] !== undefined && draft.data[key] !== null) { // Check for undefined/null
                                            // Handle different input types
                                            if (input.tagName === 'SELECT') {
                                                // Find and select the option
                                                const option = input.querySelector(`option[value="${draft.data[key]}"]`);
                                                if (option) {
                                                    input.value = draft.data[key];
                                                    input.dispatchEvent(new Event('change', { bubbles: true })); // Trigger change for selects
                                                }
                                            } else if (input.type === 'checkbox' || input.type === 'radio') {
                                                // Not directly handled by single named input, usually a group
                                                // For now, scanner only updates single-value fields.
                                            } else {
                                                input.value = draft.data[key];
                                                input.dispatchEvent(new Event('input', { bubbles: true })); // Trigger input for text/number/date/url/textarea
                                            }
                                        }
                                    });
                                    // Re-render gallery if it's open
                                    if (editorModal.querySelector('#tab-media.active')) { // Check if media tab is active
                                        renderGallery();
                                    }
                                }
                            }, 1500);

                        } else {
                            status.innerHTML = `<span style="color:#f87171;">No encontrado en Internet.</span>`;
                        }
                    } catch (e) {
                        status.innerHTML = `<span style="color:#f87171;">Error de red.</span>`;
                    }
                };

                fileInput.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    status.innerHTML = '🧠 Analizando imagen...';

                    // Send path to Main Process
                    // Note: 'file.path' is available in Electron Renderer if webSecurity is managed?
                    // Actually, modern Electron might hide 'path' from File object in Renderer for security.
                    // But we set `nodeIntegration: false, contextIsolation: true`.
                    // IPC allow passing buffer.

                    try {
                        const buffer = await file.arrayBuffer();
                        // We need to create a temporary file path for the library in Main?
                        // Or we save it using our 'save-image' handler (reuses logic) and then scan that path.

                        // 1. Save Temp
                        const savedPath = await window.api.invoke('save-image', {
                            buffer: new Uint8Array(buffer),
                            name: 'scan_temp_' + file.name
                        });

                        // 2. Decode
                        const code = await window.api.invoke('decode-barcode', savedPath);

                        if (code) {
                            processCode(code);
                        } else {
                            status.innerHTML = `<span style="color:#f87171;">No detecté ningún código.</span> Intenta acercarte más.`;
                        }

                    } catch (err) {
                        console.error(err);
                        status.innerHTML = 'Error al procesar imagen.';
                    }
                };

                btnManual.onclick = () => {
                    const c = manualInput.value.trim();
                    if (c) processCode(c);
                };
            },
            onSave: () => true
        });
    }
};

