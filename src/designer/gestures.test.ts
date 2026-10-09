import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isDoubleTap, longPress } from './gestures';

const tap = (x: number, y: number, time: number, target = 'a') => ({ x, y, time, target });

describe('isDoubleTap', () => {
    it('needs two taps within 300 ms and 10 px on the same target', () => {
        expect(isDoubleTap(tap(10, 10, 1000), tap(14, 13, 1250))).toBe(true);
        expect(isDoubleTap(tap(10, 10, 1000), tap(10, 10, 1301))).toBe(false);
        expect(isDoubleTap(tap(10, 10, 1000), tap(30, 10, 1100))).toBe(false);
        expect(isDoubleTap(tap(10, 10, 1000), tap(10, 10, 1100, 'b'))).toBe(false);
        expect(isDoubleTap(null, tap(10, 10, 1100))).toBe(false);
    });
});

describe('longPress', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('fires after 500 ms without moving', () => {
        const fire = vi.fn();
        const press = longPress(fire);
        press.start(100, 100);
        press.move(104, 103);
        vi.advanceTimersByTime(499);
        expect(fire).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        expect(fire).toHaveBeenCalledOnce();
    });

    it('is a drag or scroll once the finger moves beyond 10 px', () => {
        const fire = vi.fn();
        const press = longPress(fire);
        press.start(100, 100);
        press.move(100, 120);
        vi.advanceTimersByTime(1000);
        expect(fire).not.toHaveBeenCalled();
    });

    it('stops on cancel', () => {
        const fire = vi.fn();
        const press = longPress(fire);
        press.start(0, 0);
        press.cancel();
        vi.advanceTimersByTime(1000);
        expect(fire).not.toHaveBeenCalled();
    });
});
