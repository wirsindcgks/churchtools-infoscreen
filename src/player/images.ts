/**
 * Which image addresses a slide requests. Player, media cache and preloading
 * must agree on them to the letter: the sized URL is the cache key.
 */
import type { MediaDoc, SlideDoc } from '../model/schema';
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

export function slideImageUrls(slide: SlideDoc, media: Map<string, MediaDoc>, stage: Size): string[] {
    const urls: string[] = [];
    const background = slide.background.kind === 'media' ? media.get(slide.background.mediaId) : undefined;
    if (background) urls.push(backgroundImageUrl(background, stage));
    for (const block of slide.blocks) {
        const item = block.type === 'image' ? media.get(block.mediaId) : undefined;
        if (item) urls.push(blockImageUrl(item, block));
    }
    return urls.filter((url) => /^https?:\/\//.test(url));
}

/** Every image of a screen, each address once. */
export function screenImageUrls(slides: SlideDoc[], media: MediaDoc[], stage: Size): string[] {
    const byId = new Map(media.map((m) => [m.id, m]));
    return [...new Set(slides.flatMap((slide) => slideImageUrls(slide, byId, stage)))];
}
