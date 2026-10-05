/** Display helpers for the stage: fonts, image addresses, German dates. */
import type { Block, TextStyle } from '../model/schema';
import { fontStack } from './fonts';
import { GROUP_COLORS } from './palette';

export function textStyle(style: TextStyle): Record<string, string> {
    return {
        fontFamily: fontStack(style.fontFamily),
        fontSize: `${style.fontSize}px`,
        fontWeight: String(style.fontWeight),
        color: style.color,
        textAlign: style.align,
        ...(style.uppercase === true && { textTransform: 'uppercase' }),
    };
}

type Vertical = NonNullable<TextStyle['verticalAlign']>;

/** Where each block with a vertical choice puts its content when none is set: what it did before schema 1.24 (Plan.md 70). */
export const VERTICAL_DEFAULTS: Partial<Record<Block['type'], Vertical>> = {
    text: 'top',
    clock: 'top',
    countdown: 'middle',
    'next-appointment': 'middle',
    'church-header': 'middle',
};

/** The effective vertical alignment of a block, or null for blocks that have none (lists, banner, media). */
export function verticalAlignOf(block: Block): Vertical | null {
    const fallback = VERTICAL_DEFAULTS[block.type];
    if (!fallback) return null;
    return ('style' in block ? block.style.verticalAlign : undefined) ?? fallback;
}

/**
 * Style for the content inside a full-height flex column. Automatic margins
 * share out the free room and drop to 0 when the content overflows, so too
 * much content starts at the top; `justify-content: center` would cut its
 * start off.
 */
export function verticalStyle(align: Vertical): Record<string, string> {
    return align === 'middle' ? { marginBlock: 'auto' } : align === 'bottom' ? { marginTop: 'auto' } : {};
}

/**
 * Requests an image from the ChurchTools image service in the size the stage
 * needs. Both `w` and `h` are required: the service defaults to 150×150, and
 * `w` alone yields 1920×150 (G14). Addresses that are not http(s) pass through.
 */
export function sizedImageUrl(url: string, width: number, height: number, fit: 'max' | 'crop' = 'max'): string {
    if (!/^https?:\/\//.test(url)) return url;
    const sized = new URL(url);
    sized.searchParams.set('w', String(Math.round(width)));
    sized.searchParams.set('h', String(Math.round(height)));
    sized.searchParams.set('fit', fit);
    return sized.toString();
}

export function formatTime(instant: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('de-DE', { timeZone, hour: '2-digit', minute: '2-digit' }).format(instant);
}

/** The widest date `formatDate` makes in German: a Thursday in September (30th, the longest weekday and month). */
export const WIDEST_DATE = new Date('2027-09-30T12:00:00Z');

export function formatDate(instant: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('de-DE', { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(
        instant,
    );
}

export function formatShortDate(instant: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('de-DE', { timeZone, weekday: 'short', day: '2-digit', month: '2-digit' }).format(
        instant,
    );
}

const MONTHS = ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'];

/** Day and month for a date tile: "6" and "SEP", as the WordPress plugin shows them. */
export function dateTile(instant: Date, timeZone: string): { day: string; month: string } {
    const parts = new Intl.DateTimeFormat('de-DE', { timeZone, day: 'numeric', month: 'numeric' }).formatToParts(instant);
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    const month = Number(parts.find((p) => p.type === 'month')?.value ?? 1);
    return { day, month: MONTHS[month - 1] ?? '' };
}

/** "So" – the short weekday. */
export function formatWeekday(instant: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('de-DE', { timeZone, weekday: 'short' }).format(instant).replace('.', '');
}

/** "10:00–11:30 Uhr", "10:00 Uhr" or "ganztägig". */
export function timeRange(a: { allDay: boolean; startTime: string | null; endTime: string | null; multiDay: boolean }): string {
    if (a.allDay || !a.startTime) return 'ganztägig';
    return a.endTime && !a.multiDay && a.endTime !== a.startTime ? `${a.startTime}–${a.endTime} Uhr` : `${a.startTime} Uhr`;
}

/**
 * A calendar colour as a CSS colour, or null. ChurchTools sends hex, but also
 * names such as `black` and palette names such as `sky`; like the WordPress
 * plugin the value is passed on as it is, so the browser mixes it (`color-mix`).
 * Order: hex, CSS colour name, palette name.
 */
export function calendarColor(value: string | null | undefined): string | null {
    const text = value?.trim().toLowerCase() ?? '';
    if (!text) return null;
    const hex = text.replace(/^#/, '');
    if (/^([0-9a-f]{3}|[0-9a-f]{6})$/.test(hex)) {
        return `#${hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex}`;
    }
    const isCssColor =
        typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
            ? CSS.supports('color', text)
            : /^[a-z]+$/.test(text) && !(text in GROUP_COLORS); // jsdom knows no colours: palette names go to the palette
    if (isCssColor && !/^(inherit|initial|unset|revert|currentcolor)$/.test(text)) return text;
    return GROUP_COLORS[text] ?? null;
}

/** A tint of a colour that lets the stage show through, for tiles and badges on a dark and a light stage alike. */
export function tint(color: string, percent: number): string {
    return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

let canvas: CanvasRenderingContext2D | null | undefined;

/** Resolves any CSS colour to `#rrggbb` through a canvas; without canvas (jsdom) only black and white are known. */
function toHex(color: string): string | null {
    if (canvas === undefined) {
        try {
            canvas = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
        } catch {
            canvas = null;
        }
    }
    if (canvas) {
        canvas.fillStyle = '#000000';
        canvas.fillStyle = color;
        const resolved = canvas.fillStyle;
        return /^#[0-9a-f]{6}$/i.test(resolved) ? resolved : null;
    }
    if (/^#[0-9a-f]{6}$/i.test(color)) return color;
    return ({ black: '#000000', white: '#ffffff' } as Record<string, string>)[color] ?? null;
}

/** Dark or white text on a calendar colour, whichever reads better (WCAG luminance, as the WordPress plugin does). */
export function textOn(color: string | null | undefined): string {
    const hex = color ? toHex(color) : null;
    if (!hex) return '#ffffff';
    const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#111827' : '#ffffff';
}

/**
 * The place line of an appointment: "Gemeindezentrum · Saal, Raum 01". The rooms
 * only where the block asks for them (`showRooms`); null when there is nothing to say.
 */
export function placeLine(appointment: { location: string | null; rooms?: string[] }, showRooms?: boolean): string | null {
    const rooms = showRooms ? (appointment.rooms ?? []).join(', ') : '';
    return [appointment.location, rooms].filter(Boolean).join(' · ') || null;
}

/**
 * The service line of an appointment: "Predigt: Anna Beispiel · Moderation: Ben Muster, Cora Test".
 * Only the services this block chose, in the order of the appointment's own list; null when there
 * is nothing to say (Plan.md, Nächste Schritte 51).
 */
export function servicesLine(
    appointment: { services?: { serviceId: number; name: string; people: string[] }[] },
    serviceIds: readonly number[] | undefined,
): string | null {
    if (!serviceIds?.length) return null;
    const chosen = new Set(serviceIds);
    const parts = (appointment.services ?? [])
        .filter((s) => chosen.has(s.serviceId) && s.people.length)
        .map((s) => `${s.name}: ${s.people.join(', ')}`);
    return parts.join(' · ') || null;
}
