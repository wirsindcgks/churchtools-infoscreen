/**
 * The screen being edited: a draft of the whole bundle, its history, the
 * selection and the save state. Every change goes through `change()`, which
 * records a snapshot first; a drag records once at its start (`beginGesture`).
 */
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import {
    SCHEMA_VERSION,
    type Block,
    type BlockType,
    type MediaDoc,
    type PlaylistDoc,
    type ScheduleRule,
    type ScreenBundle,
    type SlideDoc,
} from '../model/schema';
import { ConflictError, type ConflictInfo, type ScreenRepository } from '../store/screen-repository';
import { History } from './history';
import { GRID_SIZES } from './snap';
import { clampFrame, cloneJson, createBlock, createSlide, duplicateSlide, move, newId, reorder, type Layer } from './ops';
import { scheduleProblems } from './schedule-ops';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export const useEditorStore = defineStore('editor', () => {
    const repository = shallowRef<ScreenRepository | null>(null);
    const draft = ref<ScreenBundle | null>(null);
    const savedJson = ref('');
    /**
     * Revision of the screen's schedule document the draft started from – what
     * the designers save against (Plan.md, 15); null before the first save of
     * content since schema 1.2.
     */
    const revision = ref<number | null>(null);
    /** The playlist the slide list shows and edits (Plan.md, Nächste Schritte 17). */
    const selectedPlaylistId = ref<string | null>(null);
    const selectedSlideId = ref<string | null>(null);
    const selectedBlockId = ref<string | null>(null);
    const status = ref<SaveStatus>('idle');
    const conflict = ref<ConflictInfo | null>(null);
    const error = ref<string | null>(null);
    /** Grid size in stage pixels, 0 = off. A preference of this browser, not part of the screen. */
    const gridSize = ref<number>(loadGridSize());
    /** Media documents known to the store, for the preview and the pickers. */
    const media = ref<MediaDoc[]>([]);
    const history = new History<ScreenBundle>();
    const historyVersion = ref(0); // makes canUndo/canRedo reactive
    let gestureOpen = false;
    let gestureRecorded = false;

    const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== savedJson.value);
    const canUndo = computed(() => historyVersion.value >= 0 && history.canUndo);
    const canRedo = computed(() => historyVersion.value >= 0 && history.canRedo);
    const stage = computed(() => draft.value?.screen.stage ?? { width: 1920, height: 1080 });
    const playlists = computed<PlaylistDoc[]>(() => draft.value?.playlists ?? []);
    const playlist = computed(
        () =>
            playlists.value.find((p) => p.id === selectedPlaylistId.value) ??
            playlists.value.find((p) => p.id === draft.value?.screen.defaultPlaylistId) ??
            null,
    );
    const rules = computed<ScheduleRule[]>(() => draft.value?.screen.schedule ?? []);
    const problems = computed(() => (draft.value ? scheduleProblems(draft.value.screen, draft.value.playlists) : []));
    /** Slides in playlist order. */
    const slides = computed<SlideDoc[]>(() => {
        const byId = new Map(draft.value?.slides.map((s) => [s.id, s]));
        return (playlist.value?.slideIds ?? []).map((id) => byId.get(id)).filter((s): s is SlideDoc => !!s);
    });
    const slide = computed(() => slides.value.find((s) => s.id === selectedSlideId.value) ?? slides.value[0] ?? null);
    const block = computed(() => slide.value?.blocks.find((b) => b.id === selectedBlockId.value) ?? null);
    const calendarIds = computed(() => [
        ...new Set(
            draft.value?.slides.flatMap((s) =>
                s.blocks.flatMap((b) =>
                    b.type === 'appointment-list' || b.type === 'next-appointment' ? b.calendarIds : [],
                ),
            ) ?? [],
        ),
    ]);
    /** Calendars the preview needs: those of the blocks and those the rules switch on. */
    const previewCalendarIds = computed(() => [
        ...new Set([
            ...calendarIds.value,
            ...rules.value.flatMap((r) => (r.kind === 'appointment' ? r.calendarIds : [])),
        ]),
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

    function reset(bundle: ScreenBundle, contentRevision: number | null = null): void {
        draft.value = cloneJson(bundle);
        savedJson.value = JSON.stringify(draft.value);
        revision.value = contentRevision;
        history.clear();
        historyVersion.value++;
        status.value = 'idle';
        conflict.value = null;
        error.value = null;
        if (!bundle.playlists.some((p) => p.id === selectedPlaylistId.value)) {
            selectedPlaylistId.value = bundle.screen.defaultPlaylistId;
        }
        if (!slides.value.some((s) => s.id === selectedSlideId.value)) {
            selectedSlideId.value = slides.value[0]?.id ?? null;
            selectedBlockId.value = null;
        }
    }

    async function open(slug: string): Promise<void> {
        if (!repository.value) throw new Error('Kein Speicher angebunden.');
        const loaded = await repository.value.loadScreen(slug);
        reset({ screen: loaded.screen, playlists: loaded.playlists, slides: loaded.slides }, loaded.schedule?.revision ?? null);
    }

    /**
     * Applies a change and records the state before it. Inside a gesture – a
     * drag, or typing in one field – only the first change records, so the
     * whole gesture is one undo step.
     */
    function change(mutate: (bundle: ScreenBundle) => void): void {
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

    function slideIn(bundle: ScreenBundle, id: string | undefined): SlideDoc | undefined {
        return bundle.slides.find((s) => s.id === id);
    }

    /** The playlist being edited, inside the bundle a change mutates. */
    function listIn(bundle: ScreenBundle): PlaylistDoc | undefined {
        return bundle.playlists.find((p) => p.id === playlist.value?.id);
    }

    /** Other playlists of this screen that show the slide too – shown, so nobody edits blind. */
    function alsoIn(slideId: string): string[] {
        return playlists.value.filter((p) => p.id !== playlist.value?.id && p.slideIds.includes(slideId)).map((p) => p.name);
    }

    /** Slides of this screen the current playlist does not show yet, to link them in. */
    const otherSlides = computed<SlideDoc[]>(() => {
        const shown = new Set(playlist.value?.slideIds ?? []);
        return (draft.value?.slides ?? []).filter((s) => !shown.has(s.id));
    });

    function selectPlaylist(id: string): void {
        if (!playlists.value.some((p) => p.id === id)) return;
        selectedPlaylistId.value = id;
        selectedSlideId.value = playlist.value?.slideIds[0] ?? null;
        selectedBlockId.value = null;
    }

    /** A new playlist starts with one empty slide: an empty playlist would show nothing. */
    function addPlaylist(name: string): string {
        const slideDoc = createSlide();
        const created: PlaylistDoc = {
            schema: { ...SCHEMA_VERSION },
            kind: 'playlist',
            id: newId(),
            name: name.trim() || 'Neue Playlist',
            slideIds: [slideDoc.id],
        };
        change((b) => {
            b.slides.push(slideDoc);
            b.playlists.push(created);
        });
        selectPlaylist(created.id);
        return created.id;
    }

    function renamePlaylist(id: string, name: string): void {
        change((b) => {
            const target = b.playlists.find((p) => p.id === id);
            if (target) target.name = name;
        });
    }

    /**
     * Removes a playlist, the rules that switch to it and the slides no other
     * playlist shows. The default playlist stays: without it the screen would be black.
     */
    function removePlaylist(id: string): void {
        if (!draft.value || id === draft.value.screen.defaultPlaylistId) return;
        change((b) => {
            b.playlists = b.playlists.filter((p) => p.id !== id);
            b.screen.schedule = b.screen.schedule.filter((r) => r.playlistId !== id);
            const shown = new Set(b.playlists.flatMap((p) => p.slideIds));
            b.slides = b.slides.filter((s) => shown.has(s.id));
        });
        if (selectedPlaylistId.value === id) selectPlaylist(draft.value.screen.defaultPlaylistId);
    }

    function setDefaultPlaylist(id: string): void {
        change((b) => {
            if (b.playlists.some((p) => p.id === id)) b.screen.defaultPlaylistId = id;
        });
    }

    function addRule(rule: ScheduleRule): void {
        change((b) => b.screen.schedule.push(cloneJson(rule)));
    }

    function updateRule(index: number, patch: Partial<ScheduleRule>): void {
        change((b) => {
            const target = b.screen.schedule[index];
            if (target) Object.assign(target, patch);
        });
    }

    function removeRule(index: number): void {
        change((b) => b.screen.schedule.splice(index, 1));
    }

    /** Order is precedence: the upper rule wins where two overlap. */
    function moveRule(from: number, to: number): void {
        if (from === to || to < 0 || to >= rules.value.length) return;
        change((b) => (b.screen.schedule = move(b.screen.schedule, from, to)));
    }

    /** Shows an existing slide in the current playlist too – the same slide, not a copy. */
    function linkSlide(id: string): void {
        if (!draft.value?.slides.some((s) => s.id === id)) return;
        change((b) => {
            const list = listIn(b);
            if (list && !list.slideIds.includes(id)) list.slideIds.push(id);
        });
        selectSlide(id);
    }

    function selectSlide(id: string): void {
        selectedSlideId.value = id;
        selectedBlockId.value = null;
    }

    function selectBlock(id: string | null): void {
        selectedBlockId.value = id;
    }

    function addSlide(): void {
        const created = createSlide();
        change((b) => {
            b.slides.push(created);
            const list = listIn(b);
            const at = list ? list.slideIds.indexOf(slide.value?.id ?? '') + 1 : 0;
            list?.slideIds.splice(at > 0 ? at : list.slideIds.length, 0, created.id);
        });
        selectSlide(created.id);
    }

    function duplicateCurrentSlide(): void {
        if (!slide.value) return;
        const copy = duplicateSlide(slide.value);
        const originalId = slide.value.id;
        change((b) => {
            b.slides.push(copy);
            const list = listIn(b);
            list?.slideIds.splice(list.slideIds.indexOf(originalId) + 1, 0, copy.id);
        });
        selectSlide(copy.id);
    }

    /** Takes the slide out of the current playlist; it is deleted only when no other playlist shows it. */
    function removeSlide(id: string): void {
        const index = slides.value.findIndex((s) => s.id === id);
        change((b) => {
            const list = listIn(b);
            if (list) list.slideIds = list.slideIds.filter((s) => s !== id);
            if (!b.playlists.some((p) => p.slideIds.includes(id))) b.slides = b.slides.filter((s) => s.id !== id);
        });
        const next = slides.value[Math.min(index, slides.value.length - 1)];
        selectedSlideId.value = next?.id ?? null;
        selectedBlockId.value = null;
    }

    function moveSlide(from: number, to: number): void {
        if (from === to) return;
        change((b) => {
            const list = listIn(b);
            if (list) list.slideIds = move(list.slideIds, from, to);
        });
    }

    function updateSlide(patch: Partial<Omit<SlideDoc, 'id' | 'kind' | 'schema' | 'blocks'>>): void {
        const id = slide.value?.id;
        change((b) => Object.assign(slideIn(b, id) ?? {}, patch));
    }

    function addBlock(type: BlockType): void {
        if (!slide.value) return;
        const created = createBlock(type, stage.value, calendarIds.value);
        const id = slide.value.id;
        change((b) => slideIn(b, id)?.blocks.push(created));
        selectedBlockId.value = created.id;
    }

    /** Frame changes are clamped so a block always stays reachable on the stage. */
    function updateBlock(id: string, patch: Partial<Block>): void {
        const slideId = slide.value?.id;
        change((b) => {
            const target = slideIn(b, slideId)?.blocks.find((x) => x.id === id);
            if (!target) return;
            Object.assign(target, patch);
            Object.assign(target, clampFrame(target, b.screen.stage));
        });
    }

    function removeBlock(id: string): void {
        const slideId = slide.value?.id;
        change((b) => {
            const target = slideIn(b, slideId);
            if (target) target.blocks = target.blocks.filter((x) => x.id !== id);
        });
        if (selectedBlockId.value === id) selectedBlockId.value = null;
    }

    function layerBlock(id: string, layer: Layer): void {
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
        if (problems.value.length) {
            error.value = `Zeitplan: ${problems.value.join(' ')}`;
            status.value = 'error';
            return false;
        }
        status.value = 'saving';
        error.value = null;
        try {
            // Slides, playlists and schedule – the screen itself belongs to the administrators (Plan.md, F).
            const saved = await repository.value.saveContent(draft.value, {
                expectedRevision: revision.value,
                updatedBy,
            });
            revision.value = saved.revision;
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
        if (draft.value) await open(draft.value.screen.slug);
    }

    return {
        draft,
        gridSize,
        setGridSize,
        media,
        refreshMedia,
        dirty,
        playlists,
        playlist,
        rules,
        problems,
        previewCalendarIds,
        otherSlides,
        alsoIn,
        selectPlaylist,
        addPlaylist,
        renamePlaylist,
        removePlaylist,
        setDefaultPlaylist,
        addRule,
        updateRule,
        removeRule,
        moveRule,
        linkSlide,
        revision,
        stage,
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
        addSlide,
        duplicateCurrentSlide,
        removeSlide,
        moveSlide,
        updateSlide,
        addBlock,
        updateBlock,
        removeBlock,
        layerBlock,
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
