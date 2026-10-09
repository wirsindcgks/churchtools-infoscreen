import type { Fill } from '../model/schema';

/** The same fill in another kind: the colour carries over (a gradient starts from it and runs to black). */
export function fillOfKind(fill: Fill, kind: Fill['kind']): Fill {
    if (fill.kind === kind) return fill;
    const base = fill.kind === 'solid' ? fill.color : fill.stops[0]!.color;
    return kind === 'solid'
        ? { kind: 'solid', color: base }
        : { kind: 'linear-gradient', angle: 135, stops: [{ color: base, at: 0 }, { color: '#000000', at: 1 }] };
}
