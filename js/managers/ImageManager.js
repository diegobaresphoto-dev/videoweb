
export const ImageManager = {
    async search(query) {
        if (!query) return [];
        console.log('ImageManager: Searching for', query);

        // Hybrid check
        if (!window.api) {
            alert('⚠️ La búsqueda automática de imágenes requiere la versión de PC (Node.js). En esta versión Web/Móvil debes subir las imágenes manualmente.');
            return [];
        }

        try {
            return await window.api.invoke('search-images', query);
        } catch (e) {
            console.error('Image Search Error:', e);
            return [];
        }
    },

    buildQuery(item, type) {
        // Collect values from fields flagged as 'useForImageSearch'
        const parts = [];

        type.fields.forEach(f => {
            if (f.useForImageSearch && item.data[f.key]) {
                parts.push(item.data[f.key]);
            }
        });

        if (parts.length === 0) return null;
        return parts.join(' ');
    }
};
