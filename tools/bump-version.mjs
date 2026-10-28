// Raises the game version by one (0.7.1 → 0.7.2) and gives the service worker
// the same version, so installed apps notice the update. Runs on every commit
// (.githooks/pre-commit); can also be run by hand:
//   node tools/bump-version.mjs          patch: 0.7.1 → 0.7.2
//   node tools/bump-version.mjs minor    0.7.1 → 0.8.0
//   node tools/bump-version.mjs major    0.7.1 → 1.0.0
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const VERSION_FILE = new URL('src/shared/version.js', root);
const SW_FILE = new URL('sw.js', root);

const source = readFileSync(VERSION_FILE, 'utf8');
const match = source.match(/APP_VERSION = '(\d+)\.(\d+)\.(\d+)'/);
if (!match) throw new Error('APP_VERSION not found in src/shared/version.js');
let [major, minor, patch] = match.slice(1).map(Number);

const part = process.argv[2] ?? 'patch';
if (part === 'major') [major, minor, patch] = [major + 1, 0, 0];
else if (part === 'minor') [minor, patch] = [minor + 1, 0];
else patch += 1;
const next = `${major}.${minor}.${patch}`;

writeFileSync(VERSION_FILE, source.replace(match[0], `APP_VERSION = '${next}'`));
const sw = readFileSync(SW_FILE, 'utf8');
if (!/const VERSION = '[^']*';/.test(sw)) throw new Error('VERSION not found in sw.js');
writeFileSync(SW_FILE, sw.replace(/const VERSION = '[^']*';/, `const VERSION = 'v${next}';`));
console.log(`ZzWorld ${match[0].split("'")[1]} → ${next}`);
