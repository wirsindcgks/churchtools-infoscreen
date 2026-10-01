/**
 * Where a video is played from (Plan.md, Nächste Schritte 52): the download
 * address of its file – the image service takes no videos (G42). Never cached
 * on the device, so there is nothing to agree on with the media cache.
 */
import type { MediaDoc } from '../model/schema';

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
