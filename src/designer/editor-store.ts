/**
 * The screen being edited: a draft of the whole bundle, its history, the
 * selection and the save state. Every change goes through `change()`, which
 * records a snapshot first; a drag records once at its start (`beginGesture`).
 */
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import type { Block, BlockType, ScreenBundle, ScreenDoc, SlideDoc } from '../model/schema';
import { ConflictError, type ScreenRepository } from '../store/screen-repository';
import { History } from './history';
import { clampFrame, cloneJson, createBlock, createSlide, duplicateSlide, move, reorder, type Layer } from './ops';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export const useEditorStore = defineStore('editor', () => {
    const repository = shallowRef<ScreenRepository | null>(null);
    const draft = ref<ScreenBundle | null>(null);
    const savedJson = ref('');
    const revision = ref(0);
    const selectedSlideId = ref<string | null>(null);
    const selectedBlockId = ref<string | null>(null);
    const status = ref<SaveStatus>('idle');
    const conflict = ref<ScreenDoc | null>(null);
    const error = ref<string | null>(null);
    const history = new History<ScreenBundle>();
    const historyVersion = ref(0); // makes canUndo/canRedo reactive
    let gestureOpen = false;
    let gestureRecorded = false;

    const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== savedJson.value);
    const canUndo = computed(() => historyVersion.value >= 0 && history.canUndo);
    const canRedo = computed(() => historyVersion.value >= 0 && history.canRedo);
    const stage = computed(() => draft.value?.screen.stage ?? { width: 1920, height: 1080 });
    const playlist = computed(
        () => draft.value?.playlists.find((p) => p.id === draft.value?.screen.defaultPlaylistId) ?? null,
    );
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

    function attach(repo: ScreenRepository): void {
        repository.value = repo;
    }

    function reset(bundle: ScreenBundle): void {
        draft.value = cloneJson(bundle);
        savedJson.value = JSON.stringify(draft.value);
        revision.value = bundle.screen.revision;
        history.clear();
        historyVersion.value++;
        status.value = 'idle';
        conflict.value = null;
        error.value = null;
        if (!bundle.slides.some((s) => s.id === selectedSlideId.value)) {
            selectedSlideId.value = bundle.playlists[0]?.slideIds[0] ?? null;
            selectedBlockId.value = null;
        }
    }

    async function open(slug: string): Promise<void> {
        if (!repository.value) throw new Error('Kein Speicher angebunden.');
        const loaded = await repository.value.loadScreen(slug);
        reset({ screen: loaded.screen, playlists: loaded.playlists, slides: loaded.slides });
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

    function selectSlide(id: string): void {
        selectedSlideId.value = id;
        selectedBlockId.value = null;
    }

    function selectBlock(id: string | null): void {
        selectedBlockId.value = id;
    }

    function updateScreen(patch: Partial<Pick<ScreenDoc, 'name' | 'overscanPercent'>>): void {
        change((b) => Object.assign(b.screen, patch));
    }

    function addSlide(): void {
        const created = createSlide();
        change((b) => {
            b.slides.push(created);
            const list = b.playlists.find((p) => p.id === b.screen.defaultPlaylistId);
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
            const list = b.playlists.find((p) => p.id === b.screen.defaultPlaylistId);
            list?.slideIds.splice(list.slideIds.indexOf(originalId) + 1, 0, copy.id);
        });
        selectSlide(copy.id);
    }

    function removeSlide(id: string): void {
        const index = slides.value.findIndex((s) => s.id === id);
        change((b) => {
            b.playlists.forEach((p) => (p.slideIds = p.slideIds.filter((s) => s !== id)));
            b.slides = b.slides.filter((s) => s.id !== id);
        });
        const next = slides.value[Math.min(index, slides.value.length - 1)];
        selectedSlideId.value = next?.id ?? null;
        selectedBlockId.value = null;
    }

    function moveSlide(from: number, to: number): void {
        if (from === to) return;
        change((b) => {
            const list = b.playlists.find((p) => p.id === b.screen.defaultPlaylistId);
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
        status.value = 'saving';
        error.value = null;
        try {
            const saved = await repository.value.saveScreen(draft.value, {
                expectedRevision: revision.value,
                updatedBy,
            });
            draft.value.screen = saved;
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
        dirty,
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
        updateScreen,
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
