<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { Block } from '../model/schema';
import { bannerShown } from '../player/banner';
import BannerView from '../player/BannerView.vue';
import { useStageContext } from '../player/context';
import SlideView from '../player/SlideView.vue';
import StageView from '../player/StageView.vue';
import { textStyle, verticalAlignOf, verticalStyle } from '../player/format';
import { fitStage } from '../player/stage';
import { t } from '../i18n/designer';
import { useEditorStore } from './editor-store';
import { centerCovered, emptyAction } from './empty-block';
import Icon from './Icon.vue';
import { isDoubleTap, longPress, TAP_SLOP, type Tap } from './gestures';
import { handlesOutside } from './handles';
import { neighbourGaps, pairGaps, sizeLabelPlace, type Measure } from './measure';
import { BLOCK_ICONS, BLOCK_LABELS, blockBelow, clampFrame } from './ops';
import QuickMenu from './QuickMenu.vue';
import { snapMove, snapResize, type Guide, type Handle } from './snap';
import { clampPan, viewOnto, WHOLE, zoomAt, zoomedFit, type View } from './stage-zoom';

const emit = defineEmits<{ 'all-settings': []; 'open-content': []; 'open-more': [] }>();
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
/** The whole slide in the host, and how far the editor has zoomed into it (Plan.md 79, C3): everything on the stage computes with `fit`. */
const baseFit = computed(() => fitStage(size, editor.stage));
const view = ref<View>({ ...WHOLE });
const fit = computed(() => zoomedFit(baseFit.value, view.value));
function setView(next: View): void {
    view.value = clampPan(baseFit.value, next, size);
}
// Another window size or stage keeps the zoomed slide over the host; another slide starts whole again.
watch(baseFit, () => setView(view.value));
watch(
    () => editor.slide?.id,
    () => {
        view.value = { ...WHOLE };
        viewBeforeWriting = null;
        pasteMenu.value = null;
    },
);

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

// The on-screen keyboard shrinks the visual viewport: the field being written stays in sight above it (C4).
function keepFieldInSight(): void {
    if (!editor.editingTextId) return;
    textArea.value?.scrollIntoView({ block: 'nearest' });
    // The host clips at zoom; never let it scroll away from the stage it maps.
    if (host.value) {
        host.value.scrollTop = 0;
        host.value.scrollLeft = 0;
    }
}
onMounted(() => {
    host.value?.addEventListener('wheel', onWheel, { passive: false });
    window.visualViewport?.addEventListener('resize', keepFieldInSight);
});
onBeforeUnmount(() => {
    host.value?.removeEventListener('wheel', onWheel);
    window.visualViewport?.removeEventListener('resize', keepFieldInSight);
});

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
    /** Snap targets come closer than this many screen pixels: a fingertip is less exact than a mouse. */
    snapPx: number;
}
let drag: Drag | null = null;
/**
 * Zoomed in, a finger on the chosen block first waits (C3; user at the phone, 2026-10-09): moved at once, it moves the
 * stage like a map; held still for {@link HOLD_MS}, the block lifts and follows the finger.
 */
const HOLD_MS = 250;
let hold: { timer: ReturnType<typeof setTimeout>; ready: Drag; x: number; y: number } | null = null;
/** The block a held finger has lifted – drawn raised while it is carried. */
const liftedId = ref<string | null>(null);
function dropHold(): void {
    if (hold) clearTimeout(hold.timer);
    hold = null;
}
const guides = ref<Guide[]>([]);
/** The block being dragged or resized – set with the first movement, not with a click. */
const dragId = ref<string | null>(null);
/** Distances to the neighbours while dragging (A1) and the equal gaps the drag snapped to (A3). */
const measures = ref<Measure[]>([]);
const spacings = ref<Measure[]>([]);

/** Snap targets come closer than 8 screen pixels (12 at a finger) – independent of the zoom. */
const SNAP_SCREEN_PX = 8;
const SNAP_SCREEN_PX_TOUCH = 12;

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
    const wasChosen = editor.selectedBlockId === block.id;
    editor.selectBlock(block.id);
    const touch = event.pointerType === 'touch';
    if (touch) showName(block.id);
    // A finger first chooses (C3): a swipe over an unchosen block scrolls the page. Only the chosen block is moved.
    if (touch && !wasChosen) return;
    // Locked (Plan.md, 25): it can be chosen – to unlock it in the inspector – but not moved.
    if (block.locked) return;
    const ready: Drag = {
        id: block.id,
        handle,
        startX: event.clientX,
        startY: event.clientY,
        frame: { x: block.x, y: block.y, width: block.width, height: block.height },
        snapPx: touch ? SNAP_SCREEN_PX_TOUCH : SNAP_SCREEN_PX,
    };
    if (touch && handle === 'move' && view.value.zoom > 1) {
        dropHold();
        hold = {
            ready,
            x: event.clientX,
            y: event.clientY,
            timer: setTimeout(() => {
                if (!hold) return;
                // From where the finger is now: it may have crept a few pixels while it held.
                drag = { ...hold.ready, startX: hold.x, startY: hold.y };
                liftedId.value = hold.ready.id;
                hold = null;
                panStart = null;
                navigator.vibrate?.(10);
            }, HOLD_MS),
        };
        return;
    }
    drag = ready;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function moveTo(event: PointerEvent): void {
    if (hold) {
        hold.x = event.clientX;
        hold.y = event.clientY;
        // Moved before it was held: the finger moves the stage (onHostMoveCapture), not the block.
        if (Math.hypot(event.clientX - hold.ready.startX, event.clientY - hold.ready.startY) > TAP_SLOP) dropHold();
    }
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
        threshold: drag.snapPx / fit.value.scale,
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
    dropHold();
    liftedId.value = null;
    drag = null;
    dragId.value = null;
    guides.value = [];
    measures.value = [];
    spacings.value = [];
    // A mouse released over a block after marking text in the field must not close the editing run.
    if (!editor.editingTextId) editor.endGesture();
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

/** The short menu (Plan.md 79, C1) stands from 48rem up – a phone has its bar at the bottom instead (C2); reactive, because the window may be resized. */
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

/** The name of a block stays over it for a moment after a touch – there is no hovering with a finger (C3). */
const touchNameId = ref<string | null>(null);
let touchNameTimer: ReturnType<typeof setTimeout> | undefined;
function showName(id: string): void {
    touchNameId.value = id;
    clearTimeout(touchNameTimer);
    touchNameTimer = setTimeout(() => (touchNameId.value = null), 1500);
}

/** Handles of a small block stand outside its frame where a finger is the pointer, so the corners and middles do not fall together (C3). */
const coarseQuery = window.matchMedia('(pointer: coarse)');
const coarse = ref(coarseQuery.matches);
function onCoarseChange(event: MediaQueryListEvent): void {
    coarse.value = event.matches;
}
coarseQuery.addEventListener('change', onCoarseChange);
onBeforeUnmount(() => {
    coarseQuery.removeEventListener('change', onCoarseChange);
    clearTimeout(touchNameTimer);
});
function tight(b: Block): boolean {
    return coarse.value && handlesOutside({ width: b.width * fit.value.scale, height: b.height * fit.value.scale });
}

/** Where a pointer is in the host, in host pixels. */
function hostPoint(event: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = host.value?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
}

// Zoom (C3): two fingers, or Strg/⌘ with the wheel (also the trackpad's pinch). The point under them stays where it is.
const pinching = ref(false);
const touches = new Map<number, { x: number; y: number }>();
let pinch: { dist: number; mid: { x: number; y: number }; view: View } | null = null;
function twoFingers(): [{ x: number; y: number }, { x: number; y: number }] {
    const [a, b] = [...touches.values()];
    return [a!, b!];
}
function beginPinch(): void {
    // The one-finger run before ends: a drag that moved already stands as its own step, one that did not leaves none.
    if (drag) {
        if (dragId.value) end();
        else drag = null;
    }
    press.cancel();
    tapDown = null;
    lastTap = null;
    panStart = null;
    const [a, b] = twoFingers();
    pinch = { dist: Math.hypot(b.x - a.x, b.y - a.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: { ...view.value } };
    pinching.value = true;
}
function updatePinch(): void {
    if (!pinch) return;
    const [a, b] = twoFingers();
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const zoomed = zoomAt(baseFit.value, pinch.view, pinch.mid, Math.hypot(b.x - a.x, b.y - a.y) / pinch.dist);
    setView({ ...zoomed, panX: zoomed.panX + mid.x - pinch.mid.x, panY: zoomed.panY + mid.y - pinch.mid.y });
}
function onWheel(event: WheelEvent): void {
    const lines = event.deltaMode === 1 ? 33 : 1;
    if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        setView(zoomAt(baseFit.value, view.value, hostPoint(event), Math.exp(-event.deltaY * lines * 0.0025)));
    } else if (view.value.zoom > 1) {
        event.preventDefault();
        setView({ ...view.value, panX: view.value.panX - event.deltaX * lines, panY: view.value.panY - event.deltaY * lines });
    }
}
function resetZoom(): void {
    view.value = { ...WHOLE };
}

// Taps and long presses of a finger (C3): on a block or on the empty stage; the menus and buttons in the host are none of it.
const NOT_STAGE = '[data-testid="quick-menu"], [data-testid="text-edit"], .empty-action, .zoom-reset, .empty-slide-box, .paste-menu';
function tapTarget(el: EventTarget | null): string | null {
    const e = el as Element | null;
    if (!e || !host.value?.contains(e) || e.closest(NOT_STAGE)) return null;
    return e.closest<HTMLElement>('[data-block-id]')?.dataset.blockId ?? 'empty';
}
let tapDown: { x: number; y: number; target: string } | null = null;
let lastTap: Tap | null = null;
/** Zoomed in, one finger on the empty stage or an unchosen block moves the stage like a map (C3). */
let panStart: { x: number; y: number; view: View } | null = null;
let lastTouchDouble = 0;
/** A touch is on the glass or has just left it – then the browser's context menu is none of ours. */
let touchLive = false;
let touchLiveTimer: ReturnType<typeof setTimeout> | undefined;
const pasteMenu = ref<{ left: number; top: number; at: { x: number; y: number } } | null>(null);
const press = longPress(onLongPress);
/** The block a long press has just caught: it flashes, so the finger knows something happened (user at the phone, 2026-10-09). */
const pressedId = ref<string | null>(null);
let pressPoint = { x: 0, y: 0 };

async function onLongPress(): Promise<void> {
    const down = tapDown;
    if (!down) return;
    tapDown = null;
    lastTap = null;
    if (down.target === 'empty') {
        // Something to paste: a small menu at the finger; it pastes there.
        if (!editor.clipboard.length) return;
        const p = hostPoint({ clientX: pressPoint.x, clientY: pressPoint.y });
        const { scale, offsetX, offsetY } = fit.value;
        pasteMenu.value = {
            left: Math.max(8, Math.min(p.x, size.width - 120)),
            top: Math.max(8, p.y - 56),
            at: { x: (p.x - offsetX) / scale, y: (p.y - offsetY) / scale },
        };
        return;
    }
    pressedId.value = down.target;
    setTimeout(() => (pressedId.value = null), 300);
    navigator.vibrate?.(15);
    if (!editor.selectedBlockId) editor.selectBlock(down.target);
    await nextTick();
    if (quickMenu.value) quickMenu.value.openMore();
    else if (!wide.value) emit('open-more');
}
function pasteHere(): void {
    const at = pasteMenu.value?.at;
    pasteMenu.value = null;
    if (at) editor.pasteBlocks(at);
}
function onHostDownCapture(event: PointerEvent): void {
    if (pasteMenu.value && !(event.target as Element | null)?.closest('.paste-menu')) pasteMenu.value = null;
    if (event.pointerType !== 'touch') return;
    touchLive = true;
    clearTimeout(touchLiveTimer);
    touches.set(event.pointerId, hostPoint(event));
    if (touches.size >= 2) {
        // The second finger belongs to the zoom, not to a block under it.
        event.stopPropagation();
        beginPinch();
        return;
    }
    const target = tapTarget(event.target);
    tapDown = target ? { x: event.clientX, y: event.clientY, target } : null;
    pressPoint = { x: event.clientX, y: event.clientY };
    // Zoomed, also over the chosen block: there the finger waits for a hold first (start).
    panStart =
        target && (target === 'empty' || target !== editor.selectedBlockId || view.value.zoom > 1)
            ? { x: event.clientX, y: event.clientY, view: { ...view.value } }
            : null;
    press.cancel();
    if (target) press.start(event.clientX, event.clientY);
}
function onHostMoveCapture(event: PointerEvent): void {
    if (event.pointerType !== 'touch' || !touches.has(event.pointerId)) return;
    touches.set(event.pointerId, hostPoint(event));
    if (pinch) updatePinch();
    else {
        press.move(event.clientX, event.clientY);
        if (panStart && view.value.zoom > 1 && !drag) {
            const dx = event.clientX - panStart.x;
            const dy = event.clientY - panStart.y;
            if (Math.hypot(dx, dy) > TAP_SLOP) setView({ ...panStart.view, panX: panStart.view.panX + dx, panY: panStart.view.panY + dy });
        }
    }
}
function onHostUpCapture(event: PointerEvent): void {
    if (event.pointerType !== 'touch') return;
    const known = touches.delete(event.pointerId);
    clearTimeout(touchLiveTimer);
    touchLiveTimer = setTimeout(() => (touchLive = false), 1000);
    press.cancel();
    panStart = null;
    if (pinch && touches.size < 2) {
        pinch = null;
        pinching.value = false;
    }
    const down = tapDown;
    tapDown = null;
    if (!known || event.type === 'pointercancel' || !down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > TAP_SLOP) return;
    const tap: Tap = { x: event.clientX, y: event.clientY, time: event.timeStamp, target: down.target };
    if (isDoubleTap(lastTap, tap)) {
        lastTap = null;
        lastTouchDouble = performance.now();
        if (down.target === 'empty') resetZoom();
        else onDoubleClick();
        return;
    }
    lastTap = tap;
    // A tap on the empty stage lets go of the block (the mouse does it on press; a finger may be the start of a zoom).
    if (down.target === 'empty') editor.selectBlock(null);
}
function onHostDown(event: PointerEvent): void {
    if (event.pointerType !== 'touch') editor.selectBlock(null);
}
function onContextMenu(event: Event): void {
    if (touchLive) event.preventDefault();
}
/** The browser may make a `dblclick` of two taps as well – the double tap has done its work then. */
function onFrameDoubleClick(): void {
    if (performance.now() - lastTouchDouble < 700) return;
    onDoubleClick();
}

/** Leads to the content of the chosen block: its menu opens its first field – on a phone the editor's bar does (C5, C6). */
async function openContent(): Promise<void> {
    await nextTick();
    const b = editor.block;
    if (!b || b.locked) return;
    if (quickMenu.value) quickMenu.value.openFirst();
    else if (!wide.value) emit('open-content');
}
/** A double click: a text block is written on the stage (C4), any other leads to its content (C5). */
function onDoubleClick(): void {
    const chosen = editor.block;
    if (chosen?.type === 'text') {
        if (!chosen.locked) editor.startTextEdit(chosen.id);
        return;
    }
    void openContent();
}

/** Writing on the stage (Plan.md 79, C4): the field lies over the block inside the scaled stage, so type, wrap and alignment are the player's own. */
const editingBlock = computed(() => {
    const b = blocks.value.find((x) => x.id === editor.editingTextId);
    return b?.type === 'text' ? b : null;
});
/** Text blocks without text show a pale hint here – the player shows nothing. */
const placeholders = computed(() => blocks.value.filter((b): b is Extract<Block, { type: 'text' }> => b.type === 'text' && !b.text && b.id !== editor.editingTextId));
function textFrame(b: Block): Record<string, string> {
    return { left: `${b.x}px`, top: `${b.y}px`, width: `${b.width}px`, height: `${b.height}px` };
}
const textArea = ref<HTMLTextAreaElement | null>(null);
function grow(): void {
    const el = textArea.value;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
}
function onTextInput(event: Event): void {
    if (!editingBlock.value) return;
    editor.updateBlock(editingBlock.value.id, { text: (event.target as HTMLTextAreaElement).value });
    grow();
}
function onTextKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    editor.endTextEdit();
}
/** A press outside the field and the short menu (with its open panels) ends the writing. Captured: blocks stop their `pointerdown`. */
function endOnOutside(event: PointerEvent): void {
    const target = event.target as Element | null;
    if (target?.closest('[data-testid="text-edit"], [data-testid="quick-menu"]')) return;
    editor.endTextEdit();
}
/** Letters this size on the screen are readable while writing; smaller ones the phone zooms up to it (C4). */
const READABLE_PX = 16;
/** The view before a phone zoomed onto the block being written (C4); it comes back when the writing ends. */
let viewBeforeWriting: View | null = null;
watch(
    () => editor.editingTextId,
    async (id) => {
        if (!id) {
            document.removeEventListener('pointerdown', endOnOutside, true);
            if (viewBeforeWriting) setView(viewBeforeWriting);
            viewBeforeWriting = null;
            return;
        }
        document.addEventListener('pointerdown', endOnOutside, true);
        const writing = blocks.value.find((b) => b.id === id);
        // Only as far as the letters become readable, never more than the block's width – a bigger jump, together with the
        // keyboard coming, threw the slide about (user at the phone, 2026-10-09). Readable already: no zoom at all.
        if (!wide.value && writing?.type === 'text') {
            const onScreen = writing.style.fontSize * fit.value.scale;
            if (onScreen < READABLE_PX) {
                const zoom = (view.value.zoom * READABLE_PX) / onScreen;
                const fill = Math.min(0.9, (zoom * writing.width * baseFit.value.scale) / size.width);
                viewBeforeWriting = { ...view.value };
                setView(viewOnto(baseFit.value, writing, size, fill, 16));
            }
        }
        await nextTick();
        const el = textArea.value;
        if (!el) return;
        grow();
        el.focus();
        el.select();
    },
);
// Another size, font or width changes the lines: the field follows.
watch(
    () => [editingBlock.value?.style, editingBlock.value?.width],
    async () => {
        await nextTick();
        grow();
    },
    { deep: true },
);
onBeforeUnmount(() => document.removeEventListener('pointerdown', endOnOutside, true));
function onEmptyAction(b: Block): void {
    editor.selectBlock(b.id);
    void openContent();
}
</script>

<template>
    <div
        ref="host"
        class="editor-stage"
        :class="{ 'editor-stage--zoomed': view.zoom > 1, 'editor-stage--pinching': pinching }"
        data-quick-host
        @pointerdown.capture="onHostDownCapture"
        @pointermove.capture="onHostMoveCapture"
        @pointerup.capture="onHostUpCapture"
        @pointercancel.capture="onHostUpCapture"
        @pointerdown="onHostDown"
        @contextmenu="onContextMenu"
    >
        <!-- The soft shadow of the stage on the workspace (Plan.md 79, B3): the stage itself is clipped, so it lies beside it. -->
        <div
            v-if="editor.slide"
            class="stage-shadow"
            :style="{ left: `${fit.offsetX}px`, top: `${fit.offsetY}px`, width: `${editor.stage.width * fit.scale}px`, height: `${editor.stage.height * fit.scale}px` }"
        />
        <StageView v-if="editor.slide" :width="editor.stage.width" :height="editor.stage.height" :fit="fit">
            <SlideView
                :slide="editor.slide"
                :width="editor.stage.width"
                :height="editor.stage.height"
                :hidden-block-id="editor.editingTextId ?? undefined"
            />
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
                    :class="{ 'frame--selected': block.id === editor.selectedBlockId, 'frame--locked': block.locked, 'frame--tight': tight(block), 'frame--pressed': block.id === pressedId, 'frame--lifted': block.id === liftedId }"
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
                    :data-block-id="block.id"
                    @pointerdown="start($event, block, 'move')"
                    @pointermove="moveTo"
                    @pointerup="end"
                    @pointercancel="end"
                    @pointerenter="hoveredId = block.id"
                    @pointerleave="hoveredId = null"
                    @dblclick="onFrameDoubleClick"
                >
                    <!-- Shown by CSS where there is a pointer to hover with, never on the chosen block or while dragging (A4). -->
                    <span class="frame-name" :class="{ 'frame-name--inside': block.y < 32 / fit.scale, 'frame-name--touch': block.id === touchNameId && !dragId }">
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
                <!-- Only in the editor (C4): the hint of an empty text, and the field while it is written – same structure as the player's text. -->
                <div
                    v-for="b in placeholders"
                    :key="`ph${b.id}`"
                    class="text-box text-box--hint"
                    :style="{ ...textFrame(b), ...textStyle(b.style) }"
                    data-testid="text-placeholder"
                >
                    <div class="text-lines" :style="verticalStyle(verticalAlignOf(b) ?? 'top')">{{ t.editor.stage.textPlaceholder }}</div>
                </div>
                <div v-if="editingBlock" class="text-box" :style="{ ...textFrame(editingBlock), ...textStyle(editingBlock.style) }">
                    <textarea
                        ref="textArea"
                        class="text-lines text-field"
                        :style="verticalStyle(verticalAlignOf(editingBlock) ?? 'top')"
                        rows="1"
                        :value="editingBlock.text"
                        :placeholder="t.editor.stage.textPlaceholder"
                        :aria-label="t.editor.stage.textEdit"
                        data-testid="text-edit"
                        @input="onTextInput"
                        @keydown="onTextKey"
                        @pointerdown.stop
                        @dblclick.stop
                    />
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
        <!-- A long press on the empty stage with something copied (C3): paste right there. -->
        <div v-if="pasteMenu" class="paste-menu" :style="{ left: `${pasteMenu.left}px`, top: `${pasteMenu.top}px` }" @pointerdown.stop>
            <button class="d-btn" type="button" data-testid="paste-here" @click="pasteHere">{{ t.quick.pasteHere }}</button>
        </div>
        <button v-if="view.zoom > 1" class="d-btn zoom-reset" type="button" data-testid="zoom-reset" @pointerdown.stop @click="resetZoom">
            <Icon name="frame-fit" :size="16" /> {{ t.editor.stage.zoomReset }}
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
/* Zoomed in (C3): the host clips, and a finger moves the stage, not the page – as long as two fingers lie, too. */
.editor-stage--zoomed {
    overflow: hidden;
    touch-action: none;
}
.editor-stage--pinching {
    touch-action: none;
}
.zoom-reset,
.paste-menu {
    position: absolute;
    z-index: 15;
    box-shadow: var(--d-shadow);
    font-family: var(--d-font);
    white-space: nowrap;
}
.zoom-reset {
    right: 8px;
    bottom: 8px;
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
.text-box {
    position: absolute;
    z-index: 4;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    pointer-events: none;
}
.text-box--hint {
    opacity: 0.4;
}
/* While writing, lines beyond the block stay visible – the cursor must not vanish; the player still cuts them. */
.text-box:not(.text-box--hint) {
    overflow: visible;
}
.text-lines {
    flex: none;
}
/* The field takes everything from the box around it, so the lines fall as the player draws them. */
.text-field {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-height: 0;
    margin-inline: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    outline: none;
    background: none;
    resize: none;
    overflow: hidden;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
    line-height: inherit;
    text-align: inherit;
    text-transform: inherit;
    white-space: inherit;
    overflow-wrap: inherit;
    pointer-events: auto;
}
.text-field::placeholder {
    color: inherit;
    opacity: 0.4;
}
.frame {
    position: absolute;
    box-sizing: border-box;
    /* Only the chosen block takes a finger's drag; a swipe over the others scrolls the page (C3). */
    touch-action: pan-x pan-y;
    cursor: move;
    outline: var(--line) dashed rgba(148, 163, 184, 0.55);
}
.frame:hover {
    outline-color: rgba(96, 165, 250, 0.9);
}
.frame--selected,
.handle {
    touch-action: none;
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
.frame-name--touch {
    display: inline-flex;
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
/* Held and carried by a finger while zoomed: raised a little, so it is plain that the block, not the stage, moves. */
.frame--lifted {
    box-shadow: 0 calc(var(--s) * 6) calc(var(--s) * 18) rgba(15, 23, 42, 0.35);
}
/* A long press caught the block: a short flash of the frame. */
.frame--pressed {
    animation: frame-pressed 0.3s ease-out;
}
@keyframes frame-pressed {
    from {
        background: rgba(59, 130, 246, 0.35);
    }
    to {
        background: transparent;
    }
}
/* A fingertip needs a bigger grip than a mouse pointer – but the grip is the hit area below; seen, 16 screen pixels are enough (user at the phone, 2026-10-09: 24 were too big). */
@media (pointer: coarse) {
    .handle {
        width: calc(var(--handle) * 4 / 3);
        height: calc(var(--handle) * 4 / 3);
        margin: calc(var(--handle) * -2 / 3);
    }
    /* The area that catches a fingertip: 44 × 44 screen pixels around the middle of the handle. */
    .handle::before {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        width: calc(var(--s) * 44);
        height: calc(var(--s) * 44);
        transform: translate(-50%, -50%);
    }
}
/* On a block smaller than three fingertips the handles stand outside, half a hit area away (handlesOutside). */
.frame--tight .handle--nw { transform: translate(calc(var(--s) * -22), calc(var(--s) * -22)); }
.frame--tight .handle--n { transform: translateY(calc(var(--s) * -22)); }
.frame--tight .handle--ne { transform: translate(calc(var(--s) * 22), calc(var(--s) * -22)); }
.frame--tight .handle--e { transform: translateX(calc(var(--s) * 22)); }
.frame--tight .handle--se { transform: translate(calc(var(--s) * 22), calc(var(--s) * 22)); }
.frame--tight .handle--s { transform: translateY(calc(var(--s) * 22)); }
.frame--tight .handle--sw { transform: translate(calc(var(--s) * -22), calc(var(--s) * 22)); }
.frame--tight .handle--w { transform: translateX(calc(var(--s) * -22)); }
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
