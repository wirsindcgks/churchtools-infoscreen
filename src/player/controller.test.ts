import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotAuthenticatedError, WrongPersonError } from '../ct/client';
import { SchemaTooNewError } from '../model/read';
import { DEMO_BUNDLE } from '../dev/demo';
import { DEFAULT_THEME, type Block } from '../model/schema';
import type { Group, HomepageGroups } from '../groups/normalize';
import type { Post } from '../posts/normalize';
import { ScreenNotFoundError, type LoadedScreen } from '../store/screen-repository';
import type { CachedState } from './cache';
import { contentChanged, createCanReload, createPlayer, type PlayerDeps } from './controller';
import type { PlayerData } from './data';
import { askServiceWorkerHasPage } from './service-worker';
import { INTERVALS } from './timing';

const NOW = new Date('2026-10-04T08:00:00Z');
const loaded = (revision = 1): LoadedScreen => ({
    schedule: null,
    ...DEMO_BUNDLE,
    screen: { ...DEMO_BUNDLE.screen, revision },
    media: [],
    issues: [],
});

/** The demo screen with a `posts` block on its first slide, needing group 31. */
const postsBlock: Block = {
    id: 'posts',
    type: 'posts',
    x: 0,
    y: 0,
    width: 1400,
    height: 700,
    groupIds: [31],
    limit: 3,
    maxAgeDays: 30,
    layout: 'card',
    showImage: true,
    showAuthor: false,
    style: { fontFamily: 'sans', fontSize: 56, fontWeight: 400, color: '#fff', align: 'left' },
};
const withPosts = (): LoadedScreen => {
    const base = loaded();
    const [first, ...rest] = base.slides;
    if (!first) return base;
    return { ...base, slides: [{ ...first, blocks: [...first.blocks, postsBlock] }, ...rest] };
};
const samplePost: Post = {
    id: 4,
    groupId: 31,
    groupName: 'ISD-Beitragstest',
    color: '#14b8a6',
    groupInitials: 'I',
    groupImageUrl: null,
    title: 'Biete Akkuschrauber',
    content: 'Text',
    publishedAt: NOW,
    expiresAt: null,
    author: 'Erika Beispiel',
    imageUrl: null,
    imageRatio: null,
};

/** A `groups` block showing the homepage at group 10, as on the test instance (G40). */
const groupsBlock: Block = {
    id: 'groups',
    type: 'groups',
    x: 0,
    y: 0,
    width: 1400,
    height: 700,
    parentGroupId: 10,
    groupIds: [],
    layout: 'card',
    show: { name: true, image: true, when: true, targetGroup: true, category: true, note: true, leaders: false, places: true, qr: true },
    style: { fontFamily: 'sans', fontSize: 56, fontWeight: 400, color: '#fff', align: 'left' },
};
const withGroups = (): LoadedScreen => {
    const base = loaded();
    const [first, ...rest] = base.slides;
    if (!first) return base;
    return { ...base, slides: [{ ...first, blocks: [...first.blocks, groupsBlock] }, ...rest] };
};
const sampleGroup: Group = {
    id: 8,
    name: 'Kinderkirche',
    note: '',
    imageUrl: null,
    weekday: 'Sonntag',
    weekdaySort: 6,
    meetingTime: '10:00',
    targetGroup: '',
    category: '',
    color: '#84cc16',
    leaders: ['Erika Beispiel'],
    freePlaces: null,
    waitinglist: false,
    publicUrl: 'https://example.church.tools/publicgroup/8',
};
const sampleHomepages: HomepageGroups[] = [{ parentGroupId: 10, groups: [sampleGroup] }];

function fakeData(overrides: Partial<PlayerData> = {}): PlayerData {
    return {
        assertSignedIn: vi.fn(async () => {}),
        loadScreen: vi.fn(async () => loaded()),
        // Nothing new: the demo playlist at revision 1, no schedule document.
        contentRevisions: vi.fn(async () => ({ schedule: null, playlists: { 'demo-playlist': 1 } })),
        timeZone: vi.fn(async () => 'Europe/Berlin'),
        churchName: vi.fn(async () => 'Gemeinde'),
        churchLogo: vi.fn(async () => null),
        serverDate: vi.fn(async () => NOW.toUTCString()),
        appointments: vi.fn(async () => []),
        posts: vi.fn(async () => []),
        groupHomepages: vi.fn(async () => []),
        ...overrides,
    };
}

function fakeDeps(cached: CachedState | null = null) {
    const deps: PlayerDeps & { saved: CachedState[] } = {
        now: () => NOW,
        reload: vi.fn(),
        canReload: vi.fn(async () => true),
        loadCached: async () => cached,
        saveCached: async (_slug, state) => {
            deps.saved.push(state);
        },
        saved: [],
    };
    return deps;
}

/** The demo screen with a rule – which playlist runs then depends on the clock. */
const scheduled = (): LoadedScreen => {
    const base = loaded();
    const rule = { kind: 'time' as const, playlistId: 'demo-playlist', weekdays: [1, 2, 3, 4, 5, 6, 7], from: '00:00', to: '23:59' };
    return { ...base, screen: { ...base.screen, schedule: [rule] } };
};

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

describe('player controller', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('checks every 20 s whether designers saved, and loads the screen only when they did (Plan.md 26)', async () => {
        const revisions = { schedule: null as number | null, playlists: { 'demo-playlist': 1 } };
        const data = fakeData({ contentRevisions: vi.fn(async () => revisions) });
        const player = createPlayer('demo', data, fakeDeps());
        await player.start();
        const loads = () => vi.mocked(data.loadScreen).mock.calls.length;
        expect(loads()).toBe(1);

        await vi.advanceTimersByTimeAsync(60_000);
        expect(vi.mocked(data.contentRevisions).mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(loads()).toBe(1); // nothing changed: no full load before the 2-minute refresh

        // A designer saves the playlist: within one quick check the screen is loaded again.
        revisions.playlists = { 'demo-playlist': 2 };
        vi.mocked(data.loadScreen).mockResolvedValue({
            ...loaded(),
            playlists: loaded().playlists.map((p) => ({ ...p, revision: 2 })),
        });
        await vi.advanceTimersByTimeAsync(25_000);
        expect(loads()).toBe(2);
        await vi.advanceTimersByTimeAsync(25_000);
        expect(loads()).toBe(2); // and then rests again
        player.stop();
    });

    it('notices a new schedule the same way, and a failing quick check fails nothing', async () => {
        const contentRevisions = vi
            .fn<PlayerData['contentRevisions']>()
            .mockRejectedValueOnce(new Error('Network Error'))
            .mockResolvedValue({ schedule: 1, playlists: { 'demo-playlist': 1 } });
        const data = fakeData({ contentRevisions });
        const player = createPlayer('demo', data, fakeDeps());
        await player.start();
        await vi.advanceTimersByTimeAsync(25_000);
        expect(player.state.staleSince).toBeNull(); // the quick check reports nothing itself
        await vi.advanceTimersByTimeAsync(2 * 60_000 + 30_000);
        expect(vi.mocked(data.loadScreen).mock.calls.length).toBeGreaterThanOrEqual(2);
        player.stop();
    });

    it('notices a changed theme the same way (Plan.md 27), and ignores data from before themes', async () => {
        const base = loaded();
        expect(contentChanged(base, { schedule: null, playlists: { 'demo-playlist': 1 } })).toBe(false);
        expect(contentChanged(base, { schedule: null, playlists: { 'demo-playlist': 1 }, theme: null })).toBe(false);
        expect(contentChanged(base, { schedule: null, playlists: { 'demo-playlist': 1 }, theme: 1 })).toBe(true);
        const themed = { ...base, theme: { ...DEFAULT_THEME, revision: 1 } };
        expect(contentChanged(themed, { schedule: null, playlists: { 'demo-playlist': 1 }, theme: 1 })).toBe(false);
        expect(contentChanged(themed, { schedule: null, playlists: { 'demo-playlist': 1 }, theme: 2 })).toBe(true);
    });

    it('shows a screen with rules only after the first clock check, not the default playlist first', async () => {
        const clock = deferred<string>();
        const player = createPlayer(
            'demo',
            fakeData({ loadScreen: vi.fn(async () => scheduled()), serverDate: () => clock.promise }),
            fakeDeps(),
        );
        const started = player.start();
        await vi.advanceTimersByTimeAsync(0);
        expect(player.state.screen).not.toBeNull();
        expect(player.state.phase).toBe('loading');
        clock.resolve(NOW.toUTCString());
        await started;
        expect(player.state).toMatchObject({ phase: 'running', clockConfirmed: true });
        player.stop();
    });

    it('waits with the cached state too, but shows it with the default playlist when the network fails', async () => {
        const cached: CachedState = {
            screen: scheduled(),
            appointments: [],
            timeZone: 'Europe/Berlin',
            churchName: 'Gemeinde',
            churchLogo: null,
            savedAt: NOW.toISOString(),
        };
        const offline = () => Promise.reject(new Error('Network Error'));
        const player = createPlayer(
            'demo',
            fakeData({ assertSignedIn: offline, timeZone: offline }),
            fakeDeps(cached),
        );
        await player.start();
        expect(player.state.phase).toBe('running');
        expect(player.state.clockConfirmed).toBe(false); // so the default playlist runs
        expect(player.state.staleSince).not.toBeNull();
        player.stop();
    });

    it('shows a screen without rules at once, before its data', async () => {
        const clock = deferred<string>();
        const player = createPlayer('demo', fakeData({ serverDate: () => clock.promise }), fakeDeps());
        const started = player.start();
        await vi.advanceTimersByTimeAsync(0);
        expect(player.state.phase).toBe('running');
        clock.resolve(NOW.toUTCString());
        await started;
        player.stop();
    });

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

    it('keeps the last logo when the logo cannot be fetched, and fails nothing else', async () => {
        const churchLogo = vi
            .fn<PlayerData['churchLogo']>()
            .mockResolvedValueOnce('https://gemeinde.example/images/109/abc')
            .mockRejectedValue(new Error('Network Error'));
        const player = createPlayer('demo', fakeData({ churchLogo }), fakeDeps());
        await player.start();
        expect(player.state.churchLogo).toBe('https://gemeinde.example/images/109/abc');
        await vi.advanceTimersByTimeAsync(15 * 60_000);
        expect(churchLogo.mock.calls.length).toBeGreaterThan(1);
        expect(player.state.churchLogo).toBe('https://gemeinde.example/images/109/abc');
        expect(player.state.staleSince).toBeNull();
        player.stop();
    });

    it('asks only for the calendars the blocks use', async () => {
        const data = fakeData();
        const player = createPlayer('demo', data, fakeDeps());
        await player.start();
        expect(vi.mocked(data.appointments).mock.calls[0]?.[0]).toEqual([1, 2, 3]);
        player.stop();
    });

    it('fetches the posts a posts block needs, a few more than its limit, and saves them offline', async () => {
        const posts = vi.fn<PlayerData['posts']>(async () => [samplePost]);
        const deps = fakeDeps();
        const player = createPlayer('demo', fakeData({ loadScreen: async () => withPosts(), posts }), deps);
        await player.start();
        expect(posts).toHaveBeenCalledWith([31], 8); // Math.min(20, 3 + 5)
        expect(player.state.posts).toEqual([samplePost]);
        expect(deps.saved[0]?.posts).toEqual([samplePost]);
        player.stop();
    });

    it('keeps the last posts when they cannot be fetched, and lets the data cycle succeed anyway', async () => {
        const posts = vi
            .fn<PlayerData['posts']>()
            .mockResolvedValueOnce([samplePost])
            .mockRejectedValue(new Error('Network Error'));
        const player = createPlayer('demo', fakeData({ loadScreen: async () => withPosts(), posts }), fakeDeps());
        await player.start();
        expect(player.state.posts).toEqual([samplePost]);
        await vi.advanceTimersByTimeAsync(15 * 60_000);
        expect(player.state.posts).toEqual([samplePost]); // kept, not cleared
        expect(player.state.phase).toBe('running');
        expect(player.state.staleSince).toBeNull();
        player.stop();
    });

    it('fetches the homepages the groups blocks need and saves their groups offline (Plan.md 43)', async () => {
        const groupHomepages = vi.fn<PlayerData['groupHomepages']>(async () => sampleHomepages);
        const deps = fakeDeps();
        const player = createPlayer('demo', fakeData({ loadScreen: async () => withGroups(), groupHomepages }), deps);
        await player.start();
        expect(groupHomepages).toHaveBeenCalledWith([10]);
        expect(player.state.groupHomepages).toEqual(sampleHomepages);
        expect(deps.saved[0]?.groupHomepages).toEqual(sampleHomepages);
        player.stop();
    });

    it('asks for no homepage without a groups block', async () => {
        const groupHomepages = vi.fn<PlayerData['groupHomepages']>(async () => sampleHomepages);
        const player = createPlayer('demo', fakeData({ groupHomepages }), fakeDeps());
        await player.start();
        expect(groupHomepages).not.toHaveBeenCalled();
        expect(player.state.groupHomepages).toEqual([]);
        player.stop();
    });

    it('keeps the last groups when they cannot be fetched, and lets the data cycle succeed anyway', async () => {
        const groupHomepages = vi
            .fn<PlayerData['groupHomepages']>()
            .mockResolvedValueOnce(sampleHomepages)
            .mockRejectedValue(new Error('Network Error'));
        const player = createPlayer('demo', fakeData({ loadScreen: async () => withGroups(), groupHomepages }), fakeDeps());
        await player.start();
        await vi.advanceTimersByTimeAsync(15 * 60_000);
        expect(player.state.groupHomepages).toEqual(sampleHomepages); // kept, not cleared
        expect(player.state.phase).toBe('running');
        expect(player.state.staleSince).toBeNull();
        player.stop();
    });

    it('shows the cached groups after a restart without network', async () => {
        const cached: CachedState = {
            screen: withGroups(),
            appointments: [],
            groupHomepages: sampleHomepages,
            timeZone: 'Europe/Berlin',
            churchName: 'Gemeinde',
            savedAt: '2026-10-03T20:00:00Z',
        };
        const offline = new Error('Network Error');
        const data = fakeData({ assertSignedIn: vi.fn(async () => Promise.reject(offline)), timeZone: () => Promise.reject(offline) });
        const player = createPlayer('demo', data, fakeDeps(cached));
        await player.start();
        expect(player.state.groupHomepages).toEqual(sampleHomepages);
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
        expect(player.state.error).toContain('Einstellungen');
        player.stop();
    });

    it('refuses to run under someone else than the device account, even with a cached state', async () => {
        const cached: CachedState = {
            screen: loaded(),
            appointments: [],
            timeZone: 'Europe/Berlin',
            churchName: 'Gemeinde',
            savedAt: '2026-10-03T20:00:00Z',
        };
        const player = createPlayer(
            'demo',
            fakeData({ assertSignedIn: () => Promise.reject(new WrongPersonError(5, 22)) }),
            fakeDeps(cached),
        );
        await player.start();
        expect(player.state.phase).toBe('error');
        expect(player.state.error).toContain('Person 22');
        player.stop();
    });

    it('shows content again once the device account is signed in', async () => {
        const assertSignedIn = vi
            .fn<PlayerData['assertSignedIn']>()
            .mockRejectedValueOnce(new WrongPersonError(5, 22))
            .mockResolvedValue(undefined);
        const player = createPlayer('demo', fakeData({ assertSignedIn }), fakeDeps());
        await player.start();
        expect(player.state.phase).toBe('error');
        await vi.advanceTimersByTimeAsync(30_000);
        expect(player.state.phase).toBe('running');
        expect(player.state.error).toBeNull();
        player.stop();
    });

    it('checks the sign-in for the data cycle too, not only every two minutes (way B)', async () => {
        vi.setSystemTime(NOW);
        const start = Date.now();
        // Succeeds at first (as the config cycle finds it during `start`), then fails well before the
        // data cycle is due – a config cycle in between may catch it too, that does not matter here.
        const assertSignedIn = vi.fn(async () => {
            if (Date.now() - start >= INTERVALS.dataMs / 2) throw new WrongPersonError(5, 22);
        });
        const appointments = vi.fn(async () => []);
        const player = createPlayer('demo', fakeData({ assertSignedIn, appointments }), fakeDeps());
        await player.start();
        expect(player.state.phase).toBe('running');
        const callsBefore = appointments.mock.calls.length;

        await vi.advanceTimersByTimeAsync(INTERVALS.dataMs * 1.3);
        expect(player.state.phase).toBe('error');
        expect(player.state.error).toContain('Person 22');
        expect(appointments.mock.calls.length).toBe(callsBefore); // the failed data cycle fetched nothing
        player.stop();
    });

    describe('after half an hour of nothing but errors', () => {
        const offline = () => Promise.reject(new Error('Network Error'));
        /** A clock that moves with the fake timers. */
        function movingDeps(canReload: boolean) {
            vi.setSystemTime(NOW);
            return { ...fakeDeps(), now: () => new Date(), canReload: vi.fn(async () => canReload) };
        }

        it('reloads when the page itself would load', async () => {
            const deps = movingDeps(true);
            const player = createPlayer('demo', fakeData({ loadScreen: offline }), deps);
            await player.start();
            await vi.advanceTimersByTimeAsync(29 * 60_000);
            expect(deps.reload).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(40 * 60_000);
            expect(deps.reload).toHaveBeenCalled();
            player.stop();
        });

        it('keeps the old content instead of reloading into a network outage (G10)', async () => {
            const deps = movingDeps(false);
            const player = createPlayer('demo', fakeData({ loadScreen: offline }), deps);
            await player.start();
            await vi.advanceTimersByTimeAsync(90 * 60_000);
            expect(deps.canReload).toHaveBeenCalled();
            expect(deps.reload).not.toHaveBeenCalled();
            player.stop();
        });

        it('starts counting anew after a success', async () => {
            const deps = movingDeps(true);
            let calls = 0;
            // Fails, except for one success after about twenty minutes.
            const loadScreen = vi.fn(async () => {
                calls++;
                if (calls === 6) return loaded();
                throw new Error('Network Error');
            });
            const player = createPlayer('demo', fakeData({ loadScreen }), deps);
            await player.start();
            await vi.advanceTimersByTimeAsync(40 * 60_000);
            expect(calls).toBeGreaterThan(6);
            expect(deps.reload).not.toHaveBeenCalled();
            player.stop();
        });
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

    it('waits at least 60 s after a 429, not the usual 30 s (G16)', async () => {
        const rateLimited = Object.assign(new Error('429'), { response: { status: 429, headers: {} } });
        const loadScreen = vi.fn().mockRejectedValueOnce(rateLimited).mockResolvedValue(loaded());
        const player = createPlayer('demo', fakeData({ loadScreen }), fakeDeps());
        await player.start();
        expect(loadScreen.mock.calls.length).toBe(1);
        await vi.advanceTimersByTimeAsync(59_000);
        expect(loadScreen.mock.calls.length).toBe(1); // not yet – the usual 30 s backoff would have retried already
        await vi.advanceTimersByTimeAsync(2_000);
        expect(loadScreen.mock.calls.length).toBe(2);
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

    it('looks again right away when told that something was saved', async () => {
        let revision = 1;
        const loadScreen = vi.fn(async () => loaded(revision));
        const player = createPlayer('demo', fakeData({ loadScreen }), fakeDeps());
        await player.start();
        revision = 2;
        player.refreshNow();
        await vi.advanceTimersByTimeAsync(10);
        expect(player.state.screen?.screen.revision).toBe(2);
        // Still one refresh chain, not two: within the next interval only one more load.
        const calls = loadScreen.mock.calls.length;
        await vi.advanceTimersByTimeAsync(2.5 * 60_000);
        expect(loadScreen.mock.calls.length).toBe(calls + 1);
        player.stop();
    });
});

describe('a screen whose calendar data fails', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('is shown anyway, marked as stale – not left on "Lade …" (seen on the test instance)', async () => {
        const forbidden = Object.assign(new Error('Request failed with status code 403'), { response: { status: 403 } });
        const player = createPlayer('demo', fakeData({ appointments: () => Promise.reject(forbidden) }), fakeDeps());
        await player.start();
        expect(player.state.phase).toBe('running');
        expect(player.state.screen).not.toBeNull();
        expect(player.state.staleSince).not.toBeNull();
        player.stop();
    });
});

describe('createCanReload (Plan.md, 37; G10)', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('is true when the network answers the page itself', async () => {
        const hasPage = vi.fn(async () => false);
        vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })));
        await expect(createCanReload(hasPage)()).resolves.toBe(true);
        expect(hasPage).not.toHaveBeenCalled();
    });

    it('is false when the network fails and no service worker answers', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
        // No injected `hasPage`: the real one sees no `navigator.serviceWorker` in jsdom, i.e. no controller.
        await expect(createCanReload()()).resolves.toBe(false);
    });

    it('is true when the network fails but the worker still has the page cached', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
        const hasPage = vi.fn(async () => true);
        await expect(createCanReload(hasPage)()).resolves.toBe(true);
        expect(hasPage).toHaveBeenCalledWith(window.location.href);
    });

    it('is false when the worker never answers within the time limit', async () => {
        vi.useFakeTimers();
        const port2 = { postMessage: vi.fn() };
        const controller = {
            postMessage: vi.fn((_message: unknown, transfer: [{ onmessage: unknown }]) => {
                // never calls transfer[0].onmessage – the worker stays silent
                void transfer;
            }),
        };
        vi.stubGlobal('MessageChannel', function (this: { port1: unknown; port2: unknown }) {
            this.port1 = {};
            this.port2 = port2;
        });
        vi.stubGlobal('navigator', { ...navigator, serviceWorker: { controller } });
        const result = askServiceWorkerHasPage('https://example.com/player', 1000);
        await vi.advanceTimersByTimeAsync(1000);
        await expect(result).resolves.toBe(false);
        vi.useRealTimers();
    });
});
