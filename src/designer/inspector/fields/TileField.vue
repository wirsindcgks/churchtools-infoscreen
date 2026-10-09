<script setup lang="ts">
/**
 * Two to four possibilities as picture tiles (Plan.md 79, B2, Entscheidung 16): a small pictogram and a word beneath.
 * The same group of radio buttons as `SegmentField`; the label stands above, the tiles take the full width – four tiles in two rows,
 * so a word like "Hineinzoomen" keeps its room.
 */
import { computed, useId } from 'vue';
import FieldRow from './FieldRow.vue';
import Pictogram from './Pictogram.vue';
import type { PictogramName } from '../pictograms';

export interface TileOption {
    value: string | number;
    label: string;
    pictogram: PictogramName;
}

const props = defineProps<{ modelValue: string | number | undefined; options: readonly TileOption[]; label: string; testid?: string; disabled?: boolean; quick?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [string | number] }>();
defineSlots<{ info?(): unknown }>();
const labelId = useId();
/** What the chip of the short menu shows: the chosen tile's word. */
const face = computed(() => props.options.find((o) => o.value === props.modelValue)?.label);
const name = useId();
</script>

<template>
    <FieldRow :label="label" :label-id="labelId" stacked :quick="quick" :face="face">
        <div class="tiles" :class="{ 'tiles--four': options.length > 3 }" role="radiogroup" :aria-labelledby="labelId" :data-testid="testid">
            <label v-for="option in options" :key="option.value" class="tile">
                <input
                    type="radio"
                    :name="name"
                    :value="option.value"
                    :checked="option.value === modelValue"
                    :disabled="disabled"
                    @change="emit('update:modelValue', option.value)"
                >
                <span class="tile-face">
                    <Pictogram :name="option.pictogram" />
                    <span class="tile-word">{{ option.label }}</span>
                </span>
            </label>
        </div>
        <template v-if="$slots.info" #info><slot name="info" /></template>
    </FieldRow>
</template>

<style scoped>
.tiles {
    display: grid;
    flex: 1;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    gap: 6px;
    min-width: 0;
}
.tiles--four {
    grid-auto-flow: row;
    grid-template-columns: repeat(2, minmax(0, 1fr));
}
.tile {
    position: relative;
    display: flex;
    min-width: 0;
}
.tile input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    min-height: 0;
    margin: 0;
    padding: 0;
    border: 0;
    opacity: 0;
    cursor: pointer;
}
.tile-face {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 0;
    padding: 8px 12px 6px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
    background: var(--d-surface);
    color: var(--d-text-muted);
    pointer-events: none;
}
.tile-word {
    max-width: 100%;
    color: var(--d-text);
    font-size: var(--d-size-sm);
    line-height: 1.2;
    overflow-wrap: anywhere;
    text-align: center;
}
.tile:has(input:checked) .tile-face {
    border-color: var(--d-accent);
    background: var(--d-accent-pale);
    color: var(--d-accent-strong);
}
.tile:has(input:checked) .tile-word {
    color: var(--d-accent-strong);
    font-weight: var(--d-weight-normal);
}
.tile:has(input:focus-visible) .tile-face {
    outline: 2px solid var(--d-accent);
    outline-offset: 1px;
}
.tile:has(input:disabled) .tile-face {
    opacity: 0.5;
}
</style>
