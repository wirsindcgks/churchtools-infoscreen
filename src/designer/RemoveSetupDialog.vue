<script setup lang="ts">
/**
 * Confirms „Einrichtung entfernen" (Plan.md, F, 2026-09-28): a plain
 * `window.confirm` was too easy to click away without reading. The dialog
 * names exactly what disappears and asks for the word „entfernen" typed out,
 * so the click that deletes two groups is never an accident.
 *
 * It only asks – the actual deletion happens on the page once it emits
 * `confirm`, and closes right away: the page's assistant card is the one
 * place that already shows progress and errors for every assistant action,
 * and duplicating that inside a dialog that is about to vanish would only
 * split the story in two.
 */
import { computed, onMounted, ref } from 'vue';
import { GROUP_NAMES } from '../setup/provision';

export interface RemoveGroupInfo {
    id: number;
    /** `null`: the group is gone already – nothing left to show but its id. */
    name: string | null;
    /** Unknown unless the page happened to load this group's members already. */
    memberCount?: number;
}

const props = withDefaults(defineProps<{ groups: RemoveGroupInfo[]; ownMemberOf?: string[] }>(), {
    ownMemberOf: () => [],
});
const emit = defineEmits<{ close: []; confirm: [] }>();

const confirmText = ref('');
const confirmInput = ref<HTMLInputElement | null>(null);
const canConfirm = computed(() => confirmText.value.trim().toLowerCase() === 'entfernen');

onMounted(() => confirmInput.value?.focus());

function confirm(): void {
    if (!canConfirm.value) return;
    emit('confirm');
}
</script>

<template>
    <div class="d-dialog-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
        <form
            class="d-dialog remove"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-setup-title"
            data-testid="remove-setup-dialog"
            @submit.prevent="confirm"
        >
            <h2 id="remove-setup-title">Einrichtung entfernen</h2>
            <p>Das wird gelöscht:</p>
            <ul class="groups">
                <li v-for="g in props.groups" :key="g.id">
                    <template v-if="g.name">
                        „{{ g.name }}"<template v-if="g.memberCount !== undefined">
                            – {{ g.memberCount }} {{ g.memberCount === 1 ? 'Mitglied' : 'Mitglieder' }}
                        </template>
                    </template>
                    <template v-else>Gruppe {{ g.id }} (gibt es nicht mehr)</template>
                </li>
            </ul>
            <p>
                Gestalter kommen nicht mehr in den Designer. Fernseher, deren Konto in „{{ GROUP_NAMES.device }}" ist,
                bekommen keine neuen Inhalte mehr. Screens, Playlists und Bilder bleiben erhalten; neu einrichten geht
                jederzeit.
            </p>
            <p v-if="props.ownMemberOf.length" class="d-banner d-banner--warning" data-testid="remove-setup-own-warning">
                Du bist selbst Mitglied in {{ props.ownMemberOf.map((n) => `„${n}"`).join(' und ') }}. Hast du die Rechte
                am Designer nur über diese Gruppe, kommst du danach nicht mehr hinein – prüfe vorher Schritt 2 der
                Einrichtung.
            </p>
            <label class="d-field">
                Zum Bestätigen <strong>entfernen</strong> eintippen
                <input
                    ref="confirmInput"
                    v-model="confirmText"
                    type="text"
                    autocomplete="off"
                    autocapitalize="off"
                    spellcheck="false"
                    data-testid="remove-setup-confirm-input"
                >
            </label>
            <div class="d-dialog-actions">
                <button class="d-btn" type="button" @click="emit('close')">Abbrechen</button>
                <button class="d-btn d-btn--danger" type="submit" :disabled="!canConfirm" data-testid="remove-setup-confirm">
                    Einrichtung entfernen
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped>
.remove {
    display: grid;
    gap: 16px;
}
.remove h2 {
    margin-bottom: 0;
}
.remove p {
    margin: 0;
}
.groups {
    margin: 0;
    padding-left: 20px;
}
</style>
