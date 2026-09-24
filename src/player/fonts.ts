/**
 * The closed list of fonts a stage may use (Plan.md, Architektur): free fonts
 * under the SIL Open Font License, delivered with the extension from the own
 * instance – never from a font service, which would tell a third party about
 * every device and every designer (data protection; checked by check-dist).
 *
 * Registered through the Font Loading API instead of the packages' CSS, for
 * three reasons: names of our own ("ISD …"), because ChurchTools defines
 * "Lato" on its page too and the faces would merge (Stilgrenze, Plan.md);
 * Latin and Latin Extended only; and weights 400, 600 and 700 only – the
 * weights the schema allows. A font is downloaded when text first uses it.
 */
import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import interLatinExt from '@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2?url';
import merriweatherLatin from '@fontsource-variable/merriweather/files/merriweather-latin-wght-normal.woff2?url';
import merriweatherLatinExt from '@fontsource-variable/merriweather/files/merriweather-latin-ext-wght-normal.woff2?url';
import montserratLatin from '@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2?url';
import montserratLatinExt from '@fontsource-variable/montserrat/files/montserrat-latin-ext-wght-normal.woff2?url';
import openSansLatin from '@fontsource-variable/open-sans/files/open-sans-latin-wght-normal.woff2?url';
import openSansLatinExt from '@fontsource-variable/open-sans/files/open-sans-latin-ext-wght-normal.woff2?url';
import oswaldLatin from '@fontsource-variable/oswald/files/oswald-latin-wght-normal.woff2?url';
import oswaldLatinExt from '@fontsource-variable/oswald/files/oswald-latin-ext-wght-normal.woff2?url';
import robotoLatin from '@fontsource-variable/roboto/files/roboto-latin-wght-normal.woff2?url';
import robotoLatinExt from '@fontsource-variable/roboto/files/roboto-latin-ext-wght-normal.woff2?url';
import sourceSansLatin from '@fontsource-variable/source-sans-3/files/source-sans-3-latin-wght-normal.woff2?url';
import sourceSansLatinExt from '@fontsource-variable/source-sans-3/files/source-sans-3-latin-ext-wght-normal.woff2?url';
import barlowSemiLatin400 from '@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-400-normal.woff2?url';
import barlowSemiLatin600 from '@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-600-normal.woff2?url';
import barlowSemiLatin700 from '@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-700-normal.woff2?url';
import barlowSemiLatinExt400 from '@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-ext-400-normal.woff2?url';
import barlowSemiLatinExt600 from '@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-ext-600-normal.woff2?url';
import barlowSemiLatinExt700 from '@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-ext-700-normal.woff2?url';
import latoLatin400 from '@fontsource/lato/files/lato-latin-400-normal.woff2?url';
import latoLatin700 from '@fontsource/lato/files/lato-latin-700-normal.woff2?url';
import latoLatinExt400 from '@fontsource/lato/files/lato-latin-ext-400-normal.woff2?url';
import latoLatinExt700 from '@fontsource/lato/files/lato-latin-ext-700-normal.woff2?url';
import poppinsLatin400 from '@fontsource/poppins/files/poppins-latin-400-normal.woff2?url';
import poppinsLatin600 from '@fontsource/poppins/files/poppins-latin-600-normal.woff2?url';
import poppinsLatin700 from '@fontsource/poppins/files/poppins-latin-700-normal.woff2?url';
import poppinsLatinExt400 from '@fontsource/poppins/files/poppins-latin-ext-400-normal.woff2?url';
import poppinsLatinExt600 from '@fontsource/poppins/files/poppins-latin-ext-600-normal.woff2?url';
import poppinsLatinExt700 from '@fontsource/poppins/files/poppins-latin-ext-700-normal.woff2?url';

/** Unicode ranges of the two subsets, as Fontsource and Google Fonts cut them. */
const RANGES = {
    latin:
        'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
    'latin-ext':
        'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
} as const;

interface Face {
    url: string;
    /** A single weight, or a range for variable fonts. */
    weight: string;
    subset: keyof typeof RANGES;
}

export interface FontDef {
    key: string;
    label: string;
    /** The name this module registers – never the plain name the host page may use. */
    family: string;
    generic: 'sans-serif' | 'serif';
    faces: Face[];
}

const variable = (weights: string, latin: string, latinExt: string): Face[] => [
    { url: latin, weight: weights, subset: 'latin' },
    { url: latinExt, weight: weights, subset: 'latin-ext' },
];

const statics = (files: Record<string, [latin: string, latinExt: string]>): Face[] =>
    Object.entries(files).flatMap(([weight, [latin, latinExt]]) => [
        { url: latin, weight, subset: 'latin' as const },
        { url: latinExt, weight, subset: 'latin-ext' as const },
    ]);

/**
 * Chosen on 2026-09-24: the most used open fonts of the Web Almanac 2024
 * (Latin, without icon fonts), plus Barlow Semi Condensed and one serif font.
 * Lato first as the default, then alphabetical.
 */
export const FONTS: FontDef[] = [
    {
        key: 'lato',
        label: 'Lato',
        family: 'ISD Lato',
        generic: 'sans-serif',
        // No semibold: 600 renders as 700, as in ChurchTools itself.
        faces: statics({ 400: [latoLatin400, latoLatinExt400], 700: [latoLatin700, latoLatinExt700] }),
    },
    {
        key: 'barlow-semi-condensed',
        label: 'Barlow Semi Condensed',
        family: 'ISD Barlow Semi Condensed',
        generic: 'sans-serif',
        faces: statics({
            400: [barlowSemiLatin400, barlowSemiLatinExt400],
            600: [barlowSemiLatin600, barlowSemiLatinExt600],
            700: [barlowSemiLatin700, barlowSemiLatinExt700],
        }),
    },
    {
        key: 'inter',
        label: 'Inter',
        family: 'ISD Inter',
        generic: 'sans-serif',
        faces: variable('100 900', interLatin, interLatinExt),
    },
    {
        key: 'merriweather',
        label: 'Merriweather',
        family: 'ISD Merriweather',
        generic: 'serif',
        faces: variable('300 900', merriweatherLatin, merriweatherLatinExt),
    },
    {
        key: 'montserrat',
        label: 'Montserrat',
        family: 'ISD Montserrat',
        generic: 'sans-serif',
        faces: variable('100 900', montserratLatin, montserratLatinExt),
    },
    {
        key: 'open-sans',
        label: 'Open Sans',
        family: 'ISD Open Sans',
        generic: 'sans-serif',
        faces: variable('300 800', openSansLatin, openSansLatinExt),
    },
    {
        key: 'oswald',
        label: 'Oswald',
        family: 'ISD Oswald',
        generic: 'sans-serif',
        faces: variable('200 700', oswaldLatin, oswaldLatinExt),
    },
    {
        key: 'poppins',
        label: 'Poppins',
        family: 'ISD Poppins',
        generic: 'sans-serif',
        faces: statics({
            400: [poppinsLatin400, poppinsLatinExt400],
            600: [poppinsLatin600, poppinsLatinExt600],
            700: [poppinsLatin700, poppinsLatinExt700],
        }),
    },
    {
        key: 'roboto',
        label: 'Roboto',
        family: 'ISD Roboto',
        generic: 'sans-serif',
        faces: variable('100 900', robotoLatin, robotoLatinExt),
    },
    {
        key: 'source-sans-3',
        label: 'Source Sans 3',
        family: 'ISD Source Sans 3',
        generic: 'sans-serif',
        faces: variable('200 900', sourceSansLatin, sourceSansLatinExt),
    },
];

/** The font of new blocks: the one ChurchTools and its built-in info screen use (G25). */
export const DEFAULT_FONT = 'lato';

/** Keys of schema 1.0, when the stage still used system fonts. Saved screens keep working. */
const ALIASES: Record<string, string> = { sans: 'lato', serif: 'merriweather', mono: 'lato' };

export function fontDef(key: string): FontDef {
    const resolved = ALIASES[key] ?? key;
    return FONTS.find((f) => f.key === resolved) ?? FONTS.find((f) => f.key === DEFAULT_FONT)!;
}

export function fontStack(key: string): string {
    const font = fontDef(key);
    return `"${font.family}", ${font.generic}`;
}

let registered = false;

/**
 * Makes the fonts known to the page. Nothing is downloaded here: the browser
 * fetches a face when text first needs it. `display: block` keeps the text
 * invisible for a moment instead of flashing a system font on a TV.
 */
export function registerFonts(fonts: FontFaceSet | undefined = globalThis.document?.fonts): void {
    if (registered || !fonts || typeof FontFace === 'undefined') return;
    registered = true;
    for (const font of FONTS) {
        for (const face of font.faces) {
            fonts.add(
                new FontFace(font.family, `url(${face.url}) format('woff2')`, {
                    weight: face.weight,
                    unicodeRange: RANGES[face.subset],
                    display: 'block',
                }),
            );
        }
    }
}
