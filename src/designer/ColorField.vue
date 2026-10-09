<script setup lang="ts">
/**
 * A colour as swatch and hex value side by side (Plan.md, Nächste Schritte
 * 11): the swatch opens the browser's picker, the text field takes a hex
 * code from the church's style guide. Only a valid code is taken over; while
 * typing, the field keeps what was typed and marks it until it is one.
 * Where a page provides the theme (the editor), swatches stand below in two
 * groups (Plan.md 64, 65): the palette – the theme's colours and the church's
 * – and the colours the slide uses beyond it. A click copies the value.
 */
import { ref, watch } from 'vue';
import { t } from '../i18n/designer';
import { useFieldVisible } from './inspector/mode';
import { parseHex, pickerValue } from './color';
import { usePalette, type PaletteColor } from './palette';

const props = defineProps<{ modelValue: string; label: string; testid?: string; inline?: boolean; quick?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [string]; focus: []; blur: [] }>();

const lists = usePalette();
const visible = useFieldVisible(() => props.quick);

/** Name and hex value; a colour without a name of its own is just its hex value. */
function swatchLabel(entry: PaletteColor): string {
    const hex = entry.color.toUpperCase();
    return entry.name.toLowerCase() === entry.color.toLowerCase() ? hex : `${entry.name} (${hex})`;
}

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
    <div v-if="visible" class="d-field color-field" :class="{ 'color-field--inline': inline }">
        <span>{{ label }}</span>
        <div class="row">
            <input
                type="color"
                :value="pickerValue(modelValue)"
                :aria-label="t.common.color.pick(label)"
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
                :aria-label="t.common.color.asHex(label)"
                :aria-invalid="invalid"
                :title="invalid ? t.common.color.invalidHex : undefined"
                :data-testid="testid"
                @focus="onTextFocus"
                @blur="onTextBlur"
                @input="onText(($event.target as HTMLInputElement).value)"
            >
        </div>
        <div v-if="lists && lists.palette.length" class="swatch-group" data-testid="palette-group">
            <span class="swatch-caption">{{ t.common.color.palette }}</span>
            <div class="palette-swatches" role="group" :aria-label="t.common.color.paletteOf(label)">
                <button
                    v-for="entry in lists.palette"
                    :key="entry.color"
                    type="button"
                    class="swatch"
                    :style="{ background: entry.color }"
                    :title="swatchLabel(entry)"
                    :aria-label="swatchLabel(entry)"
                    :aria-pressed="entry.color.toLowerCase() === modelValue.toLowerCase()"
                    :data-testid="testid ? `${testid}-swatch` : 'color-swatch'"
                    @click="emit('update:modelValue', entry.color)"
                />
            </div>
        </div>
        <div v-if="lists && lists.slide.length" class="swatch-group" data-testid="slide-colors-group">
            <span class="swatch-caption">{{ t.common.color.onSlide }}</span>
            <div class="palette-swatches" role="group" :aria-label="t.common.color.onSlideOf(label)">
                <button
                    v-for="entry in lists.slide"
                    :key="entry.color"
                    type="button"
                    class="swatch"
                    :style="{ background: entry.color }"
                    :title="swatchLabel(entry)"
                    :aria-label="swatchLabel(entry)"
                    :aria-pressed="entry.color.toLowerCase() === modelValue.toLowerCase()"
                    :data-testid="testid ? `${testid}-swatch` : 'color-swatch'"
                    @click="emit('update:modelValue', entry.color)"
                />
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Alone on its line the label stands left of the swatch and the hex value; the swatch groups keep the full width below. */
.color-field--inline {
    grid-template-columns: 7.5rem minmax(0, 1fr);
    align-items: center;
    gap: 6px 0.6em;
}
.color-field--inline > :nth-child(n + 3) {
    grid-column: 1 / -1;
}
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
.swatch-group {
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.swatch-caption {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.palette-swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
.swatch {
    flex: none;
    box-sizing: border-box;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--d-divider);
    border-radius: 50%;
    cursor: pointer;
}
.swatch[aria-pressed='true'] {
    border: 2px solid var(--d-text);
    outline: 2px solid var(--d-interactive);
    outline-offset: 1px;
}
</style>
