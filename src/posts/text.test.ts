import { describe, expect, it } from 'vitest';
import { postParagraphs, postSummary } from './text';

describe('postParagraphs', () => {
    it('splits at blank lines and trims each paragraph', () => {
        const paragraphs = postParagraphs('Erster Absatz.\n\nZweiter Absatz.\n\n\nDritter, mit mehr Leerzeilen.');
        expect(paragraphs.map((p) => p.map((i) => i.text).join(''))).toEqual([
            'Erster Absatz.',
            'Zweiter Absatz.',
            'Dritter, mit mehr Leerzeilen.',
        ]);
    });

    it('drops empty paragraphs', () => {
        expect(postParagraphs('\n\n\n\n')).toEqual([]);
        expect(postParagraphs('')).toEqual([]);
    });

    it('keeps a single line break inside a paragraph as \\n', () => {
        const [paragraph] = postParagraphs('Zeile eins\nZeile zwei');
        expect(paragraph).toEqual([{ kind: 'text', text: 'Zeile eins\nZeile zwei' }]);
    });

    it('marks **bold** text as its own inline, text around it stays plain', () => {
        const [paragraph] = postParagraphs('Bitte **Werkzeug** mitbringen.');
        expect(paragraph).toEqual([
            { kind: 'text', text: 'Bitte ' },
            { kind: 'strong', text: 'Werkzeug' },
            { kind: 'text', text: ' mitbringen.' },
        ]);
    });

    it('keeps only the text of a link, dropping the address', () => {
        const [paragraph] = postParagraphs('Mehr auf der [Gemeinde-Website](https://example.church.tools).');
        expect(paragraph).toEqual([{ kind: 'text', text: 'Mehr auf der Gemeinde-Website.' }]);
    });

    it('never produces HTML', () => {
        const paragraphs = postParagraphs('<b>Nicht</b> als HTML, nur als Daten.');
        expect(paragraphs[0]?.map((i) => i.text).join('')).toBe('<b>Nicht</b> als HTML, nur als Daten.');
    });
});

describe('postSummary', () => {
    it('takes the first paragraph as plain text on one line', () => {
        expect(postSummary('Zeile eins\nZeile zwei\n\nZweiter Absatz.')).toBe('Zeile eins Zeile zwei');
    });

    it('removes bold markers and link addresses', () => {
        expect(postSummary('Bitte **Akkuschrauber** mitbringen, siehe [hier](https://example.church.tools).')).toBe(
            'Bitte Akkuschrauber mitbringen, siehe hier.',
        );
    });

    it('is empty for empty content', () => {
        expect(postSummary('')).toBe('');
    });
});
