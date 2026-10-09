import { describe, expect, it } from 'vitest';
import type { HeartbeatDoc } from '../model/heartbeat';
import type { ScreenRef } from '../store/screen-repository';
import { ALIVE_WINDOW_MS, aliveState, liveSaveTitle, liveScreens, liveTitle } from './alive';

const AT = '2026-10-05T12:32:00Z';
const beat = (overrides: Partial<HeartbeatDoc> = {}): HeartbeatDoc => ({
    kind: 'heartbeat',
    screen: 'foyer',
    at: AT,
    version: '0.17.0',
    playlistId: null,
    clockConfirmed: true,
    ...overrides,
});
const after = (ms: number) => new Date(Date.parse(AT) + ms);

describe('aliveState (Plan.md 59)', () => {
    it('is online within the window, with the time and version in the tooltip', () => {
        const state = aliveState(beat(), after(60_000), 'Europe/Berlin');
        expect(state.kind).toBe('online');
        expect(state.text).toBe('online');
        expect(state.title).toBe('Letztes Lebenszeichen am 5. Oktober 2026 um 14:32 · Player 0.17.0');
    });

    it('is still online exactly at the limit and offline a moment after', () => {
        expect(aliveState(beat(), after(ALIVE_WINDOW_MS), 'Europe/Berlin').kind).toBe('online');
        expect(aliveState(beat(), after(ALIVE_WINDOW_MS + 1), 'Europe/Berlin').kind).toBe('offline');
    });

    it('says since when it is offline, in the given time zone', () => {
        const late = after(2 * 60 * 60_000);
        expect(aliveState(beat(), late, 'Europe/Berlin').text).toBe('nicht online seit 05.10.2026, 14:32');
        expect(aliveState(beat(), late, 'America/New_York').text).toBe('nicht online seit 05.10.2026, 08:32');
    });

    it('counts a sign of life in the future as online', () => {
        expect(aliveState(beat(), after(-10 * 60_000), 'Europe/Berlin').kind).toBe('online');
    });

    it('is never without a sign of life or with an unreadable time', () => {
        for (const heartbeat of [undefined, beat({ at: 'kein Datum' }), beat({ at: '' })]) {
            const state = aliveState(heartbeat, after(0), 'Europe/Berlin');
            expect(state.kind).toBe('never');
            expect(state.text).toBe('noch nie abgerufen');
            expect(state.title).toContain('noch nie gemeldet');
        }
    });

    it('leaves out the version when there is none', () => {
        expect(aliveState(beat({ version: '' }), after(0), 'Europe/Berlin').title).toBe(
            'Letztes Lebenszeichen am 5. Oktober 2026 um 14:32',
        );
    });
});

describe('liveScreens (Plan.md 77)', () => {
    const left: ScreenRef = { id: 's1', slug: 'foyer-links', name: 'Foyer links' };
    const right: ScreenRef = { id: 's2', slug: 'foyer-rechts', name: 'Foyer rechts' };
    const map = (...beats: HeartbeatDoc[]) => new Map(beats.map((b) => [b.screen, b]));

    it('lists an online screen that reports this playlist, with the time of its sign', () => {
        const beats = map(beat({ screen: 'foyer-links', playlistId: 'p1' }));
        expect(liveScreens('p1', [left, right], beats, after(60_000))).toEqual([{ screen: left, at: AT }]);
    });

    it('skips an online screen that shows another playlist', () => {
        const beats = map(beat({ screen: 'foyer-links', playlistId: 'p2' }), beat({ screen: 'foyer-rechts', playlistId: null }));
        expect(liveScreens('p1', [left, right], beats, after(60_000))).toEqual([]);
    });

    it('skips a screen whose sign is older than the window', () => {
        const beats = map(beat({ screen: 'foyer-links', playlistId: 'p1' }));
        expect(liveScreens('p1', [left], beats, after(ALIVE_WINDOW_MS)).length).toBe(1);
        expect(liveScreens('p1', [left], beats, after(ALIVE_WINDOW_MS + 1))).toEqual([]);
    });

    it('skips a screen without a sign of life', () => {
        expect(liveScreens('p1', [left, right], map(beat({ screen: 'other', playlistId: 'p1' })), after(0))).toEqual([]);
    });

    it('gives nothing where the signs cannot be read', () => {
        expect(liveScreens('p1', [left], null, after(0))).toEqual([]);
    });

    it('words the tooltips: all names, the youngest time in the given zone, and the delay of a save', () => {
        const live = [
            { screen: left, at: '2026-10-05T12:30:00Z' },
            { screen: right, at: AT },
        ];
        expect(liveTitle(live, 'Europe/Berlin')).toBe(
            'Läuft gerade auf „Foyer links“, „Foyer rechts“ – laut Lebenszeichen von 14:32',
        );
        expect(liveSaveTitle(live.slice(0, 1))).toBe(
            'Läuft gerade auf „Foyer links“ – nach dem Veröffentlichen dort in etwa 20 Sekunden zu sehen',
        );
    });
});
