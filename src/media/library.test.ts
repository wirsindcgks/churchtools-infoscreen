import { beforeEach, describe, expect, it } from 'vitest';
import { createScreenBundle } from '../designer/ops';
import { MemoryKv } from '../store/memory-kv';
import { ScreenRepository } from '../store/screen-repository';
import { MediaInUseError, MediaLibrary, type MediaBackend } from './library';
import type { WikiFile, WikiPage } from './wiki';

class FakeWiki implements MediaBackend {
    pagesById = new Map<string, WikiPage>([['p-main', { guid: 'p-main', title: 'main' }]]);
    filesByPage = new Map<string, WikiFile[]>();
    nextId = 100;
    removed: number[] = [];

    async category() {
        return { id: 7, name: 'Infoscreen' };
    }
    async pages() {
        return [...this.pagesById.values()];
    }
    async files(_: number, guid: string) {
        return this.filesByPage.get(guid) ?? [];
    }
    async ensurePage(_: number, slug: string) {
        const found = [...this.pagesById.values()].find((p) => p.title === slug);
        if (found) return found;
        const page = { guid: `p-${slug}`, title: slug };
        this.pagesById.set(page.guid, page);
        return page;
    }
    async upload(_: number, guid: string, __: Blob, name: string) {
        const file: WikiFile = { id: this.nextId++, name, imageUrl: `https://example.church.tools/images/${this.nextId}/h` };
        this.filesByPage.set(guid, [...(this.filesByPage.get(guid) ?? []), file]);
        return file;
    }
    async remove(fileId: number) {
        this.removed.push(fileId);
        for (const [guid, files] of this.filesByPage) this.filesByPage.set(guid, files.filter((f) => f.id !== fileId));
    }
}

const image = (name: string) => ({ blob: new Blob(['x']), name, width: 1920, height: 1080 });

describe('MediaLibrary', () => {
    let wiki: FakeWiki;
    let repository: ScreenRepository;
    let library: MediaLibrary;

    beforeEach(() => {
        wiki = new FakeWiki();
        repository = new ScreenRepository(new MemoryKv());
        library = new MediaLibrary(wiki, repository);
    });

    it('uploads to the page of the screen and creates it on first use', async () => {
        const [doc] = await library.upload([image('plakat.jpg')], { slug: 'foyer', name: 'Foyer' });
        expect([...wiki.pagesById.values()].map((p) => p.title)).toContain('foyer');
        expect(doc).toMatchObject({ kind: 'media', name: 'plakat.jpg', width: 1920 });
        expect((await repository.listMedia()).map((m) => m.id)).toEqual([doc!.id]);
    });

    it('lists images of all screen pages, not the overview page', async () => {
        await library.upload([image('a.jpg')], { slug: 'foyer', name: 'Foyer' });
        await library.upload([image('b.jpg')], { slug: 'saal', name: 'Saal' });
        wiki.filesByPage.set('p-main', [{ id: 1, name: 'anleitung.png', imageUrl: 'https://example.church.tools/images/1/h' }]);
        const items = await library.list();
        expect(items.map((i) => i.name).sort()).toEqual(['a.jpg', 'b.jpg']);
        expect(items.every((i) => i.mediaId)).toBe(true);
    });

    it('adopts an image that was uploaded in the wiki directly', async () => {
        await wiki.ensurePage(7, 'foyer');
        wiki.filesByPage.set('p-foyer', [{ id: 55, name: 'direkt.png', imageUrl: 'https://example.church.tools/images/55/h' }]);
        const [item] = await library.list();
        expect(item?.mediaId).toBeUndefined();
        const doc = await library.adopt(item!);
        expect(doc.fileId).toBe(55);
        expect((await library.adopt(item!)).id).toBe(doc.id); // no duplicate
    });

    it('refuses to delete an image that a screen still shows, and names where', async () => {
        const [doc] = await library.upload([image('plakat.jpg')], { slug: 'foyer', name: 'Foyer' });
        const bundle = createScreenBundle({ name: 'Foyer', slug: 'foyer', orientation: 'landscape' });
        bundle.slides[0]!.blocks.push({ id: 'img', type: 'image', x: 0, y: 0, width: 100, height: 100, mediaId: doc!.id, fit: 'contain' });
        await repository.saveScreen(bundle, { expectedRevision: null, updatedBy: 'Anna' });

        const [item] = await library.list();
        const attempt = library.remove(item!);
        await expect(attempt).rejects.toBeInstanceOf(MediaInUseError);
        await expect(attempt).rejects.toThrow('Foyer › Willkommen');
        expect(wiki.removed).toEqual([]);

        await library.remove(item!, true);
        expect(wiki.removed).toEqual([item!.fileId]);
        expect(await repository.listMedia()).toEqual([]);
    });

    it('deletes an unused image without asking', async () => {
        await library.upload([image('alt.jpg')], { slug: 'foyer', name: 'Foyer' });
        const [item] = await library.list();
        await library.remove(item!);
        expect(await library.list()).toEqual([]);
    });
});
