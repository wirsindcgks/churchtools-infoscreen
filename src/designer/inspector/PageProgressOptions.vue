<script setup lang="ts">
/**
 * "Form" and "Lage" of a block's progress (Plan.md 109, 107): a bar with the page number or one segment per page, and set
 * off from the edge or flush with the bottom. Stand under the "Fortschritt" switch and only while it is on; "Abgesetzt" is
 * saved as a missing field, the form only when it differs from what the block shows without the field (the visitor
 * overview of the list: segments, everything else the bar). Hidden while the presentation shows its own progress.
 */
import type { Block } from '../../model/schema';
import { pageProgressEdge, pageProgressOn, pageProgressSegments, pageProgressSegmentsByDefault } from '../../player/paging';
import { t } from '../../i18n/designer';
import { useEditorStore } from '../editor-store';
import SegmentField from './fields/SegmentField.vue';
import { useBlockEdit } from './use-block';

const props = defineProps<{ block: Block }>();
const editor = useEditorStore();
const { setBlock } = useBlockEdit(() => props.block);

const styleOptions = [
    { value: 'bar', label: t.inspector.progressStyles.bar },
    { value: 'segments', label: t.inspector.progressStyles.segments },
];
const placementOptions = [
    { value: 'inset', label: t.inspector.progressPlacements.inset },
    { value: 'edge', label: t.inspector.progressPlacements.edge },
];

function setStyle(value: string | number): void {
    const segments = value === 'segments';
    setBlock({ pageProgressStyle: segments === pageProgressSegmentsByDefault(props.block) ? undefined : segments ? 'segments' : 'bar' });
}
</script>

<template>
    <!-- Not while the presentation shows its own progress: the blocks show none then (Plan.md 109). -->
    <template v-if="pageProgressOn(block) && !editor.draft?.playlist.progress">
        <SegmentField
            :model-value="pageProgressSegments(block) ? 'segments' : 'bar'"
            :options="styleOptions"
            :label="t.inspector.progressStyle"
            testid="page-progress-style"
            @update:model-value="setStyle"
        />
        <SegmentField
            :model-value="pageProgressEdge(block) ? 'edge' : 'inset'"
            :options="placementOptions"
            :label="t.inspector.progressPlacement"
            testid="page-progress-placement"
            @update:model-value="setBlock({ pageProgressPlacement: $event === 'edge' ? 'edge' : undefined })"
        />
    </template>
</template>
