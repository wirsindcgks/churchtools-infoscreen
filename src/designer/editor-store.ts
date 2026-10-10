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
import { align, alignTarget, distribute, distributeBlocker, type Axis, type Edge, type Frame } from './arrange';
import { History } from './history';
import { GRID_SIZES } from './snap';
import { boundingBox, clampFrame, cloneJson, createBlock, createSlide, dropSingleGroups, duplicateSlide, freeSpot, gatherLayers, groupOf, move, moveAround, newId, reorderMany, withGroups, type Layer } from './ops';

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
    /** The chosen blocks (Plan.md 79, D1); `selection` has them in layer order, only those the slide still has. */
    const selectedBlockIds = ref<string[]>([]);
    /** "Mehrere auswählen" (Plan.md 79, D6): while on, every tap on a block adds it to the choice or takes it out. */
    const multiSelect = ref(false);
    /** The block whose layer row the mouse is over; the stage outlines its frame. Not a step in the history. */
    const hoveredBlockId = ref<string | null>(null);
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
    const selection = computed<Block[]>(() => slide.value?.blocks.filter((b) => selectedBlockIds.value.includes(b.id)) ?? []);
    /** The one chosen block; null with none or with several. */
    /** Several blocks can be grouped when they are not already all one group (groups among them merge). */
    const canGroup = computed(() => {
        const ids = withGroups(slide.value?.blocks ?? [], selectedBlockIds.value);
        if (ids.length < 2) return false;
        const members = blocksOf(ids);
        return !(members[0]?.groupId && members.every((x) => x.groupId === members[0]!.groupId));
    });
    const canUngroup = computed(() => selection.value.some((x) => x.groupId));
    /** The choice is exactly one group (Plan.md D9). */
    const groupSelected = computed(() => {
        const first = selection.value[0];
        return selection.value.length >= 2 && !!first?.groupId && groupOf(slide.value?.blocks ?? [], first.id).length === selection.value.length && selection.value.every((x) => x.groupId === first.groupId);
    });
    const block = computed(() => (selection.value.length === 1 ? selection.value[0]! : null));
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
            selectedBlockIds.value = [];
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
            selectedBlockIds.value = [];
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
        selectedBlockIds.value = [id];
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
        pruneSelection();
    }

    function redo(): void {
        if (!draft.value) return;
        endTextEdit();
        const next = history.redo(draft.value);
        if (next) draft.value = next;
        historyVersion.value++;
        pruneSelection();
    }

    function slideIn(bundle: PlaylistBundle, id: string | undefined): SlideDoc | undefined {
        return bundle.slides.find((s) => s.id === id);
    }

    function selectSlide(id: string): void {
        selectedSlideId.value = id;
        selectedBlockIds.value = [];
        multiSelect.value = false;
        hoveredBlockId.value = null;
    }

    /** Starts the mode and keeps what is chosen. */
    function startMultiSelect(): void {
        multiSelect.value = true;
    }

    function endMultiSelect(): void {
        multiSelect.value = false;
    }

    function selectBlock(id: string | null): void {
        selectedBlockIds.value = id ? [id] : [];
    }

    function isSelected(id: string): boolean {
        return selectedBlockIds.value.includes(id);
    }

    /** Chooses the block with its whole group (a click on the stage). */
    function pickBlock(id: string): void {
        selectedBlockIds.value = groupOf(slide.value?.blocks ?? [], id);
    }

    /** Takes the block's whole group out of the choice if a member is in it, else puts all in (Shift-click). */
    function toggleGroup(id: string): void {
        const members = groupOf(slide.value?.blocks ?? [], id);
        selectedBlockIds.value = isSelected(id)
            ? selectedBlockIds.value.filter((x) => !members.includes(x))
            : [...selectedBlockIds.value, ...members.filter((x) => !isSelected(x))];
    }

    /** Adds the block to the choice, or takes it out (Shift-click). */
    function toggleBlock(id: string): void {
        selectedBlockIds.value = isSelected(id) ? selectedBlockIds.value.filter((x) => x !== id) : [...selectedBlockIds.value, id];
    }

    /** Every block of the slide, locked ones too. */
    function selectAll(): void {
        selectedBlockIds.value = slide.value?.blocks.map((b) => b.id) ?? [];
    }

    /** The blocks whose frame the rectangle (stage pixels) touches; with `add` together with those chosen already. */
    function selectArea(rect: { x: number; y: number; width: number; height: number }, add = false): void {
        let hit = (slide.value?.blocks ?? [])
            .filter((b) => b.x <= rect.x + rect.width && b.x + b.width >= rect.x && b.y <= rect.y + rect.height && b.y + b.height >= rect.y)
            .map((b) => b.id);
        hit = withGroups(slide.value?.blocks ?? [], hit);
        selectedBlockIds.value = add ? [...new Set([...selectedBlockIds.value, ...hit])] : hit;
    }

    /** Takes out of the choice what the slide no longer has (after undo, redo and delete). */
    function pruneSelection(): void {
        const kept = selectedBlockIds.value.filter((id) => slide.value?.blocks.some((b) => b.id === id));
        if (kept.length !== selectedBlockIds.value.length) selectedBlockIds.value = kept;
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
        selectedBlockIds.value = [];
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
        selectedBlockIds.value = [created.id];
    }

    /** The blocks of the slide with these ids, in layer order. */
    function blocksOf(ids: readonly string[]): Block[] {
        return slide.value?.blocks.filter((b) => ids.includes(b.id)) ?? [];
    }

    /** Copies the blocks with their places to each other; locked ones come along. */
    function copyBlocks(ids: readonly string[]): void {
        const sources = blocksOf(ids);
        if (sources.length) clipboard.value = sources.map((x) => cloneJson(x));
    }

    /** Copy and delete in one step; locked blocks stay where they are (and are not copied). */
    function cutBlocks(ids: readonly string[]): void {
        const free = blocksOf(ids).filter((x) => !x.locked);
        if (!free.length) return;
        const freeIds = free.map((x) => x.id);
        copyBlocks(freeIds);
        removeBlocks(freeIds);
    }

    /**
     * Puts copies of the given blocks on the current slide as one step: new ids, not locked, otherwise as they were.
     * They keep their place to each other, as a group. It stays where it was unless a block sits there already (then the
     * group steps on, `freeSpot` for its box); a group too big for this stage shrinks to fit in its aspect ratio. All of them are chosen.
     * With `at` (stage pixels) the group's middle goes there instead, pulled back onto the stage, and stays even over a block.
     */
    function place(sources: Block[], at?: { x: number; y: number }): void {
        const target = slide.value;
        if (!target || !sources.length) return;
        const slideId = target.id;
        const groupIds = new Map<string, string>();
        let copies = sources.map((source): Block => {
            const copy = cloneJson(source);
            delete copy.locked;
            if (copy.groupId) {
                if (!groupIds.has(copy.groupId)) groupIds.set(copy.groupId, newId());
                copy.groupId = groupIds.get(copy.groupId)!;
            }
            return { ...copy, id: newId() };
        });
        dropSingleGroups(copies);
        const stageSize = stage.value;
        let box = boundingBox(copies)!;
        // A group from another stage may be bigger than this one.
        const scale = Math.min(1, stageSize.width / box.width, stageSize.height / box.height);
        if (scale < 1) {
            copies = copies.map((x) => ({
                ...x,
                x: Math.round(box.x + (x.x - box.x) * scale),
                y: Math.round(box.y + (x.y - box.y) * scale),
                width: Math.floor(x.width * scale),
                height: Math.floor(x.height * scale),
            }));
            box = boundingBox(copies)!;
        }
        // Pulled back in where it fits – as a whole, so the blocks keep their places to each other.
        let spot = {
            x: Math.max(0, Math.min(at ? at.x - box.width / 2 : box.x, stageSize.width - box.width)),
            y: Math.max(0, Math.min(at ? at.y - box.height / 2 : box.y, stageSize.height - box.height)),
        };
        if (!at) spot = freeSpot({ ...box, ...spot }, target.blocks, stageSize);
        const placed = copies.map((x) => {
            const moved = { ...x, x: x.x + spot.x - box.x, y: x.y + spot.y - box.y };
            return { ...moved, ...clampFrame(moved, stageSize) };
        });
        change((b) => slideIn(b, slideId)?.blocks.push(...placed));
        selectedBlockIds.value = placed.map((x) => x.id);
    }

    function pasteBlocks(at?: { x: number; y: number }): void {
        place(clipboard.value, at);
    }

    /** Copy and paste in one, without touching the clipboard. */
    function duplicateBlocks(ids: readonly string[]): void {
        place(blocksOf(ids));
    }

    /** A locked block (Plan.md, 25) takes no change – from the stage, the keys or the inspector. */
    function isLocked(id: string): boolean {
        return !!slide.value?.blocks.find((x) => x.id === id)?.locked;
    }

    /** Locks or unlocks all of them in one step. */
    function setLocked(ids: readonly string[], locked: boolean): void {
        const slideId = slide.value?.id;
        ids = withGroups(slide.value?.blocks ?? [], ids);
        change((b) => {
            for (const target of slideIn(b, slideId)?.blocks ?? []) {
                if (!ids.includes(target.id)) continue;
                if (locked) target.locked = true;
                else delete target.locked;
            }
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

    /**
     * Moves the unlocked ones among them together by this much (arrow keys, dragging on the stage). The box around them is
     * clamped like one block, so the group does not warp at the edge. A move that changes nothing leaves no step.
     */
    function moveBlocks(ids: readonly string[], dx: number, dy: number): void {
        const free = blocksOf(ids).filter((x) => !x.locked);
        const box = boundingBox(free);
        if (!box) return;
        const clamped = clampFrame({ ...box, x: box.x + dx, y: box.y + dy }, stage.value);
        const shiftX = clamped.x - box.x;
        const shiftY = clamped.y - box.y;
        if (!shiftX && !shiftY) return;
        const slideId = slide.value?.id;
        const moving = new Set(free.map((x) => x.id));
        change((b) => {
            for (const target of slideIn(b, slideId)?.blocks ?? []) {
                if (!moving.has(target.id)) continue;
                target.x += shiftX;
                target.y += shiftY;
            }
        });
    }

    /** Writes new frames for the given blocks (clamped) in one step; frames that stay as they are leave no step. */
    function applyFrames(blocks: readonly Block[], frames: readonly Frame[]): void {
        const next = new Map<string, Frame>();
        blocks.forEach((x, i) => {
            const frame = clampFrame(frames[i]!, stage.value);
            if (frame.x !== x.x || frame.y !== x.y) next.set(x.id, frame);
        });
        if (!next.size) return;
        const slideId = slide.value?.id;
        change((b) => {
            for (const target of slideIn(b, slideId)?.blocks ?? []) {
                const frame = next.get(target.id);
                if (frame) Object.assign(target, frame);
            }
        });
    }

    /**
     * Aligns the unlocked chosen blocks to an edge or middle (Plan.md 79, D4): one block to the stage, several to the box around
     * the locked ones among them or else around all. One step.
     */
    function alignSelection(edge: Edge): void {
        const target = alignTarget(selection.value, stage.value);
        if (!target) return;
        const free = selection.value.filter((x) => !x.locked);
        applyFrames(free, align(free, edge, target));
    }

    /** Spreads three or more evenly between the outer two; with a locked block between them it does nothing. One step. */
    function distributeSelection(axis: Axis): void {
        if (distributeBlocker(selection.value, axis)) return;
        const all = selection.value;
        const spread = distribute(all, axis);
        const free = all.map((x, i) => ({ x, frame: spread[i]! })).filter((p) => !p.x.locked);
        applyFrames(free.map((p) => p.x), free.map((p) => p.frame));
    }

    /** Deletes the unlocked ones in one step; locked blocks stay. */
    function removeBlocks(ids: readonly string[]): void {
        const gone = new Set(blocksOf(ids).filter((x) => !x.locked).map((x) => x.id));
        if (!gone.size) return;
        const slideId = slide.value?.id;
        change((b) => {
            const target = slideIn(b, slideId);
            if (!target) return;
            target.blocks = target.blocks.filter((x) => !gone.has(x.id));
            dropSingleGroups(target.blocks);
        });
        pruneSelection();
    }

    /** The layer of the unlocked ones, in one step; among themselves they keep their order (`reorderMany`). */
    function layerBlocks(ids: readonly string[], layer: Layer): void {
        const slideId = slide.value?.id;
        const free = new Set(blocksOf(withGroups(slide.value?.blocks ?? [], ids)).filter((x) => !x.locked).map((x) => x.id));
        if (!free.size) return;
        change((b) => {
            const target = slideIn(b, slideId);
            if (!target) return;
            const indices = target.blocks.flatMap((x, i) => (free.has(x.id) ? [i] : []));
            target.blocks = reorderMany(target.blocks, indices, layer);
        });
    }

    /**
     * Groups the blocks (and every group among them) as one step: one new `groupId`, the layers closed up under the topmost.
     * If one of them is locked, all become locked – a protection is never lost quietly. The choice stays.
     */
    function groupBlocks(ids: readonly string[]): void {
        const slideId = slide.value?.id;
        const all = new Set(withGroups(slide.value?.blocks ?? [], ids));
        if (all.size < 2) return;
        const groupId = newId();
        change((b) => {
            const target = slideIn(b, slideId);
            if (!target) return;
            const members = target.blocks.filter((x) => all.has(x.id));
            const locked = members.some((x) => x.locked);
            for (const x of members) {
                x.groupId = groupId;
                if (locked) x.locked = true;
            }
            const indices = target.blocks.flatMap((x, i) => (all.has(x.id) ? [i] : []));
            target.blocks = gatherLayers(target.blocks, indices);
        });
    }

    /** Takes the `groupId` off every member of the groups the blocks belong to, as one step. */
    function ungroupBlocks(ids: readonly string[]): void {
        const slideId = slide.value?.id;
        const all = new Set(withGroups(slide.value?.blocks ?? [], ids));
        if (!blocksOf([...all]).some((x) => x.groupId)) return;
        change((b) => {
            for (const x of slideIn(b, slideId)?.blocks ?? []) if (all.has(x.id)) delete x.groupId;
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
        selectedBlockIds,
        multiSelect,
        hoveredBlockId,
        startMultiSelect,
        endMultiSelect,
        selection,
        isSelected,
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
        pickBlock,
        toggleGroup,
        toggleBlock,
        selectAll,
        selectArea,
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
        moveBlocks,
        alignSelection,
        distributeSelection,
        removeBlocks,
        layerBlocks,
        groupBlocks,
        ungroupBlocks,
        canGroup,
        canUngroup,
        groupSelected,
        moveBlockLayer,
        clipboard,
        blockSheetOpen,
        copyBlocks,
        cutBlocks,
        pasteBlocks,
        duplicateBlocks,
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
