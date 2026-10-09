<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { currentPerson, displayName, instanceBaseUrl } from '../ct/client';
import { fetchGroupHomepageList, fetchPostGroups, fetchResourceMasterdata, fetchServiceGroups, fetchServices, type PostGroup } from '../ct/api';
import { liveSaveTitle, liveScreens } from '../designer/alive';
import AppBar from '../designer/AppBar.vue';
import BlockPalette from '../designer/BlockPalette.vue';
import EditorStage from '../designer/EditorStage.vue';
import { useEditorStore } from '../designer/editor-store';
import Icon from '../designer/Icon.vue';
import Inspector from '../designer/Inspector.vue';
import LiveFlag from '../designer/LiveFlag.vue';
import { providePalette } from '../designer/palette';
import MediaLibraryDialog from '../designer/MediaLibraryDialog.vue';
import { BLOCK_LABELS } from '../designer/ops';
import PlaylistPreview from '../designer/PlaylistPreview.vue';
import ShortcutsDialog from '../designer/ShortcutsDialog.vue';
import { KEYS, withKeys } from '../designer/shortcuts';
import SlideList from '../designer/SlideList.vue';
import type { SettingsDoc } from '../model/schema';
import { useHeartbeats } from '../designer/useHeartbeats';
import { usePreview } from '../designer/usePreview';
import type { HomepageEntry } from '../groups/normalize';
import type { MediaDoc } from '../model/schema';
import { MEDIA_PAGE } from '../media/library';
import { roomsOf, type RoomInfo } from '../rooms/normalize';
import { needsAppointmentRooms } from '../appointments/rooms';
import { allowedServiceIds, appointmentServicesInUse, serviceChoices, type ServiceInfo } from '../appointments/services';
import { groupNeeds, postNeeds, roomNeeds } from '../player/data';
import { getRepository } from '../store/backend';
import type { ScreenRepository } from '../store/screen-repository';
import { t } from '../i18n/designer';
import { LOCALE } from '../i18n/player';
import { vTip } from '../designer/tip';
import { useConfirm } from '../designer/useConfirm';

const { confirm } = useConfirm();

const route = useRoute();
const playlistId = String(route.params.id);

/**
 * Back to where one came from: the screens, whose tile opens the default
 * playlist, or the playlists page (schema 1.4). The previous path is the
 * router's, not the browser's – nothing outside the module.
 */
const cameFrom = String(useRouter().options.history.state.back ?? '');
const back = cameFrom === '/' || cameFrom.startsWith('/?')
    ? { to: { name: 'designer', query: useRouter().resolve(cameFrom).query }, label: t.editor.backToScreens }
    : { to: { name: 'playlists' }, label: t.editor.backToPlaylists };
const editor = useEditorStore();
const loadError = ref<string | null>(null);
const demo = ref(false);
const author = ref('');
const root = ref<HTMLElement | null>(null);
const top = ref(0);

/** The services an administrator allows on screens (Plan.md 58); none until loaded, and where the settings cannot be read. */
const allowedServices = ref<number[]>([]);

providePalette(
    computed(() => editor.theme),
    computed(() => editor.slide),
);

const calendarIds = computed(() => editor.calendarIds);
const { context, calendars, hiddenCalendars, problem } = usePreview(
    calendarIds,
    computed(() => editor.media),
    computed(() => editor.theme),
    computed(() => postNeeds(editor.slides)),
    computed(() => groupNeeds(editor.slides)),
    computed(() => roomNeeds(editor.slides)),
    computed(() => needsAppointmentRooms(editor.slides.flatMap((s) => s.blocks))),
    computed(() => allowedServiceIds(appointmentServicesInUse(editor.slides.flatMap((s) => s.blocks)), allowedServices.value)),
);

/** The playlist is on a screen right now, by that screen's own sign of life (Plan.md 77). */
const repository = shallowRef<ScreenRepository | null>(null);
const { heartbeats, now, refreshHeartbeats } = useHeartbeats(repository);
const live = computed(() => liveScreens(playlistId, editor.screens, heartbeats.value, now.value));

/** Groups with posts switched on, for the „Beiträge"-Baustein; loaded once. Unreadable → an empty list, the inspector says so. */
const groups = ref<PostGroup[]>([]);
/** Group homepages for the „Gruppen"-Baustein (Plan.md 43); loaded once, unreadable → an empty list. */
const homepages = ref<HomepageEntry[]>([]);
/** Rooms for the „Raumbelegung"-Baustein (Plan.md 46); null until loaded, unreadable → none. */
const rooms = ref<RoomInfo[] | null>(null);
/** Services people may see (Plan.md 51); null until loaded, unreadable → `servicesFailed`. */
const services = ref<ServiceInfo[] | null>(null);
const servicesFailed = ref(false);

/** The preview of the unsaved draft, as the TV would show it. */
const previewing = ref(false);

/**
 * The inspector as a sheet at the bottom on a phone and a tablet standing upright (Plan.md 44, M4; 45),
 * as a column beside the stage on a tablet lying down. CSS ignores it at a desktop width (see `desktopInspectorOpen`).
 */
const inspectorOpen = ref(false);

/**
 * The slides as a drawer on a tablet (Plan.md 45), closed by default. CSS ignores
 * it at a phone or desktop width; the phone's own row keeps its state in `SlideList.vue`.
 */
const slidesDrawerOpen = ref(false);
/** A tap on a slide chooses it – and folds the drawer away; the buttons of the chosen one stay out of it. */
function closeSlidesDrawerOnPick(event: Event): void {
    if ((event.target as HTMLElement).closest('[data-testid="slide-item"]')) slidesDrawerOpen.value = false;
}

/**
 * The two columns of a desktop, each collapsible to a 53 px rail and remembered per viewer (Plan.md 45).
 * Their own refs: `inspectorOpen` above belongs to the sheet and the tablet's column, which open by themselves.
 */
const DESKTOP_SLIDES_KEY = 'infoscreen-designer:desktop-slides-open';
const DESKTOP_INSPECTOR_KEY = 'infoscreen-designer:desktop-inspector-open';
function storedOpen(key: string): boolean {
    try {
        return window.localStorage.getItem(key) !== '0';
    } catch {
        return true;
    }
}
function rememberOpen(key: string, open: boolean): void {
    try {
        window.localStorage.setItem(key, open ? '1' : '0');
    } catch {
        // Private window or blocked storage: it just opens by default again next time.
    }
}
const desktopSlidesOpen = ref(storedOpen(DESKTOP_SLIDES_KEY));
const desktopInspectorOpen = ref(storedOpen(DESKTOP_INSPECTOR_KEY));
watch(desktopSlidesOpen, (open) => rememberOpen(DESKTOP_SLIDES_KEY, open));
watch(desktopInspectorOpen, (open) => rememberOpen(DESKTOP_INSPECTOR_KEY, open));

/** Over 75rem – the same line CSS draws; reactive, because the buttons act on other state there. */
const desktopQuery = window.matchMedia('(min-width: 75.0625rem)');
const desktop = ref(desktopQuery.matches);
function onDesktopChange(event: MediaQueryListEvent): void {
    desktop.value = event.matches;
}
desktopQuery.addEventListener('change', onDesktopChange);
onBeforeUnmount(() => desktopQuery.removeEventListener('change', onDesktopChange));

/** Whether the column stands open: the desktop's remembered state, else the sheet's (a tablet lying down). */
const inspectorColumnOpen = computed(() => (desktop.value ? desktopInspectorOpen.value : inspectorOpen.value));
const slidesExpanded = computed(() => (desktop.value ? desktopSlidesOpen.value : slidesDrawerOpen.value));
function toggleSlides(): void {
    if (desktop.value) desktopSlidesOpen.value = !desktopSlidesOpen.value;
    else slidesDrawerOpen.value = !slidesDrawerOpen.value;
}
/** The "<" in the slides' head: folds the column at a desktop width, else closes the drawer and hands the focus back. */
function collapseSlides(): void {
    if (desktop.value) {
        desktopSlidesOpen.value = false;
        return;
    }
    slidesDrawerOpen.value = false;
    void nextTick(() => document.querySelector<HTMLElement>('[data-testid="tablet-slides-toggle"]')?.focus());
}
function toggleInspectorColumn(): void {
    if (desktop.value) desktopInspectorOpen.value = !desktopInspectorOpen.value;
    else inspectorOpen.value = !inspectorOpen.value;
}
const slideNumber = computed(() => editor.slides.findIndex((s) => s.id === editor.slide?.id) + 1);

/**
 * Whether a pointer is currently down anywhere in the window – needed to
 * delay opening the sheet while a drag is under way (see the watcher below).
 * Captured, not bubbled: `EditorStage.vue`'s own `pointerdown` handler calls
 * `stopPropagation()` to keep a drag from also reaching its ancestors, which
 * would otherwise stop a plain bubble-phase listener here from ever firing.
 */
const pointerDown = ref(false);
function onPointerDown(): void {
    pointerDown.value = true;
}
/** Opens the sheet once a pointer that was down while a block got chosen lifts again (see below). */
let openSheetOnPointerUp = false;
function onPointerUpOrCancel(): void {
    pointerDown.value = false;
    if (openSheetOnPointerUp) {
        openSheetOnPointerUp = false;
        inspectorOpen.value = true;
    }
}

watch(
    () => editor.selectedBlockId,
    (id) => {
        if (id === null) return; // deselecting does not close it again
        // A finger still down means this selection may be the start of a drag: below 48rem,
        // opening the sheet right now hides the slides and the block bar and moves the stage
        // up into the space they leave – right under the finger that is dragging it (second
        // phone test, Plan.md 44). So it waits for that finger to lift.
        if (pointerDown.value) {
            openSheetOnPointerUp = true;
            return;
        }
        inspectorOpen.value = true;
    },
);
// However the sheet opens – a chosen block or a tap on its bar – the whole slide goes above it.
watch(inspectorOpen, (open) => {
    if (open) void nextTick(showStageAboveSheet);
    else stageMax.value = null;
});

/**
 * The open sheet covers at most the lower half of a phone, and it scrolls
 * itself – so the whole slide belongs in the upper half, always (third phone
 * test, Plan.md 44). The slides and the block bar are hidden then; the stage
 * shrinks to what is left above the sheet and the page scrolls it into view:
 * from the top of the page when the bars above leave room (Speichern stays in
 * sight), else to 64 px below the window's top edge, where ChurchTools' own
 * bar may sit.
 */
const stageMax = ref<number | null>(null);
const STAGE_GAP = 8;
function showStageAboveSheet(): void {
    if (!inspectorOpen.value || !window.matchMedia('(max-width: 48rem)').matches) return;
    const stage = root.value?.querySelector<HTMLElement>('.editor-stage');
    if (!stage) return;
    const half = window.innerHeight / 2;
    const pageTop = stage.getBoundingClientRect().top + window.scrollY;
    const fromPageTop = pageTop <= half * 0.6;
    const top = fromPageTop ? pageTop : 64;
    stageMax.value = Math.max(120, Math.floor(half - top - STAGE_GAP));
    window.scrollTo({ top: fromPageTop ? 0 : pageTop - top, behavior: 'smooth' });
}
/** Turning the phone or resizing the window changes both halves. */
function onResize(): void {
    if (inspectorOpen.value) showStageAboveSheet();
}

/** The name the sheet's bar and the "…" menu don't have room for otherwise. */
const sheetLabel = computed(() => {
    if (editor.block) return t.editor.blockNamed(BLOCK_LABELS[editor.block.type]);
    return editor.slide?.name ? t.editor.slideNamed(editor.slide.name) : t.editor.slide;
});

/** The drawer's head says where you are, whatever is chosen; the name and the block have their own heads below (Plan.md 48). */
const drawerTitle = computed(() => {
    const index = editor.slide ? editor.slides.indexOf(editor.slide) : -1;
    return index < 0 ? t.editor.slide : t.editor.slideOf(index + 1, editor.slides.length);
});

/** The "…" menu below 48rem, after the one on a screen tile (Plan.md 44, M2). */
const moreMenuOpen = ref(false);
const moreMenuRoot = ref<HTMLElement | null>(null);
function closeMoreMenuOnOutside(event: Event): void {
    if (!moreMenuRoot.value?.contains(event.target as Node)) moreMenuOpen.value = false;
}
watch(moreMenuOpen, (open) => {
    if (open) document.addEventListener('pointerdown', closeMoreMenuOnOutside);
    else document.removeEventListener('pointerdown', closeMoreMenuOnOutside);
});
function openPreviewFromMenu(): void {
    moreMenuOpen.value = false;
    previewing.value = true;
}

/** The overview of the handles behind the "?" (Plan.md 79, B3). */
const shortcutsOpen = ref(false);

/** Which picker the media library was opened for. */
const libraryFor = ref<'block' | 'background' | 'logo' | 'slideshow' | 'video' | null>(null);
const libraryTarget = ref<string | null>(null);

function openLibrary(kind: 'block' | 'background' | 'logo' | 'slideshow' | 'video'): void {
    libraryTarget.value = kind === 'background' ? null : (editor.block?.id ?? null);
    libraryFor.value = kind;
}

async function chosen(media: MediaDoc): Promise<void> {
    await editor.refreshMedia();
    if ((libraryFor.value === 'block' || libraryFor.value === 'video') && libraryTarget.value) {
        editor.updateBlock(libraryTarget.value, { mediaId: media.id });
    } else if (libraryFor.value === 'logo' && libraryTarget.value) {
        editor.updateBlock(libraryTarget.value, { logoMediaId: media.id });
    } else if (libraryFor.value === 'background') {
        editor.updateSlide({ background: { kind: 'media', mediaId: media.id } });
    }
    libraryFor.value = null;
}

/** Slideshow: the new pictures join at the end, without those already in, up to the limit – one undo step. */
async function chosenMany(docs: MediaDoc[]): Promise<void> {
    await editor.refreshMedia();
    const target = editor.block;
    if (libraryFor.value === 'slideshow' && target?.type === 'slideshow' && target.id === libraryTarget.value) {
        const have = new Set(target.mediaIds);
        const added = docs.map((d) => d.id).filter((id) => !have.has(id));
        editor.updateBlock(target.id, { mediaIds: [...target.mediaIds, ...new Set(added)].slice(0, 30) });
    }
    libraryFor.value = null;
}

const currentMediaId = computed(() => {
    if (libraryFor.value === 'block' && editor.block?.type === 'image') return editor.block.mediaId;
    if (libraryFor.value === 'video' && editor.block?.type === 'video') return editor.block.mediaId;
    if (libraryFor.value === 'logo' && editor.block?.type === 'church-header') return editor.block.logoMediaId;
    const bg = editor.slide?.background;
    return bg?.kind === 'media' ? bg.mediaId : undefined;
});

const statusText = computed(() => {
    switch (editor.status) {
        case 'saving':
            return t.editor.status.saving;
        case 'saved':
            return t.editor.status.saved;
        case 'conflict':
            return t.editor.status.conflict;
        case 'error':
            return t.editor.status.error;
        default:
            return editor.dirty ? t.editor.status.unsaved : t.editor.status.allSaved;
    }
});

/** After a save that wrote linked slides (Plan.md 49): which, and where else they now look the same. */
const linkedNotice = computed(() => {
    const saved = editor.linkedSaved;
    if (!saved.length) return '';
    const quote = (names: string[]) => names.map((n) => `„${n}"`).join(', ');
    if (saved.length === 1) {
        return t.editor.linkedSavedOne(quote([saved[0]!.name]), quote(saved[0]!.playlists));
    }
    const playlists = [...new Set(saved.flatMap((s) => s.playlists))];
    return t.editor.linkedSavedMany(saved.length, quote(playlists));
});
const LINKED_NOTICE_MS = 8000;
let linkedNoticeTimer: ReturnType<typeof setTimeout> | undefined;
watch(linkedNotice, (text) => {
    clearTimeout(linkedNoticeTimer);
    if (text) linkedNoticeTimer = setTimeout(() => (editor.linkedSaved = []), LINKED_NOTICE_MS);
});

/** Where, by whom and when a linked slide was saved in between (Plan.md 49) – as much as is known. */
const slideConflictText = computed(() => {
    const c = editor.slideConflict;
    if (!c) return '';
    const when = c.updatedAt ? new Date(c.updatedAt).toLocaleString(LOCALE) : null;
    return t.editor.slideConflict.text(c.slide.name, c.playlist, c.updatedBy ?? null, when);
});

onMounted(async () => {
    top.value = root.value?.getBoundingClientRect().top ?? 0;
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('beforeunload', onBeforeUnload);
    // Capture phase (see the comment on `pointerDown` above): it must run before a block's own
    // `pointerdown` handler can stop the event from bubbling any further.
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUpOrCancel, true);
    window.addEventListener('pointercancel', onPointerUpOrCancel, true);
    let loadSettings: (() => Promise<SettingsDoc | null>) | null = null;
    try {
        const [handle, person] = await Promise.all([getRepository(), currentPerson()]);
        loadSettings = () => handle.repository.loadSettings();
        author.value = displayName(person);
        demo.value = handle.demo;
        editor.attach(handle.repository);
        repository.value = handle.repository;
        await editor.open(playlistId);
        void refreshHeartbeats();
        await editor.refreshMedia();
    } catch (e) {
        loadError.value = e instanceof Error ? e.message : String(e);
    }
    // After the playlist itself: a slower or failed groups fetch must not delay the editor.
    try {
        groups.value = await fetchPostGroups();
    } catch {
        groups.value = [];
    }
    try {
        homepages.value = await fetchGroupHomepageList(instanceBaseUrl());
    } catch {
        homepages.value = [];
    }
    try {
        rooms.value = roomsOf(await fetchResourceMasterdata());
    } catch {
        rooms.value = [];
    }
    try {
        allowedServices.value = ((await loadSettings?.()) ?? null)?.allowedServiceIds ?? [];
    } catch {
        allowedServices.value = [];
    }
    try {
        const [list, serviceGroups] = await Promise.all([fetchServices(), fetchServiceGroups()]);
        services.value = serviceChoices(list, serviceGroups);
    } catch {
        services.value = [];
        servicesFailed.value = true;
    }
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('beforeunload', onBeforeUnload);
    window.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('pointerup', onPointerUpOrCancel, true);
    window.removeEventListener('pointercancel', onPointerUpOrCancel, true);
    document.removeEventListener('pointerdown', closeMoreMenuOnOutside);
});

onBeforeRouteLeave(
    async () => !editor.dirty || (await confirm({ message: t.editor.discardChanges, confirmLabel: t.common.discard, danger: true })),
);

function onBeforeUnload(event: BeforeUnloadEvent): void {
    if (editor.dirty) event.preventDefault();
}

function save(): void {
    if (editor.draft && editor.status !== 'saving') void editor.save(author.value);
}

function onKey(event: KeyboardEvent): void {
    // The "…" menu blocks other keys while open, like the dialogs below: only Escape does anything.
    if (moreMenuOpen.value) {
        if (event.key === 'Escape') moreMenuOpen.value = false;
        return;
    }
    // With a dialog open, keys belong to the dialog – Delete must not hit the block behind it.
    if (shortcutsOpen.value) {
        if (event.key === 'Escape') shortcutsOpen.value = false;
        return;
    }
    if (libraryFor.value) {
        if (event.key === 'Escape') libraryFor.value = null;
        return;
    }
    if (previewing.value) return; // the preview has its own keys
    const mod = event.metaKey || event.ctrlKey;
    const target = event.target as HTMLElement | null;
    const typing = target?.closest('input, textarea, select');
    // A switch, a segment or a tile (Plan.md 79, B2) takes no text: after a click on one, the shortcuts
    // with Ctrl/⌘ still reach the editor – undo right after a choice must work. Arrows and Delete stay
    // with the field: they move between the choices of a segment.
    const choosing = !!typing && target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'radio');
    if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        save();
        return;
    }
    if (typing && !(choosing && mod)) return;
    if (event.key === '?' && !mod) {
        event.preventDefault();
        shortcutsOpen.value = true;
    } else if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
    } else if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        editor.redo();
    } else if (mod && !editor.blockSheetOpen && 'cxvd'.includes(event.key.toLowerCase()) && event.key.length === 1) {
        // Copy, cut, paste, duplicate (Plan.md 79, A5); D would otherwise set a bookmark.
        const key = event.key.toLowerCase();
        if (key === 'v') {
            if (!editor.clipboard.length) return;
            event.preventDefault();
            editor.pasteBlocks();
        } else if (editor.block) {
            // Text marked on the page (a hint, a name) is copied as text, as anywhere else.
            if ((key === 'c' || key === 'x') && window.getSelection()?.toString()) return;
            event.preventDefault();
            if (key === 'c') editor.copyBlock(editor.block.id);
            else if (key === 'x') editor.cutBlock(editor.block.id);
            else editor.duplicateBlock(editor.block.id);
        }
    } else if (editor.block && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        editor.removeBlock(editor.block.id);
    } else if (event.key === 'Escape') {
        editor.selectBlock(null);
        inspectorOpen.value = false;
    } else if (editor.block && event.key.startsWith('Arrow')) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = { ArrowLeft: -step, ArrowRight: step }[event.key] ?? 0;
        const dy = { ArrowUp: -step, ArrowDown: step }[event.key] ?? 0;
        editor.updateBlock(editor.block.id, { x: editor.block.x + dx, y: editor.block.y + dy });
    }
}

</script>

<template>
    <div
        ref="root"
        class="infoscreen-designer editor"
        :class="{ 'sheet-open': inspectorOpen }"
        :style="{
            height: `calc(100vh - ${top}px)`,
            '--stage-aspect': `${editor.stage.width} / ${editor.stage.height}`,
            '--stage-max': stageMax === null ? undefined : `${stageMax}px`,
        }"
    >
        <AppBar>
            <RouterLink
                class="link-btn back"
                :to="back.to"
                :title="t.editor.leaveTitle(back.label)"
                :aria-label="t.editor.backAria(back.label)"
                data-testid="leave-editor"
            >
                <Icon name="back" :size="18" /><span class="back-label">{{ back.label }}</span>
            </RouterLink>
            <span class="heading">
                <strong class="title">{{ editor.draft?.playlist.name || t.editor.playlistFallback }}</strong>
                <span class="status-line">
                    <LiveFlag
                        v-if="live.length"
                        class="live"
                        :live="live"
                        :time-zone="context.timeZone"
                        data-testid="editor-live"
                    />
                    <span class="status" :class="`status--${editor.status}`" data-testid="save-status">{{ statusText }}</span>
                    <!-- The TVs check every 20 s for what was saved (Plan.md, 26); in demo mode an open player takes it at once. -->
                    <span
                        v-if="editor.status === 'saved' && editor.screens.length && !demo"
                        class="status status-hint"
                        data-testid="save-hint"
                    >
                        {{ t.editor.savedHint(editor.screens.length) }}
                    </span>
                </span>
            </span>
            <template #actions>
                <button
                    v-tip="withKeys(t.editor.undo, KEYS.undo)"
                    class="d-btn d-btn--icon d-btn--ghost"
                    type="button"
                    :aria-label="t.editor.undo"
                    :disabled="!editor.canUndo"
                    @click="editor.undo()"
                >
                    <Icon name="undo" />
                </button>
                <button
                    v-tip="withKeys(t.editor.redo, KEYS.redo)"
                    class="d-btn d-btn--icon d-btn--ghost"
                    type="button"
                    :aria-label="t.editor.redo"
                    :disabled="!editor.canRedo"
                    @click="editor.redo()"
                >
                    <Icon name="redo" />
                </button>
                <button
                    class="d-btn preview-btn"
                    type="button"
                    :title="t.editor.previewTitle"
                    data-testid="open-preview"
                    :disabled="!editor.slides.length"
                    @click="previewing = true"
                >
                    <Icon name="eye" :size="16" /> {{ t.editor.preview }}
                </button>
                <!-- The player shows screens, not playlists: offer the screens this playlist runs on. -->
                <RouterLink
                    v-for="s in editor.screens.slice(0, 1)"
                    :key="s.id"
                    class="link-btn player-link"
                    :to="{ name: 'player', query: { screen: s.slug } }"
                    target="_blank"
                    :title="t.editor.playerTitle(s.name)"
                    data-testid="open-player"
                >
                    <Icon name="play" :size="16" /> {{ t.editor.player }}<span v-if="editor.screens.length > 1" class="muted">: {{ s.name }}</span>
                </RouterLink>
                <button
                    v-tip="withKeys(t.shortcuts.button, KEYS.help)"
                    class="d-btn d-btn--icon shortcuts-btn"
                    type="button"
                    :aria-label="t.shortcuts.button"
                    data-testid="shortcuts"
                    @click="shortcutsOpen = true"
                >
                    ?
                </button>
                <!-- Below 48rem "Vorschau" and "Player" move in here – Rückgängig/Wiederholen and Speichern stay outside (Plan.md 44, M2). -->
                <div ref="moreMenuRoot" class="more-menu">
                    <button
                        class="d-btn d-btn--icon"
                        type="button"
                        :aria-label="t.editor.moreActions"
                        aria-haspopup="menu"
                        :aria-expanded="moreMenuOpen"
                        data-testid="editor-more"
                        @click="moreMenuOpen = !moreMenuOpen"
                    >
                        <Icon name="more" />
                    </button>
                    <div v-if="moreMenuOpen" class="more-menu-list" role="menu">
                        <button
                            role="menuitem"
                            type="button"
                            data-testid="more-preview"
                            :disabled="!editor.slides.length"
                            @click="openPreviewFromMenu"
                        >
                            <Icon name="eye" :size="16" /> {{ t.editor.preview }}
                        </button>
                        <RouterLink
                            v-for="s in editor.screens.slice(0, 1)"
                            :key="s.id"
                            role="menuitem"
                            :to="{ name: 'player', query: { screen: s.slug } }"
                            target="_blank"
                            data-testid="more-player"
                            @click="moreMenuOpen = false"
                        >
                            <Icon name="play" :size="16" /> {{ t.editor.player }}
                        </RouterLink>
                    </div>
                </div>
                <button
                    class="d-btn d-btn--primary"
                    type="button"
                    data-testid="save"
                    :title="withKeys(live.length ? liveSaveTitle(live) : t.common.save, KEYS.save)"
                    :disabled="!editor.dirty || editor.status === 'saving'"
                    @click="save"
                >
                    {{ t.common.save }}
                </button>
            </template>
        </AppBar>

        <p v-if="demo" class="d-banner d-banner--warning banner" data-testid="demo-notice-editor">
            {{ t.editor.demoNotice }}
        </p>
        <p v-if="editor.error" class="d-banner d-banner--error banner" role="alert">{{ editor.error }}</p>
        <p v-if="problem" class="d-banner d-banner--error banner" role="alert">{{ t.editor.previewData(problem) }}</p>

        <p v-if="loadError" class="d-banner d-banner--error banner" role="alert">{{ loadError }}</p>
        <div
            v-else-if="editor.draft"
            class="columns"
            :class="{ 'slides-folded': desktop && !desktopSlidesOpen, 'inspector-folded': !inspectorColumnOpen }"
        >
            <!-- Between 48rem and 75rem the slides are a drawer over the stage; over 75rem a column. A 53 px rail each stands in for a shut one (Plan.md 45). -->
            <div class="tablet-rail tablet-rail--slides">
                <div class="rail-head">
                    <button
                        type="button"
                        class="tablet-toggle"
                        :aria-expanded="slidesExpanded"
                        aria-controls="slide-list-ol"
                        :aria-label="t.editor.slidesToggle(slideNumber)"
                        data-testid="tablet-slides-toggle"
                        @click="toggleSlides"
                    >
                        <Icon name="slides" :size="16" />
                        <span class="tablet-number">{{ slideNumber }}</span>
                    </button>
                </div>
            </div>
            <SlideList :class="{ 'drawer-open': slidesDrawerOpen }" @click="closeSlidesDrawerOnPick" @collapse="collapseSlides" />
            <div class="stage-column">
                <BlockPalette />
                <!-- Floats over the middle of the stage instead of pushing it down; goes by itself (Plan.md 49). -->
                <div v-if="linkedNotice" class="d-banner linked-notice" role="status" data-testid="linked-save-notice">
                    <Icon name="link" :size="16" />
                    <span>{{ linkedNotice }}</span>
                    <button class="d-btn d-btn--icon" type="button" :aria-label="t.editor.closeNotice" @click="editor.linkedSaved = []">
                        <Icon name="close" :size="16" />
                    </button>
                </div>
                <EditorStage />
            </div>
            <!-- Below 48rem and upright above it this becomes a sheet at the bottom; otherwise a column beside the stage (Plan.md 44, M4; 45). -->
            <div class="tablet-rail tablet-rail--inspector">
                <div class="rail-head">
                    <button
                        v-tip="sheetLabel"
                        type="button"
                        class="tablet-toggle"
                        :aria-expanded="inspectorColumnOpen"
                        aria-controls="inspector-panel"
                        :aria-label="sheetLabel"
                        data-testid="tablet-inspector-toggle"
                        @click="toggleInspectorColumn"
                    >
                        <Icon name="settings" :size="20" />
                    </button>
                </div>
            </div>
            <div class="inspector-sheet" :class="{ open: inspectorOpen }" data-testid="inspector-sheet">
                <div class="drawer-head">
                    <strong class="drawer-title" data-testid="inspector-drawer-title">{{ drawerTitle }}</strong>
                    <button
                        v-tip="t.editor.collapse"
                        type="button"
                        class="d-btn d-btn--icon"
                        :aria-label="t.editor.collapse"
                        :data-testid="desktop ? 'desktop-inspector-collapse' : 'tablet-inspector-close'"
                        @click="toggleInspectorColumn"
                    >
                        <Icon name="chevron-down" :size="16" class="collapse-icon" />
                    </button>
                </div>
                <button
                    type="button"
                    class="sheet-bar"
                    :aria-expanded="inspectorOpen"
                    aria-controls="inspector-panel"
                    data-testid="inspector-sheet-toggle"
                    @click="inspectorOpen = !inspectorOpen"
                >
                    <span class="sheet-label">{{ sheetLabel }}</span>
                    <Icon name="chevron-down" :size="16" :class="['sheet-chevron', { open: inspectorOpen }]" />
                </button>
                <Inspector id="inspector-panel" :calendars="calendars" :hidden-calendars="hiddenCalendars" :groups="groups" :homepages="homepages" :rooms="rooms" :services="services" :allowed-services="allowedServices" :services-failed="servicesFailed" @pick-image="openLibrary" />
            </div>
        </div>

        <PlaylistPreview
            v-if="previewing && editor.draft"
            :slides="editor.slides"
            :stage="editor.stage"
            :banner="editor.draft.playlist.banner"
            :start-slide-id="editor.slide?.id"
            @close="previewing = false"
        />

        <ShortcutsDialog v-if="shortcutsOpen" @close="shortcutsOpen = false" />

        <MediaLibraryDialog
            v-if="libraryFor && editor.draft"
            :screen="MEDIA_PAGE"
            :selected-media-id="currentMediaId"
            :multiple="libraryFor === 'slideshow'"
            :kind="libraryFor === 'video' ? 'video' : 'image'"
            :max="editor.block?.type === 'slideshow' ? 30 - editor.block.mediaIds.length : undefined"
            @choose="chosen"
            @choose-many="chosenMany"
            @close="libraryFor = null"
        />

        <div v-if="editor.status === 'conflict' && editor.slideConflict" class="d-dialog-backdrop" role="dialog" aria-modal="true">
            <div class="d-dialog" data-testid="slide-conflict-dialog">
                <h2>{{ t.editor.slideConflict.title }}</h2>
                <p>{{ slideConflictText }}</p>
                <div class="d-dialog-actions">
                    <button class="d-btn d-btn--primary" type="button" data-testid="slide-conflict-reload" @click="editor.discardAndReload()">
                        {{ t.editor.slideConflict.reload }}
                    </button>
                    <button class="d-btn" type="button" data-testid="slide-conflict-keep" @click="editor.keepAsCopy(author)">
                        {{ t.editor.slideConflict.keepCopy }}
                    </button>
                </div>
            </div>
        </div>

        <div v-if="editor.status === 'conflict' && editor.conflict" class="d-dialog-backdrop" role="dialog" aria-modal="true">
            <div class="d-dialog" data-testid="conflict-dialog">
                <h2>{{ t.editor.conflict.title }}</h2>
                <p>
                    {{
                        t.editor.conflict.text(
                            editor.conflict.updatedBy ?? null,
                            editor.conflict.name,
                            editor.conflict.updatedAt ? new Date(editor.conflict.updatedAt).toLocaleString(LOCALE) : null,
                        )
                    }}
                </p>
                <p>{{ t.editor.conflict.question }}</p>
                <div class="d-dialog-actions">
                    <button class="d-btn" type="button" @click="editor.discardAndReload()">{{ t.editor.conflict.loadOther }}</button>
                    <button class="d-btn d-btn--primary" type="button" @click="editor.overwrite(author)">
                        {{ t.editor.conflict.keepMine }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.editor {
    /*
     * One height for the heads of the three columns above 48rem (slides, "+ Baustein", inspector) and
     * the rail buttons' zone, so their tops and bottoms meet: 8 px air, a 36 px button, 8 px air, and the
     * 1 px that the cards no longer draw as a rule.
     */
    --editor-head-h: 53px;
    display: flex;
    flex-direction: column;
    min-height: 480px;
    /* The calm ground the cards and the stage lie on (Plan.md 79, B3). */
    background: var(--d-workspace);
}
/* A link that looks like a button: the way back and the player. */
.link-btn {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: var(--d-space-2);
    box-sizing: border-box;
    min-height: var(--d-control-h);
    padding: 0 var(--d-space-4);
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    color: var(--d-text);
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    transition: background-color var(--d-transition), border-color var(--d-transition);
}
.link-btn:hover {
    border-color: var(--d-interactive);
    background: var(--d-panel);
}
/* Quiet, with the arrow: it is not what you came for. */
.back {
    padding: 0 var(--d-space-3) 0 var(--d-space-2);
    border-color: transparent;
    background: transparent;
}
.back:hover {
    border-color: transparent;
    background: var(--d-surface);
}
/* Title above, the state of the save below it, small. */
.heading {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.25;
}
.title {
    overflow: hidden;
    font-size: 1.2em;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.status-line {
    display: flex;
    align-items: center;
    gap: var(--d-space-2);
    min-width: 0;
}
.preview-btn {
    gap: var(--d-space-2);
}
.status {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    white-space: nowrap;
}
.status--conflict,
.status--error {
    color: var(--d-danger);
}
.status--saved {
    color: var(--d-success);
}
.linked-notice {
    position: absolute;
    bottom: 16px;
    left: 50%;
    /* Above the stage and its handles. */
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 8px;
    width: max-content;
    max-width: calc(100% - 32px);
    transform: translateX(-50%);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
    font-size: var(--d-size-sm);
}
.linked-notice > span {
    min-width: 0;
    overflow-wrap: anywhere;
}
.linked-notice .d-icon {
    flex: none;
}
.banner {
    margin: 0 var(--d-space-3) var(--d-space-3);
    font-size: var(--d-size-sm);
}
.stage-column {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
}
.stage-column > :last-child {
    flex: 1;
}
.columns {
    /* The widths of the two side columns; a collapsed one is a 53 px rail (Plan.md 45). */
    --slides-w: 220px;
    --inspector-w: 300px;
    flex: 1;
    display: grid;
    grid-template-columns: var(--slides-w) minmax(0, 1fr) var(--inspector-w);
    /* Cards and stage lie on the workspace with 12 px of air all around (Plan.md 79, B3). */
    column-gap: var(--d-space-3);
    padding: 0 var(--d-space-3) var(--d-space-3);
    min-height: 0;
}
/* The stage a little in from the cards, so its shadow has room. */
.stage-column > :last-child {
    margin: 0 var(--d-space-2) var(--d-space-2);
}

/* Rails and the drawer's head belong to the range above 48rem (Plan.md 45); hidden below. */
.tablet-rail,
.drawer-head {
    display: none;
}

/* The "…" menu (Plan.md 44, M2), after the one of a screen tile – only shown below 48rem. */
.more-menu {
    position: relative;
    display: none;
}
.more-menu-list {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 10;
    display: grid;
    min-width: 170px;
    padding: 4px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow);
}
.more-menu-list a,
.more-menu-list button {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    padding: 6px 10px;
    border: 0;
    border-radius: var(--d-radius);
    background: none;
    color: var(--d-text);
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
}
.more-menu-list a:hover,
.more-menu-list button:hover {
    background: var(--d-panel);
}
.more-menu-list button:disabled {
    opacity: 0.5;
    cursor: default;
}

/* The inspector as a sheet at the bottom of a phone (Plan.md 44, M4); untouched above 48rem. */
.inspector-sheet {
    display: contents;
}
.sheet-bar {
    display: none;
}

/*
 * The sheet at the bottom: on a phone, and on a tablet standing upright – there the stage is wide
 * and the slide sits at the top, so the sheet finds room below it (Plan.md 44, M4; 45). Lying down
 * a tablet has the inspector as a column beside the stage instead.
 */
@media (max-width: 48rem), (min-width: 48.0625rem) and (max-width: 75rem) and (orientation: portrait) {
    .editor {
        padding-bottom: calc(56px + env(safe-area-inset-bottom));
    }

    /* Sheet: a 56 px bar, and the inspector itself only while open. */
    .inspector-sheet {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        border-top: 1px solid var(--d-divider);
        border-radius: var(--d-radius-lg) var(--d-radius-lg) 0 0;
        background: var(--d-surface);
        box-shadow: var(--d-shadow);
        padding-bottom: env(safe-area-inset-bottom);
    }
    .sheet-bar {
        display: flex;
        flex: none;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        height: 56px;
        padding: 0 16px;
        border: 0;
        background: none;
        color: var(--d-text);
        font: inherit;
        font-weight: 700;
        text-align: left;
        cursor: pointer;
    }
    .sheet-label {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .sheet-chevron {
        flex: none;
        /* Closed points up – tap to open upward; open points down – tap to close (Plan.md 44, M4). */
        transform: rotate(180deg);
        transition: transform 0.15s;
    }
    .sheet-chevron.open {
        transform: rotate(0deg);
    }
    .inspector-sheet:not(.open) :deep(.inspector) {
        display: none;
    }
    .inspector-sheet.open {
        max-height: 50vh;
        max-height: 50dvh;
    }
    /* Room to scroll the stage above the open sheet. */
    .editor.sheet-open {
        padding-bottom: calc(50vh + env(safe-area-inset-bottom));
        padding-bottom: calc(50dvh + env(safe-area-inset-bottom));
    }
}

/*
 * Phone and narrow windows: one column – slides as a row to swipe, the
 * stage in its own aspect ratio; the inspector moved into its own sheet
 * at the bottom, and the header into one row (Plan.md 44, M2–M4).
 */
@media (max-width: 48rem) {
    .editor {
        height: auto !important;
        min-height: 0;
    }
    .columns {
        grid-template-columns: minmax(0, 1fr);
        column-gap: 0;
        padding: 0;
    }
    .banner {
        margin: 0 var(--d-space-2) var(--d-space-2);
    }
    .stage-column > :last-child {
        margin: 0 var(--d-space-3) var(--d-space-2);
        flex: none;
        height: auto;
        aspect-ratio: var(--stage-aspect);
        max-height: 70vh;
    }

    /* Header: back link loses its label, title and status stack, "…" replaces Vorschau/Player. */
    .editor :deep(.start) {
        min-width: 0;
    }
    .editor :deep(.end) {
        flex-wrap: nowrap;
    }
    .back-label {
        display: none;
    }
    /* Only the dot, so undo, redo and save keep their room (Plan.md 44, M2). */
    .live :deep(.live-text) {
        display: none;
    }
    .live {
        padding: 5px;
    }
    .shortcuts-btn {
        display: none;
    }
    .status {
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .status-hint {
        display: none;
    }
    .preview-btn,
    .player-link {
        display: none;
    }
    .more-menu {
        display: block;
    }

    /* The stage no taller than the room above the open sheet (showStageAboveSheet). */
    .editor.sheet-open .stage-column > :last-child {
        max-height: var(--stage-max, 40vh);
    }
    /*
     * While the sheet is open, only the stage stands above it – the slides and the block bar
     * are gone (second phone test, Plan.md 44): together with the sheet they left no room for
     * the stage at all, exactly while a block on it is being edited. `.slide-list` is a child
     * component's root, which carries this scope's attribute too (Vue's scoped CSS reaches a
     * child's root node), so no `:deep()` is needed here.
     */
    .editor.sheet-open .slide-list,
    .editor.sheet-open .block-palette {
        display: none;
    }
}

/*
 * Above 48rem (Plan.md 45): the stage takes the middle column, the slides and the inspector stand
 * beside it – or, folded, as a 53 px rail with one button. `.slide-list` and `.inspector` are
 * child roots and carry this scope's attribute.
 */
@media (min-width: 48.0625rem) {
    .stage-column {
        grid-column: 2;
        grid-row: 1;
    }
    .tablet-rail--slides {
        grid-column: 1;
        grid-row: 1;
    }
    .tablet-rail--inspector {
        grid-column: 3;
        grid-row: 1;
    }
    /* A shut column is a card of its own, 53 px wide, with the one button in the zone of the heads. */
    .tablet-rail {
        flex-direction: column;
        border-radius: var(--d-radius-lg);
        background: var(--d-surface);
        box-shadow: var(--d-shadow-card);
    }
    /* The button's zone is as tall as the heads beside it. */
    .rail-head {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        height: var(--editor-head-h);
    }
    .tablet-rail--slides {
        display: flex;
    }
    .tablet-toggle {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0;
        width: 36px;
        height: 36px;
        padding: 0;
        border: 1px solid var(--d-divider);
        border-radius: var(--d-radius);
        background: var(--d-surface);
        color: var(--d-text);
        font: inherit;
        cursor: pointer;
        transition: background-color var(--d-transition), border-color var(--d-transition);
    }
    .tablet-toggle:hover,
    .tablet-toggle[aria-expanded='true'] {
        border-color: var(--d-interactive);
        background: var(--d-accent-pale);
    }
    .tablet-number {
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
    }
    .collapse-icon {
        transform: rotate(-90deg);
    }
}

/*
 * Tablet, up to 75rem: the slides open as a drawer over the stage – absolute in `.columns`, so the
 * stage does not move. No backdrop: what lies beside a drawer stays usable.
 */
@media (min-width: 48.0625rem) and (max-width: 75rem) {
    .columns {
        position: relative;
        --slides-w: 53px;
    }
    /* Upright, the slide sits right under "+ Baustein" instead of in the middle of a tall column. */
    .stage-column > :last-child {
        margin-inline: 0;
        flex: 0 1 auto;
        height: auto;
        min-height: 0;
        aspect-ratio: var(--stage-aspect);
    }
    /* Beside the rail card: its 12 px of padding, the 53 px, and the 12 px gap. */
    .columns .slide-list {
        position: absolute;
        top: 0;
        bottom: var(--d-space-3);
        left: calc(53px + 2 * var(--d-space-3));
        z-index: 30;
        box-sizing: border-box;
        width: 240px;
        box-shadow: var(--d-shadow);
    }
    .slide-list:not(.drawer-open) {
        display: none;
    }
}

/* Tablet upright: the inspector is the sheet at the bottom, so there is no rail for it. */
@media (min-width: 48.0625rem) and (max-width: 75rem) and (orientation: portrait) {
    .columns {
        grid-template-columns: 53px minmax(0, 1fr);
    }
    /* A little lower than on a phone, so the slide's lower handles stay above the sheet (820 × 1180: slide ends at 597). */
    .inspector-sheet.open {
        max-height: 45vh;
        max-height: 45dvh;
    }
    .editor.sheet-open {
        padding-bottom: calc(45vh + env(safe-area-inset-bottom));
        padding-bottom: calc(45dvh + env(safe-area-inset-bottom));
    }
}

/*
 * The inspector as a column beside the stage: on a desktop, and on a tablet lying down. Open it
 * takes its width from the stage; folded it is a rail (Plan.md 45).
 */
@media (min-width: 75.0625rem), (min-width: 48.0625rem) and (orientation: landscape) {
    .columns {
        --inspector-w: 320px;
    }
    .columns.inspector-folded {
        --inspector-w: 53px;
    }
    .columns.inspector-folded .inspector-sheet {
        display: none;
    }
    .columns.inspector-folded .tablet-rail--inspector {
        display: flex;
    }
    .inspector-sheet {
        grid-column: 3;
        grid-row: 1;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
        border-radius: var(--d-radius-lg);
        background: var(--d-surface);
        box-shadow: var(--d-shadow-card);
    }
    .drawer-head {
        display: flex;
        flex: none;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        box-sizing: border-box;
        height: var(--editor-head-h);
        padding: 0 var(--d-space-3) 0 var(--d-space-4);
    }
    .drawer-title {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .inspector-sheet :deep(.inspector) {
        flex: 1;
        overflow-x: hidden;
    }
}

/* Desktop: both columns fold away, and stay so (remembered per viewer). */
@media (min-width: 75.0625rem) {
    .columns {
        --inspector-w: 300px;
    }
    .columns.inspector-folded {
        --inspector-w: 53px;
    }
    .columns.slides-folded {
        --slides-w: 53px;
    }
    .columns.slides-folded .slide-list,
    .columns:not(.slides-folded) .tablet-rail--slides {
        display: none;
    }
    .slide-list {
        grid-column: 1;
        grid-row: 1;
    }
}
</style>
