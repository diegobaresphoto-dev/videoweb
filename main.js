const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs/promises');

// Polyfill for dependencies that expect File (e.g. g-i-s -> node-fetch/form-data)
if (!global.File) {
    global.File = class File { };
}

// Ensure Data Directory
const DATA_DIR = path.join(app.getPath('documents'), 'Collectiondata');

async function ensureData() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (e) { }
}

async function loadJSON(file) {
    try {
        const data = await fs.readFile(file, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

async function saveJSON(file, data) {
    await ensureData();
    await fs.writeFile(file, JSON.stringify(data, null, 2));
}


// Menu Template
const createMenu = (win) => {
    const template = [
        {
            label: 'Archivo',
            submenu: [
                { role: 'quit', label: 'Salir' }
            ]
        },
        {
            label: 'Ver',
            submenu: [
                { role: 'reload', label: 'Recargar' },
                { role: 'forceReload', label: 'Recargar Forzado' },
                { role: 'toggleDevTools', label: 'Herramientas de Desarrollo' },
                { type: 'separator' },
                { role: 'resetZoom', label: 'Restablecer Zoom' },
                { role: 'zoomIn', label: 'Acercar' },
                { role: 'zoomOut', label: 'Alejar' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'Pantalla Completa' }
            ]
        },
        {
            label: 'Administración',
            submenu: [
                {
                    label: 'Gestionar Usuarios',
                    click: () => win.webContents.send('menu-users')
                },
                {
                    label: 'Gestionar Datos (Importar/Exportar)',
                    click: () => win.webContents.send('menu-data')
                }
            ]
        },
        {
            label: 'Ayuda',
            submenu: [
                { label: 'Acerca de', click: () => console.log('About') }
            ]
        }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
};

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        backgroundColor: '#0f172a',
        show: false
    });

    win.loadFile('index.html');
    win.once('ready-to-show', () => win.show());

    // Create Menu
    createMenu(win);

    // win.webContents.openDevTools();
}

app.whenReady().then(async () => {
    await ensureData();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS ---

// --- IPC HANDLERS ---

const FILES = {
    collections: path.join(DATA_DIR, 'collections.json'),
    sections: path.join(DATA_DIR, 'sections.json'),
    types: path.join(DATA_DIR, 'types.json'),
    items: path.join(DATA_DIR, 'items.json'),
    fields: path.join(DATA_DIR, 'fields.json'),
    users: path.join(DATA_DIR, 'users.json'),
    barcodes: path.join(DATA_DIR, 'barcodes.json')
};

// Generic Generators
['collections', 'sections', 'types', 'items', 'fields', 'users', 'barcodes'].forEach(key => {
    // GET
    ipcMain.handle(`get-${key}`, async () => {
        return await loadJSON(FILES[key]);
    });

    // SAVE
    ipcMain.handle(`save-${key}`, async (event, data) => {
        return await saveJSON(FILES[key], data);
    });
});

// Image Search
const gis = require('g-i-s');

ipcMain.handle('search-images', (event, query) => {
    return new Promise((resolve, reject) => {
        gis(query, (error, results) => {
            if (error) {
                console.error('GIS Error:', error);
                resolve([]); // Return empty on error to avoid crashing
            }
            else {
                // GIS returns { url, width, height }
                resolve(results.slice(0, 30)); // Limit results
            }
        });
    });
});

// Local Image Storage
ipcMain.handle('save-image', async (event, { buffer, name }) => {
    try {
        const imagesDir = path.join(DATA_DIR, 'images');
        await fs.mkdir(imagesDir, { recursive: true });

        const fileName = `${Date.now()}_${name}`; // Unique name
        const filePath = path.join(imagesDir, fileName);

        // buffer comes as Uint8Array from renderer
        await fs.writeFile(filePath, Buffer.from(buffer));

        // Return absolute path for display
        return filePath;
    } catch (e) {
        console.error('Save Image Error:', e);
        throw e;
    }
});

// Download remote image to local media folder
ipcMain.handle('download-image', async (event, url) => {
    try {
        const mediaDir = path.join(DATA_DIR, 'media');
        await fs.mkdir(mediaDir, { recursive: true });

        // Dynamic import for node-fetch (ESM)
        const fetch = (await import('node-fetch')).default;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Guesses extension or defaults to .jpg
        let ext = path.extname(url).split('?')[0] || '.jpg';
        if (ext.length > 5) ext = '.jpg'; // Safety fix for weird urls

        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}${ext}`;
        const filePath = path.join(mediaDir, fileName);

        await fs.writeFile(filePath, buffer);
        console.log('Main: Image downloaded to', filePath);

        return filePath;
    } catch (e) {
        console.error('Download Image Error:', e);
        throw e;
    }
});

// --- DEBUG LOGGER ---
ipcMain.handle('append-log', async (event, text) => {
    try {
        const logPath = path.join(__dirname, 'debug_log.txt');
        await fs.appendFile(logPath, text + '\n');
        return true;
    } catch (e) {
        console.error('Log Error:', e);
        return false;
    }
});

// --- BARCODE SYSTEM ---
const javascriptBarcodeReader = require('javascript-barcode-reader');

// 1. Decoder (Local Image -> Code)
ipcMain.handle('decode-barcode', async (event, imagePath) => {
    try {
        // javascript-barcode-reader works best with file path in Node
        console.log('Main: Decoding barcode from', imagePath);

        const code = await javascriptBarcodeReader({
            image: imagePath,
            barcode: 'EAN-13', // Target games (UPC is compatible usually)
        });

        console.log('Main: Decoded EAN-13:', code);
        return code;
    } catch (e) {
        // Try UPC-A
        try {
            const code = await javascriptBarcodeReader({
                image: imagePath,
                barcode: 'UPC',
            });
            console.log('Main: Decoded UPC:', code);
            return code;
        } catch (e2) {
            console.log('Main: Barcode Decode Failed:', e2.message);
            return null;
        }
    }
});

// --- SETTINGS & AI ---
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

ipcMain.handle('get-settings', async () => {
    try {
        return await loadJSON(SETTINGS_FILE);
    } catch (e) { return {}; }
});

ipcMain.handle('save-settings', async (event, data) => {
    return await saveJSON(SETTINGS_FILE, data);
});

// Helper for dynamic node-fetch import
const dynamicFetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// AI Fallback Functions (Placeholders for actual API calls)
async function callGemini(code, apiKey) {
    if (!apiKey) return null;
    console.log('Main: Calling Gemini for', code);
    try {
        const fetch = dynamicFetch;

        const prompt = `Identify the exact video game or product with Barcode/EAN/UPC "${code}". 
        Return strictly a JSON object with keys: "title" (name of the game), "platform" (console name), "description" (short summary). 
        If you are not 100% sure it is a game or known product, return null. Do not use markdown blocks.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const json = await response.json();

        if (json.candidates && json.candidates[0] && json.candidates[0].content) {
            const text = json.candidates[0].content.parts[0].text;
            // Clean markdown if present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleanText);
            console.log('Gemini Result:', data);
            return data;
        }
    } catch (e) {
        console.error('Gemini Error:', e.message);
    }
    return null;
}

async function callOpenAI(code, apiKey) {
    if (!apiKey) return null;
    console.log('Main: Calling OpenAI for', code);
    try {
        const fetch = dynamicFetch;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini", // Optimized for speed/cost
                messages: [
                    {
                        role: "system",
                        content: "You are a video game database assistant. You output ONLY valid JSON."
                    },
                    {
                        role: "user",
                        content: `Identify the video game with EAN/UPC "${code}". Return a JSON with: title, platform, description. If unknown, return null.`
                    }
                ]
            })
        });

        const json = await response.json();
        if (json.choices && json.choices.length > 0) {
            const text = json.choices[0].message.content;
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(cleanText);
            console.log('OpenAI Result:', data);
            return data;
        }
    } catch (e) {
        console.error('OpenAI Error:', e.message);
    }
    return null;
}

// 2. Lookup (Code -> Metadata API)
const cheerio = require('cheerio'); // Add cheerio for HTML parsing

ipcMain.handle('lookup-barcode', async (event, code) => {
    // 1. STANDARD API: UPCitemdb
    try {
        console.log('Main: Looking up code', code);
        const fetch = dynamicFetch; // Use the helper for dynamic import

        const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
        const json = await response.json();

        if (json.items && json.items.length > 0) {
            const item = json.items[0];
            return {
                title: item.title,
                platform: item.category,
                description: item.description,
                images: item.images
            };
        }
    } catch (e) {
        console.error('API Lookup Error:', e.message);
    }

    // 2. SCRAPING FALLBACK (DuckDuckGo - Prioritized over AI)
    console.log('Main: API failed, trying Web Search fallback...');
    try {
        const fetch = dynamicFetch;
        // Use raw code search first - it's more specific for unique EANs
        const searchUrl = `https://html.duckduckgo.com/html?q=${code}`;
        const searchRes = await fetch(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const html = await searchRes.text();
        const $ = cheerio.load(html);

        let firstTitle = $('.result__a').first().text();

        if (firstTitle) {
            // 1. Clean Title
            let cleanTitle = firstTitle
                .replace(/ \| Amazon\..*$/, '')
                .replace(/ - Amazon\..*$/, '')
                .replace(/ \| eBay$/, '')
                .replace(/ - eBay$/, '')
                .replace(/ - Wikipedia$/, '')
                .replace(/ \| KuantoKusta$/, '')
                .replace(/ - KuantoKusta$/, '')
                .replace(/ KuantoKusta$/, '') // Space suffix
                .replace(/ \| .*$/, '') // Generic: Remove anything after a pipe |
                .trim();

            // 2. Aggressive Cleanup
            let specificTitle = cleanTitle
                .replace(/^Juego Físico Nuevo y Precintado\s*/i, '')
                .replace(/^Juego Físico\s*/i, '')
                .replace(/^\d+\s*-\s*/, '')
                .replace(code, '')
                .replace(/-/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            if (specificTitle.length < 3) specificTitle = cleanTitle;

            console.log('Main: Fallback final title:', specificTitle);
            return { title: specificTitle };
        }
    } catch (fallbackErr) {
        console.error('Fallback Search Error:', fallbackErr);
    }

    // 3. AI FALLBACK (Gemini / OpenAI)
    try {
        const settings = await loadJSON(SETTINGS_FILE);

        // Try Gemini First
        if (settings && settings.geminiApiKey) {
            const aiData = await callGemini(code, settings.geminiApiKey);
            if (aiData && aiData.title) return aiData;
        }

        // Try OpenAI Second
        if (settings && settings.openaiApiKey) {
            const aiData = await callOpenAI(code, settings.openaiApiKey);
            if (aiData && aiData.title) return aiData;
        }

    } catch (e) {
        console.error('AI Lookup Error:', e);
    }


    return null;
});

// 3. Wikipedia Lookup (Title -> Game Metadata)
ipcMain.handle('lookup-wikipedia', async (event, title) => {
    try {
        console.log('Main: Looking up Wikipedia for', title);
        const fetch = dynamicFetch; // Use the helper for dynamic import

        // Clean title: remove edition suffixes that don't exist in Wikipedia
        let cleanTitle = title
            .replace(/\s*-?\s*(Complete Edition|GOTY|Definitive Edition|Game of the Year Edition|Deluxe Edition|Ultimate Edition|Enhanced Edition|Remastered)/gi, '')
            .trim();

        // Search for the page first using OpenSearch API
        const searchUrl = `https://es.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanTitle)}&limit=1&namespace=0&format=json`;
        console.log('Wikipedia Search URL:', searchUrl);

        const searchRes = await fetch(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        const searchJson = await searchRes.json();

        let url;
        if (searchJson && searchJson[3] && searchJson[3].length > 0) {
            url = searchJson[3][0];
            console.log('Found Wikipedia URL:', url);
        } else {
            console.log('Wikipedia page not found via search');
            return null;
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            console.log('Wikipedia page not found');
            return null;
        }

        const html = await response.text();

        const $ = cheerio.load(html);
        const data = {};

        const infobox = $('.infobox').first();
        if (infobox.length) {
            console.log('Infobox found');

            infobox.find('tr').each((i, el) => {
                const head = $(el).find('th').text().trim().toLowerCase();
                const val = $(el).find('td').text().trim();

                // Helper to clean value
                const clean = (txt) => {
                    return txt
                        .replace(/\[\d+\]/g, '') // Remove [1], [2]
                        .replace(/\s+/g, ' ') // Normalize spaces
                        .trim();
                };

                if (head.includes('desarrollador') || head.includes('creador') || head.includes('diseñador')) {
                    data.developer = clean(val);
                }
                else if (head.includes('distribuidor') || head.includes('publicador')) {
                    // Sometimes useful if publisher is wanted
                    data.publisher = clean(val);
                }
                else if (head.includes('lanzamiento') || head.includes('publicación') || head.includes('fecha')) {
                    // Try to extract a year
                    const yearMatch = val.match(/\d{4}/);
                    if (yearMatch) data.year = yearMatch[0];
                }
                else if (head.includes('género')) {
                    data.genre = clean(val);
                }
                else if (head.includes('jugadores') || head.includes('modos')) {
                    data.players = clean(val);
                }
                else if (head.includes('plataforma')) {
                    data.platform = clean(val);
                }
            });
        } else {
            console.log('No infobox found via Cheerio');
        }

        // Description extraction (first p that is not coordinates or empty)
        let desc = '';
        $('p').each((i, el) => {
            const txt = $(el).text().trim();
            if (desc) return; // already found
            if (txt.length > 50 && !txt.includes('Coordenadas:')) {
                desc = txt;
            }
        });

        if (desc) {
            // Cleanup references like [1]
            data.description = desc.replace(/\[\d+\]/g, '').substring(0, 500);
        }

        console.log('Wikipedia data extracted (Cheerio):', data);
        return Object.keys(data).length > 0 ? data : null;

    } catch (e) {
        console.error('Wikipedia Lookup Error:', e);
        return null;
    }
});
