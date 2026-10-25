import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { afterEach, expect, test } from 'vitest';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'visualizer-package-'));
  roots.push(root);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'test', version: '0.1.0' }));
  writeFileSync(
    join(root, 'package-lock.json'),
    JSON.stringify({
      version: '0.1.0',
      packages: { '': { version: '0.1.0' }, dependency: { version: '9.0.0' } },
    }),
  );
  return root;
}
const versionScript = resolve('scripts/version.mjs');
test.each(['0.1.0', '0.0.1', '1.2.3-beta', '01.2.3', '65536.0.0', '1.2', '1.2.3.4', ''])(
  'rejects invalid or non-increasing version %s without writes',
  (version) => {
    const root = fixture();
    const before = readFileSync(join(root, 'package.json'), 'utf8');
    expect(spawnSync(process.execPath, [versionScript, version], { cwd: root }).status).not.toBe(0);
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(before);
  },
);
test('version command synchronizes package and lock root without changing dependencies', () => {
  const root = fixture();
  execFileSync(process.execPath, [versionScript, '0.2.0'], { cwd: root });
  expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version).toBe('0.2.0');
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  expect(lock.version).toBe('0.2.0');
  expect(lock.packages[''].version).toBe('0.2.0');
  expect(lock.packages.dependency.version).toBe('9.0.0');
});
function archive(version = '0.1.0', missingIcon = false, extra: Record<string, unknown> = {}) {
  const root = fixture();
  const built = join(root, 'built');
  mkdirSync(built);
  cpSync(resolve('public/icon'), join(built, 'icon'), { recursive: true });
  if (missingIcon) rmSync(join(built, 'icon/48.png'));
  writeFileSync(
    join(built, 'manifest.json'),
    JSON.stringify({
      manifest_version: 3,
      version,
      name: 'Audio Visualizer',
      permissions: ['tabCapture', 'activeTab', 'storage', 'sidePanel'],
      icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
      background: { service_worker: 'background.js' },
      side_panel: { default_path: 'sidepanel.html' },
      ...extra,
    }),
  );
  writeFileSync(join(built, 'background.js'), '');
  writeFileSync(join(built, 'sidepanel.html'), '<html></html>');
  const zip = join(root, 'extension.zip');
  execFileSync('zip', ['-qr', zip, '.'], { cwd: built });
  return zip;
}
const validateScript = resolve('scripts/validate-artifact.mjs');
test.each(['optional_permissions', 'optional_host_permissions'])(
  'rejects unexpected %s in the ZIP',
  (field) => {
    const value = field === 'optional_permissions' ? ['tabs'] : ['<all_urls>'];
    const result = spawnSync(
      process.execPath,
      [validateScript, archive('0.1.0', false, { [field]: value })],
      {
        encoding: 'utf8',
      },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unexpected permissions');
  },
);
test('validates manifest and assets inside the actual ZIP', () => {
  expect(
    execFileSync(process.execPath, [validateScript, archive()], { encoding: 'utf8' }),
  ).toContain('Verified');
});
test('rejects a ZIP missing a required icon', () => {
  const result = spawnSync(process.execPath, [validateScript, archive('0.1.0', true)], {
    encoding: 'utf8',
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('icon/48.png');
});
test('rejects stale ZIP version', () => {
  const result = spawnSync(process.execPath, [validateScript, archive('0.0.1')], {
    encoding: 'utf8',
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('version');
});
test('clean-checkout release installs, builds, zips and verifies a real extension', () => {
  const root = fixture();
  for (const path of [
    'src',
    'public',
    'scripts',
    'package.json',
    'package-lock.json',
    'wxt.config.ts',
    'tsconfig.json',
  ])
    cpSync(resolve(path), join(root, path), { recursive: true });
  const result = spawnSync(process.execPath, [join(root, 'scripts/release.mjs')], {
    cwd: root,
    encoding: 'utf8',
    timeout: 120000,
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(result.stdout).toContain('Verified');
}, 130000);
