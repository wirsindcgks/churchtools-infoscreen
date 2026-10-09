<script setup lang="ts">
/**
 * The calendars of a block (Plan.md 62): a foldable list of the public ones as switches, the same in every block that has
 * calendars (Plan.md 79, B2: the short menu takes it with `quick`, as one chip "Kalender · 3" that opens the whole list). Status stays visible below it – no public calendar at all, and a chosen one that is not public.
 */
import { computed } from 'vue';
import { t } from '../i18n/designer';
import { PUBLIC_CALENDAR_PATH, type Calendar } from '../ct/api';
import { calendarColor } from '../player/format';
import InspectorSection from './InspectorSection.vue';
import ToggleField from './inspector/fields/ToggleField.vue';
import QuickField from './inspector/fields/QuickField.vue';

const props = defineProps<{ calendars: Calendar[]; chosenIds: number[]; hidden: Calendar[]; quick?: boolean }>();
const emit = defineEmits<{ toggle: [id: number, on: boolean] }>();

const chosenCount = computed(() => props.calendars.filter((c) => props.chosenIds.includes(c.id)).length);
const summary = computed(() => t.common.countOf(chosenCount.value, props.calendars.length));
</script>

<template>
    <QuickField :quick="quick" :label="t.common.calendars.title" :face="t.quick.count(t.common.calendars.title, chosenCount)">
        <InspectorSection id="calendars" :title="t.common.calendars.title" :summary="summary">
            <template #info>
                {{ t.common.calendars.info(PUBLIC_CALENDAR_PATH) }}
            </template>
            <ToggleField
                v-for="c in calendars"
                :key="c.id"
                quick
                :model-value="chosenIds.includes(c.id)"
                :label="c.name"
                @update:model-value="emit('toggle', c.id, $event)"
            >
                <template #before><span class="swatch" :style="{ background: calendarColor(c.color) ?? 'transparent' }" /></template>
            </ToggleField>
        </InspectorSection>
        <template v-if="!calendars.length">
            <p class="hint">{{ t.common.calendars.nonePublic }}</p>
            <p class="hint" data-testid="no-public-calendars">
                {{ t.common.calendars.release(PUBLIC_CALENDAR_PATH) }}
            </p>
        </template>
        <p v-for="c in hidden" :key="c.id" class="hint hidden-calendar" :data-testid="`hidden-calendar-${c.id}`">
            {{ t.common.calendars.notPublic(c.name) }}
            <button
                class="d-btn"
                type="button"
                :disabled="chosenIds.length < 2"
                :title="chosenIds.length < 2 ? t.common.calendars.chooseAnotherFirst : undefined"
                @click="emit('toggle', c.id, false)"
            >
                {{ t.common.remove }}
            </button>
        </p>
    </QuickField>
</template>

<style scoped>
.swatch {
    flex: none;
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
