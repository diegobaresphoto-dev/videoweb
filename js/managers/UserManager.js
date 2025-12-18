import { store } from '../state.js';
import { Modal } from '../ui/Modal.js';

export const UserManager = {
    // Current User Session
    currentUser: null,

    init() {
        // Ensure Users Array exists in Store (if not loaded yet, will be checked after load)
        if (!store.data.users) {
            store.data.users = [];
        }

        // Ensure default Admin exists if no users at all
        // We'll do this check after store.load() in app.js or here if we can await?
        // Let's expect app.js to call UserManager.ensureDefaults() after load.
    },

    async ensureDefaults() {
        // Use DataAdapter via store actions ideally, but we need new actions for users.
        // Let's assume store has been patched to handle 'users'.

        if (!store.data.users || store.data.users.length === 0) {
            console.log('UserManager: No users found. Creating default admin.');
            const admin = {
                id: 'user_admin',
                username: 'admin',
                password: '123', // Default simple password
                role: 'admin',
                name: 'Administrador',
                allowedCollectionIds: []
            };
            await store.saveUser(admin);
        }
    },

    login(username, password) {
        const user = store.data.users.find(u => u.username === username && u.password === password);
        if (user) {
            this.currentUser = user;
            // Persist session? For local app, maybe not strict, but nice.
            // Let's use sessionStorage for simple session per run.
            sessionStorage.setItem('current_user_id', user.id);
            return true;
        }
        return false;
    },

    logout() {
        this.currentUser = null;
        sessionStorage.removeItem('current_user_id');
        location.reload(); // Simple way to reset state/UI
    },

    restoreSession() {
        const id = sessionStorage.getItem('current_user_id');
        if (id) {
            const user = store.data.users.find(u => u.id === id);
            if (user) this.currentUser = user;
        }
        return this.currentUser;
    },

    requireLogin(onSuccess) {
        this._showLoginUI(true, onSuccess);
    },

    promptLogin(onSuccess) {
        this._showLoginUI(false, onSuccess);
    },

    _showLoginUI(force, onSuccess) {
        Modal.show({
            title: 'Iniciar Sesión',
            saveLabel: 'Entrar',
            showCancel: !force, // Hide cancel if force
            renderContent: (container) => {
                container.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:1rem; padding:1rem;">
                        <div>
                            <label style="display:block; margin-bottom:0.5rem;">Usuario</label>
                            <input type="text" id="login-user" style="width:100%; padding:0.5rem; background:var(--bg-input); border:1px solid var(--border); color:var(--text-main);">
                        </div>
                        <div>
                            <label style="display:block; margin-bottom:0.5rem;">Contraseña</label>
                            <input type="password" id="login-pass" style="width:100%; padding:0.5rem; background:var(--bg-input); border:1px solid var(--border); color:var(--text-main);">
                        </div>
                        <div id="login-error" style="color:#ff4444; font-size:0.9rem; min-height:1.2em;"></div>
                    </div>
                `;

                // Focus
                setTimeout(() => container.querySelector('#login-user').focus(), 100);

                // Enter key support
                container.onkeydown = (e) => {
                    if (e.key === 'Enter') {
                        const btn = document.querySelector('.modal-wrapper.active .btn-primary');
                        if (btn) btn.click();
                    }
                };
            },
            onSave: async () => {
                const u = document.querySelector('#login-user').value;
                const p = document.querySelector('#login-pass').value;

                if (this.login(u, p)) {
                    if (onSuccess) onSuccess();
                    return true; // Close valid
                } else {
                    document.querySelector('#login-error').innerText = 'Usuario o contraseña incorrectos.';
                    return false; // Keep open
                }
            }
        });

        // Extra safety for forced login (remove X button)
        if (force) {
            setTimeout(() => {
                const xBtn = document.querySelector('.modal-wrapper.active .close-x');
                if (xBtn) xBtn.remove();
            }, 50);
        }
    },

    // --- Permissions ---

    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    },

    canViewCollection(colId) {
        if (!this.currentUser) return false;
        if (this.currentUser.role === 'admin') return true;
        return (this.currentUser.allowedCollectionIds || []).includes(colId);
    },

    canEdit() {
        return this.isAdmin(); // Only Access to Create/Edit/Delete
    },

    // --- CRUD UI for Admin ---
    openManagement() {
        if (!this.isAdmin()) return;

        Modal.show({
            title: 'Gestión de Usuarios',
            saveLabel: 'Cerrar',
            showCancel: false,
            renderContent: (container) => {
                this._renderUserList(container);
            },
            onSave: () => true
        });
    },

    _renderUserList(container) {
        container.innerHTML = '';

        const tools = document.createElement('div');
        tools.style.marginBottom = '1rem';
        tools.innerHTML = `<button class="btn btn-primary btn-sm">+ Nuevo Usuario</button>`;
        tools.querySelector('button').onclick = () => this._editUser(null, () => this._renderUserList(container));
        container.appendChild(tools);

        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '0.5rem';

        store.data.users.forEach(user => {
            const row = document.createElement('div');
            row.style.background = 'var(--bg-card)';
            row.style.padding = '0.75rem';
            row.style.borderRadius = '6px';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.border = '1px solid var(--border)';

            row.innerHTML = `
                <div>
                    <div style="font-weight:bold;">${user.username} <span style="font-weight:normal; opacity:0.7;">(${user.role})</span></div>
                    <div style="font-size:0.8rem; color:var(--text-secondary);">${user.name}</div>
                </div>
                <div class="actions" style="display:flex; gap:0.5rem;">
                    <button class="btn-edit btn-ghost btn-xs">✏️</button>
                    ${user.username !== 'admin' ? '<button class="btn-del btn-ghost btn-xs" style="color:var(--accent);">🗑️</button>' : ''}
                </div>
            `;

            row.querySelector('.btn-edit').onclick = () => this._editUser(user, () => this._renderUserList(container));
            if (user.username !== 'admin') {
                row.querySelector('.btn-del').onclick = () => {
                    Modal.confirm({
                        title: 'Borrar Usuario',
                        message: `¿Estás seguro de que quieres borrar al usuario ${user.username}?`,
                        isDanger: true,
                        confirmLabel: 'Borrar',
                        onConfirm: async () => {
                            await store.deleteUser(user.id);
                            this._renderUserList(container);
                        }
                    });
                };
            }

            list.appendChild(row);
        });

        container.appendChild(list);
    },

    _editUser(user, onDone) {
        const isNew = !user;
        const draft = user ? JSON.parse(JSON.stringify(user)) : {
            id: 'user_' + Date.now(),
            username: '',
            email: '',
            password: '',
            role: 'user',
            name: '',
            allowedCollectionIds: []
        };

        Modal.show({
            title: isNew ? 'NUEVO USUARIO' : `EDITAR USUARIO: ${draft.username.toUpperCase()}`,
            saveLabel: isNew ? 'ALTA' : 'GUARDAR CAMBIOS',
            renderContent: (c) => {
                // Style injection for this specific modal to match the screenshot
                const style = `
                    <style>
                        .reg-label { display:block; font-size:0.7rem; color: var(--text-secondary); margin-bottom:0.3rem; text-transform:uppercase; letter-spacing:0.05em; }
                        .reg-input { width:100%; padding:0.8rem; background: var(--bg-input); border:1px solid var(--border); color:var(--text-main); border-radius:4px; font-size:0.95rem; }
                        .reg-input:focus { border-color: var(--primary); outline:none; background: var(--bg-main); }
                        .reg-link { color: var(--primary); text-decoration: none; font-size:0.85rem; display:block; margin-bottom:0.5rem; cursor:pointer; }
                        .reg-link:hover { text-decoration: underline; }
                        .legal-check { display:flex; align-items:flex-start; gap:0.8rem; background:rgba(0,0,0,0.05); padding:1rem; border-radius:4px; margin-top:1rem; }
                        .warning-text { font-size:0.75rem; color:var(--text-secondary); margin: 1rem 0; line-height:1.4; }
                    </style>
                `;

                c.innerHTML = style + `
                    <div class="user-form" style="display:flex; flex-direction:column; gap:0.8rem; max-width:400px; margin:0 auto;">
                        
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                            <!-- NICK -->
                            <div>
                                <label class="reg-label">Nick</label>
                                <input type="text" id="u-user" class="reg-input" value="${draft.username}" ${!isNew ? 'disabled' : ''}>
                            </div>

                            <!-- EMAIL -->
                            <div>
                                <label class="reg-label">Email</label>
                                <input type="email" id="u-email" class="reg-input" value="${draft.email || ''}">
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                            <!-- PASSWORD -->
                            <div>
                                <label class="reg-label">Contraseña</label>
                                <input type="password" id="u-pass" class="reg-input" value="${draft.password}">
                            </div>

                            <!-- REPEAT PASSWORD -->
                            <div>
                                <label class="reg-label">Repite Contraseña</label>
                                <input type="password" id="u-pass-confirm" class="reg-input" value="${draft.password}">
                            </div>
                        </div>

                        <div class="legal-check">
                            <input type="checkbox" id="chk-legal" checked style="margin-top:0.2rem; transform:scale(1.2);">
                            <label for="chk-legal" style="font-size:0.8rem; color:#d1d5db; cursor:pointer;">
                                He leído y acepto cond. uso y privacidad.
                            </label>
                        </div>
                        
                        <!-- ADMIN CONTROLS: ROLE & PERMISSIONS -->
                        <!-- If current user is Admin, show these always, even for New User -->
                        ${this.isAdmin() ? `
                        <div style="margin-top:1rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.1);">
                             <label class="reg-label" style="color:#60a5fa; margin-bottom:0.5rem;">OPCIONES DE ADMINISTRADOR</label>
                             
                             <div style="margin-bottom:1rem;">
                                 <label class="reg-label">Rol</label>
                                 <select id="u-role" class="reg-input">
                                    <option value="user" ${draft.role === 'user' ? 'selected' : ''}>Usuario (Lector)</option>
                                    <option value="admin" ${draft.role === 'admin' ? 'selected' : ''}>Administrador (Total)</option>
                                 </select>
                             </div>

                             <div id="u-perms-box" style="display:${draft.role === 'admin' ? 'none' : 'block'};">
                                <label class="reg-label">Colecciones Permitidas</label>
                                <div class="chk-list" style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; background:rgba(0,0,0,0.2); padding:0.5rem; border-radius:4px;">
                                    ${store.data.collections.map(col => `
                                        <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:#e2e8f0; cursor:pointer;">
                                            <input type="checkbox" value="${col.id}" ${draft.allowedCollectionIds.includes(col.id) ? 'checked' : ''} style="transform:scale(1.1);">
                                            ${col.name}
                                        </label>
                                    `).join('')}
                                </div>
                             </div>
                        </div>` : ''}
                        
                        <!-- Hidden inputs if not Admin (defaults) -->
                        ${!this.isAdmin() ? `
                            <input type="hidden" id="u-role" value="user">
                            <div class="warning-text">Validaremos tu email...</div>
                        ` : ''}

                        <input type="hidden" id="u-name" value="${draft.name}">
                    </div>
                `;

                // Handle Role Change logic for Admin view
                const roleSel = c.querySelector('#u-role');
                if (roleSel) {
                    roleSel.onchange = (e) => {
                        const isAdm = e.target.value === 'admin';
                        const pBox = c.querySelector('#u-perms-box');
                        if (pBox) pBox.style.display = isAdm ? 'none' : 'block';
                    };
                }
            },
            onSave: async () => {
                const root = document.querySelector('.modal-wrapper:last-child');

                const username = root.querySelector('#u-user').value.trim();
                const email = root.querySelector('#u-email').value.trim();
                const pass = root.querySelector('#u-pass').value;
                const passConfirm = root.querySelector('#u-pass-confirm').value;
                const legalCheck = root.querySelector('#chk-legal');

                // Admin Controls
                const roleInput = root.querySelector('#u-role');
                const role = roleInput ? roleInput.value : 'user';

                if (!username) return alert('El Nick es obligatorio.');
                if (!email) return alert('El Email es obligatorio.');
                if (!pass) return alert('La contraseña es obligatoria.');
                if (pass !== passConfirm) return alert('Las contraseñas no coinciden.');
                if (legalCheck && !legalCheck.checked) return alert('Debes aceptar las condiciones de uso.');

                draft.username = username;
                draft.email = email;
                draft.password = pass;
                draft.name = username;
                draft.role = role;

                if (draft.role === 'user') {
                    const chks = root.querySelectorAll('.chk-list input:checked');
                    // If Admin is creating, use checks. If generic signup (future), use default []
                    if (chks.length > 0) {
                        draft.allowedCollectionIds = Array.from(chks).map(c => c.value);
                    } else if (this.isAdmin()) {
                        draft.allowedCollectionIds = []; // Explicitly empty if admin unchecked all
                    }
                } else {
                    // If role is admin, clear allowedCollectionIds as they have full access
                    draft.allowedCollectionIds = [];
                }

                await store.saveUser(draft);
                if (onDone) onDone();
                return true;
            }
        });
    }
};
