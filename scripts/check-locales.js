
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.resolve(__dirname, '../src/i18n/locales');
const baseFile = 'en.json';
const targetFiles = ['de.json', 'nl.json', 'pl.json', 'pt-br.json', 'es.json'];

console.log(`Checking locales in ${localesDir}...`);

function red(text) { return `\x1b[31m${text}\x1b[0m`; }
function green(text) { return `\x1b[32m${text}\x1b[0m`; }
function yellow(text) { return `\x1b[33m${text}\x1b[0m`; }

// Helper function to get all keys (nested structure flattened to dot notation)
function getKeys(obj, prefix = '') {
    let keys = [];
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const newPrefix = prefix ? `${prefix}.${key}` : key;
            keys.push(newPrefix);
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                keys = keys.concat(getKeys(obj[key], newPrefix));
            }
        }
    }
    return keys;
}

// Function to get value at a path
function getValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

// Read base file
let baseContent;
try {
    const basePath = path.join(localesDir, baseFile);
    if (!fs.existsSync(basePath)) {
        console.error(red(`Base file not found: ${basePath}`));
        process.exit(1);
    }
    baseContent = JSON.parse(fs.readFileSync(basePath, 'utf8'));
} catch (e) {
    console.error(red(`Failed to read base file ${baseFile}: ${e.message}`));
    process.exit(1);
}

const baseKeysList = getKeys(baseContent);
const baseKeys = new Set(baseKeysList);
let hasErrors = false;

// Process each target file
targetFiles.forEach(file => {
    const filePath = path.join(localesDir, file);
    if (!fs.existsSync(filePath)) {
        console.error(red(`File not found: ${file}`));
        hasErrors = true;
        return;
    }

    try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const currentKeysList = getKeys(content);
        const currentKeys = new Set(currentKeysList);

        // Find missing keys
        const missingKeys = baseKeysList.filter(k => !currentKeys.has(k));

        // Find extra keys
        const extraKeys = currentKeysList.filter(k => !baseKeys.has(k));

        if (missingKeys.length === 0 && extraKeys.length === 0) {
            console.log(green(`✓ ${file} is in sync with ${baseFile}.`));
        } else {
            console.log(red(`✗ ${file} has inconsistencies:`));
            hasErrors = true;

            if (missingKeys.length > 0) {
                console.log(yellow(`  Missing keys (${missingKeys.length}):`));
                missingKeys.slice(0, 10).forEach(k => console.log(`    - ${k}`));
                if (missingKeys.length > 10) console.log(`    ... and ${missingKeys.length - 10} more`);
            }
            if (extraKeys.length > 0) {
                console.log(yellow(`  Extra keys (${extraKeys.length}):`));
                extraKeys.slice(0, 10).forEach(k => console.log(`    - ${k}`));
                if (extraKeys.length > 10) console.log(`    ... and ${extraKeys.length - 10} more`);
            }
        }

        // Type checking
        let typeMismatch = false;
        baseKeysList.forEach(key => {
            if (currentKeys.has(key)) {
                const baseVal = getValue(baseContent, key);
                const currentVal = getValue(content, key);
                // Simplify type check: object vs primitive
                const isBaseObj = (typeof baseVal === 'object' && baseVal !== null);
                const isCurrentObj = (typeof currentVal === 'object' && currentVal !== null);

                if (isBaseObj !== isCurrentObj) {
                    if (!typeMismatch) {
                        console.log(yellow(`  Type mismatches in ${file}:`));
                        typeMismatch = true;
                    }
                    console.log(`    - ${key}: expected ${isBaseObj ? 'object' : 'value'}, got ${isCurrentObj ? 'object' : 'value'}`);
                    hasErrors = true;
                }
            }
        });

        // Order checking
        const sharedKeys = baseKeysList.filter(k => currentKeys.has(k));
        const currentSharedKeys = currentKeysList.filter(k => baseKeys.has(k));

        // This is a strict check: if the shared keys appear in different order
        if (JSON.stringify(sharedKeys) !== JSON.stringify(currentSharedKeys)) {
            console.log(yellow(`  Key order mismatch in ${file}. Keys should be in the same order as en.json.`));
            // We don't fail the build for order, but we warn
            // hasErrors = true; // Uncomment if order should be enforced
        }


    } catch (e) {
        console.error(red(`Error processing ${file}: ${e.message}`));
        hasErrors = true;
    }
});

if (hasErrors) {
    console.log(red("\nSome locale files are not inline with en.json."));
    process.exit(1);
} else {
    console.log(green("\nAll locale files have the same entries and are inline!"));
}
