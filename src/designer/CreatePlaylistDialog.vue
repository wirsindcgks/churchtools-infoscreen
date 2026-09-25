<script setup lang="ts">
/**
 * A new playlist (Plan.md, Nächste Schritte 19): a name and the format its
 * slides are designed for. It starts with one empty slide and runs nowhere
 * until a screen's schedule chooses it.
 */
import { computed, onMounted, ref } from 'vue';
import { STAGE_PRESETS } from '../model/schema';
import type { ScreenRepository } from '../store/screen-repository';
import Icon from './Icon.vue';

const props = defineProps<{ repository: ScreenRepository; author: string }>();
const emit = defineEmits<{ close: []; created: [id: string] }>();

const name = ref('');
const orientation = ref<'landscape' | 'portrait'>('landscape');
const error = ref<string | null>(null);
const busy = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);
const canCreate = computed(() => name.value.trim() !== '' && !busy.value);

const ORIENTATIONS = [
    { value: 'landscape', icon: 'landscape', label: 'Quer', size: '1920 × 1080' },
    { value: 'portrait', icon: 'portrait', label: 'Hochkant', size: '1080 × 1920' },
] as const;

onMounted(() => nameInput.value?.focus());

async function create(): Promise<void> {
    if (!canCreate.value) return;
    error.value = null;
    busy.value = true;
    try {
        const created = await props.repository.createPlaylist(
            { name: name.value, stage: STAGE_PRESETS[orientation.value] },
            props.author,
        );
        emit('created', created.id);
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <div class="d-dialog-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
        <form
            class="d-dialog create"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-playlist-title"
            data-testid="create-playlist-dialog"
            @submit.prevent="create"
        >
            <h2 id="create-playlist-title">Playlist erstellen</h2>
            <label class="d-field">
                Name
                <input
                    ref="nameInput"
                    v-model="name"
                    type="text"
                    maxlength="100"
                    placeholder="z. B. Gottesdienst"
                    data-testid="new-playlist-name"
                >
                <small>Lässt sich im Editor ändern.</small>
            </label>
            <fieldset class="orientation">
                <legend>Format</legend>
                <label
                    v-for="o in ORIENTATIONS"
                    :key="o.value"
                    class="choice"
                    :class="{ chosen: orientation === o.value }"
                >
                    <input v-model="orientation" type="radio" name="orientation" :value="o.value" :data-testid="`new-playlist-${o.value}`">
                    <Icon :name="o.icon" :size="28" />
                    <span>
                        <strong>{{ o.label }}</strong>
                        <small>{{ o.size }}</small>
                    </span>
                </label>
                <small>Sie läuft auf Screens desselben Formats. Welche das sind, wählt der Zeitplan eines Screens.</small>
            </fieldset>
            <p v-if="error" class="invalid" role="alert">{{ error }}</p>
            <div class="d-dialog-actions">
                <button class="d-btn" type="button" @click="emit('close')">Abbrechen</button>
                <button class="d-btn d-btn--create" type="submit" :disabled="!canCreate" data-testid="create-playlist">
                    Erstellen
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped>
.create {
    display: grid;
    gap: 16px;
}
.create h2 {
    margin-bottom: 0;
}
small {
    line-height: 1.35;
}
.orientation {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.orientation legend {
    margin-bottom: 0.2em;
    padding: 0;
}
.orientation > small {
    grid-column: 1 / -1;
}
.choice {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
    color: var(--d-text);
    cursor: pointer;
}
.choice:hover {
    border-color: var(--d-interactive);
}
.choice.chosen {
    border-color: var(--d-accent);
    background: var(--d-accent-pale);
    box-shadow: inset 0 0 0 1px var(--d-accent);
}
.choice:focus-within {
    outline: 2px solid var(--d-accent);
    outline-offset: 1px;
}
/* The radio stays for keyboard and screen readers; the whole tile shows the choice. */
.choice input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
}
.choice span {
    display: grid;
}
.choice small {
    color: var(--d-text-muted);
}
.invalid {
    margin: 0;
    color: var(--d-danger);
}
</style>
