// Simple Modal Manager

export const Modal = {
    show({ title, renderContent, onSave, saveLabel = 'Guardar', showCancel = true }) {
        const container = document.getElementById('modal-container');
        container.classList.add('active'); // Ensure main overlay is active

        // Create a wrapper for THIS specific modal instance
        const wrapper = document.createElement('div');
        wrapper.className = 'modal-wrapper'; // New class for stacking
        wrapper.style.position = 'absolute';
        wrapper.style.top = '0';
        wrapper.style.left = '0';
        wrapper.style.right = '0';
        wrapper.style.bottom = '0';
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'center';
        wrapper.style.background = 'rgba(0,0,0,0.5)'; // Dim background for focus
        wrapper.style.zIndex = 1000 + container.children.length; // Stack order

        const content = document.createElement('div');
        content.className = 'modal-content';
        // Use CSS class for background ($1e293b opaque)
        // content.style.background = 'var(--bg-card)'; 
        content.style.minWidth = '500px';

        // Header
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `<h3>${title}</h3><button class="btn-ghost close-x">✕</button>`;
        content.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'modal-body';
        renderContent(body);
        content.appendChild(body);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'modal-footer';

        let buttonsHtml = '';
        if (showCancel) {
            buttonsHtml += `<button class="btn btn-ghost btn-cancel">Cancelar</button>`;
        }
        buttonsHtml += `<button class="btn btn-primary btn-save">${saveLabel}</button>`;

        footer.innerHTML = buttonsHtml;
        content.appendChild(footer);

        wrapper.appendChild(content);
        container.appendChild(wrapper);

        // --- Logic to Close THIS Modal ---
        const close = () => {
            wrapper.remove();
            if (container.children.length === 0) {
                container.classList.remove('active');
            }
        };

        wrapper.querySelector('.close-x').onclick = close;
        if (showCancel) {
            wrapper.querySelector('.btn-cancel').onclick = close;
        }

        // Explicitly clear old listeners if any (though wrapper is new)
        const saveBtn = wrapper.querySelector('.btn-save');

        saveBtn.addEventListener('click', async (e) => {
            console.log('Save Button Clicked!');
            // alert('DEBUG: Click Event Received!'); // Uncomment for extreme debugging

            const btn = e.target;
            const originalText = btn.innerText;
            btn.innerText = 'Guardando...';
            btn.disabled = true;
            btn.style.opacity = '0.7';

            try {
                if (onSave) {
                    const success = await onSave();
                    if (success !== false) {
                        close();
                    } else {
                        // Failed, reset
                        btn.innerText = originalText;
                        btn.disabled = false;
                        btn.style.opacity = '1';
                    }
                } else {
                    close();
                }
            } catch (err) {
                console.error('Modal Save Logic Error:', err);
                alert('Detailed Error: ' + err.message);
                btn.innerText = originalText;
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        });

        // Enter Key to Submit
        wrapper.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                // Allow multiline in Textareas
                if (e.target.tagName === 'TEXTAREA') return;

                e.preventDefault();
                e.stopPropagation();

                const saveBtn = wrapper.querySelector('.btn-save');
                if (saveBtn) saveBtn.click();
            }
        });

        // Auto-focus first input or save button
        setTimeout(() => {
            const firstInput = wrapper.querySelector('input, select, textarea');
            if (firstInput) {
                firstInput.focus();
            } else {
                const saveBtn = wrapper.querySelector('.btn-save');
                if (saveBtn) saveBtn.focus();
            }
        }, 100);
    },

    confirm({ title, message, onConfirm, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', isDanger = false }) {
        this.show({
            title: title || 'Confirmación',
            showCancel: true,
            saveLabel: confirmLabel,
            renderContent: (container) => {
                container.innerHTML = `
                    <div style="padding: 1.5rem; text-align: center;">
                        <p style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.5rem;">${message}</p>
                    </div>
                `;
                // Danger style for confirm button if needed
                if (isDanger) {
                    setTimeout(() => {
                        const btn = container.parentElement.querySelector('.btn-save');
                        if (btn) {
                            btn.style.background = '#ff4444';
                            btn.style.borderColor = '#cc0000';
                            btn.onmouseover = () => btn.style.background = '#cc0000';
                            btn.onmouseout = () => btn.style.background = '#ff4444';
                        }
                    }, 0);
                }
            },
            onSave: async () => {
                if (onConfirm) await onConfirm();
                return true;
            }
        });
    },

    close() {
        const container = document.getElementById('modal-container');
        const wrappers = container.querySelectorAll('.modal-wrapper');
        if (wrappers.length > 0) {
            wrappers[wrappers.length - 1].remove(); // Remove top-most
        }
        if (container.children.length === 0) {
            container.classList.remove('active');
        }
    }
};
