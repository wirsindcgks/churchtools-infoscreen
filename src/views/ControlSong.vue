<script setup lang="ts">
/** One song on the phone page of the musicians (Plan.md 121 E): its name and key, opened with a button for each of its parts. */
import type { SheetSection } from '../agenda/songsheet';
import { t } from '../i18n/designer';

defineProps<{
    title: string;
    songKey?: string;
    parts: SheetSection[];
    open: boolean;
    /** The part the screen shows, if it is a part of this song. */
    active: number | null;
    shown?: boolean;
    played?: boolean;
    disabled: boolean;
}>();
const emit = defineEmits<{ toggle: []; choose: [section: number] }>();
</script>

<template>
    <li class="control-song" :class="{ shown, played }">
        <button type="button" class="song" :aria-expanded="open" @click="emit('toggle')">
            <span>{{ title }}</span>
            <span v-if="songKey" class="key">{{ songKey }}</span>
        </button>
        <template v-if="open">
            <p v-if="!parts.length" class="note">{{ t.control.noSheet }}</p>
            <div v-else class="parts">
                <button
                    v-for="(part, n) in parts"
                    :key="n"
                    type="button"
                    class="part"
                    :class="{ active: active === n }"
                    :disabled="disabled"
                    @click="emit('choose', n)"
                >
                    {{ part.label || t.control.part(n + 1) }}
                </button>
            </div>
        </template>
    </li>
</template>

<style scoped>
.control-song {
    display: grid;
    gap: 8px;
}
p {
    margin: 0;
}
.note {
    color: #b8bcc4;
}
button {
    min-height: 56px;
    border: 1px solid #3a3f4a;
    border-radius: 8px;
    background: #1d2027;
    color: inherit;
    font: inherit;
    cursor: pointer;
}
button:disabled {
    opacity: 0.4;
}
.song {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 0 14px;
    text-align: left;
}
.shown > .song {
    border-color: #6ea8ff;
}
/* Played songs stay in their place, pale but still to be tapped – for a song sung again. */
.played > .song {
    opacity: 0.45;
}
.key {
    color: #b8bcc4;
    font-variant-numeric: tabular-nums;
}
.parts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.part {
    padding: 8px;
}
.part.active {
    background: #2f6fed;
    border-color: #6ea8ff;
    font-weight: 600;
}
</style>
