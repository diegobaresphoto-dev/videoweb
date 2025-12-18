import { CsvImporter } from '../js/importer.js';
import fs from 'fs';
import path from 'path';

console.log('--- Starting CSV Parser Test ---');

const csvPath = path.resolve('juegos_import_test.csv');
console.log('Reading CSV from:', csvPath);

try {
    const content = fs.readFileSync(csvPath, 'utf8');
    console.log('Content Read. Length:', content.length);
    console.log('Sample content:\n', content.substring(0, 100) + '...');

    console.log('\n--- Parsing ---');
    const rows = CsvImporter.parse(content);

    console.log('Rows parsed:', rows.length);
    if (rows.length > 0) {
        console.log('Headers:', rows[0]);
        console.log('First Row:', rows[1]);
    }

    // Basic Assertions
    if (rows.length !== 4) { // Header + 2 data + 1 blank/newline
        console.warn('WARNING: Expected 4 rows (1 header + 2 data + empty line logic?), got', rows.length);
    }

    const megaMan = rows[1];
    if (megaMan[0] !== 'Mega Man X') console.error('FAIL: Title mismatch, expected "Mega Man X", got', megaMan[0]);
    else console.log('PASS: Title check');

    if (megaMan[6] !== 'Un clásico de plataformas 2D') console.error('FAIL: Description quote handling failed, got', megaMan[6]);
    else console.log('PASS: Description quote handling');

    console.log('--- Test Completed ---');

} catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
}
