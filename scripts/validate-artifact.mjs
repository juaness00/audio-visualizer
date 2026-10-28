import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const zip = process.argv[2];
if (!zip) throw new Error('Usage: node scripts/validate-artifact.mjs path.zip');
execFileSync('unzip', ['-t', zip]);
const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
if (
  new Set(entries).size !== entries.length ||
  entries.some((p) => p.startsWith('/') || p.split('/').includes('..'))
)
  throw new Error('Unsafe or duplicate ZIP entries');
const asset = (path) => {
  if (!path || !entries.includes(path)) throw new Error(`Missing asset: ${path}`);
  return execFileSync('unzip', ['-p', zip, path]);
};
const manifest = JSON.parse(asset('manifest.json').toString());
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (manifest.manifest_version !== 3 || manifest.version !== pkg.version)
  throw new Error('Manifest version mismatch');
const expected = ['activeTab', 'sidePanel', 'storage', 'tabCapture'];
if (
  JSON.stringify([...(manifest.permissions ?? [])].sort()) !== JSON.stringify(expected) ||
  manifest.host_permissions?.length ||
  manifest.optional_permissions?.length ||
  manifest.optional_host_permissions?.length
)
  throw new Error('Unexpected permissions; review privacy disclosures');
for (const size of [16, 32, 48, 128]) {
  const png = asset(manifest.icons?.[size]);
  if (
    png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    png.readUInt32BE(16) !== size ||
    png.readUInt32BE(20) !== size
  )
    throw new Error(`Invalid ${size}px PNG`);
}
asset(manifest.background?.service_worker);
asset(manifest.side_panel?.default_path);
for (const html of entries.filter((p) => p.endsWith('.html'))) {
  const text = asset(html).toString();
  for (const match of text.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^[a-z][a-z\d+.-]*:/i.test(match[1])) continue;
    const path = match[1].replace(/^\.?\//, '').split(/[?#]/)[0];
    asset(path);
  }
}
console.log(
  `Verified ${zip}: MV3 ${manifest.version}, ${entries.length} entries, icons 16/32/48/128; SHA256 ${createHash('sha256').update(readFileSync(zip)).digest('hex')}`,
);
