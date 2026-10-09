<script setup lang="ts">
/** The QR code block (Plan.md 79, B2): what it encodes, then its colours. Content and colour go to the short menu. */
import { t } from '../../../i18n/designer';
import { qrShape } from '../../../player/qr';
import type { Block } from '../../../model/schema';
import ColorField from '../../ColorField.vue';
import InspectorSection from '../../InspectorSection.vue';
import { useEdit } from '../edit';
import TextField from '../fields/TextField.vue';
import { useBlockEdit } from '../use-block';

const props = defineProps<{ block: Extract<Block, { type: 'qr' }> }>();
const { setBlock } = useBlockEdit(() => props.block);
const edit = useEdit();
</script>

<template>
    <TextField
        quick
        stacked
        :model-value="block.data"
        :label="t.inspector.qrContent"
        :placeholder="t.inspector.qrPlaceholder"
        :maxlength="1000"
        testid="qr-data"
        @update:model-value="setBlock({ data: $event })"
    />
    <p v-if="block.data.trim() && !qrShape(block.data)" class="hint">{{ t.inspector.qrTooLong }}</p>
    <InspectorSection id="appearance" :title="t.inspector.appearance">
        <template #info>{{ t.inspector.qrColorsInfo }}</template>
        <div class="colors">
            <ColorField quick :label="t.common.fill.solid" :model-value="block.color" @focus="edit.onFocus" @blur="edit.onBlur" @update:model-value="setBlock({ color: $event })" />
            <ColorField :label="t.common.color.background" :model-value="block.background" @focus="edit.onFocus" @blur="edit.onBlur" @update:model-value="setBlock({ background: $event })" />
        </div>
    </InspectorSection>
</template>

<style scoped>
.colors {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    align-items: end;
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
