/**
 * Turns a ChurchTools group homepage into the flat shape the `groups` block
 * shows (schema 1.14, Plan.md, Nächste Schritte 43; measured in G40).
 *
 * The homepage is the only source: it holds exactly the groups ChurchTools
 * shows the public, for anonymous callers and the device account alike –
 * `/groups` would hand the device internal groups too. From each group only
 * named fields are taken. What describes the one who asks (`canSignUp`,
 * `signUpPersons`) or identifies a person beyond the name (`guid`, the
 * person's id and picture) never leaves this file, although ChurchTools
 * sends it anonymously.
 */
import { groupColor } from '../posts/normalize';

/** An entry of `GET /grouphomepages`, as far as this code reads it. */
interface HomepageListResponse {
    title?: string | null;
    apiUrl?: string | null;
    domainAttributes?: { parentGroupId?: number | string | null } | null;
}

/** A master-data value at a group: weekday, target group, category. */
interface MasterDataResponse {
    name?: string | null;
    nameTranslated?: string | null;
    sortKey?: number | null;
}

interface LeaderResponse {
    title?: string | null;
    domainAttributes?: {
        firstName?: string | null;
        lastName?: string | null;
        isArchived?: boolean | null;
        dateOfDeath?: string | null;
    } | null;
}

interface GroupResponse {
    id?: number | string | null;
    name?: string | null;
    maxMemberCount?: number | null;
    currentMemberCount?: number | null;
    requestedSeatsCount?: number | null;
    allowWaitinglist?: boolean | null;
    information?: {
        note?: string | null;
        imageUrl?: string | null;
        meetingTime?: string | null;
        weekday?: MasterDataResponse | null;
        targetGroup?: MasterDataResponse | null;
        groupCategory?: MasterDataResponse | null;
        color?: string | null;
        leader?: LeaderResponse[] | null;
    } | null;
}

/** `GET /grouphomepages/{hash}`, as far as this code reads it. */
export interface HomepageResponse {
    showLeaders?: boolean | null;
    showGroupImages?: boolean | null;
    groups?: GroupResponse[] | null;
}

/** A homepage to choose in the inspector and to fetch in the player. The hash is never stored in a document. */
export interface HomepageEntry {
    parentGroupId: number;
    title: string;
    hash: string;
}

export interface Group {
    id: number;
    name: string;
    /** Plain text as ChurchTools holds it; the block cuts it to a few lines. */
    note: string;
    imageUrl: string | null;
    /** "Mittwoch", or empty. */
    weekday: string;
    /** ChurchTools' order of the weekday – Monday first; the id would put Sunday first (G40). */
    weekdaySort: number | null;
    meetingTime: string;
    targetGroup: string;
    category: string;
    color: string | null;
    /** First and last name only – and only where the homepage itself shows its leaders. */
    leaders: string[];
    /** Null without a maximum; then nothing is said about places. */
    freePlaces: number | null;
    waitinglist: boolean;
    /** The group's public page, the target of its QR code; anonymous `200` (G40). */
    publicUrl: string;
}

export interface HomepageGroups {
    parentGroupId: number;
    groups: Group[];
}

/**
 * Letters and digits only, like `isValidHomepageHash` in `connect-churchtools`:
 * the hash goes into a request path.
 */
export function isValidHomepageHash(hash: string): boolean {
    return /^[A-Za-z0-9]+$/.test(hash);
}

/** Entries without a parent group or a usable hash drop out – they cannot be fetched. Sorted by title. */
export function normalizeHomepageList(raw: unknown[]): HomepageEntry[] {
    const entries: HomepageEntry[] = [];
    for (const entry of raw as HomepageListResponse[]) {
        const parentGroupId = Number(entry?.domainAttributes?.parentGroupId);
        const segments = (entry?.apiUrl ?? '').split(/[?#]/)[0]!.replace(/\/+$/, '').split('/');
        // The hash is the segment after `grouphomepages` – not that word itself when the hash is missing.
        const hash = segments.at(-2) === 'grouphomepages' ? segments.at(-1)! : '';
        if (!Number.isInteger(parentGroupId) || parentGroupId <= 0 || !isValidHomepageHash(hash)) continue;
        entries.push({ parentGroupId, title: (entry.title ?? '').trim(), hash });
    }
    return entries.sort((a, b) => a.title.localeCompare(b.title, 'de'));
}

function label(value: MasterDataResponse | null | undefined): string {
    return (value?.nameTranslated ?? value?.name ?? '').trim();
}

/**
 * The names of a group's leaders – the privacy rule of Plan.md 43 (c). Only
 * when the homepage says it shows leaders: whether ChurchTools leaves them
 * out otherwise is not measured (G40), so this does not rely on it. Archived
 * and deceased people drop out.
 */
function leaderNames(leaders: LeaderResponse[] | null | undefined): string[] {
    return (leaders ?? [])
        .filter((l) => !l?.domainAttributes?.isArchived && !l?.domainAttributes?.dateOfDeath)
        .map((l) => {
            const first = (l.domainAttributes?.firstName ?? '').trim();
            const last = (l.domainAttributes?.lastName ?? '').trim();
            return `${first} ${last}`.trim() || (l.title ?? '').trim();
        })
        .filter((name) => name !== '');
}

/**
 * Free places = maximum − members − open requests, only with a maximum. That
 * open requests take a place is the plugin's reading of the field name; it
 * errs to the careful side – one place too few, never one too many.
 */
function freePlaces(group: GroupResponse): number | null {
    const max = Number(group.maxMemberCount ?? 0);
    if (!(max > 0)) return null;
    const taken = Number(group.currentMemberCount ?? 0) + Number(group.requestedSeatsCount ?? 0);
    return Math.max(0, max - taken);
}

/**
 * The groups of one homepage, in the order ChurchTools sends them. Groups
 * without a numeric id or a name drop out. `baseUrl` is the instance, for the
 * public page; `children` (deeper levels) is not read – what a homepage with
 * more than one level sends is not measured.
 */
export function normalizeHomepage(raw: unknown, baseUrl: string): Group[] {
    const homepage = (raw ?? {}) as HomepageResponse;
    const showLeaders = homepage.showLeaders === true;
    const showImages = homepage.showGroupImages !== false;
    const base = baseUrl.replace(/\/+$/, '');
    const groups: Group[] = [];
    for (const group of homepage.groups ?? []) {
        const id = Number(group?.id);
        const name = (group?.name ?? '').trim();
        if (!Number.isInteger(id) || id <= 0 || !name) continue;
        const info = group.information ?? {};
        groups.push({
            id,
            name,
            note: (info.note ?? '').trim(),
            imageUrl: showImages && info.imageUrl ? info.imageUrl : null,
            weekday: label(info.weekday),
            weekdaySort: typeof info.weekday?.sortKey === 'number' ? info.weekday.sortKey : null,
            meetingTime: (info.meetingTime ?? '').trim(),
            targetGroup: label(info.targetGroup),
            category: label(info.groupCategory),
            color: groupColor(info.color ? { key: info.color } : null),
            leaders: showLeaders ? leaderNames(info.leader) : [],
            freePlaces: freePlaces(group),
            waitinglist: group.allowWaitinglist === true,
            publicUrl: `${base}/publicgroup/${id}`,
        });
    }
    return groups;
}

/** More would not be an overview; a homepage had at most twelve (connect-churchtools, 2026-09-11). */
export const GROUPS_CAP = 50;

/**
 * What a `groups` block shows. Without a choice every group, by weekday
 * (Monday first, `sortKey`), then meeting time, then name – groups without a
 * weekday last. With a choice exactly those, in that order; a chosen group
 * the homepage no longer holds is gone (Plan.md 43, g).
 */
export function selectGroups(groups: readonly Group[], groupIds: readonly number[]): Group[] {
    if (groupIds.length) {
        const byId = new Map(groups.map((g) => [g.id, g]));
        return groupIds.map((id) => byId.get(id)).filter((g): g is Group => g !== undefined).slice(0, GROUPS_CAP);
    }
    return [...groups]
        .sort(
            (a, b) =>
                (a.weekdaySort ?? Infinity) - (b.weekdaySort ?? Infinity) ||
                a.meetingTime.localeCompare(b.meetingTime, 'de') ||
                a.name.localeCompare(b.name, 'de'),
        )
        .slice(0, GROUPS_CAP);
}

/** The groups of the homepage at this parent group; none when it is not loaded or gone. */
export function homepageGroups(homepages: readonly HomepageGroups[] | undefined, parentGroupId: number | undefined): Group[] {
    if (parentGroupId === undefined) return [];
    return homepages?.find((h) => h.parentGroupId === parentGroupId)?.groups ?? [];
}

/** "Noch 3 Plätze frei" – or null when nothing is to be said. */
export function placesText(group: Pick<Group, 'freePlaces' | 'waitinglist'>): string | null {
    if (group.freePlaces === null) return null;
    if (group.freePlaces === 0) return group.waitinglist ? 'Ausgebucht – Warteliste offen' : 'Ausgebucht';
    return group.freePlaces === 1 ? 'Noch 1 Platz frei' : `Noch ${group.freePlaces} Plätze frei`;
}

/** "Mittwoch · 19:30", or whatever of both there is. */
export function whenText(group: Pick<Group, 'weekday' | 'meetingTime'>): string {
    return [group.weekday, group.meetingTime].filter((part) => part !== '').join(' · ');
}
