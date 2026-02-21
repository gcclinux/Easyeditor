#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');

const filesToCheck = [
    {
        path: 'package.json',
        extract: (content) => JSON.parse(content).version
    },
    {
        path: 'package-lock.json',
        extract: (content) => JSON.parse(content).version
    },
    {
        path: 'src-tauri/Cargo.toml',
        extract: (content) => {
            const match = content.match(/^version\s*=\s*"([^"]+)"/m);
            if (!match) throw new Error('Version not found in Cargo.toml');
            return match[1];
        }
    },
    {
        path: 'src-tauri/tauri.conf.json',
        extract: (content) => JSON.parse(content).version
    },
    {
        path: 'snap/snapcraft.yaml',
        extract: (content) => {
            const match = content.match(/^version:\s*['"]?([\d\.]+)['"]?/m);
            if (!match) throw new Error('Version not found in snapcraft.yaml');
            return match[1];
        }
    },
    {
        path: 'release/latest.json',
        extract: (content) => JSON.parse(content).version
    },
    {
        path: 'CHANGELOG.md',
        extract: (content) => {
            const match = content.match(/-\s*(\d+\.\d+\.\d+)\s*-/);
            if (!match) throw new Error('Version not found in CHANGELOG.md');
            return match[1];
        }
    },
    {
        name: 'Git Tag',
        isCommand: true,
        extract: () => {
            const tag = execSync('git describe --tags --abbrev=0', { cwd: rootDir, stdio: 'pipe' }).toString().trim();
            return tag.replace(/^v/, '');
        }
    }
];

let hasError = false;
let versions = {};
let previousVersion = null;

console.log('Checking versions across files...\n');

filesToCheck.forEach(fileDef => {
    try {
        let version;
        const name = fileDef.name || fileDef.path;

        if (fileDef.isCommand) {
            version = fileDef.extract();
        } else {
            const fullPath = path.join(rootDir, fileDef.path);
            const content = fs.readFileSync(fullPath, 'utf8');
            version = fileDef.extract(content);
        }

        versions[name] = version;
        console.log(`${name.padEnd(30)} : ${version}`);

        if (previousVersion === null) {
            previousVersion = version;
        } else if (previousVersion !== version) {
            hasError = true;
        }
    } catch (err) {
        const name = fileDef.name || fileDef.path;
        console.error(`Error reading or parsing ${name}: ${err.message}`);
        hasError = true;
    }
});

console.log('\n');

if (hasError) {
    console.error('❌ Version mismatch found or error occurred while checking.');
    process.exit(1);
} else {
    console.log('✅ All versions match successfully!');
    process.exit(0);
}
