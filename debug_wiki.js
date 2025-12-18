const fetch = require('node-fetch');

async function testWiki(title) {
    console.log(`Testing Wikipedia lookup for: ${title}`);

    // Clean title logic
    let cleanTitle = title
        .replace(/\s*-?\s*(Complete Edition|GOTY|Definitive Edition|Game of the Year Edition|remastered)/gi, '')
        .trim();

    console.log(`Clean Title: ${cleanTitle}`);

    const searchUrl = `https://es.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanTitle)}&limit=1&namespace=0&format=json`;
    console.log(`Search URL: ${searchUrl}`);

    try {
        const searchRes = await fetch(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const searchJson = await searchRes.json();
        console.log('Search Result:', JSON.stringify(searchJson));

        if (searchJson && searchJson[3] && searchJson[3].length > 0) {
            const url = searchJson[3][0];
            console.log(`Page URL: ${url}`);

            const pageRes = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const html = await pageRes.text();

            // Regex Extraction Test
            const infoboxMatch = html.match(/<table[^>]*class="[^"]*infobox[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
            if (infoboxMatch) {
                console.log('Infobox found.');
                // console.log(infoboxMatch[1]); 
            } else {
                console.log('No Infobox found.');
            }

        } else {
            console.log('No page found.');
        }

    } catch (e) {
        console.error(e);
    }
}

testWiki("The Dark Pictures Anthology: House of Ashes");
testWiki("House of Ashes");
