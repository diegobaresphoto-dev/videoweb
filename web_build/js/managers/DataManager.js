import { store } from '../state.js';
import { Modal } from '../ui/Modal.js';

// --- CSV PARSER (Legacy Port) ---
class CsvImporter {
    static parse(text) {
        if (!text) return [];
        const sampleLine = text.split('\n')[0];
        const delimiter = sampleLine.includes(';') ? ';' : ',';
        const rows = [];
        let currentRow = [];
        let curField = '';
        let insideQuote = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i + 1];
            if (char === '"') {
                if (insideQuote && nextChar === '"') { curField += '"'; i++; }
                else { insideQuote = !insideQuote; }
            } else if (char === delimiter && !insideQuote) {
                currentRow.push(curField.trim());
                curField = '';
            } else if ((char === '\n' || char === '\r') && !insideQuote) {
                if (curField || currentRow.length > 0) currentRow.push(curField.trim());
                if (currentRow.length > 0) rows.push(currentRow);
                currentRow = [];
                curField = '';
                if (char === '\r' && nextChar === '\n') i++;
            } else { curField += char; }
        }
        if (curField || currentRow.length > 0) {
            currentRow.push(curField.trim());
            rows.push(currentRow);
        }
        return rows;
    }
}

export const DataManager = {
    open() {
        Modal.show({
            title: 'Gestión de Datos',
            saveLabel: 'Cerrar',
            renderContent: (container) => {
                const now = new Date().toISOString().split('T')[0];
                container.innerHTML = `
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:2rem;">
                        <!-- BACKUP SECTION -->
                        <div style="background:var(--bg-main); padding:1rem; border-radius:8px; border:1px solid var(--border);">
                            <h3 style="margin-top:0;">💾 Copia de Seguridad</h3>
                            <p style="color:var(--text-secondary); font-size:0.9rem;">
                                Guarda toda tu colección (configuración, secciones, imágenes) en un solo archivo.
                            </p>
                            <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:1rem;">
                                <button id="btn-backup-export" class="btn" style="width:100%;">Descargar Copia (.json)</button>
                                <button id="btn-backup-import" class="btn btn-ghost" style="width:100%; color:var(--accent);">Restaurar Copia</button>
                                <input type="file" id="file-backup-import" accept=".json" style="display:none;">
                            </div>
                        </div>

                        <!-- CSV SECTION -->
                        <div style="background:var(--bg-main); padding:1rem; border-radius:8px; border:1px solid var(--border);">
                            <h3 style="margin-top:0;">📊 Excel / CSV</h3>
                            <p style="color:var(--text-secondary); font-size:0.9rem;">
                                Importa listas de artículos desde Excel o expórtalos para verlos en una tabla.
                            </p>
                            <div style="display:flex; flex-direction:column; gap:0.5rem; margin-top:1rem;">
                                <button id="btn-csv-import" class="btn" style="width:100%; background:#2f855a;">Importar desde CSV</button>
                                <!--<button id="btn-csv-export" class="btn btn-ghost" style="width:100%;">Exportar a CSV</button>-->
                                <input type="file" id="file-csv-import" accept=".csv,.txt" style="display:none;">
                            </div>
                        </div>
                    </div>
                `;

                // HANDLERS

                // 1. Export Backup
                container.querySelector('#btn-backup-export').onclick = () => {
                    const dataStr = JSON.stringify(store.data, null, 2);
                    const blob = new Blob([dataStr], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `backup_coleccion_${now}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                };

                // 2. Import Backup
                const fileInput = container.querySelector('#file-backup-import');
                container.querySelector('#btn-backup-import').onclick = () => fileInput.click();
                fileInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    if (!confirm('⚠️ PELIGRO ⚠️\n\nVas a sobrescribir TODA tu colección actual con los datos de este archivo.\nEsta acción no se puede deshacer.\n\n¿Estás seguro?')) return;

                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                        try {
                            const json = JSON.parse(evt.target.result);
                            await store.loadFullData(json);
                            alert('Datos restaurados correctamente. La aplicación se recargará.');
                            location.reload();
                        } catch (err) {
                            alert('Error al leer el archivo: ' + err.message);
                        }
                    };
                    reader.readAsText(file);
                };

                // 3. CSV Import Wizard
                const csvInput = container.querySelector('#file-csv-import');
                container.querySelector('#btn-csv-import').onclick = () => csvInput.click();
                csvInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            this.openCsvWizard(file.name, evt.target.result);
                        };
                        reader.readAsText(file);
                    }
                };
            },
            onSave: () => true
        });
    },

    openCsvWizard(filename, csvContent) {
        // Step 1: Select Target Type
        const rows = CsvImporter.parse(csvContent);
        if (rows.length < 2) return alert('El archivo CSV parece vacío o sin cabeceras.');

        const headers = rows[0];
        const sampleRow = rows[1];

        Modal.show({
            title: 'Importar CSV: ' + filename,
            saveLabel: 'Importar',
            renderContent: (container) => {
                container.innerHTML = `
                    <div style="margin-bottom:1rem; padding:1rem; background:var(--bg-main); border-radius:8px;">
                        <label style="display:block; margin-bottom:0.5rem;">1. ¿Qué tipo de artículos estás importando?</label>
                        <select id="import-target-type" style="width:100%; padding:0.5rem; font-size:1rem;">
                            ${store.data.itemTypes.map(t => `<option value="${t.id}">${t.icon || '📦'} ${t.name} (en ${(store.data.sections.find(s => s.id === t.sectionId) || {}).name})</option>`).join('')}
                        </select>
                    </div>

                    <h3>2. Mapear Columnas</h3>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                            <thead>
                                <tr style="background:var(--bg-card); color:var(--text-secondary);">
                                    <th style="padding:0.5rem; text-align:left;">CSV Columna</th>
                                    <th style="padding:0.5rem; text-align:left;">Ejemplo Valor</th>
                                    <th style="padding:0.5rem; text-align:left;">⮕ Campo Destino</th>
                                </tr>
                            </thead>
                            <tbody id="mapping-body"></tbody>
                        </table>
                    </div>
                `;

                const tbody = container.querySelector('#mapping-body');
                const typeSelect = container.querySelector('#import-target-type');

                const renderMapping = () => {
                    tbody.innerHTML = '';
                    const targetType = store.data.itemTypes.find(t => t.id === typeSelect.value);
                    if (!targetType) return;

                    // Standard Fields + Custom Fields
                    const availableFields = [
                        { key: 'SKIP', label: '-- Ignorar --' },
                        { key: 'name', label: 'Nombre Principal (*)' } // "nombre" or "name" depending on schema. Standardize on 'name' key for saveItem logic? Actually saveItem checks both.
                    ];

                    // Add dynamic fields
                    targetType.fields.forEach(fRef => {
                        const def = store.data.fieldDefinitions.find(d => d.id === fRef.fieldId);
                        if (def) availableFields.push({ key: def.id, label: def.label });
                    });

                    headers.forEach((header, idx) => {
                        const tr = document.createElement('tr');
                        tr.style.borderBottom = '1px solid var(--border)';

                        // Auto-Match Logic
                        const hLow = header.toLowerCase();
                        let selectedKey = 'SKIP';

                        if (hLow.includes('nombre') || hLow.includes('titulo') || hLow.includes('title')) selectedKey = 'name';
                        else {
                            // Try fuzzy match
                            const match = availableFields.find(f => hLow === f.label.toLowerCase() || hLow.includes(f.label.toLowerCase()));
                            if (match) selectedKey = match.key;
                        }

                        const options = availableFields.map(f =>
                            `<option value="${f.key}" ${f.key === selectedKey ? 'selected' : ''}>${f.label}</option>`
                        ).join('');

                        tr.innerHTML = `
                            <td style="padding:0.5rem; font-weight:bold;">${header}</td>
                            <td style="padding:0.5rem; color:var(--text-secondary);">${(sampleRow[idx] || '').substring(0, 30)}...</td>
                            <td style="padding:0.5rem;">
                                <select class="map-column" data-col-idx="${idx}" style="width:100%; padding:0.25rem;">${options}</select>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                };

                typeSelect.onchange = renderMapping;
                renderMapping(); // Initial
            },
            onSave: async () => {
                const typeId = document.querySelector('#import-target-type').value;
                const mappingSelects = document.querySelectorAll('.map-column');
                const mapping = {}; // fieldKey -> csvColIdx

                mappingSelects.forEach(sel => {
                    const fieldKey = sel.value;
                    if (fieldKey !== 'SKIP') {
                        mapping[fieldKey] = parseInt(sel.dataset.colIdx);
                    }
                });

                if (mapping['name'] === undefined) {
                    alert('Error: Debes asignar la columna "Nombre Principal" obligatoriamente.');
                    return false;
                }

                // 2. Prepare Data & Detect Duplicates
                const rowsToProcess = rows.slice(1).filter(r => r.length > 0);
                const existingItems = store.data.items.filter(i => i.typeId === typeId);
                const duplicates = [];
                const newItems = [];

                rowsToProcess.forEach((row, idx) => {
                    // Extract Name for check
                    const nameColIdx = mapping['name'];
                    const rowName = (row[nameColIdx] || '').trim();

                    if (!rowName) return; // Skip empty names

                    const existing = existingItems.find(i => (i.data.nombre || i.data.name || '').toLowerCase() === rowName.toLowerCase());

                    const importObj = { row, rowIdx: idx + 1, name: rowName };

                    if (existing) {
                        duplicates.push({ ...importObj, existingId: existing.id });
                    } else {
                        newItems.push(importObj);
                    }
                });

                // 3. Execution Helper
                const executeImport = async (strategy) => {
                    // strategy: 'skip', 'overwrite', 'keep' (default for newItems is always create)
                    let created = 0;
                    let updated = 0;
                    let skipped = 0;

                    // Helper to map row to draft
                    const createDraft = (row, existingId = null, nameSuffix = '') => {
                        const draft = {
                            id: existingId || ('item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
                            typeId: typeId,
                            sectionId: store.data.itemTypes.find(t => t.id === typeId).sectionId,
                            createdAt: existingId ? undefined : new Date().toISOString(),
                            data: {},
                            images: {}
                        };

                        let baseData = {};
                        if (existingId) {
                            const oldItem = existingItems.find(i => i.id === existingId);
                            if (oldItem) {
                                baseData = JSON.parse(JSON.stringify(oldItem.data));
                                draft.createdAt = oldItem.createdAt;
                                draft.images = oldItem.images;
                                draft.gallery = oldItem.gallery;
                            }
                        }

                        draft.data = baseData;

                        Object.keys(mapping).forEach(fieldKey => {
                            const colIdx = mapping[fieldKey];
                            let val = row[colIdx] || '';
                            val = val.trim();

                            if (fieldKey === 'name') {
                                let finalName = val + nameSuffix;
                                draft.data.name = finalName;
                                draft.data.nombre = finalName;
                            } else {
                                draft.data[fieldKey] = val;
                            }
                        });
                        return draft;
                    };

                    try {
                        // A. Process Non-Duplicates (Always Import)
                        for (const item of newItems) {
                            const draft = createDraft(item.row);
                            await store.saveItem(draft);
                            created++;
                        }

                        // B. Process Duplicates based on Strategy
                        if (duplicates.length > 0) {
                            if (strategy === 'skip') {
                                skipped = duplicates.length;
                            } else if (strategy === 'overwrite') {
                                for (const item of duplicates) {
                                    const draft = createDraft(item.row, item.existingId); // Pass ID to overwrite
                                    await store.saveItem(draft);
                                    updated++;
                                }
                            } else if (strategy === 'keep') {
                                // Import as new with suffix
                                for (const item of duplicates) {
                                    const draft = createDraft(item.row, null, ' IMPORTADO');
                                    await store.saveItem(draft);
                                    created++;
                                }
                            }
                        }

                        store.notify();
                        alert(`Proceso finalizado:\n- Creados: ${created}\n- Actualizados: ${updated}\n- Omitidos: ${skipped}`);
                        return true;

                    } catch (e) {
                        alert('Error importando: ' + e.message);
                        console.error(e);
                        return false;
                    }
                };

                // 4. Decision Flow
                if (duplicates.length > 0) {
                    // Show Decision Modal
                    Modal.show({
                        title: '⚠️ Conflictos Detectados',
                        saveLabel: null,
                        renderContent: (c) => {
                            c.innerHTML = `
                                <div style="margin-bottom:1.5rem;">
                                    <p>Se han encontrado <strong>${duplicates.length}</strong> artículos que ya existen en la base de datos (por nombre).</p>
                                    <p style="color:var(--text-secondary); font-size:0.9rem;">
                                        Ejemplos: ${duplicates.slice(0, 3).map(d => d.name).join(', ')}...
                                    </p>
                                </div>
                                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                                    <button class="btn" id="btn-skip-dups" style="background:var(--bg-card); border:1px solid var(--border); text-align:left; padding:1rem;">
                                        <strong>1. No importar repetidos</strong><br>
                                        <span style="font-size:0.8rem; color:var(--text-secondary);">Ignora los artículos que ya existen. Solo importa los nuevos.</span>
                                    </button>
                                    <button class="btn" id="btn-overwrite-dups" style="background:var(--bg-card); border:1px solid var(--border); text-align:left; padding:1rem;">
                                        <strong>2. Sobreescribir registros existentes</strong><br>
                                        <span style="font-size:0.8rem; color:var(--text-secondary);">Actualiza los datos de los artículos existentes con la información del CSV.</span>
                                    </button>
                                    <button class="btn" id="btn-keep-dups" style="background:var(--bg-card); border:1px solid var(--border); text-align:left; padding:1rem;">
                                        <strong>3. Importar y mantener ambos</strong><br>
                                        <span style="font-size:0.8rem; color:var(--text-secondary);">Crea copias de los repetidos añadiendo "IMPORTADO" al nombre.</span>
                                    </button>
                                </div>
                            `;

                            c.querySelector('#btn-skip-dups').onclick = async () => {
                                await executeImport('skip');
                                document.querySelector('.modal-overlay')?.remove();
                            };
                            c.querySelector('#btn-overwrite-dups').onclick = async () => {
                                await executeImport('overwrite');
                                document.querySelector('.modal-overlay')?.remove();
                            };
                            c.querySelector('#btn-keep-dups').onclick = async () => {
                                await executeImport('keep');
                                document.querySelector('.modal-overlay')?.remove();
                            };
                        },
                        onSave: () => true
                    });

                    return true;
                } else {
                    return await executeImport('create');
                }
            }
        });
    }
};
