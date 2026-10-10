/** Finger gestures as plain functions (Plan.md 79, C3): the double tap and the long press. */

export const DOUBLE_TAP_MS = 300;
export const LONG_PRESS_MS = 500;
/** A finger that moves farther than this has not tapped or pressed, it drags or scrolls. */
export const TAP_SLOP = 10;

/** A finger lifted: where, when, and what it stood on (a block's id, or "empty"). */
export interface Tap {
    x: number;
    y: number;
    time: number;
    target: string;
}

/** Two taps within 300 ms and 10 px on the same target. */
export function isDoubleTap(prev: Tap | null, next: Tap): boolean {
    if (!prev || prev.target !== next.target) return false;
    return next.time - prev.time <= DOUBLE_TAP_MS && Math.hypot(next.x - prev.x, next.y - prev.y) <= TAP_SLOP;
}

/** Fires `onPress` when a finger has stayed within 10 px for 500 ms; `move` beyond that, `cancel` or a lifted finger stops it. */
export function longPress(onPress: () => void, ms = LONG_PRESS_MS, slop = TAP_SLOP) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let origin = { x: 0, y: 0 };
    function cancel(): void {
        clearTimeout(timer);
        timer = undefined;
    }
    return {
        start(x: number, y: number): void {
            cancel();
            origin = { x, y };
            timer = setTimeout(() => {
                timer = undefined;
                onPress();
            }, ms);
        },
        move(x: number, y: number): void {
            if (timer !== undefined && Math.hypot(x - origin.x, y - origin.y) > slop) cancel();
        },
        cancel,
    };
}
