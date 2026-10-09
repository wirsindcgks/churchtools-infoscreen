<script setup lang="ts">
/** The text block (Plan.md 79, B2): the text itself, then the font. The short menu will take colour and alignment. */
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import TextField from '../fields/TextField.vue';
import FontSection from '../FontSection.vue';
import { useBlockEdit } from '../use-block';

const props = defineProps<{ block: Extract<Block, { type: 'text' }> }>();
const { setBlock } = useBlockEdit(() => props.block);
</script>

<template>
    <TextField multiline :rows="3" :model-value="block.text" :label="t.inspector.text" testid="text-input" @update:model-value="setBlock({ text: $event })" />
    <FontSection :block="block" align-quick />
</template>
