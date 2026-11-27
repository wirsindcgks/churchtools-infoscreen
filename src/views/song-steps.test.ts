import { describe, expect, it } from 'vitest';
import type { AgendaEvent, LiveItem } from '../agenda/live';
import type { SheetSection, SongSheet } from '../agenda/songsheet';
import { firstSection, partName, songAfter, stayInSong, type SongEntry } from './song-steps';

const sheet = (labels: string[], extra: number[] = []): SongSheet => ({ sections: labels.map((label, n) => ({ label, lines: [], ...(extra.includes(n) ? { extra: true } : {}) })) }) as unknown as SongSheet;
const song = (title: string, parts: string[], extra: number[] = []): LiveItem => ({ title, song: true, sheet: sheet(parts, extra), duration: 0 }) as unknown as LiveItem;
const event = (items: LiveItem[]) => ({ eventId: 5, calendarId: 1, startMs: 0, endMs: 1, items: [{ title: 'Start' } as unknown as LiveItem, ...items] }) as AgendaEvent;
const at = (itemIndex: number, section: number) => ({ itemIndex, section });

describe('stayInSong (Plan.md 124, 135 C)', () => {
    const e = event([song('Eins', ['V', 'C']), song('Zwei', ['V'])]);

    it('steps the parts within a song', () => {
        expect(stayInSong(e, at(1, 0), 1)).toEqual(at(1, 1));
        expect(stayInSong(e, at(1, 1), -1)).toEqual(at(1, 0));
    });

    it('stays at the last part forward and at the first back: no next and no last song', () => {
        expect(stayInSong(e, at(1, 1), 1)).toBeNull();
        expect(stayInSong(e, at(1, 0), -1)).toBeNull();
        expect(stayInSong(e, at(2, 0), 1)).toBeNull();
        expect(stayInSong(e, at(2, 0), -1)).toBeNull();
    });

    it('leads to the first part of the agenda before any is on show', () => {
        expect(stayInSong(e, null, 1)).toEqual(at(1, 0));
        expect(stayInSong(e, null, -1)).toBeNull();
    });

    it('stays at a part outside the flow forward (the next song would follow) and goes back to the last step of the song', () => {
        const extra = event([song('Eins', ['V', 'E'], [1]), song('Zwei', ['V'])]);
        expect(stayInSong(extra, at(1, 1), 1)).toBeNull();
        expect(stayInSong(extra, at(1, 1), -1)).toEqual(at(1, 0));
    });
});

describe('the names and the song after', () => {
    const parts = (labels: string[], extra: number[] = []) => sheet(labels, extra).sections as SheetSection[];

    it('names a part by its label, else by its number', () => {
        const e = event([song('Eins', ['Strophe', ''])]);
        expect(partName(e, at(1, 0))).toBe('Strophe');
        expect(partName(e, at(1, 1))).toBe('Teil 2');
        expect(partName(e, at(1, 5))).toBe('');
        expect(partName(e, null)).toBe('');
    });

    it('chooses the first part in the flow, none for a song without a sheet', () => {
        expect(firstSection(parts(['E', 'V'], [0]))).toBe(1);
        expect(firstSection(parts(['E'], [0]))).toBe(0);
        expect(firstSection([])).toBeNull();
    });

    it('takes the song after the one on show, else the first from where the plan reached', () => {
        const entry = (index: number): SongEntry => ({ index, title: `Lied ${index}`, parts: [] });
        const songs = [entry(2), entry(4), entry(6)];
        expect(songAfter(songs, songs[0]!, 1)?.index).toBe(4);
        expect(songAfter(songs, songs[2]!, 1)).toBeNull();
        expect(songAfter(songs, null, 3)?.index).toBe(4);
        expect(songAfter(songs, null, 1)?.index).toBe(2);
    });
});
