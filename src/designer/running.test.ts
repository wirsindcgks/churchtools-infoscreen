import { describe, expect, it } from 'vitest';
import type { ScreenDoc } from '../model/schema';
import { makeScreen } from '../model/testing';
import { ruleCalendarIds, runningNow } from './running';

const BERLIN = 'Europe/Berlin';

describe('what a screen shows right now (Plan.md 17)', () => {
    const screen: ScreenDoc = {
        ...makeScreen(),
        defaultPlaylistId: 'woche',
        schedule: [
            { kind: 'time', playlistId: 'gottesdienst', weekdays: [7], from: '09:00', to: '12:00' },
            { kind: 'appointment', playlistId: 'begruessung', calendarIds: [2, 3], minutesBefore: 30, minutesAfter: 10 },
        ],
    };

    it('takes the rule that matches, else the default playlist', () => {
        // Sunday 2026-10-04, 10:00 in Berlin.
        expect(runningNow(screen, { now: new Date('2026-10-04T08:00:00Z'), timeZone: BERLIN, appointments: [] })).toEqual({
            ruleIndex: 0,
            playlistId: 'gottesdienst',
        });
        // Monday.
        expect(runningNow(screen, { now: new Date('2026-10-05T08:00:00Z'), timeZone: BERLIN, appointments: [] })).toEqual({
            ruleIndex: -1,
            playlistId: 'woche',
        });
    });

    it('follows an override by the musicians as the player does (Plan.md 125 D)', () => {
        const now = new Date('2026-10-04T08:00:00Z');
        const doc = { kind: 'override' as const, screenId: screen.id, playlistId: 'probe', at: '2026-10-04T07:30:00Z', until: '2026-10-04T09:00:00Z', by: 'Max' };
        const release = { screenIds: [screen.id], playlistIds: ['probe'] };
        expect(runningNow(screen, { now, timeZone: BERLIN, appointments: [] }, { doc, release })).toEqual({
            ruleIndex: 0,
            playlistId: 'probe',
            override: doc,
        });
        // Not released (also a presentation that lost its rehearsal sheet: the overview leaves it out of the release), ended or run out: the schedule decides.
        for (const override of [
            { doc, release: { screenIds: [screen.id], playlistIds: [] } },
            { doc: { ...doc, ended: true as const }, release },
            { doc: { ...doc, until: '2026-10-04T07:59:00Z' }, release },
        ]) {
            expect(runningNow(screen, { now, timeZone: BERLIN, appointments: [] }, override)).toEqual({ ruleIndex: 0, playlistId: 'gottesdienst' });
        }
    });

    it('names the calendars the rules react to, once each', () => {
        expect(ruleCalendarIds([screen, screen])).toEqual([2, 3]);
    });
});
