import { mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import { makeScreen } from '../model/testing';
import { provideStageContext, type StageContext } from '../player/context';
import type { ScreenOverview } from '../store/screen-repository';
import type { AliveState } from './alive';
import ScreenCard from './ScreenCard.vue';

const overview: ScreenOverview = {
    screen: makeScreen(),
    firstSlide: null,
    slideCount: 0,
    media: [],
    playlistName: null,
    playlists: {},
};

function card(alive?: AliveState | null) {
    const context = reactive<StageContext>({
        now: new Date('2026-10-04T08:00:00Z'),
        timeZone: 'Europe/Berlin',
        clockConfirmed: true,
        churchName: '',
        appointments: [],
        media: new Map(),
    });
    const Host = defineComponent({
        setup() {
            provideStageContext(context);
            return () => h(ScreenCard, { overview, alive });
        },
    });
    return mount(Host, { global: { stubs: { RouterLink: true, SlideThumb: true } } });
}

// The line of the sign of life on a screen tile (Plan.md 59).
describe('ScreenCard – sign of life', () => {
    it('has no line without one – not for a category nobody may see, not after a failed load', () => {
        expect(card(null).find('[data-testid="screen-alive"]').exists()).toBe(false);
        expect(card(undefined).find('[data-testid="screen-alive"]').exists()).toBe(false);
    });

    it('shows the words and the tooltip, and carries the state in the markup', () => {
        const line = card({ kind: 'offline', text: 'nicht online seit 05.10.2026, 14:32', title: 'Letztes Lebenszeichen …' }).get(
            '[data-testid="screen-alive"]',
        );
        expect(line.text()).toBe('nicht online seit 05.10.2026, 14:32');
        expect(line.attributes('data-tip')).toBe('Letztes Lebenszeichen …');
        expect(line.attributes('data-alive')).toBe('offline');
        expect(line.find('.alive-dot').attributes('aria-hidden')).toBe('true');
    });
});

// The two lines under "online" (Plan.md 111).
describe('ScreenCard – software and state', () => {
    const detailed: AliveState = {
        kind: 'online',
        text: 'online',
        title: '',
        software: { text: 'Player 0.48.1, installiert 0.48.2', title: '', notice: true },
        content: { text: 'Stand vom 05.10.2026, 12:00', title: '', notice: false },
    };

    it('shows both lines, the deviation as a hint', () => {
        const wrapper = card(detailed);
        const software = wrapper.get('[data-testid="screen-alive-software"]');
        expect(software.text()).toBe('Player 0.48.1, installiert 0.48.2');
        expect(software.classes()).toContain('is-notice');
        const content = wrapper.get('[data-testid="screen-alive-content"]');
        expect(content.text()).toBe('Stand vom 05.10.2026, 12:00');
        expect(content.classes()).not.toContain('is-notice');
        expect(content.classes()).not.toContain('is-muted');
    });

    it('dims them while the screen is offline, with the tooltip', () => {
        const wrapper = card({
            ...detailed,
            kind: 'offline',
            content: { text: 'Stand vom 05.10.2026, 12:00', title: 'Zuletzt gemeldet', notice: false },
        });
        const content = wrapper.get('[data-testid="screen-alive-content"]');
        expect(content.classes()).toContain('is-muted');
        expect(content.attributes('data-tip')).toBe('Zuletzt gemeldet');
    });

    it('has no lines for a screen that never reported, or without a sign of life', () => {
        expect(card({ kind: 'never', text: 'noch nie abgerufen', title: '' }).find('[data-testid="screen-alive-software"]').exists()).toBe(false);
        expect(card(null).find('[data-testid="screen-alive-content"]').exists()).toBe(false);
    });
});

