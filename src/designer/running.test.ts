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

    it('names the calendars the rules react to, once each', () => {
        expect(ruleCalendarIds([screen, screen])).toEqual([2, 3]);
    });
});
