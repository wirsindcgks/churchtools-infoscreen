/**
 * The playlist being edited (schema 1.4: the editor hangs on the playlist,
 * not on a screen – Plan.md, Nächste Schritte 19): a draft of the playlist
 * with its slides, its history, the selection and the save state. Every
 * change goes through `change()`, which records a snapshot first; a drag
 * records once at its start (`beginGesture`).
 */
import { defineStore } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';
import { blockCalendarIds, DEFAULT_THEME, type Block, type BlockType, type MediaDoc, type PlaylistBundle, type SlideDoc, type ThemeDoc } from '../model/schema';
import {
    ConflictError,
    copySlide,
    SlideConflictError,
    type ConflictInfo,
    type LoadedPlaylist,
    type ScreenRef,
    type ScreenRepository,
    type SlideConflictInfo,
} from '../store/screen-repository';
import { t } from '../i18n/designer';
import { tr } from '../i18n/repository';
import { History } from './history';
import { GRID_SIZES } from './snap';
import { clampFrame, cloneJson, createBlock, createSlide, duplicateSlide, fitToStage, freeSpot, move, moveAround, newId, reorder, type Layer } from './ops';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export const useEditorStore = defineStore('editor', () => {
    const repository = shallowRef<ScreenRepository | null>(null);
    const draft = ref<PlaylistBundle | null>(null);
    const savedJson = ref('');
    /** Revision of the playlist the draft started from – what the save is checked against. */
    const revision = ref(0);
    /** Screens that show this playlist; saving changes all of them. */
    const screens = ref<ScreenRef[]>([]);
    const selectedSlideId = ref<string | null>(null);
    const selectedBlockId = ref<string | null>(null);
    const status = ref<SaveStatus>('idle');
    const conflict = ref<ConflictInfo | null>(null);
    /** A slide another playlist saved in between (Plan.md 49); set instead of `conflict`. */
    const slideConflict = ref<SlideConflictInfo | null>(null);
    /**
     * By slide id: the other playlists that show the slide too. Entries are never
     * removed – undoing "Verknüpfung lösen" brings the old id back, and it is linked again.
     */
    const sharedWith = ref<LoadedPlaylist['sharedWith']>({});
    /** Linked slides the last save wrote, with where else they run – the editor tells the designer (Plan.md 49). */
    const linkedSaved = ref<{ name: string; playlists: string[] }[]>([]);
    /** Each slide as last loaded or saved, as JSON – what `save()` compares to write only changed slides. */
    let baseline = new Map<string, string>();
    const error = ref<string | null>(null);
    /** Grid size in stage pixels, 0 = off. A preference of this browser, not part of the playlist. */
    const gridSize = ref<number>(loadGridSize());
    /** Media documents known to the store, for the preview and the pickers. */
    const media = ref<MediaDoc[]>([]);
    /** The look of all screens (Plan.md, 27): new slides and blocks start in its colours, the preview shows it. */
    const theme = ref<ThemeDoc>(DEFAULT_THEME);
    /**
     * Copied blocks (Plan.md 79, A5): of this session only, not in `localStorage` and not the system clipboard.
     * `reset()` leaves it alone, so it survives a change of slide and of playlist.
     */
    const clipboard = ref<Block[]>([]);
    /** The "+ Baustein" sheet is open – the button above the stage and the one on an empty slide both open it (A7). */
    const blockSheetOpen = ref(false);
    const history = new History<PlaylistBundle>();
    const historyVersion = ref(0); // makes canUndo/canRedo reactive
    let gestureOpen = false;
    let gestureRecorded = false;

    const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== savedJson.value);
    const canUndo = computed(() => historyVersion.value >= 0 && history.canUndo);
    const canRedo = computed(() => historyVersion.value >= 0 && history.canRedo);
    const stage = computed(() => draft.value?.playlist.stage ?? { width: 1920, height: 1080 });
    const playlist = computed(() => draft.value?.playlist ?? null);
    /** Slides in playlist order. */
    const slides = computed<SlideDoc[]>(() => {
        const byId = new Map(draft.value?.slides.map((s) => [s.id, s]));
        return (playlist.value?.slideIds ?? []).map((id) => byId.get(id)).filter((s): s is SlideDoc => !!s);
    });
    const slide = computed(() => slides.value.find((s) => s.id === selectedSlideId.value) ?? slides.value[0] ?? null);
    const block = computed(() => slide.value?.blocks.find((b) => b.id === selectedBlockId.value) ?? null);
    /** The text block being written on the stage (Plan.md 79, C4): one editing run is one step in the history. */
    const editingTextId = ref<string | null>(null);
    const calendarIds = computed(() => [
        ...new Set(draft.value?.slides.flatMap((s) => s.blocks.flatMap(blockCalendarIds)) ?? []),
    ]);

    function attach(repo: ScreenRepository): void {
        repository.value = repo;
    }

    function setGridSize(size: number): void {
        gridSize.value = size;
        try {
            localStorage.setItem(GRID_KEY, String(size));
        } catch {
            // Private windows may refuse storage; the choice then lasts for this page only.
        }
    }

    async function refreshMedia(): Promise<void> {
        if (repository.value) media.value = await repository.value.listMedia();
    }

    function markSaved(): void {
        savedJson.value = JSON.stringify(draft.value);
        baseline = new Map((draft.value?.slides ?? []).map((s) => [s.id, JSON.stringify(s)]));
    }

    function reset(
        bundle: PlaylistBundle,
        playlistRevision = bundle.playlist.revision ?? 0,
        shared: LoadedPlaylist['sharedWith'] = {},
    ): void {
        draft.value = cloneJson(bundle);
        markSaved();
        sharedWith.value = cloneJson(shared);
        revision.value = playlistRevision;
        endTextEdit();
        history.clear();
        historyVersion.value++;
        status.value = 'idle';
        conflict.value = null;
        slideConflict.value = null;
        linkedSaved.value = [];
        error.value = null;
        if (!slides.value.some((s) => s.id === selectedSlideId.value)) {
            selectedSlideId.value = slides.value[0]?.id ?? null;
            selectedBlockId.value = null;
        }
    }

    async function open(playlistId: string): Promise<void> {
        if (!repository.value) throw new Error(t.defaults.noStorage);
        const [loaded, stored] = await Promise.all([
            repository.value.loadPlaylist(playlistId),
            // A theme that cannot be read leaves the defaults; it must not keep the playlist closed.
            repository.value.loadTheme().catch(() => null),
        ]);
        theme.value = stored ?? DEFAULT_THEME;
        screens.value = loaded.screens;
        reset({ playlist: loaded.playlist, slides: loaded.slides }, loaded.playlist.revision, loaded.sharedWith);
    }

    /**
     * Applies a change and records the state before it. Inside a gesture – a
     * drag, or typing in one field – only the first change records, so the
     * whole gesture is one undo step.
     */
    function change(mutate: (bundle: PlaylistBundle) => void): void {
        if (!draft.value) return;
        if (!gestureOpen || !gestureRecorded) {
            history.record(draft.value);
            historyVersion.value++;
            gestureRecorded = gestureOpen;
        }
        mutate(draft.value);
        linkedSaved.value = [];
        if (status.value === 'saved') status.value = 'idle';
    }

    function beginGesture(): void {
        gestureOpen = true;
    }

    function endGesture(): void {
        gestureOpen = false;
        gestureRecorded = false;
    }

    function startTextEdit(id: string): void {
        const target = slide.value?.blocks.find((b) => b.id === id);
        if (!target || target.type !== 'text' || target.locked) return;
        if (editingTextId.value) endTextEdit();
        selectedBlockId.value = id;
        editingTextId.value = id;
        beginGesture();
    }

    function endTextEdit(): void {
        if (!editingTextId.value) return;
        editingTextId.value = null;
        endGesture();
    }

    // Another choice, another slide, a deleted or locked block: the writing ends.
    watch(
        () => editingTextId.value && block.value?.id === editingTextId.value && !block.value.locked,
        (valid) => {
            if (!valid) endTextEdit();
        },
        { flush: 'sync' },
    );

    function undo(): void {
        if (!draft.value) return;
        // The writing on the stage is one step: it ends first, and the undo takes all of it back.
        endTextEdit();
        const previous = history.undo(draft.value);
        if (previous) draft.value = previous;
        historyVersion.value++;
    }

    function redo(): void {
        if (!draft.value) return;
        endTextEdit();
        const next = history.redo(draft.value);
        if (next) draft.value = next;
        historyVersion.value++;
    }

    function slideIn(bundle: PlaylistBundle, id: string | undefined): SlideDoc | undefined {
        return bundle.slides.find((s) => s.id === id);
    }

    function selectSlide(id: string): void {
        selectedSlideId.value = id;
        selectedBlockId.value = null;
    }

    function selectBlock(id: string | null): void {
        selectedBlockId.value = id;
    }

    function renamePlaylist(name: string): void {
        change((b) => (b.playlist.name = name));
    }

    function addSlide(): void {
        const created = createSlide(tr.newSlide, theme.value);
        change((b) => {
            b.slides.push(created);
            const at = b.playlist.slideIds.indexOf(slide.value?.id ?? '') + 1;
            b.playlist.slideIds.splice(at > 0 ? at : b.playlist.slideIds.length, 0, created.id);
        });
        selectSlide(created.id);
    }

    function duplicateCurrentSlide(): void {
        if (!slide.value) return;
        const copy = duplicateSlide(slide.value);
        const originalId = slide.value.id;
        change((b) => {
            b.slides.push(copy);
            b.playlist.slideIds.splice(b.playlist.slideIds.indexOf(originalId) + 1, 0, copy.id);
        });
        selectSlide(copy.id);
    }

    /** Slide ids of the playlist as last loaded or saved. */
    const savedSlideIds = computed(() => new Set<string>(savedJson.value ? JSON.parse(savedJson.value).playlist.slideIds : []));

    /** A slide taken over linked but not saved yet: the other playlists learn of the link only with the save. */
    function linkPending(slideId: string): boolean {
        return linkedIn(slideId).length > 0 && !savedSlideIds.value.has(slideId);
    }

    /** The other playlists that show this slide too – empty for a slide of this playlist alone. */
    function linkedIn(slideId: string): { id: string; name: string }[] {
        return sharedWith.value[slideId] ?? [];
    }

    /**
     * Slides from another playlist, after the current one. By default copies,
     * so that editing them here never changes the other playlist. With `linked`
     * (Plan.md 49) the very same slides: they keep their id, one already here
     * is skipped, and they count as unchanged until edited here.
     */
    function insertSlides(
        sources: SlideDoc[],
        options: { linked?: boolean; from?: { id: string; name: string }; sharedWith?: LoadedPlaylist['sharedWith'] } = {},
    ): void {
        const here = new Set(draft.value?.slides.map((s) => s.id));
        const taken = options.linked ? sources.filter((s) => !here.has(s.id)).map((s) => cloneJson(s)) : sources.map((s) => copySlide(s));
        if (!taken.length) return;
        if (options.linked) {
            const own = draft.value?.playlist.id;
            for (const slide of taken) {
                const others = [...(options.from ? [options.from] : []), ...(options.sharedWith?.[slide.id] ?? [])];
                const merged = new Map([...linkedIn(slide.id), ...others].filter((p) => p.id !== own).map((p) => [p.id, p]));
                sharedWith.value = { ...sharedWith.value, [slide.id]: [...merged.values()] };
                baseline.set(slide.id, JSON.stringify(slide));
            }
        }
        change((b) => {
            b.slides.push(...taken);
            const at = b.playlist.slideIds.indexOf(slide.value?.id ?? '') + 1;
            b.playlist.slideIds.splice(at > 0 ? at : b.playlist.slideIds.length, 0, ...taken.map((c) => c.id));
        });
        selectSlide(taken[0]!.id);
    }

    /** Turns a linked slide into an own copy for this playlist alone – a new id, so the other playlists keep the old one. */
    function unlinkSlide(id: string): void {
        const original = slides.value.find((s) => s.id === id);
        if (!original) return;
        const copy = copySlide(original, original.updatedAt);
        change((b) => {
            b.playlist.slideIds = b.playlist.slideIds.map((s) => (s === id ? copy.id : s));
            b.slides = b.slides.filter((s) => s.id !== id);
            b.slides.push(copy);
        });
        selectSlide(copy.id);
    }

    function removeSlide(id: string): void {
        const index = slides.value.findIndex((s) => s.id === id);
        change((b) => {
            b.playlist.slideIds = b.playlist.slideIds.filter((s) => s !== id);
            b.slides = b.slides.filter((s) => s.id !== id);
        });
        const next = slides.value[Math.min(index, slides.value.length - 1)];
        selectedSlideId.value = next?.id ?? null;
        selectedBlockId.value = null;
    }

    function moveSlide(from: number, to: number): void {
        if (from === to) return;
        change((b) => (b.playlist.slideIds = move(b.playlist.slideIds, from, to)));
    }

    function updateSlide(patch: Partial<Omit<SlideDoc, 'id' | 'kind' | 'schema' | 'blocks'>>): void {
        const id = slide.value?.id;
        change((b) => Object.assign(slideIn(b, id) ?? {}, patch));
    }

    function addBlock(type: BlockType): void {
        if (!slide.value) return;
        const created = freeSpot(createBlock(type, stage.value, calendarIds.value, theme.value), slide.value.blocks, stage.value);
        const id = slide.value.id;
        change((b) => slideIn(b, id)?.blocks.push(created));
        selectedBlockId.value = created.id;
    }

    function copyBlock(id: string): void {
        const source = slide.value?.blocks.find((x) => x.id === id);
        if (source) clipboard.value = [cloneJson(source)];
    }

    /** Copy and delete in one step; a locked block stays where it is. */
    function cutBlock(id: string): void {
        if (isLocked(id)) return;
        copyBlock(id);
        removeBlock(id);
    }

    /**
     * Puts copies of the given blocks on the current slide as one step: new ids, not locked, otherwise as they were.
     * They keep their place unless a block sits there already; one too big for this stage shrinks to fit. The last is chosen.
     */
    function place(sources: Block[]): void {
        const target = slide.value;
        if (!target || !sources.length) return;
        const slideId = target.id;
        const placed: Block[] = [];
        for (const source of sources) {
            const copy = cloneJson(source);
            delete copy.locked;
            const fitted = fitToStage({ ...copy, id: newId() }, stage.value);
            // A block from another stage may stick out of this one: pull it back in where it fits.
            const inside = {
                ...fitted,
                x: Math.max(0, Math.min(fitted.x, stage.value.width - fitted.width)),
                y: Math.max(0, Math.min(fitted.y, stage.value.height - fitted.height)),
            };
            const spot = freeSpot(inside, [...target.blocks, ...placed], stage.value);
            placed.push({ ...spot, ...clampFrame(spot, stage.value) });
        }
        change((b) => slideIn(b, slideId)?.blocks.push(...placed));
        selectedBlockId.value = placed[placed.length - 1]!.id;
    }

    function pasteBlocks(): void {
        place(clipboard.value);
    }

    /** Copy and paste in one, without touching the clipboard. */
    function duplicateBlock(id: string): void {
        const source = slide.value?.blocks.find((x) => x.id === id);
        if (source) place([source]);
    }

    /** A locked block (Plan.md, 25) takes no change – from the stage, the keys or the inspector. */
    function isLocked(id: string): boolean {
        return !!slide.value?.blocks.find((x) => x.id === id)?.locked;
    }

    function setLocked(id: string, locked: boolean): void {
        const slideId = slide.value?.id;
        change((b) => {
            const target = slideIn(b, slideId)?.blocks.find((x) => x.id === id);
            if (!target) return;
            if (locked) target.locked = true;
            else delete target.locked;
        });
    }

    /** Frame changes are clamped so a block always stays reachable on the stage. */
    function updateBlock(id: string, patch: Partial<Block>): void {
        if (isLocked(id)) return;
        const slideId = slide.value?.id;
        change((b) => {
            const target = slideIn(b, slideId)?.blocks.find((x) => x.id === id);
            if (!target) return;
            Object.assign(target, patch);
            Object.assign(target, clampFrame(target, b.playlist.stage));
        });
    }

    function removeBlock(id: string): void {
        if (isLocked(id)) return;
        const slideId = slide.value?.id;
        change((b) => {
            const target = slideIn(b, slideId);
            if (target) target.blocks = target.blocks.filter((x) => x.id !== id);
        });
        if (selectedBlockId.value === id) selectedBlockId.value = null;
    }

    function layerBlock(id: string, layer: Layer): void {
        if (isLocked(id)) return;
        const slideId = slide.value?.id;
        change((b) => {
            const target = slideIn(b, slideId);
            if (!target) return;
            const index = target.blocks.findIndex((x) => x.id === id);
            if (index >= 0) target.blocks = reorder(target.blocks, index, layer);
        });
    }

    /**
     * The layers dragged in the list (Plan.md 79, B3): the block at array place `from` goes to `to`; locked blocks keep
     * their place and the others pass them by. One step in the history.
     */
    function moveBlockLayer(from: number, to: number): void {
        const slideId = slide.value?.id;
        change((b) => {
            const target = slideIn(b, slideId);
            if (target) target.blocks = moveAround(target.blocks, from, to, (i) => !!target.blocks[i]?.locked);
        });
    }

    /**
     * `mine`: the knowing overwrite after a playlist conflict – every slide of this playlist
     * alone is written as the draft has it, not only the changed ones; linked slides still only when changed.
     */
    async function save(updatedBy: string, options: { mine?: boolean } = {}): Promise<boolean> {
        if (!repository.value || !draft.value) return false;
        if (!draft.value.playlist.name.trim()) {
            error.value = t.defaults.playlistNeedsName;
            status.value = 'error';
            return false;
        }
        status.value = 'saving';
        error.value = null;
        try {
            // The playlist and its slides – screens and schedules stay as they are (Plan.md, F).
            // Only changed slides are written: a linked slide may have been saved from another playlist since.
            const changedSlideIds = draft.value.slides
                .filter((s) => baseline.get(s.id) !== JSON.stringify(s) || (options.mine && !linkedIn(s.id).length))
                .map((s) => s.id);
            // Links taken over since the last save come into being now – the other playlists learn of them.
            const newlyLinked = draft.value.slides.filter((s) => linkPending(s.id)).map((s) => s.id);
            const saved = await repository.value.savePlaylist(draft.value, {
                expectedRevision: revision.value,
                updatedBy,
                changedSlideIds,
            });
            revision.value = saved.revision;
            draft.value.playlist.revision = saved.revision;
            draft.value.playlist.updatedBy = saved.updatedBy;
            draft.value.playlist.updatedAt = saved.updatedAt;
            // The written slides now carry the save's time – the next save of a shared one compares against it.
            for (const s of draft.value.slides) if (changedSlideIds.includes(s.id)) s.updatedAt = saved.updatedAt;
            markSaved();
            linkedSaved.value = slides.value
                .filter((s) => (changedSlideIds.includes(s.id) || newlyLinked.includes(s.id)) && linkedIn(s.id).length)
                .map((s) => ({ name: s.name, playlists: linkedIn(s.id).map((p) => p.name) }));
            status.value = 'saved';
            return true;
        } catch (e) {
            if (e instanceof SlideConflictError) {
                slideConflict.value = e.current;
                conflict.value = null;
                status.value = 'conflict';
            } else if (e instanceof ConflictError) {
                conflict.value = e.current;
                status.value = 'conflict';
            } else {
                error.value = e instanceof Error ? e.message : String(e);
                status.value = 'error';
            }
            return false;
        }
    }

    /** Conflict: keep my version and write it over the newer one, knowingly. */
    async function overwrite(updatedBy: string): Promise<boolean> {
        if (!conflict.value) return false;
        revision.value = conflict.value.revision;
        conflict.value = null;
        return save(updatedBy, { mine: true });
    }

    /** Slide conflict: keep my version of the slide as a copy of my own and save again. */
    async function keepAsCopy(updatedBy: string): Promise<boolean> {
        if (!slideConflict.value) return false;
        unlinkSlide(slideConflict.value.slide.id);
        slideConflict.value = null;
        return save(updatedBy);
    }

    /** Conflict: drop my changes and load what is stored now. */
    async function discardAndReload(): Promise<void> {
        if (draft.value) await open(draft.value.playlist.id);
    }

    return {
        draft,
        gridSize,
        setGridSize,
        media,
        theme,
        refreshMedia,
        dirty,
        revision,
        screens,
        stage,
        playlist,
        slides,
        slide,
        block,
        calendarIds,
        selectedBlockId,
        editingTextId,
        status,
        conflict,
        slideConflict,
        sharedWith,
        linkedSaved,
        linkedIn,
        linkPending,
        error,
        canUndo,
        canRedo,
        attach,
        reset,
        open,
        beginGesture,
        endGesture,
        startTextEdit,
        endTextEdit,
        undo,
        redo,
        selectSlide,
        selectBlock,
        renamePlaylist,
        addSlide,
        duplicateCurrentSlide,
        insertSlides,
        unlinkSlide,
        removeSlide,
        moveSlide,
        updateSlide,
        addBlock,
        updateBlock,
        removeBlock,
        layerBlock,
        moveBlockLayer,
        clipboard,
        blockSheetOpen,
        copyBlock,
        cutBlock,
        pasteBlocks,
        duplicateBlock,
        setLocked,
        save,
        overwrite,
        keepAsCopy,
        discardAndReload,
    };
});

const GRID_KEY = 'infoscreen-designer.grid';

function loadGridSize(): number {
    try {
        const stored = Number(localStorage.getItem(GRID_KEY));
        if ((GRID_SIZES as readonly number[]).includes(stored) && localStorage.getItem(GRID_KEY) !== null) return stored;
    } catch {
        // No storage: fall back to the default (guides off; the distances and guide lines of the stage do the work).
    }
    return 0;
}
