<script setup lang="ts">
/**
 * The song on the phone page as a card (Plan.md 135 C, D): its name and key in one row above (with a button to the right and small chips below
 * where the page puts them), the parts as a grid – the running one blue – and a small line under them (slot `foot`). The card fills what is
 * left of the middle; only the grid rolls inside it, the running part is brought into view.
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
    <section class="control-card song-card" :class="{ fill: !hideParts }">
        <header class="song-head">
            <h2 class="song-title" data-testid="song-title">{{ title }}</h2>
            <span v-if="songKey" class="song-key" data-testid="song-key">{{ songKey }}</span>
            <span class="song-gap" />
            <slot name="action" />
        </header>
        <slot name="sub" />
        <div v-if="!hideParts" class="song-parts">
            <ul class="song-list">
                <ControlSong :title="title" :song-key="songKey" :parts="parts" open bare :active="active" :disabled="disabled" @choose="(n) => emit('choose', n)" />
            </ul>
        </div>
        <slot name="foot" />
    </section>
</template>

<style scoped>
/* The card takes what is left; the grid is what rolls, so the parts stay in view as far as the window allows (user, 2026-11-27). */
.song-card {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
}
.song-card.fill {
    flex: 1 1 0;
}
.song-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
}
.song-title {
    flex: 0 1 auto;
    min-width: 0;
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
    line-height: 1.2;
    color: #f2f2f2;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
/* Behind the title, quiet: "Halleluja · C". */
.song-key {
    flex: none;
    color: #b8bcc4;
    font-variant-numeric: tabular-nums;
}
.song-key::before {
    content: '· ';
}
.song-gap {
    flex: 1;
}
.song-parts {
    flex: 1 1 auto;
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
