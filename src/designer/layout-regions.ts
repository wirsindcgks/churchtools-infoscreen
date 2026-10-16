/**
 * The areas a slide's division (schema 1.42, Plan.md 87 B) marks on the stage: a guide for placing blocks.
 * Everything is in stage pixels.
 */
import type { SlideLayout } from '../model/schema';
import type { Frame } from './snap';

/** Margin and gap between the areas, as a share of the stage's shorter side. */
export const REGION_MARGIN = 0.04;
/** The header's height, as a share of the stage's height. */
export const HEADER_SHARE = 0.14;
/** The footer's height, as a share of the stage's height. */
export const FOOTER_SHARE = 0.1;

/** The share of a block's area that fills an area its centre is not in. */
export const FILL_SHARE = 0.4;

export type RegionId = 'header' | 'footer' | 'main' | 'a' | 'b';

export interface Region extends Frame {
    id: RegionId;
}

/** A block whose place cannot be changed on the stage: locked, or fixed in an area of the division. */
export function frameFixed(b: { locked?: boolean; region?: RegionId }): boolean {
    return !!b.locked || !!b.region;
}

/** The area a block's centre lies in, if any. */
export function regionAt(regions: readonly Region[], b: Frame): Region | undefined {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    return regions.find((r) => cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height);
}

/**
 * Blocks fixed in an area (`region`) take that area's frame in a new division – a template block only its upper left corner, it keeps
 * its size. Where the area is gone the block is free and stays as it is. Other blocks come back as they are.
 */
export function fitToRegions<T extends Frame & { type: string; region?: RegionId }>(blocks: readonly T[], regions: readonly Region[]): T[] {
    return blocks.map((b) => {
        if (!b.region) return b;
        const area = regions.find((r) => r.id === b.region);
        if (!area) {
            const free = { ...b };
            delete free.region;
            return free;
        }
        return b.type === 'template' ? { ...b, x: area.x, y: area.y } : { ...b, x: area.x, y: area.y, width: area.width, height: area.height };
    });
}

/**
 * The areas of a layout: header and footer across the width, `split` divides the room between them – landscape into
 * columns, portrait into rows. Without a division and without header and footer there are none.
 */
export function layoutRegions(layout: SlideLayout | undefined, stage: { width: number; height: number }): Region[] {
    const split = layout?.split ?? 'none';
    const header = layout?.header ?? false;
    const footer = layout?.footer ?? false;
    if (split === 'none' && !header && !footer) return [];
    const margin = Math.round(Math.min(stage.width, stage.height) * REGION_MARGIN);
    const width = stage.width - 2 * margin;
    const regions: Region[] = [];
    let top = margin;
    let bottom = stage.height - margin;
    if (header) {
        const height = Math.round(stage.height * HEADER_SHARE);
        regions.push({ id: 'header', x: margin, y: top, width, height });
        top += height + margin;
    }
    if (footer) {
        const height = Math.round(stage.height * FOOTER_SHARE);
        regions.push({ id: 'footer', x: margin, y: bottom - height, width, height });
        bottom -= height + margin;
    }
    const room = { x: margin, y: top, width, height: bottom - top };
    if (split === 'none') {
        regions.push({ id: 'main', ...room });
    } else {
        const first = split === 'halves' ? 1 / 2 : split === 'wide-narrow' ? 2 / 3 : 1 / 3;
        if (stage.width >= stage.height) {
            const a = Math.round((room.width - margin) * first);
            regions.push({ id: 'a', x: room.x, y: room.y, width: a, height: room.height });
            regions.push({ id: 'b', x: room.x + a + margin, y: room.y, width: room.width - margin - a, height: room.height });
        } else {
            const a = Math.round((room.height - margin) * first);
            regions.push({ id: 'a', x: room.x, y: room.y, width: room.width, height: a });
            regions.push({ id: 'b', x: room.x, y: room.y + a + margin, width: room.width, height: room.height - margin - a });
        }
    }
    return regions;
}

/**
 * The areas no block fills: none has its centre in it or at least `FILL_SHARE` of its area – so a block across two
 * columns, centred in the gap (a little under half in each), fills both. Locked, hidden and template blocks count like any other; a block fixed in an area always fills it.
 */
export function emptyRegions(regions: readonly Region[], blocks: readonly (Frame & { region?: RegionId })[]): Region[] {
    return regions.filter((r) => !blocks.some((b) => b.region === r.id || fills(b, r)));
}

function fills(b: Frame, r: Region): boolean {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    if (cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height) return true;
    const w = Math.min(b.x + b.width, r.x + r.width) - Math.max(b.x, r.x);
    const h = Math.min(b.y + b.height, r.y + r.height) - Math.max(b.y, r.y);
    return w > 0 && h > 0 && w * h >= b.width * b.height * FILL_SHARE;
}
