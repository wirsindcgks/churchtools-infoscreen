<script setup lang="ts">
/**
 * The administrators' part of a screen (Plan.md, F; Nächste Schritte 15):
 * name and overscan – out of the editor, where designers shape content.
 * Saved against the revision of the screen document only, so it never
 * collides with a designer saving slides at the same time.
 */
import { computed, onMounted, ref } from 'vue';
import type { ScreenDoc } from '../model/schema';
import { ConflictError, type ScreenRepository } from '../store/screen-repository';

const props = defineProps<{ screen: ScreenDoc; repository: ScreenRepository; author: string }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const name = ref(props.screen.name);
const overscan = ref(props.screen.overscanPercent);
const error = ref<string | null>(null);
const busy = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);

const portrait = computed(() => props.screen.stage.height > props.screen.stage.width);
const canSave = computed(() => name.value.trim() !== '' && !busy.value);

onMounted(() => nameInput.value?.focus());

async function save(): Promise<void> {
    if (!canSave.value) return;
    busy.value = true;
    error.value = null;
    try {
        await props.repository.saveScreenSettings(
            props.screen.id,
            { name: name.value.trim(), overscanPercent: Math.min(20, Math.max(0, Number(overscan.value) || 0)) },
            { expectedRevision: props.screen.revision, updatedBy: props.author },
        );
        emit('saved');
    } catch (e) {
        error.value =
            e instanceof ConflictError
                ? `Die Einstellungen wurden inzwischen geändert${e.current.updatedBy ? ` (von ${e.current.updatedBy})` : ''}. Bitte schließen und neu öffnen.`
                : e instanceof Error
                  ? e.message
                  : String(e);
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <div class="d-dialog-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
        <form
            class="d-dialog settings"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            data-testid="screen-settings"
            @submit.prevent="save"
        >
            <h2 id="settings-title">Screen einstellen</h2>
            <label class="d-field">
                Name
                <input ref="nameInput" v-model="name" type="text" maxlength="100" data-testid="settings-name">
                <small v-if="!name.trim()" class="invalid">Ohne Namen lässt sich nicht speichern.</small>
            </label>
            <label class="d-field">
                Overscan-Korrektur (%)
                <input v-model.number="overscan" type="number" min="0" max="20" data-testid="settings-overscan">
                <small>Verkleinert die Bühne auf Fernsehern, die den Rand abschneiden.</small>
            </label>
            <dl>
                <dt>Format</dt>
                <dd>{{ portrait ? 'Hochkant' : 'Quer' }}, {{ screen.stage.width }} × {{ screen.stage.height }}</dd>
                <dt>Adresse</dt>
                <dd><code>{{ screen.slug }}</code></dd>
            </dl>
            <p class="muted">Format und Adresse bleiben fest. Was der Screen zeigt, gestalten die Gestalter im Editor.</p>
            <p v-if="error" class="invalid" role="alert">{{ error }}</p>
            <div class="d-dialog-actions">
                <button class="d-btn" type="button" @click="emit('close')">Abbrechen</button>
                <button class="d-btn d-btn--primary" type="submit" :disabled="!canSave" data-testid="settings-save">
                    Speichern
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped>
.settings {
    display: grid;
    gap: 14px;
}
.settings h2 {
    margin-bottom: 0;
}
dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin: 0;
    font-size: var(--d-size-sm);
}
dt {
    color: var(--d-text-muted);
}
dd {
    margin: 0;
}
.muted {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.invalid {
    margin: 0;
    color: var(--d-danger);
}
</style>
