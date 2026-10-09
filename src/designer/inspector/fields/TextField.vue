<script setup lang="ts">
/**
 * One line of text, or several with `multiline` (Plan.md 79, B2). By default every keystroke is taken over;
 * `commit="change"` waits for Enter or leaving the field and then shows what the model holds – a value the parent
 * refuses (an embed code without an address) does not stay in the field. A field is a gesture: one undo step.
 */
import { nextTick, useId } from 'vue';
import { useEdit } from '../edit';
import FieldRow from './FieldRow.vue';

const props = defineProps<{
    modelValue: string;
    label: string;
    placeholder?: string;
    maxlength?: number;
    inputmode?: 'url' | 'text';
    multiline?: boolean;
    rows?: number;
    commit?: 'input' | 'change';
    /** The `id` of the control, where a test or a script needs a fixed one. */
    inputId?: string;
    testid?: string;
    stacked?: boolean;
    disabled?: boolean;
    quick?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [string] }>();
defineSlots<{ info?(): unknown }>();

const generated = useId();
const edit = useEdit();

function onInput(event: Event): void {
    if ((props.commit ?? 'input') === 'input') emit('update:modelValue', (event.target as HTMLInputElement).value);
}

function onChange(event: Event): void {
    if (props.commit !== 'change') return;
    const input = event.target as HTMLInputElement;
    emit('update:modelValue', input.value);
    void nextTick(() => {
        input.value = props.modelValue;
    });
}
</script>

<template>
    <FieldRow :label="label" :for="inputId ?? generated" :stacked="stacked || multiline" :quick="quick">
        <textarea
            v-if="multiline"
            :id="inputId ?? generated"
            :rows="rows ?? 3"
            :value="modelValue"
            :placeholder="placeholder"
            :maxlength="maxlength"
            :disabled="disabled"
            :data-testid="testid"
            @input="onInput"
            @change="onChange"
            @focus="edit.onFocus"
            @blur="edit.onBlur"
        />
        <input
            v-else
            :id="inputId ?? generated"
            type="text"
            :inputmode="inputmode"
            :value="modelValue"
            :placeholder="placeholder"
            :maxlength="maxlength"
            :disabled="disabled"
            :data-testid="testid"
            @input="onInput"
            @change="onChange"
            @focus="edit.onFocus"
            @blur="edit.onBlur"
        >
        <template v-if="$slots.info" #info><slot name="info" /></template>
    </FieldRow>
</template>
