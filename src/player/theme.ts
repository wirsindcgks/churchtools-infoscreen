/**
 * The theme on the stage (schema 1.9, Plan.md, Nächste Schritte 27): what
 * the blocks take from it – corners, accent colour, the default layout of
 * the appointment blocks and the shape of their images.
 */
import { IMAGE_RATIOS, type Block, type ThemeDoc } from '../model/schema';

/** CSS variables on the slide; the blocks' styles read them. */
export function themeVars(theme: ThemeDoc): Record<string, string> {
    const round = theme.corners === 'round';
    return {
        '--isd-accent': theme.accent,
        '--isd-radius': round ? '0.3em' : '0',
        '--isd-pill': round ? '999px' : '0',
    };
}

type ListBlock = Extract<Block, { type: 'appointment-list' }>;
type NextBlock = Extract<Block, { type: 'next-appointment' }>;

/** A block's own layout wins; without one the theme decides. */
export function listLayout(block: ListBlock, theme: ThemeDoc): 'rows' | 'cards' {
    return block.layout ?? (theme.appointments === 'large' ? 'cards' : 'rows');
}

export function nextLayout(block: NextBlock, theme: ThemeDoc): 'classic' | 'card' {
    return block.layout ?? (theme.appointments === 'large' ? 'card' : 'classic');
}

/**
 * The largest box of the theme's image shape within `maxWidth` × `maxHeight`,
 * in whole pixels; null for `free`, where the image keeps its own shape.
 */
export function imageBox(
    ratio: ThemeDoc['imageRatio'],
    maxWidth: number,
    maxHeight: number,
): { width: number; height: number } | null {
    if (ratio === 'free') return null;
    const r = IMAGE_RATIOS[ratio];
    const width = Math.max(1, Math.min(maxWidth, maxHeight * r));
    return { width: Math.round(width), height: Math.round(width / r) };
}
