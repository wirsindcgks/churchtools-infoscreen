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
