/**
 * Fonts the church uploads (Plan.md 103): what is accepted, and the check that a file is a font. A font file goes to the
 * same wiki page as the videos, but is never listed in the media library. Both checks run before anything is sent.
 */
import { t } from '../i18n/designer';

export const FONT_EXTENSIONS = ['.woff2', '.woff', '.ttf', '.otf'];
export const FONT_MAX_BYTES = 5 * 1024 * 1024;

/** Why a file may not go up as a font; `null` when it may. Checked by name and size, before anything is read. */
export function fontProblem(file: { name: string; size: number }): string | null {
    const name = file.name.toLowerCase();
    if (!FONT_EXTENSIONS.some((ext) => name.endsWith(ext))) return t.media.library.onlyFonts;
    if (file.size > FONT_MAX_BYTES) return t.media.library.tooLarge(file.name, FONT_MAX_BYTES / 1024 / 1024);
    return null;
}

/** Loads the file once as a font, as a screen will; rejects with a clear message when it is none. */
export async function checkFontFile(file: File): Promise<void> {
    try {
        await new FontFace('ISD check', await file.arrayBuffer()).load();
    } catch {
        throw new Error(t.media.library.fontNotReadable(file.name));
    }
}

/** A name for a new font from its file: "Hausschrift-Regular.woff2" → "Hausschrift Regular", at most 40 characters. */
export function suggestFontName(fileName: string): string {
    const name = fileName
        .replace(/\.[^.]*$/, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return (name || t.design.font.custom.defaultName).slice(0, 40).trim();
}
