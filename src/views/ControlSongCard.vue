<script setup lang="ts">
/**
 * The song on the phone page as a card (Plan.md 135 C, D): its name and key above (with a button to the right and small chips below where
 * the page puts them), the parts as a grid – the running one blue. Only the grid rolls inside the card, the running part is brought into view.
 */
import type { SheetSection } from '../agenda/songsheet';
import ControlSong from './ControlSong.vue';

defineProps<{
    title: string;
    songKey?: string;
    parts: SheetSection[];
    /** The part the screen shows, if it is one of this song. */
    active: number | null;
    disabled: boolean;
    /** Without the parts: the sheet is not there (yet) and the page says why. */
    hideParts?: boolean;
}>();
const emit = defineEmits<{ choose: [section: number] }>();
</script>

<template>
    <section class="control-card song-card">
        <header class="song-head">
            <h2 class="song-title" data-testid="song-title">{{ title }}</h2>
            <span v-if="songKey" class="song-key" data-testid="song-key">{{ songKey }}</span>
            <slot name="action" />
        </header>
        <slot name="sub" />
        <div v-if="!hideParts" class="song-parts">
            <ul class="song-list">
                <ControlSong :title="title" :song-key="songKey" :parts="parts" open bare :active="active" :disabled="disabled" @choose="(n) => emit('choose', n)" />
            </ul>
        </div>
    </section>
</template>

<style scoped>
/* The grid is what rolls: the card takes the space that is left, but never more than the parts need. */
.song-card {
    flex: 0 1 auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
}
.song-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
}
.song-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
    line-height: 1.2;
    color: #f2f2f2;
    overflow-wrap: anywhere;
}
.song-key {
    flex: none;
    color: #b8bcc4;
    font-variant-numeric: tabular-nums;
}
.song-parts {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
}
.song-list {
    list-style: none;
    margin: 0;
    padding: 0;
}
</style>
