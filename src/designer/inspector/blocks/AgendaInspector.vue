<script setup lang="ts">
/**
 * The block "Ablauf" (Plan.md 118): the calendars whose agenda it reads, then "Darstellung" – the look, with the tile and the
 * note and people in the own look, and the parts that can be left out – then "Schrift". The calendars, the look and the
 * countdown and delay go to the short menu.
 */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import { th } from '../../../i18n/help';
import type { Block } from '../../../model/schema';
import CalendarField from '../../CalendarField.vue';
import InspectorSection from '../../InspectorSection.vue';
import { useCalendarChoice } from '../calendar-choice';
import SegmentField from '../fields/SegmentField.vue';
import TileField from '../fields/TileField.vue';
import NumberField from '../fields/NumberField.vue';
import ToggleField from '../fields/ToggleField.vue';
import FontSection from '../FontSection.vue';
import { AGENDA_TILES } from '../layouts';
import { useBlockEdit } from '../use-block';

const props = defineProps<{ block: Extract<Block, { type: 'agenda' }> }>();
const { setBlock } = useBlockEdit(() => props.block);
const { calendars, hidden, released, toggleCalendar } = useCalendarChoice(() => props.block);
const card = computed(() => props.block.layout === 'card');
const tiles = [
    { value: 'time', label: t.inspector.agendaTileTime },
    { value: 'position', label: t.inspector.agendaTilePosition },
    { value: 'none', label: t.inspector.agendaTileNone },
];
const countdowns = [
    { value: 'digits', label: t.inspector.agendaCountdownDigits },
    { value: 'ring', label: t.inspector.agendaCountdownRing },
];
const tile = computed(() => props.block.tile ?? 'time');
/** The view first, then what is switched on. */
const look = computed(() =>
    [
        card.value ? t.inspector.agendaLayoutCard : t.inspector.agendaLayoutChurchtools,
        card.value && tile.value !== 'none' && tiles.find((o) => o.value === tile.value)?.label,
        props.block.showNext && t.inspector.showNext,
        props.block.showCountdown && t.inspector.showCountdown,
        props.block.showDelay && t.inspector.showDelay,
        card.value && props.block.showNote && t.inspector.showNote,
        card.value && props.block.showResponsible && t.inspector.showResponsible,
        card.value && props.block.showSong && t.inspector.showSong,
        card.value && props.block.showSignal && t.inspector.showSignal,
        card.value && props.block.dark && t.inspector.agendaDark,
    ]
        .filter(Boolean)
        .join(' · '),
);
const help = computed(() => ({
    intro: th.agenda.intro,
    items: [th.agenda.view, ...(card.value ? [th.agenda.tile] : []), th.agenda.next, ...(card.value ? [th.agenda.countdownStyle] : []), th.agenda.countdown, th.agenda.delay, ...(card.value ? [th.agenda.note, th.agenda.responsible, th.agenda.song, th.agenda.signal, th.agenda.dark] : [])],
}));
</script>

<template>
    <CalendarField quick :calendars="calendars" :chosen-ids="block.calendarIds" :hidden="hidden" :released="released" :extra-intro="t.inspector.agendaInfo" @toggle="toggleCalendar" />
    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="look" :help="help">
        <TileField quick :model-value="block.layout ?? 'churchtools'" :options="AGENDA_TILES" :label="t.inspector.view" testid="agenda-layout" @update:model-value="setBlock({ layout: $event === 'card' ? 'card' : undefined })" />
        <SegmentField v-if="card" :model-value="tile" :options="tiles" :label="t.inspector.agendaTile" testid="agenda-tile-kind" @update:model-value="setBlock({ tile: $event === 'time' ? undefined : ($event as 'position' | 'none') })" />
        <SegmentField v-if="card" :model-value="block.countdownStyle ?? 'digits'" :options="countdowns" :label="t.inspector.agendaCountdownStyle" testid="agenda-countdown-style" @update:model-value="setBlock({ countdownStyle: $event === 'ring' ? 'ring' : undefined })" />
        <ToggleField :model-value="block.showNext" :label="t.inspector.showNext" testid="agenda-show-next" @update:model-value="setBlock({ showNext: $event })" />
        <ToggleField quick :model-value="block.showCountdown" :label="t.inspector.showCountdown" :quick-label="t.quick.short.countdown" testid="agenda-show-countdown" @update:model-value="setBlock({ showCountdown: $event })" />
        <ToggleField quick :model-value="block.showDelay" :label="t.inspector.showDelay" :quick-label="t.quick.short.delay" testid="agenda-show-delay" @update:model-value="setBlock({ showDelay: $event })" />
        <ToggleField v-if="card" :model-value="block.showNote" :label="t.inspector.showNote" testid="agenda-show-note" @update:model-value="setBlock({ showNote: $event })" />
        <ToggleField v-if="card" :model-value="block.showResponsible" :label="t.inspector.showResponsible" testid="agenda-show-responsible" @update:model-value="setBlock({ showResponsible: $event })" />
        <ToggleField v-if="card" :model-value="block.showSong" :label="t.inspector.showSong" testid="agenda-show-song" @update:model-value="setBlock({ showSong: $event })" />
        <ToggleField v-if="card" :model-value="block.showSignal" :label="t.inspector.showSignal" testid="agenda-show-signal" @update:model-value="setBlock({ showSignal: $event })" />
        <NumberField v-if="card && block.showSignal" :model-value="block.warnMinutes ?? 1" :label="t.inspector.agendaWarnMinutes" unit="Minuten" :min="1" :max="15" testid="agenda-warn-minutes" @update:model-value="setBlock({ warnMinutes: $event <= 1 ? undefined : $event })" />
        <ToggleField v-if="card" :model-value="block.dark ?? false" :label="t.inspector.agendaDark" testid="agenda-dark" @update:model-value="setBlock({ dark: $event || undefined })" />
    </InspectorSection>
    <FontSection :block="block" effects="shadow" />
</template>
