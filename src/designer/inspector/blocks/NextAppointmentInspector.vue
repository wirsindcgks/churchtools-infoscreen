<script setup lang="ts">
/**
 * The next appointment (Plan.md 79, B2): calendars, the look as picture tiles, whether the appointment's image shows,
 * then the shared room and service fields and the font. Calendars, look and image go to the short menu.
 */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import { themeOf, useStageContext } from '../../../player/context';
import CalendarField from '../../CalendarField.vue';
import { useCalendarChoice } from '../calendar-choice';
import TileField from '../fields/TileField.vue';
import ToggleField from '../fields/ToggleField.vue';
import FontSection from '../FontSection.vue';
import { nextAppointmentTiles } from '../layouts';
import { useBlockEdit } from '../use-block';
import AppointmentExtras from './AppointmentExtras.vue';

const props = defineProps<{ block: Extract<Block, { type: 'next-appointment' }> }>();
const stage = useStageContext();
const { setBlock } = useBlockEdit(() => props.block);
const { calendars, hidden, toggleCalendar } = useCalendarChoice(() => props.block);

const layouts = computed(() => nextAppointmentTiles(props.block, themeOf(stage)));
</script>

<template>
    <CalendarField quick :calendars="calendars" :chosen-ids="block.calendarIds" :hidden="hidden" @toggle="toggleCalendar" />
    <!-- Plan.md, 20: the highlighted event of the WordPress plugin. '' follows the theme (Plan.md 27). -->
    <TileField
        quick
        :model-value="block.layout ?? ''"
        :options="layouts"
        :label="t.inspector.appearance"
        testid="next-layout"
        @update:model-value="setBlock({ layout: $event || undefined })"
    />
    <ToggleField quick :model-value="block.showImage" :label="t.inspector.showAppointmentImage" :quick-label="t.quick.short.image" testid="show-image" @update:model-value="setBlock({ showImage: $event })" />
    <AppointmentExtras :block="block" />
    <FontSection :block="block" />
</template>
