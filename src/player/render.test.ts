import { mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import { normalizeAppointments } from '../appointments/normalize';
import { readSlide } from '../model/read';
import { makeSlide, textBlock } from '../model/testing';
import type { Block, MediaDoc, SlideDoc } from '../model/schema';
import type { Post } from '../posts/normalize';
import { provideStageContext, type StageContext } from './context';
import SlideView from './SlideView.vue';

const BERLIN = 'Europe/Berlin';
const style = { fontFamily: 'sans', fontSize: 40, fontWeight: 400 as const, color: '#fff', align: 'left' as const };

function render(slide: SlideDoc, overrides: Partial<StageContext> = {}) {
    const context = reactive<StageContext>({
        now: new Date('2026-10-04T08:00:00Z'),
        timeZone: BERLIN,
        clockConfirmed: true,
        churchName: 'Gemeinde am Markt',
        appointments: [],
        media: new Map(),
        ...overrides,
    });
    const Host = defineComponent({
        setup() {
            provideStageContext(context);
            return () => h(SlideView, { slide, width: 1920, height: 1080 });
        },
    });
    return mount(Host);
}

describe('rendering a slide', () => {
    it('renders the known blocks of a slide from a newer designer and skips the rest', () => {
        const fromTheFuture = {
            ...makeSlide(),
            blocks: [
                { ...textBlock('a', 'Bekannt'), shimmer: 'gold' },
                { id: 'b', type: 'hologram', x: 0, y: 0, width: 10, height: 10 },
            ],
        };
        const wrapper = render(readSlide(fromTheFuture).doc);
        expect(wrapper.text()).toContain('Bekannt');
        expect(wrapper.findAll('.block')).toHaveLength(1);
    });

    it('positions blocks in stage pixels', () => {
        const wrapper = render(makeSlide({ blocks: [textBlock('a')] }));
        const frame = wrapper.find('.block').attributes('style');
        expect(frame).toContain('left: 100px');
        expect(frame).toContain('width: 800px');
    });

    it('shows the church name in the header block', () => {
        const header: Block = { id: 'h', type: 'church-header', x: 0, y: 0, width: 800, height: 80, showLogo: false, showName: true, style };
        expect(render(makeSlide({ blocks: [header] })).text()).toContain('Gemeinde am Markt');
    });

    it('shows the church logo beside the name, from the device copy when there is one', () => {
        const header: Block = { id: 'h', type: 'church-header', x: 0, y: 0, width: 800, height: 80, showLogo: true, showName: true, style };
        const logo = 'https://gemeinde.example/images/109/abc';
        const sized = `${logo}?w=800&h=80&fit=max`;
        const online = render(makeSlide({ blocks: [header] }), { churchLogo: logo });
        expect(online.find('.logo').attributes('src')).toBe(sized);
        expect(online.text()).toContain('Gemeinde am Markt');
        const offline = render(makeSlide({ blocks: [header] }), { churchLogo: logo, images: new Map([[sized, 'blob:x']]) });
        expect(offline.find('.logo').attributes('src')).toBe('blob:x');
    });

    it('shows the name alone when there is no logo, without an empty image', () => {
        const header: Block = { id: 'h', type: 'church-header', x: 0, y: 0, width: 800, height: 80, showLogo: true, showName: true, style };
        const wrapper = render(makeSlide({ blocks: [header] }), { churchLogo: null });
        expect(wrapper.find('img').exists()).toBe(false);
        expect(wrapper.text()).toContain('Gemeinde am Markt');
    });

    it('shows no clock rather than a wrong one while the device time is unconfirmed', () => {
        const clock: Block = { id: 'c', type: 'clock', x: 0, y: 0, width: 400, height: 80, format: 'time', style };
        expect(render(makeSlide({ blocks: [clock] })).find('.clock').text()).toBe('10:00');
        expect(render(makeSlide({ blocks: [clock] }), { clockConfirmed: false }).find('.clock').text()).toBe('');
    });

    it('lists appointments in local time and says so when there are none', () => {
        const list: Block = {
            id: 'l',
            type: 'appointment-list',
            x: 0,
            y: 0,
            width: 1600,
            height: 600,
            calendarIds: [2],
            horizonDays: 14,
            limit: 5,
            style,
        };
        const appointments = normalizeAppointments(
            [
                {
                    appointment: {
                        base: { id: 4, title: 'Gottesdienst', allDay: false, calendar: { id: 2, name: 'Gottesdienst' } },
                        calculated: { startDate: '2026-10-04T09:00:00Z', endDate: '2026-10-04T10:30:00Z' },
                    },
                },
            ],
            BERLIN,
        );
        expect(render(makeSlide({ blocks: [list] }), { appointments }).text()).toContain('11:00');
        expect(render(makeSlide({ blocks: [list] })).text()).toContain('Keine Termine');
    });

    it('requests images at block size with both dimensions and shows a placeholder for missing media', () => {
        const media: MediaDoc = {
            schema: { major: 1, minor: 0 },
            kind: 'media',
            id: 'm1',
            name: 'Plakat',
            fileId: 46,
            imageUrl: 'https://example.church.tools/images/46/hash',
        };
        const image: Block = { id: 'i', type: 'image', x: 0, y: 0, width: 960, height: 540, mediaId: 'm1', fit: 'contain' };
        const shown = render(makeSlide({ blocks: [image] }), { media: new Map([['m1', media]]) });
        expect(shown.find('img').attributes('src')).toContain('w=960&h=540');

        const missing = render(makeSlide({ blocks: [image] }));
        expect(missing.find('img').exists()).toBe(false);
        expect(missing.find('.placeholder').exists()).toBe(true);
    });
});

describe('rendering posts (Plan.md 33)', () => {
    const post = (overrides: Partial<Post> = {}): Post => ({
        id: 4,
        groupId: 31,
        groupName: 'ISD-Beitragstest',
        color: '#14b8a6',
        title: 'Biete Akkuschrauber',
        content: 'Kann gern ausgeliehen werden.',
        publishedAt: new Date('2026-09-25T08:00:00Z'),
        expiresAt: null,
        author: 'Erika Beispiel',
        imageUrl: null,
        imageRatio: null,
        ...overrides,
    });
    const style = { fontFamily: 'sans', fontSize: 56, fontWeight: 400 as const, color: '#fff', align: 'left' as const };
    const postsBlock = (overrides: Partial<Extract<Block, { type: 'posts' }>> = {}): Block => ({
        id: 'p',
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
        style,
        ...overrides,
    });

    it('shows the title, the group label and the text of the card', () => {
        const wrapper = render(makeSlide({ blocks: [postsBlock()] }), { posts: [post()] });
        expect(wrapper.get('[data-testid="posts-card"]').text()).toContain('Biete Akkuschrauber');
        expect(wrapper.get('[data-testid="posts-card"]').text()).toContain('ISD-Beitragstest');
        expect(wrapper.get('[data-testid="posts-card"]').text()).toContain('Kann gern ausgeliehen werden.');
    });

    it('requests the image at block size with both dimensions', () => {
        const wrapper = render(makeSlide({ blocks: [postsBlock()] }), {
            posts: [post({ imageUrl: 'https://example.church.tools/images/9/hash', imageRatio: 1 })],
        });
        const src = wrapper.get('[data-testid="post-image"]').attributes('src');
        expect(src).toContain('w=');
        expect(src).toContain('h=');
    });

    it('shows the author only when showAuthor is set – the API hands the real name to anyone (G37)', () => {
        const off = render(makeSlide({ blocks: [postsBlock({ showAuthor: false })] }), { posts: [post()] });
        expect(off.find('[data-testid="post-author"]').exists()).toBe(false);
        const on = render(makeSlide({ blocks: [postsBlock({ showAuthor: true })] }), { posts: [post()] });
        expect(on.get('[data-testid="post-author"]').text()).toContain('Erika Beispiel');
    });

    it('shows rows in the list layout', () => {
        const wrapper = render(makeSlide({ blocks: [postsBlock({ layout: 'list' })] }), {
            posts: [post(), post({ id: 5, title: 'Zweiter Beitrag' })],
        });
        expect(wrapper.findAll('[data-testid="post-row"]')).toHaveLength(2);
        expect(wrapper.get('[data-testid="posts-list"]').text()).toContain('Zweiter Beitrag');
    });

    it('shows a calm message without posts, in both layouts', () => {
        expect(render(makeSlide({ blocks: [postsBlock()] })).get('[data-testid="posts-empty"]').text()).toBe(
            'Keine aktuellen Beiträge',
        );
        expect(
            render(makeSlide({ blocks: [postsBlock({ layout: 'list' })] })).get('[data-testid="posts-empty"]').text(),
        ).toBe('Keine aktuellen Beiträge');
    });
});
