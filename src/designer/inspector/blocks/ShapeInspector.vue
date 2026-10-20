<script setup lang="ts">
/** The shape block (Plan.md 79, B2; F1): everything in "Darstellung": form, fill, corners and edge. Form, fill and corners go to the short menu. */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import { th } from '../../../i18n/help';
import type { Block } from '../../../model/schema';
import ColorField from '../../ColorField.vue';
import FillEditor from '../../FillEditor.vue';
import InspectorSection from '../../InspectorSection.vue';
import { useEdit } from '../edit';
import NumberField from '../fields/NumberField.vue';
import SegmentField from '../fields/SegmentField.vue';
import { useBlockEdit } from '../use-block';

const props = defineProps<{ block: Extract<Block, { type: 'shape' }> }>();
const { editor, setBlock } = useBlockEdit(() => props.block);
const edit = useEdit();

const forms = [
    { value: 'rect', label: t.inspector.shapeRect },
    { value: 'ellipse', label: t.inspector.shapeEllipse },
];
const ellipse = computed(() => props.block.shape === 'ellipse');
/** Corners only where the form has them. */
const sh = th.shape;
const help = computed(() => ({ intro: sh.intro, items: ellipse.value ? [sh.form, sh.kind, sh.border, sh.borderColor] : [sh.form, sh.kind, sh.corners, sh.border, sh.borderColor] }));
const borderWidth = computed(() => props.block.border?.width ?? 0);
const summary = computed(() => {
    const form = ellipse.value ? t.inspector.shapeEllipse : t.inspector.shapeRect;
    const fill = props.block.fill.kind === 'solid' ? t.common.fill.solid : t.common.fill.gradient;
    const parts: string[] = [form, fill];
    if (borderWidth.value >= 1) parts.push(`${t.inspector.shapeBorder} ${borderWidth.value} px`);
    return parts.join(' · ');
});

/** A width of 0 takes the edge away; the first width starts in the text colour of the design. */
function setBorderWidth(width: number): void {
    if (width < 1) setBlock({ border: undefined });
    else setBlock({ border: { color: props.block.border?.color ?? editor.theme.text, width } });
}
</script>

<template>
    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="summary" :help="help">
        <SegmentField quick :model-value="block.shape ?? 'rect'" :options="forms" :label="t.inspector.shapeForm" testid="shape-form" @update:model-value="setBlock({ shape: $event })" />
        <FillEditor quick :model-value="block.fill" @focus="edit.onFocus" @blur="edit.onBlur" @update:model-value="setBlock({ fill: $event })" />
        <NumberField v-if="!ellipse" quick named :model-value="block.cornerRadius ?? 0" :label="t.inspector.cornerRadius" unit="px" :min="0" testid="shape-corners" @update:model-value="setBlock({ cornerRadius: $event })" />
        <NumberField :model-value="borderWidth" :label="t.inspector.shapeBorder" unit="px" :min="0" testid="shape-border" @update:model-value="setBorderWidth" />
        <ColorField
            v-if="block.border && borderWidth >= 1"
            :label="t.inspector.shapeBorderColor"
            :model-value="block.border.color"
            @focus="edit.onFocus"
            @blur="edit.onBlur"
            @update:model-value="setBlock({ border: { ...block.border, color: $event } })"
        />
    </InspectorSection>
</template>
