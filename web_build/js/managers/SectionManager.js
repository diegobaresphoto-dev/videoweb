import { store } from '../state.js';
import { Modal } from '../ui/Modal.js';
import { IconPicker } from '../ui/IconPicker.js';

export const SectionManager = {
    create(collectionId) {
        this.openEditor({
            id: 'sec_' + Date.now(),
            collectionId: collectionId,
            name: '',
            icon: '📁'
        });
    },

    edit(section) {
        this.openEditor({ ...section });
    },

    openEditor(draft) {
        Modal.show({
            title: draft.id ? 'Editar Sección' : 'Nueva Sección',
            saveLabel: 'Guardar',
            renderContent: (container) => {
                // Icon + Name Row
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.gap = '1rem';
                row.style.alignItems = 'center';
                row.style.marginBottom = '1rem';

                // Icon Preview Button
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
                iconBtn.innerText = draft.icon || '📁';

                iconBtn.onclick = () => {
                    IconPicker.show({
                        onSelect: (icon) => {
                            draft.icon = icon;
                            iconBtn.innerText = icon;
                        }
                    });
                };

                const nameGroup = document.createElement('div');
                nameGroup.style.flex = '1';
                nameGroup.innerHTML = '<label style="display:block; margin-bottom:0.5rem">Nombre de la Sección</label>';
                const input = document.createElement('input');
                input.type = 'text';
                input.value = draft.name;
                input.placeholder = 'Ej: Videojuegos';
                input.style.width = '100%';
                input.style.padding = '0.5rem';
                input.style.background = 'var(--bg-main)';
                input.style.border = '1px solid var(--border)';
                input.style.color = 'white';
                input.style.borderRadius = '4px';
                input.oninput = (e) => draft.name = e.target.value;
                nameGroup.appendChild(input);

                row.appendChild(iconBtn);
                row.appendChild(nameGroup);
                container.appendChild(row);

                // Advanced Panel (Duplicate/Delete) logic follows...
                if (store.data.sections.find(s => s.id === draft.id)) {
                    const advPanel = document.createElement('div');
                    advPanel.style.marginTop = '2rem';
                    advPanel.style.paddingTop = '1rem';
                    advPanel.style.borderTop = '1px solid var(--border)';
                    advPanel.innerHTML = `
                        <h4>Gestión Avanzada</h4>
                        <div style="display:flex; gap:0.5rem; align-items:center; background:var(--bg-main); padding:0.5rem; border-radius:8px;">
                            <button id="btn-duplicate-sec" class="btn btn-sm" style="background:#38a169; color:white; flex:1;">Duplicar Sección Completa</button>
                            <button id="btn-delete-sec" class="btn btn-sm" style="background:#e53e3e; color:white; flex:1;">Eliminar Sección</button>
                        </div>
                    `;
                    container.appendChild(advPanel);

                    // DUPLICATE HANDLER
                    advPanel.querySelector('#btn-duplicate-sec').onclick = async () => {
                        const relatedTypes = store.data.itemTypes.filter(t => t.sectionId === draft.id);
                        let totalItems = 0;
                        relatedTypes.forEach(t => {
                            totalItems += store.data.items.filter(i => i.typeId === t.id).length;
                        });

                        if (!confirm(`¿Duplicar Sección "${draft.name}"?\n(Incluye ${relatedTypes.length} subcategorías y ${totalItems} artículos)`)) return;

                        // 1. Duplicate Section
                        const newSection = {
                            ...draft,
                            id: 'sec_' + Date.now(),
                            name: draft.name + ' (Copia)'
                        };
                        await store.saveSection(newSection);

                        // 2. Duplicate Types & Items
                        for (const oldType of relatedTypes) {
                            const newType = {
                                ...oldType,
                                id: 'type_' + Date.now() + Math.floor(Math.random() * 1000), // Unique ID quirk avoiding collisions
                                sectionId: newSection.id,
                                name: oldType.name
                            };
                            await store.saveType(newType);

                            const oldItems = store.data.items.filter(i => i.typeId === oldType.id);
                            for (const oldItem of oldItems) {
                                const newItem = {
                                    ...oldItem,
                                    id: 'item_' + Date.now() + Math.floor(Math.random() * 10000),
                                    typeId: newType.id
                                };
                                await store.saveItem(newItem);
                            }
                        }

                        alert('Sección duplicada correctamente.');
                        Modal.close();
                    };

                    // DELETE HANDLER
                    advPanel.querySelector('#btn-delete-sec').onclick = async () => {
                        const relatedTypes = store.data.itemTypes.filter(t => t.sectionId === draft.id);
                        const count = relatedTypes.length;

                        // Helper for cleanup
                        const cleanUpAndClose = async (deletedId) => {
                            if (store.data.currentSectionId === deletedId) {
                                store.data.currentSectionId = null;
                                store.data.currentView = 'dashboard';
                            }
                            await Modal.close();
                            // Force sidebar refresh just in case
                            if (window.renderSidebar) window.renderSidebar();
                        };

                        if (count === 0) {
                            if (confirm('¿Eliminar permanentemente esta sección vacía?')) {
                                try {
                                    await store.deleteSection(draft.id);
                                    await cleanUpAndClose(draft.id);
                                } catch (e) { alert('Error al eliminar: ' + e.message); }
                            }
                            return;
                        }

                        // WIZARD
                        container.innerHTML = `
                            <div style="text-align:center;">
                                <h3 style="color:#e53e3e;">⚠ Atención</h3>
                                <p>Esta sección contiene <strong>${count} subcategorías</strong>.</p>
                                <p>¿Qué deseas hacer?</p>

                                <div style="background:var(--bg-main); padding:1rem; border-radius:8px; text-align:left; margin:1rem 0;">
                                    <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem; cursor:pointer;">
                                        <input type="radio" name="del-sec-action" value="delete" checked>
                                        <span style="color:#e53e3e;">Eliminar TODO (Subcategorías y Artículos)</span>
                                    </label>
                                    
                                    <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                                        <input type="radio" name="del-sec-action" value="move">
                                        <span>Mover subcategorías a:</span>
                                    </label>
                                    
                                    <select id="migrate-sec-target" style="width:100%; margin-top:0.5rem; padding:0.5rem; background:var(--bg-card); color:white; border:1px solid var(--border); border-radius:4px;" disabled>
                                        <option value="">Selecciona otra sección...</option>
                                    </select>
                                </div>

                                <div style="display:flex; justify-content:center; gap:1rem; margin-top:2rem;">
                                    <button id="btn-cancel-del-sec" class="btn btn-ghost">Cancelar</button>
                                    <button id="btn-confirm-del-sec" class="btn" style="background:#e53e3e; color:white;">Ejecutar Acción</button>
                                </div>
                            </div>
                        `;

                        // Populate Select
                        const sel = container.querySelector('#migrate-sec-target');
                        store.data.sections.filter(s => s.id !== draft.id).forEach(s => {
                            const opt = document.createElement('option');
                            opt.value = s.id;
                            opt.innerText = s.name;
                            sel.appendChild(opt);
                        });

                        // UX
                        const radios = container.querySelectorAll('input[name="del-sec-action"]');
                        radios.forEach(r => {
                            r.onchange = (e) => {
                                sel.disabled = e.target.value !== 'move';
                            };
                        });

                        // Action
                        container.querySelector('#btn-cancel-del-sec').onclick = () => Modal.close();
                        container.querySelector('#btn-confirm-del-sec').onclick = async () => {
                            try {
                                const action = container.querySelector('input[name="del-sec-action"]:checked').value;

                                if (action === 'delete') {
                                    if (confirm('¿ESTÁS FINALMENTE SEGURO? Se borrará la sección, sus subcategorías y TODOS sus artículos.')) {
                                        // Robust loop
                                        const typesToDelete = [...relatedTypes]; // Copy
                                        for (const t of typesToDelete) {
                                            const itemsToDelete = store.data.items.filter(i => i.typeId === t.id);
                                            for (const item of itemsToDelete) await store.deleteItem(item.id);
                                            await store.deleteType(t.id);
                                        }
                                        await store.deleteSection(draft.id);
                                        await cleanUpAndClose(draft.id);
                                    }
                                } else {
                                    const targetId = sel.value;
                                    if (!targetId) return alert('Selecciona una sección de destino.');

                                    for (const t of relatedTypes) {
                                        t.sectionId = targetId;
                                        await store.saveType(t);
                                    }
                                    await store.deleteSection(draft.id);
                                    alert(`Sección eliminada. ${count} subcategorías movidas.`);
                                    await cleanUpAndClose(draft.id);
                                }
                            } catch (error) {
                                console.error(error);
                                alert('Error crítico al eliminar: ' + error.message);
                            }
                        };
                    };
                }
            },
            onSave: async () => {
                if (!draft.name) return false;

                // Determine if this is a NEW section (doesn't exist in store yet)
                const isNew = !store.data.sections.find(s => s.id === draft.id);

                await store.saveSection(draft);

                if (isNew) {
                    // Auto-create the default Template (Type)

                    // 1. Fetch default fields
                    const defaultFields = (store.data.fieldDefinitions || [])
                        .filter(f => f.defaultInNewTypes)
                        .map(f => ({
                            fieldId: f.id,
                            label: f.label,
                            mandatory: f.defaultMandatory || false,
                            showInList: f.defaultShowInList || false,
                            isFilter: f.defaultFilterable || false,
                            useForImageSearch: f.defaultSearchable || false
                        }));

                    // 2. Create the Type
                    const newType = {
                        id: 'type_' + Date.now(),
                        sectionId: draft.id,
                        name: draft.name, // Same name as Section
                        icon: draft.icon || '📦',
                        fields: defaultFields
                    };

                    await store.saveType(newType);

                    // console.log('Auto-created default type for section:', draft.name);
                }

                return true;
            }
        });
    }
};
