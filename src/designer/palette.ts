/**
 * The colours offered at every colour field in the editor (Plan.md 64): the
 * theme's accent, text and background, then the church's palette. A page
 * provides the theme; `ColorField` asks for the list. Without a provider
 * (the Design page itself) a field shows no swatches.
 */
import { computed, inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import type { ThemeDoc } from '../model/schema';

export interface PaletteColor {
    name: string;
    color: string;
}

const KEY: InjectionKey<ComputedRef<PaletteColor[]>> = Symbol('palette');

/** Accent, text, background, then the palette; a colour twice (ignoring case) once, under its first name; no name shows the hex value. */
export function paletteColors(theme: ThemeDoc | null | undefined): PaletteColor[] {
    if (!theme) return [];
    const all = [
        { name: 'Akzent', color: theme.accent },
        { name: 'Text', color: theme.text },
        { name: 'Hintergrund', color: theme.background },
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

export function providePalette(theme: Ref<ThemeDoc | null | undefined>): void {
    provide(KEY, computed(() => paletteColors(theme.value)));
}

export function usePalette(): ComputedRef<PaletteColor[]> | null {
    return inject(KEY, null);
}
