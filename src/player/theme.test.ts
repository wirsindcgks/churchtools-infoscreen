import { mount } from '@vue/test-utils';
import { defineComponent, h, reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import { normalizeAppointments } from '../appointments/normalize';
import { makeSlide } from '../model/testing';
import { DEFAULT_THEME, type Block, type SlideDoc } from '../model/schema';
import { provideStageContext, type StageContext } from './context';
import { qrShape } from './qr';
import SlideView from './SlideView.vue';
import { imageBox, listLayout, themeVars } from './theme';
import { webFrame } from './web';

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
    it('frames only https, a foreign page with its own origin, our own without it', () => {
        const own = 'https://gemeinde.church.tools';
        expect(webFrame('http://example.org', own)).toBeNull();
        expect(webFrame('javascript:alert(1)', own)).toBeNull();
        expect(webFrame('kein Link', own)).toBeNull();
        expect(webFrame(' https://www.gemeinde.example/wochenblatt/ ', own)).toEqual({
            src: 'https://www.gemeinde.example/wochenblatt/',
            sandbox: 'allow-scripts allow-same-origin',
        });
        // Same origin with allow-same-origin would run with the device's session.
        expect(webFrame(`${own}/ccm/anything`, own)?.sandbox).toBe('allow-scripts');
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
        });
        const slide = render(makeSlide({ blocks: [] }), { theme: { ...DEFAULT_THEME, corners: 'square' } }).find('.slide');
        expect(slide.attributes('style')).toContain('--isd-radius: 0');
    });

    it('lets a block without its own layout follow the theme', () => {
        expect(listLayout(list as Extract<Block, { type: 'appointment-list' }>, DEFAULT_THEME)).toBe('rows');
        const large = { ...DEFAULT_THEME, appointments: 'large' as const };
        const cards = render(makeSlide({ blocks: [list] }), { appointments, theme: large });
        const card = cards.find('[data-testid="list-card"]');
        // As in the WordPress plugin: tile, then label, title, subtitle, and day, time and place one below the other.
        expect(card.find('.tile').text()).toMatch(/4\s*OKT/);
        expect(card.find('.card-body').text()).toMatch(
            /Gottesdienste\s*Gottesdienst\s*mit Abendmahl\s*Sonntag, 4\. Oktober\s*11:00–12:30 Uhr\s*Gemeindezentrum, Saal/,
        );
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
