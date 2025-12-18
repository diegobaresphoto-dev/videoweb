import { store } from '../state.js';
import { Modal } from '../ui/Modal.js';
import { IconPicker } from '../ui/IconPicker.js';

export const CollectionManager = {
    create() {
        this.openEditor({
            id: 'col_' + Date.now(),
            name: '',
            icon: '📂'
        });
    },

    edit(col) {
        this.openEditor({ ...col });
    },

    openEditor(draft) {
        Modal.show({
            title: draft.name ? 'Editar Colección' : 'Nueva Colección',
            saveLabel: 'Guardar',
            showCancel: false,
            renderContent: (container) => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.gap = '1rem';
                row.style.alignItems = 'center';

                // Icon Preview Button
                const iconBtn = document.createElement('button');
                iconBtn.className = 'btn';
                iconBtn.style.fontSize = '2rem';
                iconBtn.style.width = '60px';
                iconBtn.style.height = '60px';
                iconBtn.style.display = 'flex';
                iconBtn.style.alignItems = 'center';
                iconBtn.style.justifyContent = 'center';
                iconBtn.style.background = 'var(--bg-input)';
                iconBtn.style.border = '1px solid var(--border)';
                iconBtn.style.color = 'var(--text-main)';
                iconBtn.style.cursor = 'pointer';
                iconBtn.innerText = draft.icon || '📂';

                iconBtn.onclick = () => {
                    IconPicker.show({
                        onSelect: (icon) => {
                            draft.icon = icon;
                            iconBtn.innerText = icon;
                        }
                    });
                };

                // Name Input
                const nameHelper = document.createElement('div');
                nameHelper.style.flex = '1';

                const nameInput = document.createElement('input');
                nameInput.type = 'text';
                nameInput.value = draft.name;
                nameInput.placeholder = 'Nombre (ej: Gaming)';
                nameInput.style.width = '100%';
                nameInput.style.padding = '0.5rem';
                nameInput.style.background = 'var(--bg-input)';
                nameInput.style.border = '1px solid var(--border)';
                nameInput.style.borderRadius = '4px';
                nameInput.style.color = 'var(--text-main)';
                nameInput.style.fontSize = '1.1rem';

                nameInput.oninput = (e) => draft.name = e.target.value;

                nameHelper.appendChild(nameInput);
                row.appendChild(nameHelper);
                container.appendChild(row);

                // Delete Button (Edit Mode Only)
                if (draft.id && draft.name) {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn btn-sm';
                    deleteBtn.style.background = '#ff4444';
                    deleteBtn.style.color = 'white';
                    deleteBtn.style.border = 'none';
                    deleteBtn.style.marginTop = '1rem';
                    deleteBtn.style.padding = '0.5rem 1rem';
                    deleteBtn.style.cursor = 'pointer';
                    deleteBtn.style.float = 'right'; // Or handle layout better
                    deleteBtn.innerHTML = '🗑️ Eliminar Colección';

                    deleteBtn.onclick = () => {
                        Modal.confirm({
                            title: 'Eliminar Colección',
                            message: `¿ELIMINAR COLECCIÓN "${draft.name}"?\n\n¡ESTO BORRARÁ TODAS LAS SECCIONES Y ARTÍCULOS DENTRO DE ELLA!\n\nNo se puede deshacer.`,
                            confirmLabel: 'ELIMINAR TODO',
                            isDanger: true,
                            onConfirm: async () => {
                                await store.deleteCollection(draft.id);
                                Modal.close(); // Close the editor itself too?
                                // Actually, Modal.confirm overlays ON TOP of editor.
                                // We need to close BOTH or just the editor?
                                // Standard pattern: Confirm closes itself on success.
                                // We then need to close the Editor.
                                // Let's simplify:
                                // Close Editor implies success.
                                // Wait, Modal.close() removes TOP most.
                                // If I call Modal.close() here inside onConfirm, it closes the Confirm.
                                // I need to close the Editor (parent) too.
                                // Let's defer that.
                                setTimeout(() => Modal.close(), 100); // Close parent Editor
                            }
                        });
                    };

                    container.appendChild(document.createElement('br')); // Space
                    container.appendChild(document.createElement('br')); // Space
                    container.appendChild(deleteBtn);
                }
            },
            onSave: async () => {
                if (!draft.name) return false;
                await store.saveCollection(draft);

                // Auto-generate "Nombre" field if it doesn't exist
                const existingFields = store.data.fieldDefinitions || [];
                const hasName = existingFields.find(f =>
                    f.collectionId === draft.id &&
                    f.label.trim().toLowerCase() === 'nombre'
                );

                if (!hasName) {
                    const nameField = {
                        id: 'fdef_' + Date.now() + '_auto',
                        label: 'Nombre',
                        key: 'nombre',
                        type: 'text',
                        collectionId: draft.id,
                        booleanConfig: { trueLabel: 'Si', falseLabel: 'No' },
                        options: [],
                        // Checks
                        defaultMandatory: true,
                        defaultShowInList: true,
                        defaultFilterable: true,
                        defaultSearchable: true,
                        defaultInNewTypes: true
                    };
                    await store.saveFieldDefinition(nameField);
                    console.log('Auto-created field: Nombre for collection', draft.name);
                }

                return true;
            }
        });
    }
};
