<script setup lang="ts">
/**
 * The "Schrift" section every block with a text style includes (Plan.md 79, B2): font, size, weight, capitals, colour,
 * alignment and – where the block has a choice – the vertical position. `alignQuick` marks the alignment for the
 * short menu (the text block); the colour always goes there.
 */
import { computed } from 'vue';
import { t } from '../../i18n/designer';
import { fontDef } from '../../player/fonts';
import { verticalAlignOf } from '../../player/format';
import ColorField from '../ColorField.vue';
import InspectorSection from '../InspectorSection.vue';
import { useEdit } from './edit';
import NumberField from './fields/NumberField.vue';
import SegmentField from './fields/SegmentField.vue';
import FontField from './fields/FontField.vue';
import ToggleField from './fields/ToggleField.vue';
import { useBlockEdit, type StyledBlock } from './use-block';

const props = defineProps<{ block: StyledBlock; alignQuick?: boolean }>();
const edit = useEdit();
const { setStyle } = useBlockEdit(() => props.block);

const style = computed(() => props.block.style);
const weights = [
    { value: 400, label: t.inspector.weights.normal },
    { value: 600, label: t.inspector.weights.semibold },
    { value: 700, label: t.inspector.weights.bold },
];
const aligns = [
    { value: 'left', label: t.inspector.aligns.left, icon: 'align-left' },
    { value: 'center', label: t.inspector.aligns.center, icon: 'align-center' },
    { value: 'right', label: t.inspector.aligns.right, icon: 'align-right' },
] as const;
const verticals = [
    { value: 'top', label: t.inspector.verticals.top, icon: 'valign-top' },
    { value: 'middle', label: t.inspector.verticals.middle, icon: 'valign-middle' },
    { value: 'bottom', label: t.inspector.verticals.bottom, icon: 'valign-bottom' },
] as const;

/** Folded sections say what is set inside (Plan.md 47). */
const summary = computed(() => t.inspector.fontSummary(fontDef(style.value.fontFamily).label, style.value.fontSize, !!style.value.uppercase));
</script>

<template>
    <InspectorSection id="font" :title="t.inspector.font" :summary="summary">
        <template #summary-extra>
            <span class="swatch" :style="{ background: style.color }" />
        </template>
        <FontField :model-value="style.fontFamily" :label="t.inspector.fontFamily" testid="font-family" @update:model-value="setStyle({ fontFamily: $event })" />
        <NumberField :model-value="style.fontSize" :label="t.inspector.fontSize" unit="px" :min="8" testid="font-size" @update:model-value="setStyle({ fontSize: $event })" />
        <SegmentField
            :model-value="style.fontWeight"
            :options="weights"
            :label="t.inspector.fontWeight"
            testid="font-weight"
            stacked
            @update:model-value="setStyle({ fontWeight: $event as 400 })"
        />
        <ToggleField :model-value="style.uppercase ?? false" :label="t.inspector.uppercase" testid="text-uppercase" @update:model-value="setStyle({ uppercase: $event })" />
        <ColorField
            :label="t.common.fill.solid"
            quick
            testid="text-color"
            :model-value="style.color"
            @focus="edit.onFocus"
            @blur="edit.onBlur"
            @update:model-value="setStyle({ color: $event })"
        />
        <SegmentField
            :model-value="style.align"
            :options="aligns"
            :label="t.inspector.align"
            testid="text-align"
            :quick="alignQuick"
            @update:model-value="setStyle({ align: $event as 'left' })"
        />
        <SegmentField
            v-if="verticalAlignOf(block)"
            :model-value="verticalAlignOf(block)!"
            :options="verticals"
            :label="t.inspector.vertical"
            testid="text-vertical-align"
            @update:model-value="setStyle({ verticalAlign: $event as 'top' })"
        />
    </InspectorSection>
</template>

<style scoped>
.swatch {
    width: 10px;
    height: 10px;
    border: 1px solid var(--d-divider);
    border-radius: 50%;
}
</style>
