// Sets the same version on the root package and every service: `node scripts/set-version.mjs 0.2.0`.
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('Usage: node scripts/set-version.mjs <x.y.z>');
for (const file of ['package.json', 'services/shared/package.json', 'services/api/package.json', 'services/front/package.json']) {
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  pkg.version = version;
  writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
}
