<script setup lang="ts">
import { computed } from 'vue';
import { selectUpcoming } from '../../appointments/normalize';
import type { Block } from '../../model/schema';
import { useStageContext } from '../context';
import { formatDate, sizedImageUrl, textStyle } from '../format';

const props = defineProps<{ block: Extract<Block, { type: 'next-appointment' }> }>();
const context = useStageContext();

const next = computed(
    () =>
        selectUpcoming(context.appointments, {
            now: context.now,
            timeZone: context.timeZone,
            horizonDays: 60,
            limit: 1,
            calendarIds: props.block.calendarIds,
        })[0] ?? null,
);

const image = computed(() =>
    props.block.showImage && next.value?.imageUrl
        ? sizedImageUrl(next.value.imageUrl, props.block.width * 0.55, props.block.height)
        : null,
);
</script>

<template>
    <div class="next" :class="{ 'next--image': image }" :style="textStyle(block.style)">
        <img v-if="image" class="image" :src="image" alt="">
        <div v-if="next" class="text">
            <div class="label">Nächster Termin</div>
            <div class="title">{{ next.title }}</div>
            <div class="meta">{{ formatDate(next.start, context.timeZone) }}</div>
            <div v-if="!next.allDay" class="meta">{{ next.startTime }} Uhr</div>
            <div v-if="next.subtitle" class="meta">{{ next.subtitle }}</div>
        </div>
        <div v-else class="text meta">Derzeit ist kein Termin geplant.</div>
    </div>
</template>

<style scoped>
.next {
    display: flex;
    gap: 60px;
    align-items: center;
    width: 100%;
    height: 100%;
}
.image {
    flex: 0 0 55%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 12px;
}
.text {
    flex: 1;
    min-width: 0;
}
.label {
    font-size: 0.5em;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    opacity: 0.7;
}
.title {
    font-size: 1.2em;
    font-weight: 700;
    margin: 0.2em 0 0.4em;
}
.meta {
    font-size: 0.7em;
    opacity: 0.9;
}
</style>
