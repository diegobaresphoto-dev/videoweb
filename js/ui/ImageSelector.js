import { Modal } from './Modal.js';

export const ImageSelector = {
    show({ initialQuery = '', initialResults = [], onSearch, onSelect }) {
        Modal.show({
            title: 'Selector de Imágenes',
            saveLabel: 'Cerrar',
            onSave: () => true,
            renderContent: (container) => {
                // Toolbar
                const toolbar = document.createElement('div');
                toolbar.style.display = 'flex';
                toolbar.style.gap = '10px';
                toolbar.style.marginBottom = '1rem';
                toolbar.style.paddingBottom = '1rem';
                toolbar.style.borderBottom = '1px solid var(--border)';

                const input = document.createElement('input');
                input.type = 'text';
                input.value = initialQuery;
                input.placeholder = 'Buscar imagen...';
                input.style.flex = '1';
                input.style.padding = '0.5rem';
                // let CSS handle colors
                // input.style.background = 'var(--bg-main)';
                // input.style.border = '1px solid var(--border)';
                input.style.borderRadius = '4px';
                // input.style.color = 'white';

                const btnSearch = document.createElement('button');
                btnSearch.className = 'btn btn-primary';
                btnSearch.innerText = 'Buscar';

                toolbar.appendChild(input);
                toolbar.appendChild(btnSearch);
                container.appendChild(toolbar);

                // Grid Container
                const grid = document.createElement('div');
                grid.style.display = 'grid';
                grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
                grid.style.gap = '10px';
                grid.style.maxHeight = '60vh';
                grid.style.overflowY = 'auto';
                grid.style.padding = '10px';
                container.appendChild(grid);

                // Helper: Render Images
                const renderImages = (images) => {
                    grid.innerHTML = '';
                    if (!images || images.length === 0) {
                        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-secondary);">No se encontraron imágenes.</div>';
                        return;
                    }

                    images.forEach(img => {
                        const div = document.createElement('div');
                        div.style.cursor = 'pointer';
                        div.style.border = '2px solid transparent';
                        div.style.borderRadius = '4px';
                        div.style.overflow = 'hidden';
                        div.style.position = 'relative';
                        div.style.aspectRatio = '1';
                        // Hover effect class? Or inline
                        div.onmouseenter = () => div.style.borderColor = 'var(--primary)';
                        div.onmouseleave = () => div.style.borderColor = 'transparent';

                        const el = document.createElement('img');
                        el.src = img.url;
                        el.style.width = '100%';
                        el.style.height = '100%';
                        el.style.objectFit = 'cover';
                        el.style.background = '#000';

                        div.onclick = () => {
                            onSelect(img.url);
                            // Close modal via hack
                            const modal = div.closest('.modal-wrapper');
                            if (modal) modal.remove();
                        };

                        div.appendChild(el);
                        grid.appendChild(div);
                    });
                };

                // Search Logic
                const doSearch = async () => {
                    const query = input.value.trim();
                    if (!query) return;

                    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:2rem; color:var(--text-primary);">⏳ Buscando...</div>';

                    try {
                        const results = await onSearch(query);
                        renderImages(results);
                    } catch (e) {
                        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:red;">Error: ${e.message}</div>`;
                    }
                };

                btnSearch.onclick = doSearch;
                input.onkeydown = (e) => { if (e.key === 'Enter') doSearch(); };

                // Initial Render
                if (initialResults.length > 0) {
                    renderImages(initialResults);
                } else if (initialQuery) {
                    // Auto-search if query provided but no results
                    doSearch();
                }
            }
        });
    }
};
