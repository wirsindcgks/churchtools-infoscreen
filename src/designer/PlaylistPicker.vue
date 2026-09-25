<script setup lang="ts">
/**
 * Choosing a playlist in the schedule – or making a new one on the spot:
 * the last option of the list opens a name field, and the new playlist is
 * chosen right away (Plan.md, Nächste Schritte 17). A playlist made here is
 * written at once; the schedule that uses it is saved with the dialog.
 */
import { nextTick, onMounted, ref } from 'vue';
import type { StagedPlaylist } from '../store/screen-repository';

const props = defineProps<{
    modelValue: string;
    choices: StagedPlaylist[];
    /** Makes the playlist; resolves to it, or to null when that failed (the dialog shows why). */
    create: (name: string) => Promise<StagedPlaylist | null>;
    /** Opens with the name field – for a rule that has no other playlist to show yet. */
    startCreating?: boolean;
    hint?: string;
    label: string;
    testid: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [id: string]; edit: [id: string] }>();

const NEW = '__new__';
const creating = ref(false);
const name = ref('');
const busy = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);

async function openCreate(): Promise<void> {
    creating.value = true;
    await nextTick();
    nameInput.value?.focus();
}

onMounted(() => {
    if (props.startCreating) void openCreate();
});

function changed(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select.value === NEW) {
        select.value = props.modelValue; // the choice stays until the new one exists
        void openCreate();
    } else {
        emit('update:modelValue', select.value);
    }
}

async function submit(): Promise<void> {
    if (!name.value.trim() || busy.value) return;
    busy.value = true;
    try {
        const made = await props.create(name.value.trim());
        if (made) {
            emit('update:modelValue', made.id);
            creating.value = false;
            name.value = '';
        }
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <span class="picker">
        <span class="pick-row">
            <select :value="modelValue" :aria-label="label" :data-testid="testid" @change="changed">
                <option v-for="p in choices" :key="p.id" :value="p.id">{{ p.name }}</option>
                <option :value="NEW">＋ Neue Playlist anlegen …</option>
            </select>
            <button
                class="d-btn edit"
                type="button"
                title="Öffnet die Playlist im Editor; Änderungen am Zeitplan werden vorher gespeichert"
                data-testid="playlist-edit"
                @click="emit('edit', modelValue)"
            >
                Slides bearbeiten
            </button>
        </span>
        <form v-if="creating" class="create" data-testid="inline-create" @submit.prevent="submit">
            <small v-if="hint" class="hint">{{ hint }}</small>
            <input
                ref="nameInput"
                v-model="name"
                type="text"
                maxlength="100"
                placeholder="Name der neuen Playlist"
                aria-label="Name der neuen Playlist"
                data-testid="inline-create-name"
                @keydown.esc.stop="creating = false"
            >
            <button class="d-btn d-btn--primary" type="submit" :disabled="!name.trim() || busy" data-testid="inline-create-save">
                Anlegen
            </button>
            <button class="d-btn" type="button" @click="creating = false">Abbrechen</button>
        </form>
    </span>
</template>

<style scoped>
.picker {
    display: inline-grid;
    gap: 6px;
    min-width: 0;
}
.pick-row {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
}
.edit {
    font-size: var(--d-size-sm);
    white-space: nowrap;
}
.pick-row select {
    width: auto;
    min-width: 12em;
    max-width: 100%;
}
.create {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 8px;
    border: 1px dashed var(--d-interactive);
    border-radius: var(--d-radius);
    background: var(--d-surface);
}
.create input {
    flex: 1 1 12em;
    width: auto;
}
.hint {
    width: 100%;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
