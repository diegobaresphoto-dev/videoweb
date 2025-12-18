import { store } from '../state.js';
import { Modal } from '../ui/Modal.js';

export const FieldRegistryManager = {
    // Schema for a Field Definition:
    // {
    //   id: 'field_123',
    //   label: 'Conexión',
    //   key: 'conexion', // auto-gen
    //   type: 'boolean' | 'text' | 'number' | 'select' | 'checklist' | 'date' | 'textarea' | 'rating' | 'url',
    //   // Type Specific:
    //   booleanConfig: { trueLabel: 'Con Cable', falseLabel: 'Inalámbrico' }, // Only for boolean
    //   options: ['PS4', 'PS5'], // Only for select/checklist
    //   // Defaults (can be overridden in Type usage):
    //   defaultMandatory: false,
    //   defaultFilterable: false,
    //   defaultSearchable: false
    // }

    pickField(collectionId, onSelect) {
        Modal.show({
            title: 'Campos Comunes', // User requested title
            saveLabel: 'Añadir Seleccionados', // Explicit Save button
            renderContent: (container) => {
                const selectedIds = new Set();

                container.innerHTML = `
                    <div style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
                         <input type="text" id="search-field" placeholder="Buscar campo..." style="flex:1; padding:0.5rem; background:var(--bg-main); border:1px solid var(--border); color:white; margin-right:1rem;">
                         <button class="btn btn-primary btn-sm" id="btn-create-new">Crear Nuevo</button>
                    </div>
                    <div id="picker-list" style="display:flex; flex-direction:column; gap:0.5rem; max-height:400px; overflow-y:auto;"></div>
                    <div id="selection-status" style="margin-top:0.5rem; color:var(--primary); font-size:0.9rem; text-align:right;">0 seleccionados</div>
                `;

                const list = container.querySelector('#picker-list');
                const status = container.querySelector('#selection-status');

                const updateStatus = () => {
                    status.innerText = `${selectedIds.size} seleccionados`;
                    const saveBtn = document.querySelector('.modal-footer .btn-save'); // Ideally passed via context, but DOM lookup works
                    if (saveBtn) {
                        saveBtn.innerText = `Añadir (${selectedIds.size})`;
                        saveBtn.disabled = selectedIds.size === 0;
                        saveBtn.style.opacity = selectedIds.size === 0 ? 0.5 : 1;
                    }
                };

                const renderList = (filter = '') => {
                    list.innerHTML = '';
                    const fields = store.data.fieldDefinitions || [];
                    const filtered = fields.filter(f => {
                        if (collectionId && f.collectionId && f.collectionId !== collectionId) return false;
                        return f.label.toLowerCase().includes(filter.toLowerCase());
                    });

                    if (filtered.length === 0) {
                        list.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">No se encontraron campos.</div>';
                        return;
                    }

                    filtered.forEach(f => {
                        const isSelected = selectedIds.has(f.id);
                        const item = document.createElement('div');
                        item.style.padding = '0.75rem';
                        item.style.background = isSelected ? 'var(--bg-secondary)' : 'var(--bg-card)';
                        item.style.border = isSelected ? '1px solid var(--primary)' : '1px solid var(--border)';
                        item.style.borderRadius = 'var(--radius)';
                        item.style.cursor = 'pointer';
                        item.style.display = 'flex';
                        item.style.justifyContent = 'space-between';
                        item.style.alignItems = 'center';
                        item.style.marginBottom = '4px';

                        item.innerHTML = `
                            <div>
                                <div style="font-weight:bold; color: ${isSelected ? 'var(--primary)' : 'white'}">${f.label}</div>
                                <div style="font-size:0.8rem; color:var(--text-secondary);">
                                    Tipo: ${f.type.toUpperCase()}
                                </div>
                            </div>
                            ${isSelected ? '<span style="color:var(--primary)">✔</span>' : ''}
                        `;

                        item.onclick = () => {
                            if (selectedIds.has(f.id)) {
                                selectedIds.delete(f.id);
                            } else {
                                selectedIds.add(f.id);
                            }
                            renderList(document.getElementById('search-field').value);
                            updateStatus();
                        };
                        list.appendChild(item);
                    });
                };

                container.querySelector('#search-field').oninput = (e) => renderList(e.target.value);
                container.querySelector('#btn-create-new').onclick = () => {
                    this.createField(collectionId, () => renderList());
                };

                // Store reference for save handler
                container.dataset.ready = "true";
                container.getSelected = () => {
                    return (store.data.fieldDefinitions || []).filter(f => selectedIds.has(f.id));
                };

                renderList();
                setTimeout(updateStatus, 0); // Init button state
            },
            onSave: () => {
                // Fix: Select the Last modal body (active one), not the first one (background one)
                const bodies = document.querySelectorAll('.modal-body');
                const container = bodies[bodies.length - 1];

                if (container && typeof container.getSelected === 'function') {
                    const selectedDocs = container.getSelected();
                    onSelect(selectedDocs);
                    return true;
                }
                return true;
            }
        });
    },

    openRegistry(collectionId) {
        // Resolve Collection Name
        const collection = store.data.collections.find(c => c.id === collectionId);
        const colName = collection ? collection.name : 'Global';

        Modal.show({
            title: `Campos Comunes (${colName})`,
            saveLabel: 'Cerrar',
            showCancel: false,
            renderContent: (container) => {
                container.innerHTML = `
                    <div style="display:flex; justify-content:space-between; margin-bottom:1rem;">
                        <p style="color:var(--text-secondary); margin:0;">Define campos aquí para reusarlos en Plantillas de <b>${colName}</b>.</p>
                        <button class="btn btn-primary btn-sm" id="btn-create-global">Nuevo Campo Global</button>
                    </div>
                    <div id="registry-list" style="display:flex; flex-direction:column; gap:0.5rem; max-height:400px; overflow-y:auto;"></div>
                `;

                const list = container.querySelector('#registry-list');
                const renderList = () => {
                    list.innerHTML = '';
                    const fields = store.data.fieldDefinitions || [];
                    const filtered = fields.filter(f => {
                        if (collectionId && f.collectionId && f.collectionId !== collectionId) return false;
                        return true;
                    });

                    if (filtered.length === 0) {
                        list.innerHTML = '<div style="text-align:center; padding:2rem; color:var(--text-secondary);">No hay campos definidos aún.</div>';
                        return;
                    }

                    filtered.forEach(f => {
                        const item = document.createElement('div');
                        item.className = 'list-item'; // Assume generic list styles exist or inline
                        item.style.display = 'flex';
                        item.style.justifyContent = 'space-between';
                        item.style.alignItems = 'center';
                        item.style.padding = '0.75rem';
                        item.style.background = 'var(--bg-card)';
                        item.style.border = '1px solid var(--border)';
                        item.style.borderRadius = 'var(--radius)';

                        let details = `<span style="color:var(--primary); font-size:0.8rem; margin-left:0.5rem;">${f.type.toUpperCase()}</span>`;
                        if (f.defaultInNewTypes) {
                            details += ` <span style="color:gold; font-size:0.8rem; margin-left:0.5rem;" title="Se incluye automáticamente en nuevas plantillas">★ Auto</span>`;
                        }

                        if (f.type === 'boolean') {
                            details += ` <span style="color:var(--text-secondary); font-size:0.8rem;">(${f.booleanConfig?.trueLabel}/${f.booleanConfig?.falseLabel})</span>`;
                        } else if (f.type === 'select' || f.type === 'checklist') {
                            details += ` <span style="color:var(--text-secondary); font-size:0.8rem;">(${f.options?.length || 0} opciones)</span>`;
                        }

                        item.innerHTML = `
                            <div>
                                <span style="font-weight:bold;">${f.label}</span>
                                ${details}
                            </div>
                            <div style="display:flex; gap:0.5rem;">
                                <button class="btn-ghost btn-xs edit-btn">✏️</button>
                                <button class="btn-ghost btn-xs del-btn" style="color:var(--accent);">🗑️</button>
                            </div>
                        `;

                        item.querySelector('.edit-btn').onclick = () => this.openEditor(f);
                        item.querySelector('.del-btn').onclick = () => {
                            if (confirm(`¿Borrar el campo GLOBAL "${f.label}"? Esto podría afectar a los artículos existentes.`)) {
                                store.deleteFieldDefinition(f.id).then(renderList);
                            }
                        };
                        list.appendChild(item);
                    });
                };

                container.querySelector('#btn-create-global').onclick = () => {
                    this.createField(collectionId, () => renderList()); // Callback to refresh list
                };

                renderList();
            },
            onSave: () => true
        });
    },

    createField(collectionId, callback) {
        const draft = { collectionId: collectionId || null };
        this.openEditor(draft, callback);
    },

    openEditor(existing, onSaveSuccess) {
        const isEdit = !!existing;
        const draft = isEdit ? JSON.parse(JSON.stringify(existing)) : {
            id: 'fdef_' + Date.now(),
            label: '',
            key: '',
            type: 'text',
            booleanConfig: { trueLabel: 'Si', falseLabel: 'No' },
            options: [],
            defaultMandatory: false,
            defaultFilterable: false,
            defaultSearchable: false,
            defaultSearchable: false,
            defaultInNewTypes: false,
            collectionId: null
        };

        Modal.show({
            title: isEdit ? 'Editar Campo' : 'Nuevo Campo',
            saveLabel: 'Guardar Definición',
            showCancel: false,
            renderContent: (container) => {
                container.innerHTML = `
                    <div style="display:grid; gap:1rem;">
                        <!-- Basic Info -->
                        <div>
                            <label style="display:block; color:var(--text-secondary); margin-bottom:0.25rem;">Etiqueta (Nombre)</label>
                            <input type="text" id="gl-label" value="${draft.label}" placeholder="Ej: Fuente de Alimentación">
                        </div>

                        <div style="display:none;">
                            <label style="display:block; color:var(--text-secondary); margin-bottom:0.25rem;">Ámbito (Colección)</label>
                            <select id="gl-scope">
                                <option value="">-- Global (Todas las Colecciones) --</option>
                                ${store.data.collections.map(c => `<option value="${c.id}" ${draft.collectionId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                            </select>
                            <p style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.25rem;">Define si este campo es exclusivo de una colección o sirve para todas.</p>
                        </div>

                        <div>
                            <label style="display:block; color:var(--text-secondary); margin-bottom:0.25rem;">Tipo de Dato</label>
                            <select id="gl-type">
                                <optgroup label="Texto / Números">
                                    <option value="text">Texto Corto</option>
                                    <option value="textarea">Texto Largo (Descripción)</option>
                                    <option value="number">Número</option>
                                    <option value="url">Enlace (URL)</option>
                                </optgroup>
                                <optgroup label="Relaciones">
                                    <option value="reference">Referencia a Otro Artículo</option>
                                </optgroup>
                                <optgroup label="Selección">
                                    <option value="boolean">Booleano (2 Opciones Personalizadas)</option>
                                    <option value="select">Selector Único (Dropdown)</option>
                                    <option value="checklist">Checklist (Selección Múltiple)</option>
                                    <option value="rating">Valoración (Estrellas)</option>
                                </optgroup>
                                <optgroup label="Fecha">
                                    <option value="date">Fecha</option>
                                </optgroup>
                            </select>
                        </div>

                        <!-- Config Panels -->
                        
                        <!-- Boolean Config -->
                        <div id="cfg-boolean" class="cfg-panel" style="display:none; padding:1rem; border:1px dashed var(--border); border-radius:var(--radius-md);">
                            <p style="margin-top:0; font-size:0.9rem; color:var(--primary);">Configuración Booleana (Se mostrará como desplegable)</p>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                                <div>
                                    <label>Opción 1 (True)</label>
                                    <input type="text" id="bool-true" value="${draft.booleanConfig?.trueLabel || 'Si'}">
                                </div>
                                <div>
                                    <label>Opción 2 (False)</label>
                                    <input type="text" id="bool-false" value="${draft.booleanConfig?.falseLabel || 'No'}">
                                </div>
                            </div>
                        </div>

                        <!-- Reference Config -->
                        <div id="cfg-reference" class="cfg-panel" style="display:none; padding:1rem; border:1px dashed var(--border); border-radius:var(--radius-md);">
                            <p style="margin-top:0; font-size:0.9rem; color:var(--primary);">Configuración de Referencia</p>
                            <label style="display:block; color:var(--text-secondary); margin-bottom:0.25rem;">Tipo de Artículo Destino</label>
                            <select id="ref-target">
                                <option value="">-- Selecciona un Tipo --</option>
                                ${store.data.itemTypes.map(t => `<option value="${t.id}" ${draft.referenceConfig?.targetTypeId === t.id ? 'selected' : ''}>${t.icon} ${t.name}</option>`).join('')}
                            </select>
                            <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0;">Ej: Selecciona "Consola" para mostrar una lista de tus consolas.</p>
                        </div>

                        <!-- Options Config -->
                        <div id="cfg-options" class="cfg-panel" style="display:none; padding:1rem; border:1px dashed var(--border); border-radius:var(--radius-md);">
                            <p style="margin-top:0; font-size:0.9rem; color:var(--primary);">Opciones (Separadas por comas)</p>
                            <textarea id="opt-input" rows="3">${(draft.options || []).join(', ')}</textarea>
                            <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:0;">Ej: PS4, PS5, Xbox Series X</p>
                        </div>
                        <!-- Defaults Config -->
                        <div style="padding:1rem; border:1px solid var(--border); border-radius: var(--radius-md);">
                            <p style="margin-top:0; font-size:0.9rem; color:var(--primary); margin-bottom:0.5rem;">Configuración de Uso (Valores por defecto)</p>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                                    <input type="checkbox" id="def-mandatory" ${draft.defaultMandatory ? 'checked' : ''}>
                                    <span style="font-size:0.9rem;">Obligatorio</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                                    <input type="checkbox" id="def-list" ${draft.defaultShowInList ? 'checked' : ''}>
                                    <span style="font-size:0.9rem;">Mostrar en Lista</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                                    <input type="checkbox" id="def-filter" ${draft.defaultFilterable ? 'checked' : ''}>
                                    <span style="font-size:0.9rem;">Usar como Filtro</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                                    <input type="checkbox" id="def-search" ${draft.defaultSearchable ? 'checked' : ''}>
                                    <span style="font-size:0.9rem;">Usar para Búsqueda</span>
                                </label>
                                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; grid-column: 1 / -1;">
                                    <input type="checkbox" id="def-auto-include" ${draft.defaultInNewTypes ? 'checked' : ''}>
                                    <span style="font-size:0.9rem; color:var(--primary);">Incluir en nuevas Plantillas</span>
                                </label>
                            </div>
                        </div>
                    </div>
                `;

                // Logic
                const typeSel = container.querySelector('#gl-type');
                const cfgBool = container.querySelector('#cfg-boolean');
                const cfgOpt = container.querySelector('#cfg-options');

                const bindCheckbox = (id, prop) => {
                    container.querySelector(id).onchange = e => draft[prop] = e.target.checked;
                };
                bindCheckbox('#def-mandatory', 'defaultMandatory');
                bindCheckbox('#def-list', 'defaultShowInList');
                bindCheckbox('#def-filter', 'defaultFilterable');
                bindCheckbox('#def-search', 'defaultSearchable');
                bindCheckbox('#def-auto-include', 'defaultInNewTypes');

                typeSel.value = draft.type;

                const updatePanels = () => {
                    const t = typeSel.value;
                    cfgBool.style.display = 'none';
                    cfgOpt.style.display = 'none';

                    if (t === 'boolean') cfgBool.style.display = 'block';
                    if (t === 'boolean') cfgBool.style.display = 'block';
                    if (t === 'select' || t === 'checklist') cfgOpt.style.display = 'block';
                    if (t === 'reference') container.querySelector('#cfg-reference').style.display = 'block';
                };

                typeSel.onchange = (e) => {
                    draft.type = e.target.value;
                    updatePanels();
                };
                updatePanels();

                // Bind Inputs to Draft (Simplified)
                container.querySelector('#gl-label').oninput = e => draft.label = e.target.value;
                // container.querySelector('#gl-type').onchange handled above
                container.querySelector('#bool-true').oninput = e => draft.booleanConfig.trueLabel = e.target.value;
                container.querySelector('#bool-false').oninput = e => draft.booleanConfig.falseLabel = e.target.value;
                container.querySelector('#opt-input').oninput = e => {
                    draft.options = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                };
                container.querySelector('#ref-target').onchange = e => {
                    if (!draft.referenceConfig) draft.referenceConfig = {};
                    draft.referenceConfig.targetTypeId = e.target.value;
                };
            },
            onSave: async () => {
                console.log('DEBUG: FieldRegistryManager onSave Triggered'); // Confirm entry
                try {
                    // 1. Force value refresh from specific ID (nuclear option for binding issues)
                    const labelInput = document.getElementById('gl-label');
                    if (labelInput) draft.label = labelInput.value;

                    if (!draft.label || draft.label === 'undefined') return alert('La etiqueta es obligatoria');

                    // Check for duplicates
                    const existingFields = store.data.fieldDefinitions || [];
                    const duplicate = existingFields.find(f =>
                        f.label.trim().toLowerCase() === draft.label.trim().toLowerCase() &&
                        f.id !== draft.id
                    );

                    if (duplicate) {
                        // UX Improvement: Offer to link instead of block
                        if (confirm(`El campo global "${duplicate.label}" ya existe en el sistema.\n\n¿Quieres VINCULAR (usar) el existente en su lugar?`)) {
                            if (onSaveSuccess) onSaveSuccess(duplicate);
                            return true; // Close modal
                        }
                        return false; // User said No, keep editing to rename
                    }

                    // Update scope
                    const scopeSelect = document.getElementById('gl-scope');
                    draft.collectionId = (scopeSelect && scopeSelect.value) ? scopeSelect.value : null;

                    draft.key = draft.label.toLowerCase().replace(/[^a-z0-9]/g, '_');

                    await store.saveFieldDefinition(draft);
                    if (onSaveSuccess) onSaveSuccess(draft); // PASS THE DRAFT BACK!
                    return true;
                } catch (err) {
                    console.error('Error saving field:', err);
                    alert('Error al guardar: ' + err.message);
                    return false;
                }
            }
        });
    }
};
