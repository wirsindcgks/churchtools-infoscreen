<script setup lang="ts">
/**
 * The mark "Läuft gerade" (Plan.md 77): the playlist is on a screen right now, by that screen's own sign of
 * life. On a tile's picture and in the editor's bar; the tooltip names the screens and the time of the sign.
 */
import { computed } from 'vue';
import { t } from '../i18n/designer';
import { liveTitle, type LiveScreen } from './alive';

const props = defineProps<{ live: LiveScreen[]; timeZone: string; overlay?: boolean }>();

const title = computed(() => liveTitle(props.live, props.timeZone));
</script>

<template>
    <span class="live-flag" :class="{ overlay }" role="img" :title="title" :aria-label="t.common.runningAria(title)">
        <span class="alive-dot is-online" aria-hidden="true" />
        <span class="live-text">{{ t.common.running }}</span>
    </span>
</template>

<style scoped>
.live-flag {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--d-accent-pale);
    color: var(--d-accent);
    font-size: var(--d-size-sm);
    font-weight: 600;
    white-space: nowrap;
}
.live-flag.overlay {
    /* On a tile's picture: opaque, so it reads on any slide background. */
    position: absolute;
    top: 8px;
    left: 8px;
    background: var(--d-surface);
    box-shadow: var(--d-shadow);
}
.alive-dot {
    flex: none;
    width: 0.65em;
    height: 0.65em;
    border-radius: 50%;
    background: var(--d-success);
}
</style>
