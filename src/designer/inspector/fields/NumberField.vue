<script setup lang="ts">
/**
 * A whole number with its unit inside the field, on the right (Plan.md 79, B2). The arrow keys step by 1, with Shift by
 * 10. While typing, a value is taken over as soon as it lies within `min` and `max`; one outside waits, and leaving the
 * field limits it to them – so a half-typed "1" on the way to "120" never lands in the document. A field is a gesture:
 * all its changes are one undo step.
 */
import { computed, ref, useId, watch } from 'vue';
import { useEdit } from '../edit';
import FieldRow from './FieldRow.vue';

const props = defineProps<{
    modelValue: number;
    label: string;
    unit?: string;
    min?: number;
    max?: number;
    testid?: string;
    stacked?: boolean;
    disabled?: boolean;
    quick?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [number] }>();
defineSlots<{ info?(): unknown }>();

const id = useId();
/** What the chip of the short menu shows: "Ecken 12 px". */
const face = computed(() => [props.label, props.modelValue, props.unit].filter((part) => part !== undefined).join(' '));
const edit = useEdit();
const draft = ref(String(props.modelValue));
let typing = false;

watch(
    () => props.modelValue,
    (value) => {
        if (!typing) draft.value = String(value);
    },
);

function within(n: number): boolean {
    return Number.isInteger(n) && n >= (props.min ?? -Infinity) && n <= (props.max ?? Infinity);
}

function limit(n: number): number {
    return Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, Math.round(n)));
}

function onInput(value: string): void {
    draft.value = value;
    const n = Number(value);
    if (value !== '' && Number.isFinite(n) && within(n) && n !== props.modelValue) emit('update:modelValue', n);
}

function onKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const typed = Number(draft.value);
    const base = draft.value !== '' && Number.isFinite(typed) ? typed : props.modelValue;
    const next = limit(base + (event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 10 : 1));
    draft.value = String(next);
    if (next !== props.modelValue) emit('update:modelValue', next);
}

function onFocus(): void {
    typing = true;
    edit.onFocus();
}

/** Leaving the field shows the number that counts: limited to the range, or the old one for an empty field. */
function onBlur(): void {
    typing = false;
    const typed = Number(draft.value);
    if (draft.value !== '' && Number.isFinite(typed)) {
        const next = limit(typed);
        if (next !== props.modelValue) emit('update:modelValue', next);
        draft.value = String(next);
    } else {
        draft.value = String(props.modelValue);
    }
    edit.onBlur();
}
</script>

<template>
    <FieldRow :label="label" :for="id" :stacked="stacked" :quick="quick" :face="face">
        <div class="number-box">
            <input
                :id="id"
                type="number"
                :min="min"
                :max="max"
                :value="draft"
                :disabled="disabled"
                :data-testid="testid"
                @input="onInput(($event.target as HTMLInputElement).value)"
                @keydown="onKey"
                @focus="onFocus"
                @blur="onBlur"
            >
            <span v-if="unit" class="unit" aria-hidden="true">{{ unit }}</span>
        </div>
        <template v-if="$slots.info" #info><slot name="info" /></template>
    </FieldRow>
</template>

<style scoped>
.number-box {
    position: relative;
    flex: 1;
    min-width: 0;
}
.number-box input {
    padding-right: 2.6em;
    appearance: textfield;
}
.number-box input::-webkit-inner-spin-button,
.number-box input::-webkit-outer-spin-button {
    margin: 0;
    appearance: none;
}
.unit {
    position: absolute;
    top: 50%;
    right: 0.6em;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    pointer-events: none;
    transform: translateY(-50%);
}
</style>
