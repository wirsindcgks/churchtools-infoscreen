<script setup lang="ts">
/**
 * A colour as swatch and hex value side by side (Plan.md, Nächste Schritte
 * 11): the swatch opens the browser's picker, the text field takes a hex
 * code from the church's style guide. Only a valid code is taken over; while
 * typing, the field keeps what was typed and marks it until it is one.
 */
import { ref, watch } from 'vue';
import { parseHex, pickerValue } from './color';

const props = defineProps<{ modelValue: string; label: string; testid?: string }>();
const emit = defineEmits<{ 'update:modelValue': [string]; focus: []; blur: [] }>();

const draft = ref(props.modelValue);
const invalid = ref(false);
let typing = false;

watch(
    () => props.modelValue,
    (value) => {
        if (!typing) draft.value = value;
    },
);

function onText(value: string): void {
    draft.value = value;
    const hex = parseHex(value);
    invalid.value = hex === null;
    if (hex && hex !== props.modelValue) emit('update:modelValue', hex);
}

function onTextFocus(): void {
    typing = true;
    emit('focus');
}

/** Leaving the field shows the colour that counts – an unfinished code is dropped. */
function onTextBlur(): void {
    typing = false;
    draft.value = props.modelValue;
    invalid.value = false;
    emit('blur');
}
</script>

<template>
    <div class="d-field color-field">
        <span>{{ label }}</span>
        <div class="row">
            <input
                type="color"
                :value="pickerValue(modelValue)"
                :aria-label="`${label}: Farbe wählen`"
                :data-testid="testid ? `${testid}-picker` : undefined"
                @focus="emit('focus')"
                @blur="emit('blur')"
                @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
            >
            <input
                type="text"
                class="hex"
                :class="{ invalid }"
                :value="draft"
                maxlength="9"
                spellcheck="false"
                autocapitalize="off"
                autocomplete="off"
                :aria-label="`${label} als Hex-Wert`"
                :aria-invalid="invalid"
                :title="invalid ? 'Hex-Wert wie #1e3a5f oder #fff' : undefined"
                :data-testid="testid"
                @focus="onTextFocus"
                @blur="onTextBlur"
                @input="onText(($event.target as HTMLInputElement).value)"
            >
        </div>
    </div>
</template>

<style scoped>
.row {
    display: flex;
    gap: 4px;
    min-width: 0;
}
.row input[type='color'] {
    flex: none;
    width: 2.3em;
    height: 2.3em;
}
.hex {
    min-width: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: var(--d-size-sm);
}
.hex.invalid {
    border-color: var(--d-danger);
    outline-color: var(--d-danger);
}
</style>
