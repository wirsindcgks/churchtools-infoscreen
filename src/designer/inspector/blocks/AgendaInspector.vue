<script setup lang="ts">
/**
 * The block "Ablauf" (Plan.md 118): the calendars whose agenda it reads, then "Darstellung" with the two parts that can be
 * left out, then "Schrift". The calendars and the two switches go to the short menu.
 */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import { th } from '../../../i18n/help';
import type { Block } from '../../../model/schema';
import CalendarField from '../../CalendarField.vue';
import InspectorSection from '../../InspectorSection.vue';
import { useCalendarChoice } from '../calendar-choice';
import ToggleField from '../fields/ToggleField.vue';
import FontSection from '../FontSection.vue';
import { useBlockEdit } from '../use-block';

const props = defineProps<{ block: Extract<Block, { type: 'agenda' }> }>();
const { setBlock } = useBlockEdit(() => props.block);
const { calendars, hidden, released, toggleCalendar } = useCalendarChoice(() => props.block);
const look = computed(() => [props.block.showCountdown && t.inspector.showCountdown, props.block.showDelay && t.inspector.showDelay].filter(Boolean).join(' · '));
</script>

<template>
    <CalendarField quick :calendars="calendars" :chosen-ids="block.calendarIds" :hidden="hidden" :released="released" :extra-intro="t.inspector.agendaInfo" @toggle="toggleCalendar" />
    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="look" :help="{ intro: th.agenda.intro, items: [th.agenda.countdown, th.agenda.delay] }">
        <ToggleField quick :model-value="block.showCountdown" :label="t.inspector.showCountdown" :quick-label="t.quick.short.countdown" testid="agenda-show-countdown" @update:model-value="setBlock({ showCountdown: $event })" />
        <ToggleField quick :model-value="block.showDelay" :label="t.inspector.showDelay" :quick-label="t.quick.short.delay" testid="agenda-show-delay" @update:model-value="setBlock({ showDelay: $event })" />
    </InspectorSection>
    <FontSection :block="block" effects="shadow" />
</template>
