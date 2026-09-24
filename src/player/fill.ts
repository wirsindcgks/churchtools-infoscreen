import type { Fill } from '../model/schema';

export function fillStyle(fill: Fill): Record<string, string> {
    if (fill.kind === 'solid') return { background: fill.color };
    const stops = fill.stops.map((s) => `${s.color} ${Math.round(s.at * 100)}%`).join(', ');
    return { background: `linear-gradient(${fill.angle}deg, ${stops})` };
}
