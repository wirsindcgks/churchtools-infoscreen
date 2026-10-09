import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
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
    editor.attach(repository);
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
        expect(await editor.save('Anna')).toBe(true);
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
        expect(await editor.save('Anna')).toBe(false);
        expect(editor.error).toMatch(/Namen/);
        editor.renamePlaylist('Gottesdienst');
        expect(await editor.save('Anna')).toBe(true);
        expect((await repository.loadPlaylist(playlistId)).playlist.name).toBe('Gottesdienst');
    });

    it('stops at a conflict and lets the user decide', async () => {
        const { editor, repository, playlistId } = await setup();
        // Another designer saves in between.
        const other = await repository.loadPlaylist(playlistId);
        await repository.savePlaylist(other, { expectedRevision: 1, updatedBy: 'Ben' });

        editor.addBlock('text');
        expect(await editor.save('Anna')).toBe(false);
        expect(editor.status).toBe('conflict');
        expect(editor.conflict?.updatedBy).toBe('Ben');
        expect(editor.dirty).toBe(true);

        expect(await editor.overwrite('Anna')).toBe(true);
        expect((await repository.loadPlaylist(playlistId)).playlist.updatedBy).toBe('Anna');
    });

    it('keeps all of its own slides with "Meine behalten", not only the changed ones (Plan.md 49)', async () => {
        const { editor, repository, playlistId } = await setup();
        // Ben renames the one slide; Anna only renames the playlist.
        const other = await repository.loadPlaylist(playlistId);
        other.slides[0]!.name = 'Bens Name';
        await repository.savePlaylist(other, { expectedRevision: 1, updatedBy: 'Ben' });

        editor.renamePlaylist('Annas Playlist');
        expect(await editor.save('Anna')).toBe(false);
        expect(await editor.overwrite('Anna')).toBe(true);
        const stored = await repository.loadPlaylist(playlistId);
        expect(stored.playlist.name).toBe('Annas Playlist');
        expect(stored.slides[0]?.name).toBe('Willkommen');
    });

    it('can drop its own changes after a conflict', async () => {
        const { editor, repository, playlistId } = await setup();
        const other = await repository.loadPlaylist(playlistId);
        await repository.savePlaylist(other, { expectedRevision: 1, updatedBy: 'Ben' });
        editor.addBlock('text');
        await editor.save('Anna');
        await editor.discardAndReload();
        expect(editor.slide?.blocks).toHaveLength(0);
        expect(editor.revision).toBe(2);
    });

    it('saves content without touching the screen document, which belongs to the administrators (Plan.md, F)', async () => {
        const { editor, repository } = await setup();
        const before = (await repository.listScreens())[0]!;
        editor.addBlock('clock');
        expect(await editor.save('Anna')).toBe(true);
        // An administrator renames the screen meanwhile – against the screen's own revision, no conflict with content.
        await repository.saveScreenSettings(before.id, { name: 'Foyer links' }, { expectedRevision: before.revision, updatedBy: 'Admin' });
        editor.addBlock('text');
        expect(await editor.save('Anna')).toBe(true);
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
        editor.setLocked(id, true);
        editor.updateBlock(id, { x: x + 100 });
        editor.layerBlock(id, 'front');
        editor.removeBlock(id);
        expect(editor.slide!.blocks[0]).toMatchObject({ id, x, locked: true });
        editor.setLocked(id, false);
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
        editor.layerBlock(shape, 'front');
        expect(editor.slide?.blocks.at(-1)?.id).toBe(shape);
        editor.removeBlock(shape);
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
        await editor.save('Anna');
        kv.writes.length = 0;
        editor.updateSlide({ name: 'Zweite' });
        expect(await editor.save('Anna')).toBe(true);
        expect(kv.writes).toHaveLength(2); // the changed slide and the playlist
    });

    it('names the linked slides a save wrote, and forgets them with the next change', async () => {
        const { editor, b } = await linkedSetup();
        editor.addSlide();
        expect(await editor.save('Anna')).toBe(true);
        expect(editor.linkedSaved).toEqual([]); // only an own slide was new
        editor.selectSlide(editor.slides[0]!.id);
        editor.updateSlide({ name: 'Begrüßung' });
        expect(await editor.save('Anna')).toBe(true);
        expect(editor.linkedSaved).toEqual([{ name: 'Begrüßung', playlists: [b.name] }]);
        editor.updateSlide({ name: 'Hallo' });
        expect(editor.linkedSaved).toEqual([]);
    });

    it('saves a linked slide twice in a row without a false conflict', async () => {
        const { editor, repository, playlistId, b } = await linkedSetup();
        expect(editor.linkedIn(editor.slide!.id).map((p) => p.id)).toEqual([b.id]);
        editor.updateSlide({ name: 'Eins' });
        expect(await editor.save('Anna')).toBe(true);
        editor.updateSlide({ name: 'Zwei' });
        expect(await editor.save('Anna')).toBe(true);
        expect(editor.status).toBe('saved');
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
        expect(await editor.save('Anna')).toBe(false);
        expect(editor.status).toBe('conflict');
        expect(editor.conflict).toBeNull();
        expect(editor.slideConflict).toMatchObject({ slide: { name: 'Von Ben' }, updatedBy: 'Ben' });

        const oldId = editor.slide!.id;
        expect(await editor.keepAsCopy('Anna')).toBe(true);
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
        expect(await editor.save('Anna')).toBe(true);
        expect(kv.writes).toHaveLength(1); // only the playlist
        editor.selectSlide(source[0]!.id);
        editor.updateSlide({ name: 'Geändert' });
        kv.writes.length = 0;
        await editor.save('Anna');
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
            editor.copyBlock(original.id);
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
            editor.copyBlock(original.id);
            editor.pasteBlocks();
            expect(editor.slide?.blocks).toHaveLength(2);
            expect([editor.block!.x, editor.block!.y]).toEqual([original.x + 40, original.y + 40]);
            expect(editor.block!.id).not.toBe(original.id);
        });

        it('makes a locked block loose again in the copy', async () => {
            const { editor } = await setup();
            editor.addBlock('shape');
            const id = editor.block!.id;
            editor.setLocked(id, true);
            editor.duplicateBlock(id);
            expect(editor.slide?.blocks[0]?.locked).toBe(true);
            expect(editor.block?.locked).toBeUndefined();
            expect(editor.block?.id).not.toBe(id);
        });

        it('duplicates in one step and leaves the clipboard alone', async () => {
            const { editor } = await setup();
            editor.addBlock('text');
            editor.addBlock('shape');
            editor.copyBlock(editor.slide!.blocks[0]!.id);
            const copied = editor.clipboard[0]!.id;
            editor.duplicateBlock(editor.slide!.blocks[1]!.id);
            expect(editor.slide?.blocks).toHaveLength(3);
            expect(editor.clipboard[0]?.id).toBe(copied);
            editor.undo();
            expect(editor.slide?.blocks).toHaveLength(2);
        });

        it('pastes as one step in the history', async () => {
            const { editor } = await setup();
            editor.addBlock('text');
            editor.copyBlock(editor.block!.id);
            editor.pasteBlocks();
            expect(editor.slide?.blocks).toHaveLength(2);
            editor.undo();
            expect(editor.slide?.blocks).toHaveLength(1);
        });

        it('cuts: copy and delete as one step; a locked block stays', async () => {
            const { editor } = await setup();
            editor.addBlock('text');
            const id = editor.block!.id;
            editor.setLocked(id, true);
            editor.cutBlock(id);
            expect(editor.slide?.blocks).toHaveLength(1);
            expect(editor.clipboard).toHaveLength(0);
            editor.setLocked(id, false);
            editor.cutBlock(id);
            expect(editor.slide?.blocks).toHaveLength(0);
            expect(editor.clipboard).toHaveLength(1);
            editor.undo();
            expect(editor.slide?.blocks).toHaveLength(1);
        });

        it('shrinks a block pasted from landscape onto a portrait stage', async () => {
            const { editor, repository } = await setup();
            editor.addBlock('appointment-list');
            editor.copyBlock(editor.block!.id);
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
            editor.copyBlock(editor.block!.id);
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
});
