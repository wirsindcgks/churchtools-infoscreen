/**
 * Which image addresses a slide requests. Player, media cache and preloading
 * must agree on them to the letter: the sized URL is the cache key.
 */
import { isVideo, type Block, type MediaDoc, type SlideDoc } from '../model/schema';
import { sizedImageUrl } from './format';

export interface Size {
    width: number;
    height: number;
}

export function backgroundImageUrl(media: MediaDoc, stage: Size): string {
    return sizedImageUrl(media.imageUrl, stage.width, stage.height, 'crop');
}

export function blockImageUrl(media: MediaDoc, block: Size): string {
    return sizedImageUrl(media.imageUrl, block.width, block.height);
}

type HeaderBlock = Extract<Block, { type: 'church-header' }>;

/**
 * The logo of a header block: its own library image, else the church logo.
 * An own image that has gone missing falls back to the church logo – some
 * logo beats an empty corner. Requested in the size of the whole block and
 * fitted inside it, so wide and tall logos both come sharp.
 */
export function headerLogoUrl(block: HeaderBlock, media: Map<string, MediaDoc>, churchLogo: string | null): string | null {
    if (!block.showLogo) return null;
    const found = block.logoMediaId ? media.get(block.logoMediaId) : undefined;
    // A video is no image, whatever it was chosen for.
    const own = found && !isVideo(found) ? found : undefined;
    const base = own?.imageUrl ?? churchLogo;
    return base ? sizedImageUrl(base, block.width, block.height) : null;
}

export function slideImageUrls(
    slide: SlideDoc,
    media: Map<string, MediaDoc>,
    stage: Size,
    churchLogo: string | null = null,
): string[] {
    const urls: string[] = [];
    const background = slide.background.kind === 'media' ? media.get(slide.background.mediaId) : undefined;
    if (background && !isVideo(background)) urls.push(backgroundImageUrl(background, stage));
    for (const block of slide.blocks) {
        const item = block.type === 'image' ? media.get(block.mediaId) : undefined;
        if (item && !isVideo(item)) urls.push(blockImageUrl(item, block));
        if (block.type === 'slideshow') {
            for (const id of block.mediaIds) {
                const shown = media.get(id);
                if (shown && !isVideo(shown)) urls.push(blockImageUrl(shown, block));
            }
        }
        const logo = block.type === 'church-header' ? headerLogoUrl(block, media, churchLogo) : null;
        if (logo) urls.push(logo);
    }
    return urls.filter((url) => /^https?:\/\//.test(url));
}

/** Every image of a screen, each address once. */
export function screenImageUrls(
    slides: SlideDoc[],
    media: MediaDoc[],
    stage: Size,
    churchLogo: string | null = null,
): string[] {
    const byId = new Map(media.map((m) => [m.id, m]));
    return [...new Set(slides.flatMap((slide) => slideImageUrls(slide, byId, stage, churchLogo)))];
}
