/**
 * The songs of the agendas in the next 28 days and whether their arrangement has a file with chords (Plan.md 121): the list
 * "Lieder" in the inspector of the block "Liedblatt". Without right 313 ChurchTools sends an empty list (G82), so "empty"
 * with songs on the agenda means "cannot read", not "no files".
 */
import { songFileStatus, type SongFileStatus } from '../agenda/songsheet';
import { liveItems } from '../agenda/live';
import { fetchAgenda, fetchAgendaSongs, fetchEventList } from '../ct/api';
import { httpStatus } from '../ct/client';
import { appointmentWindow } from '../player/data';
import { withTimeout } from '../player/timing';

export interface SongRow {
    eventId: number;
    startMs: number;
    title: string;
    arrangement?: string;
    status: SongFileStatus;
}

export type SongOverview = { state: 'ok'; rows: SongRow[] } | { state: 'denied' };

const DAYS = 28;
const KEEP_MS = 60_000;

let remembered: { key: string; at: number; promise: Promise<SongOverview> } | null = null;

/** For tests: forget the remembered answer. */
export function resetSongOverview(): void {
    remembered = null;
}

/** The same calendars within a minute give the same answer, so switching between blocks does not load again. */
export function loadSongOverview(calendarIds: number[], now: Date, timeZone: string): Promise<SongOverview> {
    const key = [...calendarIds].sort((a, b) => a - b).join(',');
    if (remembered && remembered.key === key && Date.now() - remembered.at < KEEP_MS) return remembered.promise;
    const promise = readSongOverview(calendarIds, now, timeZone);
    const entry = { key, at: Date.now(), promise };
    remembered = entry;
    promise.catch(() => {
        if (remembered === entry) remembered = null;
    });
    return promise;
}

async function readSongOverview(calendarIds: number[], now: Date, timeZone: string): Promise<SongOverview> {
    const { from, to } = appointmentWindow(now, timeZone, DAYS);
    const wanted = new Set(calendarIds);
    const events = (await withTimeout(fetchEventList(from, to, timeZone)))
        .filter((e) => typeof e.id === 'number' && e.isCanceled !== true && wanted.has(Number(e.calendar?.domainIdentifier)))
        .sort((a, b) => Date.parse(a.startDate ?? '') - Date.parse(b.startDate ?? ''));
    const parts = await Promise.all(
        events.map(async (e): Promise<{ rows: SongRow[]; denied: boolean }> => {
            const eventId = e.id!;
            const startMs = Date.parse(e.startDate ?? '');
            try {
                const agenda = await withTimeout(fetchAgenda(eventId));
                const songs = liveItems(agenda.items ?? []).filter((item) => item.arrangementId !== undefined);
                if (!songs.length) return { rows: [], denied: false };
                const files = new Map<number, { name?: string | null }[]>();
                const list = await withTimeout(fetchAgendaSongs(eventId));
                for (const song of list) {
                    for (const arrangement of song.arrangements ?? []) {
                        if (typeof arrangement.id === 'number') files.set(arrangement.id, arrangement.files ?? []);
                    }
                }
                if (!list.length) return { rows: [], denied: true };
                return {
                    denied: false,
                    rows: songs.map((item) => ({
                        eventId,
                        startMs,
                        title: item.title,
                        ...(item.songDetails?.arrangement ? { arrangement: item.songDetails.arrangement } : {}),
                        status: songFileStatus(files.get(item.arrangementId!) ?? []),
                    })),
                };
            } catch (error) {
                const status = httpStatus(error);
                if (status === 404) return { rows: [], denied: false };
                if (status === 403) return { rows: [], denied: true };
                throw error;
            }
        }),
    );
    const rows = parts.flatMap((p) => p.rows);
    // "Denied" only where no event gave a row; a readable one shows its rows.
    return !rows.length && parts.some((p) => p.denied) ? { state: 'denied' } : { state: 'ok', rows };
}
