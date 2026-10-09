<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from '../i18n/designer';
import type { SlideDoc } from '../model/schema';
import { useStageContext } from '../player/context';
import { slideSeconds } from '../player/paging';
import SlideView from '../player/SlideView.vue';
import StageView from '../player/StageView.vue';
import { fitStage } from '../player/stage';
import { useEditorStore } from './editor-store';
import Icon from './Icon.vue';
import SlideImportDialog from './SlideImportDialog.vue';
import { useConfirm } from './useConfirm';

const { confirm } = useConfirm();

const emit = defineEmits<{ collapse: [] }>();
const editor = useEditorStore();
/** The preview's stage context: paged lists report their pages there (Plan.md, 23). */
const stage = useStageContext();
const THUMB_WIDTH = 176;
/**
 * On a phone the row is one line tall instead of a filmstrip beside the stage
 * (Plan.md 44). Shrunk again after the second phone test: 64 px still left
 * only three-and-a-bit tiles on screen at once (Plan.md 44).
 */
const THUMB_HEIGHT_PHONE = 36;
/** A touch target stays reachable even for a portrait screen's narrow thumbnail (Plan.md 44). */
const PHONE_TILE_MIN_WIDTH = 56;

/** How long the slide really runs: longer than set when a paged list needs the time. */
function runs(slide: SlideDoc): { seconds: number; longer: boolean } {
    const seconds = slideSeconds(slide, stage.pages ?? {});
    return { seconds, longer: seconds > slide.durationSeconds };
}

/** Reactive, unlike a CSS media query alone: the thumbnail's own size follows it in script. */
const phoneQuery = window.matchMedia('(max-width: 48rem)');
const phone = ref(phoneQuery.matches);
function onPhoneChange(event: MediaQueryListEvent): void {
    phone.value = event.matches;
}
phoneQuery.addEventListener('change', onPhoneChange);
onBeforeUnmount(() => phoneQuery.removeEventListener('change', onPhoneChange));

/**
 * The room the list really has. A scrollbar that takes space – a mouse on a Mac, most of Windows – narrows
 * it once the slides no longer fit, and a thumbnail of fixed width then stuck out of its tile's frame.
 * 0 while unknown or hidden; the thumbnail keeps its full width then.
 */
const list = ref<HTMLElement | null>(null);
const listWidth = ref(0);
/** What a tile takes beside its thumbnail: the list's padding, the tile's padding and border on both sides, and the column of the number. */
const NUMBER_COLUMN = 24;
const TILE_CHROME = 2 * (8 + 6 + 2) + NUMBER_COLUMN;
const THUMB_MIN_WIDTH = 96;
let listObserver: ResizeObserver | undefined;
onMounted(() => {
    if (!list.value || typeof ResizeObserver === 'undefined') return;
    listObserver = new ResizeObserver(() => (listWidth.value = list.value?.clientWidth ?? 0));
    listObserver.observe(list.value);
});
onBeforeUnmount(() => listObserver?.disconnect());

const thumb = computed(() => {
    if (phone.value) {
        const height = THUMB_HEIGHT_PHONE;
        const width = Math.round((height * editor.stage.width) / editor.stage.height);
        return { width, height, fit: fitStage({ width, height }, editor.stage) };
    }
    const room = listWidth.value > 0 ? Math.max(THUMB_MIN_WIDTH, listWidth.value - TILE_CHROME) : THUMB_WIDTH;
    const width = Math.min(THUMB_WIDTH, room);
    const height = Math.round((width * editor.stage.height) / editor.stage.width);
    return { width, height, fit: fitStage({ width, height }, editor.stage) };
});
/**
 * The tile is exactly as wide as its thumbnail on a phone – the name that
 * used to widen it is gone there (Plan.md 44, second phone test); only a
 * portrait thumbnail's narrow width still needs a floor to stay tappable.
 */
const tileWidth = computed(() => (phone.value ? Math.max(PHONE_TILE_MIN_WIDTH, thumb.value.width) : null));

/** Whether the row is open, kept per viewer; without storage it simply defaults to open (Plan.md 44). */
const OPEN_KEY = 'infoscreen-designer:slides-open';
function storedOpen(): boolean {
    try {
        return window.localStorage.getItem(OPEN_KEY) !== '0';
    } catch {
        return true;
    }
}
const open = ref(storedOpen());
function toggleOpen(): void {
    open.value = !open.value;
    try {
        window.localStorage.setItem(OPEN_KEY, open.value ? '1' : '0');
    } catch {
        // Private window or blocked storage: it just opens by default again next time.
    }
}

const selectedIndex = computed(() => editor.slides.findIndex((s) => s.id === editor.slide?.id) + 1);

const importing = ref(false);
const dragging = ref<number | null>(null);
const over = ref<number | null>(null);

function drop(index: number): void {
    if (dragging.value !== null) editor.moveSlide(dragging.value, index);
    dragging.value = null;
    over.value = null;
}

/** What the chain symbol says: the other playlists showing the slide (Plan.md 49). */
function linkedLabel(id: string): string {
    return t.editor.slideList.linkedWith(editor.linkedIn(id).map((p) => p.name).join(', '));
}

async function remove(id: string, name: string): Promise<void> {
    if (await confirm({ message: t.editor.slideList.confirmRemove(name), confirmLabel: t.common.remove, danger: true })) editor.removeSlide(id);
}

function removeCurrent(): void {
    if (editor.slide) remove(editor.slide.id, editor.slide.name);
}
</script>

<template>
    <aside class="slide-list">
        <header class="header-desktop">
            <span class="title">
                <strong>{{ t.editor.slideList.title }}</strong>
                <span class="count">{{ editor.slides.length }}</span>
            </span>
            <!-- Over 75rem the column folds into a rail, below it the drawer closes (Plan.md 45); the phone has its own header. -->
            <button
                type="button"
                class="d-btn d-btn--icon collapse-btn"
                :title="t.editor.slideList.collapse"
                :aria-label="t.editor.slideList.collapse"
                data-testid="slides-collapse"
                @click="emit('collapse')"
            >
                <Icon name="chevron-down" :size="16" class="collapse-icon" />
            </button>
        </header>
        <!-- Phone: a collapsible row instead of a header, with the current slide's actions beside it (Plan.md 44). -->
        <div class="header-phone">
            <button
                type="button"
                class="toggle"
                data-testid="slides-toggle"
                :aria-expanded="open"
                aria-controls="slide-list-ol"
                @click="toggleOpen"
            >
                <span class="toggle-label">
                    {{ t.editor.slideList.title }} <span class="count">{{ editor.slides.length }}</span>
                    <span v-if="!open && editor.slide" class="current" data-testid="slides-current">
                        · {{ selectedIndex }}. {{ editor.slide.name }}
                    </span>
                </span>
                <Icon name="chevron-down" :size="16" :class="['toggle-chevron', { open }]" />
            </button>
            <button
                class="d-btn d-btn--icon"
                type="button"
                :title="t.editor.slideList.duplicateSlide"
                :aria-label="t.editor.slideList.duplicateSlide"
                data-testid="slide-duplicate-phone"
                :disabled="!editor.slide"
                @click="editor.duplicateCurrentSlide()"
            >
                <Icon name="duplicate" :size="16" />
            </button>
            <button
                class="d-btn d-btn--icon"
                type="button"
                :title="t.editor.slideList.removeSlide"
                :aria-label="t.editor.slideList.removeSlide"
                data-testid="slide-remove-phone"
                :disabled="!editor.slide || editor.slides.length <= 1"
                @click="removeCurrent"
            >
                <Icon name="trash" :size="16" class="danger-icon" />
            </button>
        </div>
        <!-- Collapsed only on a phone: CSS, not v-show – a desktop-wide window always shows the slides. -->
        <ol id="slide-list-ol" ref="list" :class="{ collapsed: !open }">
            <li
                v-for="(slide, index) in editor.slides"
                :key="slide.id"
                :class="{
                    active: slide.id === editor.slide?.id,
                    disabled: !slide.enabled,
                    over: over === index && dragging !== index,
                }"
                :style="{ width: tileWidth ? `${tileWidth}px` : undefined }"
                :title="`${index + 1}. ${slide.name}`"
                :aria-label="`${index + 1}. ${slide.name}`"
                draggable="true"
                data-testid="slide-item"
                @click="editor.selectSlide(slide.id)"
                @dragstart="dragging = index"
                @dragover.prevent="over = index"
                @dragleave="over = null"
                @drop.prevent="drop(index)"
                @dragend="dragging = null; over = null"
            >
                <span class="num">{{ index + 1 }}</span>
                <div class="thumb" :style="{ width: `${thumb.width}px`, height: `${thumb.height}px` }">
                    <StageView :width="editor.stage.width" :height="editor.stage.height" :fit="thumb.fit">
                        <SlideView :slide="slide" :width="editor.stage.width" :height="editor.stage.height" />
                    </StageView>
                    <span
                        v-if="editor.linkedIn(slide.id).length"
                        class="linked-badge"
                        :title="linkedLabel(slide.id)"
                        :aria-label="linkedLabel(slide.id)"
                        data-testid="slide-linked-badge"
                    >
                        <Icon name="link" :size="12" />
                    </span>
                </div>
                <div class="meta">
                    <span class="name">{{ slide.name }}</span>
                    <!-- On a phone the name sits in the header and the sheet's bar already; here it would not fit next to the duration (Plan.md 44, second phone test). -->
                    <span class="index-num">{{ index + 1 }} ·</span>
                    <span
                        class="duration"
                        :class="{ longer: runs(slide).longer }"
                        :title="runs(slide).longer ? t.editor.slideList.runsLonger(slide.durationSeconds, runs(slide).seconds) : undefined"
                        data-testid="slide-duration"
                    >
                        <template v-if="runs(slide).longer">{{ slide.durationSeconds }} → </template>{{ runs(slide).seconds }} s{{ slide.enabled ? '' : t.editor.slideList.off }}
                    </span>
                </div>
                <div v-if="slide.id === editor.slide?.id" class="actions" @click.stop>
                    <button
                        class="d-btn d-btn--icon"
                        type="button"
                        :title="t.editor.slideList.duplicate"
                        :aria-label="t.editor.slideList.duplicate"
                        @click="editor.duplicateCurrentSlide()"
                    >
                        <Icon name="duplicate" :size="16" />
                    </button>
                    <button
                        class="d-btn d-btn--icon"
                        type="button"
                        :title="t.editor.slideList.remove"
                        :aria-label="t.editor.slideList.remove"
                        :disabled="editor.slides.length <= 1"
                        @click="remove(slide.id, slide.name)"
                    >
                        <Icon name="trash" :size="16" class="danger-icon" />
                    </button>
                </div>
            </li>
            <!--
                Where one looks for the next slide: below the last (Plan.md, Nächste Schritte 11). On a
                phone both tiles shrink to icon-only, image-sized squares beside the slides themselves
                instead of stacking full-width below them (Plan.md 44, second phone test) – the same two
                buttons, only restyled by the media query below, not duplicated.
            -->
            <li class="add-item">
                <button
                    class="add"
                    type="button"
                    :title="t.editor.slideList.newSlide"
                    :aria-label="t.editor.slideList.newSlide"
                    data-testid="add-slide"
                    :style="phone ? { width: `${tileWidth}px`, height: `${thumb.height}px` } : { minHeight: `${thumb.height}px` }"
                    @click="editor.addSlide()"
                >
                    <Icon name="plus" :size="22" />
                    <span class="add-label">{{ t.editor.slideList.newSlide }}</span>
                </button>
                <button
                    class="import"
                    type="button"
                    :title="t.editor.slideList.importTitle"
                    :aria-label="t.editor.slideList.importTitle"
                    data-testid="import-slides"
                    :style="phone ? { width: `${tileWidth}px`, height: `${thumb.height}px` } : undefined"
                    @click="importing = true"
                >
                    <Icon name="copy" :size="16" />
                    <span class="import-label">{{ t.editor.slideList.importLabel }}</span>
                </button>
            </li>
        </ol>
        <SlideImportDialog v-if="importing" @close="importing = false" />
    </aside>
</template>

<style scoped>
.slide-list {
    display: flex;
    flex-direction: column;
    min-height: 0;
    /* A card on the workspace (Plan.md 79, B3). */
    overflow: hidden;
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow-card);
}
.header-desktop {
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-sizing: border-box;
    flex: none;
    height: var(--editor-head-h);
    padding: 0 var(--d-space-3) 0 var(--d-space-4);
}
.title {
    display: flex;
    align-items: baseline;
    gap: 6px;
}
.collapse-icon {
    transform: rotate(90deg);
}
/* Phone: a collapsible row replaces the header (Plan.md 44); hidden at a desktop width. */
.header-phone {
    display: none;
}
ol {
    flex: 1;
    overflow-y: auto;
    /* The room of a scrollbar that takes space is kept free at all times – else a thumbnail made narrower for it
       would make the list shorter, the scrollbar go, and the thumbnail grow again. */
    scrollbar-gutter: stable;
    margin: 0;
    padding: 0 8px 8px;
    list-style: none;
}
/* The number left of the picture, the picture right of it; name and time below, the buttons of the chosen one last. */
li {
    display: grid;
    grid-template-columns: 16px minmax(0, 1fr);
    column-gap: 8px;
    padding: 6px;
    border: 2px solid transparent;
    border-radius: var(--d-radius-lg);
    cursor: pointer;
    transition: background-color var(--d-transition);
}
li > :not(.num) {
    grid-column: 2;
}
li + li {
    margin-top: 4px;
}
li:hover {
    background: var(--d-panel);
}
.num {
    padding-top: 2px;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    text-align: right;
}
li.active .num {
    color: var(--d-accent);
    font-weight: 700;
}
/* The chosen slide: a ring of 2 px in the accent around its picture. */
li.active .thumb {
    outline: 2px solid var(--d-accent);
    outline-offset: 1px;
}
.count {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
li.add-item {
    display: block;
    padding: 6px 8px 0 32px;
    border: 0;
    cursor: default;
}
li.add-item:hover {
    background: none;
}
.add {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 100%;
    border: 2px dashed var(--d-interactive);
    border-radius: var(--d-radius);
    background: none;
    color: var(--d-text-muted);
    font: inherit;
    cursor: pointer;
    transition: background-color var(--d-transition), border-color var(--d-transition);
}
.add:hover {
    border-color: var(--d-accent);
    background: var(--d-accent-pale);
    color: var(--d-accent-strong);
}
/* The smaller way to a new slide: copies from another playlist. */
.import {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    min-height: var(--d-control-h);
    margin-top: var(--d-space-2);
    padding: 6px;
    border: 0;
    border-radius: var(--d-radius);
    background: none;
    color: var(--d-accent-strong);
    font: inherit;
    font-size: var(--d-size-sm);
    cursor: pointer;
}
.import:hover {
    background: var(--d-accent-pale);
}
li.over {
    border-style: dashed;
    border-color: var(--d-accent);
}
li.disabled .thumb {
    opacity: 0.4;
}
.thumb {
    position: relative;
    overflow: hidden;
    border-radius: var(--d-radius);
    background: #000;
    pointer-events: none;
}
.linked-badge {
    position: absolute;
    right: 4px;
    bottom: 4px;
    display: flex;
    align-items: center;
    padding: 3px;
    border-radius: var(--d-radius);
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    pointer-events: auto;
}
.meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 6px;
    font-size: var(--d-size-sm);
}
.name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
/* Replaces `.name` on a phone, where the tile has no room left for it (Plan.md 44, second phone test). */
.index-num {
    display: none;
    color: var(--d-text-muted);
}
.duration.longer {
    color: var(--d-accent-strong);
}
.duration {
    color: var(--d-text-muted);
    white-space: nowrap;
}
.actions {
    display: flex;
    gap: 6px;
    margin-top: 6px;
}
.actions .d-btn {
    padding: 0.25em;
}
/* Red only on the wastebasket (Plan.md 47). */
.danger-icon {
    color: var(--d-danger);
}
/*
 * Phone: the slides become a row to swipe above the stage (Plan.md, 10), collapsible and
 * with smaller tiles, so it does not push the stage far down (Plan.md 44, feedback from the
 * phone after v0.2.9: the row alone took ~245 px).
 */
@media (max-width: 48rem) {
    .slide-list {
        overflow: visible;
        border-radius: 0;
        background: none;
        box-shadow: none;
    }
    .header-desktop {
        display: none;
    }
    .header-phone {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 44px;
        padding: 2px var(--d-space-3);
    }
    /* Same look as the page menu's own button (`ModuleSidebar.vue`) – a frame makes it obvious this collapses (Plan.md 44, second phone test). */
    .toggle {
        display: flex;
        flex: 1;
        min-width: 0;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 0 10px;
        border: 1px solid var(--d-divider);
        border-radius: var(--d-radius-lg);
        background: var(--d-surface);
        color: var(--d-text);
        font: inherit;
        font-weight: 700;
        text-align: left;
        cursor: pointer;
    }
    .toggle:hover {
        border-color: var(--d-interactive);
    }
    .toggle-label {
        overflow: hidden;
        min-width: 0;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .current {
        font-weight: 400;
        color: var(--d-text-muted);
    }
    .toggle-chevron {
        flex: none;
        transition: transform 0.15s;
    }
    .toggle-chevron.open {
        transform: rotate(180deg);
    }
    /*
     * No horizontal padding and no gap: at 390 px the three demo slides plus the two tiles
     * (78 px each, landscape) already fill the row exactly – any padding or gap would force
     * it to scroll (Plan.md 44, second phone test, „Ziel“).
     */
    ol {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        padding: 6px 8px;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-gutter: auto;
    }
    /*
     * `min-width: 104px` is gone: the tile is exactly as wide as its thumbnail now (`tileWidth`
     * in the script), padding and border are gone too, so nothing but the thumbnail itself
     * decides the outer width – a border would otherwise widen the box even with
     * `box-sizing: border-box`, because the thumbnail inside is not itself shrunk.
     */
    li {
        display: block;
        box-sizing: border-box;
        flex: none;
        padding: 0;
        border: 0;
    }
    .num {
        display: none;
    }
    li.active .thumb {
        outline: 0;
    }
    /* Outside the tile, into the gap: a frame inside would cover the small thumbnail. */
    li.active {
        outline: 2px solid var(--d-accent);
        outline-offset: 1px;
    }
    li.over {
        outline-style: dashed;
        outline-color: var(--d-accent);
    }
    /* The two tiles below sit side by side here instead of stacked full-width (Plan.md 44). */
    li.add-item {
        display: flex;
        box-sizing: border-box;
        flex: none;
        gap: 6px;
        padding: 0;
    }
    .thumb {
        /* Centres a portrait thumbnail, which is narrower than the tile's own minimum width. */
        margin: 0 auto;
    }
    .meta {
        justify-content: flex-start;
        gap: 2px;
        margin-top: 3px;
        overflow: hidden;
        white-space: nowrap;
    }
    .name {
        display: none;
    }
    .index-num {
        display: inline;
    }
    /* Icon only, no label underneath – the name is reachable via `title`/`aria-label` instead. */
    .add-label,
    .import-label {
        display: none;
    }
    .add {
        padding: 0;
    }
    .import {
        box-sizing: border-box;
        margin-top: 0;
        padding: 0;
        border: 2px dashed var(--d-interactive);
        border-radius: var(--d-radius);
    }
    .import:hover {
        border-color: var(--d-accent);
    }
    .actions {
        display: none;
    }
    li + li {
        margin-top: 0;
    }
    ol.collapsed {
        display: none;
    }
}
</style>
