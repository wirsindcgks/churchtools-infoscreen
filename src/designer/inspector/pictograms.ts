/**
 * Small pictures for the tiles of a `TileField` (Plan.md 79, B2): inline SVG on a 48 × 32 field, drawn with the text
 * colour, so they follow a dark theme. Each is a list of paths; `fill` paths are drawn solid.
 */
export interface PictogramPath {
    d: string;
    fill?: boolean;
}

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
/** A rectangle with rounded corners, as a path. */
const box = (x: number, y: number, w: number, h: number, r = 1.5) =>
    `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${2 * r - w}a${r} ${r} 0 0 1 ${-r} ${-r}v${2 * r - h}a${r} ${r} 0 0 1 ${r} ${-r}z`;
/** A line of text, as a bar. */
const bar = (x: number, y: number, w: number) => `M${x} ${y}h${w}`;

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

    // The appointment list: lines of date and title, or one card per appointment with the date tile at its left.
    'list-rows': [
        { d: bar(6, 8, 8) }, { d: bar(18, 8, 24) },
        { d: bar(6, 16, 8) }, { d: bar(18, 16, 24) },
        { d: bar(6, 24, 8) }, { d: bar(18, 24, 24) },
    ],
    'list-cards': [
        { d: box(5, 3, 38, 7) }, { d: box(7, 5, 4, 3, 0.5), fill: true },
        { d: box(5, 12.5, 38, 7) }, { d: box(7, 14.5, 4, 3, 0.5), fill: true },
        { d: box(5, 22, 38, 7) }, { d: box(7, 24, 4, 3, 0.5), fill: true },
    ],
    // The next appointment: plain lines, or a highlighted card with the image at its left.
    'next-classic': [{ d: bar(8, 9, 14) }, { d: bar(8, 16, 32) }, { d: bar(8, 23, 24) }],
    'next-card': [{ d: box(5, 4, 38, 24) }, { d: box(8, 7, 14, 18), fill: true }, { d: bar(26, 11, 13) }, { d: bar(26, 17, 11) }, { d: bar(26, 23, 8) }],
    // Posts and groups: a highlighted card with the image above, or a list with a thumbnail per row.
    'card-image': [{ d: box(10, 3, 28, 26) }, { d: box(13, 6, 22, 11), fill: true }, { d: bar(13, 22, 18) }, { d: bar(13, 26, 12) }],
    'list-thumbs': [
        { d: box(5, 4, 8, 6, 1), fill: true }, { d: bar(17, 7, 26) },
        { d: box(5, 13, 8, 6, 1), fill: true }, { d: bar(17, 16, 26) },
        { d: box(5, 22, 8, 6, 1), fill: true }, { d: bar(17, 25, 26) },
    ],
    // The rooms: all of them in a table, or the door sign of one.
    'rooms-overview': [
        { d: box(5, 3, 38, 26) }, { d: 'M5 11h38' }, { d: 'M18 11v18' },
        { d: bar(8, 7, 7) }, { d: bar(8, 17, 7) }, { d: bar(8, 24, 7) }, { d: bar(22, 17, 17) }, { d: bar(22, 24, 12) },
    ],
    'rooms-door': [{ d: box(12, 3, 24, 26) }, { d: bar(17, 10, 14) }, { d: bar(17, 17, 10) }, { d: box(17, 22, 14, 3, 0.5), fill: true }],
    // The transitions of the gallery, as one still picture each.
    'transition-fade': [{ d: box(5, 6, 26, 20) }, { d: box(17, 6, 26, 20) }],
    'transition-slide': [{ d: box(5, 6, 22, 20) }, { d: box(29, 6, 14, 20) }, { d: 'M14 16h10m-4-4 4 4-4 4' }],
    'transition-wipe': [{ d: box(5, 6, 38, 20) }, { d: box(5, 6, 20, 20), fill: true }, { d: 'M25 6v20' }],
    'transition-none': [{ d: box(8, 6, 32, 20) }],
    // The motions: a picture that rests, grows into the frame, shrinks, or both.
    'motion-none': [{ d: box(8, 6, 32, 20) }, { d: circle(24, 16, 2), fill: true }],
    'motion-in': [{ d: box(8, 6, 32, 20) }, { d: box(18, 12, 12, 8) }, { d: 'M10 8l5 3m23-3-5 3M10 24l5-3m23 3-5-3' }],
    'motion-out': [{ d: box(8, 6, 32, 20) }, { d: box(18, 12, 12, 8) }, { d: 'M15 11l-5-3m23 3 5-3M15 21l-5 3m23-3 5 3' }],
    'motion-alternate': [{ d: box(8, 6, 32, 20) }, { d: 'M15 16h18m-4-4 4 4-4 4m-10-8-4 4 4 4' }],
} as const satisfies Record<string, readonly PictogramPath[]>;

export type PictogramName = keyof typeof PICTOGRAMS;
