import { Modal } from '../ui/Modal.js';
import { store } from '../state.js';
import { UserManager } from './UserManager.js';

export const SettingsManager = {
    async open() {
        if (!UserManager.isAdmin()) {
            return alert('Acceso denegado: Solo administradores pueden cambiar la configuración.');
        }

        // Config is loaded in store or fallback to empty
        const config = store.data.config || {};

        Modal.show({
            title: 'Configuración del Sistema',
            saveLabel: 'Guardar Todo',
            renderContent: (container) => {
                container.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:1.5rem; max-height:70vh; overflow-y:auto; padding-right:0.5rem;">
                        
                        <!-- SECTION: GENERAL -->
                        <div class="settings-section">
                            <h4 style="color:var(--primary); border-bottom:1px solid var(--border); padding-bottom:0.5rem; margin-bottom:1rem;">
                                🎨 Personalización
                            </h4>
                            
                            <!-- App Name -->
                            <div style="margin-bottom:1rem;">
                                <label style="display:block; color:var(--text-secondary); margin-bottom:0.4rem; font-size:0.9rem;">Nombre de la Aplicación</label>
                                <input type="text" id="cfg-name" value="${config.appName || 'Inventario'}" 
                                    style="width:100%; padding:0.6rem; background:var(--bg-input); border:1px solid var(--border); border-radius:4px; color:white;">
                            </div>

                            <!-- Logo -->
                            <div>
                                <label style="display:block; color:var(--text-secondary); margin-bottom:0.4rem; font-size:0.9rem;">Logotipo</label>
                                <div style="display:flex; gap:1rem; align-items:flex-start;">
                                    <div id="logo-preview" style="width:48px; height:48px; min-width:48px; background:var(--bg-card); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; border-radius:6px; font-size:1.5rem; overflow:hidden;">
                                        ${this.renderPreview(config.appLogo)}
                                    </div>
                                    <div style="flex:1;">
                                        <input type="text" id="cfg-logo" value="${config.appLogo || '🔷'}" placeholder="Emoji, Texto, URL o Ruta de archivo..."
                                            style="width:100%; padding:0.6rem; background:var(--bg-input); border:1px solid var(--border); border-radius:4px; color:white; font-family:monospace; font-size:0.9rem; margin-bottom:0.5rem;">
                                        
                                        <div style="display:flex; gap:0.5rem;">
                                            <label class="btn btn-secondary btn-xs" style="cursor:pointer; display:inline-flex; align-items:center;">
                                                📂 Cargar Imagen...
                                                <input type="file" id="file-logo" accept="image/*" style="display:none;">
                                            </label>
                                            <div style="font-size:0.75rem; color:var(--text-secondary); padding-top:4px;">
                                                (Se guardará como Base64)
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- SECTION: AI KEYS -->
                        <div class="settings-section">
                            <h4 style="color:#a78bfa; border-bottom:1px solid var(--border); padding-bottom:0.5rem; margin-bottom:1rem; margin-top:0.5rem;">
                                🤖 Inteligencia Artificial (Opcional)
                            </h4>
                            <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1rem;">
                                Claves para mejorar el reconocimiento de códigos de barras cuando fallan las bases de datos públicas.
                            </p>

                            <!-- Gemini -->
                            <div style="margin-bottom:1rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                                    <label style="font-size:0.9rem; font-weight:bold; color:#4ade80;">Google Gemini API Key</label>
                                    <a href="https://aistudio.google.com/app/apikey" target="_blank" style="font-size:0.75rem; color:var(--primary); text-decoration:none;">Obtener Gratis ↗</a>
                                </div>
                                <input type="password" id="key-gemini" value="${config.geminiApiKey || ''}" placeholder="AIza..." 
                                    style="width:100%; padding:0.6rem; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:white; font-family:monospace;">
                            </div>

                            <!-- OpenAI -->
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
                                    <label style="font-size:0.9rem; font-weight:bold; color:#60a5fa;">OpenAI API Key</label>
                                    <a href="https://platform.openai.com/api-keys" target="_blank" style="font-size:0.75rem; color:var(--primary); text-decoration:none;">Obtener Key ↗</a>
                                </div>
                                <input type="password" id="key-openai" value="${config.openaiApiKey || ''}" placeholder="sk-..." 
                                    style="width:100%; padding:0.6rem; background:rgba(0,0,0,0.3); border:1px solid var(--border); color:white; font-family:monospace;">
                            </div>
                        </div>

                    </div>
                `;

                // Logic
                const inputLogo = container.querySelector('#cfg-logo');
                const fileLogo = container.querySelector('#file-logo');
                const preview = container.querySelector('#logo-preview');

                const updatePreview = () => {
                    preview.innerHTML = this.renderPreview(inputLogo.value);
                };

                inputLogo.oninput = updatePreview;

                if (window.api) {
                    fileLogo.onchange = (e) => {
                        if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                                inputLogo.value = evt.target.result; // Base64
                                updatePreview();
                            };
                            reader.readAsDataURL(file);
                        }
                    };
                }
            },
            onSave: async () => {
                const newConfig = { ...config };

                // General
                newConfig.appName = document.getElementById('cfg-name').value.trim() || 'Inventario';
                newConfig.appLogo = document.getElementById('cfg-logo').value.trim() || '🔷';

                // AI
                newConfig.geminiApiKey = document.getElementById('key-gemini').value.trim();
                newConfig.openaiApiKey = document.getElementById('key-openai').value.trim();

                await store.saveConfig(newConfig);

                if (confirm('Configuración guardada. ¿Reiniciar ahora para aplicar todos los cambios visuales?')) {
                    location.reload();
                }
                return true;
            }
        });
    },

    renderPreview(val) {
        if (!val) return '?';
        const isImage = val.includes('/') || val.includes('\\') || val.startsWith('data:') || val.startsWith('http');
        if (isImage) {
            return `<img src="${val}" style="width:100%; height:100%; object-fit:contain;">`;
        }
        return `<span>${val}</span>`;
    },

    // Legacy alias if needed
    openSettings() { this.open(); }
};
