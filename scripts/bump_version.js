import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const args = process.argv.slice(2);
let newVersion = args.find(arg => !arg.startsWith('-'));
const createTag = !args.includes('--no-tag');

if (!newVersion) {
    console.error('❌ Error: Please specify a version number.');
    console.error('Usage: node scripts/bump_version.js <new_version> [--no-tag]');
    console.error('Example: node scripts/bump_version.js 1.8.1');
    process.exit(1);
}

// Clean leading 'v' if present
newVersion = newVersion.replace(/^v/, '');

// Validate version format (semver x.y.z or x.y.z-tag)
const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
if (!semverRegex.test(newVersion)) {
    console.error(`❌ Error: "${newVersion}" is not a valid semver version (e.g. 1.8.1 or 1.8.1-beta.1).`);
    process.exit(1);
}

console.log(`🚀 Bumping version to: ${newVersion}\n`);

// 1. package.json
const pkgPath = path.join(rootDir, 'package.json');
if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.version = newVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ✓ Updated package.json`);
}

// 2. package-lock.json
const pkgLockPath = path.join(rootDir, 'package-lock.json');
if (fs.existsSync(pkgLockPath)) {
    const pkgLock = JSON.parse(fs.readFileSync(pkgLockPath, 'utf8'));
    pkgLock.version = newVersion;
    if (pkgLock.packages && pkgLock.packages['']) {
        pkgLock.packages[''].version = newVersion;
    }
    fs.writeFileSync(pkgLockPath, JSON.stringify(pkgLock, null, 2) + '\n');
    console.log(`  ✓ Updated package-lock.json`);
}

// 3. src-tauri/Cargo.toml
const cargoPath = path.join(rootDir, 'src-tauri/Cargo.toml');
if (fs.existsSync(cargoPath)) {
    let cargo = fs.readFileSync(cargoPath, 'utf8');
    cargo = cargo.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVersion}"`);
    fs.writeFileSync(cargoPath, cargo);
    console.log(`  ✓ Updated src-tauri/Cargo.toml`);
}

// 4. src-tauri/tauri.conf.json
const tauriConfPath = path.join(rootDir, 'src-tauri/tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
    tauriConf.version = newVersion;
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
    console.log(`  ✓ Updated src-tauri/tauri.conf.json`);
}

// 5. snap/snapcraft.yaml
const snapPath = path.join(rootDir, 'snap/snapcraft.yaml');
if (fs.existsSync(snapPath)) {
    let snap = fs.readFileSync(snapPath, 'utf8');
    snap = snap.replace(/^version:\s*['"]?[^'\n\r]+['"]?/m, `version: '${newVersion}'`);
    fs.writeFileSync(snapPath, snap);
    console.log(`  ✓ Updated snap/snapcraft.yaml`);
}

// 6. release/latest.json
const latestPath = path.join(rootDir, 'release/latest.json');
if (fs.existsSync(latestPath)) {
    const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    latest.version = newVersion;
    latest.date = new Date().toUTCString();
    fs.writeFileSync(latestPath, JSON.stringify(latest, null, 4) + '\n');
    console.log(`  ✓ Updated release/latest.json`);
}

// 7. release/beta.json
const betaPath = path.join(rootDir, 'release/beta.json');
if (fs.existsSync(betaPath)) {
    const beta = JSON.parse(fs.readFileSync(betaPath, 'utf8'));
    beta.version = newVersion;
    fs.writeFileSync(betaPath, JSON.stringify(beta, null, 4) + '\n');
    console.log(`  ✓ Updated release/beta.json`);
}

// 8. CHANGELOG.md
const changelogPath = path.join(rootDir, 'CHANGELOG.md');
if (fs.existsSync(changelogPath)) {
    let changelog = fs.readFileSync(changelogPath, 'utf8');
    const versionMatch = changelog.match(/-\s*(\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?)\s*-/);
    
    if (versionMatch) {
        if (versionMatch[1] !== newVersion) {
            changelog = changelog.replace(
                /## Latest CODE version\r?\n/,
                `## Latest CODE version\n- ${newVersion} - Bump version to ${newVersion}\n`
            );
            fs.writeFileSync(changelogPath, changelog);
            console.log(`  ✓ Updated CHANGELOG.md (added entry for ${newVersion})`);
        } else {
            console.log(`  ✓ CHANGELOG.md already has version ${newVersion}`);
        }
    } else {
        changelog = changelog.replace(
            /## Latest CODE version\r?\n/,
            `## Latest CODE version\n- ${newVersion} - Bump version to ${newVersion}\n`
        );
        fs.writeFileSync(changelogPath, changelog);
        console.log(`  ✓ Updated CHANGELOG.md`);
    }
}

// 9. Git Tag
if (createTag) {
    try {
        const tagName = `v${newVersion}`;
        execSync(`git tag -a "${tagName}" -m "Release ${tagName}"`, { cwd: rootDir, stdio: 'pipe' });
        console.log(`  ✓ Created git tag: ${tagName}`);
    } catch (err) {
        console.warn(`  ⚠️ Could not create git tag (tag might already exist or git not initialized): ${err.message}`);
    }
}

console.log('\n🔍 Running version verification script...\n');
try {
    execSync('node scripts/check_versions.js', { cwd: rootDir, stdio: 'inherit' });
} catch (err) {
    console.error('\n❌ Version check failed!');
    process.exit(1);
}
