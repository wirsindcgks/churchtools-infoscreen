import { computed, inject, unref, type ComputedRef, type InjectionKey, type MaybeRef, type Ref } from 'vue';

/**
 * Where a field is drawn (Plan.md 79, B2): `full` in the inspector, `quick` in the short menu above the block (Paket C).
 * In `quick` only the fields marked with the property `quick` draw themselves, so every setting exists once in the code.
 */
export type InspectorMode = 'full' | 'quick';

export const INSPECTOR_MODE: InjectionKey<MaybeRef<InspectorMode>> = Symbol('inspector-mode');

/** The one open field of the short menu (Plan.md 79, C1): the id of its `QuickField`, or null. The menu provides it. */
export const QUICK_OPEN: InjectionKey<Ref<string | null>> = Symbol('quick-open');

/** Where the short menu stands (Plan.md 79, C2): `float` above the block, `bar` at the bottom of a phone, where the open field is a sheet from below. */
export const QUICK_VARIANT: InjectionKey<'float' | 'bar'> = Symbol('quick-variant');

/** Set inside the open field of the short menu: a foldable section there shows its content without the fold. */
export const IN_QUICK_FIELD: InjectionKey<Readonly<Ref<boolean>>> = Symbol('in-quick-field');

/** The mode the surrounding page provides (default `full`), following a ref. */
export function useInspectorMode(): ComputedRef<InspectorMode> {
    const mode = inject(INSPECTOR_MODE, 'full');
    return computed(() => unref(mode));
}

/** Whether a field with this `quick` mark draws itself in the mode the surrounding page provides (default `full`). */
export function useFieldVisible(quick: () => boolean | undefined): ComputedRef<boolean> {
    const mode = useInspectorMode();
    return computed(() => mode.value === 'full' || !!quick());
}
