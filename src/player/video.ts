/**
 * Where a video is played from (Plan.md, Nächste Schritte 52): the download
 * address of its file – the image service takes no videos (G42). The video
 * cache (`video-cache.ts`) keeps the file under this very address, and the
 * service worker answers the request from there, so the two must agree on it.
 */
import { isVideo, type MediaDoc, type SlideDoc } from '../model/schema';

/** In development the download address is reached through the dev proxy, which brings the session the instance wants (G47). */
export function videoSrc(media: Pick<MediaDoc, 'fileUrl'> | undefined): string | null {
    const url = media?.fileUrl;
    if (!url || !/^https?:\/\//.test(url)) return null;
    if (import.meta.env.DEV) {
        const parsed = new URL(url);
        if (parsed.search.startsWith('?q=public/filedownload')) return parsed.pathname + parsed.search;
    }
    return url;
}

/** Every video address of a screen's slides, each once – what the video cache keeps on the device. */
export function screenVideoUrls(slides: SlideDoc[], media: MediaDoc[]): string[] {
    const byId = new Map(media.map((m) => [m.id, m]));
    const urls: string[] = [];
    for (const slide of slides) {
        for (const block of slide.blocks) {
            if (block.type !== 'video' || !block.mediaId) continue;
            const item = byId.get(block.mediaId);
            const src = item && isVideo(item) ? videoSrc(item) : null;
            if (src) urls.push(src);
        }
    }
    return [...new Set(urls)];
}
