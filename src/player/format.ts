/** Display helpers for the stage: fonts, image addresses, German dates. */
import type { TextStyle } from '../model/schema';
import { fontStack } from './fonts';

export function textStyle(style: TextStyle): Record<string, string> {
    return {
        fontFamily: fontStack(style.fontFamily),
        fontSize: `${style.fontSize}px`,
        fontWeight: String(style.fontWeight),
        color: style.color,
        textAlign: style.align,
    };
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
 * A calendar colour with transparency, for tiles and badges that must read on
 * a dark and on a light stage alike. Hex only (what ChurchTools sends); other
 * values give null and the caller falls back to a neutral tone.
 */
export function withAlpha(color: string | null | undefined, alpha: number): string | null {
    const hex = color?.trim().replace(/^#/, '') ?? '';
    const full = /^[0-9a-f]{3}$/i.test(hex) ? [...hex].map((c) => c + c).join('') : hex;
    if (!/^[0-9a-f]{6}$/i.test(full)) return null;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Black or white text on a calendar colour, whichever reads better. */
export function textOn(color: string | null | undefined): string {
    const rgba = withAlpha(color, 1);
    if (!rgba) return '#ffffff';
    const [r, g, b] = rgba.match(/\d+/g)!.map(Number) as [number, number, number];
    return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#111111' : '#ffffff';
}
