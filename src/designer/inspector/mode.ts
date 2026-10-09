import { computed, inject, unref, type ComputedRef, type InjectionKey, type MaybeRef } from 'vue';

/**
 * Where a field is drawn (Plan.md 79, B2): `full` in the inspector, `quick` in the short menu above the block (Paket C).
 * In `quick` only the fields marked with the property `quick` draw themselves, so every setting exists once in the code.
 */
export type InspectorMode = 'full' | 'quick';

export const INSPECTOR_MODE: InjectionKey<MaybeRef<InspectorMode>> = Symbol('inspector-mode');

/** Whether a field with this `quick` mark draws itself in the mode the surrounding page provides (default `full`). */
export function useFieldVisible(quick: () => boolean | undefined): ComputedRef<boolean> {
    const mode = inject(INSPECTOR_MODE, 'full');
    return computed(() => unref(mode) === 'full' || !!quick());
}
