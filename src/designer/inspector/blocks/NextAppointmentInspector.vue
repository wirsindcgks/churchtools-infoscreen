<script setup lang="ts">
/**
 * The next appointment (Plan.md 79, B2): calendars, then as the look the picture tiles, whether the appointment's image shows and the room switch,
 * then the lists of rooms and services and the font. Calendars, look and image go to the short menu.
 */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import { themeOf, useStageContext } from '../../../player/context';
import { nextLayout } from '../../../player/theme';
import InspectorSection from '../../InspectorSection.vue';
import CalendarField from '../../CalendarField.vue';
import TagField from '../../TagField.vue';
import { useCalendarChoice } from '../calendar-choice';
import { useTagChoice } from '../tag-choice';
import TileField from '../fields/TileField.vue';
import ToggleField from '../fields/ToggleField.vue';
import FontSection from '../FontSection.vue';
import { nextAppointmentTiles } from '../layouts';
import { useBlockEdit } from '../use-block';
import AppointmentExtras from './AppointmentExtras.vue';
import { showRoomHelp } from './appointment-help';

const props = defineProps<{ block: Extract<Block, { type: 'next-appointment' }> }>();
const stage = useStageContext();
const { setBlock } = useBlockEdit(() => props.block);
const { calendars, hidden, released, toggleCalendar } = useCalendarChoice(() => props.block);
const { tags, toggleTag } = useTagChoice(() => props.block);

const layouts = computed(() => nextAppointmentTiles(props.block, themeOf(stage)));
/** The badge is part of the card only. */
const card = computed(() => nextLayout(props.block, themeOf(stage)) === 'card');
const appearanceHelp = computed(() => ({ items: [showRoomHelp(props.block, themeOf(stage))] }));
const summary = computed(() => (card.value ? t.inspector.layoutCard : t.inspector.layoutClassic));
</script>

<template>
    <CalendarField quick :calendars="calendars" :chosen-ids="block.calendarIds" :hidden="hidden" :released="released" @toggle="toggleCalendar" />
    <!-- Plan.md 82 C: appointments with these tags stay off the screen. Without the tags (not loaded, unreadable) there is no field. -->
    <TagField v-if="tags" :tags="tags" :chosen-ids="block.hideTagIds ?? []" @toggle="toggleTag" />
    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="summary" :help="appearanceHelp">
        <!-- Plan.md, 20: the highlighted event of the WordPress plugin. '' follows the theme (Plan.md 27). -->
        <TileField
            quick
            :model-value="block.layout ?? ''"
            :options="layouts"
            :label="t.inspector.view"
            testid="next-layout"
            @update:model-value="setBlock({ layout: $event || undefined })"
        />
        <!-- Plan.md 85: the calendar badge of the card can go. -->
        <ToggleField
            v-if="card"
            :model-value="block.showCalendar !== false"
            :label="t.inspector.showCalendar"
            testid="show-calendar"
            @update:model-value="setBlock({ showCalendar: $event ? undefined : false })"
        />
        <ToggleField quick :model-value="block.showImage" :label="t.inspector.showAppointmentImage" :quick-label="t.quick.short.image" testid="show-image" @update:model-value="setBlock({ showImage: $event })" />
        <AppointmentExtras :block="block" part="toggle" />
    </InspectorSection>
    <AppointmentExtras :block="block" part="sections" />
    <FontSection :block="block" effects="shadow" />
</template>
