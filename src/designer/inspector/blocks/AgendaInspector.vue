<script setup lang="ts">
/**
 * The block "Ablauf" (Plan.md 118): the calendars whose agenda it reads, then "Darstellung" – the look, with the tile and the
 * note and people in the own look, and the parts that can be left out – then "Schrift". The calendars, the look and the
 * countdown and delay go to the short menu.
 */
import { computed } from 'vue';
import { useInspectorContext } from '../context';
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
import { useInspectorMode } from '../mode';
import { useBlockEdit } from '../use-block';

const props = defineProps<{ block: Extract<Block, { type: 'agenda' }> }>();
const { setBlock } = useBlockEdit(() => props.block);
const { calendars, hidden, released, toggleCalendar } = useCalendarChoice(() => props.block);
const context = useInspectorContext();
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
/** Service groups the notes of which show under the running point (Plan.md 119); the order of the choice is kept. */
const groups = computed(() => context.serviceGroups ?? []);
const mode = useInspectorMode();
const chosenGroups = computed(() => props.block.serviceGroupIds ?? []);
function toggleGroup(id: number, on: boolean): void {
    // Saved in the order of the list, not of the clicks; a group the list does not know any more goes last.
    const rank = (g: number) => (groups.value.some((x) => x.id === g) ? groups.value.findIndex((x) => x.id === g) : groups.value.length);
    const chosen = on ? [...chosenGroups.value, id] : chosenGroups.value.filter((g) => g !== id);
    const next = chosen.sort((a, b) => rank(a) - rank(b));
    setBlock({ serviceGroupIds: next.length ? next : undefined });
}
/** Every chosen group is named – by its number where the list does not know it (not loaded, or gone), never "Keine". */
const groupsSummary = computed(() => {
    if (!chosenGroups.value.length) return t.inspector.agendaGroupsNone;
    return chosenGroups.value.map((id) => groups.value.find((g) => g.id === id)?.name || t.inspector.agendaGroupFallback(id)).join(', ');
});
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
        props.block.showClock && t.inspector.agendaClock,
    ]
        .filter(Boolean)
        .join(' · '),
);
const help = computed(() => ({
    intro: th.agenda.intro,
    items: [th.agenda.view, ...(card.value ? [th.agenda.tile] : []), th.agenda.next, ...(card.value ? [th.agenda.countdownStyle] : []), th.agenda.countdown, th.agenda.delay, ...(card.value ? [th.agenda.note, th.agenda.responsible, th.agenda.song, th.agenda.signal, th.agenda.dark] : []), th.agenda.clock],
}));
</script>

<template>
    <CalendarField quick :calendars="calendars" :chosen-ids="block.calendarIds" :hidden="hidden" :released="released" :extra-intro="t.inspector.agendaInfo" @toggle="toggleCalendar" />
    <!-- Plan.md 119: a choice with a technical name – after the calendars, before "Darstellung" (AGENTS.md, Ordnung im Inspektor). -->
    <InspectorSection v-if="card" id="agenda-service-groups" :title="t.inspector.agendaGroups" :summary="groupsSummary" :help="{ intro: th.agenda.groupNotes }">
        <div class="list" data-testid="agenda-service-groups">
            <ToggleField v-for="g in groups" :key="g.id" :model-value="chosenGroups.includes(g.id)" :label="g.name" :testid="`agenda-service-group-${g.id}`" @update:model-value="toggleGroup(g.id, $event)" />
            <p v-if="mode === 'full' && context.serviceGroupsFailed" class="groups-missing" data-testid="agenda-service-groups-missing">{{ t.inspector.agendaGroupsMissing }}</p>
        </div>
    </InspectorSection>
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
        <ToggleField :model-value="block.showClock" :label="t.inspector.agendaClock" testid="agenda-show-clock" @update:model-value="setBlock({ showClock: $event })" />
    </InspectorSection>
    <FontSection :block="block" effects="shadow" />
</template>

<style scoped>
.list {
    display: grid;
    gap: 8px;
}
/* The list of service groups could not be loaded: said in words, not left empty. */
.groups-missing {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
