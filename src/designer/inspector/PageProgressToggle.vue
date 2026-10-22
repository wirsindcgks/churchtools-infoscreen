<script setup lang="ts">
/**
 * The "Fortschritt" switch of a block (Plan.md 105). While the presentation shows its own progress, the blocks show none
 * (Plan.md 109): the switch then stays visible but cannot be changed, and the block's setting is kept for later.
 */
import type { Block } from '../../model/schema';
import { pageProgressOn } from '../../player/paging';
import { t } from '../../i18n/designer';
import { useEditorStore } from '../editor-store';
import ToggleField from './fields/ToggleField.vue';
import { useBlockEdit } from './use-block';

const props = defineProps<{ block: Block }>();
const editor = useEditorStore();
const { setBlock } = useBlockEdit(() => props.block);
</script>

<template>
    <ToggleField
        :model-value="pageProgressOn(block)"
        :label="t.inspector.pageProgress"
        testid="page-progress"
        :disabled="!!editor.draft?.playlist.progress"
        @update:model-value="setBlock({ pageProgress: $event })"
    />
</template>
