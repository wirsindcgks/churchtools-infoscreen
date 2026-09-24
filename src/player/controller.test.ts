import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotAuthenticatedError } from '../ct/client';
import { SchemaTooNewError } from '../model/read';
import { DEMO_BUNDLE } from '../dev/demo';
import { ScreenNotFoundError, type LoadedScreen } from '../store/screen-repository';
import type { CachedState } from './cache';
import { createPlayer, type PlayerDeps } from './controller';
import type { PlayerData } from './data';

const NOW = new Date('2026-10-04T08:00:00Z');
const loaded = (revision = 1): LoadedScreen => ({
    ...DEMO_BUNDLE,
    screen: { ...DEMO_BUNDLE.screen, revision },
    media: [],
    issues: [],
});

function fakeData(overrides: Partial<PlayerData> = {}): PlayerData {
    return {
        assertSignedIn: vi.fn(async () => {}),
        loadScreen: vi.fn(async () => loaded()),
        timeZone: vi.fn(async () => 'Europe/Berlin'),
        churchName: vi.fn(async () => 'Gemeinde'),
        serverDate: vi.fn(async () => NOW.toUTCString()),
        appointments: vi.fn(async () => []),
        ...overrides,
    };
}

function fakeDeps(cached: CachedState | null = null) {
    const deps: PlayerDeps & { saved: CachedState[] } = {
        now: () => NOW,
        reload: vi.fn(),
        loadCached: async () => cached,
        saveCached: async (_slug, state) => {
            deps.saved.push(state);
        },
        saved: [],
    };
    return deps;
}

describe('player controller', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('loads screen and data and confirms the clock', async () => {
        const deps = fakeDeps();
        const player = createPlayer('demo', fakeData(), deps);
        await player.start();
        expect(player.state.phase).toBe('running');
        expect(player.state.churchName).toBe('Gemeinde');
        expect(player.state.clockConfirmed).toBe(true);
        expect(deps.saved).toHaveLength(1);
        player.stop();
    });

    it('asks only for the calendars the blocks use', async () => {
        const data = fakeData();
        const player = createPlayer('demo', data, fakeDeps());
        await player.start();
        expect(vi.mocked(data.appointments).mock.calls[0]?.[0]).toEqual([1, 2, 3]);
        player.stop();
    });

    it('keeps showing the cached state when the network is gone, marked as stale', async () => {
        const cached: CachedState = {
            screen: loaded(),
            appointments: [],
            timeZone: 'Europe/Berlin',
            churchName: 'Gemeinde',
            savedAt: '2026-10-03T20:00:00Z',
        };
        const offline = new Error('Network Error');
        const player = createPlayer(
            'demo',
            fakeData({ assertSignedIn: vi.fn(async () => Promise.reject(offline)), timeZone: () => Promise.reject(offline) }),
            fakeDeps(cached),
        );
        await player.start();
        expect(player.state.phase).toBe('running');
        expect(player.state.screen?.screen.slug).toBe('demo');
        expect(player.state.staleSince).not.toBeNull();
        player.stop();
    });

    it('shows an error instead of an empty screen when nobody is signed in (G20)', async () => {
        const player = createPlayer(
            'demo',
            fakeData({ assertSignedIn: () => Promise.reject(new NotAuthenticatedError()) }),
            fakeDeps(),
        );
        await player.start();
        expect(player.state.phase).toBe('error');
        expect(player.state.error).toContain('angemeldet');
        player.stop();
    });

    it('names an unknown slug', async () => {
        const player = createPlayer(
            'foyer',
            fakeData({ loadScreen: () => Promise.reject(new ScreenNotFoundError('foyer')) }),
            fakeDeps(),
        );
        await player.start();
        expect(player.state.error).toContain('foyer');
        player.stop();
    });

    it('reloads itself for data from a newer schema', async () => {
        const deps = fakeDeps();
        const player = createPlayer('demo', fakeData({ loadScreen: () => Promise.reject(new SchemaTooNewError(2)) }), deps);
        await player.start();
        expect(deps.reload).toHaveBeenCalled();
        player.stop();
    });

    it('picks up a new revision on the next configuration refresh', async () => {
        let revision = 1;
        const data = fakeData({ loadScreen: vi.fn(async () => loaded(revision)) });
        const player = createPlayer('demo', data, fakeDeps());
        await player.start();
        revision = 2;
        await vi.advanceTimersByTimeAsync(3 * 60_000);
        expect(player.state.screen?.screen.revision).toBe(2);
        player.stop();
    });

    it('backs off after errors instead of hammering the instance', async () => {
        const loadScreen = vi.fn(() => Promise.reject(new Error('503')));
        const player = createPlayer('demo', fakeData({ loadScreen }), fakeDeps());
        await player.start();
        await vi.advanceTimersByTimeAsync(10 * 60_000);
        // 30 s, 60 s, 120 s, 240 s … – five attempts in ten minutes, not twenty.
        expect(loadScreen.mock.calls.length).toBeLessThanOrEqual(6);
        player.stop();
    });

    it('treats a device clock far from the server time as unconfirmed', async () => {
        const player = createPlayer(
            'demo',
            fakeData({ serverDate: async () => 'Sun, 01 Oct 2026 00:00:00 GMT' }),
            fakeDeps(),
        );
        await player.start();
        expect(player.state.clockConfirmed).toBe(false);
        player.stop();
    });
});
