import { Modal } from './Modal.js';

export const IconPicker = {
    show({ onSelect }) {
        const categories = {
            'General': ['📂', '📁', '📦', '🏷️', '🔖', '⭐', '🌟', '🔥', '💎', '⚙️', '🔧', '📅', '📝', '📌', '🛒', '🎁'],
            'Gaming': ['🎮', '🕹️', '🎲', '👾', '🎰', '🏎️', '🔫', '🛡️', '🗡️', '🏹', '🏰', '👑', '🧙', '🐉', '💀', '❤️', '🍄'],
            'Tech': ['💻', '🖥️', '⌨️', '🖱️', '📱', '💾', '🔋', '🔌', '📷', '📹', '💿', '📀', '📼', '🕹', '📼'],
            'Media': ['📚', '📕', '📰', '🎬', '🎵', '🖼️', '📺', '📻', '🎙️', '🎺', '🎸', '🎹', '🎷', '🎭', '🎨'],
            'Misc': ['🧸', '🏆', '⚽', '🏀', '🏎️', '🚀', '🛸', '🗿', '🌍', '🏠', '🔑', '🗝️', '💡', '🔦', '🕶️']
        };

        Modal.show({
            title: 'Biblioteca de Iconos',
            saveLabel: 'Cancelar',
            renderContent: (container) => {
                container.style.maxHeight = '60vh';
                container.style.overflowY = 'auto';

                // Render Categories
                Object.keys(categories).forEach(catName => {
                    const section = document.createElement('div');
                    section.style.marginBottom = '1.5rem';

                    const header = document.createElement('h4');
                    header.innerText = catName;
                    header.style.marginBottom = '0.5rem';
                    header.style.color = 'var(--primary)';
                    header.style.borderBottom = '1px solid var(--border)';
                    header.style.paddingBottom = '0.25rem';
                    section.appendChild(header);

                    const grid = document.createElement('div');
                    grid.style.display = 'grid';
                    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(40px, 1fr))';
                    grid.style.gap = '0.5rem';

                    categories[catName].forEach(icon => {
                        const btn = document.createElement('button');
                        btn.innerText = icon;
                        btn.style.fontSize = '1.5rem';
                        btn.style.padding = '0.5rem';
                        btn.style.background = 'var(--bg-main)';
                        btn.style.border = '1px solid var(--border)';
                        btn.style.borderRadius = '4px';
                        btn.style.cursor = 'pointer';
                        btn.style.transition = 'all 0.2s';

                        btn.onmouseenter = () => {
                            btn.style.borderColor = 'var(--primary)';
                            btn.style.background = 'var(--bg-card)';
                            btn.style.transform = 'scale(1.1)';
                        };
                        btn.onmouseleave = () => {
                            btn.style.borderColor = 'var(--border)';
                            btn.style.background = 'var(--bg-main)';
                            btn.style.transform = 'scale(1)';
                        };

                        btn.onclick = () => {
                            onSelect(icon);
                            // Close picker
                            const modal = btn.closest('.modal-wrapper');
                            if (modal) modal.remove();
                        };

                        grid.appendChild(btn);
                    });

                    section.appendChild(grid);
                    container.appendChild(section);
                });
            },
            onSave: () => true // Close on cancel
        });
    }
};
