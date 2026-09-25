/**
 * Everything the player fetches, behind one interface so that it can be
 * replaced in tests. Every request has a time limit.
 */
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { normalizeAppointments, type Appointment } from '../appointments/normalize';
import { startOfZonedDay } from '../appointments/zoned';
import { fetchAppointments, fetchChurchLogoUrl, fetchTimeZone } from '../ct/api';
import { ensureSignedIn, httpStatus, instanceBaseUrl, type TokenLogin } from '../ct/client';
import type { ScreenDoc, SlideDoc } from '../model/schema';
import { getRepository } from '../store/backend';
import type { ContentRevisions, LoadedScreen } from '../store/screen-repository';
import { withTimeout } from './timing';

export interface PlayerData {
    /** Fails unless a real person – with a device account, exactly that one – is signed in (G20). */
    assertSignedIn(): Promise<void>;
    loadScreen(slug: string): Promise<LoadedScreen>;
    /** The revisions of schedule and playlists – cheap, to decide whether `loadScreen` is needed. */
    contentRevisions(screenId: string): Promise<ContentRevisions>;
    timeZone(): Promise<string>;
    churchName(): Promise<string>;
    /** Image service address of the church logo, without size (G29). */
    churchLogo(): Promise<string | null>;
    /** `Date` header of a server response, for the clock check. */
    serverDate(): Promise<string | null>;
    appointments(calendarIds: number[], from: Date, to: Date, timeZone: string): Promise<Appointment[]>;
}

/** Data from ChurchTools; with `login`, only for that device account. */
export function createChurchToolsPlayerData(login?: TokenLogin): PlayerData {
    return {
        ...churchToolsPlayerData,
        async assertSignedIn() {
            await withTimeout(ensureSignedIn(login));
        },
    };
}

export const churchToolsPlayerData: PlayerData = {
    async assertSignedIn() {
        await withTimeout(ensureSignedIn());
    },
    async loadScreen(slug) {
        const { repository } = await withTimeout(getRepository());
        return withTimeout(repository.loadScreen(slug));
    },
    async contentRevisions(screenId) {
        const { repository } = await withTimeout(getRepository());
        return withTimeout(repository.contentRevisions(screenId));
    },
    timeZone: () => withTimeout(fetchTimeZone()),
    async churchName() {
        const info = await withTimeout(churchtoolsClient.get<{ siteName?: string }>('/info'));
        return info.siteName ?? '';
    },
    churchLogo: () => withTimeout(fetchChurchLogoUrl(instanceBaseUrl())),
    async serverDate() {
        const response = await withTimeout(
            churchtoolsClient.get<{ headers?: Record<string, string> }>('/info', {}, true),
        );
        return response.headers?.date ?? null;
    },
    async appointments(calendarIds, from, to, timeZone) {
        const raw = await readableAppointments(calendarIds, (ids) =>
            withTimeout(fetchAppointments(ids, from, to, timeZone)),
        );
        return normalizeAppointments(raw, timeZone);
    },
};

/**
 * ChurchTools refuses the whole appointment request with 403 as soon as one
 * of the calendars is not readable (G35). Then each calendar is asked alone,
 * and only the forbidden ones are left out – one wrong calendar must not
 * blank a screen. The setup page names the missing right.
 */
export async function readableAppointments<T>(
    calendarIds: number[],
    fetch: (ids: number[]) => Promise<T[]>,
): Promise<T[]> {
    try {
        return await fetch(calendarIds);
    } catch (error) {
        if (httpStatus(error) !== 403 || calendarIds.length < 2) throw error;
    }
    const parts = await Promise.all(
        calendarIds.map((id) =>
            fetch([id]).catch((error: unknown) => {
                if (httpStatus(error) !== 403) throw error;
                console.warn(`Kalender ${id}: keine Leserechte (403) – übersprungen.`);
                return [] as T[];
            }),
        ),
    );
    return parts.flat();
}

/** Calendars and the time window a screen needs, over all its blocks and rules. */
export function appointmentNeeds(screen: ScreenDoc, slides: SlideDoc[]): { calendarIds: number[]; days: number } {
    const ids = new Set<number>();
    let days = 1;
    for (const block of slides.flatMap((s) => s.blocks)) {
        if (block.type === 'appointment-list') {
            block.calendarIds.forEach((id) => ids.add(id));
            days = Math.max(days, block.horizonDays);
        }
        if (block.type === 'next-appointment') {
            block.calendarIds.forEach((id) => ids.add(id));
            days = Math.max(days, 60);
        }
    }
    for (const rule of screen.schedule) {
        if (rule.kind === 'appointment') rule.calendarIds.forEach((id) => ids.add(id));
    }
    return { calendarIds: [...ids].sort((a, b) => a - b), days };
}

export function appointmentWindow(now: Date, timeZone: string, days: number): { from: Date; to: Date } {
    return { from: startOfZonedDay(now, timeZone), to: startOfZonedDay(now, timeZone, days) };
}
