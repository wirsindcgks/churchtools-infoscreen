<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import type { Block } from '../model/schema';
import { bannerShown } from '../player/banner';
import BannerView from '../player/BannerView.vue';
import { useStageContext } from '../player/context';
import SlideView from '../player/SlideView.vue';
import StageView from '../player/StageView.vue';
import { fitStage } from '../player/stage';
import { t } from '../i18n/designer';
import { useEditorStore } from './editor-store';
import { centerCovered, emptyAction } from './empty-block';
import Icon from './Icon.vue';
import { neighbourGaps, pairGaps, sizeLabelPlace, type Measure } from './measure';
import { BLOCK_ICONS, BLOCK_LABELS, blockBelow, clampFrame } from './ops';
import QuickMenu from './QuickMenu.vue';
import { snapMove, snapResize, type Guide, type Handle } from './snap';

const emit = defineEmits<{ 'all-settings': [] }>();
const editor = useEditorStore();
const stage = useStageContext();
// The designer shows what the TV shows (Plan.md 38): a band past its "until" no longer draws here either.
const banner = computed(() => {
    const b = editor.draft?.playlist.banner;
    return bannerShown(b, stage.now, stage.timeZone) ? b : null;
});
const host = ref<HTMLElement | null>(null);
const overlay = ref<HTMLElement | null>(null);
const size = reactive({ width: 800, height: 450 });
const fit = computed(() => fitStage(size, editor.stage));

let observer: ResizeObserver | undefined;
onMounted(() => {
    observer = new ResizeObserver(([entry]) => {
        if (!entry) return;
        size.width = entry.contentRect.width;
        size.height = entry.contentRect.height;
    });
    if (host.value) observer.observe(host.value);
});
onBeforeUnmount(() => observer?.disconnect());

/** Alt held and the pointer over another block: the distances between it and the chosen one (Plan.md 79, A2). */
const altDown = ref(false);
const hoveredId = ref<string | null>(null);
function onAltKey(event: KeyboardEvent): void {
    if (event.key === 'Alt') altDown.value = event.type === 'keydown';
}
function onWindowBlur(): void {
    altDown.value = false;
}
onMounted(() => {
    window.addEventListener('keydown', onAltKey);
    window.addEventListener('keyup', onAltKey);
    window.addEventListener('blur', onWindowBlur);
});
onBeforeUnmount(() => {
    window.removeEventListener('keydown', onAltKey);
    window.removeEventListener('keyup', onAltKey);
    window.removeEventListener('blur', onWindowBlur);
});

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface Drag {
    id: string;
    handle: Handle | 'move';
    startX: number;
    startY: number;
    frame: { x: number; y: number; width: number; height: number };
}
let drag: Drag | null = null;
const guides = ref<Guide[]>([]);
/** The block being dragged or resized – set with the first movement, not with a click. */
const dragId = ref<string | null>(null);
/** Distances to the neighbours while dragging (A1) and the equal gaps the drag snapped to (A3). */
const measures = ref<Measure[]>([]);
const spacings = ref<Measure[]>([]);

/** Snap targets come closer than 8 screen pixels – independent of the zoom. */
const SNAP_SCREEN_PX = 8;

/** Where on the stage a pointer is, in stage pixels. */
function stagePoint(event: PointerEvent): { x: number; y: number } | null {
    const rect = overlay.value?.getBoundingClientRect();
    if (!rect || !fit.value.scale) return null;
    return { x: (event.clientX - rect.left) / fit.value.scale, y: (event.clientY - rect.top) / fit.value.scale };
}

function start(event: PointerEvent, clicked: Block, handle: Handle | 'move'): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    // A locked block lets a click through to an unlocked one below it; with Alt it takes the click itself.
    const point = handle === 'move' && clicked.locked && !event.altKey ? stagePoint(event) : null;
    const block = (point && blockBelow(blocks.value, clicked, point)) || clicked;
    editor.selectBlock(block.id);
    // Locked (Plan.md, 25): it can be chosen – to unlock it in the inspector – but not moved.
    if (block.locked) return;
    drag = {
        id: block.id,
        handle,
        startX: event.clientX,
        startY: event.clientY,
        frame: { x: block.x, y: block.y, width: block.width, height: block.height },
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function moveTo(event: PointerEvent): void {
    if (!drag) return;
    // Screen pixels to stage pixels: the stage is shown scaled.
    const dx = (event.clientX - drag.startX) / fit.value.scale;
    const dy = (event.clientY - drag.startY) / fit.value.scale;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    editor.beginGesture();
    dragId.value = drag.id;
    const f = { ...drag.frame };
    const h = drag.handle;
    if (h === 'move') {
        f.x += dx;
        f.y += dy;
    } else {
        if (h.includes('e')) f.width += dx;
        if (h.includes('s')) f.height += dy;
        if (h.includes('w')) {
            f.x += dx;
            f.width -= dx;
        }
        if (h.includes('n')) {
            f.y += dy;
            f.height -= dy;
        }
    }
    const id = drag.id;
    const others = blocks.value.filter((b) => b.id !== id);
    // Alt/Option suspends snapping for fine placement – the distances still show.
    if (event.altKey) {
        guides.value = [];
        spacings.value = [];
        measures.value = neighbourGaps(clampFrame(f, editor.stage), others, editor.stage);
        editor.updateBlock(drag.id, f);
        return;
    }
    const options = {
        grid: editor.gridSize,
        threshold: SNAP_SCREEN_PX / fit.value.scale,
        stage: editor.stage,
        others,
    };
    const snapped = h === 'move' ? snapMove(f, options) : snapResize(f, h, options);
    guides.value = snapped.guides;
    spacings.value = snapped.spacings;
    measures.value = neighbourGaps(clampFrame(snapped.frame, editor.stage), others, editor.stage);
    editor.updateBlock(id, snapped.frame);
}

function end(): void {
    drag = null;
    dragId.value = null;
    guides.value = [];
    measures.value = [];
    spacings.value = [];
    editor.endGesture();
}

type Drawn = Measure & { kind: 'measure' | 'spacing' };
/** Everything drawn in orange: the neighbour distances, the pair under Alt, and the equal gaps without doubles. */
const drawn = computed<Drawn[]>(() => {
    const chosen = editor.block;
    const hovered = blocks.value.find((b) => b.id === hoveredId.value);
    const pair = altDown.value && !dragId.value && chosen && hovered && chosen.id !== hovered.id ? pairGaps(chosen, hovered) : [];
    const key = (m: Measure) => `${m.axis}:${m.from}:${m.to}:${m.at}`;
    const seen = new Set([...measures.value, ...pair].map(key));
    return [
        ...[...measures.value, ...pair].map((m): Drawn => ({ ...m, kind: 'measure' })),
        ...spacings.value.filter((m) => !seen.has(key(m))).map((m): Drawn => ({ ...m, kind: 'spacing' })),
    ];
});

function measureStyle(m: Measure): Record<string, string> {
    return m.axis === 'x'
        ? { left: `${m.from}px`, top: `${m.at}px`, width: `${m.to - m.from}px` }
        : { left: `${m.at}px`, top: `${m.from}px`, height: `${m.to - m.from}px` };
}

/** The size beside the block while it is dragged or resized (A1): where `sizeLabelPlace` puts it, clear of the distances. */
const sizeLabel = computed(() => {
    const b = blocks.value.find((x) => x.id === dragId.value);
    if (!b) return null;
    const { top } = sizeLabelPlace(b, drawn.value, editor.stage, fit.value.scale);
    return { text: t.editor.stage.size(b.width, b.height), style: { left: `${b.x + b.width / 2}px`, top: `${top}px` } };
});

const gridStyle = computed(() => {
    const size = editor.gridSize;
    if (!size) return {};
    const line = `${1 / fit.value.scale}px`;
    const color = 'rgba(148, 163, 184, 0.28)';
    return {
        backgroundImage: `linear-gradient(to right, ${color} ${line}, transparent ${line}), linear-gradient(to bottom, ${color} ${line}, transparent ${line})`,
        backgroundSize: `${size}px ${size}px`,
    };
});

const blocks = computed(() => editor.slide?.blocks ?? []);

/** The short menu (Plan.md 79, C1) stands from 48rem up – a phone gets its own bar in C2; reactive, because the window may be resized. */
const wideQuery = window.matchMedia('(min-width: 48.0625rem)');
const wide = ref(wideQuery.matches);
function onWideChange(event: MediaQueryListEvent): void {
    wide.value = event.matches;
}
wideQuery.addEventListener('change', onWideChange);
onBeforeUnmount(() => wideQuery.removeEventListener('change', onWideChange));

/** A block's frame in host pixels (the menu and the buttons on empty blocks live outside the scaled stage). */
function hostFrame(b: Block): { left: number; top: number; width: number; height: number } {
    const { scale, offsetX, offsetY } = fit.value;
    return { left: offsetX + b.x * scale, top: offsetY + b.y * scale, width: b.width * scale, height: b.height * scale };
}
const quickBlock = computed(() => (wide.value && !dragId.value && fit.value.scale > 0 ? editor.block : null));
const quickFrame = computed(() => (quickBlock.value ? hostFrame(quickBlock.value) : null));
const quickMenu = ref<InstanceType<typeof QuickMenu> | null>(null);

/** The buttons on blocks that lack their content (C6): only where they fit, never on a locked block, the one being dragged or one whose middle another block covers. */
const BUTTON_MIN = { width: 120, height: 40 };
const emptyButtons = computed(() =>
    blocks.value.flatMap((b) => {
        const text = emptyAction(b);
        const frame = hostFrame(b);
        if (!text || b.locked || b.id === dragId.value || frame.width < BUTTON_MIN.width || frame.height < BUTTON_MIN.height || centerCovered(b, blocks.value)) return [];
        return [{ block: b, text, left: frame.left + frame.width / 2, top: frame.top + frame.height / 2 }];
    }),
);

/** Leads to the content of the chosen block: its menu opens its first field; without a menu, all the settings open (C5, C6). */
async function openContent(): Promise<void> {
    await nextTick();
    const b = editor.block;
    if (!b || b.locked) return;
    if (quickMenu.value) quickMenu.value.openFirst();
    else if (!wide.value) emit('all-settings');
}
/** A double click: the text block gets its own editing on the stage in C4, until then it does nothing. */
function onDoubleClick(): void {
    if (editor.block?.type === 'text') return;
    void openContent();
}
function onEmptyAction(b: Block): void {
    editor.selectBlock(b.id);
    void openContent();
}
</script>

<template>
    <div ref="host" class="editor-stage" data-quick-host @pointerdown="editor.selectBlock(null)">
        <!-- The soft shadow of the stage on the workspace (Plan.md 79, B3): the stage itself is clipped, so it lies beside it. -->
        <div
            v-if="editor.slide"
            class="stage-shadow"
            :style="{ left: `${fit.offsetX}px`, top: `${fit.offsetY}px`, width: `${editor.stage.width * fit.scale}px`, height: `${editor.stage.height * fit.scale}px` }"
        />
        <StageView v-if="editor.slide" :width="editor.stage.width" :height="editor.stage.height" :fit="fit">
            <SlideView :slide="editor.slide" :width="editor.stage.width" :height="editor.stage.height" />
            <!-- The playlist's band lies over every slide (Plan.md 32); clicks go through to the blocks. -->
            <BannerView v-if="banner" class="stage-banner" :banner="banner" :stage-width="editor.stage.width" />
            <div
                ref="overlay"
                class="overlay"
                :class="{ 'overlay--dragging': dragId }"
                :style="{ ...gridStyle, '--s': `${1 / fit.scale}px` }"
                data-testid="grid"
            >
                <div
                    v-for="(guide, i) in guides"
                    :key="i"
                    class="guide"
                    :class="`guide--${guide.axis}`"
                    :style="{
                        [guide.axis === 'x' ? 'left' : 'top']: `${guide.at}px`,
                        '--line': `${1 / fit.scale}px`,
                    }"
                    data-testid="guide"
                />
                <div
                    v-for="(m, i) in drawn"
                    :key="`m${i}`"
                    class="measure"
                    :class="`measure--${m.axis}`"
                    :style="measureStyle(m)"
                    :data-testid="m.kind"
                >
                    <span class="measure-label">{{ m.value }}</span>
                </div>
                <div v-if="sizeLabel" class="frame-size" :style="sizeLabel.style" data-testid="frame-size">{{ sizeLabel.text }}</div>
                <div
                    v-for="block in blocks"
                    :key="block.id"
                    class="frame"
                    :class="{ 'frame--selected': block.id === editor.selectedBlockId, 'frame--locked': block.locked }"
                    :style="{
                        left: `${block.x}px`,
                        top: `${block.y}px`,
                        width: `${block.width}px`,
                        height: `${block.height}px`,
                        '--handle': `${12 / fit.scale}px`,
                        '--line': `${1.5 / fit.scale}px`,
                    }"
                    :title="block.locked ? t.editor.stage.lockedTitle(BLOCK_LABELS[block.type]) : undefined"
                    :data-testid="`frame-${block.type}`"
                    @pointerdown="start($event, block, 'move')"
                    @pointermove="moveTo"
                    @pointerup="end"
                    @pointercancel="end"
                    @pointerenter="hoveredId = block.id"
                    @pointerleave="hoveredId = null"
                    @dblclick="onDoubleClick"
                >
                    <!-- Shown by CSS where there is a pointer to hover with, never on the chosen block or while dragging (A4). -->
                    <span class="frame-name" :class="{ 'frame-name--inside': block.y < 32 / fit.scale }">
                        <Icon :name="BLOCK_ICONS[block.type]" :size="14" />{{ BLOCK_LABELS[block.type] }}
                    </span>
                    <span
                        v-if="block.locked && block.id === editor.selectedBlockId"
                        class="lock"
                        :title="t.editor.stage.lockBadge"
                        data-testid="frame-lock"
                    >
                        <Icon name="lock" :size="16" />
                    </span>
                    <template v-else-if="block.id === editor.selectedBlockId">
                        <span
                            v-for="h in HANDLES"
                            :key="h"
                            class="handle"
                            :class="`handle--${h}`"
                            @pointerdown="start($event, block, h)"
                            @pointermove="moveTo"
                            @pointerup="end"
                            @pointercancel="end"
                        />
                    </template>
                </div>
            </div>
        </StageView>
        <!-- Only in the editor, never in the player (C6): what a block still lacks, as a button in its middle. -->
        <button
            v-for="item in emptyButtons"
            :key="item.block.id"
            class="d-btn empty-action"
            type="button"
            :style="{ left: `${item.left}px`, top: `${item.top}px` }"
            :data-block-type="item.block.type"
            data-testid="empty-block-action"
            @pointerdown.stop
            @click="onEmptyAction(item.block)"
        >
            {{ item.text }}
        </button>
        <QuickMenu
            v-if="quickBlock && quickFrame"
            :key="quickBlock.id"
            ref="quickMenu"
            :block="quickBlock"
            :frame="quickFrame"
            :host="size"
            @all-settings="emit('all-settings')"
        />
        <!-- Only in the editor, never in the player (A7): over the stage, in screen pixels, below the blocks' reach. -->
        <div
            v-if="editor.slide && !blocks.length"
            class="empty-slide"
            :style="{ left: `${fit.offsetX}px`, top: `${fit.offsetY}px`, width: `${editor.stage.width * fit.scale}px`, height: `${editor.stage.height * fit.scale}px` }"
        >
            <div class="empty-slide-box" data-testid="empty-slide" @pointerdown.stop>
                <p>{{ t.editor.stage.emptySlide }}</p>
                <button class="d-btn d-btn--create" type="button" data-testid="empty-slide-add" @click="editor.blockSheetOpen = true">
                    <Icon name="plus" :size="16" /> {{ t.editor.palette.addBlock }}
                </button>
            </div>
        </div>
        <p v-else-if="!editor.slide" class="empty">{{ t.editor.stage.empty }}</p>
    </div>
</template>

<style scoped>
.editor-stage {
    position: relative;
    min-height: 0;
    height: 100%;
    /* The shadow of the stage reaches over the edge; the stage clips its own blocks. */
    overflow: visible;
    /* A finger on the empty stage scrolls the page (phone, Plan.md 11); on a block it moves the block. */
    touch-action: pan-x pan-y;
}
.stage-shadow {
    position: absolute;
    border-radius: 4px;
    box-shadow: var(--d-shadow-stage);
    pointer-events: none;
}
.editor-stage :deep(.stage) {
    border-radius: 4px;
}
.stage-banner {
    pointer-events: none;
}
.overlay {
    position: absolute;
    inset: 0;
}
.guide {
    position: absolute;
    z-index: 1;
    pointer-events: none;
    background: rgb(236, 72, 153);
}
.guide--x {
    top: 0;
    bottom: 0;
    width: var(--line);
}
.guide--y {
    left: 0;
    right: 0;
    height: var(--line);
}
/* Distances (Plan.md 79, A1): a line with a tick at each end and a label with the number; all sized by --s, one screen pixel. */
.measure {
    position: absolute;
    z-index: 2;
    pointer-events: none;
    background: var(--d-measure);
}
.measure--x {
    height: var(--s);
}
.measure--y {
    width: var(--s);
}
.measure::before,
.measure::after {
    content: '';
    position: absolute;
    background: var(--d-measure);
}
.measure--x::before,
.measure--x::after {
    top: 50%;
    width: var(--s);
    height: calc(var(--s) * 7);
    transform: translateY(-50%);
}
.measure--x::before { left: 0; }
.measure--x::after { right: 0; }
.measure--y::before,
.measure--y::after {
    left: 50%;
    width: calc(var(--s) * 7);
    height: var(--s);
    transform: translateX(-50%);
}
.measure--y::before { top: 0; }
.measure--y::after { bottom: 0; }
.measure-label,
.frame-size {
    padding: calc(var(--s) * 2) calc(var(--s) * 5);
    border-radius: calc(var(--s) * 3);
    background: var(--d-measure);
    color: #fff;
    font: var(--d-weight-normal) calc(var(--s) * 11) / 1.2 var(--d-font);
    white-space: nowrap;
}
.measure-label {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
}
.frame-size {
    position: absolute;
    /* Below the distances (z-index 2), should the two touch. */
    z-index: 1;
    pointer-events: none;
    transform: translateX(-50%);
}
.frame {
    position: absolute;
    box-sizing: border-box;
    touch-action: none;
    cursor: move;
    outline: var(--line) dashed rgba(148, 163, 184, 0.55);
}
.frame:hover {
    outline-color: rgba(96, 165, 250, 0.9);
}
.frame--selected {
    outline: calc(var(--line) * 1.5) solid rgb(59, 130, 246);
    /* Half the line inwards: it lies on the edge, and the handles, centred on the edge, sit on it. */
    outline-offset: calc(var(--line) * -0.75);
}
/* Name of the block under the pointer (A4); only where a pointer can hover. */
.frame-name {
    display: none;
    position: absolute;
    left: 0;
    bottom: 100%;
    z-index: 3;
    align-items: center;
    gap: calc(var(--s) * 4);
    margin-bottom: calc(var(--s) * 4);
    padding: calc(var(--s) * 2) calc(var(--s) * 6);
    border-radius: calc(var(--s) * 3);
    background: rgb(59, 130, 246);
    color: #fff;
    font: var(--d-weight-normal) calc(var(--s) * 12) / 1.2 var(--d-font);
    white-space: nowrap;
    pointer-events: none;
}
.frame-name--inside {
    bottom: auto;
    top: 0;
    margin: calc(var(--s) * 4);
}
.frame-name :deep(svg) {
    width: calc(var(--s) * 14);
    height: calc(var(--s) * 14);
}
@media (hover: hover) {
    .overlay:not(.overlay--dragging) .frame:hover:not(.frame--selected) .frame-name {
        display: inline-flex;
    }
}
.frame--locked {
    cursor: default;
}
/* Sized in screen pixels like the handles; the stage is shown scaled. */
.lock {
    position: absolute;
    top: 0;
    right: 0;
    display: grid;
    place-items: center;
    width: calc(var(--handle) * 2);
    height: calc(var(--handle) * 2);
    border-radius: 0 0 0 calc(var(--handle) / 2);
    background: var(--d-accent);
    color: #fff;
}
.lock :deep(svg) {
    width: calc(var(--handle) * 1.4);
    height: calc(var(--handle) * 1.4);
}
.handle {
    position: absolute;
    width: var(--handle);
    height: var(--handle);
    margin: calc(var(--handle) / -2);
    background: #fff;
    border: var(--line) solid rgb(59, 130, 246);
    border-radius: 2px;
    box-sizing: border-box;
}
.handle--nw { left: 0; top: 0; cursor: nwse-resize; }
.handle--n { left: 50%; top: 0; cursor: ns-resize; }
.handle--ne { left: 100%; top: 0; cursor: nesw-resize; }
.handle--e { left: 100%; top: 50%; cursor: ew-resize; }
.handle--se { left: 100%; top: 100%; cursor: nwse-resize; }
.handle--s { left: 50%; top: 100%; cursor: ns-resize; }
.handle--sw { left: 0; top: 100%; cursor: nesw-resize; }
.handle--w { left: 0; top: 50%; cursor: ew-resize; }
/* A fingertip needs a bigger grip than a mouse pointer. */
@media (pointer: coarse) {
    .handle {
        width: calc(var(--handle) * 2);
        height: calc(var(--handle) * 2);
        margin: calc(var(--handle) * -1);
    }
}
/* What an empty block lacks (C6): a white button with a shadow, in screen pixels, in the middle of the block. */
.empty-action {
    position: absolute;
    z-index: 10;
    transform: translate(-50%, -50%);
    box-shadow: var(--d-shadow);
    font-family: var(--d-font);
    white-space: nowrap;
}
/* The sentence on an empty slide: a quiet card in the middle of the stage, in screen pixels (A7). */
.empty-slide {
    position: absolute;
    display: grid;
    place-items: center;
    pointer-events: none;
}
.empty-slide-box {
    display: grid;
    justify-items: center;
    gap: 8px;
    max-width: 90%;
    padding: 12px 16px;
    border-radius: var(--d-radius-lg);
    background: rgba(255, 255, 255, 0.92);
    box-shadow: var(--d-shadow);
    color: var(--d-text-muted);
    font-family: var(--d-font);
    text-align: center;
    pointer-events: auto;
}
.empty-slide-box p {
    margin: 0;
}
.empty {
    display: grid;
    place-items: center;
    height: 100%;
    margin: 0;
    color: var(--d-text-muted);
}
</style>
