<script setup lang="ts">
/**
 * The countdown (Plan.md 32, 79 B2): the time until the next appointment of the calendars. Calendars and whether the
 * title shows go to the short menu.
 */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import { th } from '../../../i18n/help';
import type { Block } from '../../../model/schema';
import CalendarField from '../../CalendarField.vue';
import TagField from '../../TagField.vue';
import InspectorSection from '../../InspectorSection.vue';
import { useCalendarChoice } from '../calendar-choice';
import { useTagChoice } from '../tag-choice';
import TextField from '../fields/TextField.vue';
import ToggleField from '../fields/ToggleField.vue';
import FontSection from '../FontSection.vue';
import { useBlockEdit } from '../use-block';

const props = defineProps<{ block: Extract<Block, { type: 'countdown' }> }>();
const { setBlock } = useBlockEdit(() => props.block);
const { calendars, hidden, released, toggleCalendar } = useCalendarChoice(() => props.block);
const { tags, toggleTag } = useTagChoice(() => props.block);
const look = computed(() => [props.block.showTitle && t.quick.short.title, props.block.runningText.trim() && t.inspector.duringAppointment].filter(Boolean).join(' · '));
</script>

<template>
    <CalendarField quick :calendars="calendars" :chosen-ids="block.calendarIds" :hidden="hidden" :released="released" :extra-intro="t.inspector.countInfo" @toggle="toggleCalendar" />
    <!-- Plan.md 82 C: appointments with these tags stay off the screen. Without the tags (not loaded, unreadable) there is no field. -->
    <TagField v-if="tags" :tags="tags" :chosen-ids="block.hideTagIds ?? []" @toggle="toggleTag" />
    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="look" :help="{ intro: th.countdown.intro, items: [th.countdown.showTitle, th.countdown.running] }">
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
    </InspectorSection>
    <FontSection :block="block" effects="shadow" />
</template>
