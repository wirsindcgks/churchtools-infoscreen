/**
 * Keeps a player alive on a device nobody watches (Plan.md, Risiko 2):
 * shows the last good state first, refreshes configuration and data on
 * separate jittered intervals, backs off on errors, reloads itself for newer
 * data and once a night, and keeps showing old content rather than nothing.
 */
import { reactive } from 'vue';
import type { Appointment } from '../appointments/normalize';
import { NotAuthenticatedError } from '../ct/client';
import { SchemaTooNewError } from '../model/read';
import { ScreenNotFoundError, type LoadedScreen } from '../store/screen-repository';
import { loadCached, reviveAppointments, saveCached, type CachedState } from './cache';
import { checkClock } from './clock';
import { appointmentNeeds, appointmentWindow, type PlayerData } from './data';
import { backoffDelay, INTERVALS, msUntilNightlyReload, withJitter } from './timing';

export interface PlayerState {
    phase: 'loading' | 'running' | 'error';
    screen: LoadedScreen | null;
    appointments: Appointment[];
    timeZone: string;
    churchName: string;
    clockConfirmed: boolean;
    /** Set while the shown content is older than the last failed refresh. */
    staleSince: Date | null;
    error: string | null;
}

export interface PlayerDeps {
    now: () => Date;
    reload: () => void;
    loadCached: (slug: string) => Promise<CachedState | null>;
    saveCached: (slug: string, state: CachedState) => Promise<void>;
}

const browserDeps: PlayerDeps = {
    now: () => new Date(),
    reload: () => window.location.reload(),
    loadCached,
    saveCached,
};

export function createPlayer(slug: string, data: PlayerData, deps: PlayerDeps = browserDeps) {
    const state = reactive<PlayerState>({
        phase: 'loading',
        screen: null,
        appointments: [],
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        churchName: '',
        clockConfirmed: false,
        staleSince: null,
        error: null,
    });
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let configFailures = 0;
    let dataFailures = 0;
    let stopped = false;

    function later(ms: number, action: () => void): void {
        if (stopped) return;
        const timer = setTimeout(() => {
            timers.delete(timer);
            action();
        }, ms);
        timers.add(timer);
    }

    function fail(error: unknown): void {
        if (error instanceof SchemaTooNewError) {
            deps.reload(); // newer data needs newer code
            return;
        }
        const message = error instanceof Error ? error.message : String(error);
        const fatal = error instanceof ScreenNotFoundError || error instanceof NotAuthenticatedError;
        if (fatal || !state.screen) {
            state.phase = 'error';
            state.error = message;
        } else {
            state.staleSince ??= deps.now();
        }
        console.warn(`Infoscreen „${slug}":`, message);
    }

    async function refreshConfig(): Promise<void> {
        await data.assertSignedIn();
        const screen = await data.loadScreen(slug);
        if (screen.issues.length) console.warn('Beim Lesen übersprungen:', screen.issues);
        state.screen = screen;
    }

    async function refreshData(): Promise<void> {
        if (!state.screen) return;
        const [timeZone, churchName, serverDate] = await Promise.all([
            data.timeZone(),
            data.churchName(),
            data.serverDate(),
        ]);
        const now = deps.now();
        const needs = appointmentNeeds(state.screen.screen, state.screen.slides);
        const window = appointmentWindow(now, timeZone, needs.days);
        const appointments = needs.calendarIds.length
            ? await data.appointments(needs.calendarIds, window.from, window.to, timeZone)
            : [];

        Object.assign(state, {
            timeZone,
            churchName,
            appointments,
            clockConfirmed: checkClock(serverDate, now).confirmed,
            phase: 'running',
            staleSince: null,
            error: null,
        } satisfies Partial<PlayerState>);
        await deps.saveCached(slug, {
            screen: state.screen,
            appointments,
            timeZone,
            churchName,
            savedAt: now.toISOString(),
        });
    }

    async function configCycle(): Promise<void> {
        try {
            const before = state.screen?.screen.revision;
            await refreshConfig();
            configFailures = 0;
            // A new revision may reference other calendars: fetch data right away.
            if (state.screen?.screen.revision !== before) await refreshData();
            later(withJitter(INTERVALS.configMs), configCycle);
        } catch (error) {
            configFailures++;
            fail(error);
            later(backoffDelay(30_000, configFailures), configCycle);
        }
    }

    async function dataCycle(): Promise<void> {
        try {
            await refreshData();
            dataFailures = 0;
            later(withJitter(INTERVALS.dataMs), dataCycle);
        } catch (error) {
            dataFailures++;
            fail(error);
            later(backoffDelay(30_000, dataFailures), dataCycle);
        }
    }

    async function start(): Promise<void> {
        const cached = await deps.loadCached(slug);
        if (cached) {
            Object.assign(state, {
                screen: cached.screen,
                appointments: reviveAppointments(cached.appointments),
                timeZone: cached.timeZone,
                churchName: cached.churchName,
                phase: 'running',
                staleSince: new Date(cached.savedAt),
            } satisfies Partial<PlayerState>);
        }
        later(msUntilNightlyReload(deps.now()), deps.reload);
        await configCycle();
        // Cached content or a failed first load: fetch data now, not in ten minutes.
        if (state.staleSince !== null || state.phase !== 'running') await dataCycle();
        else later(withJitter(INTERVALS.dataMs), dataCycle);
    }

    function stop(): void {
        stopped = true;
        timers.forEach(clearTimeout);
        timers.clear();
    }

    return { state, start, stop };
}
