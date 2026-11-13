<script setup lang="ts">
/**
 * The block "Liedblatt" (Plan.md 121 B): the source of the song ("Ablauf" or "Probe", schema 1.65), with "Ablauf" the calendars whose agenda
 * it follows, like "Ablauf", then "Darstellung" with the chords, "Lieder" – which songs of the next four weeks have a file with chords –
 * and "Schrift". With "Probe" the musicians choose the song on the phone page: calendars, "Lieder" and the switches that belong to the agenda are hidden.
 */
import { computed, inject, ref, unref, watch } from 'vue';
import { t } from '../../../i18n/designer';
import { th } from '../../../i18n/help';
import { isRehearsalSheet } from '../../../agenda/songsheet';
import type { Block } from '../../../model/schema';
import { useStageContext } from '../../../player/context';
import CalendarField from '../../CalendarField.vue';
import { useGeneralHelp } from '../../help/register';
import InspectorSection from '../../InspectorSection.vue';
import { loadSongOverview, type SongOverview, type SongRow } from '../../song-overview';
import { useCalendarChoice } from '../calendar-choice';
import NumberField from '../fields/NumberField.vue';
import TileField from '../fields/TileField.vue';
import ToggleField from '../fields/ToggleField.vue';
import FontSection from '../FontSection.vue';
import { SONGSHEET_SOURCE_TILES } from '../layouts';
import { INSPECTOR_MODE } from '../mode';
import { useBlockEdit } from '../use-block';

const props = defineProps<{ block: Extract<Block, { type: 'songsheet' }> }>();
const { setBlock } = useBlockEdit(() => props.block);
const { calendars, hidden, released, toggleCalendar } = useCalendarChoice(() => props.block);
const stage = useStageContext();
/** The list is a section of its own, not a field: the short menu has none (and does not load it). */
const full = computed(() => unref(inject(INSPECTOR_MODE, 'full')) === 'full');
/** The source "Probe": no calendar, no list of songs, nothing that belongs to the agenda. */
const rehearsal = computed(() => isRehearsalSheet(props.block));
const look = computed(() =>
    [
        props.block.showChords ? t.inspector.showChords : t.inspector.songsheetNoChords,
        !rehearsal.value && props.block.nextLeadMinutes ? t.inspector.songsheetLeadSummary(props.block.nextLeadMinutes) : '',
        !rehearsal.value && props.block.pageByTime ? t.inspector.pageByTime : '',
    ]
        .filter(Boolean)
        .join(' · '),
);

const overview = ref<SongOverview | null>(null);
const failed = ref(false);
const loading = ref(false);
let run = 0;
watch(
    () => `${rehearsal.value}:${[...props.block.calendarIds].sort((a, b) => a - b).join(',')}`,
    () => {
        const mine = ++run;
        overview.value = null;
        failed.value = false;
        loading.value = false;
        if (!full.value || rehearsal.value || !props.block.calendarIds.length) return;
        loading.value = true;
        loadSongOverview(props.block.calendarIds, new Date(), stage.timeZone)
            .then((result) => {
                if (mine === run) overview.value = result;
            })
            .catch(() => {
                if (mine === run) failed.value = true;
            })
            .finally(() => {
                if (mine === run) loading.value = false;
            });
    },
    { immediate: true },
);

const rows = computed(() => (overview.value?.state === 'ok' ? overview.value.rows : []));
const missing = computed(() => rows.value.filter((r) => r.status !== 'chords').length);
const summary = computed(() => {
    if (loading.value) return '…';
    if (failed.value || overview.value?.state === 'denied') return t.inspector.songsSummaryUnreadable;
    if (!overview.value || !rows.value.length) return t.inspector.songsSummaryNone;
    return missing.value === 0 ? t.inspector.songsSummaryAll : t.inspector.songsSummaryMissing(missing.value, rows.value.length);
});

const dayFormat = computed(() => new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: stage.timeZone }));
/** The songs grouped by event, in the order of the events. */
const days = computed(() => {
    const groups: { eventId: number; label: string; rows: SongRow[] }[] = [];
    for (const row of rows.value) {
        let group = groups.find((g) => g.eventId === row.eventId);
        if (!group) {
            group = { eventId: row.eventId, label: dayFormat.value.format(row.startMs), rows: [] };
            groups.push(group);
        }
        group.rows.push(row);
    }
    return groups;
});

useGeneralHelp(() => [th.songsheet.source]);
const help = { intro: th.songsheet.intro, items: [th.songsheet.chords, th.songsheet.lead, th.songsheet.pageByTime] };
const songsHelp = { intro: th.songsheet.intro, items: [th.songsheet.songs] };
</script>

<template>
    <TileField quick :model-value="block.source ?? 'agenda'" :options="SONGSHEET_SOURCE_TILES" :label="t.inspector.songsheetSource" testid="songsheet-source" @update:model-value="setBlock({ source: $event === 'rehearsal' ? 'rehearsal' : undefined })" />
    <p v-if="rehearsal && full" class="hint" data-testid="songsheet-rehearsal-info">{{ t.inspector.songsheetRehearsalInfo }}</p>
    <CalendarField v-if="!rehearsal" quick :calendars="calendars" :chosen-ids="block.calendarIds" :hidden="hidden" :released="released" :extra-intro="t.inspector.songsheetInfo" @toggle="toggleCalendar" />
    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="look" :help="help">
        <ToggleField :model-value="block.showChords" :label="t.inspector.showChords" testid="songsheet-show-chords" @update:model-value="setBlock({ showChords: $event })" />
        <ToggleField v-if="!rehearsal" :model-value="block.nextLeadMinutes !== undefined" :label="t.inspector.songsheetLead" testid="songsheet-lead" @update:model-value="setBlock({ nextLeadMinutes: $event ? 3 : undefined })" />
        <NumberField v-if="!rehearsal && block.nextLeadMinutes !== undefined" :model-value="block.nextLeadMinutes" :label="t.inspector.songsheetLeadMinutes" unit="Minuten" :min="1" :max="30" testid="songsheet-lead-minutes" @update:model-value="setBlock({ nextLeadMinutes: $event })" />
        <ToggleField v-if="!rehearsal" :model-value="block.pageByTime" :label="t.inspector.pageByTime" testid="songsheet-page-by-time" @update:model-value="setBlock({ pageByTime: $event })" />
    </InspectorSection>
    <InspectorSection v-if="full && !rehearsal" id="songs" :title="t.inspector.songs" :summary="summary" :help="songsHelp">
        <p v-if="loading" class="hint">{{ t.inspector.songsLoading }}</p>
        <p v-else-if="failed" class="hint">{{ t.inspector.songsFailed }}</p>
        <p v-else-if="overview?.state === 'denied'" class="hint" data-testid="songsheet-songs-denied">{{ t.inspector.songsDenied }}</p>
        <p v-else-if="!rows.length" class="hint">{{ t.inspector.songsNone }}</p>
        <div v-else class="days" data-testid="songsheet-songs">
            <div v-for="day in days" :key="day.eventId" class="day">
                <p class="day-title">{{ day.label }}</p>
                <div v-for="(row, index) in day.rows" :key="index" class="song" data-testid="songsheet-song">
                    <span class="song-name">
                        {{ row.title }}<small v-if="row.arrangement"> · {{ row.arrangement }}</small>
                    </span>
                    <span class="tag" :class="{ 'tag--ok': row.status === 'chords' }" data-testid="songsheet-song-status">{{ t.inspector.songStatus[row.status] }}</span>
                </div>
            </div>
        </div>
    </InspectorSection>
    <FontSection :block="block" effects="shadow" />
</template>

<style scoped>
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.days {
    display: grid;
    gap: 14px;
}
.day {
    display: grid;
    gap: 6px;
}
.day-title {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    font-weight: 600;
}
.song {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
}
.song-name small {
    color: var(--d-text-muted);
}
.tag {
    flex: none;
    padding: 1px 6px;
    border-radius: var(--d-radius);
    background: var(--d-warning-pale);
    color: var(--d-text);
    font-size: var(--d-size-sm);
}
.tag--ok {
    background: var(--d-panel);
    color: var(--d-text-muted);
}
</style>
