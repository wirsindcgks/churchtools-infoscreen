import { describe, expect, it } from 'vitest';
import { readHeartbeat } from './heartbeat';

describe('readHeartbeat (Plan.md 59, 111)', () => {
    const raw = { kind: 'heartbeat', screen: 'foyer', at: '2026-10-05T12:32:00Z', version: '0.48.2', playlistId: 'p1', clockConfirmed: true };

    it('reads contentAt when it is a string', () => {
        expect(readHeartbeat({ ...raw, contentAt: '2026-10-05T10:00:00Z' })?.contentAt).toBe('2026-10-05T10:00:00Z');
    });

    it('leaves it out when it is missing, empty or not a string', () => {
        for (const contentAt of [undefined, '', 5, null, {}]) {
            expect(readHeartbeat({ ...raw, contentAt })).not.toHaveProperty('contentAt');
        }
    });

    it('still reads a sign of life of an older player', () => {
        expect(readHeartbeat(raw)).toMatchObject({ screen: 'foyer', version: '0.48.2' });
    });
});
