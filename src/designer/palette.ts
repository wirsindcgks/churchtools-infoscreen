/**
 * The colours offered at every colour field in the editor (Plan.md 64): the
 * theme's accent, text and background, then the church's palette. A page
 * provides the theme; `ColorField` asks for the list. Without a provider
 * (the Design page itself) a field shows no swatches. Where a page also
 * provides the slide, the colours it uses form a second group (Plan.md 65).
 */
import { computed, inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { SlideDoc, ThemeDoc } from '../model/schema';
import { t } from '../i18n/designer';
import { parseHex } from './color';

export interface PaletteColor {
    name: string;
    color: string;
}

export interface PaletteLists {
    palette: PaletteColor[];
    slide: PaletteColor[];
}

const KEY: InjectionKey<ComputedRef<PaletteLists>> = Symbol('palette');

const MAX_SLIDE_COLORS = 12;

/** Accent, text, background, then the palette; a colour twice (ignoring case) once, under its first name; no name shows the hex value. */
export function paletteColors(theme: ThemeDoc | null | undefined): PaletteColor[] {
    if (!theme) return [];
    const all = [
        { name: t.common.color.accent, color: theme.accent },
        { name: t.common.color.text, color: theme.text },
        { name: t.common.color.background, color: theme.background },
        ...(theme.palette ?? []).map((p) => ({ name: p.name.trim() === '' ? p.color : p.name, color: p.color })),
    ];
    const seen = new Set<string>();
    return all.filter(({ color }) => {
        const key = color.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * The colours a slide uses that `exclude` does not list: every valid hex value under a `color` or
 * `background` key, wherever it sits (text, fills, gradient stops, block colours), in order of
 * appearance, once ignoring case, at most 12. The name is the hex value.
 */
export function slideColors(slide: SlideDoc | null | undefined, exclude: readonly string[]): PaletteColor[] {
    const seen = new Set(exclude.map((c) => c.toLowerCase()));
    const found: PaletteColor[] = [];
    const walk = (node: unknown): void => {
        if (found.length >= MAX_SLIDE_COLORS || node === null || typeof node !== 'object') return;
        for (const [key, value] of Object.entries(node)) {
            if (found.length >= MAX_SLIDE_COLORS) return;
            if ((key === 'color' || key === 'background') && typeof value === 'string') {
                const hex = parseHex(value);
                if (hex && !seen.has(hex)) {
                    seen.add(hex);
                    found.push({ name: hex, color: hex });
                }
            } else {
                walk(value);
            }
        }
    };
    walk(slide);
    return found;
}

/**
 * The group „Auf der Slide": every colour the slide uses, approved or not – a colour from the palette keeps its
 * name there (wish of the user, 2026-10-05: the group must not vanish when a slide only uses approved colours).
 */
export function slideSwatches(slide: SlideDoc | null | undefined, palette: readonly PaletteColor[]): PaletteColor[] {
    const names = new Map(palette.map((c) => [c.color.toLowerCase(), c.name]));
    return slideColors(slide, []).map((c) => ({ name: names.get(c.color) ?? c.name, color: c.color }));
}

export function providePalette(theme: Ref<ThemeDoc | null | undefined>, slide?: Ref<SlideDoc | null | undefined>): void {
    provide(
        KEY,
        computed(() => {
            const palette = paletteColors(theme.value);
            return { palette, slide: slideSwatches(slide?.value, palette) };
        }),
    );
}

export function usePalette(): ComputedRef<PaletteLists> | null {
    return inject(KEY, null);
}
