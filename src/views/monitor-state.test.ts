import { describe, expect, it } from 'vitest';
import type { PositionDoc } from '../model/position';
import { firstName, monitorList, monitorState, pickMonitor, rehearsalWithoutSheet, slideLines } from './monitor-state';

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
        expect(monitorState(null, NOW, context)).toBeNull();
    });

    it('the service: green, with the start of the event, the songs of the agenda in the middle', () => {
        const state = monitorState(position({ songsheet: { source: 'agenda', eventId: 7 } }), NOW, { ...context, eventStartMs: Date.parse('2026-11-26T09:30:00Z') })!;
        expect(state).toMatchObject({ kind: 'service', chip: 'Gottesdienst · 10:30', middle: 'service' });
        expect(monitorState(position({ songsheet: { source: 'agenda', eventId: 7 } }), NOW, context)!.chip).toBe('Gottesdienst');
    });

    it('the rehearsal: yellow, until when and who started it', () => {
        const rehearsal = { until: '2026-11-26T18:11:00Z', by: 'Anna' };
        expect(monitorState(position({ rehearsal, songsheet: { source: 'rehearsal' } }), NOW, context)).toMatchObject({
            kind: 'rehearsal',
            chip: 'Probe',
            lines: ['bis 19:11 · Anna'],
            middle: 'rehearsal',
        });
        expect(monitorState(position({ rehearsal: { until: rehearsal.until } }), NOW, context)!.lines).toEqual(['bis 19:11']);
    });

    it('the presentation at the click: violet, the slide and the last click', () => {
        const state = monitorState(clicking({ by: 'Anna', clickAt: new Date(NOW - 5000).toISOString() }), NOW, context)!;
        expect(state).toMatchObject({ kind: 'presentation', chip: 'Präsentation · Ablauf', middle: 'slides' });
        expect(state.lines).toEqual(['Folie 2 von 3 · Lieder', 'zuletzt Anna, vor 5 s']);
        expect(monitorState(clicking({ advance: 'time-click' }), NOW, context)!.kind).toBe('presentation');
        expect(monitorState(clicking({ playlistName: undefined }), NOW, context)!.chip).toBe('Präsentation');
    });

    it('the schedule: grey, nothing to switch; the middle stays empty', () => {
        expect(monitorState(position(), NOW, context)).toEqual({ kind: 'schedule', chip: 'Zeitplan · Ablauf', lines: [], middle: 'none' });
    });

    it('a songsheet of the rehearsal shows its song, also without a rehearsal override', () => {
        expect(monitorState(position({ songsheet: { source: 'rehearsal' } }), NOW, context)).toMatchObject({ kind: 'schedule', lines: [], middle: 'rehearsal' });
    });

    it('chooses one middle: the songsheet beats the slides, an unknown songsheet (true) does not', () => {
        expect(monitorState(clicking({ songsheet: { source: 'agenda', eventId: 7 } }), NOW, context)!.middle).toBe('service');
        expect(monitorState(clicking({ songsheet: { source: 'rehearsal' } }), NOW, context)!.middle).toBe('rehearsal');
        expect(monitorState(clicking({ songsheet: true }), NOW, context)!.middle).toBe('slides');
        expect(monitorState(position({ songsheet: true }), NOW, context)!.middle).toBe('none');
    });
});

describe('slideLines', () => {
    const shown = { slideId: 'a', number: 1, total: 2, slides: [{ id: 'a', name: '' }] };

    it('names the slide when it has a name, and the last click when there was one', () => {
        expect(slideLines(shown, null, NOW)).toEqual(['Folie 1 von 2']);
        expect(slideLines({ ...shown, slides: [{ id: 'a', name: 'Lieder' }] }, { by: null, at: NOW - 90_000 }, NOW)).toEqual(['Folie 1 von 2 · Lieder', 'zuletzt vor 1 Min.']);
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
