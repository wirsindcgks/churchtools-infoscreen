<script setup lang="ts">
import { computed } from 'vue';
import type { Block } from '../../model/schema';
import { useStageContext } from '../context';
import { fillStyle } from '../fill';
import { sizedImageUrl, textStyle } from '../format';
import AppointmentListView from './AppointmentListView.vue';
import ClockView from './ClockView.vue';
import NextAppointmentView from './NextAppointmentView.vue';

const props = defineProps<{ block: Block }>();
const context = useStageContext();

const frame = computed(() => ({
    left: `${props.block.x}px`,
    top: `${props.block.y}px`,
    width: `${props.block.width}px`,
    height: `${props.block.height}px`,
}));

const imageUrl = computed(() => {
    if (props.block.type !== 'image') return null;
    const media = context.media.get(props.block.mediaId);
    return media ? sizedImageUrl(media.imageUrl, props.block.width, props.block.height) : null;
});
</script>

<template>
    <div class="block" :class="`block--${block.type}`" :style="frame">
        <div v-if="block.type === 'text'" class="text" :style="textStyle(block.style)">{{ block.text }}</div>

        <div
            v-else-if="block.type === 'shape'"
            class="fill"
            :style="{ ...fillStyle(block.fill), borderRadius: `${block.cornerRadius}px` }"
        />

        <template v-else-if="block.type === 'image'">
            <img v-if="imageUrl" class="image" :src="imageUrl" :style="{ objectFit: block.fit }" alt="">
            <!-- A calm placeholder, never a broken-image icon on a TV. -->
            <div v-else class="placeholder" />
        </template>

        <div v-else-if="block.type === 'church-header'" class="text" :style="textStyle(block.style)">
            <template v-if="block.showName">{{ context.churchName }}</template>
        </div>

        <ClockView v-else-if="block.type === 'clock'" :block="block" />
        <AppointmentListView v-else-if="block.type === 'appointment-list'" :block="block" />
        <NextAppointmentView v-else-if="block.type === 'next-appointment'" :block="block" />
    </div>
</template>

<style scoped>
.block {
    position: absolute;
    overflow: hidden;
}
.text {
    width: 100%;
    height: 100%;
    white-space: pre-wrap;
    overflow-wrap: break-word;
}
.fill,
.image,
.placeholder {
    display: block;
    width: 100%;
    height: 100%;
}
.placeholder {
    background: rgba(255, 255, 255, 0.06);
}
</style>
