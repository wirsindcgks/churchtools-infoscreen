import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAgenda, fetchAgendaSongs, fetchEventList } from '../ct/api';
import { loadSongOverview, resetSongOverview } from './song-overview';

vi.mock('../ct/api');

const now = new Date('2026-11-11T10:00:00Z');
const zone = 'Europe/Berlin';
const event = (id: number, calendar: string, startDate: string) => ({ id, startDate, endDate: startDate, calendar: { domainIdentifier: calendar } });
const point = (title: string, arrangementId: number) => ({ type: 'song', title: '', song: { title, arrangementId }, duration: 300 });
const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });

beforeEach(() => {
    vi.resetAllMocks();
    resetSongOverview();
});

describe('loadSongOverview (Plan.md 121)', () => {
    it('lists the songs of the chosen calendars with the state of their files', async () => {
        vi.mocked(fetchEventList).mockResolvedValue([event(2, '1', '2026-11-22T09:00:00Z'), event(1, '1', '2026-11-15T09:00:00Z'), event(3, '9', '2026-11-16T09:00:00Z')]);
        vi.mocked(fetchAgenda).mockImplementation(async (id) => (id === 1 ? { items: [point('Gut', 10), point('Leer', 11)] } : { items: [] }));
        vi.mocked(fetchAgendaSongs).mockResolvedValue([
            { id: 1, arrangements: [{ id: 10, files: [{ name: 'gut.chordpro' }] }, { id: 11, files: [] }] },
        ]);
        const result = await loadSongOverview([1], now, zone);
        expect(result.state).toBe('ok');
        if (result.state !== 'ok') return;
        expect(result.rows.map((r) => [r.eventId, r.title, r.status])).toEqual([
            [1, 'Gut', 'chords'],
            [1, 'Leer', 'none'],
        ]);
        expect(fetchAgenda).not.toHaveBeenCalledWith(3);
    });

    it('skips an event without an agenda (404)', async () => {
        vi.mocked(fetchEventList).mockResolvedValue([event(1, '1', '2026-11-15T09:00:00Z'), event(2, '1', '2026-11-22T09:00:00Z')]);
        vi.mocked(fetchAgenda).mockImplementation(async (id) => {
            if (id === 1) throw httpError(404);
            return { items: [point('Lied', 5)] };
        });
        vi.mocked(fetchAgendaSongs).mockResolvedValue([{ id: 1, arrangements: [{ id: 5, files: [{ name: 'a.pdf' }] }] }]);
        const result = await loadSongOverview([1], now, zone);
        expect(result).toEqual({ state: 'ok', rows: [expect.objectContaining({ eventId: 2, status: 'pdf' })] });
    });

    it('is denied on a 403 for the songs', async () => {
        vi.mocked(fetchEventList).mockResolvedValue([event(1, '1', '2026-11-15T09:00:00Z')]);
        vi.mocked(fetchAgenda).mockResolvedValue({ items: [point('Lied', 5)] });
        vi.mocked(fetchAgendaSongs).mockRejectedValue(httpError(403));
        expect(await loadSongOverview([1], now, zone)).toEqual({ state: 'denied' });
    });

    it('is denied on an empty list of songs where the agenda has songs', async () => {
        vi.mocked(fetchEventList).mockResolvedValue([event(1, '1', '2026-11-15T09:00:00Z')]);
        vi.mocked(fetchAgenda).mockResolvedValue({ items: [point('Lied', 5)] });
        vi.mocked(fetchAgendaSongs).mockResolvedValue([]);
        expect(await loadSongOverview([1], now, zone)).toEqual({ state: 'denied' });
    });

    it('does not load again within a minute', async () => {
        vi.mocked(fetchEventList).mockResolvedValue([]);
        await loadSongOverview([2, 1], now, zone);
        await loadSongOverview([1, 2], now, zone);
        expect(fetchEventList).toHaveBeenCalledTimes(1);
    });
});
