<script setup lang="ts">
/**
 * The choice of a font, in the fonts themselves (Plan.md 79, B2): a `SelectMenu` whose entries are set in their own
 * font, because Safari does not set a font in an `<option>`. The list starts with the font of the design („Design",
 * only where a page provides the theme), goes on with „Eigene Schriften" (the church's uploads, Plan.md 103; only
 * where there are any) and ends with „Alle Schriften".
 */
import { computed, useId } from 'vue';
import { t } from '../../../i18n/designer';
import { customFonts, fontDef, fontStack, FONTS } from '../../../player/fonts';
import { usePalette } from '../../palette';
import SelectMenu, { type SelectOption } from '../../SelectMenu.vue';
import FieldRow from './FieldRow.vue';

const props = defineProps<{ modelValue: string; label: string; testid?: string; quick?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [string] }>();
defineSlots<{ info?(): unknown }>();

const labelId = useId();

const current = computed(() => fontDef(props.modelValue));
const lists = usePalette();
const design = computed(() => (lists?.value.designFont ? fontDef(lists.value.designFont) : null));

/** The design's font has a value of its own, so only the row of the font itself shows as chosen. */
const DESIGN = 'design:';

function option(key: string, label: string, group: string, value: string = key): SelectOption {
    return { value, label, group, style: { fontFamily: fontStack(key) } };
}

const options = computed<SelectOption[]>(() => [
    ...(design.value ? [option(design.value.key, design.value.label, t.inspector.designFont, DESIGN + design.value.key)] : []),
    ...customFonts.value.map((c) => option(c.key, fontDef(c.key).label, t.inspector.customFonts)),
    ...FONTS.map((font) => option(font.key, font.label, t.inspector.allFonts)),
]);

function choose(value: string | number): void {
    const key = String(value).replace(DESIGN, '');
    if (key !== current.value.key) emit('update:modelValue', key);
}
</script>

<template>
    <FieldRow :label="label" :label-id="labelId" stacked :quick="quick">
        <SelectMenu :model-value="current.key" :options="options" :labelledby="labelId" :placeholder="current.label" :testid="testid" @update:model-value="choose" />
        <template v-if="$slots.info" #info><slot name="info" /></template>
    </FieldRow>
</template>
