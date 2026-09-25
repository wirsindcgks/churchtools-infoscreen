import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryKv } from '../store/memory-kv';
import { ScreenRepository } from '../store/screen-repository';
import { useEditorStore } from './editor-store';
import { createScreenBundle } from './ops';

async function setup() {
    const repository = new ScreenRepository(new MemoryKv());
    await repository.saveScreen(createScreenBundle({ name: 'Foyer', slug: 'foyer', orientation: 'landscape' }), {
        expectedRevision: null,
        updatedBy: 'Anna',
    });
    setActivePinia(createPinia());
    const editor = useEditorStore();
    editor.attach(repository);
    await editor.open('foyer');
    return { editor, repository };
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

    it('saves and reloads the same state', async () => {
        const { editor, repository } = await setup();
        editor.addBlock('clock');
        expect(await editor.save('Anna')).toBe(true);
        expect(editor.dirty).toBe(false);
        expect(editor.revision).toBe(1); // the first schedule document (schema 1.2)
        const loaded = await repository.loadScreen('foyer');
        expect(loaded.slides[0]?.blocks[0]?.type).toBe('clock');
    });

    it('stops at a conflict and lets the user decide', async () => {
        const { editor, repository } = await setup();
        // Another designer saves in between.
        const other = await repository.loadScreen('foyer');
        await repository.saveContent(other, { expectedRevision: null, updatedBy: 'Ben' });

        editor.addBlock('text');
        expect(await editor.save('Anna')).toBe(false);
        expect(editor.status).toBe('conflict');
        expect(editor.conflict?.updatedBy).toBe('Ben');
        expect(editor.dirty).toBe(true);

        expect(await editor.overwrite('Anna')).toBe(true);
        expect((await repository.loadScreen('foyer')).screen.updatedBy).toBe('Anna');
    });

    it('can drop its own changes after a conflict', async () => {
        const { editor, repository } = await setup();
        const other = await repository.loadScreen('foyer');
        await repository.saveContent(other, { expectedRevision: null, updatedBy: 'Ben' });
        editor.addBlock('text');
        await editor.save('Anna');
        await editor.discardAndReload();
        expect(editor.slide?.blocks).toHaveLength(0);
        expect(editor.revision).toBe(1);
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

describe('editor store playlists and schedule (Plan.md, Nächste Schritte 17)', () => {
    beforeEach(() => setActivePinia(createPinia()));

    it('adds a playlist with one slide and edits its slides separately', async () => {
        const { editor } = await setup();
        const defaultId = editor.playlist!.id;
        const id = editor.addPlaylist('Gottesdienst');
        expect(editor.playlist?.id).toBe(id);
        expect(editor.slides).toHaveLength(1);
        editor.addSlide();
        expect(editor.slides).toHaveLength(2);
        editor.selectPlaylist(defaultId);
        expect(editor.slides.map((s) => s.name)).toEqual(['Willkommen']);
    });

    it('links a slide into a second playlist and keeps it while another playlist shows it', async () => {
        const { editor } = await setup();
        const welcome = editor.slide!.id;
        editor.addPlaylist('Abend');
        expect(editor.otherSlides.map((s) => s.id)).toEqual([welcome]);
        editor.linkSlide(welcome);
        expect(editor.alsoIn(welcome)).toEqual(['Standard']);
        editor.removeSlide(welcome);
        expect(editor.draft!.slides.some((s) => s.id === welcome)).toBe(true); // still in "Standard"
    });

    it('removes a playlist with its rules and the slides only it showed, but never the default', async () => {
        const { editor } = await setup();
        const defaultId = editor.playlist!.id;
        const id = editor.addPlaylist('Abend');
        const onlyThere = editor.slide!.id;
        editor.addRule({ kind: 'time', playlistId: id, weekdays: [5], from: '18:00', to: '22:00' });
        editor.removePlaylist(defaultId);
        expect(editor.playlists).toHaveLength(2);
        editor.removePlaylist(id);
        expect(editor.playlists.map((p) => p.id)).toEqual([defaultId]);
        expect(editor.rules).toHaveLength(0);
        expect(editor.draft!.slides.some((s) => s.id === onlyThere)).toBe(false);
        expect(editor.playlist?.id).toBe(defaultId);
    });

    it('orders rules, refuses to save an impossible one and stores a valid schedule', async () => {
        const { editor, repository } = await setup();
        const id = editor.addPlaylist('Gottesdienst');
        editor.addRule({ kind: 'time', playlistId: id, weekdays: [7], from: '12:00', to: '09:00' });
        editor.addRule({ kind: 'time', playlistId: id, weekdays: [1], from: '08:00', to: '10:00' });
        editor.moveRule(1, 0);
        expect(editor.rules.map((r) => (r.kind === 'time' ? r.weekdays[0] : 0))).toEqual([1, 7]);
        expect(await editor.save('Anna')).toBe(false);
        expect(editor.error).toMatch(/Regel 2/);
        editor.updateRule(1, { from: '09:00', to: '12:00' });
        expect(await editor.save('Anna')).toBe(true);
        const loaded = await repository.loadScreen('foyer');
        expect(loaded.screen.schedule).toHaveLength(2);
        expect(loaded.playlists.map((p) => p.name)).toEqual(['Standard', 'Gottesdienst']);
    });

    it('undoes a new playlist in one step', async () => {
        const { editor } = await setup();
        editor.addPlaylist('Abend');
        editor.undo();
        expect(editor.playlists).toHaveLength(1);
        expect(editor.slides.map((s) => s.name)).toEqual(['Willkommen']);
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
