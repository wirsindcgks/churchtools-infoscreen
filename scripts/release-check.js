#!/usr/bin/env node
/**
 * Checks before a release (Plan.md, Nächste Schritte 12) that tag,
 * package.json, package-lock.json and CHANGELOG.md name the same version,
 * and prints the changelog section as release notes.
 *
 *   node scripts/release-check.js v0.1.0            check, exit 1 on a mismatch
 *   node scripts/release-check.js v0.1.0 --notes    print the notes for the release
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = /^\d+\.\d+\.\d+$/;

/** The version a tag names: `v1.2.3` → `1.2.3`; null for anything else. */
export function versionOfTag(tag) {
    const match = /^v(\d+\.\d+\.\d+)$/.exec(tag ?? '');
    return match ? match[1] : null;
}

/**
 * The section of a version in a changelog after "Keep a Changelog":
 * `## [1.2.3] – 2026-09-25` up to the next `## `. Null if missing or undated.
 */
export function changelogSection(changelog, version) {
    const lines = changelog.split('\n');
    const escaped = version.replaceAll('.', '\\.');
    const start = lines.findIndex((l) => new RegExp(`^## \\[${escaped}\\] [–-] \\d{4}-\\d{2}-\\d{2}\\s*$`).test(l));
    if (start < 0) return null;
    const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
    return lines.slice(start + 1, end < 0 ? undefined : end).join('\n').trim();
}

/** Every reason this tag cannot be released; empty when it can. */
export function releaseProblems({ tag, packageVersion, lockVersion, changelog }) {
    const version = versionOfTag(tag);
    if (!version) return [`Der Tag „${tag}" hat nicht die Form vX.Y.Z.`];
    const problems = [];
    if (!VERSION.test(packageVersion ?? '') || packageVersion !== version) {
        problems.push(`package.json trägt ${packageVersion}, der Tag ${version}.`);
    }
    if (lockVersion !== version) problems.push(`package-lock.json trägt ${lockVersion}, der Tag ${version}.`);
    const section = changelogSection(changelog, version);
    if (section === null) problems.push(`CHANGELOG.md hat keinen datierten Abschnitt „## [${version}] – JJJJ-MM-TT".`);
    else if (!section) problems.push(`Der Abschnitt ${version} in CHANGELOG.md ist leer.`);
    return problems;
}

function main() {
    const [tag, flag] = process.argv.slice(2);
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
    const changelog = fs.existsSync(path.join(root, 'CHANGELOG.md')) ? read('CHANGELOG.md') : '';
    const problems = releaseProblems({
        tag,
        packageVersion: JSON.parse(read('package.json')).version,
        lockVersion: JSON.parse(read('package-lock.json')).version,
        changelog,
    });
    if (problems.length) {
        for (const p of problems) console.error(`✗ ${p}`);
        process.exit(1);
    }
    if (flag === '--notes') console.log(changelogSection(changelog, versionOfTag(tag)));
    else console.log(`✓ ${tag}: package.json, package-lock.json und CHANGELOG.md stimmen überein.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
