/**
 * Every text a person reads comes from the text files in `src/i18n` (Plan.md 79, B1). This test reads each
 * component with the Vue compiler and reports text nodes and static `title`/`aria-label`/`placeholder`/
 * `label`/`alt` attributes that hold letters. `PENDING` lists the components that still carry text; it
 * shrinks until it is empty, and a file in it that is already clean fails, too.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@vue/compiler-sfc';
import { describe, expect, it } from 'vitest';

/** Components still to convert in the last part of B1: the settings. */
const PENDING: string[] = [
    'designer/RefreshRightsDialog.vue',
    'designer/RemoveSetupDialog.vue',
    'views/SetupView.vue',
];

/** Texts that are no wording: unit symbols and the like. Each entry with its reason. */
const ALLOWED: string[] = [
    // The unit of a size next to its number, in every language alike.
    'px',
];

const ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'label', 'alt'];

function vueFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === 'dev' && dir === path.resolve('src') ? [] : vueFiles(full);
        return entry.name.endsWith('.vue') ? [full] : [];
    });
}

// Compiler nodes are loosely typed here: type 1 element, 2 text, 6 attribute.
type Node = { type: number; content?: string | { content?: string }; props?: Node[]; children?: Node[]; name?: string; value?: { content: string } };

function bareTexts(node: Node, found: string[]): void {
    if (node.type === 2) {
        const text = String(node.content).trim();
        if (/\p{L}{2,}/u.test(text) && !ALLOWED.includes(text)) found.push(text);
    }
    if (node.type === 1) {
        for (const prop of node.props ?? []) {
            const value = prop.value?.content;
            if (prop.type === 6 && ATTRIBUTES.includes(prop.name ?? '') && value && /\p{L}{2,}/u.test(value) && !ALLOWED.includes(value)) {
                found.push(`${prop.name}="${value}"`);
            }
        }
    }
    for (const child of node.children ?? []) bareTexts(child, found);
}

describe('no bare text in templates (Plan.md 79, B1)', () => {
    // Tests run from the repository root (jsdom's import.meta.url is no file URL).
    const root = path.resolve('src');
    const files = vueFiles(root).map((file) => path.relative(root, file).split(path.sep).join('/'));

    const report = new Map<string, string[]>();
    for (const file of files) {
        const { descriptor } = parse(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
        const found: string[] = [];
        if (descriptor.template?.ast) bareTexts(descriptor.template.ast as unknown as Node, found);
        report.set(file, found);
    }

    it('finds the components', () => {
        expect(files.length).toBeGreaterThan(20);
    });

    it('lists only existing files in PENDING', () => {
        expect(PENDING.filter((file) => !files.includes(file))).toEqual([]);
    });

    it('no component outside PENDING holds text', () => {
        const dirty = files.filter((file) => !PENDING.includes(file) && report.get(file)!.length > 0);
        expect(dirty.map((file) => `${file}: ${report.get(file)!.slice(0, 3).join(' | ')}`)).toEqual([]);
    });

    it('every file in PENDING still holds text', () => {
        expect(PENDING.filter((file) => report.get(file)?.length === 0)).toEqual([]);
    });
});
