/**
 * Keeps a player alive on a device nobody watches (Plan.md, Risiko 2):
 * shows the last good state first, refreshes configuration and data on
 * separate jittered intervals, backs off on errors, reloads itself for newer
 * data, once a night and after half an hour of errors, and keeps showing old
 * content rather than nothing.
 */
import { reactive } from 'vue';
import type { Appointment } from '../appointments/normalize';
import { NotAuthenticatedError, WrongPersonError } from '../ct/client';
import { SchemaTooNewError } from '../model/read';
import { ScreenNotFoundError, type ContentRevisions, type LoadedScreen } from '../store/screen-repository';
import { loadCached, reviveAppointments, saveCached, type CachedState } from './cache';
import { checkClock } from './clock';
import { appointmentNeeds, appointmentWindow, type PlayerData } from './data';
import { backoffDelay, INTERVALS, msUntilNightlyReload, withJitter, withTimeout } from './timing';

/**
 * Shown when the browser of a TV is not signed in – its address lacks the
 * device login (way B, G9) or the device's password was changed.
 */
export const SIGN_IN_MESSAGE =
    'Dieser Fernseher ist nicht bei ChurchTools angemeldet. Seine Adresse erzeugt ein Administrator im Infoscreen ' +
    'Designer unter „Einstellungen" – mit ihr meldet er sich bei jedem Start selbst an.';

export interface PlayerState {
    phase: 'loading' | 'running' | 'error';
    screen: LoadedScreen | null;
    appointments: Appointment[];
    timeZone: string;
    churchName: string;
    churchLogo: string | null;
    clockConfirmed: boolean;
    /** Set while the shown content is older than the last failed refresh. */
    staleSince: Date | null;
    error: string | null;
}

export interface PlayerDeps {
    now: () => Date;
    reload: () => void;
    /**
     * Whether the page itself would load again. Without a service worker (G10)
     * a reload during a network outage leaves the browser's error page – worse
     * than the old content it replaces.
     */
    canReload: () => Promise<boolean>;
    loadCached: (slug: string) => Promise<CachedState | null>;
    saveCached: (slug: string, state: CachedState) => Promise<void>;
}

export const browserDeps: PlayerDeps = {
    now: () => new Date(),
    reload: () => window.location.reload(),
    async canReload() {
        try {
            const response = await withTimeout(fetch(window.location.href, { method: 'HEAD', cache: 'no-store' }));
            return response.ok;
        } catch {
            return false;
        }
    },
    loadCached,
    saveCached,
};

/**
 * Which stored state the player shows: the administrators' screen revision,
 * the designers' schedule revision (schema 1.2) and the revisions of the
 * playlists it shows (1.4) – a save of content touches only those.
 */
/** Whether designers saved something the loaded screen does not show yet – content, schedule or the theme (1.9). */
export function contentChanged(loaded: LoadedScreen, revisions: ContentRevisions): boolean {
    if ((loaded.schedule?.revision ?? null) !== revisions.schedule) return true;
    if (revisions.theme !== undefined && themeRevision(loaded) !== revisions.theme) return true;
    return loaded.playlists.some((p) => (revisions.playlists[p.id] ?? -1) !== (p.revision ?? 0));
}

function themeRevision(loaded: LoadedScreen): number | null {
    return loaded.theme ? (loaded.theme.revision ?? 0) : null;
}

function configVersion(loaded: LoadedScreen | null): string | undefined {
    if (!loaded) return undefined;
    const playlists = loaded.playlists.map((p) => `${p.id}:${p.revision ?? 0}`).join(',');
    return `${loaded.screen.revision}/${loaded.schedule?.revision ?? 0}/${playlists}/${themeRevision(loaded) ?? '-'}`;
}

export function createPlayer(slug: string, data: PlayerData, deps: PlayerDeps = browserDeps) {
    const state = reactive<PlayerState>({
        phase: 'loading',
        screen: null,
        appointments: [],
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        churchName: '',
        churchLogo: null,
        clockConfirmed: false,
        staleSince: null,
        error: null,
    });
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let configFailures = 0;
    let dataFailures = 0;
    let stopped = false;
    /**
     * Set by a fatal error. Data refreshes would otherwise switch the player
     * back to "running" – under a human's session they succeed – and hide
     * the error. Only a successful configuration refresh lifts it.
     */
    let blocked = false;
    /** Start of the current run of failures, per cycle; null while it succeeds. */
    const failingSince: Record<'config' | 'data', Date | null> = { config: null, data: null };

    /**
     * The last self-healing step (Plan.md, MVP): after half an hour of nothing
     * but errors, start afresh – a stuck session or a broken state in memory
     * is gone after a reload. The counter lives in memory, so a reload that
     * does not help comes at most every half hour.
     */
    async function noteFailure(cycle: 'config' | 'data'): Promise<void> {
        const now = deps.now();
        const since = (failingSince[cycle] ??= now);
        if (now.getTime() - since.getTime() < INTERVALS.reloadAfterFailingMs) return;
        if (await deps.canReload()) {
            console.warn(`Infoscreen „${slug}": seit ${since.toISOString()} nur Fehler – lade neu.`);
            deps.reload();
        }
    }

    function later(ms: number, action: () => void): ReturnType<typeof setTimeout> | undefined {
        if (stopped) return undefined;
        const timer = setTimeout(() => {
            timers.delete(timer);
            action();
        }, ms);
        timers.add(timer);
        return timer;
    }

    let configTimer: ReturnType<typeof setTimeout> | undefined;
    /** One pending configuration refresh at a time, however it was triggered. */
    function scheduleConfig(ms: number): void {
        if (configTimer) {
            clearTimeout(configTimer);
            timers.delete(configTimer);
        }
        configTimer = later(ms, configCycle);
    }

    /**
     * A screen with rules waits for the first clock check before it shows
     * anything: until then only the default playlist may run, and the TV
     * would switch to the scheduled one a moment later (seen after a reload,
     * 2026-09-25). Without rules nothing depends on the clock.
     */
    function waitsForClock(loaded: LoadedScreen): boolean {
        return loaded.screen.schedule.length > 0 && !state.clockConfirmed;
    }

    /**
     * The quick check (Plan.md, 26): every 20 seconds only the revisions of
     * schedule and playlists; the whole screen is loaded at once when one of
     * them moved. Its failures are left to the full refresh, which reports
     * them – the quick check only waits longer.
     */
    async function quickCycle(): Promise<void> {
        try {
            if (state.screen && !blocked && state.phase === 'running') {
                const revisions = await data.contentRevisions(state.screen.screen.id);
                if (contentChanged(state.screen, revisions)) scheduleConfig(0);
            }
            later(withJitter(INTERVALS.quickCheckMs), quickCycle);
        } catch {
            later(withJitter(INTERVALS.configMs), quickCycle);
        }
    }

    function fail(error: unknown): void {
        if (error instanceof SchemaTooNewError) {
            deps.reload(); // newer data needs newer code
            return;
        }
        // On a TV the one who reads this can fix it: say how, not only what (G32: sessions end).
        const message =
            error instanceof NotAuthenticatedError
                ? SIGN_IN_MESSAGE
                : error instanceof Error
                  ? error.message
                  : String(error);
        const fatal =
            error instanceof ScreenNotFoundError ||
            error instanceof NotAuthenticatedError ||
            error instanceof WrongPersonError;
        if (fatal) blocked = true;
        if (fatal || !state.screen) {
            state.phase = 'error';
            state.error = message;
        } else {
            state.staleSince ??= deps.now();
            // Still waiting for the clock, but the network fails: show what there is, with the default playlist.
            if (state.phase === 'loading') state.phase = 'running';
        }
        console.warn(`Infoscreen „${slug}":`, message);
    }

    async function refreshConfig(): Promise<void> {
        await data.assertSignedIn();
        const screen = await data.loadScreen(slug);
        if (screen.issues.length) console.warn('Beim Lesen übersprungen:', screen.issues);
        state.screen = screen;
        // The screen is there: show it, even if the calendar data fails afterwards –
        // a black TV with "Lade …" helps nobody (seen on the test instance, 2026-09-24).
        // A screen with rules waits for the clock check of `refreshData`, which follows at once.
        if (state.phase === 'loading' && !waitsForClock(screen)) state.phase = 'running';
    }

    async function refreshData(): Promise<void> {
        if (!state.screen || blocked) return;
        const [timeZone, churchName, serverDate, churchLogo] = await Promise.all([
            data.timeZone(),
            data.churchName(),
            data.serverDate(),
            // A logo is decoration: its failure keeps the last one and fails nothing else.
            data.churchLogo().catch(() => state.churchLogo),
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
            churchLogo,
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
            churchLogo,
            savedAt: now.toISOString(),
        });
    }

    async function configCycle(): Promise<void> {
        try {
            const before = configVersion(state.screen);
            await refreshConfig();
            configFailures = 0;
            failingSince.config = null;
            const recovered = blocked;
            blocked = false;
            // A new revision may reference other calendars, and a lifted block shows content again: fetch data now.
            if (recovered || configVersion(state.screen) !== before) await refreshData();
            scheduleConfig(withJitter(INTERVALS.configMs));
        } catch (error) {
            configFailures++;
            fail(error);
            scheduleConfig(backoffDelay(30_000, configFailures));
            await noteFailure('config');
        }
    }

    async function dataCycle(): Promise<void> {
        try {
            await refreshData();
            dataFailures = 0;
            failingSince.data = null;
            later(withJitter(INTERVALS.dataMs), dataCycle);
        } catch (error) {
            dataFailures++;
            fail(error);
            later(backoffDelay(30_000, dataFailures), dataCycle);
            await noteFailure('data');
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
                churchLogo: cached.churchLogo ?? null,
                phase: waitsForClock(cached.screen) ? 'loading' : 'running',
                staleSince: new Date(cached.savedAt),
            } satisfies Partial<PlayerState>);
        }
        later(msUntilNightlyReload(deps.now()), deps.reload);
        later(withJitter(INTERVALS.quickCheckMs), quickCycle);
        await configCycle();
        // Cached content or a failed first load: fetch data now, not in ten minutes.
        if (state.staleSince !== null || state.phase !== 'running') await dataCycle();
        else later(withJitter(INTERVALS.dataMs), dataCycle);
    }

    /** Someone saved: look at the configuration now instead of at the next interval. */
    function refreshNow(): void {
        if (!stopped) scheduleConfig(0);
    }

    function stop(): void {
        stopped = true;
        timers.forEach(clearTimeout);
        timers.clear();
    }

    return { state, start, stop, refreshNow };
}
