#!/usr/bin/env node
// Guards three rules from Plan.md that a normal build would silently break.
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(import.meta.dirname, '..', 'dist');
const failures = [];

function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
    });
}

const files = walk(dist);

// 1. One bundle: a kiosk tab must never request a chunk an update has deleted.
const scripts = files.filter((f) => f.endsWith('.js'));
if (scripts.length !== 1) {
    failures.push(`expected exactly one JavaScript bundle, found ${scripts.length}: ${scripts.join(', ')}`);
}

// 2. No inline script: the ChurchTools CSP has no 'unsafe-inline' in script-src (G15).
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    if (!/\bsrc=/.test(tag) && !/type="application\/json"/.test(tag)) {
        failures.push(`inline script in index.html: ${tag}`);
    }
}

// 3. No instance address: the package is meant for other congregations too.
const forbidden = [/[a-z0-9-]+\.church\.tools/i];
if (process.env.CT_BASE_URL) forbidden.push(new URL(process.env.CT_BASE_URL).host);
for (const file of files.filter((f) => /\.(js|css|html)$/.test(f))) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of forbidden) {
        const hit = typeof pattern === 'string' ? content.includes(pattern) && pattern : content.match(pattern)?.[0];
        if (hit) failures.push(`instance address "${hit}" in ${path.relative(dist, file)}`);
    }
}

// 4. Fonts only from the own bundle: a font service would learn of every device and designer (data protection).
const fontServices = /fonts\.(googleapis|gstatic)\.com|use\.typekit\.net|fonts\.bunny\.net/i;
const remoteFontFace = /@font-face\s*{[^}]*url\(\s*['"]?(https?:)?\/\//i;
for (const file of files.filter((f) => /\.(js|css|html)$/.test(f))) {
    const content = fs.readFileSync(file, 'utf8');
    const hit = content.match(fontServices)?.[0] ?? (remoteFontFace.test(content) && '@font-face with a remote url');
    if (hit) failures.push(`external font source "${hit}" in ${path.relative(dist, file)}`);
}
const fontFiles = files.filter((f) => /\.(woff2?|ttf|otf)$/.test(f));
if (fontFiles.length && !files.some((f) => f.includes(`${path.sep}licenses${path.sep}`))) {
    failures.push(`${fontFiles.length} font files but no licence texts (SIL OFL)`);
}

// 5. No demo mode: it exists for development without Custom Modules only.
for (const file of scripts) {
    if (fs.readFileSync(file, 'utf8').includes('infoscreen-designer.demo')) {
        failures.push(`demo store code in ${path.relative(dist, file)}`);
    }
}

if (failures.length) {
    console.error('dist check failed:\n  - ' + failures.join('\n  - '));
    process.exit(1);
}
console.log(
    `dist check passed (${files.length} files, one bundle, no inline script, no instance address, ` +
        `${fontFiles.length} local font files with licences, no demo)`,
);
