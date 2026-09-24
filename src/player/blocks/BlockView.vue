<script setup lang="ts">
import { computed } from 'vue';
import type { Block } from '../../model/schema';
import { imageSource, useStageContext } from '../context';
import { fillStyle } from '../fill';
import { textStyle } from '../format';
import { blockImageUrl, headerLogoUrl } from '../images';
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

const logoUrl = computed(() => {
    if (props.block.type !== 'church-header') return null;
    const url = headerLogoUrl(props.block, context.media, context.churchLogo ?? null);
    return url ? imageSource(context, url) : null;
});

/** Logo and name sit side by side; the block's alignment places the pair. */
const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' } as const;

const imageUrl = computed(() => {
    if (props.block.type !== 'image') return null;
    const media = context.media.get(props.block.mediaId);
    return media ? imageSource(context, blockImageUrl(media, props.block)) : null;
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

        <div
            v-else-if="block.type === 'church-header'"
            class="header"
            :style="{ ...textStyle(block.style), justifyContent: JUSTIFY[block.style.align] }"
        >
            <img v-if="logoUrl" class="logo" :class="{ 'logo--beside-name': block.showName }" :src="logoUrl" alt="">
            <span v-if="block.showName" class="name">{{ context.churchName }}</span>
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
.header {
    display: flex;
    align-items: center;
    gap: 0.5em;
    width: 100%;
    height: 100%;
}
.logo {
    flex: none;
    height: 100%;
    width: auto;
    max-width: 100%;
    object-fit: contain;
}
.logo--beside-name {
    max-width: 50%;
}
.name {
    min-width: 0;
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
