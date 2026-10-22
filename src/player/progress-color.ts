/**
 * The colour of the presentation's progress bar – its number and pale track – follows the slide's background (Plan.md 109),
 * not the theme's text colour: dark text of a light design would vanish on a slide with a dark background.
 */
import type { SlideDoc } from '../model/schema';
import { textOn } from './format';

type Background = SlideDoc['background'];

/**
 * Which stop of a gradient lies at the bottom, where the bar sits: the last one when the gradient runs downwards (CSS
 * angle, 180° = to the bottom), else the first.
 */
export function gradientBottomColor(background: Extract<Background, { kind: 'linear-gradient' }>): string {
    const stops = background.stops;
    const down = Math.cos((background.angle * Math.PI) / 180) < 0;
    return (down ? stops[stops.length - 1] : stops[0])!.color;
}

/** Dark or white on a solid colour or a gradient's bottom; white with a dark shadow on a picture or video. */
export function progressTextColor(background: Background): { color: string; shadow: boolean } {
    if (background.kind === 'solid') return { color: textOn(background.color), shadow: false };
    if (background.kind === 'linear-gradient') return { color: textOn(gradientBottomColor(background)), shadow: false };
    return { color: '#ffffff', shadow: true };
}
