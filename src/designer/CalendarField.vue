<script setup lang="ts">
/**
 * The calendars of a block (Plan.md 62): a foldable list of the public ones, the same in every block that has
 * calendars. Status stays visible below it – no public calendar at all, and a chosen one that is not public.
 */
import { computed } from 'vue';
import { PUBLIC_CALENDAR_PATH, type Calendar } from '../ct/api';
import { calendarColor } from '../player/format';
import InspectorSection from './InspectorSection.vue';

const props = defineProps<{ calendars: Calendar[]; chosenIds: number[]; hidden: Calendar[] }>();
const emit = defineEmits<{ toggle: [id: number, on: boolean] }>();

const summary = computed(() => `${props.calendars.filter((c) => props.chosenIds.includes(c.id)).length} von ${props.calendars.length}`);
</script>

<template>
    <InspectorSection id="calendars" title="Kalender" :summary="summary">
        <template #info>
            Zur Wahl stehen nur öffentliche Kalender. Öffentlich ist ein Kalender, den man in ChurchTools auch ohne
            Anmeldung sieht. Fehlt einer, gibt ihn frei, wer in ChurchTools Berechtigungen verwalten darf:
            {{ PUBLIC_CALENDAR_PATH }}.
        </template>
        <label v-for="c in calendars" :key="c.id" class="check">
            <input
                type="checkbox"
                :checked="chosenIds.includes(c.id)"
                @change="emit('toggle', c.id, ($event.target as HTMLInputElement).checked)"
            >
            <span class="swatch" :style="{ background: calendarColor(c.color) ?? 'transparent' }" />
            {{ c.name }}
        </label>
    </InspectorSection>
    <template v-if="!calendars.length">
        <p class="hint">Kein Kalender ist öffentlich.</p>
        <p class="hint" data-testid="no-public-calendars">
            Freigeben kann, wer in ChurchTools Berechtigungen verwalten darf: {{ PUBLIC_CALENDAR_PATH }}.
        </p>
    </template>
    <p v-for="c in hidden" :key="c.id" class="hint hidden-calendar" :data-testid="`hidden-calendar-${c.id}`">
        {{ c.name }} – nicht öffentlich, erscheint auf keinem Fernseher
        <button
            class="d-btn"
            type="button"
            :disabled="chosenIds.length < 2"
            :title="chosenIds.length < 2 ? 'Wähle zuerst einen anderen Kalender.' : undefined"
            @click="emit('toggle', c.id, false)"
        >
            Entfernen
        </button>
    </p>
</template>

<style scoped>
.check {
    display: flex;
    align-items: center;
    gap: 6px;
}
.swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid var(--d-divider);
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.hidden-calendar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
</style>
