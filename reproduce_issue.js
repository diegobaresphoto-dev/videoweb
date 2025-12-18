const cheerio = require('cheerio');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function lookupBarcode(code) {
    console.log(`\n--- Testing Code: ${code} ---`);

    // 1. API Lookup (Mock failure for this test to hit fallback)
    console.log('Skipping API to test fallback...');

    // 2. Fallback Search with Context
    console.log('Trying Fallback: DuckDuckGo HTML + Context...');
    try {
        const searchUrl = `https://html.duckduckgo.com/html?q=${code}+videojuego`; // NEW LOGIC
        const searchRes = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await searchRes.text();
        const $ = cheerio.load(html);

        let firstTitle = $('.result__a').first().text();
        const href = $('.result__a').first().attr('href');
        const snippet = $('.result__snippet').first().text();

        console.log('Raw Title:', firstTitle);
        console.log('Snippet:', snippet);
        console.log('URL:', href);

        require('fs').appendFileSync('repro_log.txt', `[${code}] Snippet: ${snippet}\n`);

        if (firstTitle) {
            firstTitle = firstTitle
                .replace(/ \| Amazon\..*$/, '')
                .replace(/ - Amazon\..*$/, '')
                .replace(/ \| eBay$/, '')
                .replace(/ - eBay$/, '')
                .replace(/ - Wikipedia$/, '')
                .replace(/^Juego Físico Nuevo y Precintado\s*/i, '')
                .replace(/^Juego Físico\s*/i, '')
                .replace(/^\d+\s*-\s*/, '')
                .replace(code, '')
                .replace(/-/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            require('fs').appendFileSync('repro_log.txt', `[${code}] Raw Title Was: ${$('.result__a').first().text()}\n`);
            require('fs').appendFileSync('repro_log.txt', `[${code}] Fallback CLEAN Title: ${firstTitle}\n`);
        } else {
            require('fs').appendFileSync('repro_log.txt', `[${code}] Fallback: No title found.\n`);
        }

    } catch (e) {
        console.error(e);
        require('fs').appendFileSync('repro_log.txt', `[${code}] Error: ${e.message}\n`);
    }
}

(async () => {
    require('fs').writeFileSync('repro_log.txt', '');

    // Horizon Zero Dawn
    await lookupBarcode('711719832468');

    // Hogwarts Legacy (User reported)
    await lookupBarcode('5051893242614');

    console.log('Done. Check repro_log.txt');
})();
