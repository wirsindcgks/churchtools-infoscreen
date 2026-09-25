/**
 * QR codes made on the device (schema 1.9) – no foreign service, works
 * offline. The code is drawn as one SVG path, crisp at any block size.
 */
import qrcode from 'qrcode-generator';

export interface QrShape {
    /** Modules per side, the quiet zone included. */
    size: number;
    /** SVG path of the dark modules. */
    path: string;
}

/** Quiet zone in modules; the standard asks for four, two suffice on a calm background. */
const MARGIN = 2;

/** The code for a text, or null when there is none or it is too long for a QR code. */
export function qrShape(text: string): QrShape | null {
    if (!text.trim()) return null;
    try {
        const code = qrcode(0, 'M');
        // The library takes one character per byte: hand it the UTF-8 bytes, so umlauts survive.
        code.addData(String.fromCharCode(...new TextEncoder().encode(text)), 'Byte');
        code.make();
        const count = code.getModuleCount();
        const parts: string[] = [];
        for (let row = 0; row < count; row++) {
            for (let col = 0; col < count; col++) {
                if (code.isDark(row, col)) parts.push(`M${col + MARGIN} ${row + MARGIN}h1v1h-1z`);
            }
        }
        return { size: count + 2 * MARGIN, path: parts.join('') };
    } catch {
        return null; // too long: the block shows its placeholder
    }
}
