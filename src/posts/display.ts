/**
 * Display helpers for the `posts` block's card (Plan.md, Nächste Schritte 33,
 * "Nachgezogen am 2026-09-25"): how old a post reads and how its own image is
 * shaped – both independent of the Markdown handling in `src/ct/markdown.ts`.
 */
import { zonedParts } from '../appointments/zoned';
import { formatDate } from '../player/format';
import { tp } from '../i18n/player';

/**
 * A post's age in words, by calendar day in the instance time zone – not by
 * elapsed hours, so a post from just after midnight reads "gestern" once the
 * day has turned, even minutes later (G19, zoned.ts).
 */
export function relativeAge(published: Date, now: Date, timeZone: string): string {
    const p = zonedParts(published, timeZone);
    const n = zonedParts(now, timeZone);
    const publishedDay = Date.UTC(p.year, p.month - 1, p.day);
    const today = Date.UTC(n.year, n.month - 1, n.day);
    const days = Math.round((today - publishedDay) / 86_400_000);
    if (days <= 0) return tp.time.today;
    if (days === 1) return tp.time.yesterday;
    if (days <= 6) return tp.time.daysAgo(days);
    return formatDate(published, timeZone);
}

/** Instagram's own bounds: 4:5 (tall) to 1.91:1 (wide). */
const MIN_IMAGE_ASPECT = 0.8;
const MAX_IMAGE_ASPECT = 1.91;

/** A post's own image shape, clamped like Instagram's; square without one. */
export function imageAspect(ratio: number | null): number {
    if (!ratio) return 1;
    return Math.min(MAX_IMAGE_ASPECT, Math.max(MIN_IMAGE_ASPECT, ratio));
}

/** A picture of a post: its address and shape, as `Post.images` keeps it. */
export interface PostPicture {
    url: string;
    ratio: number | null;
}

/** The pictures of a post; a cached state from before `images` has only the first one. */
export function postPictures(post: { images?: PostPicture[]; imageUrl: string | null; imageRatio: number | null }): PostPicture[] {
    if (post.images) return post.images;
    return post.imageUrl ? [{ url: post.imageUrl, ratio: post.imageRatio }] : [];
}

/** Below this difference in free space two pictures count as equally fitting; the earlier one stays. */
const FIT_TIE = 0.05;
/** In the cross direction the picture takes at most this share of the card. */
const IMAGE_SHARE = 0.6;

export interface PostImageArea {
    picture: PostPicture;
    /** The picture area in stage pixels. */
    width: number;
    height: number;
}

/**
 * Landscape: the picture area stands left over the full height; portrait: on top over the full width – shaped like
 * the picture (clamped) and at most 60 % of the card across. `full` (no text beside it) takes the whole card.
 */
function areaOf(ratio: number | null, block: { width: number; height: number }, full: boolean): { width: number; height: number } {
    if (full) return { width: block.width, height: block.height };
    const aspect = imageAspect(ratio);
    if (block.width >= block.height) return { width: Math.min(block.height * aspect, block.width * IMAGE_SHARE), height: block.height };
    return { width: block.width, height: Math.min(block.width / aspect, block.height * IMAGE_SHARE) };
}

/**
 * The picture a card shows and the area it gets (Plan.md 96). `cover` always takes the first picture; `contain`
 * the one that leaves the least empty space in its area – on a tie (under 0.05) the earlier one.
 */
export function postImageArea(
    pictures: PostPicture[],
    block: { width: number; height: number },
    options: { fit: 'cover' | 'contain'; full: boolean },
): PostImageArea | null {
    let best: (PostImageArea & { empty: number }) | null = null;
    for (const picture of options.fit === 'contain' ? pictures : pictures.slice(0, 1)) {
        const area = areaOf(picture.ratio, block, options.full);
        const shape = picture.ratio || 1;
        const areaShape = area.width / area.height;
        const empty = 1 - Math.min(shape / areaShape, areaShape / shape);
        if (!best || empty < best.empty - FIT_TIE) best = { picture, ...area, empty };
    }
    return best && { picture: best.picture, width: best.width, height: best.height };
}
