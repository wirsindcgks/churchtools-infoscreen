import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { HOLD_MS, useSortable } from './useSortable';

const moves: [number, number][] = [];

/** Three rows of 40 px; jsdom has no layout, so the rectangles are given. */
const List = defineComponent({
    props: { fixed: { type: Array as () => number[], default: () => [] } },
    setup(props) {
        const list = ref<HTMLElement | null>(null);
        useSortable({
            container: list,
            fixed: (i) => props.fixed.includes(i),
            onMove: (from, to) => moves.push([from, to]),
        });
        return () =>
            h('ol', { ref: list }, [
                ...['A', 'B', 'C'].map((name) =>
                    h('li', { key: name, 'data-sort-item': '', 'data-testid': `row-${name}` }, [
                        h('button', { 'data-sort-handle': '', 'data-testid': `handle-${name}` }, '⋮⋮'),
                        h('span', { 'data-testid': `label-${name}` }, name),
                    ]),
                ),
            ]);
    },
});

async function mountList(props: { fixed?: number[] } = {}) {
    const wrapper = mount(List, { props, attachTo: document.body });
    wrapper.findAll('li').forEach((li, i) => {
        li.element.getBoundingClientRect = () => ({ top: i * 40, bottom: i * 40 + 40, left: 0, right: 100, width: 100, height: 40, x: 0, y: i * 40, toJSON: () => ({}) });
    });
    await nextTick();
    return wrapper;
}

function pointer(type: string, target: EventTarget, y: number, kind: 'mouse' | 'touch' = 'mouse', x = 10): void {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
    Object.assign(event, { pointerId: 1, pointerType: kind });
    target.dispatchEvent(event);
}

describe('useSortable (Plan.md 79, D7)', () => {
    beforeEach(() => {
        moves.length = 0;
        vi.useFakeTimers();
        vi.stubGlobal('requestAnimationFrame', () => 0);
        vi.stubGlobal('cancelAnimationFrame', () => {});
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    it('drags with the mouse at once by the handle and reports one move', async () => {
        const wrapper = await mountList();
        const handle = wrapper.get('[data-testid="handle-A"]').element;
        pointer('pointerdown', handle, 20);
        pointer('pointermove', window, 40);
        pointer('pointermove', window, 70);
        pointer('pointerup', window, 70);
        expect(moves).toEqual([[0, 1]]);
    });

    it('gives the row back when it is dropped where it was, or when Escape comes', async () => {
        const wrapper = await mountList();
        const handle = wrapper.get('[data-testid="handle-A"]').element;
        pointer('pointerdown', handle, 20);
        pointer('pointermove', window, 25);
        pointer('pointerup', window, 25);
        pointer('pointerdown', handle, 20);
        pointer('pointermove', window, 90);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        pointer('pointerup', window, 90);
        expect(moves).toEqual([]);
    });

    it('does not drag by the row with the mouse, only by the handle', async () => {
        const wrapper = await mountList();
        pointer('pointerdown', wrapper.get('[data-testid="label-A"]').element, 20);
        pointer('pointermove', window, 90);
        pointer('pointerup', window, 90);
        expect(moves).toEqual([]);
    });

    it('lets a finger drag only after the hold, and scroll before it', async () => {
        const wrapper = await mountList();
        const handle = wrapper.get('[data-testid="handle-A"]').element;
        // Moves before the hold is over: the list scrolls, nothing is dragged.
        pointer('pointerdown', handle, 20, 'touch');
        vi.advanceTimersByTime(HOLD_MS - 50);
        pointer('pointermove', window, 90, 'touch');
        vi.advanceTimersByTime(HOLD_MS);
        pointer('pointermove', window, 100, 'touch');
        pointer('pointerup', window, 100, 'touch');
        expect(moves).toEqual([]);
        // Held for the full time, then moved.
        pointer('pointerdown', handle, 20, 'touch');
        vi.advanceTimersByTime(HOLD_MS);
        pointer('pointermove', window, 110, 'touch');
        pointer('pointerup', window, 110, 'touch');
        expect(moves).toEqual([[0, 2]]);
    });

    it('moves a row by one with the arrow keys on its handle', async () => {
        const wrapper = await mountList();
        await wrapper.get('[data-testid="handle-B"]').trigger('keydown', { key: 'ArrowUp' });
        await wrapper.get('[data-testid="handle-B"]').trigger('keydown', { key: 'ArrowDown' });
        await wrapper.get('[data-testid="handle-C"]').trigger('keydown', { key: 'ArrowDown' });
        expect(moves).toEqual([[1, 0], [1, 2]]);
    });

    it('keeps a fixed row in its place: it cannot be dragged, the others pass it by', async () => {
        const wrapper = await mountList({ fixed: [1] });
        pointer('pointerdown', wrapper.get('[data-testid="handle-B"]').element, 60);
        pointer('pointermove', window, 100);
        pointer('pointerup', window, 100);
        expect(moves).toEqual([]);
        // A goes past B (fixed) to the end: the arrow key jumps over it.
        await wrapper.get('[data-testid="handle-A"]').trigger('keydown', { key: 'ArrowDown' });
        expect(moves).toEqual([[0, 2]]);
    });

    describe('in a grid', () => {
        /** Four tiles of 100 × 40 in two columns: A B above, C D below. */
        const Grid = defineComponent({
            setup() {
                const list = ref<HTMLElement | null>(null);
                useSortable({ container: list, grid: () => true, mouseOnRow: () => true, touchOnRow: true, onMove: (from, to) => moves.push([from, to]) });
                return () =>
                    h('ol', { ref: list }, ['A', 'B', 'C', 'D'].map((name) => h('li', { key: name, 'data-sort-item': '', 'data-testid': `tile-${name}` }, name)));
            },
        });
        async function mountGrid() {
            const wrapper = mount(Grid, { attachTo: document.body });
            wrapper.findAll('li').forEach((li, i) => {
                const x = (i % 2) * 100;
                const y = Math.floor(i / 2) * 40;
                li.element.getBoundingClientRect = () => ({ top: y, bottom: y + 40, left: x, right: x + 100, width: 100, height: 40, x, y, toJSON: () => ({}) });
            });
            await nextTick();
            return wrapper;
        }

        it('lands on the place whose centre is nearest, with the mouse at once and the others moving onto their places', async () => {
            const wrapper = await mountGrid();
            const a = wrapper.get('[data-testid="tile-A"]').element;
            pointer('pointerdown', a, 20, 'mouse', 50);
            pointer('pointermove', window, 30, 'mouse', 90);
            pointer('pointermove', window, 55, 'mouse', 140);
            // A's centre is at (140, 55) now: nearest to D's centre (150, 60); B and C rise into the places of A and B.
            expect((wrapper.get('[data-testid="tile-B"]').element as HTMLElement).style.transform).toBe('translate(-100px, 0px)');
            expect((wrapper.get('[data-testid="tile-C"]').element as HTMLElement).style.transform).toBe('translate(100px, -40px)');
            expect((wrapper.get('[data-testid="tile-D"]').element as HTMLElement).style.transform).toBe('translate(-100px, 0px)');
            pointer('pointerup', window, 55, 'mouse', 140);
            expect(moves).toEqual([[0, 3]]);
        });

        it('drops on the neighbour beside it and not at all when it stays near its own place', async () => {
            const wrapper = await mountGrid();
            const c = wrapper.get('[data-testid="tile-C"]').element;
            pointer('pointerdown', c, 60, 'mouse', 50);
            pointer('pointermove', window, 60, 'mouse', 140);
            pointer('pointerup', window, 60, 'mouse', 140);
            expect(moves).toEqual([[2, 3]]);
            moves.length = 0;
            pointer('pointerdown', c, 60, 'mouse', 50);
            pointer('pointermove', window, 50, 'mouse', 60);
            pointer('pointerup', window, 50, 'mouse', 60);
            expect(moves).toEqual([]);
        });

        it('lets a finger drag a tile only after the hold', async () => {
            const wrapper = await mountGrid();
            const b = wrapper.get('[data-testid="tile-B"]').element;
            pointer('pointerdown', b, 20, 'touch', 150);
            vi.advanceTimersByTime(HOLD_MS);
            pointer('pointermove', window, 60, 'touch', 50);
            pointer('pointerup', window, 60, 'touch', 50);
            expect(moves).toEqual([[1, 2]]);
        });
    });
});
