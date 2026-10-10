/**
 * Sorting by dragging, the same everywhere (Plan.md 79, D7): the slides, the layers, and the lists of the inspector
 * (images, rooms, groups). On pointer events, so mouse, pen and finger share one path:
 *
 * - the mouse grabs the handle (`[data-sort-handle]`) and drags at once, after a few pixels so a click stays a click;
 * - a finger holds for 300 ms first – before that the list scrolls under it;
 * - while dragging, the others make room, and the list scrolls along at its edge;
 * - the keyboard focuses the handle and moves the row with the arrow keys, one place per press.
 *
 * The composable moves nothing in the data: it reports `onMove(from, to)` once per move – a single step in the
 * history. Items are the direct children of the container marked `[data-sort-item]`. `fixed` names rows that stay where
 * they are (a locked block): they cannot be dragged, the others pass them by.
 */
import { nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { reorderAround } from './ops';

/** How long a finger holds before the row comes loose. */
export const HOLD_MS = 300;
const MOUSE_SLOP = 3;
const TOUCH_SLOP = 8;
/** From this distance to the edge of the list it scrolls along; the nearer, the faster. */
const SCROLL_EDGE = 48;
const SCROLL_MAX = 16;
const ITEM = '[data-sort-item]';
const HANDLE = '[data-sort-handle]';
/** What inside a row keeps its own click when a finger holds the whole row. */
const INTERACTIVE = 'button, a, input, select, textarea, label, summary';

export interface SortableOptions {
    container: Ref<HTMLElement | null>;
    /** Called once when the row at `from` is dropped at `to` (as `move()` of the list reads it). */
    onMove: (from: number, to: number) => void;
    /** Rows that cannot be dragged and keep their place. */
    fixed?: (index: number) => boolean;
    /** The list runs from left to right (the slides on a phone). */
    horizontal?: () => boolean;
    /** A finger holds the whole row, not only the handle (a row without room for a handle). */
    touchOnRow?: boolean;
    /** The mouse grabs the whole row, not only the handle. */
    mouseOnRow?: () => boolean;
}

interface Drag {
    index: number;
    pointerId: number;
    elements: HTMLElement[];
    /** Start and size of each row along the axis, in the coordinates of the scrolled content. */
    spans: { start: number; size: number }[];
    gap: number;
    horizontal: boolean;
    scroller: HTMLElement | null;
    /** The pointer at the start and now, in client coordinates. */
    from: { x: number; y: number };
    at: { x: number; y: number };
    scrollFrom: { x: number; y: number };
    order: number[];
    /** Where the row would land among the others; what `onMove` is told. */
    to: number;
    frame: number;
}

interface Pending {
    index: number;
    item: HTMLElement;
    pointerId: number;
    touch: boolean;
    from: { x: number; y: number };
    timer: number | undefined;
}

function scrollerOf(el: HTMLElement): HTMLElement | null {
    for (let node: HTMLElement | null = el; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY) || /(auto|scroll)/.test(style.overflowX)) return node;
    }
    return null;
}

export function useSortable(options: SortableOptions): { dragging: Ref<number | null> } {
    const dragging = ref<number | null>(null);
    let pending: Pending | null = null;
    let drag: Drag | null = null;
    let stopClick = false;

    const rows = (): HTMLElement[] => [...(options.container.value?.querySelectorAll<HTMLElement>(`:scope > ${ITEM}`) ?? [])];
    const scrollNow = (d: Drag) => ({ x: d.scroller ? d.scroller.scrollLeft : window.scrollX, y: d.scroller ? d.scroller.scrollTop : window.scrollY });

    /** The grab: a mouse needs the handle (or the row, where there is none), a finger the handle or a held row. */
    function grabbed(target: HTMLElement, item: HTMLElement, touch: boolean): boolean {
        const handle = target.closest(HANDLE);
        if (handle && item.contains(handle)) return true;
        const onRow = touch ? options.touchOnRow : options.mouseOnRow?.();
        return !!onRow && !target.closest(INTERACTIVE);
    }

    function onPointerDown(event: PointerEvent): void {
        if (drag || pending || (event.pointerType === 'mouse' && event.button !== 0)) return;
        const target = event.target as HTMLElement | null;
        const item = target?.closest<HTMLElement>(ITEM);
        if (!target || !item || item.parentElement !== options.container.value) return;
        const touch = event.pointerType === 'touch';
        const index = rows().indexOf(item);
        if (index < 0 || options.fixed?.(index) || !grabbed(target, item, touch)) return;
        pending = { index, item, pointerId: event.pointerId, touch, from: { x: event.clientX, y: event.clientY }, timer: undefined };
        if (touch) pending.timer = window.setTimeout(() => pending && start(pending.from.x, pending.from.y), HOLD_MS);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerCancel);
        window.addEventListener('keydown', onEscape, true);
    }

    function start(x: number, y: number): Drag | null {
        const wait = pending;
        const container = options.container.value;
        if (!wait || !container) return null;
        window.clearTimeout(wait.timer);
        const elements = rows();
        const horizontal = options.horizontal?.() ?? false;
        const scroller = scrollerOf(container);
        const scrollFrom = { x: scroller ? scroller.scrollLeft : window.scrollX, y: scroller ? scroller.scrollTop : window.scrollY };
        const spans = elements.map((el) => {
            const rect = el.getBoundingClientRect();
            return horizontal ? { start: rect.left + scrollFrom.x, size: rect.width } : { start: rect.top + scrollFrom.y, size: rect.height };
        });
        const gap = elements.length < 2 ? 0 : wait.index < elements.length - 1 ? spans[wait.index + 1]!.start - spans[wait.index]!.start - spans[wait.index]!.size : spans[wait.index]!.start - spans[wait.index - 1]!.start - spans[wait.index - 1]!.size;
        drag = {
            index: wait.index,
            pointerId: wait.pointerId,
            elements,
            spans,
            gap,
            horizontal,
            scroller,
            from: { x, y },
            at: { x, y },
            scrollFrom,
            order: elements.map((_, i) => i),
            to: wait.index,
            frame: 0,
        };
        pending = null;
        dragging.value = wait.index;
        wait.item.setAttribute('data-sort-dragging', '');
        try {
            wait.item.setPointerCapture(wait.pointerId);
        } catch {
            // No capture (an old engine): the window's listeners still follow the pointer.
        }
        if (wait.touch) navigator.vibrate?.(10);
        update();
        drag.frame = requestAnimationFrame(tick);
        return drag;
    }

    /** Shifts the others to the order the dragged row would take, and the dragged row under the pointer. */
    function update(): void {
        const d = drag;
        if (!d) return;
        const scroll = scrollNow(d);
        const delta = d.horizontal ? d.at.x + scroll.x - (d.from.x + d.scrollFrom.x) : d.at.y + scroll.y - (d.from.y + d.scrollFrom.y);
        const own = d.spans[d.index]!;
        const centre = own.start + own.size / 2 + delta;
        const to = d.spans.filter((span, i) => i !== d.index && span.start + span.size / 2 < centre).length;
        d.to = to;
        d.order = reorderAround(d.elements.length, d.index, to, options.fixed);
        let cursor = d.spans[0]!.start;
        d.order.forEach((row) => {
            const span = d.spans[row]!;
            const el = d.elements[row]!;
            const shift = row === d.index ? delta : cursor - span.start;
            el.style.transition = row === d.index ? 'none' : '';
            el.style.transform = shift ? (d.horizontal ? `translateX(${shift}px)` : `translateY(${shift}px)`) : '';
            cursor += span.size + d.gap;
        });
    }

    /** At the edge of the list it scrolls along, faster the nearer the pointer is to the edge. */
    function tick(): void {
        const d = drag;
        if (!d) return;
        const box = d.scroller?.getBoundingClientRect();
        const low = (d.horizontal ? box?.left : box?.top) ?? 0;
        const high = (d.horizontal ? box?.right : box?.bottom) ?? (d.horizontal ? window.innerWidth : window.innerHeight);
        const pos = d.horizontal ? d.at.x : d.at.y;
        const speed = pos < low + SCROLL_EDGE ? -Math.min(1, (low + SCROLL_EDGE - pos) / SCROLL_EDGE) : pos > high - SCROLL_EDGE ? Math.min(1, (pos - (high - SCROLL_EDGE)) / SCROLL_EDGE) : 0;
        if (speed) {
            const step = Math.round(speed * SCROLL_MAX);
            if (!d.scroller) window.scrollBy(d.horizontal ? step : 0, d.horizontal ? 0 : step);
            else if (d.horizontal) d.scroller.scrollLeft += step;
            else d.scroller.scrollTop += step;
            update();
        }
        d.frame = requestAnimationFrame(tick);
    }

    function onPointerMove(event: PointerEvent): void {
        if (event.pointerId !== (drag?.pointerId ?? pending?.pointerId)) return;
        if (drag) {
            drag.at = { x: event.clientX, y: event.clientY };
            update();
            return;
        }
        if (!pending) return;
        const moved = Math.hypot(event.clientX - pending.from.x, event.clientY - pending.from.y);
        if (pending.touch) {
            // Moving before the hold is over means the finger scrolls.
            if (moved > TOUCH_SLOP) end(false);
        } else if (moved > MOUSE_SLOP) {
            const started = start(pending.from.x, pending.from.y);
            if (started) {
                started.at = { x: event.clientX, y: event.clientY };
                update();
            }
        }
    }

    function onPointerUp(event: PointerEvent): void {
        if (event.pointerId === (drag?.pointerId ?? pending?.pointerId)) end(true);
    }

    function onPointerCancel(event: PointerEvent): void {
        if (event.pointerId === (drag?.pointerId ?? pending?.pointerId)) end(false);
    }

    function onEscape(event: KeyboardEvent): void {
        if (event.key !== 'Escape' || !drag) return;
        event.stopPropagation();
        end(false);
    }

    /** The end of a grab: `drop` keeps the new order, otherwise the rows go back. */
    function end(drop: boolean): void {
        window.clearTimeout(pending?.timer);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);
        window.removeEventListener('keydown', onEscape, true);
        pending = null;
        const d = drag;
        drag = null;
        dragging.value = null;
        if (!d) return;
        cancelAnimationFrame(d.frame);
        const item = d.elements[d.index]!;
        try {
            item.releasePointerCapture(d.pointerId);
        } catch {
            // Already released.
        }
        item.removeAttribute('data-sort-dragging');
        // Back at once, without sliding: the data moves the rows now, and a slide would start from the old offsets.
        for (const el of d.elements) {
            el.style.transition = 'none';
            el.style.transform = '';
        }
        requestAnimationFrame(() => d.elements.forEach((el) => (el.style.transition = '')));
        // The click that ends a mouse drag must not select the row it ends on.
        stopClick = true;
        window.setTimeout(() => (stopClick = false), 0);
        if (drop && d.order[d.index] !== d.index) options.onMove(d.index, d.to);
    }

    function onTouchMove(event: TouchEvent): void {
        if (drag && event.cancelable) event.preventDefault();
    }

    function onContextMenu(event: Event): void {
        if (drag || pending?.touch) event.preventDefault();
    }

    function onClick(event: Event): void {
        if (!stopClick) return;
        event.stopPropagation();
        event.preventDefault();
    }

    /** Arrow keys on the focused handle move the row by one; over a fixed row they jump to the next place that changes the order. */
    function onKeyDown(event: KeyboardEvent): void {
        const target = event.target as HTMLElement | null;
        const handle = target?.closest(HANDLE);
        const item = handle?.closest<HTMLElement>(ITEM);
        if (!handle || !item || item.parentElement !== options.container.value) return;
        const horizontal = options.horizontal?.() ?? false;
        const forward = horizontal ? 'ArrowRight' : 'ArrowDown';
        const back = horizontal ? 'ArrowLeft' : 'ArrowUp';
        if (event.key !== forward && event.key !== back) return;
        event.preventDefault();
        const list = rows();
        const from = list.indexOf(item);
        const step = event.key === forward ? 1 : -1;
        if (from < 0 || options.fixed?.(from)) return;
        for (let to = from + step; to >= 0 && to < list.length; to += step) {
            const order = reorderAround(list.length, from, to, options.fixed);
            if (order[from] === from) continue;
            options.onMove(from, to);
            // Moving the row in the document drops the focus; the handle gets it back at its new place.
            void nextTick(() => rows()[order.indexOf(from)]?.querySelector<HTMLElement>(HANDLE)?.focus());
            return;
        }
    }

    watch(
        options.container,
        (el, old) => {
            if (old) detach(old);
            if (el) {
                el.addEventListener('pointerdown', onPointerDown);
                el.addEventListener('keydown', onKeyDown);
                el.addEventListener('touchmove', onTouchMove, { passive: false });
                el.addEventListener('contextmenu', onContextMenu);
                el.addEventListener('click', onClick, true);
            }
        },
        { immediate: true, flush: 'post' },
    );

    function detach(el: HTMLElement): void {
        el.removeEventListener('pointerdown', onPointerDown);
        el.removeEventListener('keydown', onKeyDown);
        el.removeEventListener('touchmove', onTouchMove);
        el.removeEventListener('contextmenu', onContextMenu);
        el.removeEventListener('click', onClick, true);
    }

    onBeforeUnmount(() => {
        end(false);
        if (options.container.value) detach(options.container.value);
    });

    return { dragging };
}
