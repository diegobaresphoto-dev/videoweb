// Simple Reactive Store

// Simple Reactive Store

const initialState = {
    collections: [], // 1. Root (Gaming)
    sections: [],    // 2. Logical Group (Hardware)
    itemTypes: [],   // 3. Schema Definition (Console)
    items: [],       // 4. Data (PS5)
    fieldDefinitions: [], // 5. Global Field Registry
    users: [],       // 6. User Accounts
    knownBarcodes: [], // 7. Barcode Database
    config: {},
    currentView: 'dashboard',
    currentTypeId: null, // Showing items of this Type
    currentSectionId: null // Optional: showing a dashboard for a section?
};

// Data Adapter for Hybrid Support (Electron / Web / Mobile)
const DataAdapter = {
    isElectron: () => !!window.api,

    async get(key) {
        if (this.isElectron()) {
            return await window.api.invoke(`get-${key}`).catch(() => []);
        } else {
            // Web Mock
            const raw = localStorage.getItem(`db_${key}`);
            return raw ? JSON.parse(raw) : [];
        }
    },

    async save(key, data) {
        if (this.isElectron()) {
            return await window.api.invoke(`save-${key}`, data);
        } else {
            // Web Mock
            localStorage.setItem(`db_${key}`, JSON.stringify(data));
        }
    }
};

class Store {
    constructor() {
        this.data = new Proxy(initialState, {
            set: (target, key, value) => {
                target[key] = value;
                this.notify(key, value);
                return true;
            }
        });
        this.listeners = new Set();
    }

    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notify(key, value) {
        this.listeners.forEach(cb => cb(key, value));
    }

    // --- Actions ---

    async load() {
        console.log('Store: Loading Data...');

        // Parallel Load
        const [c, s, t, i, f, u, b, cfg] = await Promise.all([
            DataAdapter.get('collections'),
            DataAdapter.get('sections'),
            DataAdapter.get('types'),
            DataAdapter.get('items'),
            DataAdapter.get('fields'),
            DataAdapter.get('users'),
            DataAdapter.get('barcodes'),
            DataAdapter.get('settings')
        ]);

        this.data.collections = c || [];
        this.data.sections = s || [];
        this.data.itemTypes = t || [];
        this.data.items = i || [];
        this.data.fieldDefinitions = f || [];
        this.data.users = u || [];
        this.data.knownBarcodes = b || [];
        this.data.config = cfg || {}; // Load config

        console.log('Store: Data Loaded:', this.data);
    }

    async saveBarcodes(list) {
        this.data.knownBarcodes = list;
        await DataAdapter.save('barcodes', list);
    }

    // Config
    async saveConfig(cfg) {
        this.data.config = cfg;
        await DataAdapter.save('settings', cfg);
        // Force notify 'config' specifically if needed, likely handled by proxy set
    }

    // Generic Helper for Saving Arrays
    async _saveEntity(key, newItem, dbKey) {
        const arr = [...this.data[key]];
        const idx = arr.findIndex(x => x.id === newItem.id);
        if (idx >= 0) arr[idx] = newItem;
        else arr.push(newItem);

        this.data[key] = arr; // Notify
        await DataAdapter.save(dbKey, arr);
    }

    // Generic Helper for Deleting
    async _deleteEntity(key, id, dbKey) {
        const arr = this.data[key].filter(x => x.id !== id);
        this.data[key] = arr;
        await DataAdapter.save(dbKey, arr);
    }

    // 1. Collections
    async saveCollection(col) { await this._saveEntity('collections', col, 'collections'); }
    async deleteCollection(id) {
        // Cascading Delete
        const sections = this.data.sections.filter(s => s.collectionId === id);
        for (const sec of sections) {
            // Delete Types in Section
            const types = this.data.itemTypes.filter(t => t.sectionId === sec.id);
            for (const type of types) {
                // Delete Items in Type
                const items = this.data.items.filter(i => i.typeId === type.id);
                for (const item of items) {
                    await this._deleteEntity('items', item.id, 'items');
                }
                await this._deleteEntity('itemTypes', type.id, 'types');
            }
            await this._deleteEntity('sections', sec.id, 'sections');
        }
        await this._deleteEntity('collections', id, 'collections');
    }
    async saveAllCollections(cols) { this.data.collections = cols; await DataAdapter.save('collections', cols); }

    // 2. Sections
    async saveSection(sec) { await this._saveEntity('sections', sec, 'sections'); }
    async deleteSection(id) { await this._deleteEntity('sections', id, 'sections'); }
    async saveAllSections(secs) { this.data.sections = secs; await DataAdapter.save('sections', secs); }

    // 3. Item Types
    async saveType(type) { await this._saveEntity('itemTypes', type, 'types'); }
    async deleteType(id) { await this._deleteEntity('itemTypes', id, 'types'); }
    async saveAllTypes(types) { this.data.itemTypes = types; await DataAdapter.save('types', types); }

    // 4. Items
    async saveItem(item) { await this._saveEntity('items', item, 'items'); }
    async deleteItem(id) { await this._deleteEntity('items', id, 'items'); }

    // 5. Global Field Definitions
    async saveFieldDefinition(def) { await this._saveEntity('fieldDefinitions', def, 'fields'); }
    async deleteFieldDefinition(id) { await this._deleteEntity('fieldDefinitions', id, 'fields'); }

    // --- FULL DATA RESTORE ---
    async loadFullData(json) {
        if (!json || typeof json !== 'object') throw new Error('Invalid JSON data');

        // Update State
        this.data.collections = Array.isArray(json.collections) ? json.collections : [];
        this.data.sections = Array.isArray(json.sections) ? json.sections : [];
        this.data.itemTypes = Array.isArray(json.itemTypes) ? json.itemTypes : [];
        this.data.items = Array.isArray(json.items) ? json.items : [];
        this.data.fieldDefinitions = Array.isArray(json.fieldDefinitions) ? json.fieldDefinitions : [];
        this.data.users = Array.isArray(json.users) ? json.users : [];

        // Persist All
        await Promise.all([
            DataAdapter.save('collections', this.data.collections),
            DataAdapter.save('sections', this.data.sections),
            DataAdapter.save('types', this.data.itemTypes),
            DataAdapter.save('items', this.data.items),
            DataAdapter.save('fields', this.data.fieldDefinitions),
            DataAdapter.save('users', this.data.users)
        ]);

        console.log('Store: Full Data Restored');
    }

    // 6. Users
    async saveUser(user) { await this._saveEntity('users', user, 'users'); }
    async deleteUser(id) { await this._deleteEntity('users', id, 'users'); }
}

export const store = new Store();
window.store = store;
