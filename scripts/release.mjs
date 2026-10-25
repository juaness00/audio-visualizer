import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';

// Deliberately bootstraps dependencies: works with Node/npm alone in a fresh checkout.
const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' });
run('npm', ['ci']);
rmSync('.output', { recursive: true, force: true });
run('npm', ['run', 'build']);
run('npm', ['run', 'zip']);
const { name, version } = JSON.parse(readFileSync('package.json', 'utf8'));
run(process.execPath, ['scripts/validate-artifact.mjs', `.output/${name}-${version}-chrome.zip`]);
