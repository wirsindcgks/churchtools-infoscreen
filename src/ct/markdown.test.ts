import { describe, expect, it } from 'vitest';
import { markdownBlocks, markdownLines, markdownText } from './markdown';

const texts = (parts: { text: string }[]) => parts.map((p) => p.text).join('');

describe('markdownBlocks', () => {
    it('splits paragraphs at blank lines and keeps a single line break as \\n', () => {
        const blocks = markdownBlocks('Erster Absatz.\nZweite Zeile.\n\n\nZweiter Absatz.');
        expect(blocks).toHaveLength(2);
        expect(blocks[0]).toEqual({ kind: 'paragraph', inlines: [{ text: 'Erster Absatz.\nZweite Zeile.' }] });
    });

    it('drops empty input and blocks', () => {
        expect(markdownBlocks('')).toEqual([]);
        expect(markdownBlocks('\n\n  \n')).toEqual([]);
        expect(markdownBlocks('![nur ein Bild](https://x.church.tools/a.png)')).toEqual([]);
    });

    it('reads bold, italic, strikethrough and code', () => {
        const [block] = markdownBlocks('**fett** __auch__ *kursiv* _auch_ ~~durch~~ `code`');
        expect(block).toEqual({
            kind: 'paragraph',
            inlines: [
                { text: 'fett', strong: true },
                { text: ' ' },
                { text: 'auch', strong: true },
                { text: ' ' },
                { text: 'kursiv', em: true },
                { text: ' ' },
                { text: 'auch', em: true },
                { text: ' ' },
                { text: 'durch', del: true },
                { text: ' ' },
                { text: 'code', code: true },
            ],
        });
    });

    it('nests bold and italic', () => {
        const [block] = markdownBlocks('***beides*** und **fett mit *kursiv* darin**');
        expect(block).toMatchObject({
            inlines: [
                { text: 'beides', strong: true, em: true },
                { text: ' und ' },
                { text: 'fett mit ', strong: true },
                { text: 'kursiv', strong: true, em: true },
                { text: ' darin', strong: true },
            ],
        });
    });

    it('leaves snake_case and lone asterisks alone, and reads escapes as characters', () => {
        expect(texts((markdownBlocks('a snake_case_name und 2 * 3')[0] as { inlines: { text: string }[] }).inlines)).toBe(
            'a snake_case_name und 2 * 3',
        );
        const [block] = markdownBlocks('\\*kein kursiv\\*');
        expect(block).toEqual({ kind: 'paragraph', inlines: [{ text: '*kein kursiv*' }] });
    });

    it('reads headings of every level', () => {
        expect(markdownBlocks('# Titel\n###### Klein')).toEqual([
            { kind: 'heading', inlines: [{ text: 'Titel' }] },
            { kind: 'heading', inlines: [{ text: 'Klein' }] },
        ]);
    });

    it('reads bullet lists with -, * and +', () => {
        expect(markdownBlocks('- a\n- b\n\n* c\n+ **d**')).toEqual([
            { kind: 'list', ordered: false, start: 1, items: [[{ text: 'a' }], [{ text: 'b' }]] },
            { kind: 'list', ordered: false, start: 1, items: [[{ text: 'c' }], [{ text: 'd', strong: true }]] },
        ]);
    });

    it('reads numbered lists with their start number', () => {
        expect(markdownBlocks('3. drei\n4) vier')).toEqual([
            { kind: 'list', ordered: true, start: 3, items: [[{ text: 'drei' }], [{ text: 'vier' }]] },
        ]);
    });

    it('flattens nested lists', () => {
        const [list] = markdownBlocks('- a\n  - b\n- c');
        expect(list).toMatchObject({ kind: 'list' });
        expect((list as { items: unknown[] }).items).toHaveLength(3);
    });

    it('reads quotes', () => {
        expect(markdownBlocks('> Zeile eins\n> Zeile zwei')).toEqual([
            { kind: 'quote', inlines: [{ text: 'Zeile eins\nZeile zwei' }] },
        ]);
    });

    it('keeps only the title of a mention, with the formatting around it', () => {
        const [block] = markdownBlocks(
            'Hallo [Max Muster](https://x.church.tools/persons/5?ctmd_layout=mention) und ~~alt~~ **neu**',
        );
        expect(block).toEqual({
            kind: 'paragraph',
            inlines: [{ text: 'Hallo Max Muster und ' }, { text: 'alt', del: true }, { text: ' ' }, { text: 'neu', strong: true }],
        });
    });

    it('keeps the title of a card mention that stands alone', () => {
        expect(markdownBlocks('[Jugend](https://x.church.tools/groups/3?ctmd_layout=compact-card)')).toEqual([
            { kind: 'paragraph', inlines: [{ text: 'Jugend' }] },
        ]);
    });

    it('drops tables and images', () => {
        const blocks = markdownBlocks('Vorher\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nNachher ![Bild](https://x/y.png) Ende');
        expect(blocks.map((b) => texts((b as { inlines: { text: string }[] }).inlines))).toEqual(['Vorher', 'Nachher  Ende']);
    });

    it('never produces markup: tags fall away, script elements with their content', () => {
        const blocks = markdownBlocks('<script>alert(1)</script>\n\n<b>fett</b> und <img src=x onerror=alert(1)>');
        expect(blocks).toEqual([{ kind: 'paragraph', inlines: [{ text: 'fett und' }] }]);
    });

    it('turns code blocks into plain text', () => {
        expect(markdownBlocks('```\n**kein fett**\n```\n\n    eingerückt')).toEqual([
            { kind: 'paragraph', inlines: [{ text: '**kein fett**' }] },
            { kind: 'paragraph', inlines: [{ text: 'eingerückt' }] },
        ]);
    });
});

describe('markdownText', () => {
    it('puts everything on one line without markers', () => {
        expect(markdownText('# Titel\n\nBitte **Akkuschrauber** mitbringen, siehe [hier](https://x.church.tools).\n- a\n- b')).toBe(
            'Titel Bitte Akkuschrauber mitbringen, siehe hier. a, b',
        );
    });

    it('can stop after the first block', () => {
        expect(markdownText('Zeile eins\nZeile zwei\n\nZweiter Absatz.', true)).toBe('Zeile eins Zeile zwei');
    });

    it('is empty for empty text', () => {
        expect(markdownText('')).toBe('');
    });
});

describe('markdownLines', () => {
    it('makes a bold line of a heading, a line per item and per line break', () => {
        const lines = markdownLines('# Titel\n\nEins\nZwei\n\n- a\n- b\n\n2. x\n3. y\n\n> Zitat');
        expect(lines.map(texts)).toEqual(['Titel', 'Eins', 'Zwei', '• a', '• b', '2. x', '3. y', 'Zitat']);
        expect(lines[0]).toEqual([{ text: 'Titel', strong: true }]);
    });
});
