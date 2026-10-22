<script setup lang="ts">
/**
 * The appointment list (Plan.md 79, B2): calendars, then as the look the picture tiles, the period, how many appointments – or,
 * as pages, how long each page stays (Plan.md 23) – and the room switch, then the lists of rooms and services and the font. Calendars,
 * look and period go to the short menu.
 */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import { th } from '../../../i18n/help';
import type { Block } from '../../../model/schema';
import { themeOf, useStageContext } from '../../../player/context';
import { PAGE_SECONDS } from '../../../player/paging';
import { listLayout } from '../../../player/theme';
import PageProgressHint from '../PageProgressHint.vue';
import PageProgressOptions from '../PageProgressOptions.vue';
import PageProgressToggle from '../PageProgressToggle.vue';
import InspectorSection from '../../InspectorSection.vue';
import CalendarField from '../../CalendarField.vue';
import TagField from '../../TagField.vue';
import { useEditorStore } from '../../editor-store';
import { useCalendarChoice } from '../calendar-choice';
import { useTagChoice } from '../tag-choice';
import NumberField from '../fields/NumberField.vue';
import TileField from '../fields/TileField.vue';
import ToggleField from '../fields/ToggleField.vue';
import FontSection from '../FontSection.vue';
import { appointmentListTiles } from '../layouts';
import { useBlockEdit } from '../use-block';
import { useInspectorMode } from '../mode';
import AppointmentExtras from './AppointmentExtras.vue';
import { showRoomHelp } from './appointment-help';

const props = defineProps<{ block: Extract<Block, { type: 'appointment-list' }> }>();
/** Only fields stand in the short menu; a hint or a line of text belongs to the inspector. */
const mode = useInspectorMode();
const editor = useEditorStore();
/** The preview's stage context: paged lists report their page count there. */
const stage = useStageContext();
const { setBlock } = useBlockEdit(() => props.block);
const { calendars, hidden, released, toggleCalendar } = useCalendarChoice(() => props.block);
const { tags, toggleTag } = useTagChoice(() => props.block);

const layouts = computed(() => appointmentListTiles(props.block, themeOf(stage)));
/** The layout the list really has – one that follows the theme included. */
const layout = computed(() => listLayout(props.block, themeOf(stage)));

/** The folded look: the layout the list really has, and how far ahead it looks. */
const summary = computed(() => `${layout.value === 'visitor' ? t.inspector.layoutVisitor : layout.value === 'cards' ? t.inspector.layoutCards : t.inspector.layoutRows} · ${t.inspector.days(props.block.horizonDays)}`);

/** Only the fields the list shows: the calendar badge with cards, count or seconds per page as paging is off or on. */
const appearanceHelp = computed(() => {
    const h = th.appointmentList;
    return {
        intro: h.intro,
        items: [
            h.view,
            ...(layout.value === 'cards' ? [h.showCalendar] : []),
            h.period,
            props.block.showAll ? h.secondsPerPage : h.count,
            ...(props.block.showAll ? [th.pageProgress('die nächste Seite'), th.pageProgressStyle, th.pageProgressPlacement] : []),
            h.showAll,
            showRoomHelp(props.block, themeOf(stage)),
        ],
    };
});

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
    <CalendarField quick :calendars="calendars" :chosen-ids="block.calendarIds" :hidden="hidden" :released="released" @toggle="toggleCalendar" />
    <!-- Plan.md 82 C: appointments with these tags stay off the screen. Without the tags (not loaded, unreadable) there is no field. -->
    <TagField v-if="tags" :tags="tags" :chosen-ids="block.hideTagIds ?? []" @toggle="toggleTag" />
    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="summary" :help="appearanceHelp">
        <!-- Plan.md, 20: the look of the WordPress plugin's list and highlighted event. '' follows the theme (Plan.md 27). -->
        <TileField
            quick
            :model-value="block.layout ?? ''"
            :options="layouts"
            :label="t.inspector.view"
            testid="list-layout"
            @update:model-value="setBlock({ layout: $event || undefined })"
        />
        <!-- Plan.md 85: the calendar badge of the cards can go. -->
        <ToggleField
            v-if="layout === 'cards'"
            :model-value="block.showCalendar !== false"
            :label="t.inspector.showCalendar"
            testid="show-calendar"
            @update:model-value="setBlock({ showCalendar: $event ? undefined : false })"
        />
        <NumberField
            quick
            :model-value="block.horizonDays"
            :label="t.inspector.period"
            :unit="t.inspector.unitDays(block.horizonDays)"
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
        <PageProgressToggle v-if="block.showAll" :block="block" />
        <PageProgressOptions v-if="block.showAll" :block="block" />
        <PageProgressHint v-if="block.showAll" />
        <!-- Plan.md, 23: every appointment of the horizon, page by page. -->
        <ToggleField :model-value="block.showAll ?? false" :label="t.inspector.showAll" testid="show-all" @update:model-value="setBlock({ showAll: $event })" />
        <p v-if="mode === 'full' && block.showAll" class="hint" data-testid="page-hint">{{ pageHint }}</p>
        <AppointmentExtras :block="block" part="toggle" />
    </InspectorSection>
    <AppointmentExtras :block="block" part="sections" />
    <FontSection :block="block" effects="shadow" />
</template>

<style scoped>
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
