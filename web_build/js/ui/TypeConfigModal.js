import { Modal } from './Modal.js';
import { store } from '../state.js';
import { TypeManager } from '../managers/TypeManager.js';
import { SectionManager } from '../managers/SectionManager.js';

export const TypeConfigModal = {
    open(sectionId) {
        const section = store.data.sections.find(s => s.id === sectionId);
        if (!section) return;

        const renderTypesList = (container) => {
            container.innerHTML = '';

            // Get types for this section
            const types = store.data.itemTypes.filter(t => t.sectionId === sectionId);

            if (types.length === 0) {
                container.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--text-secondary);">
                    No hay tipos definidos en esta sección.
                </div>`;
                return;
            }

            const list = document.createElement('div');
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gap = '0.5rem';

            types.forEach((type, index) => {
                const row = document.createElement('div');
                row.className = 'sidebar-item'; // Reuse sidebar style for familiarity
                row.style.background = 'var(--bg-secondary)';
                row.style.padding = '0.75rem';
                row.style.borderRadius = '6px';
                row.style.justifyContent = 'space-between';
                row.style.cursor = 'default';

                // Label
                const label = document.createElement('span');
                label.innerHTML = `${type.icon || '📦'} <b>${type.name}</b>`;
                row.appendChild(label);

                // Controls
                const controls = document.createElement('div');
                controls.style.display = 'flex';
                controls.style.gap = '0.5rem';

                // Up
                const btnUp = document.createElement('button');
                btnUp.className = 'btn-ghost btn-sm';
                btnUp.innerHTML = '▲';
                btnUp.disabled = index === 0;
                btnUp.style.opacity = index === 0 ? 0.3 : 1;
                btnUp.onclick = () => this.moveType(type, -1);
                controls.appendChild(btnUp);

                // Down
                const btnDown = document.createElement('button');
                btnDown.className = 'btn-ghost btn-sm';
                btnDown.innerHTML = '▼';
                btnDown.disabled = index === types.length - 1;
                btnDown.style.opacity = index === types.length - 1 ? 0.3 : 1;
                btnDown.onclick = () => this.moveType(type, 1);
                controls.appendChild(btnDown);

                // Edit
                const btnEdit = document.createElement('button');
                btnEdit.className = 'btn-ghost btn-sm';
                btnEdit.innerHTML = '✏️';
                btnEdit.onclick = () => {
                    // Close config modal temporarily? Or edit on top?
                    // Ideally Modal stacking allows this.
                    TypeManager.edit(type);
                };
                controls.appendChild(btnEdit);

                // Delete
                const btnDelete = document.createElement('button');
                btnDelete.className = 'btn-ghost btn-sm';
                btnDelete.innerHTML = '🗑️';
                btnDelete.title = 'Eliminar Tipo';
                btnDelete.style.color = '#f87171';
                btnDelete.onclick = async () => {
                    const relatedItems = store.data.items.filter(i => i.typeId === type.id);
                    if (relatedItems.length > 0) {
                        alert(`No se puede eliminar: Esta plantilla tiene ${relatedItems.length} artículos.\n\nPara borrarla, entra en su edición (✏️) y usa "Gestión Avanzada" para borrar o mover los artículos.`);
                        return;
                    }

                    if (confirm(`¿Eliminar definitivamente el tipo "${type.name}"?`)) {
                        await store.deleteType(type.id);
                        setTimeout(() => renderTypesList(container), 100);
                    }
                };
                controls.appendChild(btnDelete);

                row.appendChild(controls);
                list.appendChild(row);
            });

            container.appendChild(list);
        };

        Modal.show({
            title: `Configurar: ${section.name}`,
            showCancel: false,
            renderContent: (body) => {
                body.style.minHeight = '300px';

                // Description
                const desc = document.createElement('p');
                desc.style.color = 'var(--text-secondary)';
                desc.style.marginBottom = '1rem';
                desc.innerText = 'Gestiona los tipos de artículos (plantillas) disponibles en esta sección.';
                body.appendChild(desc);

                // List Container
                const listContainer = document.createElement('div');
                listContainer.id = 'type-config-list';
                renderTypesList(listContainer);
                body.appendChild(listContainer);

                // Add New Button
                const addBtn = document.createElement('button');
                addBtn.className = 'btn btn-primary';
                addBtn.style.width = '100%';
                addBtn.style.marginTop = '1.5rem';
                addBtn.innerHTML = '+ Nuevo Tipo de Artículo';
                addBtn.onclick = () => {
                    TypeManager.create(sectionId);
                    // We expect TypeManager to trigger a save and re-render.
                    // We might need to refresh *this* modal's list.
                    // A simple hack is to re-render the list after a delay, 
                    // assuming TypeManager operations are mostly synchronous or fast-save.
                    // Ideally better event bus.
                    setTimeout(() => renderTypesList(listContainer), 500);
                };
                body.appendChild(addBtn);
            },
            onSave: () => true, // Just close
            saveLabel: 'Cerrar'
        });
    },

    moveType(type, direction) {
        const types = store.data.itemTypes; // Global list
        const currentIndex = types.findIndex(t => t.id === type.id);
        if (currentIndex === -1) return;

        // We need to swap valid elements within the SAME SECTION
        // But the global list might have mixed sections.
        // Actually, reordering is global in the JSON, but visually filtered.
        // It's safer to find the adjacent type sharing the same sectionId.

        const sectionTypes = types.filter(t => t.sectionId === type.sectionId);
        const internalIndex = sectionTypes.findIndex(t => t.id === type.id);
        const targetInternalIndex = internalIndex + direction;

        if (targetInternalIndex < 0 || targetInternalIndex >= sectionTypes.length) return;

        const targetType = sectionTypes[targetInternalIndex];
        const targetGlobalIndex = types.findIndex(t => t.id === targetType.id);

        // Swap in global array
        const newTypes = [...types];
        newTypes[currentIndex] = targetType;
        newTypes[targetGlobalIndex] = type;

        store.saveAllTypes(newTypes);

        // Refresh UI
        setTimeout(() => {
            const container = document.getElementById('type-config-list');
            if (container) {
                // Re-trigger render logic logic? 
                // We'll need to recall the render function. 
                // Since this object is stateless, we might need a stricter pattern.
                // But `open` re-defines renderTypesList. 
                // For now, simply close and reopen or force refresh if we had the handle?
                // `open` is the only entry point. 
                // Let's just re-open it? No, that flickers.
                // We can traverse up to find the container and re-render manually?
                // The `open` function defined `renderTypesList`.
                // Let's rely on the user closing/reopening or `store` updates?
                // Actually, `store.saveAllTypes` calls `renderSidebar`.
                // Does it refresh the modal? No.
                // Hack: Close and Reopen immediately?
                const modal = document.querySelector('.modal-wrapper:last-child');
                if (modal) modal.remove();
                this.open(type.sectionId);
            }
        }, 100);
    }
};
