/**
 * Last successful state per screen in IndexedDB, so that a device restarting
 * during a network outage still shows something (Plan.md, Player). Failures
 * here are never fatal: without storage the player just has no fallback.
 */
import type { Appointment } from '../appointments/normalize';
import type { LoadedScreen } from '../store/screen-repository';

export interface CachedState {
    screen: LoadedScreen;
    appointments: Appointment[];
    timeZone: string;
    churchName: string;
    /** Missing in states saved before the logo came. */
    churchLogo?: string | null;
    savedAt: string;
}

const DB = 'infoscreen-player';
const STORE = 'state';

function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    try {
        return await new Promise<T>((resolve, reject) => {
            const request = action(db.transaction(STORE, mode).objectStore(STORE));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } finally {
        db.close();
    }
}

export async function loadCached(slug: string): Promise<CachedState | null> {
    try {
        return ((await run('readonly', (s) => s.get(slug))) as CachedState | undefined) ?? null;
    } catch {
        return null;
    }
}

export async function saveCached(slug: string, state: CachedState): Promise<void> {
    try {
        await run('readwrite', (s) => s.put(JSON.parse(JSON.stringify(state)), slug));
    } catch (error) {
        console.warn('Offline-Stand konnte nicht gespeichert werden:', error);
    }
}

/** JSON round trips turn dates into strings; bring them back. */
export function reviveAppointments(appointments: Appointment[]): Appointment[] {
    return appointments.map((a) => ({ ...a, start: new Date(a.start), end: new Date(a.end) }));
}
