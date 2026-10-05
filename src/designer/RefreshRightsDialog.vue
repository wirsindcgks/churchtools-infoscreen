<script setup lang="ts">
/**
 * Shows what „Rechte aktualisieren" would change (Plan.md 62) before anything is written: per group
 * what comes in and what falls away, and the calendars the administrator does not see – for those
 * the assistant neither grants nor takes back. Like `RemoveSetupDialog`, it only asks; the page writes
 * once it emits `confirm`. No word to type: the preview is the safeguard, and a refresh is no deletion.
 */
import { onMounted, ref } from 'vue';
import type { RefreshGroup, RefreshItem } from '../setup/provision';

const props = defineProps<{
    groups: RefreshGroup[];
    /** Calendars the screens use that the administrator does not see. */
    unchecked: number[];
}>();
const emit = defineEmits<{ close: []; confirm: [] }>();

const confirmButton = ref<HTMLButtonElement | null>(null);
onMounted(() => confirmButton.value?.focus());

/** The writing rights on screens and settings appear once per category with the same words – say them once. */
function lines(items: RefreshItem[]): string[] {
    return [...new Set(items.map((i) => i.label))];
}
</script>

<template>
    <div class="d-dialog-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
        <form
            class="d-dialog refresh"
            role="dialog"
            aria-modal="true"
            aria-labelledby="refresh-rights-title"
            data-testid="refresh-rights-dialog"
            @submit.prevent="emit('confirm')"
        >
            <h2 id="refresh-rights-title">Rechte aktualisieren</h2>
            <section v-for="g in props.groups.filter((x) => x.add.length || x.remove.length)" :key="g.key" :data-testid="`refresh-group-${g.key}`">
                <strong>{{ g.name }}</strong>
                <template v-if="g.add.length">
                    <p class="heading">Kommt dazu</p>
                    <ul data-testid="refresh-add">
                        <li v-for="line in lines(g.add)" :key="line">{{ line }}</li>
                    </ul>
                </template>
                <template v-if="g.remove.length">
                    <p class="heading">Fällt weg</p>
                    <ul data-testid="refresh-remove">
                        <li v-for="line in lines(g.remove)" :key="line">{{ line }}</li>
                    </ul>
                </template>
            </section>
            <section v-if="props.unchecked.length" data-testid="refresh-unchecked">
                <p class="heading">Nicht geprüft</p>
                <p>
                    Du siehst {{ props.unchecked.length === 1 ? 'diesen Kalender' : 'diese Kalender' }} nicht – dafür vergibt
                    und nimmt der Assistent kein Recht:
                    {{ props.unchecked.map((id) => `Kalender ${id}`).join(', ') }}.
                </p>
            </section>
            <p class="muted">Ein entzogenes Recht wirkt bei ChurchTools noch bis zu einer Dreiviertelstunde nach.</p>
            <div class="d-dialog-actions">
                <button class="d-btn" type="button" @click="emit('close')">Abbrechen</button>
                <button ref="confirmButton" class="d-btn d-btn--primary" type="submit" data-testid="refresh-rights-confirm">
                    Übernehmen
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped>
.refresh {
    display: grid;
    gap: 16px;
}
.refresh h2,
.refresh p {
    margin: 0;
}
.refresh section {
    display: grid;
    gap: 4px;
}
.refresh ul {
    margin: 0;
    padding-left: 20px;
}
.heading {
    font-weight: 600;
}
.muted {
    color: var(--d-text-muted);
}
</style>
