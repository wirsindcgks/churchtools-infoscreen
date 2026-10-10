<script setup lang="ts">
/**
 * Social profiles, one line each (schema 1.33, Plan.md 80): the platform's mark on the left, the name on the right.
 * Both are read from the address when drawn. A line never wraps and is cut with "…"; what does not fit the frame
 * is cut by it, there is no paging.
 */
import { computed } from 'vue';
import type { Block } from '../../model/schema';
import { textStyle, verticalAlignOf, verticalStyle } from '../format';
import { socialName, socialProfile } from '../social';
import SocialMark from './SocialMark.vue';

const props = defineProps<{ block: Extract<Block, { type: 'social' }> }>();

/** The links with an address; an empty one is skipped. */
const lines = computed(() =>
    props.block.links
        .filter((link) => link.url.trim())
        .map((link, index) => ({ key: index, kind: socialProfile(link.url).platform, name: socialName(link) })),
);
const row = computed(() => props.block.layout === 'row');
const justify = computed(() => ({ left: 'flex-start', center: 'center', right: 'flex-end' })[props.block.style.align]);
</script>

<template>
    <div v-if="lines.length" class="social" :style="textStyle(block.style)">
        <div
            class="social-lines"
            :class="{ 'social-lines--row': row }"
            :style="{ ...verticalStyle(verticalAlignOf(block) ?? 'top'), ...(row ? { justifyContent: justify } : { alignItems: justify }) }"
        >
            <div v-for="line in lines" :key="line.key" class="social-row" data-testid="social-row">
                <SocialMark :kind="line.kind" :brand="block.brandColors !== false" :block-id="block.id" />
                <span class="social-name" data-testid="social-name">{{ line.name }}</span>
            </div>
        </div>
    </div>
    <div v-else class="placeholder" />
</template>

<style scoped>
.social {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    line-height: 1.3;
}
.social-lines {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 0.4em;
    min-width: 0;
    max-width: 100%;
}
.social-lines--row {
    flex-flow: row wrap;
    gap: 0.4em 1.2em;
}
.social-row {
    display: flex;
    align-items: center;
    gap: 0.5em;
    min-width: 0;
    max-width: 100%;
}
.social-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
