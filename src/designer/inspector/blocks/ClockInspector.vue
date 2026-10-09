<script setup lang="ts">
/** The clock block (Plan.md 79, B2): what it shows, as picture tiles, then the font. The short menu takes the tiles and the colour. */
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import TileField from '../fields/TileField.vue';
import FontSection from '../FontSection.vue';
import { useBlockEdit } from '../use-block';

const props = defineProps<{ block: Extract<Block, { type: 'clock' }> }>();
const { setBlock } = useBlockEdit(() => props.block);

const formats = [
    { value: 'time', label: t.inspector.clockFormats.time, pictogram: 'clock-time' },
    { value: 'date', label: t.inspector.clockFormats.date, pictogram: 'clock-date' },
    { value: 'datetime', label: t.inspector.clockFormats.datetime, pictogram: 'clock-datetime' },
] as const;
</script>

<template>
    <TileField quick :model-value="block.format" :options="formats" :label="t.inspector.appearance" testid="clock-format" @update:model-value="setBlock({ format: $event })" />
    <FontSection :block="block" />
</template>
