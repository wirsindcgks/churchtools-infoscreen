/**
 * The module runs inside the ChurchTools page (G6), whose stylesheet is Tailwind (G25): a class of
 * ours that shares a name with one of its utilities gets that utility, too, wherever our own rule
 * does not set the same property. A button named `collapse` stood invisible in ChurchTools, while
 * the demo, without that stylesheet, showed it (Befunde G43). This test keeps such names out.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Utilities of the host that change how an element shows, read from its stylesheet on 2026-09-30
 * (G43) and completed with Tailwind's other names of that kind, should ChurchTools start using them.
 */
const HOST_UTILITIES = [
    'collapse',
    'visible',
    'invisible',
    'hidden',
    'sr-only',
    'contents',
    'flex',
    'grid',
    'table',
    'fixed',
    'absolute',
    'relative',
    'sticky',
    'container',
    'truncate',
    'border',
    'rounded',
    'shadow',
    'outline',
    'ring',
    'italic',
    'underline',
    'uppercase',
    'lowercase',
    'capitalize',
    'grow',
    'shrink',
    'isolate',
    'transform',
    'filter',
    'blur',
    // A form component of the host, in a stylesheet it loads later: `.cts .select { position: relative }` (G43, Nachtrag).
    'select',
];

/**
 * In use and harmless (G43): `block`, `inline` and `static` set what the element has anyway or
 * what our own rule overrides; they are not in the list above.
 */
function vueFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return vueFiles(full);
        return entry.name.endsWith('.vue') ? [full] : [];
    });
}

/** Class names from `class="…"`, from `:class` objects and strings, and from the selectors of `<style>`. */
function classNames(source: string): Set<string> {
    const names = new Set<string>();
    for (const [, list] of source.matchAll(/\sclass="([^"]+)"/g)) list!.split(/\s+/).forEach((n) => names.add(n));
    for (const [, binding] of source.matchAll(/:class="([^"]+)"/g)) {
        for (const [, quoted, key] of binding!.matchAll(/'([\w-]+)'|\b([\w-]+)\s*:/g)) names.add((quoted ?? key)!);
    }
    for (const [, style] of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
        const selectors = style!.replace(/\{[^{}]*\}/g, '{}');
        for (const [, name] of selectors.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) names.add(name!);
    }
    return names;
}

describe('class names next to the host stylesheet (G43)', () => {
    // Tests run from the repository root (jsdom's import.meta.url is no file URL).
    const files = vueFiles(path.resolve('src'));

    it('finds the components', () => {
        expect(files.length).toBeGreaterThan(20);
    });

    it('no component uses a class that ChurchTools styles as a utility', () => {
        const clashes = files.flatMap((file) =>
            [...classNames(fs.readFileSync(file, 'utf8'))]
                .filter((name) => HOST_UTILITIES.includes(name))
                .map((name) => `${path.relative(path.resolve('src'), file)}: .${name}`),
        );
        expect(clashes).toEqual([]);
    });
});
