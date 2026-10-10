import { mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import { normalizeAppointments } from '../appointments/normalize';
import { makeSlide } from '../model/testing';
import { DEFAULT_THEME, type Block, type SlideDoc } from '../model/schema';
import { provideStageContext, type StageContext } from './context';
import { qrShape } from './qr';
import SlideView from './SlideView.vue';
import { cardBackground, imageBox, listLayout, loadingVars, themeVars } from './theme';
import { embedAddress, webFrame, webRefusal, withScheme } from './web';

const BERLIN = 'Europe/Berlin';
const style = { fontFamily: 'sans', fontSize: 40, fontWeight: 400 as const, color: '#fff', align: 'left' as const };
const frame = { x: 0, y: 0, width: 1600, height: 600 };

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

const appointments = normalizeAppointments(
    [
        {
            appointment: {
                base: {
                    id: 4,
                    title: 'Gottesdienst',
                    subtitle: 'mit Abendmahl',
                    allDay: false,
                    calendar: { id: 2, name: 'Gottesdienste', color: '#16a34a' },
                    address: { name: 'Gemeindezentrum', addition: 'Saal' },
                    image: { imageUrl: 'https://ct.example/images/9/abc' },
                },
                calculated: { startDate: '2026-10-04T09:00:00Z', endDate: '2026-10-04T10:30:00Z' },
            },
        },
    ],
    BERLIN,
);

describe('the website block (Plan.md 28)', () => {
    it('frames only https, and never a page of the own instance', () => {
        const own = 'https://gemeinde.church.tools';
        expect(webFrame('http://example.org', own)).toBeNull();
        expect(webFrame('javascript:alert(1)', own)).toBeNull();
        expect(webFrame('kein Link', own)).toBeNull();
        expect(webFrame(' https://www.gemeinde.example/wochenblatt/ ', own)).toEqual({
            src: 'https://www.gemeinde.example/wochenblatt/',
            sandbox: 'allow-scripts allow-same-origin',
        });
        // A page of the own instance would load with the cookies of whoever looks at the slide.
        expect(webFrame(`${own}/ccm/anything`, own)).toBeNull();
        expect(webRefusal(`${own}/?q=anything`, own)).toBe('own-instance');
        expect(webRefusal('http://example.org', own)).toBe('not-https');
        expect(webRefusal('https://www.gemeinde.example/', own)).toBeNull();
    });

    it('takes an address typed without a scheme as https, and leaves others as they are', () => {
        expect(withScheme(' gemeinde.de/wochenblatt ')).toBe('https://gemeinde.de/wochenblatt');
        expect(withScheme('https://gemeinde.de')).toBe('https://gemeinde.de');
        expect(withScheme('http://gemeinde.de')).toBe('http://gemeinde.de'); // still refused by webFrame
        expect(withScheme('')).toBe('');
    });

    it('reads the address out of an embed code (Plan.md 55 C)', () => {
        const map = 'https://www.openstreetmap.example/export/embed.html?bbox=1,2,3,4&layer=mapnik';
        expect(embedAddress(`<iframe src="${map}"></iframe>`)).toBe(map);
        expect(embedAddress(`<IFRAME width="600" height="400" frameborder="0" allow="fullscreen" src="${map}" style="border:0"></IFRAME>`)).toBe(map);
        expect(embedAddress(`<iframe src='${map}'></iframe>`)).toBe(map);
        expect(embedAddress('<iframe src="//www.gemeinde.example/umfrage"></iframe>')).toBe('https://www.gemeinde.example/umfrage');
        expect(embedAddress('<iframe src="https://a.example/1"></iframe><iframe src="https://b.example/2"></iframe>')).toBe('https://a.example/1');
        expect(embedAddress('<iframe src="http://a.example/1"></iframe>')).toBe('http://a.example/1'); // still refused by webFrame
        expect(embedAddress('<iframe width="600"></iframe>')).toBe('');
        expect(embedAddress('<div><script>alert(1)</script><iframe src="https://a.example/1"></iframe></div>')).toBe('https://a.example/1');
        expect(embedAddress('gemeinde.de/wochenblatt')).toBe('gemeinde.de/wochenblatt');
        expect(embedAddress('https://gemeinde.de/?q=<b>')).toBe('https://gemeinde.de/?q=<b>');
    });

    it('renders a sandboxed frame, scaled by its zoom, and a placeholder without an address', () => {
        const web: Block = { ...frame, id: 'w', type: 'web', url: 'https://www.gemeinde.example/wochenblatt/', zoom: 2 };
        const iframe = render(makeSlide({ blocks: [web] })).find('iframe');
        expect(iframe.attributes('sandbox')).toBe('allow-scripts allow-same-origin');
        expect(iframe.attributes('referrerpolicy')).toBe('no-referrer');
        expect(iframe.attributes('style')).toContain('width: 800px');
        expect(iframe.attributes('style')).toContain('scale(2)');
        const empty = render(makeSlide({ blocks: [{ ...web, url: '' }] }));
        expect(empty.find('iframe').exists()).toBe(false);
        expect(empty.find('.placeholder').exists()).toBe(true);
    });
});

describe('the QR block', () => {
    it('makes the code on the device, umlauts included, and refuses what does not fit', () => {
        const shape = qrShape('https://www.gemeinde.example/anmeldung/')!;
        expect(shape.size).toBeGreaterThanOrEqual(21 + 4);
        expect(shape.path).toMatch(/^M\d+ \d+h1v1h-1z/);
        expect(qrShape('Grüße aus der Gemeinde')).not.toBeNull();
        expect(qrShape('  ')).toBeNull();
        expect(qrShape('x'.repeat(3000))).toBeNull();
    });

    it('draws it in its colours, and a placeholder while it is empty', () => {
        const qr: Block = { ...frame, id: 'q', type: 'qr', data: 'https://example.org', color: '#111111', background: '#ffffff' };
        const svg = render(makeSlide({ blocks: [qr] })).find('svg.qr');
        expect(svg.find('path').attributes('fill')).toBe('#111111');
        expect(svg.find('rect').attributes('fill')).toBe('#ffffff');
        expect(render(makeSlide({ blocks: [{ ...qr, data: '' }] })).find('.placeholder').exists()).toBe(true);
    });
});

describe('the theme on the stage (Plan.md 27)', () => {
    const list: Block = { ...frame, id: 'l', type: 'appointment-list', calendarIds: [2], horizonDays: 14, limit: 5, style };

    it('sets corners and accent as variables of the slide', () => {
        expect(themeVars({ ...DEFAULT_THEME, corners: 'square', accent: '#e11d48' })).toEqual({
            '--isd-accent': '#e11d48',
            '--isd-radius': '0',
            '--isd-pill': '0',
            '--isd-card': 'color-mix(in srgb, currentColor 7%, transparent)',
        });
        const slide = render(makeSlide({ blocks: [] }), { theme: { ...DEFAULT_THEME, corners: 'square' } }).find('.slide');
        expect(slide.attributes('style')).toContain('--isd-radius: 0');
    });

    it('sets the card surface by the theme (Plan.md 74)', () => {
        expect(cardBackground(DEFAULT_THEME)).toBe('color-mix(in srgb, currentColor 7%, transparent)');
        expect(cardBackground({ ...DEFAULT_THEME, cards: 'none' })).toBe('transparent');
        expect(cardBackground({ ...DEFAULT_THEME, cards: 'color', cardColor: '#ff0000', cardOpacity: 50 })).toBe(
            'color-mix(in srgb, #ff0000 50%, transparent)',
        );
        expect(themeVars({ ...DEFAULT_THEME, cards: 'none' })['--isd-card']).toBe('transparent');
    });

    it('lets a block without its own layout follow the theme', () => {
        expect(listLayout(list as Extract<Block, { type: 'appointment-list' }>, DEFAULT_THEME)).toBe('rows');
        const large = { ...DEFAULT_THEME, appointments: 'large' as const };
        const cards = render(makeSlide({ blocks: [list] }), { appointments, theme: large });
        const card = cards.find('[data-testid="list-card"]');
        // One line: tile, day over time over place, title with subtitle, the category at the end.
        expect(card.find('.tile').text()).toMatch(/4\s*OKT/);
        expect(card.find('.card-when').text()).toMatch(/Sonntag, 4\. Oktober\s*11:00–12:30 Uhr\s*Gemeindezentrum, Saal/);
        expect(card.find('.card-body').text()).toMatch(/Gottesdienst\s*mit Abendmahl/);
        expect(card.findAll(':scope > *').map((c) => c.classes()[0])).toEqual(['tile', 'card-when', 'card-body', 'badge']);
        // A block that chose rows keeps them.
        const rows = render(makeSlide({ blocks: [{ ...list, layout: 'rows' } as Block] }), { appointments, theme: large });
        expect(rows.find('[data-testid="list-card"]').exists()).toBe(false);
    });

    it('gives appointment images the theme shape, 16:9 unless chosen otherwise', () => {
        expect(imageBox('16:9', 800, 1000)).toEqual({ width: 800, height: 450 });
        expect(imageBox('1:1', 800, 300)).toEqual({ width: 300, height: 300 });
        expect(imageBox('free', 800, 300)).toBeNull();
        const next: Block = { ...frame, id: 'n', type: 'next-appointment', calendarIds: [2], showImage: true, style };
        const image = render(makeSlide({ blocks: [next] }), { appointments }).find('[data-testid="next-image"]');
        expect(image.attributes('style')).toContain('width: 880px');
        expect(image.attributes('style')).toContain('height: 495px');
        expect(image.attributes('src')).toContain('w=880&h=495&fit=crop');
    });
});

describe('loadingVars', () => {
    it("takes the theme's accent, text and background", () => {
        const theme = { ...DEFAULT_THEME, accent: '#e11d48', text: '#111111', background: '#fafafa' };
        expect(loadingVars(theme)).toEqual({ '--load-accent': '#e11d48', '--load-text': '#111111', '--load-bg': '#fafafa' });
    });

    it("falls back to the theme's defaults while none is known", () => {
        expect(loadingVars(null)).toEqual({
            '--load-accent': DEFAULT_THEME.accent,
            '--load-text': DEFAULT_THEME.text,
            '--load-bg': DEFAULT_THEME.background,
        });
    });
});
