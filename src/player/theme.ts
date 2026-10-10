/**
 * The theme on the stage (schema 1.9, Plan.md, Nächste Schritte 27): what
 * the blocks take from it – corners, accent colour, the default layout of
 * the appointment blocks and the shape of their images.
 */
import { DEFAULT_THEME, IMAGE_RATIOS, type Block, type ThemeDoc } from '../model/schema';

/**
 * The surface of the cards (Plan.md 74). `currentColor` in an unregistered
 * variable is resolved only on the element where `var()` stands – the tint
 * follows the card's text colour, as it always did.
 */
export function cardBackground(theme: ThemeDoc): string {
    if (theme.cards === 'none') return 'transparent';
    if (theme.cards === 'color') return `color-mix(in srgb, ${theme.cardColor} ${theme.cardOpacity}%, transparent)`;
    return 'color-mix(in srgb, currentColor 7%, transparent)';
}

/** CSS variables on the slide; the blocks' styles read them. */
export function themeVars(theme: ThemeDoc): Record<string, string> {
    const round = theme.corners === 'round';
    return {
        '--isd-accent': theme.accent,
        '--isd-radius': round ? '0.3em' : '0',
        '--isd-pill': round ? '999px' : '0',
        '--isd-card': cardBackground(theme),
    };
}

/**
 * The colours of the loading screen: the theme's, as soon as one is known –
 * from the device's last saved state, which the player reads first thing –
 * and the theme's defaults on a device's very first start.
 */
export function loadingVars(theme: ThemeDoc | null | undefined): Record<string, string> {
    const { accent, text, background } = theme ?? DEFAULT_THEME;
    return { '--load-accent': accent, '--load-text': text, '--load-bg': background };
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
