/**
 * The media library: images in the module's wiki category, one page per
 * screen (G26), and a media document per image in the module store that
 * image blocks reference. Images someone uploaded in the wiki directly are
 * adopted the first time they are chosen.
 */
import { SCHEMA_VERSION, type MediaDoc } from '../model/schema';
import type { ScreenRepository } from '../store/screen-repository';
import type { PreparedImage } from './scale';
import * as wiki from './wiki';
import type { WikiCategory, WikiFile, WikiPage } from './wiki';

export interface MediaItem {
    fileId: number;
    name: string;
    imageUrl: string;
    /** Title of the carrier page, i.e. the slug of the screen it was uploaded for. */
    page: string;
    width?: number;
    height?: number;
    createdAt?: string;
    /** Set once the image has a media document in the module store. */
    mediaId?: string;
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
    category: wiki.findOrCreateCategory,
    pages: wiki.listPages,
    files: wiki.listFiles,
    ensurePage: wiki.ensureScreenPage,
    upload: wiki.uploadFile,
    remove: wiki.deleteFile,
};

const OVERVIEW_PAGE = 'main';

/**
 * The wiki page uploads go to. Since playlists stand on their own (schema
 * 1.4) there is no screen to name a page after; the library is flat, and
 * older uploads stay on the pages of their screens (Plan.md, 18).
 */
export const MEDIA_PAGE = { slug: 'mediathek', name: 'Mediathek' } as const;

export class MediaInUseError extends Error {
    constructor(readonly usage: { playlist: string; slide: string }[]) {
        super(`Das Bild wird noch verwendet: ${usage.map((u) => `${u.playlist} › ${u.slide}`).join(', ')}.`);
        this.name = 'MediaInUseError';
    }
}

export class MediaLibrary {
    private category: Promise<WikiCategory> | null = null;

    constructor(
        private readonly backend: MediaBackend,
        private readonly repository: ScreenRepository,
    ) {}

    private categoryId(): Promise<number> {
        this.category ??= this.backend.category().catch((error: unknown) => {
            this.category = null;
            throw error;
        });
        return this.category.then((c) => c.id);
    }

    /** All images of all screen pages, newest first. Files without an image address (PDFs …) are left out. */
    async list(): Promise<MediaItem[]> {
        const categoryId = await this.categoryId();
        const pages = (await this.backend.pages(categoryId)).filter((p) => p.title !== OVERVIEW_PAGE);
        const docs = await this.repository.listMedia();
        const byFile = new Map(docs.map((d) => [d.fileId, d]));
        const perPage = await Promise.all(
            pages.map(async (page) => (await this.backend.files(categoryId, page.guid)).map((f) => ({ f, page }))),
        );
        return perPage
            .flat()
            .filter(({ f }) => !!f.imageUrl)
            .map(({ f, page }) => ({
                fileId: f.id,
                name: f.name,
                imageUrl: f.imageUrl!,
                page: page.title,
                width: f.imageMetadata?.width,
                height: f.imageMetadata?.height,
                createdAt: f.meta?.createdDate,
                mediaId: byFile.get(f.id)?.id,
            }))
            .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.fileId - a.fileId);
    }

    /** The media document for an image; created on first use. */
    async adopt(item: MediaItem): Promise<MediaDoc> {
        const existing = (await this.repository.listMedia()).find((d) => d.fileId === item.fileId);
        if (existing) return existing;
        const doc: MediaDoc = {
            schema: { ...SCHEMA_VERSION },
            kind: 'media',
            id: crypto.randomUUID(),
            name: item.name,
            fileId: item.fileId,
            imageUrl: item.imageUrl,
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
                    page: screen.slug,
                    width: image.width || undefined,
                    height: image.height || undefined,
                }),
            );
        }
        return docs;
    }

    async usage(item: MediaItem): Promise<{ playlist: string; slide: string }[]> {
        return item.mediaId ? this.repository.mediaUsage(item.mediaId) : [];
    }

    /** Deletes an image – unless it is still shown somewhere and `force` is not set. */
    async remove(item: MediaItem, force = false): Promise<void> {
        const usage = await this.usage(item);
        if (usage.length && !force) throw new MediaInUseError(usage);
        await this.backend.remove(item.fileId);
        if (item.mediaId) await this.repository.deleteMedia(item.mediaId);
    }
}
