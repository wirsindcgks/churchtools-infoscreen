/**
 * The media library: images and videos in the module's wiki category, one page per
 * screen (G26), and a media document per file in the module store that
 * blocks reference. Images someone uploaded in the wiki directly are
 * adopted the first time they are chosen. The library never creates the wiki
 * category itself – that stays the setup assistant's job, so that only it
 * remembers the id and only it may ever remove it (Plan.md, F).
 */
import { SCHEMA_VERSION, type MediaDoc } from '../model/schema';
import type { MediaUse, ScreenRepository } from '../store/screen-repository';
import { videoSrc } from '../player/video';
import type { PreparedImage } from './scale';
import { readVideoMetadata, videoProblem, type VideoMetadata } from './video';
import * as wiki from './wiki';
import type { WikiCategory, WikiFile, WikiPage } from './wiki';
import { LOCALE } from '../i18n/player';

export { VIDEO_MAX_BYTES, VIDEO_TYPES } from './video';

export interface MediaItem {
    fileId: number;
    name: string;
    /** Empty for a video: the image service takes none (G42). */
    imageUrl: string;
    kind: 'image' | 'video';
    /** Download address of a video. */
    fileUrl?: string;
    durationSeconds?: number;
    /** Title of the carrier page, i.e. the slug of the screen it was uploaded for. */
    page: string;
    width?: number;
    height?: number;
    createdAt?: string;
    /** Who uploaded it: ChurchTools' `meta.createdPerson`. */
    createdBy?: string;
    /** Set once the image has a media document in the module store. */
    mediaId?: string;
    /** Where it is shown; empty for an image no slide uses (Plan.md, Nächste Schritte 18). */
    uses: MediaUse[];
}

export type MediaShow = 'all' | 'used' | 'unused';

/**
 * Where an image is shown, one line per screen: "Foyer › Gottesdienst ›
 * Begrüßung". A playlist no screen runs has no screen in front.
 */
export function usageLines(uses: readonly MediaUse[]): string[] {
    const lines = uses.flatMap((u) =>
        u.screens.length
            ? u.screens.map((s) => `${s.name} › ${u.playlist.name} › ${u.slide.name}`)
            : [`${u.playlist.name} › ${u.slide.name}`],
    );
    return [...new Set(lines)];
}

/** The images that match the search – in their name or where they are shown – and the chosen chip. */
export function filterMedia(items: readonly MediaItem[], query: string, show: MediaShow): MediaItem[] {
    const needle = query.trim().toLocaleLowerCase(LOCALE);
    return items.filter(
        (item) =>
            (show === 'all' || (show === 'used') === item.uses.length > 0) &&
            (!needle || [item.name, ...usageLines(item.uses)].join(' ').toLocaleLowerCase(LOCALE).includes(needle)),
    );
}

/**
 * Where a file stands among the files shown, and its neighbours for paging in the preview – no wrap-around at
 * the ends. `null` for a file that is not among them.
 */
export function neighbours(
    items: readonly MediaItem[],
    fileId: number,
): { index: number; count: number; prev?: MediaItem; next?: MediaItem } | null {
    const index = items.findIndex((i) => i.fileId === fileId);
    if (index < 0) return null;
    return { index, count: items.length, prev: items[index - 1], next: items[index + 1] };
}

/** The wiki calls, replaceable in tests. */
export interface MediaBackend {
    category(): Promise<WikiCategory>;
    pages(categoryId: number): Promise<WikiPage[]>;
    files(categoryId: number, pageGuid: string): Promise<WikiFile[]>;
    ensurePage(categoryId: number, slug: string, screenName: string): Promise<WikiPage>;
    upload(categoryId: number, pageGuid: string, file: Blob, name: string): Promise<WikiFile>;
    remove(fileId: number): Promise<void>;
}

export const wikiBackend: MediaBackend = {
    category: async () => {
        const category = await wiki.findCategory();
        if (!category) {
            throw new Error(
                `Den Wiki-Bereich „${wiki.WIKI_CATEGORY_NAME}" gibt es noch nicht. Ein Administrator legt ihn in den Einstellungen an („Automatisch einrichten").`,
            );
        }
        return category;
    },
    pages: wiki.listPages,
    files: wiki.listFiles,
    ensurePage: wiki.ensureScreenPage,
    upload: wiki.uploadFile,
    remove: wiki.deleteFile,
};

const OVERVIEW_PAGE = 'main';

/** A video is a file without an image address, named like an MP4, that has a download address. */
function isVideoFile(file: WikiFile): boolean {
    return !file.imageUrl && /\.mp4$/i.test(file.name) && !!file.fileUrl;
}

/**
 * The wiki page uploads go to. Since playlists stand on their own (schema
 * 1.4) there is no screen to name a page after; the library is flat, and
 * older uploads stay on the pages of their screens (Plan.md, 18).
 */
export const MEDIA_PAGE = { slug: 'mediathek', name: 'Mediathek' } as const;

export class MediaInUseError extends Error {
    constructor(
        readonly usage: { playlist: string; slide: string }[],
        what = 'Bild',
    ) {
        super(`Das ${what} wird noch verwendet: ${usage.map((u) => `${u.playlist} › ${u.slide}`).join(', ')}.`);
        this.name = 'MediaInUseError';
    }
}

export class MediaLibrary {
    private category: Promise<WikiCategory> | null = null;

    constructor(
        private readonly backend: MediaBackend,
        private readonly repository: ScreenRepository,
        private readonly readMetadata: (url: string) => Promise<VideoMetadata> = readVideoMetadata,
    ) {}

    private categoryId(): Promise<number> {
        this.category ??= this.backend.category().catch((error: unknown) => {
            this.category = null;
            throw error;
        });
        return this.category.then((c) => c.id);
    }

    /** All images and videos of all screen pages, newest first. Other files (PDFs …) are left out. */
    async list(): Promise<MediaItem[]> {
        const categoryId = await this.categoryId();
        const pages = (await this.backend.pages(categoryId)).filter((p) => p.title !== OVERVIEW_PAGE);
        const [docs, uses] = await Promise.all([this.repository.listMedia(), this.repository.mediaUses()]);
        const byFile = new Map(docs.map((d) => [d.fileId, d]));
        const perPage = await Promise.all(
            pages.map(async (page) => (await this.backend.files(categoryId, page.guid)).map((f) => ({ f, page }))),
        );
        return perPage
            .flat()
            .filter(({ f }) => !!f.imageUrl || isVideoFile(f))
            .map(({ f, page }): MediaItem => {
                const doc = byFile.get(f.id);
                const video = !f.imageUrl;
                return {
                    fileId: f.id,
                    name: f.name,
                    imageUrl: f.imageUrl ?? '',
                    kind: video ? 'video' : 'image',
                    ...(video ? { fileUrl: f.fileUrl!, durationSeconds: doc?.durationSeconds } : {}),
                    page: page.title,
                    width: f.imageMetadata?.width ?? doc?.width,
                    height: f.imageMetadata?.height ?? doc?.height,
                    createdAt: f.meta?.createdDate,
                    createdBy: f.meta?.createdPerson?.title,
                    mediaId: doc?.id,
                    uses: uses.get(doc?.id ?? '') ?? [],
                };
            })
            .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.fileId - a.fileId);
    }

    /** The media document for an image or video; created on first use. */
    async adopt(item: MediaItem): Promise<MediaDoc> {
        const existing = (await this.repository.listMedia()).find((d) => d.fileId === item.fileId);
        if (existing) return existing;
        const doc: MediaDoc = {
            schema: { ...SCHEMA_VERSION },
            kind: 'media',
            id: crypto.randomUUID(),
            name: item.name,
            fileId: item.fileId,
            imageUrl: item.kind === 'video' ? '' : item.imageUrl,
            ...(item.kind === 'video' ? { mediaType: 'video' as const, fileUrl: item.fileUrl } : {}),
            ...(item.durationSeconds !== undefined ? { durationSeconds: item.durationSeconds } : {}),
            ...(item.width ? { width: item.width } : {}),
            ...(item.height ? { height: item.height } : {}),
        };
        await this.repository.saveMedia(doc);
        return doc;
    }

    /** Uploads to the carrier page of the screen and returns the new media documents. */
    async upload(images: PreparedImage[], screen: { slug: string; name: string }): Promise<MediaDoc[]> {
        const categoryId = await this.categoryId();
        const page = await this.backend.ensurePage(categoryId, screen.slug, screen.name);
        const docs: MediaDoc[] = [];
        for (const image of images) {
            const file = await this.backend.upload(categoryId, page.guid, image.blob, image.name);
            if (!file.imageUrl) throw new Error(`„${image.name}" ist kein Bild, das ChurchTools anzeigen kann.`);
            docs.push(
                await this.adopt({
                    fileId: file.id,
                    name: file.name,
                    imageUrl: file.imageUrl,
                    kind: 'image',
                    page: screen.slug,
                    uses: [],
                    width: image.width || undefined,
                    height: image.height || undefined,
                }),
            );
        }
        return docs;
    }

    /**
     * Uploads a video as it is – no scaling – and returns its media document.
     * Type and size are refused before anything is sent. Length and size come
     * from the uploaded file afterwards; without them the video is saved all the same.
     */
    async uploadVideo(file: File, screen: { slug: string; name: string }): Promise<MediaDoc> {
        const problem = videoProblem(file);
        if (problem) throw new Error(problem);
        const categoryId = await this.categoryId();
        const page = await this.backend.ensurePage(categoryId, screen.slug, screen.name);
        const uploaded = await this.backend.upload(categoryId, page.guid, file, file.name);
        if (!uploaded.fileUrl) throw new Error(`„${file.name}" ist kein Video, das ChurchTools abspielen kann.`);
        const metadata = await this.readMetadata(videoSrc({ fileUrl: uploaded.fileUrl }) ?? uploaded.fileUrl).catch((): VideoMetadata => ({}));
        return this.adopt({
            fileId: uploaded.id,
            name: uploaded.name,
            imageUrl: '',
            kind: 'video',
            fileUrl: uploaded.fileUrl,
            page: screen.slug,
            uses: [],
            ...metadata,
        });
    }

    async usage(item: MediaItem): Promise<{ playlist: string; slide: string }[]> {
        return item.mediaId ? this.repository.mediaUsage(item.mediaId) : [];
    }

    /** Deletes an image or video – unless it is still shown somewhere and `force` is not set. */
    async remove(item: MediaItem, force = false): Promise<void> {
        const usage = await this.usage(item);
        if (usage.length && !force) throw new MediaInUseError(usage, item.kind === 'video' ? 'Video' : 'Bild');
        await this.backend.remove(item.fileId);
        if (item.mediaId) await this.repository.deleteMedia(item.mediaId);
    }
}
