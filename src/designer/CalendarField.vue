<script setup lang="ts">
/**
 * The calendars of a block (Plan.md 62): a foldable list of the public ones – and released ones, marked "nicht öffentlich" (Plan.md 85 b) – as switches (the `info` slot adds a line to its (i)), the same in every block that has
 * calendars (Plan.md 79, B2: the short menu takes it with `quick`, as one chip "Kalender 3 von 4" that opens the whole list). Status stays visible below it – no public calendar at all, and a chosen one that is not public.
 */
import { computed, ref } from 'vue';
import { t } from '../i18n/designer';
import { PUBLIC_CALENDAR_PATH, type Calendar } from '../ct/api';
import { calendarColor } from '../player/format';
import InspectorSection from './InspectorSection.vue';
import { LIST_SEARCH_FROM, matchesName } from './name-search';
import SearchField from './SearchField.vue';
import ToggleField from './inspector/fields/ToggleField.vue';
import QuickField from './inspector/fields/QuickField.vue';

const props = defineProps<{ calendars: Calendar[]; chosenIds: number[]; hidden: Calendar[]; released?: number[]; quick?: boolean }>();
const emit = defineEmits<{ toggle: [id: number, on: boolean] }>();
defineSlots<{ info?(): unknown }>();

const chosenCount = computed(() => props.calendars.filter((c) => props.chosenIds.includes(c.id)).length);
const summary = computed(() => t.common.countOf(chosenCount.value, props.calendars.length));
/** Many calendars get a search (Plan.md 93); a chosen one stays in the list whatever it says. */
const query = ref('');
const searchable = computed(() => props.calendars.length >= LIST_SEARCH_FROM);
const shown = computed(() => props.calendars.filter((c) => props.chosenIds.includes(c.id) || matchesName(c.name, query.value)));
/** Only chosen ones left: the search found nothing new. */
const nothingFound = computed(() => searchable.value && !!query.value.trim() && shown.value.every((c) => props.chosenIds.includes(c.id)));
/** The chip says what the fold says; while nothing is chosen, what to do. */
const face = computed(() => (chosenCount.value ? t.quick.listFace(t.common.calendars.title, summary.value) : t.quick.chooseCalendars));
</script>

<template>
    <QuickField :quick="quick" :label="t.common.calendars.title" :face="face">
        <InspectorSection id="calendars" :title="t.common.calendars.title" :summary="summary">
            <template #info>
                {{ t.common.calendars.info(PUBLIC_CALENDAR_PATH) }}
                <template v-if="$slots.info"><br><slot name="info" /></template>
            </template>
            <SearchField v-if="searchable" v-model="query" :placeholder="t.common.searchList" :label="t.common.searchList" testid="calendars-search" />
            <ToggleField
                v-for="c in shown"
                :key="c.id"
                quick
                :model-value="chosenIds.includes(c.id)"
                :label="released?.includes(c.id) ? `${c.name} · ${t.common.calendars.releasedBadge}` : c.name"
                @update:model-value="emit('toggle', c.id, $event)"
            >
                <template #before><span class="swatch" :style="{ background: calendarColor(c.color) ?? 'transparent' }" /></template>
            </ToggleField>
            <p v-if="nothingFound" class="hint" data-testid="calendars-search-empty">{{ t.common.nothingFound(query) }}</p>
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
