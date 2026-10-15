/**
 * What the chip of a field shows in the short menu instead of the chosen option (Plan.md 88, C): a fixed text, or a function
 * of the field's value – for a value that says nothing alone ("Ohne" for a shadow).
 */
export type ChipFace = string | ((value: string | number | undefined) => string);

/** The face the chip gets: the field's own `face` where it has one, else the fallback (the chosen option's label). */
export function chipFace(face: ChipFace | undefined, value: string | number | undefined, fallback: string | undefined): string | undefined {
    if (face === undefined) return fallback;
    return typeof face === 'function' ? face(value) : face;
}
