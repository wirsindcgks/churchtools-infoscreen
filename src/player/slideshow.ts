/**
 * The slideshow block's transition and picture motion (schema 1.19, Plan.md, Nächste Schritte 55 D). The
 * transition `zoom` of 1.15 is no longer offered; old data stays valid and counts as a fade with a slow zoom in.
 */
import type { Block } from '../model/schema';

type SlideshowBlock = Extract<Block, { type: 'slideshow' }>;
type Transition = Exclude<SlideshowBlock['transition'], 'zoom'>;
export type PictureMotion = 'none' | 'in' | 'out';

/** The transition as played: the old `zoom` is a fade. */
export function effectiveTransition(block: Pick<SlideshowBlock, 'transition'>): Transition {
    return block.transition === 'zoom' ? 'fade' : block.transition;
}

/** The motion as set; the old transition `zoom` without one counts as zooming in. */
export function effectiveMotion(block: Pick<SlideshowBlock, 'transition' | 'motion'>): SlideshowBlock['motion'] {
    return block.motion === 'none' && block.transition === 'zoom' ? 'in' : block.motion;
}

/** How the `turn`-th picture since the start moves while it stands: `alternate` zooms in on even turns and out on odd ones. */
export function pictureMotion(block: Pick<SlideshowBlock, 'transition' | 'motion'>, turn: number): PictureMotion {
    const motion = effectiveMotion(block);
    if (motion === 'alternate') return turn % 2 === 0 ? 'in' : 'out';
    return motion;
}
