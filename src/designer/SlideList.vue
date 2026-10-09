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
import { useSortable } from './useSortable';
import { vTip } from './tip';

const { confirm } = useConfirm();

/**
 * `sheet`: the list stands in the sheet of a phone (Plan.md 79, C2) – as a grid of two columns with bigger pictures,
 * without the buttons of the chosen one and without handles: the mouse takes the whole tile, a finger holds it, and `useSortable` sorts on the grid.
 */
const props = defineProps<{ sheet?: boolean }>();
const emit = defineEmits<{ collapse: [] }>();
const editor = useEditorStore();
/** The preview's stage context: paged lists report their pages there (Plan.md, 23). */
const stage = useStageContext();
const THUMB_WIDTH = 176;
/** How long the slide really runs: longer than set when a paged list needs the time. */
function runs(slide: SlideDoc): { seconds: number; longer: boolean } {
    const seconds = slideSeconds(slide, stage.pages ?? {});
    return { seconds, longer: seconds > slide.durationSeconds };
}

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
/** The sheet's grid: the list's side padding on both sides and the gap between the two columns. */
const SHEET_PADDING = 2 * 16;
const SHEET_GAP = 12;
let listObserver: ResizeObserver | undefined;
onMounted(() => {
    if (!list.value || typeof ResizeObserver === 'undefined') return;
    // Measured a frame later: the pictures follow the width, and their height resizes the list again within the same frame.
    listObserver = new ResizeObserver(() => requestAnimationFrame(() => (listWidth.value = list.value?.clientWidth ?? 0)));
    listObserver.observe(list.value);
});
onBeforeUnmount(() => listObserver?.disconnect());

const thumb = computed(() => {
    const room = listWidth.value > 0 ? Math.max(THUMB_MIN_WIDTH, listWidth.value - TILE_CHROME) : THUMB_WIDTH;
    const width = props.sheet
        ? Math.floor(((listWidth.value || 340) - SHEET_PADDING - SHEET_GAP) / 2)
        : Math.min(THUMB_WIDTH, room);
    const height = Math.round((width * editor.stage.height) / editor.stage.width);
    return { width, height, fit: fitStage({ width, height }, editor.stage) };
});

const importing = ref(false);

/** Dragging replaces the browser's own drag and drop, which a finger cannot use (Plan.md 79, D7): the handle for the mouse, a held tile for the finger. */
useSortable({
    container: list,
    onMove: (from, to) => editor.moveSlide(from, to),
    grid: () => !!props.sheet,
    mouseOnRow: () => !!props.sheet,
    touchOnRow: true,
});

/** What the chain symbol says: the other playlists showing the slide (Plan.md 49). */
function linkedLabel(id: string): string {
    return t.editor.slideList.linkedWith(editor.linkedIn(id).map((p) => p.name).join(', '));
}

async function remove(id: string, name: string): Promise<void> {
    if (await confirm({ message: t.editor.slideList.confirmRemove(name), confirmLabel: t.common.remove, danger: true })) editor.removeSlide(id);
}
</script>

<template>
    <aside class="slide-list" :class="{ 'slide-list--sheet': sheet }">
        <header v-if="!sheet" class="header-desktop">
            <span class="title">
                <strong>{{ t.editor.slideList.title }}</strong>
                <span class="count">{{ editor.slides.length }}</span>
            </span>
            <!-- Over 75rem the column folds into a rail, below it the drawer closes (Plan.md 45). -->
            <button
                v-tip="t.editor.slideList.collapse"
                type="button"
                class="d-btn d-btn--icon collapse-btn"
                :aria-label="t.editor.slideList.collapse"
                data-testid="slides-collapse"
                @click="emit('collapse')"
            >
                <Icon name="chevron-down" :size="16" class="collapse-icon" />
            </button>
        </header>
        <ol id="slide-list-ol" ref="list">
            <li
                v-for="(slide, index) in editor.slides"
                :key="slide.id"
                :class="{
                    active: slide.id === editor.slide?.id,
                    disabled: !slide.enabled,
                }"
                :title="`${index + 1}. ${slide.name}`"
                :aria-label="`${index + 1}. ${slide.name}`"
                data-sort-item
                data-testid="slide-item"
                @click="editor.selectSlide(slide.id)"
            >
                <div class="lead">
                    <span class="num">{{ index + 1 }}</span>
                    <button class="grip" type="button" data-sort-handle :aria-label="t.common.dragToSort" data-testid="slide-handle" @click.stop>
                        <Icon name="grip" :size="14" />
                    </button>
                </div>
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
                    <span
                        class="duration"
                        :class="{ longer: runs(slide).longer }"
                        :title="runs(slide).longer ? t.editor.slideList.runsLonger(slide.durationSeconds, runs(slide).seconds) : undefined"
                        data-testid="slide-duration"
                    >
                        <template v-if="runs(slide).longer">{{ slide.durationSeconds }} → </template>{{ runs(slide).seconds }} s{{ slide.enabled ? '' : t.editor.slideList.off }}
                    </span>
                </div>
                <div v-if="!sheet && slide.id === editor.slide?.id" class="actions" @click.stop>
                    <button
                        v-tip="t.editor.slideList.duplicate"
                        class="d-btn d-btn--icon"
                        type="button"
                        :aria-label="t.editor.slideList.duplicate"
                        @click="editor.duplicateCurrentSlide()"
                    >
                        <Icon name="duplicate" :size="16" />
                    </button>
                    <button
                        v-tip="t.editor.slideList.remove"
                        class="d-btn d-btn--icon"
                        type="button"
                        :aria-label="t.editor.slideList.remove"
                        :disabled="editor.slides.length <= 1"
                        @click="remove(slide.id, slide.name)"
                    >
                        <Icon name="trash" :size="16" class="danger-icon" />
                    </button>
                </div>
            </li>
            <!-- Where one looks for the next slide: below the last (Plan.md, Nächste Schritte 11); in the sheet a tile of the grid. -->
            <li class="add-item">
                <button
                    class="add"
                    type="button"
                    :title="t.editor.slideList.newSlide"
                    :aria-label="t.editor.slideList.newSlide"
                    data-testid="add-slide"
                    :style="{ minHeight: `${thumb.height}px` }"
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
.title strong {
    font-weight: var(--d-weight-heading);
}
.collapse-icon {
    transform: rotate(90deg);
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
li > :not(.lead) {
    grid-column: 2;
}
li + li {
    margin-top: 4px;
}
li:hover {
    background: var(--d-panel);
}
.lead {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
}
.num {
    padding-top: 2px;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
/* The handle sits under the number; a finger holds the whole tile instead (useSortable). */
.grip {
    display: grid;
    place-items: center;
    width: 20px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: var(--d-radius);
    background: none;
    color: var(--d-text-faint);
    cursor: grab;
    user-select: none;
    -webkit-touch-callout: none;
}
li:hover .grip,
.grip:focus-visible {
    color: var(--d-text-muted);
}
.grip:hover {
    background: var(--d-workspace);
    color: var(--d-text);
}
/* A held tile must not select its text or open the system menu. */
li {
    user-select: none;
    -webkit-touch-callout: none;
}
li.active .num {
    color: var(--d-accent);
    font-weight: var(--d-weight-normal);
}
/* The chosen slide: a ring of 2 px in the accent around its picture, 3 px off it. */
li.active .thumb {
    outline: 2px solid var(--d-accent);
    outline-offset: 3px;
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
    padding: 6px 12px;
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
/* In the sheet of a phone (Plan.md 79, C2): two columns of pictures, name and time below, no number and no handle. */
.slide-list--sheet {
    flex: 1;
    border-radius: 0;
    background: none;
    box-shadow: none;
}
.slide-list--sheet ol {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: start;
    gap: 16px 12px;
    padding: 4px 16px 16px;
    /* Kept free as in the column: a scrollbar that comes and goes would resize the pictures again and again. */
    scrollbar-gutter: stable;
}
.slide-list--sheet li {
    display: block;
    padding: 0;
    border: 0;
}
.slide-list--sheet li:hover {
    background: none;
}
.slide-list--sheet li + li {
    margin-top: 0;
}
.slide-list--sheet .lead {
    display: none;
}
.slide-list--sheet .meta {
    justify-content: space-between;
    margin-top: 6px;
}
.slide-list--sheet li.add-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.slide-list--sheet .import {
    margin-top: 0;
    min-height: 44px;
    text-align: center;
}
.slide-list--sheet .add {
    padding: 8px;
}
</style>
