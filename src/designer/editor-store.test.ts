import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryKv } from '../store/memory-kv';
import { ScreenRepository } from '../store/screen-repository';
import { useEditorStore } from './editor-store';
import { createScreenBundle } from './ops';

async function setup() {
    const repository = new ScreenRepository(new MemoryKv());
    const bundle = createScreenBundle({ name: 'Foyer', slug: 'foyer', orientation: 'landscape' });
    await repository.saveScreen(bundle, { expectedRevision: null, updatedBy: 'Anna' });
    setActivePinia(createPinia());
    const editor = useEditorStore();
    editor.attach(repository);
    const playlistId = bundle.screen.defaultPlaylistId;
    await editor.open(playlistId);
    return { editor, repository, playlistId };
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
