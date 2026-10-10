<script setup lang="ts">
/**
 * An on/off setting as a switch (Plan.md 79, B2, Entscheidung 15): label left with the room it needs, switch right. Still a
 * checkbox for assistive technology and tests. In the short menu (C1) it is a pressed or unpressed chip with the word instead.
 */
import { useId } from 'vue';
import { useInspectorMode } from '../mode';
import FieldRow from './FieldRow.vue';

defineProps<{ modelValue: boolean; label: string; /** A shorter word for the chip in the short menu; the checkbox keeps the full label. */ quickLabel?: string; testid?: string; disabled?: boolean; quick?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [boolean] }>();
defineSlots<{ info?(): unknown; before?(): unknown }>();
const id = useId();
const mode = useInspectorMode();
</script>

<template>
    <FieldRow :label="label" :for="id" end wide :quick="quick" :inline="mode === 'quick'">
        <template v-if="$slots.before" #before><slot name="before" /></template>
        <label v-if="mode === 'quick'" class="toggle-chip" :class="{ 'toggle-chip--on': modelValue }">
            <input
                :id="id"
                class="toggle-chip-input"
                type="checkbox"
                role="switch"
                :checked="modelValue"
                :disabled="disabled"
                :aria-label="label"
                :data-testid="testid"
                data-quick-stop
                @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
            >
            <span>{{ quickLabel ?? label }}</span>
        </label>
        <input
            v-else
            :id="id"
            class="switch"
            type="checkbox"
            role="switch"
            :checked="modelValue"
            :disabled="disabled"
            :data-testid="testid"
            @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
        >
        <template v-if="$slots.info" #info><slot name="info" /></template>
    </FieldRow>
</template>

<style scoped>
/* The chip of the short menu: a real checkbox across the whole chip, invisible; the face shows the state. */
.toggle-chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    height: 32px;
    padding: 0 var(--d-space-2);
    border: 1px solid var(--d-edge);
    border-radius: var(--d-radius);
    background: var(--d-panel);
    color: var(--d-text);
    white-space: nowrap;
}
.toggle-chip:hover {
    background: var(--d-workspace);
}
.toggle-chip--on,
.toggle-chip--on:hover {
    border-color: var(--d-accent);
    background: var(--d-accent-pale);
    color: var(--d-accent-strong);
}
.toggle-chip-input {
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
.toggle-chip:has(.toggle-chip-input:focus-visible) {
    outline: 2px solid var(--d-accent);
}
.switch {
    position: relative;
    flex: none;
    width: 2.4em;
    height: 1.4em;
    min-height: 0;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: var(--d-interactive);
    appearance: none;
    cursor: pointer;
    transition: background-color 0.15s;
}
.switch::after {
    content: '';
    position: absolute;
    top: 0.2em;
    left: 0.2em;
    width: 1em;
    height: 1em;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.15s;
}
.switch:checked {
    background: var(--d-accent);
}
.switch:checked::after {
    transform: translateX(1em);
}
.switch:disabled {
    cursor: default;
    opacity: 0.5;
}
@media (prefers-reduced-motion: reduce) {
    .switch,
    .switch::after {
        transition: none;
    }
}
</style>
