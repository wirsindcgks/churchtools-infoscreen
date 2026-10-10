/**
 * The words of the interface (Plan.md 79, B1): Folie, Präsentation, Bildschirm – never Slide, Playlist, Screen.
 * Code and addresses keep the English words; only the texts a person reads are checked here. The player must not
 * pull the designer's texts into its bundle.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { t } from './designer';
import { tp } from './player';
import { tr } from './repository';

const OLD_WORDS = /\b(Slides?|Playlists?|Screens?)\b/;

/** Every text under a value; functions are called with sample values. */
function texts(value: unknown, where: string): [string, string][] {
    if (typeof value === 'string') return [[where, value]];
    if (typeof value === 'function') {
        const call = (...args: unknown[]): unknown => {
            try {
                return (value as (...args: unknown[]) => unknown)(...args);
            } catch {
                return undefined;
            }
        };
        return [1, 2]
            .flatMap((n) => texts(call(n, n, n), `${where}(${n})`))
            .concat(texts(call('X', 'X', 'X'), `${where}('X')`))
            .concat(texts(call(['X', 'Y'], ['X'], ['X']), `${where}(['X'])`));
    }
    if (value && typeof value === 'object') {
        return Object.entries(value).flatMap(([key, child]) => texts(child, `${where}.${key}`));
    }
    return [];
}

function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(full);
        return /\.(ts|vue)$/.test(entry.name) ? [full] : [];
    });
}

describe('the words of the interface (Plan.md 79, B1)', () => {
    it('reads the texts', () => {
        expect(texts(tp, 'tp').length).toBeGreaterThan(20);
    });

    it('no text says Slide, Playlist or Screen', () => {
        const all = [...texts(t, 't'), ...texts(tp, 'tp'), ...texts(tr, 'tr')];
        expect(all.filter(([, text]) => OLD_WORDS.test(text)).map(([where, text]) => `${where}: ${text}`)).toEqual([]);
    });

    it('the player does not import the designer texts', () => {
        // Tests run from the repository root (jsdom's import.meta.url is no file URL).
        const files = [
            ...sourceFiles(path.resolve('src/player')),
            ...sourceFiles(path.resolve('src/sw')),
            path.resolve('src/views/PlayerView.vue'),
        ].filter((file) => !/\.test\.ts$/.test(file));
        expect(files.length).toBeGreaterThan(20);
        const offenders = files.filter((file) => /from\s+['"][^'"]*i18n\/designer['"]/.test(fs.readFileSync(file, 'utf8')));
        expect(offenders.map((file) => path.relative(path.resolve('src'), file))).toEqual([]);
    });
});
