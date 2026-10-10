<script setup lang="ts">
/**
 * The mark of one profile (Plan.md 80): with brand colours white on a tile in the platform's colour (Instagram with
 * its gradient), else the mark alone in the text colour. Square, as high as the font is tall times its parent's size.
 */
import { computed, useId } from 'vue';
import { SOCIAL_MARKS } from '../social-marks';
import type { SocialKind } from '../social';

const props = defineProps<{ kind: SocialKind; brand: boolean; blockId: string }>();

/** The colour of the tile of a website or an address, which have no brand. */
const NEUTRAL = '#475569';
/** Instagram's gradient, slanting up from the bottom left. */
const INSTAGRAM_STOPS = [
    ['0', '#FEDA75'],
    ['0.25', '#FA7E1E'],
    ['0.5', '#D62976'],
    ['0.75', '#962FBF'],
    ['1', '#4F5BD5'],
] as const;

/** Globe and letter: plain line marks on the 24 × 24 grid; the globe follows `web` in the designer's icons. */
const LINE_MARKS = {
    website: ['M3.5 12a8.5 8.5 0 1 0 17 0a8.5 8.5 0 1 0-17 0', 'M3.5 12h17', 'M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5S9.4 5.9 12 3.5z'],
    email: ['M3 6h18v12H3z', 'M3.5 6.5L12 13l8.5-6.5'],
} as const;

/** One gradient per instance: blocks on a slide, the preview and the thumbnails are in one page, and a shared id would take the first one's. */
const gradientId = `social-gradient-${props.blockId}-${useId()}`.replace(/[^A-Za-z0-9_-]/g, '_');

const brandColor = computed(() => (props.kind === 'website' || props.kind === 'email' ? NEUTRAL : SOCIAL_MARKS[props.kind].hex));
const tileFill = computed(() => (props.kind === 'instagram' ? `url(#${gradientId})` : brandColor.value));
const lines = computed(() => (props.kind === 'website' || props.kind === 'email' ? LINE_MARKS[props.kind] : null));
const filled = computed(() => (props.kind === 'website' || props.kind === 'email' ? null : SOCIAL_MARKS[props.kind].path));
/** The mark fills 62 % of the tile, in its middle. */
const inset = 'translate(4.56 4.56) scale(0.62)';
</script>

<template>
    <svg class="social-mark" viewBox="0 0 24 24" aria-hidden="true" :data-testid="`social-mark-${kind}`">
        <template v-if="brand">
            <defs v-if="kind === 'instagram'">
                <linearGradient :id="gradientId" x1="0" y1="1" x2="1" y2="0">
                    <stop v-for="[offset, color] in INSTAGRAM_STOPS" :key="offset" :offset="offset" :stop-color="color" />
                </linearGradient>
            </defs>
            <rect class="social-tile" width="24" height="24" rx="5.28" :fill="tileFill" />
        </template>
        <g :transform="brand ? inset : undefined" :color="brand ? '#ffffff' : undefined">
            <path v-if="filled" :d="filled" fill="currentColor" />
            <g v-else fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path v-for="d in lines" :key="d" :d="d" />
            </g>
        </g>
    </svg>
</template>

<style scoped>
.social-mark {
    flex: none;
    width: 1.4em;
    height: 1.4em;
}
</style>
