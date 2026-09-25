/**
 * The playlist being edited (schema 1.4: the editor hangs on the playlist,
 * not on a screen – Plan.md, Nächste Schritte 19): a draft of the playlist
 * with its slides, its history, the selection and the save state. Every
 * change goes through `change()`, which records a snapshot first; a drag
 * records once at its start (`beginGesture`).
 */
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { blockCalendarIds, DEFAULT_THEME, type Block, type BlockType, type MediaDoc, type PlaylistBundle, type SlideDoc, type ThemeDoc } from '../model/schema';
import { ConflictError, copySlide, type ConflictInfo, type ScreenRef, type ScreenRepository } from '../store/screen-repository';
import { History } from './history';
import { GRID_SIZES } from './snap';
import { clampFrame, cloneJson, createBlock, createSlide, duplicateSlide, move, reorder, type Layer } from './ops';

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
    const error = ref<string | null>(null);
    /** Grid size in stage pixels, 0 = off. A preference of this browser, not part of the playlist. */
    const gridSize = ref<number>(loadGridSize());
    /** Media documents known to the store, for the preview and the pickers. */
    const media = ref<MediaDoc[]>([]);
    /** The look of all screens (Plan.md, 27): new slides and blocks start in its colours, the preview shows it. */
    const theme = ref<ThemeDoc>(DEFAULT_THEME);
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

    function reset(bundle: PlaylistBundle, playlistRevision = bundle.playlist.revision ?? 0): void {
        draft.value = cloneJson(bundle);
        savedJson.value = JSON.stringify(draft.value);
        revision.value = playlistRevision;
        history.clear();
        historyVersion.value++;
        status.value = 'idle';
        conflict.value = null;
        error.value = null;
        if (!slides.value.some((s) => s.id === selectedSlideId.value)) {
            selectedSlideId.value = slides.value[0]?.id ?? null;
            selectedBlockId.value = null;
        }
    }

    async function open(playlistId: string): Promise<void> {
        if (!repository.value) throw new Error('Kein Speicher angebunden.');
        const [loaded, stored] = await Promise.all([
            repository.value.loadPlaylist(playlistId),
            // A theme that cannot be read leaves the defaults; it must not keep the playlist closed.
            repository.value.loadTheme().catch(() => null),
        ]);
        theme.value = stored ?? DEFAULT_THEME;
        screens.value = loaded.screens;
        reset({ playlist: loaded.playlist, slides: loaded.slides }, loaded.playlist.revision);
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
        if (status.value === 'saved') status.value = 'idle';
    }

    function beginGesture(): void {
        gestureOpen = true;
    }

    function endGesture(): void {
        gestureOpen = false;
        gestureRecorded = false;
    }

    function undo(): void {
        if (!draft.value) return;
        const previous = history.undo(draft.value);
        if (previous) draft.value = previous;
        historyVersion.value++;
    }

    function redo(): void {
        if (!draft.value) return;
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
        const created = createSlide('Neue Slide', theme.value);
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

    /**
     * Copies of slides from another playlist, after the current one – copies,
     * so that editing them here never changes the other playlist.
     */
    function insertSlides(sources: SlideDoc[]): void {
        if (!sources.length) return;
        const copies = sources.map((source) => copySlide(source));
        change((b) => {
            b.slides.push(...copies);
            const at = b.playlist.slideIds.indexOf(slide.value?.id ?? '') + 1;
            b.playlist.slideIds.splice(at > 0 ? at : b.playlist.slideIds.length, 0, ...copies.map((c) => c.id));
        });
        selectSlide(copies[0]!.id);
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
        const created = createBlock(type, stage.value, calendarIds.value, theme.value);
        const id = slide.value.id;
        change((b) => slideIn(b, id)?.blocks.push(created));
        selectedBlockId.value = created.id;
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

    async function save(updatedBy: string): Promise<boolean> {
        if (!repository.value || !draft.value) return false;
        if (!draft.value.playlist.name.trim()) {
            error.value = 'Die Playlist braucht einen Namen.';
            status.value = 'error';
            return false;
        }
        status.value = 'saving';
        error.value = null;
        try {
            // The playlist and its slides – screens and schedules stay as they are (Plan.md, F).
            const saved = await repository.value.savePlaylist(draft.value, {
                expectedRevision: revision.value,
                updatedBy,
            });
            revision.value = saved.revision;
            draft.value.playlist.revision = saved.revision;
            draft.value.playlist.updatedBy = saved.updatedBy;
            draft.value.playlist.updatedAt = saved.updatedAt;
            savedJson.value = JSON.stringify(draft.value);
            status.value = 'saved';
            return true;
        } catch (e) {
            if (e instanceof ConflictError) {
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
        status,
        conflict,
        error,
        canUndo,
        canRedo,
        attach,
        reset,
        open,
        beginGesture,
        endGesture,
        undo,
        redo,
        selectSlide,
        selectBlock,
        renamePlaylist,
        addSlide,
        duplicateCurrentSlide,
        insertSlides,
        removeSlide,
        moveSlide,
        updateSlide,
        addBlock,
        updateBlock,
        removeBlock,
        layerBlock,
        setLocked,
        save,
        overwrite,
        discardAndReload,
    };
});

const GRID_KEY = 'infoscreen-designer.grid';

function loadGridSize(): number {
    try {
        const stored = Number(localStorage.getItem(GRID_KEY));
        if ((GRID_SIZES as readonly number[]).includes(stored) && localStorage.getItem(GRID_KEY) !== null) return stored;
    } catch {
        // No storage: fall back to the default.
    }
    return 20;
}
