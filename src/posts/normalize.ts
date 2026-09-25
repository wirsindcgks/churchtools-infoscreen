/**
 * Turns `GET /posts` into the flat shape the `posts` block shows (schema
 * 1.11, Plan.md, Nächste Schritte 33). Unlike appointments, posts need no
 * time-zone math: `publishedDate` and `expirationDate` are compared as
 * instants, not local days.
 */

/** The fields of a post this code reads; the response has many more (G37). */
export interface PostResponse {
    id?: number;
    title?: string | null;
    content?: string | null;
    publishedDate?: string | null;
    expirationDate?: string | null;
    isBanned?: boolean;
    actor?: { title?: string | null } | null;
    group?: {
        domainIdentifier?: string | null;
        title?: string | null;
        color?: { key?: string | null } | null;
        initials?: string | null;
        imageUrl?: string | null;
    } | null;
    imagesMeta?: { imageUrl?: string | null; aspectRatio?: number | null }[] | null;
}

export interface Post {
    id: number;
    groupId: number;
    groupName: string;
    color: string | null;
    /** The group's initials for its avatar, as ChurchTools shows them, else the upper-cased first letter of its name. */
    groupInitials: string;
    groupImageUrl: string | null;
    title: string;
    content: string;
    publishedAt: Date;
    expiresAt: Date | null;
    author: string | null;
    imageUrl: string | null;
    imageRatio: number | null;
}

/**
 * Group colour name → hex (Tailwind 500): the API names colours, not values
 * (`{ key: "teal" }`, G37); the keys are those of its colour enum. Not in the table – `accent`, `basic` and anything unknown –
 * falls back to the theme's accent colour, the same way DateTile and
 * CalendarBadge already treat a missing colour.
 */
const GROUP_COLORS: Record<string, string> = {
    amber: '#f59e0b',
    blue: '#3b82f6',
    cyan: '#06b6d4',
    emerald: '#10b981',
    fuchsia: '#d946ef',
    green: '#22c55e',
    indigo: '#6366f1',
    lime: '#84cc16',
    orange: '#f97316',
    pink: '#ec4899',
    purple: '#a855f7',
    red: '#ef4444',
    rose: '#f43f5e',
    sky: '#0ea5e9',
    teal: '#14b8a6',
    violet: '#8b5cf6',
    yellow: '#eab308',
    constructive: '#22c55e',
    success: '#22c55e',
    critical: '#ef4444',
    destructive: '#ef4444',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
    magic: '#a855f7',
};

export function groupColor(color: { key?: string | null } | null | undefined): string | null {
    const key = color?.key;
    return key ? (GROUP_COLORS[key] ?? null) : null;
}

/** The group's own initials, else the upper-cased first letter of its name; empty without either. */
function groupInitials(group: PostResponse['group']): string {
    const initials = group?.initials?.trim();
    if (initials) return initials;
    const title = group?.title?.trim();
    return title ? title[0]!.toUpperCase() : '';
}

/** Skips banned posts, posts without a readable `publishedDate` and posts without a numeric group id. */
export function normalizePosts(raw: unknown[]): Post[] {
    return (raw as PostResponse[])
        .map(normalizeOne)
        .filter((post): post is Post => post !== null);
}

function normalizeOne(post: PostResponse): Post | null {
    if (post.isBanned) return null;
    const publishedAt = post.publishedDate ? new Date(post.publishedDate) : null;
    if (!publishedAt || Number.isNaN(publishedAt.getTime())) return null;
    const groupId = post.group?.domainIdentifier ? Number(post.group.domainIdentifier) : NaN;
    if (!Number.isFinite(groupId)) return null;
    const image = post.imagesMeta?.[0];
    const expiresAt = post.expirationDate ? new Date(post.expirationDate) : null;
    return {
        id: Number(post.id),
        groupId,
        groupName: post.group?.title ?? '',
        color: groupColor(post.group?.color),
        groupInitials: groupInitials(post.group),
        groupImageUrl: post.group?.imageUrl ?? null,
        title: post.title ?? '',
        content: post.content ?? '',
        publishedAt,
        expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
        author: post.actor?.title ?? null,
        imageUrl: image?.imageUrl ?? null,
        imageRatio: image?.aspectRatio ?? null,
    };
}

export interface SelectPostsOptions {
    groupIds: number[];
    now: Date;
    /** Posts published before this many days ago drop off. */
    maxAgeDays: number;
    limit: number;
}

/** What a `posts` block shows: published, not expired, not too old, newest first. */
export function selectPosts(posts: Post[], options: SelectPostsOptions): Post[] {
    const groups = new Set(options.groupIds);
    const oldest = options.now.getTime() - options.maxAgeDays * 24 * 60 * 60 * 1000;
    return posts
        .filter((p) => groups.has(p.groupId))
        .filter((p) => p.publishedAt.getTime() <= options.now.getTime())
        .filter((p) => p.publishedAt.getTime() >= oldest)
        .filter((p) => !p.expiresAt || p.expiresAt.getTime() > options.now.getTime())
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        .slice(0, options.limit);
}

/** JSON round trips turn dates into strings; bring them back (like `reviveAppointments`). */
export function revivePosts(posts: Post[]): Post[] {
    return posts.map((p) => ({
        ...p,
        publishedAt: new Date(p.publishedAt),
        expiresAt: p.expiresAt ? new Date(p.expiresAt) : null,
    }));
}
