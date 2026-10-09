<script setup lang="ts">
/**
 * The appointment list (Plan.md 79, B2): calendars, the look as picture tiles, the period, how many appointments – or,
 * as pages, how long each page stays (Plan.md 23) – then the shared room and service fields and the font. Calendars,
 * look and period go to the short menu.
 */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import { themeOf, useStageContext } from '../../../player/context';
import { PAGE_SECONDS } from '../../../player/paging';
import CalendarField from '../../CalendarField.vue';
import { useEditorStore } from '../../editor-store';
import { useCalendarChoice } from '../calendar-choice';
import NumberField from '../fields/NumberField.vue';
import TileField from '../fields/TileField.vue';
import ToggleField from '../fields/ToggleField.vue';
import FontSection from '../FontSection.vue';
import { appointmentListTiles } from '../layouts';
import { useBlockEdit } from '../use-block';
import AppointmentExtras from './AppointmentExtras.vue';

const props = defineProps<{ block: Extract<Block, { type: 'appointment-list' }> }>();
const editor = useEditorStore();
/** The preview's stage context: paged lists report their page count there. */
const stage = useStageContext();
const { setBlock } = useBlockEdit(() => props.block);
const { calendars, hidden, toggleCalendar } = useCalendarChoice(() => props.block);

const layouts = computed(() => appointmentListTiles(props.block, themeOf(stage)));

/** How a paged list will run – with the page count the stage preview measured. */
const pageHint = computed(() => {
    const pages = stage.pages?.[props.block.id] ?? 1;
    if (pages < 2) return t.inspector.pageHintOne;
    const perPage = props.block.pageSeconds ?? PAGE_SECONDS;
    const needed = pages * perPage;
    const duration = editor.slide?.durationSeconds ?? 0;
    return needed > duration
        ? t.inspector.pageHintLonger(pages, perPage, needed, duration)
        : t.inspector.pageHintEven(pages, Math.round(duration / pages));
});
</script>

<template>
    <CalendarField quick :calendars="calendars" :chosen-ids="block.calendarIds" :hidden="hidden" @toggle="toggleCalendar" />
    <!-- Plan.md, 20: the look of the WordPress plugin's list and highlighted event. '' follows the theme (Plan.md 27). -->
    <TileField
        quick
        :model-value="block.layout ?? ''"
        :options="layouts"
        :label="t.inspector.appearance"
        testid="list-layout"
        @update:model-value="setBlock({ layout: $event || undefined })"
    />
    <NumberField
        quick
        :model-value="block.horizonDays"
        :label="t.inspector.period"
        :unit="t.inspector.unitDays"
        :min="1"
        :max="366"
        testid="list-days"
        @update:model-value="setBlock({ horizonDays: $event })"
    />
    <NumberField
        v-if="!block.showAll"
        key="limit"
        :model-value="block.limit"
        :label="t.inspector.count"
        :min="1"
        :max="50"
        testid="list-limit"
        @update:model-value="setBlock({ limit: $event })"
    />
    <NumberField
        v-else
        key="seconds"
        :model-value="block.pageSeconds ?? PAGE_SECONDS"
        :label="t.inspector.secondsPerPage"
        :unit="t.inspector.unitSeconds"
        :min="3"
        :max="120"
        testid="page-seconds"
        @update:model-value="setBlock({ pageSeconds: $event })"
    />
    <!-- Plan.md, 23: every appointment of the horizon, page by page. -->
    <ToggleField :model-value="block.showAll ?? false" :label="t.inspector.showAll" testid="show-all" @update:model-value="setBlock({ showAll: $event })" />
    <p v-if="block.showAll" class="hint" data-testid="page-hint">{{ pageHint }}</p>
    <AppointmentExtras :block="block" />
    <FontSection :block="block" />
</template>

<style scoped>
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
