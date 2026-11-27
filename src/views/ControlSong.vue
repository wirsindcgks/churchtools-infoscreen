<script setup lang="ts">
/** One song on the phone page of the musicians (Plan.md 121 E): its name and key, opened with a button for each of its parts. */
import { computed, nextTick, useTemplateRef, watch } from 'vue';
import type { SheetSection } from '../agenda/songsheet';
import { t } from '../i18n/designer';

const props = defineProps<{
    title: string;
    songKey?: string;
    parts: SheetSection[];
    open: boolean;
    /** The part the screen shows, if it is a part of this song. */
    active: number | null;
    shown?: boolean;
    played?: boolean;
    disabled: boolean;
    /** Only the parts: the rehearsal page sets the title as its own heading (Plan.md 121, "Proben"). */
    bare?: boolean;
}>();
const emit = defineEmits<{ toggle: []; choose: [section: number] }>();
const root = useTemplateRef<HTMLElement>('root');

// The running part stays in view when the list rolls (Plan.md 135).
watch(
    () => props.active,
    async (part) => {
        if (part === null) return;
        await nextTick();
        root.value?.querySelector('.part.active')?.scrollIntoView?.({ block: 'nearest' });
    },
    { immediate: true },
);

/** The buttons keep the index of their part in the sheet; the parts outside the flow stand apart below (Plan.md 121 H). */
const buttons = computed(() => props.parts.map((part, n) => ({ part, n })));
const inFlow = computed(() => buttons.value.filter(({ part }) => !part.extra));
const outside = computed(() => buttons.value.filter(({ part }) => part.extra));
</script>

<template>
    <li ref="root" class="control-song" :class="{ shown, played }">
        <button v-if="!bare" type="button" class="song" :aria-expanded="open" @click="emit('toggle')">
            <span>{{ title }}</span>
            <span v-if="songKey" class="key">{{ songKey }}</span>
        </button>
        <template v-if="open">
            <p v-if="!parts.length" class="note">{{ t.control.noSheet }}</p>
            <template v-else>
                <div class="parts">
                    <button
                        v-for="{ part, n } in inFlow"
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
                <template v-if="outside.length">
                    <p class="note small">{{ t.control.notInFlow }}</p>
                    <div class="parts">
                        <button
                            v-for="{ part, n } in outside"
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
            </template>
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
.small {
    font-size: 0.8em;
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
/* Tiles (Plan.md 137 B): two columns, flat, 68 px; the running one blue. */
.parts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}
.part {
    height: 68px;
    min-height: 68px;
    padding: 6px 8px;
    border: 0;
    border-radius: 14px;
    background: #1b1e25;
    font-size: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
}
.part.active {
    background: #2f6fed;
    font-weight: 600;
}
</style>
