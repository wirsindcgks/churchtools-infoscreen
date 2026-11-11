<script setup lang="ts">
/**
 * The block "Liedblatt" (Plan.md 121 B): the calendars whose agenda it follows, like "Ablauf", then "Darstellung" with the chords
 * and "Schrift".
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

const props = defineProps<{ block: Extract<Block, { type: 'songsheet' }> }>();
const { setBlock } = useBlockEdit(() => props.block);
const { calendars, hidden, released, toggleCalendar } = useCalendarChoice(() => props.block);
const look = computed(() => (props.block.showChords ? t.inspector.showChords : t.inspector.songsheetNoChords));
const help = { intro: th.songsheet.intro, items: [th.songsheet.chords] };
</script>

<template>
    <CalendarField quick :calendars="calendars" :chosen-ids="block.calendarIds" :hidden="hidden" :released="released" :extra-intro="t.inspector.songsheetInfo" @toggle="toggleCalendar" />
    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="look" :help="help">
        <ToggleField :model-value="block.showChords" :label="t.inspector.showChords" testid="songsheet-show-chords" @update:model-value="setBlock({ showChords: $event })" />
    </InspectorSection>
    <FontSection :block="block" effects="shadow" />
</template>
