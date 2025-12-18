import { store } from '../state.js';
import { Modal } from '../ui/Modal.js';
import { FieldRegistryManager } from './FieldRegistryManager.js';
import { IconPicker } from '../ui/IconPicker.js';

export const TypeManager = {
    create(sectionId) {
        // Find default fields
        const section = store.data.sections.find(s => s.id === sectionId);
        const colId = section ? section.collectionId : null;

        const defaultFields = (store.data.fieldDefinitions || [])
            .filter(f => {
                if (!f.defaultInNewTypes) return false;
                // Scope Check:
                // 1. If field is Global (no collectionId), include it (Legacy behavior).
                // 2. If field is Scoped, strict match.
                if (f.collectionId && f.collectionId !== colId) return false;
                return true;
            })
            .map(f => ({
                fieldId: f.id,
                label: f.label,
                mandatory: f.defaultMandatory || false,
                showInList: f.defaultShowInList || false,
                isFilter: f.defaultFilterable || false,
                useForImageSearch: f.defaultSearchable || false
            }));

        this.openBuilder({
            id: 'type_' + Date.now(),
            sectionId,
            name: '',
            icon: '📦',
            fields: defaultFields
        });
    },

    edit(type) {
        // Deep copy fields to avoid mutation references
        this.openBuilder(JSON.parse(JSON.stringify(type)));
    },

    openBuilder(draft) {
        Modal.show({
            title: draft.id ? 'Editar Subcategoría' : 'Nueva Subcategoría',
            saveLabel: 'Guardar',
            showCancel: false,
            renderContent: (container) => {
                // Header: Icon + Name
                const topRow = document.createElement('div');
                topRow.style.display = 'flex';
                topRow.style.gap = '1rem';
                topRow.style.alignItems = 'flex-end';
                topRow.style.marginBottom = '1.5rem';

                // Icon Picker Button
                const iconBtn = document.createElement('button');
                iconBtn.className = 'btn';
                iconBtn.style.fontSize = '2rem';
                iconBtn.style.width = '60px';
                iconBtn.style.height = '60px';
                iconBtn.style.display = 'flex';
                iconBtn.style.alignItems = 'center';
                iconBtn.style.justifyContent = 'center';
                iconBtn.style.background = 'var(--bg-main)';
                iconBtn.style.border = '1px solid var(--border)';
                iconBtn.style.color = 'white';
                iconBtn.style.cursor = 'pointer';
                iconBtn.innerText = draft.icon || '📦';

                iconBtn.onclick = () => {
                    IconPicker.show({
                        onSelect: (icon) => {
                            draft.icon = icon;
                            iconBtn.innerText = icon;
                        }
                    });
                };

                // Name Input
                const nameGroup = document.createElement('div');
                nameGroup.style.flex = '1';
                nameGroup.innerHTML = '<label style="display:block; margin-bottom:0.5rem">Nombre (ej: Consola)</label>';
                const nameInput = document.createElement('input');
                nameInput.type = 'text';
                nameInput.value = draft.name;
                nameInput.style.width = '100%';
                nameInput.style.padding = '0.5rem';
                nameInput.style.fontSize = '1.1rem';
                nameInput.style.background = 'var(--bg-main)';
                nameInput.style.border = '1px solid var(--border)';
                nameInput.style.color = 'white';
                nameInput.style.borderRadius = '4px';
                nameInput.oninput = (e) => draft.name = e.target.value;
                nameGroup.appendChild(nameInput);

                topRow.appendChild(iconBtn);
                topRow.appendChild(nameGroup);
                container.appendChild(topRow);

                const bottomDiv = document.createElement('div');
                bottomDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4>Campos (Características)</h4>
                        <div style="display:flex; gap:0.5rem;">
                            <button class="btn btn-ghost" id="btn-create-field" style="font-size: 0.8rem;">+ Nuevo Campo</button>
                            <button class="btn btn-ghost" id="btn-add-field" style="font-size: 0.8rem;">🔗 Campos Comunes</button>
                        </div>
                    </div>

                    <div id="fields-list" style="display: flex; flex-direction: column; gap: 0.5rem; border: 1px solid var(--border); padding: 0.5rem; border-radius: 8px; min-height: 150px; background: var(--bg-main);"></div>
                    
                    <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border);">
                        <h4>Gestión Avanzada</h4>
                        <div style="display:flex; gap:0.5rem; align-items:center; background:var(--bg-main); padding:0.5rem; border-radius:8px;">
                            <select id="target-section" style="flex:1; padding:0.5rem; background:var(--bg-card); color:white; border:1px solid var(--border); border-radius:4px;">
                                <!-- Options -->
                            </select>
                            <button id="btn-duplicate-type" class="btn btn-sm" style="background:#38a169; color:white;">Duplicar</button>
                            <button id="btn-move-type" class="btn btn-sm" style="background:#d69e2e; color:white;">Mover</button>
                            ${draft.id.includes('type_') && store.data.itemTypes.find(t => t.id === draft.id) ?
                        `<button id="btn-delete-type" class="btn btn-sm" style="background:#e53e3e; color:white;">Eliminar</button>`
                        : ''}
                        </div>
                        <p style="font-size:0.7rem; color:var(--text-secondary); margin-top:0.25rem;">
                            * <strong>Duplicar:</strong> Crea una copia en la sección destino.<br>
                            * <strong>Mover:</strong> Traslada este tipo a la sección destino.
                        </p>
                    </div>
                `;
                container.appendChild(bottomDiv);

                const fieldsList = container.querySelector('#fields-list');
                const targetSelect = container.querySelector('#target-section');

                // Populate Sections
                if (store.data.sections) {
                    store.data.sections.forEach(sec => {
                        const opt = document.createElement('option');
                        opt.value = sec.id;
                        opt.innerText = sec.name;
                        if (sec.id === draft.sectionId) opt.selected = true;
                        targetSelect.appendChild(opt);
                    });
                }

                // --- HANDLERS ---

                // DELETE HANDLER
                const btnDelete = container.querySelector('#btn-delete-type');
                if (btnDelete) {
                    btnDelete.onclick = async () => {
                        const relatedItems = store.data.items.filter(i => i.typeId === draft.id);
                        const count = relatedItems.length;

                        if (count === 0) {
                            if (confirm('¿Eliminar permanentemente esta subcategoría vacía?')) {
                                await store.deleteType(draft.id);
                                Modal.close();
                            }
                            return;
                        }

                        // WIZARD: Migrate or Delete
                        container.innerHTML = `
                            <div style="text-align:center;">
                                <h3 style="color:#e53e3e;">⚠ Atención</h3>
                                <p>Esta subcategoría contiene <strong>${count} artículos</strong>.</p>
                                <p>¿Qué deseas hacer con ellos?</p>

                                <div style="background:var(--bg-main); padding:1rem; border-radius:8px; text-align:left; margin:1rem 0;">
                                    <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; cursor:pointer;">
                                        <input type="radio" name="del-action" value="delete" checked>
                                        <span style="color:#e53e3e;">Eliminar todo permanentemente</span>
                                    </label>
                                    
                                    <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                                        <input type="radio" name="del-action" value="move">
                                        <span>Mover artículos a:</span>
                                    </label>
                                    
                                    <select id="migrate-target" style="width:100%; margin-top:0.5rem; padding:0.5rem; background:var(--bg-card); color:white; border:1px solid var(--border); border-radius:4px;" disabled>
                                        <option value="">Selecciona una subcategoría...</option>
                                    </select>
                                </div>

                                <div style="display:flex; justify-content:center; gap:1rem; margin-top:2rem;">
                                    <button id="btn-cancel-del" class="btn btn-ghost">Cancelar</button>
                                    <button id="btn-confirm-del" class="btn" style="background:#e53e3e; color:white;">Ejecutar Acción</button>
                                </div>
                            </div>
                        `;

                        // Populate Migration Select
                        const sel = container.querySelector('#migrate-target');
                        store.data.itemTypes.filter(t => t.id !== draft.id).forEach(t => {
                            const secName = store.data.sections.find(s => s.id === t.sectionId)?.name || 'Desconocido';
                            const opt = document.createElement('option');
                            opt.value = t.id;
                            opt.innerText = `[${secName}] ${t.name}`;
                            sel.appendChild(opt);
                        });

                        // UX: Enable/Disable Select
                        const radios = container.querySelectorAll('input[name="del-action"]');
                        radios.forEach(r => {
                            r.onchange = (e) => {
                                sel.disabled = e.target.value !== 'move';
                            };
                        });

                        // Action Logic
                        container.querySelector('#btn-cancel-del').onclick = () => Modal.close();
                        container.querySelector('#btn-confirm-del').onclick = async () => {
                            const action = container.querySelector('input[name="del-action"]:checked').value;

                            if (action === 'delete') {
                                if (confirm('¿ESTÁS SEGURO? Esta acción no se puede deshacer.')) {
                                    for (const item of relatedItems) {
                                        await store.deleteItem(item.id);
                                    }
                                    await store.deleteType(draft.id);
                                    Modal.close();
                                }
                            } else {
                                const targetId = sel.value;
                                if (!targetId) return alert('Debes seleccionar una subcategoría de destino.');

                                for (const item of relatedItems) {
                                    item.typeId = targetId;
                                    await store.saveItem(item);
                                }
                                await store.deleteType(draft.id);
                                alert(`Se movieron ${count} artículos y se eliminó la categoría original.`);
                                Modal.close();
                            }
                        };
                    };
                }

                // Handle Duplicate (Deep Copy)
                container.querySelector('#btn-duplicate-type').onclick = async () => {
                    const targetSecId = targetSelect.value;
                    const newName = targetSecId === draft.sectionId ? `${draft.name} (Copia)` : draft.name;

                    // Count items to be duplicated
                    const relatedItems = store.data.items.filter(i => i.typeId === draft.id);
                    const count = relatedItems.length;

                    if (!confirm(`¿Duplicar "${draft.name}" y sus ${count} artículos a la sección seleccionada?`)) return;

                    // 1. Duplicate Type Definition
                    const newType = {
                        ...draft,
                        id: 'type_' + Date.now(),
                        sectionId: targetSecId,
                        name: newName,
                        fields: JSON.parse(JSON.stringify(draft.fields))
                    };

                    await store.saveType(newType);

                    // 2. Duplicate Items
                    if (count > 0) {
                        const newItems = relatedItems.map((item, idx) => ({
                            ...item,
                            id: 'item_' + Date.now() + '_' + idx,
                            typeId: newType.id
                        }));

                        // Batch save (simulated)
                        for (const newItem of newItems) {
                            await store.saveItem(newItem);
                        }
                    }

                    alert(`Duplicado completado: Tipo + ${count} Artículos.`);
                    Modal.close();
                };

                // Handle Move
                container.querySelector('#btn-move-type').onclick = async () => {
                    const targetSecId = targetSelect.value;
                    if (targetSecId === draft.sectionId) return alert('El tipo ya está en esa sección.');

                    if (!confirm(`¿Mover "${draft.name}" a la nueva sección?`)) return;

                    // We update the EXISTING draft ID
                    const updatedType = {
                        ...draft,
                        sectionId: targetSecId
                    };

                    await store.saveType(updatedType);
                    Modal.close();
                };


                // RENDER FIELDS LOGIC
                const renderFields = () => {
                    fieldsList.innerHTML = '';
                    if (draft.fields.length === 0) {
                        fieldsList.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 1rem; font-size: 0.9rem;">No hay campos vinculados.</div>';
                        return;
                    }

                    draft.fields.forEach((usage, idx) => {
                        let def = (store.data.fieldDefinitions || []).find(f => f.id === usage.fieldId);
                        if (!def) def = { label: (usage.label || 'Desconocido') + ' (Legacy)', type: '?' };

                        const row = document.createElement('div');
                        row.style.display = 'flex';
                        row.style.alignItems = 'center';
                        row.style.gap = '0.5rem';
                        row.style.padding = '0.5rem';
                        row.style.background = 'var(--bg-card)';
                        row.style.border = '1px solid var(--border)';

                        row.innerHTML = `
                            <div style="display:flex; flex-direction:column; gap:2px;">
                                <button class="btn-ghost btn-xs move-up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}>▲</button>
                                <button class="btn-ghost btn-xs move-down" data-idx="${idx}" ${idx === draft.fields.length - 1 ? 'disabled' : ''}>▼</button>
                            </div>
                            <div style="flex:1;">
                                <div style="font-weight:bold;">${def.label}</div>
                                <div style="font-size:0.7rem; color:var(--text-secondary);">
                                    ${def.type.toUpperCase()} 
                                    ${usage.mandatory ? '<span style="color:red">Req</span>' : ''}
                                    ${usage.isFilter ? '<span style="color:#4ade80">Filtro</span>' : ''}
                                    ${usage.useForImageSearch ? 'Img' : ''}
                                    ${usage.showInList ? 'Lista' : ''}
                                </div>
                            </div>
                            <button class="btn-ghost btn-xs edit-usage" data-idx="${idx}">⚙ Config</button>
                            <button class="btn-ghost btn-xs delete-usage" data-idx="${idx}" style="color:var(--accent)">✕</button>
                        `;

                        // Bind Events
                        row.querySelector('.move-up').onclick = () => {
                            if (idx > 0) {
                                [draft.fields[idx], draft.fields[idx - 1]] = [draft.fields[idx - 1], draft.fields[idx]];
                                renderFields();
                            }
                        };
                        row.querySelector('.move-down').onclick = () => {
                            if (idx < draft.fields.length - 1) {
                                [draft.fields[idx], draft.fields[idx + 1]] = [draft.fields[idx + 1], draft.fields[idx]];
                                renderFields();
                            }
                        };
                        row.querySelector('.delete-usage').onclick = () => {
                            draft.fields.splice(idx, 1);
                            renderFields();
                        };
                        row.querySelector('.edit-usage').onclick = () => {
                            this.openUsageConfig(draft.fields[idx], draft, (u) => {
                                draft.fields[idx] = u;
                                renderFields();
                            });
                        };
                        fieldsList.appendChild(row);
                    });
                };

                // Add Existing (Link)
                const btnAdd = container.querySelector('#btn-add-field');
                if (btnAdd) {
                    btnAdd.onclick = () => {
                        const section = store.data.sections.find(s => s.id === draft.sectionId);
                        const colId = section ? section.collectionId : null;

                        FieldRegistryManager.pickField(colId, (selection) => {
                            // Handle both single item (legacy) and array (new multi-select)
                            const defs = Array.isArray(selection) ? selection : [selection];

                            let addedCount = 0;
                            defs.forEach(def => {
                                if (draft.fields.find(f => f.fieldId === def.id)) return; // Skip duplicate
                                draft.fields.push({
                                    fieldId: def.id,
                                    label: def.label,
                                    mandatory: def.defaultMandatory || false,
                                    showInList: def.defaultShowInList || false,
                                    isFilter: def.defaultFilterable || false,
                                    useForImageSearch: def.defaultSearchable || false
                                });
                                addedCount++;
                            });

                            if (addedCount > 0) renderFields();
                        });
                    };
                }

                // Create New (and autolink)
                const btnCreate = container.querySelector('#btn-create-field');
                if (btnCreate) {
                    btnCreate.onclick = () => {
                        const section = store.data.sections.find(s => s.id === draft.sectionId);
                        const colId = section ? section.collectionId : null;

                        FieldRegistryManager.createField(colId, (newDef) => {
                            if (!newDef) return;
                            draft.fields.push({
                                fieldId: newDef.id,
                                label: newDef.label,
                                mandatory: newDef.defaultMandatory || false,
                                showInList: newDef.defaultShowInList || false,
                                isFilter: newDef.defaultFilterable || false,
                                useForImageSearch: newDef.defaultSearchable || false
                            });
                            renderFields();
                        });
                    };
                }

                // Initial Render
                renderFields();
            },
            onSave: async () => {
                try {
                    if (!draft.name) return alert('El nombre es obligatorio');
                    await store.saveType(draft);
                    return true;
                } catch (err) {
                    console.error('Error saving type:', err);
                    alert('Error al guardar subcategoría: ' + err.message);
                    return false;
                }
            }
        });
    },

    openUsageConfig(usage, typeDraft, onSave) {
        // We need to look up the Field Definition
        let def = (store.data.fieldDefinitions || []).find(f => f.id === usage.fieldId);

        // Legacy Support: Create placeholder def if missing
        if (!def) {
            if (usage.label) {
                def = {
                    id: usage.fieldId || 'legacy_' + Date.now(),
                    label: usage.label + ' (Legacy)',
                    type: usage.type || 'text',
                    mock: true
                };
            } else {
                return alert('Error: Definición de campo no encontrada.');
            }
        }

        const draftUsage = JSON.parse(JSON.stringify(usage));

        Modal.show({
            title: `Configurar: ${def.label}`,
            saveLabel: 'Aplicar',
            renderContent: (container) => {
                // Dependency Selector Candidates: All OTHER fields in this Type that are Select/Boolean
                // We map them to their defs
                const potentialParents = typeDraft.fields
                    .filter(f => f.fieldId !== usage.fieldId)
                    .map(f => {
                        const d = store.data.fieldDefinitions.find(x => x.id === f.fieldId);
                        return d ? { id: f.fieldId, label: d.label, type: d.type, def: d } : null;
                    })
                    .filter(x => x && (x.type === 'select' || x.type === 'boolean' || x.type === 'checklist'));

                container.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:1rem;">
                        <div style="position: relative; z-index: 1;">
                            <label style="display:block; color:var(--text-secondary); margin-bottom:0.5rem; font-size:0.8rem; font-weight: 600;">Nombre del Campo (Global):</label>
                            <input type="text" id="config-field-label" value="${def.label}" style="width:100%; padding:0.6rem; background:var(--bg-card); border:1px solid var(--border); border-radius: 4px; color:white; font-weight:bold;">
                            <div style="font-size:0.75rem; color:var(--accent); margin-top:0.4rem; padding: 0.2rem 0;">⚠️ Cambiar esto afectará a todos los artículos.</div>
                        </div>

                        <div style="display:flex; flex-direction:column; gap:0.5rem;">
                            <label style="display:flex; align-items:center; gap:0.5rem;">
                                <input type="checkbox" id="chk-mandatory" ${draftUsage.mandatory ? 'checked' : ''}> Obligatorio
                            </label>
                            <label style="display:flex; align-items:center; gap:0.5rem;">
                                <input type="checkbox" id="chk-filter" ${draftUsage.filterable ? 'checked' : ''}> Usar como Filtro
                            </label>
                            <label style="display:flex; align-items:center; gap:0.5rem;">
                                <input type="checkbox" id="chk-search" ${draftUsage.useForImageSearch ? 'checked' : ''}> Usar para Búsqueda (Imágenes)
                            </label>
                            <label style="display:flex; align-items:center; gap:0.5rem;">
                                <input type="checkbox" id="chk-list" ${draftUsage.showInList ? 'checked' : ''}> Mostrar en Listado (Tarjeta)
                            </label>
                        </div>

                        <hr style="border-color:var(--border);">
                        
                        <div>
                            <p style="font-weight:bold; margin-bottom:0.5rem;">Visibilidad Condicional (Jerarquía)</p>
                            <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
                                <input type="checkbox" id="chk-cond" ${draftUsage.showIf ? 'checked' : ''}> 
                                Mostrar este campo SÓLO SI...
                            </label>
                            
                            <div id="cond-logic" style="background:var(--bg-main); padding:0.5rem; border:1px solid var(--border); display:none;">
                                <div style="margin-bottom:0.5rem;">
                                    <label style="font-size:0.8rem; color:var(--text-secondary);">Depende del Campo:</label>
                                    <select id="cond-parent" style="width:100%; padding:0.25rem;">
                                        <option value="">-- Seleccionar --</option>
                                        ${potentialParents.map(p => `<option value="${p.id}" ${draftUsage.showIf?.fieldId === p.id ? 'selected' : ''}>${p.label}</option>`).join('')}
                                    </select>
                                </div>
                                <div id="cond-value-container">
                                    <!-- Dynamic Input -->
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                const chkCond = container.querySelector('#chk-cond');
                const condDiv = container.querySelector('#cond-logic');

                const parentSel = container.querySelector('#cond-parent');
                const valContainer = container.querySelector('#cond-value-container');

                const renderValueInput = () => {
                    valContainer.innerHTML = '';
                    const parentId = parentSel.value;
                    if (!parentId) return;

                    const parentUsage = potentialParents.find(p => p.id === parentId);
                    if (!parentUsage) return;

                    const parentDef = parentUsage.def;
                    const currentVal = (draftUsage.showIf?.fieldId === parentId) ? draftUsage.showIf.value : '';

                    const label = `<label style="font-size:0.8rem; color:var(--text-secondary);">Debe tener el valor:</label>`;

                    if (parentDef.type === 'boolean') {
                        const trueLbl = parentDef.booleanConfig?.trueLabel || 'Si';
                        const falseLbl = parentDef.booleanConfig?.falseLabel || 'No';

                        valContainer.innerHTML = `
                            ${label}
                            <select id="cond-val" style="width:100%; padding:0.25rem; background:var(--bg-input); border:1px solid var(--border); color:white;">
                                <option value="">-- Seleccionar --</option>
                                <option value="true" ${String(currentVal) === 'true' ? 'selected' : ''}>${trueLbl}</option>
                                <option value="false" ${String(currentVal) === 'false' ? 'selected' : ''}>${falseLbl}</option>
                            </select>
                         `;
                    } else if (parentDef.type === 'select' && parentDef.options) {
                        let opts = parentDef.options.map(opt => `<option value="${opt}" ${currentVal === opt ? 'selected' : ''}>${opt}</option>`).join('');
                        valContainer.innerHTML = `
                            ${label}
                            <select id="cond-val" style="width:100%; padding:0.25rem; background:var(--bg-input); border:1px solid var(--border); color:white;">
                                <option value="">-- Seleccionar --</option>
                                ${opts}
                            </select>
                        `;
                    } else {
                        valContainer.innerHTML = `
                            ${label}
                            <input type="text" id="cond-val" value="${currentVal}" style="width:100%; padding:0.25rem; background:var(--bg-input); border:1px solid var(--border); color:white;">
                            <div style="font-size:0.7rem; color:var(--text-secondary); margin-top:0.25rem;">* Debe coincidir exacto.</div>
                        `;
                    }
                };

                const toggleCond = () => {
                    condDiv.style.display = chkCond.checked ? 'block' : 'none';
                    if (chkCond.checked) renderValueInput();
                };

                chkCond.onchange = toggleCond;
                parentSel.onchange = renderValueInput;

                toggleCond();

            },
            onSave: async () => {
                // 1. Handle Global Field Rename
                const newLabel = document.getElementById('config-field-label').value.trim();
                if (!newLabel) return alert('El nombre del campo no puede estar vacío.');

                if (newLabel.toLowerCase() !== def.label.toLowerCase()) {
                    // Check duplicates
                    const exists = store.data.fieldDefinitions.find(f => f.label.toLowerCase() === newLabel.toLowerCase() && f.id !== def.id);
                    if (exists) {
                        alert(`Error: Ya existe un campo llamado "${newLabel}".`);
                        return false;
                    }
                    if (confirm(`⚠️ Estás cambiando el nombre GLOBAL de este campo a "${newLabel}".\n\nEsto afectará a TODOS los Tipos de Artículo que usen este campo.\n¿Confirmar cambio?`)) {
                        def.label = newLabel;
                        // Optional: Update key if we want strict syncing, but might break old data? 
                        // Better to keep key stable or ask? For now, let's keep key stable to allow data portability unless implied otherwise.
                        // But usually key follows label. Let's update key for consistency if it's a "fix typo" scenario.
                        def.key = newLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
                        await store.saveFieldDefinition(def);
                    } else {
                        return false;
                    }
                }

                // 2. Handle Usage Config
                draftUsage.mandatory = document.getElementById('chk-mandatory').checked;
                draftUsage.filterable = document.getElementById('chk-filter').checked;
                draftUsage.useForImageSearch = document.getElementById('chk-search').checked;
                draftUsage.showInList = document.getElementById('chk-list').checked;

                if (document.getElementById('chk-cond').checked) {
                    const pid = document.getElementById('cond-parent').value;
                    const val = document.getElementById('cond-val').value;
                    if (pid && val) {
                        draftUsage.showIf = { fieldId: pid, value: val };
                    } else {
                        alert('Debes configurar la regla condicional completa.');
                        return false;
                    }
                } else {
                    draftUsage.showIf = null;
                }

                onSave(draftUsage);
                return true;
            }
        });
    }
};

