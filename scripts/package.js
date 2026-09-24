#!/usr/bin/env node
// Packs dist/ into releases/<name>-v<version>-<commit>.zip for upload to ChurchTools.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const { name, version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

if (!fs.existsSync(path.join(root, 'dist'))) {
    console.error('dist/ not found – run the build first.');
    process.exit(1);
}

const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const releases = path.join(root, 'releases');
fs.mkdirSync(releases, { recursive: true });
const archive = path.join(releases, `${name}-v${version}-${commit}.zip`);

fs.rmSync(archive, { force: true });
execFileSync('zip', ['-r', archive, 'dist/', '-x', '*.map', '*.DS_Store'], { cwd: root, stdio: 'inherit' });
console.log(`Packed ${path.relative(root, archive)} (${(fs.statSync(archive).size / 1024).toFixed(0)} KB)`);
