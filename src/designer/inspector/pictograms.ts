/**
 * Small pictures for the tiles of a `TileField` (Plan.md 79, B2): inline SVG on a 48 × 32 field, drawn with the text
 * colour, so they follow a dark theme. Each is a list of paths; `fill` paths are drawn solid.
 */
export interface PictogramPath {
    d: string;
    fill?: boolean;
}

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

export const PICTOGRAMS = {
    // The clock block: only the time, only the date, both.
    'clock-time': [{ d: circle(24, 16, 11) }, { d: 'M24 9v7l5 3' }],
    'clock-date': [{ d: 'M13 5h22a2 2 0 0 1 2 2v19a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z' }, { d: 'M11 12h26' }, { d: 'M18 3v4' }, { d: 'M30 3v4' }, { d: circle(24, 20, 2), fill: true }],
    'clock-datetime': [
        { d: 'M7 5h22a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z' },
        { d: 'M5 11h26' },
        { d: circle(35, 22, 8) },
        { d: 'M35 17v5l3.5 2' },
    ],
} as const satisfies Record<string, readonly PictogramPath[]>;

export type PictogramName = keyof typeof PICTOGRAMS;
