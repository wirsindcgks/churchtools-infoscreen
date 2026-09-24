<script setup lang="ts">
import { computed } from 'vue';
import type { Block } from '../../model/schema';
import { useStageContext } from '../context';
import { formatDate, formatTime, textStyle } from '../format';

const props = defineProps<{ block: Extract<Block, { type: 'clock' }> }>();
const context = useStageContext();

// An unconfirmed device clock shows nothing rather than a wrong time.
const text = computed(() => {
    if (!context.clockConfirmed) return '';
    const time = formatTime(context.now, context.timeZone);
    const date = formatDate(context.now, context.timeZone);
    return props.block.format === 'time' ? time : props.block.format === 'date' ? date : `${date}, ${time}`;
});
</script>

<template>
    <div class="clock" :style="textStyle(block.style)">{{ text }}</div>
</template>

<style scoped>
.clock {
    width: 100%;
    height: 100%;
    font-variant-numeric: tabular-nums;
}
</style>
