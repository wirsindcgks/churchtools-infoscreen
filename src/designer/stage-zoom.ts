import type { StageFit } from '../player/stage';

/** How far the stage is zoomed in the editor (Plan.md 79, C3): `zoom` from 1 (whole slide) to 4, `pan` the shift in host pixels. */
export interface View {
    zoom: number;
    panX: number;
    panY: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const WHOLE: View = { zoom: 1, panX: 0, panY: 0 };

interface Size {
    width: number;
    height: number;
}

/** The fit the stage is drawn with: the whole-slide fit, scaled by `zoom` and shifted by `pan`. */
export function zoomedFit(base: StageFit, view: View): StageFit {
    return { scale: base.scale * view.zoom, offsetX: base.offsetX + view.panX, offsetY: base.offsetY + view.panY };
}

/**
 * One axis of `clampPan`: the stage is `shown` pixels long where the host is `host`, and `margin` is the empty rim on this
 * side at zoom 1. A stage longer than the host covers it; a shorter one stays centred.
 */
function clampAxis(pan: number, margin: number, host: number, shown: number): number {
    const left = margin + pan;
    if (shown >= host) return Math.min(0, Math.max(host - shown, left)) - margin;
    return (host - shown) / 2 - margin;
}

/** Keeps the zoomed stage over the host as far as it goes, with no rim wider than at zoom 1; at zoom 1 the pan is 0. */
export function clampPan(base: StageFit, view: View, host: Size): View {
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom));
    if (zoom === MIN_ZOOM) return { ...WHOLE };
    const shownWidth = (host.width - 2 * base.offsetX) * zoom;
    const shownHeight = (host.height - 2 * base.offsetY) * zoom;
    return {
        zoom,
        panX: clampAxis(view.panX, base.offsetX, host.width, shownWidth),
        panY: clampAxis(view.panY, base.offsetY, host.height, shownHeight),
    };
}

/**
 * Zooms by `factor` around `point` (host pixels): the spot of the stage under it stays under it. The zoom stays within
 * 1 to 4; with `host` the pan is clamped as well.
 */
export function zoomAt(base: StageFit, view: View, point: { x: number; y: number }, factor: number, host?: Size): View {
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor));
    const ratio = zoom / view.zoom;
    const next: View = {
        zoom,
        panX: point.x - base.offsetX - (point.x - base.offsetX - view.panX) * ratio,
        panY: point.y - base.offsetY - (point.y - base.offsetY - view.panY) * ratio,
    };
    return host ? clampPan(base, next, host) : next;
}

/** The view that shows a stage rectangle `fill` wide (a share of the host's width), centred sideways, `top` pixels from the host's top. */
export function viewOnto(base: StageFit, rect: { x: number; y: number; width: number }, host: Size, fill: number, top: number): View {
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (fill * host.width) / (rect.width * base.scale)));
    const scale = base.scale * zoom;
    return clampPan(
        base,
        {
            zoom,
            panX: host.width / 2 - (rect.x + rect.width / 2) * scale - base.offsetX,
            panY: top - rect.y * scale - base.offsetY,
        },
        host,
    );
}
