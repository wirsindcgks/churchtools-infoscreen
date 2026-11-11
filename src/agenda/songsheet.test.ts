import { describe, expect, it } from 'vitest';
import type { ControlDoc } from './control';
import type { AgendaEvent, AgendaPick, LiveItem, LivePosition } from './live';
import { liveItems } from './live';
import { lineSegments, pickSheetFile, readChordPro, readSng, readSongSheet, readTxt, sheetKind, sheetOf, sheetPage, songFileStatus, songsheetPick, transposeSheet, type SongSheet } from './songsheet';

// Own texts in the build of the files of SongSelect (G82): sections as `{comment: …}`, bar lines in brackets; `.sng` with byte order mark and `#` head;
// `.txt` with title and authors above and the block with the CCLI numbers below.
const CHORDPRO = `{title: Erfundenes Lied}
{artist: Erika Muster}
{key: G}
{time: 4/4}
{tempo: 72}
{ccli_license: 123456}
{ccli: 7654321}
{copyright: 2024 Beispiel Musik}
{comment: Verse 1}
[G]Der Morgen [D]bricht herein
[Em]Wir sin[C]gen laut
[|] [G] [D] [||:] [Em] [C] [:||]

{comment: Chorus 1}
[C]Hallelu[G]ja

{comment: Misc 1}
(Bridge)
Nur Text hier
{new_page}
{flow: V1 C1}
`;

const SNG = `﻿#LangCount=1
#Title=Erfundenes Lied
#Author=Erika Muster
#CCLI=7654321
#(c)=2024 Beispiel Musik
#VerseOrder=Verse 1,Chorus 1
---
Verse 1
Der Morgen bricht herein
Wir singen laut
---
Chorus 1
Halleluja
`;

const TXT = `Erfundenes Lied
Erika Muster

Verse 1
Der Morgen bricht herein
Wir singen laut

Chorus 1
Halleluja
(REPEAT)

Misc 1
(Interlude)
Ohne Worte

CCLI Song #7654321
(c) 2024 Beispiel Musik
For use solely with the SongSelect Terms of Use. All rights reserved. www.ccli.com
CCLI License #123456
`;

describe('readChordPro (Plan.md 121 B)', () => {
    const sheet = readChordPro(CHORDPRO);

    it('takes the key and the sections from comments, with German headings', () => {
        expect(sheet.key).toBe('G');
        expect(sheet.sections.map((s) => s.label)).toEqual(['Strophe 1', 'Refrain 1', 'Bridge']);
    });

    it('puts the chords above the syllable and keeps bar lines as signs', () => {
        const [first, second, bars] = sheet.sections[0]!.lines;
        expect(first).toEqual({ text: 'Der Morgen bricht herein', chords: [{ at: 0, chord: 'G' }, { at: 11, chord: 'D' }] });
        expect(second!.chords.map((c) => c.chord)).toEqual(['Em', 'C']);
        expect(bars!.chords.map((c) => c.chord)).toEqual(['|', 'G', 'D', '‖:', 'Em', 'C', ':‖']);
    });

    it('takes the heading of "Misc" from the brackets and drops that line', () => {
        expect(sheet.sections[2]!.lines.map((l) => l.text)).toEqual(['Nur Text hier']);
    });

    it('makes the footer from copyright and the CCLI numbers, and leaves other directives out', () => {
        expect(sheet.footer).toBe('© 2024 Beispiel Musik · CCLI-Liednummer 7654321 · CCLI-Lizenznummer 123456');
        expect(JSON.stringify(sheet)).not.toContain('new_page');
    });

    it('reads {start_of_*} and {soc}, and a blank line ends a section', () => {
        const read = readChordPro('{start_of_verse: Strophe 2}\n[C]Eins\n{end_of_verse}\n{soc}\n[F]Zwei\n{eoc}\n\n[G]Drei');
        expect(read.sections.map((s) => s.label)).toEqual(['Strophe 2', 'Refrain', '']);
        expect(read.sections[2]!.lines[0]!.text).toBe('Drei');
    });
});

describe('readSng', () => {
    const sheet = readSng(SNG);

    it('drops the byte order mark and the head, and reads sections apart by ---', () => {
        expect(sheet.sections.map((s) => s.label)).toEqual(['Strophe 1', 'Refrain 1']);
        expect(sheet.sections[0]!.lines.map((l) => l.text)).toEqual(['Der Morgen bricht herein', 'Wir singen laut']);
        expect(sheet.sections[0]!.lines.every((l) => l.chords.length === 0)).toBe(true);
    });

    it('makes the footer from #(c) and #CCLI', () => {
        expect(sheet.footer).toBe('© 2024 Beispiel Musik · CCLI-Liednummer 7654321');
    });
});

describe('readTxt', () => {
    const sheet = readTxt(TXT);

    it('leaves out title and authors and splits at the known headings', () => {
        expect(sheet.sections.map((s) => s.label)).toEqual(['Strophe 1', 'Refrain 1', 'Zwischenspiel']);
        expect(sheet.sections[1]!.lines.map((l) => l.text)).toEqual(['Halleluja', '(REPEAT)']);
        expect(sheet.sections[2]!.lines.map((l) => l.text)).toEqual(['Ohne Worte']);
    });

    it('takes the block at the end as the footer, without the notice of use', () => {
        expect(sheet.footer).toBe('CCLI Song #7654321 · (c) 2024 Beispiel Musik · CCLI License #123456');
    });
});

describe('files', () => {
    it('knows the kind by the ending, case-insensitive', () => {
        expect(sheetKind('Lied.CHO')).toBe('chordpro');
        expect(sheetKind('lied.chopro')).toBe('chordpro');
        expect(sheetKind('lied.Crd')).toBe('chordpro');
        expect(sheetKind('Lied.SNG')).toBe('sng');
        expect(sheetKind('lied.txt')).toBe('txt');
        expect(sheetKind('lied.pro')).toBeNull();
        expect(sheetKind('lied.pdf')).toBeNull();
    });

    it('picks ChordPro before .sng before .txt', () => {
        const files = [{ name: 'a.pdf' }, { name: 'a.txt' }, { name: 'a.sng' }, { name: 'a.chordpro' }];
        expect(pickSheetFile(files)?.file.name).toBe('a.chordpro');
        expect(pickSheetFile(files.slice(0, 3))?.file.name).toBe('a.sng');
        expect(pickSheetFile(files.slice(0, 2))?.kind).toBe('txt');
        expect(pickSheetFile(files.slice(0, 1))).toBeNull();
    });

    it('reads by kind', () => {
        expect(readSongSheet(SNG, 'sng').sections).toHaveLength(2);
    });
});

describe('lineSegments', () => {
    it('cuts the text at the chords; text before the first chord has none', () => {
        expect(lineSegments({ text: 'Der Morgen', chords: [{ at: 4, chord: 'G' }] })).toEqual([{ text: 'Der ' }, { chord: 'G', text: 'Morgen' }]);
        expect(lineSegments({ text: 'Text', chords: [] })).toEqual([{ text: 'Text' }]);
    });
});

describe('transposeSheet', () => {
    const sheet = (key: string, chords: string[]): SongSheet => ({ key, sections: [{ label: '', lines: [{ text: '', chords: chords.map((chord, at) => ({ at, chord })) }] }] });
    const chords = (s: SongSheet) => s.sections[0]!.lines[0]!.chords.map((c) => c.chord);

    it('moves chords with their bass and keeps the rest of the name', () => {
        const moved = transposeSheet(sheet('G', ['G', 'D/F#', 'Em7', 'Csus4', 'Dadd9']), 'A');
        expect(chords(moved)).toEqual(['A', 'E/G#', 'F#m7', 'Dsus4', 'Eadd9']);
        expect(moved.key).toBe('A');
    });

    it('writes flats in a flat key and sharps in a sharp key', () => {
        expect(chords(transposeSheet(sheet('C', ['C', 'F', 'G', 'Am']), 'F'))).toEqual(['F', 'Bb', 'C', 'Dm']);
        expect(chords(transposeSheet(sheet('C', ['C', 'F', 'G', 'Am']), 'D'))).toEqual(['D', 'G', 'A', 'Bm']);
        expect(chords(transposeSheet(sheet('Am', ['Am', 'Dm']), 'Dm'))).toEqual(['Dm', 'Gm']);
        expect(chords(transposeSheet(sheet('C', ['C', 'G/B']), 'Bb'))).toEqual(['Bb', 'F/A']);
    });

    it('moves minor keys among themselves and takes ChurchTools spellings', () => {
        expect(chords(transposeSheet(sheet('Em', ['Em', 'C', 'G']), 'A#m'))).toEqual(['A#m', 'F#', 'C#']);
    });

    it('leaves bar lines and anything unreadable as it is', () => {
        expect(chords(transposeSheet(sheet('G', ['|', 'G', '‖:', 'N.C.']), 'A'))).toEqual(['|', 'A', '‖:', 'N.C.']);
    });

    it('does not transpose between major and minor, equal or unreadable keys', () => {
        const original = sheet('G', ['G']);
        expect(transposeSheet(original, 'Am')).toBe(original);
        expect(transposeSheet(original, 'G')).toBe(original);
        expect(transposeSheet(original, 'H')).toBe(original);
        expect(transposeSheet(original, undefined)).toBe(original);
        const keyless = { ...original, key: undefined };
        expect(transposeSheet(keyless, 'A')).toBe(keyless);
    });
});

describe('songsheetPick – which song the block shows', () => {
    const song = (title: string, duration: number, sheet?: SongSheet): LiveItem => ({ ...liveItems([{ type: 'song', duration, song: { title, key: 'A' } }])[1]!, ...(sheet ? { sheet } : {}) });
    const talk = (title: string): LiveItem => liveItems([{ title, duration: 600 }])[1]!;
    const placeholder = liveItems([])[0]!;
    const event = (items: LiveItem[]): AgendaEvent => ({ eventId: 7, calendarId: 1, startMs: 0, endMs: 1, items: [placeholder, ...items] });
    const at = (index: number): LivePosition => ({ index, set: true, switchMs: 0, addSeconds: 30, offsetMs: 0 });
    const pick = (items: LiveItem[], index: number | null): AgendaPick => ({
        event: event(items),
        position: index === null ? undefined : at(index),
        phase: index === null ? 'upcoming' : 'live',
    });
    const items = [talk('Begrüßung'), song('Erstes', 240), talk('Predigt'), song('Zweites', 0)];

    it('shows no song behind the last point – ChurchTools\' "– Ende –"', () => {
        expect(songsheetPick({ ...pick(items, items.length + 1), phase: 'ended' })).toBeNull();
    });

    it('shows the running song with its length', () => {
        const shown = songsheetPick(pick(items, 2));
        expect(shown).toMatchObject({ upcoming: false, lengthSeconds: 270, id: '7:2' });
        expect(shown!.item.title).toBe('Erstes');
    });

    it('shows the next song, also one without a duration, while another point runs', () => {
        const shown = songsheetPick(pick(items, 3));
        expect(shown).toMatchObject({ upcoming: true, lengthSeconds: null });
        expect(shown!.item.title).toBe('Zweites');
    });

    it('shows a song only when it runs or is the very next point – before the start the first point (user, 2026-11-11)', () => {
        // "Begrüßung" comes first: no song yet, also not "Erstes" behind it.
        expect(songsheetPick(pick(items, null))).toBeNull();
        expect(songsheetPick(pick(items, 0))).toBeNull();
        // A song as first point is shown before the start.
        expect(songsheetPick(pick(items.slice(1), null))!.item.title).toBe('Erstes');
        // While "Begrüßung" runs, "Erstes" is next.
        expect(songsheetPick(pick(items, 1))).toMatchObject({ upcoming: true });
        // While "Erstes" runs nothing of "Zweites" two points on.
        expect(songsheetPick(pick([talk('Begrüßung'), talk('Lesung'), song('Erstes', 240)], 1))).toBeNull();
    });

    it('shows nothing when no song is left or there is none', () => {
        expect(songsheetPick(pick(items, 4))!.item.title).toBe('Zweites');
        expect(songsheetPick(pick([talk('Segen')], 1))).toBeNull();
        expect(songsheetPick(null)).toBeNull();
    });

    describe('with a choice of the musicians (Plan.md 121 E)', () => {
        const sheet: SongSheet = { sections: [{ label: 'A', lines: [] }, { label: 'B', lines: [] }] };
        const withArrangement = (item: LiveItem, arrangementId: number): LiveItem => ({ ...item, arrangementId });
        const list = [talk('Begrüßung'), withArrangement(song('Erstes', 240, sheet), 4), talk('Predigt'), song('Zweites', 0)];
        const control = (extra: Partial<ControlDoc> = {}): ControlDoc => ({ eventId: 7, itemIndex: 2, arrangementId: 4, section: 1, at: '1970-01-01T00:00:10Z', ...extra });

        it('shows the chosen song and part, whatever the agenda runs', () => {
            const shown = songsheetPick(pick(list, 1), control());
            expect(shown).toMatchObject({ upcoming: false, lengthSeconds: null, id: '7:2', section: 1 });
            expect(shown!.item.title).toBe('Erstes');
        });

        it('clamps the part to the sheet, and takes it as it is without one', () => {
            expect(songsheetPick(pick(list, 1), control({ section: 9 }))!.section).toBe(1);
            expect(songsheetPick(pick(list, 1), control({ itemIndex: 4, arrangementId: undefined, section: 9 }))!.section).toBe(9);
        });

        it('is void once the live agenda switched after the choice', () => {
            const late: AgendaPick = { ...pick(list, 3), position: { index: 3, set: true, switchMs: 20_000, addSeconds: 0, offsetMs: 0 } };
            expect(songsheetPick(late, control())!.section).toBeUndefined();
            expect(songsheetPick(late, control({ at: '1970-01-01T00:00:30Z' }))!.section).toBe(1);
        });

        it('is void when given outside the window of the event – after a reset of the live agenda nothing else outdates it', () => {
            // The event runs from 0 to 1 ms: a tip three hours later, or an hour before, no longer counts.
            const reset: AgendaPick = { ...pick(list, 1), position: undefined, phase: 'upcoming' };
            expect(songsheetPick(reset, control({ at: '1970-01-01T03:00:00Z' }))?.section).toBeUndefined();
            expect(songsheetPick(reset, control({ at: '1969-12-31T23:00:00Z' }))?.section).toBeUndefined();
        });

        it('is void for a wrong index, a point that is no song, another arrangement or another event', () => {
            for (const wrong of [{ itemIndex: 9 }, { itemIndex: 0 }, { itemIndex: 3 }, { arrangementId: 5 }, { eventId: 8 }]) {
                expect(songsheetPick(pick(list, 1), control(wrong))!.section).toBeUndefined();
            }
        });
    });

    it('gives the sheet in the key of the arrangement', () => {
        const sheet: SongSheet = { key: 'G', sections: [{ label: '', lines: [{ text: 'x', chords: [{ at: 0, chord: 'G' }] }] }] };
        expect(sheetOf(song('Lied', 0, sheet))!.sections[0]!.lines[0]!.chords[0]!.chord).toBe('A');
        expect(sheetOf(song('Lied', 0))).toBeNull();
    });
});

describe('sheetPage – the page of a running song from its time', () => {
    it('starts on the first page and goes on in equal parts', () => {
        expect(sheetPage(0, 240, 3)).toEqual({ page: 0, turnSeconds: 80 });
        expect(sheetPage(100, 240, 3)?.page).toBe(1);
        expect(sheetPage(200, 240, 3)?.page).toBe(2);
    });

    it('lets no page last less than 8 seconds', () => {
        expect(sheetPage(9, 20, 4)).toEqual({ page: 1, turnSeconds: 8 });
    });

    it('stays on the last page once the time is over, and on the first before it', () => {
        expect(sheetPage(900, 240, 3)?.page).toBe(2);
        expect(sheetPage(-5, 240, 3)?.page).toBe(0);
    });

    it('has no page without a length', () => {
        expect(sheetPage(10, 0, 3)).toBeNull();
    });
});

describe('songFileStatus (Plan.md 121)', () => {
    it('tells chords, lyrics only, PDF only and nothing', () => {
        expect(songFileStatus([{ name: 'a.pdf' }, { name: 'a.chordpro' }])).toBe('chords');
        expect(songFileStatus([{ name: 'a.pdf' }, { name: 'A.SNG' }])).toBe('lyrics');
        expect(songFileStatus([{ name: 'a.txt' }])).toBe('lyrics');
        expect(songFileStatus([{ name: 'Noten.PDF' }])).toBe('pdf');
        expect(songFileStatus([{ name: 'a.mp3' }, { name: null }])).toBe('none');
        expect(songFileStatus([])).toBe('none');
    });
});
