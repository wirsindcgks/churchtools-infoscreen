import { churchtoolsClient } from '@churchtools/churchtools-client';
import type { AppointmentResponse } from '../appointments/normalize';
import { zonedDateKey } from '../appointments/zoned';

/**
 * The instance time zone. Readable anonymously and therefore by the device
 * user too; the device's own zone is only a last resort with a warning.
 */
export async function fetchTimeZone(): Promise<string> {
    const config = await churchtoolsClient.get<{ timezone?: string }>('/config');
    if (config.timezone) return config.timezone;
    const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.warn(`ChurchTools meldet keine Zeitzone, verwende ${fallback}.`);
    return fallback;
}

/**
 * Appointments of the given calendars between two instants. `calendar_ids[]`
 * is mandatory (400 otherwise); axios encodes the array in exactly that form.
 * `from` and `to` are local dates of the instance.
 */
export function fetchAppointments(
    calendarIds: number[],
    from: Date,
    to: Date,
    timeZone: string,
): Promise<AppointmentResponse[]> {
    if (calendarIds.length === 0) return Promise.resolve([]);
    return churchtoolsClient.get<AppointmentResponse[]>('/calendars/appointments', {
        calendar_ids: calendarIds,
        from: zonedDateKey(from, timeZone),
        to: zonedDateKey(to, timeZone),
        only_allow_authenticated: 'true',
    });
}

/**
 * The church logo as an image service address without size, or null without
 * a logo. `/logo` is anonymous but always answers 150×150, whatever `w` and
 * `h` say; it redirects to the image service, which honours them (G29). So
 * the redirect target is what counts – and it changes with the logo, which
 * makes it a cache key that needs no expiry rule of its own.
 */
export async function fetchChurchLogoUrl(baseUrl: string, fetcher: typeof fetch = fetch): Promise<string | null> {
    const response = await fetcher(`${baseUrl}/logo`, { cache: 'no-store', credentials: 'omit' });
    // What /logo answers without a logo is unmeasured: anything but an image means "none".
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return null;
    const target = new URL(response.url);
    if (!/\/images\/\d+\//.test(target.pathname)) return null;
    target.search = '';
    return target.toString();
}

export interface Calendar {
    id: number;
    name: string;
    color?: string | null;
    isPublic?: boolean;
}

/** Calendars the signed-in person may see; the device user sees what its group grants (G21). */
export function fetchCalendars(): Promise<Calendar[]> {
    return churchtoolsClient.get<Calendar[]>('/calendars');
}
