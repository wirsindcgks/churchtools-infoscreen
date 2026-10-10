/**
 * The crop of a picture at "Füllen" (Plan.md F2). Pure arithmetic: `x` and `y` are the place as in CSS `object-position`
 * (0 = the left or top edge of the picture at the frame, 100 = the right or bottom edge), `zoom` enlarges about that point.
 */

export interface Crop {
    x: number;
    y: number;
    zoom: number;
}

export const NO_CROP: Crop = { x: 50, y: 50, zoom: 1 };

interface Size {
    width: number;
    height: number;
}

const clamp = (n: number): number => Math.min(100, Math.max(0, Math.round(n * 100) / 100));

/**
 * The crop after the picture was dragged by (dx, dy) stage pixels: it follows the finger. On each axis the picture
 * overhangs the frame by `zoom · R − B` (R = the picture's size there at "Füllen", B = the frame's); the place moves by
 * the drag over that overhang. Without an overhang the place stays.
 */
export function cropPan(crop: Crop | undefined, box: Size, natural: Size, dx: number, dy: number): Crop {
    const current = crop ?? NO_CROP;
    if (!natural.width || !natural.height) return current;
    const fill = Math.max(box.width / natural.width, box.height / natural.height);
    const overX = current.zoom * natural.width * fill - box.width;
    const overY = current.zoom * natural.height * fill - box.height;
    return {
        zoom: current.zoom,
        x: overX > 0.5 ? clamp(current.x - (dx / overX) * 100) : current.x,
        y: overY > 0.5 ? clamp(current.y - (dy / overY) * 100) : current.y,
    };
}
