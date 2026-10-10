import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { DraftsUnavailableError } from '../store/drafts';
import { MemoryKv } from '../store/memory-kv';
import { ScreenRepository } from '../store/screen-repository';
import { useEditorStore } from './editor-store';
import { createScreenBundle } from './ops';

async function setup() {
    const kv = new MemoryKv();
    const repository = new ScreenRepository(kv);
    const bundle = createScreenBundle({ name: 'Foyer', slug: 'foyer', orientation: 'landscape' });
    await repository.saveScreen(bundle, { expectedRevision: null, updatedBy: 'Anna' });
    setActivePinia(createPinia());
    const editor = useEditorStore();
    editor.attach(repository, 'Anna');
    const playlistId = bundle.screen.defaultPlaylistId;
    await editor.open(playlistId);
    return { editor, repository, playlistId, kv };
}

describe('editor store', () => {
    beforeEach(() => setActivePinia(createPinia()));

    it('opens a screen with its first slide selected and nothing to save', async () => {
        const { editor } = await setup();
        expect(editor.slide?.name).toBe('Willkommen');
        expect(editor.dirty).toBe(false);
        expect(editor.canUndo).toBe(false);
    });

    it('adds a block, marks the screen as changed and undoes it', async () => {
        const { editor } = await setup();
        editor.addBlock('text');
        expect(editor.block?.type).toBe('text');
        expect(editor.dirty).toBe(true);
        editor.undo();
        expect(editor.slide?.blocks).toHaveLength(0);
        expect(editor.dirty).toBe(false);
        editor.redo();
        expect(editor.slide?.blocks).toHaveLength(1);
    });

    it('records a whole drag as one undo step', async () => {
        const { editor } = await setup();
        editor.addBlock('shape');
        const id = editor.block!.id;
        const startX = editor.block!.x;
        editor.beginGesture();
        for (let x = 1; x <= 20; x++) editor.updateBlock(id, { x: startX + x * 10 });
        editor.endGesture();
        expect(editor.block?.x).toBe(startX + 200);
        editor.undo();
        expect(editor.block?.x).toBe(startX);
    });

    it('records a whole editing run on the stage as one undo step and ends it when the choice changes (Plan.md 79, C4)', async () => {
        const { editor } = await setup();
        editor.addBlock('text');
        const id = editor.block!.id;
        const before = editor.block!.type === 'text' ? editor.block!.text : '';
        editor.startTextEdit(id);
        expect(editor.editingTextId).toBe(id);
        for (const text of ['H', 'Ha', 'Hal', 'Hallo']) editor.updateBlock(id, { text });
        editor.endTextEdit();
        expect(editor.editingTextId).toBeNull();
        editor.undo();
        expect(editor.block?.type === 'text' && editor.block.text).toBe(before);

        editor.startTextEdit(id);
        editor.selectBlock(null);
        expect(editor.editingTextId).toBeNull();

        // Undo in the middle of writing ends it and takes the whole writing back.
        editor.startTextEdit(id);
        editor.updateBlock(id, { text: 'Welt' });
        editor.undo();
        expect(editor.editingTextId).toBeNull();
        expect(editor.block?.type === 'text' && editor.block.text).toBe(before);
    });

    it('does not write on a locked block, and ends when the block is locked or deleted (Plan.md 79, C4)', async () => {
        const { editor } = await setup();
        editor.addBlock('text');
        const id = editor.block!.id;
        editor.startTextEdit(id);
        editor.setLocked([id], true);
        expect(editor.editingTextId).toBeNull();
        editor.startTextEdit(id);
        expect(editor.editingTextId).toBeNull();
        editor.setLocked([id], false);
        editor.startTextEdit(id);
        editor.removeBlocks([id]);
        expect(editor.editingTextId).toBeNull();
        editor.addBlock('shape');
        editor.startTextEdit(editor.block!.id);
        expect(editor.editingTextId).toBeNull();
    });

    it('keeps blocks on the stage when they are dragged off', async () => {
        const { editor } = await setup();
        editor.addBlock('shape');
        editor.updateBlock(editor.block!.id, { x: 99_999 });
        expect(editor.block!.x).toBeLessThan(editor.stage.width);
    });

    it('manages slides in playlist order', async () => {
        const { editor } = await setup();
        editor.addSlide();
        editor.updateSlide({ name: 'Termine' });
        editor.duplicateCurrentSlide();
        expect(editor.slides.map((s) => s.name)).toEqual(['Willkommen', 'Termine', 'Termine (Kopie)']);
        editor.moveSlide(2, 0);
        expect(editor.slides[0]?.name).toBe('Termine (Kopie)');
        editor.removeSlide(editor.slides[0]!.id);
        expect(editor.slides.map((s) => s.name)).toEqual(['Willkommen', 'Termine']);
    });

    it('opens a playlist of its own, named after the screen that came with it', async () => {
        const { editor } = await setup();
        expect(editor.playlist?.name).toBe('Foyer');
        expect(editor.screens.map((s) => s.name)).toEqual(['Foyer']);
        expect(editor.revision).toBe(1);
    });

    it('saves and reloads the same state', async () => {
        const { editor, repository, playlistId } = await setup();
        editor.addBlock('clock');
        expect(await editor.publish()).toBe(true);
        expect(editor.dirty).toBe(false);
        expect(editor.revision).toBe(2);
        const loaded = await repository.loadPlaylist(playlistId);
        expect(loaded.slides[0]?.blocks[0]?.type).toBe('clock');
        expect(loaded.playlist).toMatchObject({ revision: 2, updatedBy: 'Anna' });
        expect((await repository.loadScreen('foyer')).slides[0]?.blocks[0]?.type).toBe('clock'); // what the TV gets
    });

    it('renames the playlist and refuses to save it without a name', async () => {
        const { editor, repository, playlistId } = await setup();
        editor.renamePlaylist('');
        expect(await editor.publish()).toBe(false);
        expect(editor.error).toMatch(/Namen/);
        editor.renamePlaylist('Gottesdienst');
        expect(await editor.publish()).toBe(true);
        expect((await repository.loadPlaylist(playlistId)).playlist.name).toBe('Gottesdienst');
    });

    it('stops at a conflict and lets the user decide', async () => {
        const { editor, repository, playlistId } = await setup();
        // Another designer saves in between.
        const other = await repository.loadPlaylist(playlistId);
        await repository.savePlaylist(other, { expectedRevision: 1, updatedBy: 'Ben' });

        editor.addBlock('text');
        expect(await editor.publish()).toBe(false);
        expect(editor.status).toBe('conflict');
        expect(editor.conflict?.updatedBy).toBe('Ben');
        expect(editor.dirty).toBe(true);

        expect(await editor.overwrite()).toBe(true);
        expect((await repository.loadPlaylist(playlistId)).playlist.updatedBy).toBe('Anna');
    });

    it('keeps all of its own slides with "Meine behalten", not only the changed ones (Plan.md 49)', async () => {
        const { editor, repository, playlistId } = await setup();
        // Ben renames the one slide; Anna only renames the playlist.
        const other = await repository.loadPlaylist(playlistId);
        other.slides[0]!.name = 'Bens Name';
        await repository.savePlaylist(other, { expectedRevision: 1, updatedBy: 'Ben' });

        editor.renamePlaylist('Annas Playlist');
        expect(await editor.publish()).toBe(false);
        expect(await editor.overwrite()).toBe(true);
        const stored = await repository.loadPlaylist(playlistId);
        expect(stored.playlist.name).toBe('Annas Playlist');
        expect(stored.slides[0]?.name).toBe('Willkommen');
    });

    it('can drop its own changes after a conflict', async () => {
        const { editor, repository, playlistId } = await setup();
        const other = await repository.loadPlaylist(playlistId);
        await repository.savePlaylist(other, { expectedRevision: 1, updatedBy: 'Ben' });
        editor.addBlock('text');
        await editor.publish();
        await editor.discardAndReload();
        expect(editor.slide?.blocks).toHaveLength(0);
        expect(editor.revision).toBe(2);
    });

    it('saves content without touching the screen document, which belongs to the administrators (Plan.md, F)', async () => {
        const { editor, repository } = await setup();
        const before = (await repository.listScreens())[0]!;
        editor.addBlock('clock');
        expect(await editor.publish()).toBe(true);
        // An administrator renames the screen meanwhile – against the screen's own revision, no conflict with content.
        await repository.saveScreenSettings(before.id, { name: 'Foyer links' }, { expectedRevision: before.revision, updatedBy: 'Admin' });
        editor.addBlock('text');
        expect(await editor.publish()).toBe(true);
        const loaded = await repository.loadScreen('foyer');
        expect(loaded.screen.name).toBe('Foyer links');
        expect(loaded.screen.revision).toBe(before.revision + 1);
        expect(loaded.slides[0]?.blocks).toHaveLength(2);
    });

    it('keeps a locked block as it is until it is unlocked (Plan.md, 25)', async () => {
        const { editor } = await setup();
        editor.addBlock('shape');
        const id = editor.block!.id;
        editor.addBlock('text');
        const x = editor.slide!.blocks[0]!.x;
        editor.setLocked([id], true);
        editor.updateBlock(id, { x: x + 100 });
        editor.layerBlocks([id], 'front');
        editor.removeBlocks([id]);
        expect(editor.slide!.blocks[0]).toMatchObject({ id, x, locked: true });
        editor.setLocked([id], false);
        expect(editor.slide!.blocks[0]!.locked).toBeUndefined();
        editor.updateBlock(id, { x: x + 100 });
        expect(editor.slide!.blocks[0]!.x).toBe(x + 100);
        editor.undo();
        editor.undo();
        expect(editor.slide!.blocks[0]!.locked).toBe(true); // locking is a step of its own
    });

    it('changes paint order and removes blocks', async () => {
        const { editor } = await setup();
        editor.addBlock('shape');
        const shape = editor.block!.id;
        editor.addBlock('text');
        editor.layerBlocks([shape], 'front');
        expect(editor.slide?.blocks.at(-1)?.id).toBe(shape);
        editor.removeBlocks([shape]);
        expect(editor.slide?.blocks).toHaveLength(1);
    });
});

describe('editor store gestures', () => {
    it('does not record an undo step for a field that was focused but not changed', async () => {
        const { editor } = await setup();
        editor.beginGesture();
        editor.endGesture();
        expect(editor.canUndo).toBe(false);
    });

    it('turns typing in one field into one undo step', async () => {
        const { editor } = await setup();
        editor.addBlock('text');
        const id = editor.block!.id;
        editor.beginGesture();
        for (const text of ['H', 'Ha', 'Hal', 'Hall', 'Hallo']) editor.updateBlock(id, { text } as never);
        editor.endGesture();
        editor.undo();
        expect((editor.block as { text?: string } | null)?.text).toBe('Text');
    });
});

describe('linked slides (Plan.md 49)', () => {
    /** The editor on playlist A, and B, a linked duplicate of it: both show the same slide. */
    async function linkedSetup() {
        const base = await setup();
        const b = await base.repository.duplicatePlaylist(base.playlistId, 'Anna', new Date(), { linked: true });
        await base.editor.open(base.playlistId);
        return { ...base, b };
    }
    const inFuture = () => new Date(Date.now() + 60_000);

    it('writes only the slides that changed', async () => {
        const { editor, kv } = await setup();
        editor.addSlide();
        await editor.publish();
        kv.writes.length = 0;
        editor.updateSlide({ name: 'Zweite' });
        expect(await editor.publish()).toBe(true);
        expect(kv.writes).toHaveLength(2); // the changed slide and the playlist
    });

    it('names the linked slides publishing would write, before and not after', async () => {
        const { editor, b } = await linkedSetup();
        expect(editor.linkedToPublish).toEqual([]);
        editor.addSlide();
        expect(editor.linkedToPublish).toEqual([]); // only an own slide is new
        editor.selectSlide(editor.slides[0]!.id);
        editor.updateSlide({ name: 'Begrüßung' });
        expect(editor.linkedToPublish).toEqual([{ name: 'Begrüßung', playlists: [b.name] }]);
        expect(await editor.publish()).toBe(true);
        expect(editor.linkedToPublish).toEqual([]);
    });

    it('saves a linked slide twice in a row without a false conflict', async () => {
        const { editor, repository, playlistId, b } = await linkedSetup();
        expect(editor.linkedIn(editor.slide!.id).map((p) => p.id)).toEqual([b.id]);
        editor.updateSlide({ name: 'Eins' });
        expect(await editor.publish()).toBe(true);
        editor.updateSlide({ name: 'Zwei' });
        expect(await editor.publish()).toBe(true);
        expect(editor.status).toBe('published');
        expect((await repository.loadPlaylist(b.id)).slides[0]?.name).toBe('Zwei');
        expect((await repository.loadPlaylist(playlistId)).slides[0]?.name).toBe('Zwei');
    });

    it('stops when another playlist saved the linked slide first, and can keep mine as a copy', async () => {
        const { editor, repository, b } = await linkedSetup();
        const inB = await repository.loadPlaylist(b.id);
        await repository.savePlaylist(
            { ...inB, slides: inB.slides.map((s) => ({ ...s, name: 'Von Ben' })) },
            { expectedRevision: inB.playlist.revision, updatedBy: 'Ben', now: inFuture(), changedSlideIds: [inB.slides[0]!.id] },
        );
        editor.updateSlide({ name: 'Von Anna' });
        expect(await editor.publish()).toBe(false);
        expect(editor.status).toBe('conflict');
        expect(editor.conflict).toBeNull();
        expect(editor.slideConflict).toMatchObject({ slide: { name: 'Von Ben' }, updatedBy: 'Ben' });

        const oldId = editor.slide!.id;
        expect(await editor.keepAsCopy()).toBe(true);
        expect(editor.slide!.id).not.toBe(oldId);
        expect(editor.slide!.name).toBe('Von Anna');
        expect(editor.linkedIn(editor.slide!.id)).toEqual([]);
        expect((await repository.loadPlaylist(b.id)).slides[0]?.name).toBe('Von Ben');
    });

    it('takes slides over linked: same id, unchanged until edited, duplicates skipped', async () => {
        const { editor, repository, playlistId, kv } = await setup();
        const other = await repository.createPlaylist({ name: 'Andere', stage: editor.stage }, 'Anna');
        await editor.open(other.id);
        const source = (await repository.loadPlaylist(playlistId)).slides;
        editor.insertSlides(source, { linked: true, from: { id: playlistId, name: 'Foyer' } });
        expect(editor.slides.map((s) => s.id)).toContain(source[0]!.id);
        expect(editor.linkedIn(source[0]!.id)).toEqual([{ id: playlistId, name: 'Foyer' }]);
        editor.insertSlides(source, { linked: true, from: { id: playlistId, name: 'Foyer' } });
        expect(editor.slides).toHaveLength(2);

        kv.writes.length = 0;
        expect(await editor.publish()).toBe(true);
        expect(kv.writes).toHaveLength(1); // only the playlist
        editor.selectSlide(source[0]!.id);
        editor.updateSlide({ name: 'Geändert' });
        kv.writes.length = 0;
        await editor.publish();
        expect(kv.writes).toHaveLength(2);
    });

    it('lets a copy replace the linked slide in place, and undo brings the link back', async () => {
        const { editor } = await linkedSetup();
        const oldId = editor.slide!.id;
        editor.unlinkSlide(oldId);
        expect(editor.slide!.id).not.toBe(oldId);
        expect(editor.slide!.name).toBe('Willkommen');
        expect(editor.slides.map((s) => s.id)).not.toContain(oldId);
        expect(editor.linkedIn(editor.slide!.id)).toEqual([]);
        editor.undo();
        expect(editor.slide!.id).toBe(oldId);
        expect(editor.linkedIn(oldId)).toHaveLength(1);
    });

    describe('copy and paste (Plan.md 79, A5)', () => {
        it('copies a block over to another slide and pastes it on the same spot', async () => {
            const { editor } = await setup();
            editor.addBlock('text');
            const original = { ...editor.block! };
            editor.copyBlocks([original.id]);
            editor.addSlide();
            expect(editor.slide?.blocks).toHaveLength(0);
            editor.pasteBlocks();
            const pasted = editor.block!;
            expect(pasted.id).not.toBe(original.id);
            expect([pasted.x, pasted.y, pasted.width, pasted.height]).toEqual([original.x, original.y, original.width, original.height]);
            expect(pasted.type === 'text' && pasted.text).toBe(original.type === 'text' && original.text);
            expect(editor.slide?.blocks).toHaveLength(1);
        });

        it('steps a paste aside on the same slide, and the pasted block is chosen', async () => {
            const { editor } = await setup();
            editor.addBlock('shape');
            const original = editor.block!;
            editor.copyBlocks([original.id]);
            editor.pasteBlocks();
            expect(editor.slide?.blocks).toHaveLength(2);
            expect([editor.block!.x, editor.block!.y]).toEqual([original.x + 40, original.y + 40]);
            expect(editor.block!.id).not.toBe(original.id);
        });

        it('makes a locked block loose again in the copy', async () => {
            const { editor } = await setup();
            editor.addBlock('shape');
            const id = editor.block!.id;
            editor.setLocked([id], true);
            editor.duplicateBlocks([id]);
            expect(editor.slide?.blocks[0]?.locked).toBe(true);
            expect(editor.block?.locked).toBeUndefined();
            expect(editor.block?.id).not.toBe(id);
        });

        it('duplicates in one step and leaves the clipboard alone', async () => {
            const { editor } = await setup();
            editor.addBlock('text');
            editor.addBlock('shape');
            editor.copyBlocks([editor.slide!.blocks[0]!.id]);
            const copied = editor.clipboard[0]!.id;
            editor.duplicateBlocks([editor.slide!.blocks[1]!.id]);
            expect(editor.slide?.blocks).toHaveLength(3);
            expect(editor.clipboard[0]?.id).toBe(copied);
            editor.undo();
            expect(editor.slide?.blocks).toHaveLength(2);
        });

        it('pastes as one step in the history', async () => {
            const { editor } = await setup();
            editor.addBlock('text');
            editor.copyBlocks([editor.block!.id]);
            editor.pasteBlocks();
            expect(editor.slide?.blocks).toHaveLength(2);
            editor.undo();
            expect(editor.slide?.blocks).toHaveLength(1);
        });

        it('cuts: copy and delete as one step; a locked block stays', async () => {
            const { editor } = await setup();
            editor.addBlock('text');
            const id = editor.block!.id;
            editor.setLocked([id], true);
            editor.cutBlocks([id]);
            expect(editor.slide?.blocks).toHaveLength(1);
            expect(editor.clipboard).toHaveLength(0);
            editor.setLocked([id], false);
            editor.cutBlocks([id]);
            expect(editor.slide?.blocks).toHaveLength(0);
            expect(editor.clipboard).toHaveLength(1);
            editor.undo();
            expect(editor.slide?.blocks).toHaveLength(1);
        });

        it('shrinks a block pasted from landscape onto a portrait stage', async () => {
            const { editor, repository } = await setup();
            editor.addBlock('appointment-list');
            editor.copyBlocks([editor.block!.id]);
            const portrait = createScreenBundle({ name: 'Flur', slug: 'flur', orientation: 'portrait' });
            await repository.saveScreen(portrait, { expectedRevision: null, updatedBy: 'Anna' });
            await editor.open(portrait.screen.defaultPlaylistId);
            editor.pasteBlocks();
            const b = editor.block!;
            expect(b.x + b.width).toBeLessThanOrEqual(1080);
            expect(b.y + b.height).toBeLessThanOrEqual(1920);
            expect(b.width / b.height).toBeCloseTo(1400 / 600, 1);
        });

        it('keeps the clipboard when another playlist is opened', async () => {
            const { editor, repository } = await setup();
            editor.addBlock('text');
            editor.copyBlocks([editor.block!.id]);
            const other = createScreenBundle({ name: 'Flur', slug: 'flur', orientation: 'landscape' });
            await repository.saveScreen(other, { expectedRevision: null, updatedBy: 'Anna' });
            await editor.open(other.screen.defaultPlaylistId);
            expect(editor.clipboard).toHaveLength(1);
            editor.pasteBlocks();
            expect(editor.slide?.blocks).toHaveLength(1);
        });

        it('puts new blocks of one kind in different places (A6)', async () => {
            const { editor } = await setup();
            editor.addBlock('text');
            editor.addBlock('text');
            editor.addBlock('text');
            const spots = editor.slide!.blocks.map((b) => [b.x, b.y]);
            expect(new Set(spots.map(String)).size).toBe(3);
        });
    });

    it('moves a layer by dragging in one step; a locked block keeps its place (Plan.md 79, B3)', async () => {
        const { editor } = await setup();
        editor.addBlock('text');
        editor.addBlock('shape');
        editor.addBlock('clock');
        editor.addBlock('qr');
        const types = () => editor.slide!.blocks.map((b) => b.type);
        expect(types()).toEqual(['text', 'shape', 'clock', 'qr']);
        editor.setLocked([editor.slide!.blocks[1]!.id], true);
        editor.moveBlockLayer(0, 2);
        // The text passes the locked shape, which stays at place 1.
        expect(types()).toEqual(['clock', 'shape', 'text', 'qr']);
        editor.undo();
        expect(types()).toEqual(['text', 'shape', 'clock', 'qr']);
    });

    it('starts with the guides off, and keeps a choice made before (Plan.md 79, B3)', () => {
        localStorage.removeItem('infoscreen-designer.grid');
        setActivePinia(createPinia());
        expect(useEditorStore().gridSize).toBe(0);
        localStorage.setItem('infoscreen-designer.grid', '20');
        setActivePinia(createPinia());
        expect(useEditorStore().gridSize).toBe(20);
        localStorage.setItem('infoscreen-designer.grid', '0');
        setActivePinia(createPinia());
        expect(useEditorStore().gridSize).toBe(0);
        localStorage.removeItem('infoscreen-designer.grid');
    });
});

describe('drafts (Plan.md 79, Paket E)', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    async function draftSetup(options: { category?: boolean } = {}) {
        const kv = new MemoryKv();
        const repository = new ScreenRepository(kv);
        if (options.category !== false) await repository.drafts.ensureCategory();
        const bundle = createScreenBundle({ name: 'Foyer', slug: 'foyer', orientation: 'landscape' });
        await repository.saveScreen(bundle, { expectedRevision: null, updatedBy: 'Anna' });
        setActivePinia(createPinia());
        const editor = useEditorStore();
        editor.attach(repository, 'Anna');
        const playlistId = bundle.screen.defaultPlaylistId;
        await editor.open(playlistId);
        return { editor, repository, playlistId, kv };
    }
    /** Lets the watch run and the clock move on. */
    async function wait(ms: number) {
        await nextTick();
        await vi.advanceTimersByTimeAsync(ms);
    }

    it('is off without the category, and publishing goes as before', async () => {
        const { editor } = await draftSetup({ category: false });
        expect(editor.draftsOn).toBe(false);
        expect(editor.draftStatus).toBe('off');
        editor.updateSlide({ name: 'Neu' });
        await wait(10_000);
        expect(editor.draftStatus).toBe('off');
        expect(await editor.publish()).toBe(true);
        expect(editor.status).toBe('published');
    });

    it('starts clean and saves 2 s after the last change, only the differing slides', async () => {
        const { editor, repository, playlistId } = await draftSetup();
        expect(editor.draftStatus).toBe('clean');
        editor.addSlide();
        await wait(1500);
        expect(editor.draftStatus).toBe('pending');
        editor.updateSlide({ name: 'Zweite' });
        await wait(1500);
        expect(editor.draftStatus).toBe('pending'); // the change moved the time on
        await wait(600);
        expect(editor.draftStatus).toBe('saved');
        const stored = await repository.drafts.load(playlistId);
        expect(stored?.playlist.slideIds).toHaveLength(2);
        expect(stored?.slides.map((s) => s.name)).toEqual(['Zweite']); // the first slide is as published
        expect(stored?.playlist.updatedBy).toBe('Anna');
        expect(editor.draftRevision).toBe(1);
        expect(editor.draftInfo?.updatedBy).toBe('Anna');
        expect(editor.unsavedDraft).toBe(false);
    });

    it('waits 5 s after the start of the last save at the earliest', async () => {
        const { editor, repository, playlistId } = await draftSetup();
        editor.addSlide();
        await wait(2100);
        expect(editor.draftRevision).toBe(1);
        editor.updateSlide({ name: 'Eins' });
        await wait(2100);
        expect(editor.draftRevision).toBe(1); // 2 s are over, 5 s are not
        await wait(3000);
        expect(editor.draftRevision).toBe(2);
        expect((await repository.drafts.load(playlistId))?.slides.some((s) => s.name === 'Eins')).toBe(true);
    });

    it('discards the draft when everything is undone', async () => {
        const { editor, repository, playlistId } = await draftSetup();
        editor.addSlide();
        await wait(2100);
        expect(await repository.drafts.load(playlistId)).not.toBeNull();
        editor.undo();
        await wait(5100);
        expect(await repository.drafts.load(playlistId)).toBeNull();
        expect(editor.draftRevision).toBe(0);
        expect(editor.draftStatus).toBe('clean');
        expect(editor.dirty).toBe(false);
    });

    it('opens the draft over the published state: name, order, changed and new slides', async () => {
        const { editor, repository, playlistId } = await draftSetup();
        editor.addSlide();
        editor.renamePlaylist('Sonntag');
        editor.selectSlide(editor.slides[0]!.id);
        editor.updateSlide({ name: 'Anders' });
        editor.moveSlide(0, 1);
        const order = editor.playlist!.slideIds.slice();
        await wait(2100);
        await editor.open(playlistId);
        expect(editor.playlist?.name).toBe('Sonntag');
        expect(editor.playlist?.slideIds).toEqual(order);
        expect(editor.slides.some((s) => s.name === 'Anders')).toBe(true);
        expect(editor.slides).toHaveLength(2);
        expect(editor.dirty).toBe(true);
        expect(editor.draftFromOpen).toBe(true);
        expect(editor.draftStatus).toBe('saved');
        expect(editor.draftInfo?.updatedBy).toBe('Anna');
        expect(editor.canUndo).toBe(false);
        // the published state stays untouched
        expect((await repository.loadPlaylist(playlistId)).playlist.name).not.toBe('Sonntag');
    });

    it('keeps a linked slide taken over and unchanged through saving and opening', async () => {
        const { editor, repository, playlistId } = await draftSetup();
        const other = await repository.createPlaylist({ name: 'Andere', stage: editor.stage }, 'Anna');
        await editor.open(other.id);
        const source = (await repository.loadPlaylist(playlistId)).slides;
        editor.insertSlides(source, { linked: true, from: { id: playlistId, name: 'Foyer' } });
        await wait(2100);
        await editor.open(other.id);
        expect(editor.slides.map((s) => s.id)).toContain(source[0]!.id);
        expect(editor.linkedIn(source[0]!.id).map((p) => p.id)).toEqual([playlistId]);
        expect(editor.linkedToPublish.map((l) => l.name)).toEqual([source[0]!.name]);
    });

    it('publishing drops the draft', async () => {
        const { editor, repository, playlistId } = await draftSetup();
        editor.updateSlide({ name: 'Neu' });
        await wait(2100);
        expect(await repository.drafts.load(playlistId)).not.toBeNull();
        editor.updateSlide({ name: 'Neuer' });
        expect(await editor.publish()).toBe(true);
        expect(await repository.drafts.load(playlistId)).toBeNull();
        expect(editor.draftStatus).toBe('clean');
        expect(editor.draftRevision).toBe(0);
        expect(editor.unsavedDraft).toBe(false);
        await wait(10_000);
        expect(editor.draftStatus).toBe('clean');
        expect((await repository.loadPlaylist(playlistId)).slides[0]?.name).toBe('Neuer');
    });

    it('lets the next save drop the draft when dropping it after publishing failed', async () => {
        const { editor, repository, playlistId } = await draftSetup();
        editor.updateSlide({ name: 'Neu' });
        await wait(2100);
        const discard = vi.spyOn(repository.drafts, 'discard').mockRejectedValueOnce(new Error('weg'));
        expect(await editor.publish()).toBe(true);
        expect(discard).toHaveBeenCalledTimes(1);
        expect(await repository.drafts.load(playlistId)).not.toBeNull();
        await wait(5100);
        expect(await repository.drafts.load(playlistId)).toBeNull();
        expect(editor.draftStatus).toBe('clean');
    });

    it('reports a draft conflict and keeps my draft with the other revision', async () => {
        const { editor, repository, playlistId } = await draftSetup();
        editor.updateSlide({ name: 'Von Anna' });
        await repository.drafts.save(
            { playlistId, name: 'Fremd', slideIds: editor.playlist!.slideIds.slice(), slides: [] },
            { expectedRevision: 0, updatedBy: 'Ben' },
        );
        await wait(2100);
        expect(editor.draftStatus).toBe('conflict');
        expect(editor.draftConflict).toMatchObject({ revision: 1, updatedBy: 'Ben' });
        await wait(10_000);
        expect(editor.draftStatus).toBe('conflict'); // no more tries
        expect(await editor.keepMyDraft()).toBe(true);
        expect(editor.draftStatus).toBe('saved');
        expect(editor.draftRevision).toBe(2);
        expect(editor.draftConflict).toBeNull();
        expect((await repository.drafts.load(playlistId))?.slides[0]?.name).toBe('Von Anna');
    });

    it('turns the drafts off for good when the right is missing, and publishing still goes', async () => {
        const { editor, repository } = await draftSetup();
        vi.spyOn(repository.drafts, 'save').mockRejectedValue(new DraftsUnavailableError());
        editor.updateSlide({ name: 'Neu' });
        await wait(2100);
        expect(editor.draftsOn).toBe(false);
        expect(editor.draftStatus).toBe('off');
        expect(await editor.publish()).toBe(true);
    });

    it('shows an error and tries again with the next change', async () => {
        const { editor, repository } = await draftSetup();
        const save = vi.spyOn(repository.drafts, 'save').mockRejectedValueOnce(new Error('kaputt'));
        editor.updateSlide({ name: 'Neu' });
        await wait(2100);
        expect(editor.draftStatus).toBe('error');
        expect(editor.draftError).toBe('kaputt');
        editor.updateSlide({ name: 'Neuer' });
        await wait(5100);
        expect(save).toHaveBeenCalledTimes(2);
        expect(editor.draftStatus).toBe('saved');
        expect(editor.draftError).toBeNull();
    });

    it('discards the draft and loads the published state', async () => {
        const { editor, repository, playlistId } = await draftSetup();
        const before = editor.slide!.name;
        editor.updateSlide({ name: 'Neu' });
        await wait(2100);
        await editor.discardAndReload();
        expect(await repository.drafts.load(playlistId)).toBeNull();
        expect(editor.slide!.name).toBe(before);
        expect(editor.dirty).toBe(false);
        expect(editor.draftStatus).toBe('clean');
    });

    it('flushes at once and reports a conflict without a name when the draft is gone', async () => {
        const { editor, repository, playlistId } = await draftSetup();
        editor.updateSlide({ name: 'Neu' });
        await nextTick();
        expect(await editor.flushDraft()).toBe(true);
        expect(editor.draftRevision).toBe(1);
        await repository.drafts.discard(playlistId);
        editor.updateSlide({ name: 'Neuer' });
        await nextTick();
        expect(await editor.flushDraft()).toBe(false);
        expect(editor.draftConflict).toEqual({ revision: 0, updatedBy: '', updatedAt: '' });
    });
});

describe('selecting several blocks (Plan.md 79, D1)', () => {
    /** Three shapes at known places, bottom to top: a (100,100), b (400,100), c (700,400), each 200 × 100. */
    async function three() {
        const { editor } = await setup();
        const ids: string[] = [];
        for (const [x, y] of [[100, 100], [400, 100], [700, 400]] as const) {
            editor.addBlock('shape');
            editor.updateBlock(editor.block!.id, { x, y, width: 200, height: 100 });
            ids.push(editor.block!.id);
        }
        editor.selectBlock(null);
        return { editor, ids: ids as [string, string, string] };
    }

    it('toggles, selects all (locked too) and keeps `block` for exactly one', async () => {
        const { editor, ids } = await three();
        editor.setLocked([ids[2]], true);
        editor.toggleBlock(ids[0]);
        expect(editor.block?.id).toBe(ids[0]);
        editor.toggleBlock(ids[1]);
        expect(editor.block).toBeNull();
        expect(editor.selection.map((b) => b.id)).toEqual([ids[0], ids[1]]);
        expect(editor.isSelected(ids[1])).toBe(true);
        editor.toggleBlock(ids[0]);
        expect(editor.block?.id).toBe(ids[1]);
        editor.selectAll();
        expect(editor.selection).toHaveLength(3);
        editor.selectBlock(ids[2]);
        expect(editor.selectedBlockIds).toEqual([ids[2]]);
        editor.selectBlock(null);
        expect(editor.selection).toEqual([]);
    });

    it('keeps the choice when the mode "Mehrere auswählen" starts, and ends it with a change of slide, which also clears the hint', async () => {
        const { editor, ids } = await three();
        editor.selectBlock(ids[0]);
        editor.startMultiSelect();
        expect(editor.multiSelect).toBe(true);
        expect(editor.selectedBlockIds).toEqual([ids[0]]);
        editor.endMultiSelect();
        expect(editor.multiSelect).toBe(false);
        expect(editor.selectedBlockIds).toEqual([ids[0]]);
        editor.startMultiSelect();
        editor.hoveredBlockId = ids[1];
        editor.selectSlide(editor.slide!.id);
        expect(editor.multiSelect).toBe(false);
        expect(editor.hoveredBlockId).toBeNull();
    });

    it('selects what a rectangle touches, or adds it to the choice', async () => {
        const { editor, ids } = await three();
        editor.selectArea({ x: 250, y: 120, width: 200, height: 20 });
        expect(editor.selectedBlockIds).toEqual([ids[0], ids[1]]);
        editor.selectArea({ x: 750, y: 450, width: 10, height: 10 });
        expect(editor.selectedBlockIds).toEqual([ids[2]]);
        editor.selectArea({ x: 100, y: 100, width: 5, height: 5 }, true);
        expect(editor.selectedBlockIds).toEqual([ids[2], ids[0]]);
        editor.selectArea({ x: 1500, y: 900, width: 50, height: 50 });
        expect(editor.selection).toEqual([]);
    });

    it('takes vanished blocks out of the choice on undo and on delete', async () => {
        const { editor, ids } = await three();
        editor.selectAll();
        editor.removeBlocks([ids[2]]);
        expect(editor.selectedBlockIds).toEqual([ids[0], ids[1]]);
        editor.undo();
        // The block is back, but it is not chosen again.
        expect(editor.slide!.blocks).toHaveLength(3);
        expect(editor.selectedBlockIds).toEqual([ids[0], ids[1]]);
        editor.selectAll();
        editor.undo(); // the third block is gone again: it was added and moved before
        editor.undo();
        expect(editor.slide!.blocks).toHaveLength(2);
        expect(editor.selectedBlockIds).toEqual([ids[0], ids[1]]);
    });

    it('moves the unlocked ones together as one step; the locked stay', async () => {
        const { editor, ids } = await three();
        editor.setLocked([ids[1]], true);
        const steps = () => editor.canUndo;
        editor.moveBlocks(ids, 30, 20);
        const [a, b, c] = editor.slide!.blocks;
        expect([a!.x, a!.y, b!.x, b!.y, c!.x, c!.y]).toEqual([130, 120, 400, 100, 730, 420]);
        expect(steps()).toBe(true);
        editor.undo();
        expect(editor.slide!.blocks[0]!.x).toBe(100);
        expect(editor.slide!.blocks[2]!.x).toBe(700);
    });

    it('aligns and distributes as one step each; a locked block stays and is the target', async () => {
        const { editor, ids } = await three();
        editor.selectAll();
        editor.alignSelection('left');
        expect(editor.slide!.blocks.map((b) => b.x)).toEqual([100, 100, 100]);
        editor.undo();
        expect(editor.slide!.blocks.map((b) => b.x)).toEqual([100, 400, 700]);
        editor.alignSelection('left');
        editor.alignSelection('left');
        editor.undo();
        expect(editor.slide!.blocks.map((b) => b.x)).toEqual([100, 400, 700]);
        editor.setLocked([ids[1]], true);
        editor.alignSelection('top');
        // The locked one (y 100) is the target; the third moves up to it.
        expect(editor.slide!.blocks.map((b) => b.y)).toEqual([100, 100, 100]);
        editor.alignSelection('right');
        expect(editor.slide!.blocks.map((b) => b.x)).toEqual([400, 400, 400]);
        editor.setLocked(ids, true);
        editor.alignSelection('bottom');
        expect(editor.slide!.blocks.map((b) => b.x)).toEqual([400, 400, 400]);
    });

    it('aligns a single block to the stage, and distributes evenly', async () => {
        const { editor, ids } = await three();
        editor.selectBlock(ids[0]);
        editor.alignSelection('right');
        expect(editor.slide!.blocks[0]!.x).toBe(1920 - 200);
        editor.alignSelection('middle');
        expect(editor.slide!.blocks[0]!.y).toBe(490);
        editor.selectAll();
        editor.undo();
        editor.undo();
        editor.distributeSelection('x');
        // 100..900 with 600 of width: gaps of 100.
        expect(editor.slide!.blocks.map((b) => b.x)).toEqual([100, 400, 700]);
        editor.updateBlock(ids[1], { x: 200 });
        editor.distributeSelection('x');
        expect(editor.slide!.blocks[1]!.x).toBe(400);
        editor.undo();
        expect(editor.slide!.blocks[1]!.x).toBe(200);
    });

    it('does not distribute with a locked block in between or with fewer than three', async () => {
        const { editor, ids } = await three();
        editor.updateBlock(ids[1], { x: 200 });
        editor.setLocked([ids[1]], true);
        editor.selectAll();
        editor.distributeSelection('x');
        expect(editor.slide!.blocks[1]!.x).toBe(200);
        editor.selectBlock(ids[0]);
        editor.toggleBlock(ids[2]);
        editor.distributeSelection('x');
        expect(editor.slide!.blocks.map((b) => b.x)).toEqual([100, 200, 700]);
    });

    it('clamps the box of the moved ones, so the group keeps its shape at the edge', async () => {
        const { editor, ids } = await three();
        editor.moveBlocks([ids[0], ids[2]], 5000, 0);
        const [a, , c] = editor.slide!.blocks;
        // The box (100..900) may go as far as 20 px inside the stage (1920): both moved by the same amount.
        expect(c!.x - a!.x).toBe(600);
        expect(a!.x).toBe(1920 - 20);
        editor.moveBlocks(ids, 0, 0);
        expect(editor.slide!.blocks[0]!.x).toBe(1900);
    });

    it('deletes, locks and layers several as one step each; the locked are left out of delete and layer', async () => {
        const { editor, ids } = await three();
        editor.setLocked([ids[0]], true);
        editor.selectAll();
        editor.layerBlocks(ids, 'back');
        // `a` is locked and stays; the others go behind it, keeping their order.
        expect(editor.slide!.blocks.map((b) => b.id)).toEqual([ids[1], ids[2], ids[0]]);
        editor.undo();
        editor.removeBlocks(ids);
        expect(editor.slide!.blocks.map((b) => b.id)).toEqual([ids[0]]);
        expect(editor.selectedBlockIds).toEqual([ids[0]]);
        editor.undo();
        expect(editor.slide!.blocks).toHaveLength(3);
        editor.setLocked(ids, false);
        expect(editor.slide!.blocks.some((b) => b.locked)).toBe(false);
        editor.undo();
        expect(editor.slide!.blocks[0]!.locked).toBe(true);
        editor.setLocked(ids, true);
        expect(editor.slide!.blocks.every((b) => b.locked)).toBe(true);
    });

    it('copies with the locked, cuts without them, duplicates as loose copies', async () => {
        const { editor, ids } = await three();
        editor.setLocked([ids[0]], true);
        editor.copyBlocks(ids);
        expect(editor.clipboard.map((b) => b.id)).toEqual(ids);
        editor.cutBlocks(ids);
        expect(editor.slide!.blocks.map((b) => b.id)).toEqual([ids[0]]);
        expect(editor.clipboard.map((b) => b.id)).toEqual([ids[1], ids[2]]);
        editor.undo();
        editor.duplicateBlocks(ids);
        expect(editor.slide!.blocks).toHaveLength(6);
        expect(editor.slide!.blocks.slice(3).some((b) => b.locked)).toBe(false);
        expect(editor.selection).toHaveLength(3);
        editor.undo();
        expect(editor.slide!.blocks).toHaveLength(3);
    });

    it('pastes a group as a whole: same places to each other, all chosen, one step', async () => {
        const { editor, ids } = await three();
        editor.copyBlocks(ids);
        editor.pasteBlocks();
        const pasted = editor.slide!.blocks.slice(3);
        expect(pasted).toHaveLength(3);
        expect(editor.selection.map((b) => b.id)).toEqual(pasted.map((b) => b.id));
        // The box (100..900, 100..500) was taken: the group steps on by 40 – all of it, not block by block.
        expect(pasted.map((b) => [b.x - 40, b.y - 40])).toEqual([[100, 100], [400, 100], [700, 400]]);
        editor.undo();
        expect(editor.slide!.blocks).toHaveLength(3);
    });

    it('pastes a group at a point with its middle there', async () => {
        const { editor, ids } = await three();
        editor.copyBlocks(ids);
        editor.pasteBlocks({ x: 960, y: 540 });
        const pasted = editor.slide!.blocks.slice(3);
        // The box is 800 × 400: its middle (960, 540) means a top left of (560, 340).
        expect([pasted[0]!.x, pasted[0]!.y]).toEqual([560, 340]);
        expect([pasted[2]!.x, pasted[2]!.y]).toEqual([1160, 640]);
    });

    it('shrinks a group too big for the stage as a whole', async () => {
        const { editor, ids } = await three();
        editor.copyBlocks(ids);
        // A narrower stage: the box (800 wide) no longer fits into 600.
        editor.draft!.playlist.stage = { width: 600, height: 1080 };
        editor.pasteBlocks();
        const [a, , c] = editor.selection;
        expect([a!.width, a!.height]).toEqual([150, 75]);
        expect([a!.x, c!.x]).toEqual([0, 450]);
        expect(c!.x + c!.width).toBe(600);
        expect(c!.y - a!.y).toBe(225);
    });
});

describe('grouping blocks (Plan.md 79, D9)', () => {
    /** Four shapes, bottom to top: a, b, c, d at known places, 200 × 100 each. */
    async function four() {
        const { editor } = await setup();
        const ids: string[] = [];
        for (const [x, y] of [[100, 100], [400, 100], [700, 400], [1000, 400]] as const) {
            editor.addBlock('shape');
            editor.updateBlock(editor.block!.id, { x, y, width: 200, height: 100 });
            ids.push(editor.block!.id);
        }
        editor.selectBlock(null);
        return { editor, ids: ids as [string, string, string, string] };
    }
    const groupIdOf = (editor: Awaited<ReturnType<typeof four>>['editor'], id: string) => editor.slide!.blocks.find((b) => b.id === id)?.groupId;

    it('groups two or more as one step, closes the layers up and keeps the choice', async () => {
        const { editor, ids } = await four();
        editor.selectBlock(ids[0]);
        editor.toggleBlock(ids[2]);
        expect(editor.canGroup).toBe(true);
        const steps = editor.slide!.blocks.length;
        editor.groupBlocks(editor.selectedBlockIds);
        expect(groupIdOf(editor, ids[0])).toBeTruthy();
        expect(groupIdOf(editor, ids[0])).toBe(groupIdOf(editor, ids[2]));
        expect(groupIdOf(editor, ids[1])).toBeUndefined();
        expect(editor.slide!.blocks.map((b) => b.id)).toEqual([ids[1], ids[0], ids[2], ids[3]]);
        expect(editor.selectedBlockIds).toEqual([ids[0], ids[2]]);
        expect(editor.groupSelected).toBe(true);
        expect(editor.canGroup).toBe(false);
        expect(editor.canUngroup).toBe(true);
        editor.undo();
        expect(groupIdOf(editor, ids[0])).toBeUndefined();
        expect(editor.slide!.blocks.map((b) => b.id)).toEqual(ids);
        expect(editor.slide!.blocks).toHaveLength(steps);
    });

    it('does nothing for one block, and merges groups without nesting', async () => {
        const { editor, ids } = await four();
        editor.groupBlocks([ids[0]]);
        expect(groupIdOf(editor, ids[0])).toBeUndefined();
        editor.groupBlocks([ids[0], ids[1]]);
        editor.groupBlocks([ids[2], ids[3]]);
        const first = groupIdOf(editor, ids[0]);
        expect(first).not.toBe(groupIdOf(editor, ids[2]));
        editor.groupBlocks([ids[1], ids[2]]);
        expect(new Set(ids.map((id) => groupIdOf(editor, id))).size).toBe(1);
        expect(groupIdOf(editor, ids[0])).not.toBe(first);
    });

    it('locks the whole group if one member is locked', async () => {
        const { editor, ids } = await four();
        editor.setLocked([ids[1]], true);
        editor.groupBlocks([ids[0], ids[1]]);
        expect(editor.slide!.blocks.filter((b) => b.locked).map((b) => b.id).sort()).toEqual([ids[0], ids[1]].sort());
    });

    it('ungroups every member of the touched groups', async () => {
        const { editor, ids } = await four();
        editor.groupBlocks([ids[0], ids[1], ids[2]]);
        editor.ungroupBlocks([ids[1]]);
        expect(ids.map((id) => groupIdOf(editor, id))).toEqual([undefined, undefined, undefined, undefined]);
        expect(editor.canUngroup).toBe(false);
    });

    it('chooses the whole group on pickBlock and toggles it as one; a single member can be chosen alone', async () => {
        const { editor, ids } = await four();
        editor.groupBlocks([ids[0], ids[1]]);
        editor.pickBlock(ids[0]);
        expect(editor.selectedBlockIds).toEqual([ids[0], ids[1]]);
        editor.pickBlock(ids[3]);
        expect(editor.selectedBlockIds).toEqual([ids[3]]);
        editor.toggleGroup(ids[1]);
        expect(editor.selectedBlockIds).toEqual([ids[3], ids[0], ids[1]]);
        editor.toggleGroup(ids[0]);
        expect(editor.selectedBlockIds).toEqual([ids[3]]);
        editor.selectBlock(ids[0]);
        expect(editor.selectedBlockIds).toEqual([ids[0]]);
        expect(editor.groupSelected).toBe(false);
    });

    it('takes whole groups into a selection rectangle', async () => {
        const { editor, ids } = await four();
        editor.groupBlocks([ids[0], ids[3]]);
        editor.selectArea({ x: 110, y: 110, width: 5, height: 5 });
        expect(editor.selectedBlockIds).toEqual([ids[0], ids[3]]);
    });

    it('gives a copied group a new id, and a lone copied member none', async () => {
        const { editor, ids } = await four();
        editor.groupBlocks([ids[0], ids[1]]);
        editor.duplicateBlocks([ids[0], ids[1]]);
        const copies = editor.selectedBlockIds;
        expect(copies).toHaveLength(2);
        const copyGroup = groupIdOf(editor, copies[0]!);
        expect(copyGroup).toBeTruthy();
        expect(copyGroup).toBe(groupIdOf(editor, copies[1]!));
        expect(copyGroup).not.toBe(groupIdOf(editor, ids[0]));
        editor.copyBlocks([ids[0]]);
        editor.pasteBlocks();
        expect(groupIdOf(editor, editor.selectedBlockIds[0]!)).toBeUndefined();
        expect(groupIdOf(editor, ids[0])).toBeTruthy();
    });

    it('leaves no group of one when a member is deleted', async () => {
        const { editor, ids } = await four();
        editor.groupBlocks([ids[0], ids[1], ids[2]]);
        editor.removeBlocks([ids[0]]);
        expect(groupIdOf(editor, ids[1])).toBe(groupIdOf(editor, ids[2]));
        expect(groupIdOf(editor, ids[1])).toBeTruthy();
        editor.removeBlocks([ids[1]]);
        expect(groupIdOf(editor, ids[2])).toBeUndefined();
    });

    it('locks and moves in layers as a whole group, even with one member given', async () => {
        const { editor, ids } = await four();
        editor.groupBlocks([ids[0], ids[1]]);
        editor.setLocked([ids[0]], true);
        expect(editor.slide!.blocks.filter((b) => b.locked).map((b) => b.id)).toEqual([ids[0], ids[1]]);
        editor.setLocked([ids[1]], false);
        expect(editor.slide!.blocks.some((b) => b.locked)).toBe(false);
        editor.layerBlocks([ids[0]], 'front');
        expect(editor.slide!.blocks.map((b) => b.id)).toEqual([ids[2], ids[3], ids[0], ids[1]]);
    });
});

