/**
 * Bold is spare in the designer's frame (Plan.md 79): text is regular (400), buttons and headings 600 – as the
 * tokens `--d-weight-*` in theme.css say. Nothing heavier may creep back in. The player and the blocks are the
 * content of slides and set their own weights.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return files(full);
        return /\.(vue|css)$/.test(entry.name) ? [full] : [];
    });
}

/** `font-weight: 700|bold|800|900`, or `font: 700 …` (also 800, 900, bold). */
const TOO_HEAVY = /font-weight\s*:\s*(700|800|900|bold|bolder)\b|font\s*:\s*(700|800|900|bold|bolder)\b/;

describe('font weights of the designer', () => {
    // Tests run from the repository root (jsdom's import.meta.url is no file URL).
    const all = ['src/designer', 'src/views'].flatMap((dir) => files(path.resolve(dir)));

    it('finds the components and stylesheets', () => {
        expect(all.length).toBeGreaterThan(30);
    });

    it('nothing is set to 700 or heavier', () => {
        const heavy = all.flatMap((file) =>
            fs
                .readFileSync(file, 'utf8')
                .split('\n')
                .flatMap((line, i) => (TOO_HEAVY.test(line) ? [`${path.relative(path.resolve('src'), file)}:${i + 1}: ${line.trim()}`] : [])),
        );
        expect(heavy).toEqual([]);
    });
});
