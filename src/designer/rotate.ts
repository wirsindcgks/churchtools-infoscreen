/**
 * Turned blocks on the stage (Plan.md F1). Pure arithmetic: a block turns about the middle of its frame, so its frame
 * (x, y, width, height) stays as stored and only the picture on the stage is turned. Everywhere positions are compared
 * – snapping, alignment, clamping, selecting – the box around the turned frame counts.
 */

export interface RotatedFrame {
    x: number;
    y: number;
    width: number;
    height: number;
    /** Degrees, clockwise; missing means 0. */
    rotation?: number;
}

type Frame = Pick<RotatedFrame, 'x' | 'y' | 'width' | 'height'>;
export type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export const MIN_BLOCK_SIZE = 20;

const RAD = Math.PI / 180;
/** Rounded to a thousandth, so 90° does not leave 1e-14 of noise in a position. */
const tidy = (n: number): number => Math.round(n * 1000) / 1000;

/** The upright box around a turned frame; the frame itself when it is not turned. */
export function outerFrame(frame: RotatedFrame): Frame {
    const { x, y, width, height } = frame;
    if (!frame.rotation) return { x, y, width, height };
    const cos = Math.abs(Math.cos(frame.rotation * RAD));
    const sin = Math.abs(Math.sin(frame.rotation * RAD));
    const w = tidy(width * cos + height * sin);
    const h = tidy(width * sin + height * cos);
    return { x: tidy(x + width / 2 - w / 2), y: tidy(y + height / 2 - h / 2), width: w, height: h };
}

/** Within this many degrees of a multiple of 45° the angle snaps to it. */
export const ANGLE_SNAP = 5;

/** Whole degrees in -180 … 180 (180 and -180 are the same turn: 180); snapped to multiples of 45° near them unless `free`. */
export function snapAngle(deg: number, free: boolean): number {
    let d = ((((deg + 180) % 360) + 360) % 360) - 180;
    if (!free) {
        const nearest = Math.round(d / 45) * 45;
        if (Math.abs(d - nearest) < ANGLE_SNAP) d = nearest;
    }
    d = Math.round(d);
    return d === -180 ? 180 : d;
}

/**
 * The frame after a handle was dragged by (dx, dy) on the stage. The pointer's way is turned into the block's own axes,
 * width and height change there, and the opposite corner or edge stays where it is on the stage.
 */
export function resizeRotated(frame: Frame, rotation: number, handle: ResizeHandle, dx: number, dy: number): Frame {
    const cos = Math.cos(rotation * RAD);
    const sin = Math.sin(rotation * RAD);
    const lx = dx * cos + dy * sin;
    const ly = -dx * sin + dy * cos;
    let width = frame.width;
    let height = frame.height;
    if (handle.includes('e')) width += lx;
    if (handle.includes('w')) width -= lx;
    if (handle.includes('s')) height += ly;
    if (handle.includes('n')) height -= ly;
    width = Math.max(MIN_BLOCK_SIZE, Math.round(width));
    height = Math.max(MIN_BLOCK_SIZE, Math.round(height));
    // The fixed point, relative to the middle: before and after the change.
    const sx = handle.includes('e') ? -1 : handle.includes('w') ? 1 : 0;
    const sy = handle.includes('s') ? -1 : handle.includes('n') ? 1 : 0;
    const turn = (px: number, py: number) => ({ x: px * cos - py * sin, y: px * sin + py * cos });
    const before = turn((sx * frame.width) / 2, (sy * frame.height) / 2);
    const after = turn((sx * width) / 2, (sy * height) / 2);
    const cx = frame.x + frame.width / 2 + before.x - after.x;
    const cy = frame.y + frame.height / 2 + before.y - after.y;
    return { x: Math.round(cx - width / 2), y: Math.round(cy - height / 2), width, height };
}
