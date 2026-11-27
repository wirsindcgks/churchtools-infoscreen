import { describe, expect, it } from 'vitest';
import type { OverrideDoc } from '../agenda/control';
import type { PositionDoc } from '../model/position';
import { endOverride, extendOverride, shownRehearsal, startOverride } from './rehearsal-override';

const HOUR = 3600_000;
const NOW = Date.parse('2026-11-27T10:00:00Z');
const position = (over: Partial<PositionDoc> = {}): PositionDoc => ({ kind: 'position', screenId: 's1', playlistId: 'p1', advance: 'time', seq: 0, at: '2026-11-27T10:00:00Z', ...over });

describe('startOverride (Plan.md 125, 135 D)', () => {
    it('writes screen, presentation, author and the end from now', () => {
        const doc = startOverride('s1', 'p1', 2, NOW, 'Max');
        expect(doc).toEqual({ kind: 'override', screenId: 's1', playlistId: 'p1', until: '2026-11-27T12:00:00.000Z', at: '2026-11-27T10:00:00.000Z', by: 'Max' });
    });

    it('leaves out the author where it is unknown', () => {
        expect(startOverride('s1', 'p1', 1, NOW, '').by).toBeUndefined();
    });

    it('never reaches further than 4 hours from now', () => {
        expect(Date.parse(startOverride('s1', 'p1', 9, NOW, '').until) - NOW).toBe(4 * HOUR);
    });
});

describe('extendOverride', () => {
    const shown = { until: '2026-11-27T10:52:00Z', playlistId: 'p2' };

    it('moves the end that stands by the hours, for the same presentation', () => {
        const doc = extendOverride('s1', shown, 1, NOW, 'Max');
        expect(doc).toMatchObject({ screenId: 's1', playlistId: 'p2', until: '2026-11-27T11:52:00.000Z', at: '2026-11-27T10:00:00.000Z', by: 'Max' });
    });

    it('counts from now where the end has passed', () => {
        expect(extendOverride('s1', { ...shown, until: '2026-11-27T09:00:00Z' }, 2, NOW, '').until).toBe('2026-11-27T12:00:00.000Z');
    });

    it('stays within 4 hours from now', () => {
        const doc = extendOverride('s1', { ...shown, until: '2026-11-27T13:30:00Z' }, 2, NOW, '');
        expect(Date.parse(doc.until) - NOW).toBe(4 * HOUR);
    });
});

describe('endOverride', () => {
    it('is an ended value with the same time for at and until', () => {
        expect(endOverride('s1', NOW, 'Max')).toEqual({ kind: 'override', screenId: 's1', playlistId: '', until: '2026-11-27T10:00:00.000Z', at: '2026-11-27T10:00:00.000Z', ended: true, by: 'Max' });
    });
});

describe('shownRehearsal', () => {
    const reported = position({ playlistId: 'p1', rehearsal: { until: '2026-11-27T11:00:00Z', by: 'Anna' } });
    const written = (over: Partial<OverrideDoc> = {}): OverrideDoc => ({ kind: 'override', screenId: 's1', playlistId: 'p2', until: '2026-11-27T12:00:00Z', at: '2026-11-27T10:00:00Z', by: 'Max', ...over });

    it('takes what the screen reports, with the presentation that runs', () => {
        expect(shownRehearsal(reported, null, NOW)).toEqual({ until: '2026-11-27T11:00:00Z', by: 'Anna', playlistId: 'p1' });
        expect(shownRehearsal(position(), null, NOW)).toBeNull();
        expect(shownRehearsal(null, null, NOW)).toBeNull();
    });

    it('lays the own start over a screen that reports none yet', () => {
        expect(shownRehearsal(position(), written(), NOW + 5000)).toEqual({ until: '2026-11-27T12:00:00Z', by: 'Max', playlistId: 'p2' });
        expect(shownRehearsal(null, written(), NOW + 5000)?.until).toBe('2026-11-27T12:00:00Z');
    });

    it('lays the own extension over the older end, and gives way once the screen reports it', () => {
        expect(shownRehearsal(reported, written(), NOW + 5000)?.until).toBe('2026-11-27T12:00:00Z');
        const caught = position({ rehearsal: { until: '2026-11-27T12:00:00Z', by: 'Anna' } });
        expect(shownRehearsal(caught, written(), NOW + 5000)?.by).toBe('Anna');
    });

    it('shows nothing after the own "Beenden", although the screen still reports the rehearsal', () => {
        expect(shownRehearsal(reported, written({ ended: true, playlistId: '' }), NOW + 5000)).toBeNull();
    });

    it('holds its own write for a minute only', () => {
        expect(shownRehearsal(reported, written({ ended: true, playlistId: '' }), NOW + 61_000)?.by).toBe('Anna');
        expect(shownRehearsal(position(), written(), NOW + 61_000)).toBeNull();
    });
});
