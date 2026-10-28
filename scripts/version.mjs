import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const valid = (value) =>
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value ?? '') &&
  value.split('.').every((n) => Number(n) <= 65535);
if (!valid(version) || !valid(pkg.version))
  throw new Error('Use a numeric MAJOR.MINOR.PATCH version (0–65535 per component).');
const next = version.split('.').map(Number);
const old = pkg.version.split('.').map(Number);
const firstDifference = next.findIndex((n, i) => n !== old[i]);
if (firstDifference === -1 || next[firstDifference] < old[firstDifference])
  throw new Error('Version must increase.');
if (lock.version !== pkg.version || lock.packages[''].version !== pkg.version)
  throw new Error('Package and lock versions disagree.');
pkg.version = lock.version = lock.packages[''].version = version;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
console.log(`Version set to ${version}; no tag or commit created.`);
