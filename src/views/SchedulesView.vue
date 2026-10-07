<script setup lang="ts">
/**
 * All schedules at a glance (Plan.md, Nächste Schritte 21): per screen the
 * default playlist, the rules in words, and what runs right now – evaluated
 * with the player's own rule matching. Beside them the first slide of the
 * playlist that runs now, or of the line one clicks. Editing opens the same
 * dialog as the screen's tile – by the button or by the picture, since the page
 * is about schedules; the playlist's name below the picture leads to its editor.
 */
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';
import { zonedDateKey, zonedParts } from '../appointments/zoned';
import { currentPerson, displayName } from '../ct/client';
import GroupCard from '../designer/GroupCard.vue';
import Icon from '../designer/Icon.vue';
import { lastEdited } from '../designer/last-edited';
import ModulePage from '../designer/ModulePage.vue';
import PageHeader from '../designer/PageHeader.vue';
import ScheduleDialog from '../designer/ScheduleDialog.vue';
import { ruleCalendarIds, runningNow } from '../designer/running';
import { fromMinutes, playlistColors, ruleSummary, weekTimeline, WEEKDAYS } from '../designer/schedule-ops';
import SearchField from '../designer/SearchField.vue';
import SlideThumb from '../designer/SlideThumb.vue';
import { usePreview } from '../designer/usePreview';
import WeekTimeline, { type TimelineDay } from '../designer/WeekTimeline.vue';
import { blockCalendarIds, type ScreenDoc, type ThemeDoc } from '../model/schema';
import { groupNeeds, postNeeds, roomNeeds } from '../player/data';
import { getRepository } from '../store/backend';
import type { PlaylistOverview, ScreenRepository } from '../store/screen-repository';

const repository = shallowRef<ScreenRepository | null>(null);
const author = ref<string | null>(null);
const screens = ref<ScreenDoc[]>([]);
const playlists = ref(new Map<string, PlaylistOverview>());
const theme = ref<ThemeDoc | null>(null);
const error = ref<string | null>(null);
const editing = ref<string | null>(null);
const query = ref('');
/** Loaded: the page shows its frame before, and its content from then on. */
const ready = computed(() => author.value !== null && repository.value !== null);
/** The playlist a screen's preview shows, by screen id, once someone clicked a line; else what runs now. */
const chosen = reactive(new Map<string, string>());

// Appointments of the rule calendars, for "läuft jetzt", and of the previews' slides; the calendars' names for the rules in words.
const { context, calendars, hiddenCalendars } = usePreview(
    computed(() => [
        ...new Set([
            ...ruleCalendarIds(screens.value),
            ...[...playlists.value.values()].flatMap((o) => (o.firstSlide?.blocks ?? []).flatMap(blockCalendarIds)),
        ]),
    ]),
    computed(() => [...playlists.value.values()].flatMap((o) => o.media)),
    theme,
    computed(() => postNeeds([...playlists.value.values()].flatMap((o) => (o.firstSlide ? [o.firstSlide] : [])))),
    computed(() => groupNeeds([...playlists.value.values()].flatMap((o) => (o.firstSlide ? [o.firstSlide] : [])))),
    computed(() => roomNeeds([...playlists.value.values()].flatMap((o) => (o.firstSlide ? [o.firstSlide] : [])))),
);

const shown = computed(() => {
    const needle = query.value.trim().toLocaleLowerCase('de');
    if (!needle) return screens.value;
    return screens.value.filter((s) =>
        [s.name, ...[s.defaultPlaylistId, ...s.schedule.map((r) => r.playlistId)].map(playlistName)]
            .join(' ')
            .toLocaleLowerCase('de')
            .includes(needle),
    );
});

function playlistName(id: string): string {
    return playlists.value.get(id)?.playlist.name ?? 'Playlist fehlt';
}

/** When and by whom the screen or its schedule was last saved (Plan.md 66). */
function edited(screen: ScreenDoc) {
    return lastEdited(screen.updatedAt, screen.updatedBy, context.timeZone);
}

function calendarName(id: number): string {
    return [...calendars.value, ...hiddenCalendars.value].find((c) => c.id === id)?.name ?? `Kalender ${id}`;
}

/** What runs now: the rule that decides, -1 for the default playlist. */
function running(screen: ScreenDoc) {
    return runningNow(screen, context);
}

/** The line whose playlist the preview shows: the clicked one, else the one that runs now. */
function previewIndex(screen: ScreenDoc): number {
    const id = chosen.get(screen.id);
    if (id === undefined) return running(screen).ruleIndex;
    return id === 'default' ? -1 : Number(id);
}

function previewed(screen: ScreenDoc): PlaylistOverview | null {
    const index = previewIndex(screen);
    const id = index < 0 ? screen.defaultPlaylistId : screen.schedule[index]?.playlistId;
    return (id && playlists.value.get(id)) || null;
}

function choose(screen: ScreenDoc, index: number): void {
    chosen.set(screen.id, index < 0 ? 'default' : String(index));
}

// The week strip (Plan.md 68): seven days from today, a stretch's key is its rule's index or 'default'.
const DAYS = 7;
const todayKey = computed(() => zonedDateKey(context.now, context.timeZone));
const today = computed(() => {
    const [year, month, day] = todayKey.value.split('-').map(Number) as [number, number, number];
    return { year, month, day };
});
const needle = computed(() => {
    const p = zonedParts(context.now, context.timeZone);
    return { dayIndex: 0, minute: p.hour * 60 + p.minute };
});
/** The week strips of all screens; they change with the day, the screens and the appointments, not with the clock's tick. */
const weeks = computed(
    () =>
        new Map(
            screens.value.map((s) => [s.id, weekTimeline(s, today.value, DAYS, context.timeZone, context.appointments)]),
        ),
);
const dayFormat = computed(
    () => new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }),
);

function colorOf(screen: ScreenDoc, playlistId: string): string {
    return playlistColors(screen.defaultPlaylistId, screen.schedule).get(playlistId)!;
}

function weekDays(screen: ScreenDoc): TimelineDay[] {
    const colors = playlistColors(screen.defaultPlaylistId, screen.schedule);
    return (weeks.value.get(screen.id) ?? []).map((day) => ({
        label: WEEKDAYS[day.weekday - 1]!.short,
        title: dayFormat.value.format(new Date(Date.UTC(day.date.year, day.date.month - 1, day.date.day))),
        segments: day.segments.map((segment) => ({
            start: segment.start,
            end: segment.end,
            color: colors.get(segment.playlistId)!,
            key: segment.ruleIndex < 0 ? 'default' : String(segment.ruleIndex),
            label:
                `${WEEKDAYS[day.weekday - 1]!.short} ${fromMinutes(segment.start)}–${fromMinutes(segment.end)}: ` +
                `${playlistName(segment.playlistId)} – ${segment.ruleIndex < 0 ? 'Standard' : `Regel ${segment.ruleIndex + 1}`}`,
        })),
    }));
}

function keyIndex(key: string): number {
    return key === 'default' ? -1 : Number(key);
}

/** A rule line under the pointer or focus lights up its stretches; a stretch under the pointer lights up its line. */
const lineHover = ref<{ screen: string; key: string } | null>(null);
const segmentHover = ref<{ screen: string; key: string } | null>(null);
function isLinked(screen: ScreenDoc, key: string): boolean {
    return segmentHover.value?.screen === screen.id && segmentHover.value.key === key;
}

async function refresh(): Promise<void> {
    if (!repository.value) return;
    const [list, overviews, stored] = await Promise.all([
        repository.value.listScreens(),
        repository.value.listPlaylists(),
        repository.value.loadTheme().catch(() => null),
    ]);
    screens.value = list;
    playlists.value = new Map(overviews.map((o) => [o.playlist.id, o]));
    theme.value = stored;
    // A saved schedule may have fewer lines than the one clicked before.
    chosen.clear();
}

onMounted(async () => {
    try {
        const [person, handle] = await Promise.all([currentPerson(), getRepository()]);
        repository.value = handle.repository;
        await refresh();
        author.value = displayName(person);
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
    }
});
</script>

<template>
    <ModulePage current="schedules">
        <PageHeader icon="calendar" title="Zeitpläne" testid="schedules-heading">
            Welche Playlist auf welchem Screen wann läuft. Passt keine Regel, läuft die Standard-Playlist; passen mehrere,
            gilt die obere. Ein Klick auf eine Zeile zeigt ihre Playlist, ein Klick auf das Bild öffnet den Zeitplan.
        </PageHeader>

        <p v-if="error" class="d-banner d-banner--error" role="alert">{{ error }}</p>
        <p v-else-if="!ready" class="empty">Lade …</p>
        <template v-else>
            <SearchField
                v-model="query"
                placeholder="Suchen nach Screen oder Playlist …"
                label="Zeitpläne durchsuchen"
                testid="schedule-search"
            />

            <GroupCard
                icon="calendar"
                title="Alle Screens"
                :count="`${shown.length} ${shown.length === 1 ? 'Screen' : 'Screens'}`"
                heading-id="schedules-group"
            >
                <ul v-if="shown.length" class="d-tiles">
                    <li v-for="screen in shown" :key="screen.id" class="d-card d-tile" data-testid="schedule-row">
                        <button
                            class="thumb d-tile-media"
                            type="button"
                            :aria-label="`Zeitplan von ${screen.name} bearbeiten`"
                            :title="`Zeitplan von ${screen.name} bearbeiten`"
                            data-testid="schedule-preview"
                            @click="editing = screen.slug"
                        >
                            <SlideThumb
                                :slide="previewed(screen)?.firstSlide ?? null"
                                :stage="previewed(screen)?.playlist.stage ?? screen.stage"
                            />
                        </button>
                        <div class="d-tile-body">
                            <p class="caption">
                                {{ previewIndex(screen) === running(screen).ruleIndex ? 'Läuft jetzt' : 'Vorschau' }}:
                                <RouterLink
                                    v-if="previewed(screen)"
                                    :to="{ name: 'editor', params: { id: previewed(screen)!.playlist.id } }"
                                    :title="`Playlist ${previewed(screen)!.playlist.name} im Editor öffnen`"
                                    data-testid="schedule-playlist"
                                >
                                    {{ previewed(screen)!.playlist.name }}
                                </RouterLink>
                                <strong v-else>Playlist fehlt</strong>
                            </p>
                            <div class="title-row">
                                <h3 class="d-tile-title">{{ screen.name || 'Ohne Namen' }}</h3>
                                <button class="d-btn" type="button" data-testid="schedule-edit" @click="editing = screen.slug">
                                    Bearbeiten
                                </button>
                            </div>
                            <WeekTimeline
                                class="week"
                                :days="weekDays(screen)"
                                :now="needle"
                                :highlight="lineHover?.screen === screen.id ? lineHover.key : null"
                                @hover="(key) => (segmentHover = key === null ? null : { screen: screen.id, key })"
                                @pick="({ segment }) => choose(screen, keyIndex(segment.key))"
                            />
                            <ul class="d-facts">
                                <li :title="screen.stage.height > screen.stage.width ? 'Hochkant' : 'Quer'">
                                    <Icon :name="screen.stage.height > screen.stage.width ? 'portrait' : 'landscape'" :size="16" />
                                    {{ screen.stage.height > screen.stage.width ? 'Hochkant' : 'Quer' }}
                                </li>
                                <li class="d-facts-gap" data-testid="schedule-now">
                                    <Icon name="list" :size="16" />
                                    <span>Jetzt: <strong class="now">{{ playlistName(running(screen).playlistId) }}</strong></span>
                                </li>
                                <li
                                    v-for="(rule, index) in screen.schedule"
                                    :key="index"
                                    class="rule-line"
                                    :class="{
                                        active: running(screen).ruleIndex === index,
                                        previewed: previewIndex(screen) === index,
                                        linked: isLinked(screen, String(index)),
                                    }"
                                    data-testid="schedule-rule-line"
                                    @mouseenter="lineHover = { screen: screen.id, key: String(index) }"
                                    @mouseleave="lineHover = null"
                                    @focusin="lineHover = { screen: screen.id, key: String(index) }"
                                    @focusout="lineHover = null"
                                >
                                    <button type="button" class="line" :aria-pressed="previewIndex(screen) === index" @click="choose(screen, index)">
                                        <span class="swatch" :style="{ background: colorOf(screen, rule.playlistId) }" aria-hidden="true" />
                                        <span class="rank">{{ index + 1 }}</span>
                                        <span class="text">
                                            {{ ruleSummary(rule, calendarName) }}
                                            <span class="arrow" aria-hidden="true">→</span>
                                            <strong>{{ playlistName(rule.playlistId) }}</strong>
                                        </span>
                                    </button>
                                </li>
                                <li
                                    class="rule-line"
                                    :class="{
                                        active: running(screen).ruleIndex < 0,
                                        previewed: previewIndex(screen) < 0,
                                        linked: isLinked(screen, 'default'),
                                    }"
                                    data-testid="schedule-default-line"
                                    @mouseenter="lineHover = { screen: screen.id, key: 'default' }"
                                    @mouseleave="lineHover = null"
                                    @focusin="lineHover = { screen: screen.id, key: 'default' }"
                                    @focusout="lineHover = null"
                                >
                                    <button type="button" class="line" :aria-pressed="previewIndex(screen) < 0" @click="choose(screen, -1)">
                                        <span class="swatch" :style="{ background: colorOf(screen, screen.defaultPlaylistId) }" aria-hidden="true" />
                                        <span class="text">
                                            {{ screen.schedule.length ? 'sonst' : 'immer' }}
                                            <span class="arrow" aria-hidden="true">→</span>
                                            <strong>{{ playlistName(screen.defaultPlaylistId) }}</strong>
                                            <span class="muted">(Standard)</span>
                                        </span>
                                    </button>
                                </li>
                                <li v-if="edited(screen)?.when" class="d-facts-gap" :title="edited(screen)!.whenTitle!" data-testid="schedule-edited-at">
                                    <Icon name="clock" :size="16" />
                                    <span>{{ edited(screen)!.when }}</span>
                                </li>
                                <li v-if="edited(screen)?.by" :class="{ 'd-facts-gap': !edited(screen)?.when }" :title="edited(screen)!.byTitle!" data-testid="schedule-edited-by">
                                    <Icon name="person" :size="16" />
                                    <span>{{ edited(screen)!.by }}</span>
                                </li>
                            </ul>
                        </div>
                    </li>
                </ul>
                <p v-else-if="!screens.length" class="empty">Noch keine Screens – sie legt ein Administrator an.</p>
                <p v-else class="empty">Kein Screen passt zur Suche.</p>
            </GroupCard>
        </template>

        <ScheduleDialog
            v-if="editing && repository && author !== null"
            :slug="editing"
            :repository="repository"
            :author="author"
            @close="editing = null"
            @saved="editing = null; refresh()"
        />
    </ModulePage>
</template>

<style scoped>
/* A list, but laid out like the tiles' div elsewhere. */
ul.d-tiles {
    margin: 0;
    padding: 0;
    list-style: none;
}
.thumb {
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
}
.thumb:focus-visible {
    outline: 2px solid var(--d-accent);
    outline-offset: 2px;
}
.caption {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.caption strong,
.caption a {
    color: var(--d-text);
    font-weight: 700;
}
.title-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
}
.title-row .d-tile-title {
    flex: 1;
    min-width: 0;
}
.week {
    margin: 6px 0;
}
.now {
    color: var(--d-success);
}
.rule-line {
    align-self: stretch;
}
.line {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    width: calc(100% + 16px);
    margin: -3px -8px;
    padding: 3px 8px;
    border: 0;
    border-radius: var(--d-radius);
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    overflow-wrap: anywhere;
    cursor: pointer;
}
.line:hover,
.linked .line {
    background: var(--d-panel);
}
.previewed .line {
    background: var(--d-accent-pale);
}
.active .line {
    box-shadow: inset 3px 0 0 var(--d-success);
}
.swatch {
    flex: none;
    width: 0.8em;
    height: 0.8em;
    margin-top: 0.25em;
    border-radius: 2px;
}
.rank {
    flex: none;
    display: inline-grid;
    place-items: center;
    width: 1.5em;
    height: 1.5em;
    border-radius: 50%;
    background: var(--d-panel);
    font-weight: 700;
}
.text {
    display: flex;
    flex-wrap: wrap;
    gap: 0 4px;
    min-width: 0;
}
.arrow {
    color: var(--d-text-muted);
}
.empty {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.muted {
    color: var(--d-text-muted);
}
</style>
