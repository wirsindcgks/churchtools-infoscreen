import { mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import type { HeartbeatDoc } from '../model/heartbeat';
import { makePlaylist } from '../model/testing';
import { provideStageContext, type StageContext } from '../player/context';
import type { PlaylistOverview } from '../store/screen-repository';
import LiveFlag from './LiveFlag.vue';
import PlaylistCard from './PlaylistCard.vue';

const NOW = new Date('2026-10-05T12:40:00Z');
const left = { id: 's1', slug: 'foyer-links', name: 'Foyer links' };
const overview: PlaylistOverview = {
    playlist: { ...makePlaylist({ id: 'p1', name: 'Gottesdienst' }), stage: { width: 1920, height: 1080 }, revision: 1 },
    firstSlide: null,
    slideCount: 0,
    media: [],
    screens: [left],
    editedAt: null,
    editedBy: null,
};
const beat = (overrides: Partial<HeartbeatDoc> = {}): HeartbeatDoc => ({
    kind: 'heartbeat',
    screen: 'foyer-links',
    at: '2026-10-05T12:32:00Z',
    version: '0.18.1',
    playlistId: 'p1',
    clockConfirmed: true,
    ...overrides,
});

function card(heartbeats: Map<string, HeartbeatDoc> | null | undefined, draft?: { updatedBy: string; updatedAt: string } | null) {
    const context = reactive<StageContext>({
        now: NOW,
        timeZone: 'Europe/Berlin',
        clockConfirmed: true,
        churchName: '',
        appointments: [],
        media: new Map(),
    });
    const Host = defineComponent({
        setup() {
            provideStageContext(context);
            return () => h(PlaylistCard, { overview, heartbeats, now: NOW, draft });
        },
    });
    return mount(Host, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, SlideThumb: true } } });
}

describe('PlaylistCard – "Läuft gerade" (Plan.md 77)', () => {
    it('shows the mark with the tooltip when a screen reports this playlist', () => {
        const flag = card(new Map([['foyer-links', beat()]])).get('[data-testid="playlist-live"]');
        expect(flag.text()).toBe('Läuft gerade');
        expect(flag.attributes('title')).toBe('Läuft gerade auf „Foyer links“ – laut Lebenszeichen von 14:32');
        expect(flag.classes()).toContain('overlay');
        expect(flag.find('.alive-dot').classes()).toContain('is-online');
    });

    it('has no mark for another playlist, an old sign, none at all, or unreadable ones', () => {
        const none = '[data-testid="playlist-live"]';
        expect(card(new Map([['foyer-links', beat({ playlistId: 'p2' })]])).find(none).exists()).toBe(false);
        expect(card(new Map([['foyer-links', beat({ at: '2026-10-05T11:00:00Z' })]])).find(none).exists()).toBe(false);
        expect(card(new Map()).find(none).exists()).toBe(false);
        expect(card(null).find(none).exists()).toBe(false);
        expect(card(undefined).find(none).exists()).toBe(false);
    });
});

describe('PlaylistCard – "Entwurf" (Plan.md 79, Paket E)', () => {
    it('carries the mark with who and when once a draft exists', () => {
        const flag = card(null, { updatedBy: 'Anna', updatedAt: '2026-10-05T12:32:00Z' }).get('[data-testid="draft-flag"]');
        expect(flag.text()).toBe('Entwurf');
        expect(flag.attributes('title')).toBe('Entwurf von Anna, heute 14:32 – noch nicht veröffentlicht');
    });

    it('has no mark without a draft', () => {
        expect(card(null).find('[data-testid="draft-flag"]').exists()).toBe(false);
        expect(card(null, null).find('[data-testid="draft-flag"]').exists()).toBe(false);
    });
});

// The same mark stands in the editor's bar (Plan.md 77); it is built from the same parts.
describe('LiveFlag', () => {
    it('names the screens and carries the label for the dot alone', () => {
        const flag = mount(LiveFlag, {
            props: {
                live: [
                    { screen: left, at: '2026-10-05T12:32:00Z' },
                    { screen: { id: 's2', slug: 'r', name: 'Foyer rechts' }, at: '2026-10-05T12:35:00Z' },
                ],
                timeZone: 'Europe/Berlin',
            },
        });
        const title = 'Läuft gerade auf „Foyer links“, „Foyer rechts“ – laut Lebenszeichen von 14:35';
        expect(flag.attributes('title')).toBe(title);
        expect(flag.attributes('aria-label')).toBe(`Läuft gerade – ${title}`);
    });
});
