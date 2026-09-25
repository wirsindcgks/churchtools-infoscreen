<script setup lang="ts">
import { computed } from 'vue';
import { selectUpcoming } from '../../appointments/normalize';
import type { Block } from '../../model/schema';
import { themeOf, useStageContext } from '../context';
import { formatDate, sizedImageUrl, textStyle, timeRange } from '../format';
import { imageBox, nextLayout } from '../theme';
import CalendarBadge from './CalendarBadge.vue';
import DateTile from './DateTile.vue';

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

const card = computed(() => nextLayout(props.block, themeOf(context)) === 'card');

/** Room for the image: beside the text, inside the card's padding (0.8em). */
const room = computed(() => ({
    width: props.block.width * (card.value ? 0.42 : 0.55),
    height: props.block.height - (card.value ? 1.6 * props.block.style.fontSize : 0),
}));
/** The theme's image shape (Plan.md, 27) – 16:9 unless chosen otherwise; null keeps the image's own. */
const box = computed(() => imageBox(themeOf(context).imageRatio, room.value.width, room.value.height));
const image = computed(() => {
    const url = props.block.showImage ? next.value?.imageUrl : null;
    if (!url) return null;
    return box.value
        ? sizedImageUrl(url, box.value.width, box.value.height, 'crop')
        : sizedImageUrl(url, room.value.width, props.block.height);
});
const imageStyle = computed(() =>
    box.value ? { width: `${box.value.width}px`, height: `${box.value.height}px`, flex: 'none', objectFit: 'cover' as const } : {},
);
</script>

<template>
    <!-- The highlighted event of the WordPress plugin (Plan.md, 20): tile, badge, title, text, time, place, image. -->
    <div v-if="card" class="hero" :class="{ 'hero--image': image }" :style="textStyle(block.style)" data-testid="next-card">
        <template v-if="next">
            <div class="hero-text">
                <div class="hero-head">
                    <DateTile :start="next.start" :time-zone="context.timeZone" :color="next.color" />
                    <div class="hero-titles">
                        <CalendarBadge :name="next.calendarName" :color="next.color" />
                        <div class="hero-title">{{ next.title }}</div>
                        <div v-if="next.subtitle" class="hero-subtitle">{{ next.subtitle }}</div>
                    </div>
                </div>
                <p v-if="next.description" class="hero-description">{{ next.description }}</p>
                <div class="hero-meta">
                    <span>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="15" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></svg>
                        {{ formatDate(next.start, context.timeZone) }}
                    </span>
                    <span>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
                        {{ timeRange(next) }}
                    </span>
                    <span v-if="next.location">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></svg>
                        {{ next.location }}
                    </span>
                </div>
            </div>
            <img v-if="image" class="hero-image" :src="image" :style="imageStyle" alt="" data-testid="next-image">
        </template>
        <div v-else class="hero-text hero-subtitle">Derzeit ist kein Termin geplant.</div>
    </div>
    <div v-else class="next" :class="{ 'next--image': image }" :style="textStyle(block.style)">
        <img v-if="image" class="image" :src="image" :style="imageStyle" alt="" data-testid="next-image">
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
    border-radius: var(--isd-radius, 0.3em);
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
.hero {
    display: flex;
    gap: 1.2em;
    align-items: stretch;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 0.8em;
    border-radius: var(--isd-radius, 0.4em);
    background: rgba(255, 255, 255, 0.07);
}
.hero-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: 0.6em;
    min-width: 0;
}
.hero-head {
    display: flex;
    align-items: flex-start;
    gap: 0.7em;
}
.hero-titles {
    display: grid;
    justify-items: start;
    gap: 0.25em;
    min-width: 0;
}
.hero-title {
    font-size: 1.5em;
    font-weight: 700;
    line-height: 1.1;
}
.hero-subtitle {
    font-size: 0.75em;
    opacity: 0.8;
}
/* Three lines at most: a TV is read in passing. */
.hero-description {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    font-size: 0.7em;
    line-height: 1.45;
    opacity: 0.85;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
}
.hero-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3em 1.4em;
    font-size: 0.7em;
    font-weight: 600;
}
/* Title, date, time and place keep their room; the description gives way when the block is small. */
.hero-head,
.hero-meta {
    flex-shrink: 0;
}
.hero-meta span {
    display: inline-flex;
    align-items: center;
    gap: 0.45em;
}
.hero-meta svg {
    flex: none;
    width: 1em;
    height: 1em;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}
.hero-image {
    flex: 0 0 42%;
    min-width: 0;
    max-height: 100%;
    align-self: center;
    object-fit: cover;
    border-radius: var(--isd-radius, 0.3em);
}
</style>
