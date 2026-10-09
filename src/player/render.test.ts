import { mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import { normalizeAppointments } from '../appointments/normalize';
import type { Group } from '../groups/normalize';
import { readSlide } from '../model/read';
import { makeSlide, textBlock } from '../model/testing';
import type { Block, GroupFields, MediaDoc, SlideDoc } from '../model/schema';
import type { Post } from '../posts/normalize';
import { provideStageContext, type StageContext } from './context';
import SlideView from './SlideView.vue';

const BERLIN = 'Europe/Berlin';
const style = { fontFamily: 'sans', fontSize: 40, fontWeight: 400 as const, color: '#fff', align: 'left' as const };

function render(slide: SlideDoc, overrides: Partial<StageContext> = {}, hiddenBlockId?: string) {
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
            return () => h(SlideView, { slide, width: 1920, height: 1080, hiddenBlockId });
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

    it('hides the text of the block named by hiddenBlockId and of no other (Plan.md 79, C4)', () => {
        const slide = makeSlide({ blocks: [textBlock('a', 'Eins'), textBlock('b', 'Zwei')] });
        const inner = render(slide, {}, 'b').findAll('[data-testid="text-inner"]');
        expect(inner[0]!.attributes('style') ?? '').not.toContain('visibility');
        expect(inner[1]!.attributes('style')).toContain('visibility: hidden');
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
        groupInitials: 'I',
        groupImageUrl: null,
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

    it('shows the group\'s age in the head, "heute" and "vor N Tagen" (Plan.md, "Nachgezogen…")', () => {
        const now = new Date('2026-09-27T08:00:00Z');
        const today = render(makeSlide({ blocks: [postsBlock()] }), {
            now,
            posts: [post({ publishedAt: new Date('2026-09-27T06:00:00Z') })],
        });
        expect(today.get('[data-testid="posts-card"]').text()).toContain('heute');

        const twoDaysAgo = render(makeSlide({ blocks: [postsBlock()] }), {
            now,
            posts: [post({ publishedAt: new Date('2026-09-25T06:00:00Z') })],
        });
        expect(twoDaysAgo.get('[data-testid="posts-card"]').text()).toContain('vor 2 Tagen');
    });

    it('shows the group\'s initials without a picture, an image with one', () => {
        const initials = render(makeSlide({ blocks: [postsBlock()] }), { posts: [post()] });
        expect(initials.get('.hero-avatar').text()).toBe('I');
        expect(initials.find('.hero-avatar img').exists()).toBe(false);

        const withPicture = render(makeSlide({ blocks: [postsBlock()] }), {
            posts: [post({ groupImageUrl: 'https://example.church.tools/images/3/hash' })],
        });
        const avatar = withPicture.get('.hero-avatar img');
        expect(avatar.attributes('src')).toContain('w=');
        expect(avatar.attributes('src')).toContain('h=');
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

    it('puts the image before the text column, at most 60 % of the width, for a landscape block', () => {
        const wrapper = render(makeSlide({ blocks: [postsBlock({ width: 1400, height: 700 })] }), {
            posts: [post({ imageUrl: 'https://example.church.tools/images/9/hash', imageRatio: 1 })],
        });
        const card = wrapper.get('[data-testid="posts-card"]');
        expect(card.classes()).toContain('hero--landscape');
        const children = card.element.children;
        expect(children[0]?.getAttribute('data-testid')).toBe('post-image');
        const width = Number(/width:\s*([\d.]+)px/.exec(children[0]?.getAttribute('style') ?? '')?.[1]);
        expect(width).toBeLessThanOrEqual(1400 * 0.6);
    });

    it('puts the image above the text column for a portrait block', () => {
        const wrapper = render(makeSlide({ blocks: [postsBlock({ width: 700, height: 1000 })] }), {
            posts: [post({ imageUrl: 'https://example.church.tools/images/9/hash', imageRatio: 1 })],
        });
        const card = wrapper.get('[data-testid="posts-card"]');
        expect(card.classes()).toContain('hero--portrait');
        expect(card.element.children[0]?.getAttribute('data-testid')).toBe('post-image');
    });

    it('shows no image without one, or with showImage off', () => {
        const withoutUrl = render(makeSlide({ blocks: [postsBlock()] }), { posts: [post()] });
        expect(withoutUrl.find('[data-testid="post-image"]').exists()).toBe(false);
        const switchedOff = render(makeSlide({ blocks: [postsBlock({ showImage: false })] }), {
            posts: [post({ imageUrl: 'https://example.church.tools/images/9/hash', imageRatio: 1 })],
        });
        expect(switchedOff.find('[data-testid="post-image"]').exists()).toBe(false);
    });

    it('never renders a <p>, whose font size a ChurchTools host page would otherwise override', () => {
        const wrapper = render(makeSlide({ blocks: [postsBlock()] }), { posts: [post()] });
        expect(wrapper.findAll('p')).toHaveLength(0);
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

describe('rendering groups (Plan.md 43)', () => {
    const group = (overrides: Partial<Group> = {}): Group => ({
        id: 8,
        name: 'Kinderkirche',
        note: 'Kinder ab 3 Jahren sind herzlich willkommen.',
        imageUrl: null,
        weekday: 'Sonntag',
        weekdaySort: 7,
        meetingTime: '10:00',
        targetGroup: 'Kinder',
        category: 'Kinder & Jugend',
        color: '#14b8a6',
        leaders: [{ name: 'Erika Beispiel', imageUrl: 'https://example.church.tools/images/406/hash' }],
        freePlaces: 3,
        waitinglist: false,
        publicUrl: 'https://example.church.tools/publicgroup/8',
        ...overrides,
    });
    // The block's own default (schema 1.14): every item on but the leaders.
    const DEFAULT_SHOW: GroupFields = {
        name: true,
        image: true,
        when: true,
        targetGroup: true,
        category: true,
        note: true,
        leaders: false,
        leaderImages: false,
        places: true,
        qr: true,
    };
    const style = { fontFamily: 'sans', fontSize: 56, fontWeight: 400 as const, color: '#fff', align: 'left' as const };
    const groupsBlock = (overrides: Partial<Extract<Block, { type: 'groups' }>> = {}): Block => ({
        id: 'g',
        type: 'groups',
        x: 0,
        y: 0,
        width: 1400,
        height: 700,
        parentGroupId: 10,
        groupIds: [],
        sort: 'weekday',
        layout: 'card',
        perPage: 1,
        show: DEFAULT_SHOW,
        style,
        ...overrides,
    });
    const withGroups = (...groups: Group[]): Partial<StageContext> => ({
        groupHomepages: [{ parentGroupId: 10, groups }],
    });

    it('shows the name, weekday and time, free places, the description and a QR code', () => {
        const card = render(makeSlide({ blocks: [groupsBlock()] }), withGroups(group())).get('[data-testid="groups-card"]');
        expect(card.text()).toContain('Kinderkirche');
        expect(card.text()).toContain('Sonntag · 10:00');
        expect(card.text()).toContain('Noch 3 Plätze frei');
        expect(card.text()).toContain('Kinder ab 3 Jahren sind herzlich willkommen.');
        expect(card.find('[data-testid="group-qr"]').exists()).toBe(true);
    });

    it('hides the leaders unless switched on', () => {
        const context = withGroups(group());
        const off = render(makeSlide({ blocks: [groupsBlock()] }), context);
        expect(off.find('[data-testid="group-leaders"]').exists()).toBe(false);
        const on = render(makeSlide({ blocks: [groupsBlock({ show: { ...DEFAULT_SHOW, leaders: true } })] }), context);
        expect(on.get('[data-testid="group-leaders"]').text()).toContain('Erika Beispiel');
    });

    it('leaves out each item its own switch turns off (name, image, when, places, qr)', () => {
        const context = withGroups(group({ imageUrl: 'https://example.church.tools/images/8/hash' }));
        const withShow = (show: Partial<GroupFields>) =>
            render(makeSlide({ blocks: [groupsBlock({ show: { ...DEFAULT_SHOW, ...show } })] }), context).get(
                '[data-testid="groups-card"]',
            );

        expect(withShow({}).text()).toContain('Kinderkirche');
        expect(withShow({ name: false }).text()).not.toContain('Kinderkirche');

        expect(withShow({}).find('img').exists()).toBe(true);
        expect(withShow({ image: false }).find('img').exists()).toBe(false);

        expect(withShow({}).text()).toContain('Sonntag');
        expect(withShow({ when: false }).text()).not.toContain('Sonntag');

        expect(withShow({}).text()).toContain('Plätze frei');
        expect(withShow({ places: false }).text()).not.toContain('Plätze frei');

        expect(withShow({}).find('[data-testid="group-qr"]').exists()).toBe(true);
        expect(withShow({ qr: false }).find('[data-testid="group-qr"]').exists()).toBe(false);
    });

    it('shows rows in the list layout and no QR code', () => {
        const wrapper = render(
            makeSlide({ blocks: [groupsBlock({ layout: 'list' })] }),
            withGroups(group(), group({ id: 9, name: 'Hauskreis' })),
        );
        expect(wrapper.findAll('[data-testid="group-row"]')).toHaveLength(2);
        expect(wrapper.get('[data-testid="groups-list"]').text()).toContain('Hauskreis');
        expect(wrapper.find('[data-testid="group-qr"]').exists()).toBe(false);
    });

    it('shows a calm message without a chosen homepage, and without groups on the chosen one', () => {
        expect(
            render(makeSlide({ blocks: [groupsBlock({ parentGroupId: undefined })] })).get('[data-testid="groups-empty"]').text(),
        ).toBe('Keine Gruppen-Homepage gewählt');
        expect(
            render(makeSlide({ blocks: [groupsBlock()] }), { groupHomepages: [{ parentGroupId: 10, groups: [] }] })
                .get('[data-testid="groups-empty"]')
                .text(),
        ).toBe('Keine Gruppen');
    });

    it('with a chosen selection shows only those groups, in their order', () => {
        const wrapper = render(
            makeSlide({ blocks: [groupsBlock({ layout: 'list', groupIds: [9, 8] })] }),
            withGroups(group(), group({ id: 9, name: 'Hauskreis' })),
        );
        const rows = wrapper.findAll('[data-testid="group-row"]');
        expect(rows.map((r) => r.text())).toEqual([expect.stringContaining('Hauskreis'), expect.stringContaining('Kinderkirche')]);
    });

    describe('several groups a page (wish of the user, 2026-09-29)', () => {
        const three = [group({ id: 1, name: 'Alpha' }), group({ id: 2, name: 'Beta' }), group({ id: 3, name: 'Gamma' })];

        it('shows perPage cards side by side in a wide block, each shaped like its own cell', () => {
            const wide = groupsBlock({ width: 1600, height: 900, groupIds: [1, 2, 3], perPage: 2 });
            const wrapper = render(makeSlide({ blocks: [wide] }), withGroups(...three));
            const cards = wrapper.findAll('[data-testid="group-card"]');
            expect(cards.map((c) => c.get('.group-name').text())).toEqual(['Alpha', 'Beta']);
            // A 16:9 block, 56 × 0.4 apart: two cells of 788.8 px next to a height of 900 − 50.4 → portrait cards.
            expect(cards[0]!.classes()).toContain('hero--portrait');
            expect(cards[0]!.attributes('style')).toContain('width: 788.8px');
            expect(wrapper.find('.cells').classes()).toContain('cells--row');
        });

        it('stacks them in a tall block', () => {
            const wrapper = render(
                makeSlide({ blocks: [groupsBlock({ width: 700, height: 1400, groupIds: [1, 2], perPage: 2 })] }),
                withGroups(...three),
            );
            expect(wrapper.find('.cells').classes()).toContain('cells--column');
            expect(wrapper.findAll('[data-testid="group-card"]')).toHaveLength(2);
        });

        it('shows the page bar with the page count and reports the pages to the rotation, like the appointment list', () => {
            const pages: Record<string, number> = {};
            const wrapper = render(makeSlide({ blocks: [groupsBlock({ perPage: 2 })] }), { ...withGroups(...three), pages });
            expect(wrapper.get('[data-testid="groups-pager"]').text()).toContain('1/2');
            expect(pages.g).toBe(2);
        });

        it('shows no page bar when everything fits one page', () => {
            const pages: Record<string, number> = {};
            const wrapper = render(makeSlide({ blocks: [groupsBlock({ perPage: 3 })] }), { ...withGroups(...three), pages });
            expect(wrapper.findAll('[data-testid="group-card"]')).toHaveLength(3);
            expect(wrapper.find('[data-testid="groups-pager"]').exists()).toBe(false);
            expect(pages.g).toBe(1);
        });
    });

    it('reads **bold** in the description as in posts, and keeps its paragraphs as lines', () => {
        const note = 'In der **Kinderkirche** gestaltest du Angebote.\n\nKomm vorbei!';
        const card = render(makeSlide({ blocks: [groupsBlock()] }), withGroups(group({ note }))).get('[data-testid="group-note"]');
        expect(card.find('strong').text()).toBe('Kinderkirche');
        expect(card.text()).not.toContain('**');
        expect(card.text()).toContain('Komm vorbei!');
    });

    describe('after the second test (wish of the user, 2026-09-29)', () => {
        it('shows a leader\'s picture only with both switches on', () => {
            const context = withGroups(group());
            const namesOnly = render(makeSlide({ blocks: [groupsBlock({ show: { ...DEFAULT_SHOW, leaders: true } })] }), context);
            expect(namesOnly.get('[data-testid="group-leaders"]').text()).toContain('Erika Beispiel');
            expect(namesOnly.find('[data-testid="leader-image"]').exists()).toBe(false);
            const pictureWithoutNames = render(
                makeSlide({ blocks: [groupsBlock({ show: { ...DEFAULT_SHOW, leaderImages: true } })] }),
                context,
            );
            expect(pictureWithoutNames.find('[data-testid="leader-image"]').exists()).toBe(false);
            const both = render(
                makeSlide({ blocks: [groupsBlock({ show: { ...DEFAULT_SHOW, leaders: true, leaderImages: true } })] }),
                context,
            );
            expect(both.get('[data-testid="leader-image"]').attributes('src')).toContain('/images/406/hash');
        });

        it('gives each fact its own line with a symbol', () => {
            const card = render(makeSlide({ blocks: [groupsBlock()] }), withGroups(group()));
            expect(card.get('[data-testid="group-fact-when"]').text()).toBe('Sonntag · 10:00');
            expect(card.get('[data-testid="group-fact-who"]').text()).toBe('Kinder');
            expect(card.get('[data-testid="group-fact-category"]').text()).toBe('Kinder & Jugend');
            expect(card.get('[data-testid="group-fact-places"]').text()).toBe('Noch 3 Plätze frei');
            expect(card.find('[data-testid="group-fact-when"] svg').exists()).toBe(true);
            expect(card.find('[data-testid="group-fact-who"]').exists()).toBe(true);
            const without = render(
                makeSlide({ blocks: [groupsBlock({ show: { ...DEFAULT_SHOW, targetGroup: false } })] }),
                withGroups(group()),
            );
            expect(without.find('[data-testid="group-fact-who"]').exists()).toBe(false);
        });

        it('sizes the QR code by the code alone – no width on its box that the page could count padding into', () => {
            const qr = render(makeSlide({ blocks: [groupsBlock()] }), withGroups(group())).get('[data-testid="group-qr"]');
            expect(qr.attributes('style') ?? '').not.toContain('width');
            expect(qr.get('svg').attributes('style')).toContain('width');
        });

        it('puts the colour bar before the image, down the whole card', () => {
            const card = render(makeSlide({ blocks: [groupsBlock()] }), withGroups(group({ imageUrl: 'https://example.church.tools/images/5/x' })))
                .get('[data-testid="group-card"]');
            expect(card.element.firstElementChild?.classList.contains('group-bar')).toBe(true);
            expect(card.find('.hero-content img').exists()).toBe(true);
        });
    });
});

describe('the room at an appointment (Plan.md 50)', () => {
    const frame = { x: 0, y: 0, width: 1600, height: 600, calendarIds: [2], style };
    const appointment = (location: { name?: string; addition?: string } | null, bookings: unknown[] = []) =>
        normalizeAppointments(
            [
                {
                    appointment: {
                        base: { id: 4, title: 'Gottesdienst', allDay: false, calendar: { id: 2, name: 'Gottesdienst' }, address: location },
                        calculated: { startDate: '2026-10-04T09:00:00Z', endDate: '2026-10-04T10:30:00Z' },
                    },
                    bookings,
                } as never,
            ],
            BERLIN,
            [
                { id: 1, name: 'Saal' },
                { id: 3, name: 'Raum 01' },
            ],
        );
    const booked = (...ids: number[]) => ids.map((resourceId) => ({ base: { id: resourceId, resourceId, statusId: 2 } }));
    const next = (layout: 'classic' | 'card', showRooms = true): Block => ({ id: 'n', type: 'next-appointment', ...frame, layout, showRooms, showImage: false });
    const list = (layout: 'rows' | 'cards', showRooms = true): Block => ({ id: 'l', type: 'appointment-list', ...frame, horizonDays: 14, limit: 5, layout, showRooms });
    const place = (block: Block, appointments: ReturnType<typeof appointment>, testid: string) =>
        render(makeSlide({ blocks: [block] }), { appointments }).find(`[data-testid="${testid}"]`);

    it('shows the place alone where one is entered – the booked rooms do not double it', () => {
        const place_ = { name: 'Gemeindezentrum' };
        expect(place(next('card'), appointment(place_, booked(1)), 'next-place').text()).toBe('Gemeindezentrum');
        expect(place(next('classic'), appointment(place_, booked(1, 3)), 'next-place').text()).toBe('Gemeindezentrum');
        expect(place(list('cards'), appointment(place_, booked(1, 3)), 'list-place').text()).toBe('Gemeindezentrum');
        expect(place(list('cards'), appointment({ name: 'Saal' }, booked(1)), 'list-place').text()).toBe('Saal');
    });

    it('fills in the rooms where no place is entered, several separated by commas', () => {
        expect(place(next('card'), appointment(null, booked(1, 3)), 'next-place').text()).toBe('Saal, Raum 01');
        expect(place(list('cards'), appointment(null, booked(1, 3)), 'list-place').text()).toBe('Saal, Raum 01');
    });

    it('shows the room alone without a place, and the place alone without a room', () => {
        expect(place(next('card'), appointment(null, booked(1)), 'next-place').text()).toBe('Saal');
        expect(place(next('classic'), appointment(null, booked(1)), 'next-place').text()).toBe('Saal');
        expect(place(next('card'), appointment({ name: 'Gemeindezentrum' }), 'next-place').text()).toBe('Gemeindezentrum');
        // The plain layout shows no place of its own: without a room it stays as it was.
        expect(place(next('classic'), appointment({ name: 'Gemeindezentrum' }), 'next-place').exists()).toBe(false);
    });

    it('puts the place in the date column of a card, and leaves out the rooms of a calendar the block names', () => {
        const place_ = { name: 'Gemeindezentrum' };
        const cards = { ...list('cards'), roomsOffCalendarIds: [2] } as Block;
        const found = render(makeSlide({ blocks: [cards] }), { appointments: appointment(place_, booked(1)) });
        expect(found.find('.card-when [data-testid="list-place"]').text()).toBe('Gemeindezentrum');
        expect(place({ ...next('card'), roomsOffCalendarIds: [2] } as Block, appointment(place_, booked(1)), 'next-place').text()).toBe('Gemeindezentrum');
        // The plain layout shows the place only with rooms: a calendar left out has none.
        expect(place({ ...next('classic'), roomsOffCalendarIds: [2] } as Block, appointment(place_, booked(1)), 'next-place').exists()).toBe(false);
        // Without a place, a calendar left out has no line; another calendar is left out: the rooms stay.
        expect(place({ ...list('cards'), roomsOffCalendarIds: [2] } as Block, appointment(null, booked(1)), 'list-place').exists()).toBe(false);
        expect(place({ ...list('cards'), roomsOffCalendarIds: [9] } as Block, appointment(null, booked(1)), 'list-place').text()).toBe('Saal');
    });

    it('shows no room where the block does not ask, and none in the list of rows', () => {
        const place_ = { name: 'Gemeindezentrum' };
        expect(place(next('card', false), appointment(place_, booked(1)), 'next-place').text()).toBe('Gemeindezentrum');
        expect(place(list('cards', false), appointment(place_, booked(1)), 'list-place').text()).toBe('Gemeindezentrum');
        const rows = render(makeSlide({ blocks: [list('rows')] }), { appointments: appointment(place_, booked(1)) });
        expect(rows.text()).not.toContain('Saal');
    });
});

describe('rendering rooms (Plan.md 46)', () => {
    const roomsBlock = (overrides: Partial<Extract<Block, { type: 'rooms' }>> = {}): Block => ({
        id: 'r',
        type: 'rooms',
        x: 0,
        y: 0,
        width: 1400,
        height: 700,
        rooms: [
            { resourceId: 1, hint: '1. OG, links', showTitles: true },
            { resourceId: 2, hint: '', showTitles: false },
        ],
        layout: 'overview',
        days: 1,
        style,
        ...overrides,
    });
    // `now` of `render` is 10:00 Berlin on 2026-10-04.
    const booking = (id: number, resourceId: number, title: string | null, from: string, to: string) => ({
        id,
        resourceId,
        title,
        start: new Date(`2026-10-04T${from}:00Z`),
        end: new Date(`2026-10-04T${to}:00Z`),
        allDay: false,
    });
    const rooms = [
        { resourceId: 1, name: 'Saal', bookings: [booking(1, 1, 'Gottesdienst', '07:30', '09:30'), booking(2, 1, 'Chor', '12:00', '13:00')] },
        { resourceId: 2, name: 'Gruppenraum 1', bookings: [booking(3, 2, 'Gespräch Familie X', '12:00', '13:00')] },
    ];

    it('shows a calm placeholder until rooms are chosen', () => {
        expect(render(makeSlide({ blocks: [roomsBlock({ rooms: [] })] }), { rooms }).get('[data-testid="rooms-placeholder"]').text()).toBe('Räume wählen');
    });

    it('shows each room with its way-finder and bookings, the running one marked, and "Belegt" where titles are off', () => {
        const wrapper = render(makeSlide({ blocks: [roomsBlock()] }), { rooms });
        const rows = wrapper.findAll('[data-testid="room-row"]');
        expect(rows).toHaveLength(2);
        expect(rows[0]!.text()).toContain('1. OG, links');
        expect(rows[0]!.get('[data-now]').text()).toContain('09:30–11:30');
        expect(rows[1]!.text()).toContain('Belegt');
        expect(wrapper.text()).not.toContain('Familie X');
    });

    it('says so when nothing is booked any more', () => {
        const free = rooms.map((r) => ({ ...r, bookings: [] }));
        const wrapper = render(makeSlide({ blocks: [roomsBlock()] }), { rooms: free });
        expect(wrapper.get('[data-testid="rooms-empty"]').text()).toBe('Heute sind keine Räume belegt.');
    });

    it('tells an unreadable room apart from an empty day: no data at all is "nicht verfügbar"', () => {
        const wrapper = render(makeSlide({ blocks: [roomsBlock()] }), { rooms: [] });
        expect(wrapper.get('[data-testid="rooms-unreadable"]').text()).toBe('Raumbelegung nicht verfügbar');
        expect(wrapper.find('[data-testid="rooms-empty"]').exists()).toBe(false);
    });

    it('shows the door sign of the first room', () => {
        const wrapper = render(makeSlide({ blocks: [roomsBlock({ layout: 'door' })] }), { rooms });
        expect(wrapper.get('[data-testid="door-name"]').text()).toBe('Saal');
        expect(wrapper.get('[data-testid="door-current"]').text()).toBe('Gottesdienst');
        expect(wrapper.get('[data-testid="door-state"]').text()).toContain('bis 11:30');
        expect(wrapper.get('[data-testid="door-next"]').text()).toContain('Chor');
    });

    it('reports one page for the door sign and at least one for the overview, for the rotation', () => {
        const pages: Record<string, number> = {};
        render(makeSlide({ blocks: [roomsBlock()] }), { rooms, pages });
        expect(pages.r).toBe(1);
    });
});
