<script setup lang="ts">
/**
 * "Lage" of a block's progress bar (Plan.md 107): set off from the edge as a pill, or a thin line flush with the bottom.
 * Stands under the "Fortschritt" switch and only while the bar is on; "Abgesetzt" is saved as a missing field.
 */
import type { Block } from '../../model/schema';
import { pageProgressEdge, pageProgressOn } from '../../player/paging';
import { t } from '../../i18n/designer';
import SegmentField from './fields/SegmentField.vue';
import { useBlockEdit } from './use-block';

const props = defineProps<{ block: Block }>();
const { setBlock } = useBlockEdit(() => props.block);

const options = [
    { value: 'inset', label: t.inspector.progressPlacements.inset },
    { value: 'edge', label: t.inspector.progressPlacements.edge },
];
</script>

<template>
    <SegmentField
        v-if="pageProgressOn(block)"
        :model-value="pageProgressEdge(block) ? 'edge' : 'inset'"
        :options="options"
        :label="t.inspector.progressPlacement"
        testid="page-progress-placement"
        @update:model-value="setBlock({ pageProgressPlacement: $event === 'edge' ? 'edge' : undefined })"
    />
</template>
