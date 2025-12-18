const cheerio = require('cheerio');
const dynamicFetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testLookup(code) {
    console.log(`Testing lookup for: ${code}`);

    // 1. API
    try {
        console.log('1. Testing API...');
        const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`);
        const json = await res.json();
        if (json.items && json.items.length > 0) {
            console.log('API Result:', json.items[0].title);
            return;
        }
        console.log('API returned nothing.');
    } catch (e) {
        console.log('API Error:', e.message);
    }

    // 2. Web Search (DDG)
    try {
        console.log('2. Testing DDG Scraping...');
        const searchUrl = `https://html.duckduckgo.com/html?q=${code}+videojuego`;
        const res = await fetch(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const html = await res.text();
        const $ = cheerio.load(html);

        let firstTitle = $('.result__a').first().text();
        console.log('DDG First Result:', firstTitle);

        if (firstTitle) {
            let clean = firstTitle
                .replace(/ \| Amazon\..*$/, '')
                .replace(/ - Amazon\..*$/, '')
                .replace(/ - Wikipedia$/, '')
                .trim();
            console.log('Cleaned Title:', clean);
        }

    } catch (e) {
        console.log('Scraping Error:', e.message);
    }
}

testLookup('5051893242614');
