/**
 * Colours as hex values (Plan.md, Nächste Schritte 11): typed in by hand – a
 * church's colours come as hex codes from its style guide – next to the
 * browser's colour picker, which knows only `#rrggbb`.
 */

/**
 * The hex colour someone typed, normalised to lower case with `#`; null if it
 * is none. Accepts 3, 6 or 8 digits (the last with transparency), with or
 * without `#`, surrounding spaces ignored.
 */
export function parseHex(input: string): string | null {
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(input.trim());
    return match ? `#${match[1]!.toLowerCase()}` : null;
}

/**
 * What the browser's picker can show of a stored colour: `#rrggbb`. Short
 * forms are expanded, transparency is dropped, anything else (older values
 * may be any CSS colour) shows as black – the stored value stays untouched.
 */
export function pickerValue(color: string): string {
    const hex = parseHex(color);
    if (!hex) return '#000000';
    const digits = hex.slice(1);
    if (digits.length === 3) return `#${[...digits].map((d) => d + d).join('')}`;
    return `#${digits.slice(0, 6)}`;
}
