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
import { DraftConflictError, DraftsUnavailableError, type DraftConflictInfo } from '../store/drafts';
import { t } from '../i18n/designer';
import { tr } from '../i18n/repository';
import { History } from './history';
import { GRID_SIZES } from './snap';
import { clampFrame, cloneJson, createBlock, createSlide, duplicateSlide, fitToStage, freeSpot, move, moveAround, newId, reorder, type Layer } from './ops';

/** Publishing (Plan.md 79, Paket E): what the button "Veröffentlichen" is doing. */
export type SaveStatus = 'idle' | 'publishing' | 'published' | 'conflict' | 'error';
/** The draft that is saved on its own: `off` = no category or no right, the editor publishes directly. */
export type DraftStatus = 'off' | 'clean' | 'pending' | 'saving' | 'saved' | 'conflict' | 'error';

/** The draft is saved 2 s after the last change, and at the earliest 5 s after the start of the last save. */
export const DRAFT_DELAY_MS = 2000;
export const DRAFT_INTERVAL_MS = 5000;

export const useEditorStore = defineStore('editor', () => {
    const repository = shallowRef<ScreenRepository | null>(null);
    const draft = ref<PlaylistBundle | null>(null);
    /** The published state of the draft as JSON (loaded or published last) – `dirty` and publishing hang on it. */
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
    /** Who is editing: `updatedBy` of the playlist and of the drafts. */
    const author = ref('');
    /** Drafts are available: the category exists and this person may write there. */
    const draftsOn = ref(false);
    const draftStatus = ref<DraftStatus>('off');
    /** The bundle as last saved as a draft, as JSON; without a draft it is `savedJson`. */
    const draftJson = ref('');
    /** Revision of the saved draft; 0 = there is none. */
    const draftRevision = ref(0);
    const draftInfo = ref<{ updatedBy: string; updatedAt: string } | null>(null);
    /** The draft came with opening and has not been saved from here since. */
    const draftFromOpen = ref(false);
    const draftConflict = ref<DraftConflictInfo | null>(null);
    const draftError = ref<string | null>(null);
    let draftTimer: ReturnType<typeof setTimeout> | null = null;
    let draftSaving: Promise<void> | null = null;
    let lastDraftStart = 0;
    /** Each slide as last loaded or published, as JSON – what `publish()` compares to write only changed slides. */
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

    const bundleJson = computed(() => (draft.value ? JSON.stringify(draft.value) : ''));
    const dirty = computed(() => !!draft.value && bundleJson.value !== savedJson.value);
    const unsavedDraft = computed(() => draftsOn.value && !!draft.value && bundleJson.value !== draftJson.value);
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

    function attach(repo: ScreenRepository, name = ''): void {
        repository.value = repo;
        author.value = name;
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
        error.value = null;
        // Without a draft: the draft state is the published one. `open()` puts a draft over it.
        clearDraftTimer();
        draftJson.value = savedJson.value;
        draftRevision.value = 0;
        draftInfo.value = null;
        draftFromOpen.value = false;
        draftConflict.value = null;
        draftError.value = null;
        draftStatus.value = draftsOn.value ? 'clean' : 'off';
        if (!slides.value.some((s) => s.id === selectedSlideId.value)) {
            selectedSlideId.value = slides.value[0]?.id ?? null;
            selectedBlockId.value = null;
        }
    }

    async function open(playlistId: string): Promise<void> {
        const repo = repository.value;
        if (!repo) throw new Error(t.defaults.noStorage);
        draftsOn.value = await repo.drafts.categoryId().then((id) => id !== null, () => false);
        let stored: Awaited<ReturnType<typeof repo.drafts.load>> = null;
        if (draftsOn.value) {
            try {
                stored = await repo.drafts.load(playlistId);
            } catch (e) {
                if (!(e instanceof DraftsUnavailableError)) throw e;
                draftsOn.value = false;
            }
        }
        const [loaded, storedTheme] = await Promise.all([
            repo.loadPlaylist(playlistId, stored?.playlist.slideIds ?? []),
            // A theme that cannot be read leaves the defaults; it must not keep the playlist closed.
            repo.loadTheme().catch(() => null),
        ]);
        theme.value = storedTheme ?? DEFAULT_THEME;
        screens.value = loaded.screens;
        reset({ playlist: loaded.playlist, slides: loaded.slides }, loaded.playlist.revision, loaded.sharedWith);
        if (!stored || !draft.value) return;
        // The draft over the published state: name and order from the draft, a slide from the draft where it has one.
        const drafted = new Map(stored.slides.map((s) => [s.id, s]));
        const published = new Map(loaded.slides.map((s) => [s.id, s]));
        const ids = stored.playlist.slideIds.filter((id) => drafted.has(id) || published.has(id));
        const wanted = new Set(ids);
        // Published slides keep their place in the array, new ones follow: undoing everything gives the same JSON.
        const composed = [
            ...loaded.slides.filter((s) => wanted.has(s.id)).map((s) => drafted.get(s.id) ?? s),
            ...ids.filter((id) => !published.has(id)).map((id) => drafted.get(id)!),
        ];
        draft.value = cloneJson({ playlist: { ...loaded.playlist, name: stored.playlist.name, slideIds: ids }, slides: composed });
        draftJson.value = bundleJson.value;
        draftRevision.value = stored.playlist.revision;
        draftInfo.value = { updatedBy: stored.playlist.updatedBy, updatedAt: stored.playlist.updatedAt };
        draftFromOpen.value = true;
        draftStatus.value = 'saved';
        if (!slides.value.some((s) => s.id === selectedSlideId.value)) {
            selectedSlideId.value = slides.value[0]?.id ?? null;
            selectedBlockId.value = null;
        }
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
        if (status.value === 'published') status.value = 'idle';
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

    /** The linked slides publishing would write, with where else they run – asked before, not told after (Plan.md 49). */
    const linkedToPublish = computed(() => {
        void savedJson.value; // the baseline is not reactive; it changes together with the saved state
        return slides.value
            .filter((s) => (baseline.get(s.id) !== JSON.stringify(s) || linkPending(s.id)) && linkedIn(s.id).length)
            .map((s) => ({ name: s.name, playlists: linkedIn(s.id).map((p) => p.name) }));
    });

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
     * With `at` (stage pixels) the group's middle goes there instead, pulled back onto the stage, and stays even over a block.
     */
    function place(sources: Block[], at?: { x: number; y: number }): void {
        const target = slide.value;
        if (!target || !sources.length) return;
        const slideId = target.id;
        const placed: Block[] = [];
        let shift = { x: 0, y: 0 };
        if (at) {
            const left = Math.min(...sources.map((x) => x.x));
            const top = Math.min(...sources.map((x) => x.y));
            const right = Math.max(...sources.map((x) => x.x + x.width));
            const bottom = Math.max(...sources.map((x) => x.y + x.height));
            shift = { x: at.x - (left + right) / 2, y: at.y - (top + bottom) / 2 };
        }
        for (const source of sources) {
            const copy = cloneJson(source);
            copy.x += shift.x;
            copy.y += shift.y;
            delete copy.locked;
            const fitted = fitToStage({ ...copy, id: newId() }, stage.value);
            // A block from another stage may stick out of this one: pull it back in where it fits.
            const inside = {
                ...fitted,
                x: Math.max(0, Math.min(fitted.x, stage.value.width - fitted.width)),
                y: Math.max(0, Math.min(fitted.y, stage.value.height - fitted.height)),
            };
            const spot = at ? inside : freeSpot(inside, [...target.blocks, ...placed], stage.value);
            placed.push({ ...spot, ...clampFrame(spot, stage.value) });
        }
        change((b) => slideIn(b, slideId)?.blocks.push(...placed));
        selectedBlockId.value = placed[placed.length - 1]!.id;
    }

    function pasteBlocks(at?: { x: number; y: number }): void {
        place(clipboard.value, at);
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

    function clearDraftTimer(): void {
        if (draftTimer) clearTimeout(draftTimer);
        draftTimer = null;
    }

    function draftSaveAllowed(): boolean {
        return draftsOn.value && draftStatus.value !== 'conflict' && status.value !== 'publishing';
    }

    /** 2 s after this change, and 5 s after the start of the last save at the earliest. */
    function scheduleDraft(): void {
        clearDraftTimer();
        const wait = Math.max(DRAFT_DELAY_MS, lastDraftStart + DRAFT_INTERVAL_MS - Date.now());
        draftTimer = setTimeout(() => {
            draftTimer = null;
            void saveDraft();
        }, wait);
    }

    watch(bundleJson, (json) => {
        if (!draft.value || !draftSaveAllowed()) return;
        if (json !== draftJson.value) {
            draftStatus.value = 'pending';
            scheduleDraft();
        } else if (draftStatus.value === 'pending') {
            clearDraftTimer();
            draftStatus.value = draftRevision.value > 0 ? 'saved' : 'clean';
        }
    });

    /**
     * Saves the bundle as a draft: only the slides that differ from the published state. Equal to the published
     * state (everything undone, or just published) there is no draft – a saved one is discarded instead.
     */
    function saveDraft(): Promise<boolean> {
        if (!repository.value || !draft.value || !draftSaveAllowed()) return Promise.resolve(false);
        if (draftSaving) {
            return draftSaving.then(() => {
                if (unsavedDraft.value && draftSaveAllowed()) scheduleDraft();
                return !unsavedDraft.value && (draftStatus.value === 'saved' || draftStatus.value === 'clean');
            });
        }
        if (!unsavedDraft.value) {
            clearDraftTimer();
            if (draftStatus.value === 'error' || draftStatus.value === 'pending') {
                draftStatus.value = draftRevision.value > 0 ? 'saved' : 'clean';
            }
            return Promise.resolve(true);
        }
        clearDraftTimer();
        lastDraftStart = Date.now();
        const run = writeDraft(repository.value, draft.value).finally(() => {
            draftSaving = null;
        });
        draftSaving = run.then(
            () => undefined,
            () => undefined,
        );
        return run;
    }

    async function writeDraft(repo: ScreenRepository, bundle: PlaylistBundle): Promise<boolean> {
        const json = bundleJson.value;
        const playlistId = bundle.playlist.id;
        draftStatus.value = 'saving';
        draftError.value = null;
        try {
            if (json === savedJson.value) {
                if (draftRevision.value > 0 || draftJson.value !== savedJson.value) await repo.drafts.discard(playlistId);
                draftRevision.value = 0;
                draftInfo.value = null;
                draftFromOpen.value = false;
                draftJson.value = json;
                draftStatus.value = bundleJson.value !== json ? 'pending' : 'clean';
                return true;
            }
            const published = savedSlideIds.value;
            const changed = bundle.slides.filter((s) => baseline.get(s.id) !== JSON.stringify(s) || !published.has(s.id));
            const saved = await repo.drafts.save(
                { playlistId, name: bundle.playlist.name, slideIds: [...bundle.playlist.slideIds], slides: cloneJson(changed) },
                { expectedRevision: draftRevision.value, updatedBy: author.value },
            );
            draftRevision.value = saved.revision;
            draftInfo.value = { updatedBy: saved.updatedBy, updatedAt: saved.updatedAt };
            draftFromOpen.value = false;
            // Changes made while saving stay unsaved.
            draftJson.value = json;
            draftStatus.value = bundleJson.value !== json ? 'pending' : 'saved';
            return true;
        } catch (e) {
            if (e instanceof DraftConflictError) {
                draftConflict.value = e.current;
                draftStatus.value = 'conflict';
            } else if (e instanceof DraftsUnavailableError) {
                draftsOn.value = false;
                draftStatus.value = 'off';
            } else {
                draftError.value = e instanceof Error ? e.message : String(e);
                draftStatus.value = 'error';
            }
            return false;
        }
    }

    /** Save the draft now (Ctrl+S, leaving the page, a hidden tab): waits for a running save first. */
    async function flushDraft(): Promise<boolean> {
        clearDraftTimer();
        if (draftSaving) await draftSaving;
        return saveDraft();
    }

    /** Draft conflict: keep my version and save it over the other one, knowingly. */
    async function keepMyDraft(): Promise<boolean> {
        if (!draftConflict.value) return false;
        draftRevision.value = draftConflict.value.revision;
        draftConflict.value = null;
        draftStatus.value = 'pending';
        draftJson.value = ''; // whatever is stored now, my state is to be written
        return flushDraft();
    }

    /** Draft conflict: take the draft as it is stored now (or the published state, when it is gone). */
    async function reloadDraft(): Promise<void> {
        if (draft.value) await open(draft.value.playlist.id);
    }

    /**
     * Publishes: the playlist and its slides go to the screens, then the draft is dropped (Plan.md 79, Paket E).
     * `mine`: the knowing overwrite after a playlist conflict – every slide of this playlist
     * alone is written as the draft has it, not only the changed ones; linked slides still only when changed.
     */
    async function publish(options: { mine?: boolean } = {}): Promise<boolean> {
        if (!repository.value || !draft.value) return false;
        if (!draft.value.playlist.name.trim()) {
            error.value = t.defaults.playlistNeedsName;
            status.value = 'error';
            return false;
        }
        status.value = 'publishing';
        error.value = null;
        clearDraftTimer();
        if (draftSaving) await draftSaving;
        clearDraftTimer();
        try {
            // The playlist and its slides – screens and schedules stay as they are (Plan.md, F).
            // Only changed slides are written: a linked slide may have been published from another playlist since.
            const changedSlideIds = draft.value.slides
                .filter((s) => baseline.get(s.id) !== JSON.stringify(s) || (options.mine && !linkedIn(s.id).length))
                .map((s) => s.id);
            const saved = await repository.value.savePlaylist(draft.value, {
                expectedRevision: revision.value,
                updatedBy: author.value,
                changedSlideIds,
            });
            revision.value = saved.revision;
            draft.value.playlist.revision = saved.revision;
            draft.value.playlist.updatedBy = saved.updatedBy;
            draft.value.playlist.updatedAt = saved.updatedAt;
            // The written slides now carry the publishing time – the next one of a shared slide compares against it.
            for (const s of draft.value.slides) if (changedSlideIds.includes(s.id)) s.updatedAt = saved.updatedAt;
            markSaved();
            status.value = 'published';
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
        if (draftsOn.value) {
            try {
                await repository.value.drafts.discard(draft.value.playlist.id);
                clearDraftTimer();
                draftRevision.value = 0;
                draftInfo.value = null;
                draftFromOpen.value = false;
                draftConflict.value = null;
                draftError.value = null;
                draftJson.value = savedJson.value;
                draftStatus.value = 'clean';
            } catch {
                // Nothing changes: the next save sees "same as published" and discards then.
            }
            // A change made while publishing was not scheduled – the draft was not to be saved then.
            if (unsavedDraft.value && draftSaveAllowed()) {
                draftStatus.value = 'pending';
                scheduleDraft();
            }
        }
        return true;
    }

    /** Conflict: keep my version and write it over the newer one, knowingly. */
    async function overwrite(): Promise<boolean> {
        if (!conflict.value) return false;
        revision.value = conflict.value.revision;
        conflict.value = null;
        return publish({ mine: true });
    }

    /** Slide conflict: keep my version of the slide as a copy of my own and publish again. */
    async function keepAsCopy(): Promise<boolean> {
        if (!slideConflict.value) return false;
        unlinkSlide(slideConflict.value.slide.id);
        slideConflict.value = null;
        return publish();
    }

    /** Drop the draft and my changes, and load what is published now. */
    async function discardAndReload(): Promise<void> {
        if (!draft.value || !repository.value) return;
        const id = draft.value.playlist.id;
        if (draftsOn.value) {
            clearDraftTimer();
            if (draftSaving) await draftSaving;
            try {
                await repository.value.drafts.discard(id);
            } catch (e) {
                draftError.value = e instanceof Error ? e.message : String(e);
                draftStatus.value = 'error';
                return;
            }
        }
        await open(id);
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
        linkedToPublish,
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
        publish,
        saveDraft,
        flushDraft,
        keepMyDraft,
        reloadDraft,
        author,
        draftsOn,
        draftStatus,
        draftRevision,
        draftInfo,
        draftFromOpen,
        draftConflict,
        draftError,
        unsavedDraft,
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
