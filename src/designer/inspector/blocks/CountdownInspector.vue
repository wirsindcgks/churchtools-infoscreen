<script setup lang="ts">
/**
 * The countdown (Plan.md 32, 79 B2): the time until the next appointment of the calendars. Calendars and whether the
 * title shows go to the short menu.
 */
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import CalendarField from '../../CalendarField.vue';
import HintRow from '../../HintRow.vue';
import { useCalendarChoice } from '../calendar-choice';
import TextField from '../fields/TextField.vue';
import ToggleField from '../fields/ToggleField.vue';
import FontSection from '../FontSection.vue';
import { useBlockEdit } from '../use-block';
import { useInspectorMode } from '../mode';

const props = defineProps<{ block: Extract<Block, { type: 'countdown' }> }>();
/** Only fields stand in the short menu; a hint or a line of text belongs to the inspector. */
const mode = useInspectorMode();
const { setBlock } = useBlockEdit(() => props.block);
const { calendars, hidden, toggleCalendar } = useCalendarChoice(() => props.block);
</script>

<template>
    <CalendarField quick :calendars="calendars" :chosen-ids="block.calendarIds" :hidden="hidden" @toggle="toggleCalendar" />
    <ToggleField quick :model-value="block.showTitle" :label="t.inspector.showTitle" :quick-label="t.quick.short.title" testid="countdown-title" @update:model-value="setBlock({ showTitle: $event })" />
    <TextField
        :model-value="block.runningText"
        :label="t.inspector.duringAppointment"
        :placeholder="t.inspector.runningPlaceholder"
        :maxlength="200"
        stacked
        testid="countdown-running-text"
        @update:model-value="setBlock({ runningText: $event })"
    />
    <HintRow v-if="mode === 'full'" caption>
        <span>{{ t.inspector.countMode }}</span>
        <template #info>
            {{ t.inspector.countInfo }}
        </template>
    </HintRow>
    <FontSection :block="block" effects="shadow" />
</template>
