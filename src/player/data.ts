/**
 * Everything the player fetches, behind one interface so that it can be
 * replaced in tests. Every request has a time limit.
 */
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { normalizeAppointments, type Appointment } from '../appointments/normalize';
import { needsAppointmentRooms } from '../appointments/rooms';
import { allowedServiceIds, appointmentServicesInUse } from '../appointments/services';
import { startOfZonedDay } from '../appointments/zoned';
import {
    fetchAppointments,
    fetchPublicCalendars,
    fetchBookings,
    fetchChurchLogoUrl,
    fetchEvents,
    fetchGroupHomepage,
    fetchGroupHomepageList,
    fetchPosts,
    fetchResourceMasterdata,
    fetchServiceGroups,
    fetchServices,
    fetchTimeZone,
} from '../ct/api';
import { ensureSignedIn, httpStatus, instanceBaseUrl, type TokenLogin } from '../ct/client';
import { normalizeHomepage, type HomepageGroups } from '../groups/normalize';
import type { HeartbeatDoc } from '../model/heartbeat';
import type { ScreenDoc, SlideDoc } from '../model/schema';
import { normalizePosts, type Post } from '../posts/normalize';
import { normalizeBookings, roomsOf, type RoomBookings } from '../rooms/normalize';
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
    /**
     * With `rooms`, the booked rooms come along (schema 1.16, Plan.md 50). Names
     * the stammdaten cannot give – no right, a failure – leave the appointments
     * without rooms; they never fail the appointments. The same goes for `services`
     * (schema 1.17, Plan.md 51): any failure – a 403 too – leaves out the services only.
     */
    appointments(
        calendarIds: number[],
        from: Date,
        to: Date,
        timeZone: string,
        options?: { rooms?: boolean; services?: number[] },
    ): Promise<Appointment[]>;
    posts(groupIds: number[], limit: number): Promise<Post[]>;
    /**
     * The groups of the homepages at these parent groups (schema 1.14). A
     * homepage that is gone or disabled comes back without groups – its
     * groups leave the TV (Plan.md 43, g).
     */
    groupHomepages(parentGroupIds: number[]): Promise<HomepageGroups[]>;
    /**
     * The confirmed bookings of these rooms within `[from, to)` (schema 1.16).
     * A room the caller may not read (403), that the stammdaten do not name or
     * that is no room drops out; other errors fail.
     */
    rooms(resourceIds: number[], from: Date, to: Date, timeZone: string): Promise<RoomBookings[]>;
    /**
     * Writes the sign of life of this screen (Plan.md 59). Only a TV with a device login does; for anyone else
     * this does nothing. Fails without the right to write it – the caller must not let that touch the display.
     */
    reportAlive(doc: HeartbeatDoc): Promise<void>;
}

/** Data from ChurchTools; with `login`, only for that device account. */
export function createChurchToolsPlayerData(login?: TokenLogin): PlayerData {
    return {
        ...churchToolsPlayerData,
        async assertSignedIn() {
            await withTimeout(ensureSignedIn(login));
        },
        // A person who opens the player in their own browser is not a TV: only the device login reports.
        async reportAlive(doc) {
            if (!login) return;
            const { repository } = await withTimeout(getRepository());
            await withTimeout(repository.writeHeartbeat(doc));
        },
    };
}

export const churchToolsPlayerData: PlayerData = {
    reportAlive: () => Promise.resolve(),
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
    async appointments(calendarIds, from, to, timeZone, options = {}) {
        const wantsRooms = options.rooms === true;
        const serviceIds = options.services ?? [];
        // Only what the public user sees, even where the account may read more (Plan.md 73, G53). A failure here fails the fetch.
        const showable = new Set((await withTimeout(fetchPublicCalendars(instanceBaseUrl()))).map((c) => c.id));
        const wanted = calendarIds.filter((id) => showable.has(id));
        if (!wanted.length) return [];
        const [raw, rooms, serviceInput] = await Promise.all([
            readableAppointments(wanted, (ids) =>
                withTimeout(fetchAppointments(ids, from, to, timeZone, { bookings: wantsRooms })),
            ),
            wantsRooms
                ? withTimeout(fetchResourceMasterdata()).then(roomsOf, (error: unknown) => {
                      console.warn('Räume der Termine konnten nicht geladen werden:', error);
                      return [];
                  })
                : [],
            serviceIds.length
                ? Promise.all([
                      withTimeout(fetchEvents(from, to, timeZone)),
                      withTimeout(fetchServices()),
                      withTimeout(fetchServiceGroups()),
                  ]).then(
                      ([events, services, serviceGroups]) => ({ events, services, serviceGroups, chosen: serviceIds }),
                      (error: unknown) => {
                          console.warn('Dienste der Termine konnten nicht geladen werden:', error);
                          return undefined;
                      },
                  )
                : undefined,
        ]);
        return normalizeAppointments(raw, timeZone, rooms, serviceInput);
    },
    async posts(groupIds, limit) {
        const raw = await withTimeout(fetchPosts(groupIds, limit));
        return normalizePosts(raw);
    },
    async groupHomepages(parentGroupIds) {
        if (!parentGroupIds.length) return [];
        const baseUrl = instanceBaseUrl();
        const list = await withTimeout(fetchGroupHomepageList(baseUrl));
        return Promise.all(
            parentGroupIds.map(async (parentGroupId) => {
                const entry = list.find((e) => e.parentGroupId === parentGroupId);
                if (!entry) return { parentGroupId, groups: [] };
                const raw = await withTimeout(fetchGroupHomepage(baseUrl, entry.hash));
                return { parentGroupId, groups: normalizeHomepage(raw, baseUrl) };
            }),
        );
    },
    async rooms(resourceIds, from, to, timeZone) {
        if (!resourceIds.length) return [];
        const known = new Map(roomsOf(await withTimeout(fetchResourceMasterdata())).map((r) => [r.id, r.name]));
        const parts = await Promise.all(
            resourceIds
                .filter((id) => known.has(id))
                .map(async (resourceId): Promise<RoomBookings | null> => {
                    try {
                        const raw = await withTimeout(fetchBookings(resourceId, from, to, timeZone));
                        // `to` is still inclusive at ChurchTools: cut to what touches the window.
                        const bookings = normalizeBookings(raw).filter(
                            (b) => b.resourceId === resourceId && b.start < to && b.end > from,
                        );
                        return { resourceId, name: known.get(resourceId)!, bookings };
                    } catch (error) {
                        if (httpStatus(error) !== 403) throw error;
                        console.warn(`Raum ${resourceId}: keine Leserechte (403) – übersprungen.`);
                        return null;
                    }
                }),
        );
        return parts.filter((p): p is RoomBookings => p !== null);
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
export function appointmentNeeds(
    screen: ScreenDoc,
    slides: SlideDoc[],
    allowed: readonly number[] | undefined,
): { calendarIds: number[]; days: number; rooms: boolean; services: number[] } {
    const ids = new Set<number>();
    let days = 1;
    const blocks = slides.flatMap((s) => s.blocks);
    for (const block of blocks) {
        if (block.type === 'appointment-list') {
            block.calendarIds.forEach((id) => ids.add(id));
            days = Math.max(days, block.horizonDays);
        }
        if (block.type === 'next-appointment' || block.type === 'countdown') {
            block.calendarIds.forEach((id) => ids.add(id));
            days = Math.max(days, 60);
        }
    }
    for (const rule of screen.schedule) {
        if (rule.kind === 'appointment') rule.calendarIds.forEach((id) => ids.add(id));
    }
    return {
        calendarIds: [...ids].sort((a, b) => a - b),
        days,
        rooms: needsAppointmentRooms(blocks),
        services: allowedServiceIds(appointmentServicesInUse(blocks), allowed),
    };
}

export function appointmentWindow(now: Date, timeZone: string, days: number): { from: Date; to: Date } {
    return { from: startOfZonedDay(now, timeZone), to: startOfZonedDay(now, timeZone, days) };
}

/**
 * Groups and limit a screen's `posts` blocks need: one entry per distinct,
 * sorted set of chosen groups, with the largest limit among the blocks that
 * share it. Blocks without a group do not count. The caller fetches a few
 * more than `limit` – `Math.min(20, limit + 5)` – so that filtering (age,
 * expiry) still leaves enough to show.
 */
export function postNeeds(slides: SlideDoc[]): { groupIds: number[]; limit: number }[] {
    const byKey = new Map<string, { groupIds: number[]; limit: number }>();
    for (const block of slides.flatMap((s) => s.blocks)) {
        if (block.type !== 'posts' || block.groupIds.length === 0) continue;
        const groupIds = [...block.groupIds].sort((a, b) => a - b);
        const key = groupIds.join(',');
        const need = byKey.get(key);
        byKey.set(key, { groupIds, limit: Math.max(need?.limit ?? 0, block.limit) });
    }
    return [...byKey.values()];
}

/** Every post once; where two group sets share a post, the later fetch wins. */
export function mergePosts(lists: Post[][]): Post[] {
    const byId = new Map<number, Post>();
    for (const list of lists) for (const post of list) byId.set(post.id, post);
    return [...byId.values()];
}

/** The parent groups whose homepages a screen's `groups` blocks show, each once, sorted. */
export function groupNeeds(slides: SlideDoc[]): number[] {
    const ids = new Set<number>();
    for (const block of slides.flatMap((s) => s.blocks)) {
        if (block.type === 'groups' && block.parentGroupId !== undefined) ids.add(block.parentGroupId);
    }
    return [...ids].sort((a, b) => a - b);
}

/**
 * The rooms a screen's `rooms` blocks show, each once and sorted, and the
 * days ahead they need (1 = today, 2 = today and tomorrow). Blocks without
 * rooms do not count.
 */
export function roomNeeds(slides: SlideDoc[]): { resourceIds: number[]; days: number } {
    const ids = new Set<number>();
    let days = 1;
    for (const block of slides.flatMap((s) => s.blocks)) {
        if (block.type !== 'rooms' || block.rooms.length === 0) continue;
        block.rooms.forEach((r) => ids.add(r.resourceId));
        days = Math.max(days, block.days);
    }
    return { resourceIds: [...ids].sort((a, b) => a - b), days };
}
