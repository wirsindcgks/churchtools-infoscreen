<script setup lang="ts">
/** An on/off setting as a switch (Plan.md 79, B2, Entscheidung 15): label left with the room it needs, switch right. Still a checkbox for assistive technology and tests. */
import { useId } from 'vue';
import FieldRow from './FieldRow.vue';

defineProps<{ modelValue: boolean; label: string; testid?: string; disabled?: boolean; quick?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [boolean] }>();
defineSlots<{ info?(): unknown; before?(): unknown }>();
const id = useId();
</script>

<template>
    <FieldRow :label="label" :for="id" end wide :quick="quick">
        <template v-if="$slots.before" #before><slot name="before" /></template>
        <input
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
