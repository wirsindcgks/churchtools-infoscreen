import { describe, expect, it } from 'vitest';
import type { PositionDoc } from '../model/position';
import { firstName, lastClickText, monitorList, monitorState, pickMonitor, rehearsalWithoutSheet } from './monitor-state';

const NOW = Date.parse('2026-11-26T10:00:00Z');
const context = { timeZone: 'Europe/Berlin' };
const position = (over: Partial<PositionDoc> = {}): PositionDoc => ({ kind: 'position', screenId: 's1', playlistId: 'p1', playlistName: 'Ablauf', advance: 'time', seq: 0, at: '2026-11-26T09:59:00Z', ...over });
const clicking = (over: Partial<PositionDoc> = {}): PositionDoc =>
    position({
        advance: 'click',
        slideId: 'b',
        number: 2,
        total: 3,
        slides: [
            { id: 'a', name: 'Begrüßung' },
            { id: 'b', name: 'Lieder' },
            { id: 'c', name: 'Segen' },
        ],
        ...over,
    });

describe('monitorList, pickMonitor (Plan.md 135 C)', () => {
    const catalog = {
        screens: [{ id: 'a', name: 'Probenraum' }, { id: 'b', name: 'Bühne' }],
        clickScreens: [{ id: 'b', name: 'Bühne (Klick)' }, { id: 'c', name: 'Saal' }],
    };

    it('joins the screens of both releases, each once by id, the rehearsal screens first', () => {
        expect(monitorList(catalog)).toEqual([
            { id: 'a', name: 'Probenraum', rehearsal: true },
            { id: 'b', name: 'Bühne', rehearsal: true },
            { id: 'c', name: 'Saal', rehearsal: false },
        ]);
        expect(monitorList({ screens: [], clickScreens: [] })).toEqual([]);
        expect(monitorList(null)).toEqual([]);
    });

    it('keeps the remembered monitor while it is released, else takes the first', () => {
        const list = monitorList(catalog);
        expect(pickMonitor(list, 'c')?.name).toBe('Saal');
        expect(pickMonitor(list, 'gone')?.name).toBe('Probenraum');
        expect(pickMonitor(list, null)?.name).toBe('Probenraum');
        expect(pickMonitor([], 'a')).toBeNull();
    });
});

describe('monitorState (Plan.md 135 C)', () => {
    it('is nothing without a position', () => {
        expect(monitorState(null, context)).toBeNull();
    });

    it('the service: green, with the start of the event, the songs of the agenda in the middle', () => {
        const state = monitorState(position({ songsheet: { source: 'agenda', eventId: 7 } }), { ...context, eventStartMs: Date.parse('2026-11-26T09:30:00Z') })!;
        expect(state).toMatchObject({ kind: 'service', chip: 'Gottesdienst', detail: '10:30', middle: 'service' });
        expect(monitorState(position({ songsheet: { source: 'agenda', eventId: 7 } }), context)).toMatchObject({ chip: 'Gottesdienst', detail: null });
    });

    it('the rehearsal: yellow, until when and who started it', () => {
        const rehearsal = { until: '2026-11-26T18:11:00Z', by: 'Anna' };
        expect(monitorState(position({ rehearsal, songsheet: { source: 'rehearsal' } }), context)).toMatchObject({
            kind: 'rehearsal',
            chip: 'Probe',
            detail: 'bis 19:11 · Anna',
            middle: 'rehearsal',
        });
        expect(monitorState(position({ rehearsal: { until: rehearsal.until } }), context)!.detail).toBe('bis 19:11');
    });

    it('the presentation at the click: violet, with its name', () => {
        const state = monitorState(clicking(), context)!;
        expect(state).toMatchObject({ kind: 'presentation', chip: 'Präsentation', detail: 'Ablauf', middle: 'slides' });
        expect(monitorState(clicking({ advance: 'time-click' }), context)!.kind).toBe('presentation');
        expect(monitorState(clicking({ playlistName: undefined }), context)!.detail).toBeNull();
    });

    it('the schedule: grey, nothing to switch; the middle stays empty', () => {
        expect(monitorState(position(), context)).toEqual({ kind: 'schedule', chip: 'Zeitplan', detail: 'Ablauf', middle: 'none' });
    });

    it('a songsheet of the rehearsal shows its song, also without a rehearsal override', () => {
        expect(monitorState(position({ songsheet: { source: 'rehearsal' } }), context)).toMatchObject({ kind: 'schedule', middle: 'rehearsal' });
    });

    it('chooses one middle: the songsheet beats the slides, an unknown songsheet (true) does not', () => {
        expect(monitorState(clicking({ songsheet: { source: 'agenda', eventId: 7 } }), context)!.middle).toBe('service');
        expect(monitorState(clicking({ songsheet: { source: 'rehearsal' } }), context)!.middle).toBe('rehearsal');
        expect(monitorState(clicking({ songsheet: true }), context)!.middle).toBe('slides');
        expect(monitorState(position({ songsheet: true }), context)!.middle).toBe('none');
    });
});

describe('lastClickText', () => {
    it('names who clicked, the first name only, and how long ago', () => {
        expect(lastClickText('Anna Beispiel', NOW - 5000, NOW)).toBe('zuletzt Anna, vor 5 s');
        expect(lastClickText(null, NOW - 90_000, NOW)).toBe('zuletzt vor 1 Min.');
    });
});

describe('rehearsalWithoutSheet (Plan.md 135 D)', () => {
    const rehearsal = { until: '2026-11-26T11:00:00Z' };

    it('is true for a rehearsal without a songsheet or with one of unknown source', () => {
        expect(rehearsalWithoutSheet(position({ rehearsal }))).toBe(true);
        expect(rehearsalWithoutSheet(position({ rehearsal, songsheet: true }))).toBe(true);
    });

    it('is false with a songsheet of the rehearsal or of the service, without a rehearsal and without a position', () => {
        expect(rehearsalWithoutSheet(position({ rehearsal, songsheet: { source: 'rehearsal' } }))).toBe(false);
        expect(rehearsalWithoutSheet(position({ rehearsal, songsheet: { source: 'agenda', eventId: 7 } }))).toBe(false);
        expect(rehearsalWithoutSheet(position())).toBe(false);
        expect(rehearsalWithoutSheet(null)).toBe(false);
    });
});

describe('firstName (user, 2026-11-27: the last name only takes room)', () => {
    it('keeps the first name of who clicked or started the rehearsal', () => {
        expect(firstName('Tobias Nikola')).toBe('Tobias');
        expect(firstName('  Anna  ')).toBe('Anna');
        expect(firstName('')).toBeNull();
        expect(firstName(null)).toBeNull();
    });
});
