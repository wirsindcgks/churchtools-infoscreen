<script setup lang="ts">
/**
 * "Probe starten" on the phone page (Plan.md 135 D): a sheet from below with the presentation (only those released with a rehearsal
 * sheet), the duration and the big button. The page writes the override; the sheet only asks.
 */
import { computed, ref } from 'vue';
import { t } from '../i18n/designer';
import ControlSheet from './ControlSheet.vue';
import { DEFAULT_HOURS, REHEARSAL_HOURS } from './rehearsal-override';

const props = defineProps<{
    monitorName: string;
    playlists: { id: string; name: string }[];
    busy: boolean;
    notSaved: boolean;
}>();
const emit = defineEmits<{ close: []; start: [playlistId: string, hours: number] }>();

const chosen = ref<string | null>(null);
const hours = ref(DEFAULT_HOURS);
/** With one presentation it is chosen already. */
const playlist = computed(() => props.playlists.find((p) => p.id === chosen.value) ?? props.playlists[0] ?? null);
</script>

<template>
    <ControlSheet :title="t.control.rehearsalSheetTitle(monitorName)" @close="emit('close')">
        <p v-if="notSaved" class="warn" role="alert">{{ t.control.notSaved }}</p>
        <p v-if="!playlists.length" class="note" data-testid="rehearsal-sheet-none">{{ t.control.screenNoPlaylist }}</p>
        <template v-else>
            <div v-if="playlists.length > 1" class="group" role="group" :aria-label="t.control.playlistChoose">
                <button v-for="p in playlists" :key="p.id" type="button" class="choice" :class="{ chosen: p.id === playlist?.id }" :aria-pressed="p.id === playlist?.id" @click="chosen = p.id">
                    {{ p.name }}
                </button>
            </div>
            <p v-else class="name" data-testid="rehearsal-sheet-playlist">{{ playlists[0]!.name }}</p>
            <div class="group" role="group" :aria-label="t.control.durationChoose">
                <button v-for="h in REHEARSAL_HOURS" :key="h" type="button" class="choice" :class="{ chosen: h === hours }" :aria-pressed="h === hours" :data-testid="`rehearsal-sheet-hours-${h}`" @click="hours = h">
                    {{ t.control.duration(h) }}
                </button>
            </div>
            <p class="note small" data-testid="rehearsal-sheet-note">{{ t.control.rehearsalServiceNote }}</p>
        </template>
        <template v-if="playlists.length" #foot>
            <button type="button" class="start" :disabled="busy || !playlist" data-testid="rehearsal-sheet-start" @click="playlist && emit('start', playlist.id, hours)">
                {{ busy ? t.control.transferSaving : t.control.rehearsalSheetStart }}
            </button>
        </template>
    </ControlSheet>
</template>

<style scoped>
p {
    margin: 0;
}
.name {
    font-weight: 600;
}
.note {
    color: #b8bcc4;
}
.note.small {
    font-size: 0.85rem;
}
.warn {
    padding: 10px 12px;
    border-radius: 8px;
    background: #4a2020;
}
.group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
button {
    font: inherit;
    cursor: pointer;
}
.choice {
    flex: 1 1 0;
    min-height: 52px;
    padding: 6px 12px;
    border: 1px solid #3a3f4a;
    border-radius: 10px;
    background: #101114;
    color: #b8bcc4;
}
.choice.chosen {
    border-color: #e6e8ec;
    color: #f2f2f2;
    font-weight: 600;
}
.start {
    min-height: 64px;
    border: 1px solid #6ea8ff;
    border-radius: 10px;
    background: #2f6fed;
    color: #f2f2f2;
    font-size: 1.3rem;
    font-weight: 600;
}
.start:disabled {
    opacity: 0.4;
}
</style>
