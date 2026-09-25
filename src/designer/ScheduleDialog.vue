<script setup lang="ts">
/**
 * What runs on a screen when (Plan.md, Nächste Schritte 17 and 19), opened
 * from the screen's tile: the default playlist, the rules that switch to
 * other playlists in order of precedence, and a preview of any day.
 * Playlists stand on their own (schema 1.4); the screen only chooses among
 * those of its format. Saves the schedule document alone, against its revision.
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { zonedDateKey, zonedParts, zonedTimeToInstant } from '../appointments/zoned';
import { sameStage, type ScheduleRule, type ScreenDoc } from '../model/schema';
import { matchingRuleIndex } from '../player/schedule';
import { ConflictError, type ConflictInfo, type ScreenRepository, type StagedPlaylist } from '../store/screen-repository';
import { cloneJson } from './ops';
import Icon from './Icon.vue';
import PlaylistPicker from './PlaylistPicker.vue';
import { usePreview } from './usePreview';
import {
    createAppointmentRule,
    createTimeRule,
    dayTimeline,
    fromMinutes,
    scheduleProblems,
    WEEKDAYS,
    type AppointmentRule,
    type TimeRule,
} from './schedule-ops';

const props = defineProps<{ slug: string; repository: ScreenRepository; author: string }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const router = useRouter();
const dialog = ref<HTMLElement | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
const saving = ref(false);
const saveError = ref<string | null>(null);
const conflict = ref<ConflictInfo | null>(null);

const screen = ref<ScreenDoc | null>(null);
/** Revision of the schedule document; null while the screen has none yet. */
const scheduleRevision = ref<number | null>(null);
const allPlaylists = ref<StagedPlaylist[]>([]);
const defaultPlaylistId = ref('');
const rules = ref<ScheduleRule[]>([]);
const savedJson = ref('');
/** A rule added while there was no second playlist: its picker opens with the name field. */
const createFor = ref<number | null>(null);

const dirty = computed(() => JSON.stringify([defaultPlaylistId.value, rules.value]) !== savedJson.value);
/** The screen as it would run with this schedule. */
const planned = computed<ScreenDoc | null>(() =>
    screen.value ? { ...screen.value, defaultPlaylistId: defaultPlaylistId.value, schedule: rules.value } : null,
);
/** What a screen may choose: playlists designed for its format. */
const choices = computed(() =>
    screen.value ? allPlaylists.value.filter((p) => sameStage(p.stage, screen.value!.stage)) : [],
);
/** The playlists this schedule shows, in the order they appear. */
const shown = computed(() =>
    [...new Set([defaultPlaylistId.value, ...rules.value.map((r) => r.playlistId)])]
        .map((id) => allPlaylists.value.find((p) => p.id === id))
        .filter((p): p is StagedPlaylist => !!p),
);
const problems = computed(() => (planned.value ? scheduleProblems(planned.value, allPlaylists.value) : []));
const canSave = computed(() => dirty.value && !problems.value.length && !saving.value);

// Appointments of the rule calendars, for the preview; the next 90 days, like the editor preview.
const ruleCalendarIds = computed(() => [
    ...new Set(rules.value.flatMap((r) => (r.kind === 'appointment' ? r.calendarIds : []))),
]);
const { context, calendars } = usePreview(
    ruleCalendarIds,
    computed(() => []),
);

async function load(): Promise<void> {
    loading.value = true;
    loadError.value = null;
    conflict.value = null;
    try {
        const [loaded, overviews] = await Promise.all([
            props.repository.loadScreen(props.slug),
            props.repository.listPlaylists(),
        ]);
        screen.value = loaded.screen;
        scheduleRevision.value = loaded.schedule?.revision ?? null;
        allPlaylists.value = overviews.map((o) => o.playlist);
        defaultPlaylistId.value = loaded.screen.defaultPlaylistId;
        rules.value = cloneJson(loaded.screen.schedule);
        savedJson.value = JSON.stringify([defaultPlaylistId.value, rules.value]);
    } catch (e) {
        loadError.value = e instanceof Error ? e.message : String(e);
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    dialog.value?.focus();
    void load();
});

async function save(expectedRevision = scheduleRevision.value): Promise<boolean> {
    if (!screen.value || problems.value.length) return false;
    saving.value = true;
    saveError.value = null;
    try {
        const saved = await props.repository.saveSchedule(
            screen.value.id,
            { defaultPlaylistId: defaultPlaylistId.value, rules: rules.value },
            { expectedRevision, updatedBy: props.author },
        );
        scheduleRevision.value = saved.revision;
        savedJson.value = JSON.stringify([defaultPlaylistId.value, rules.value]);
        conflict.value = null;
        return true;
    } catch (e) {
        if (e instanceof ConflictError) conflict.value = e.current;
        else saveError.value = e instanceof Error ? e.message : String(e);
        return false;
    } finally {
        saving.value = false;
    }
}

async function saveAndClose(expectedRevision = scheduleRevision.value): Promise<void> {
    if (await save(expectedRevision)) emit('saved');
}

function close(): void {
    if (dirty.value && !window.confirm('Änderungen am Zeitplan verwerfen?')) return;
    emit('close');
}

/** Slides are edited in the editor of the playlist; unsaved schedule changes are saved first, not lost. */
async function editSlides(playlistId: string): Promise<void> {
    if (dirty.value && !(await save())) return;
    await router.push({ name: 'editor', params: { id: playlistId } });
}

/** A new playlist in the screen's format – written at once, so the schedule can choose it. */
async function createPlaylist(name: string): Promise<StagedPlaylist | null> {
    if (!screen.value) return null;
    try {
        const created = await props.repository.createPlaylist({ name, stage: screen.value.stage }, props.author);
        allPlaylists.value = [...allPlaylists.value, created];
        return created;
    } catch (e) {
        saveError.value = e instanceof Error ? e.message : String(e);
        return null;
    }
}

const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2', '#65a30d', '#dc2626'];
function colorOf(playlistId: string): string {
    const index = shown.value.findIndex((p) => p.id === playlistId);
    return PALETTE[(index < 0 ? 0 : index) % PALETTE.length]!;
}
function nameOf(playlistId: string): string {
    return allPlaylists.value.find((p) => p.id === playlistId)?.name || 'Playlist fehlt';
}

// Rules

/** A new rule switches to a playlist other than the default – otherwise it would change nothing. */
function ruleTarget(): string {
    return choices.value.find((p) => p.id !== defaultPlaylistId.value)?.id ?? defaultPlaylistId.value;
}

/** Without a second playlist a rule would change nothing: its picker asks for a new one right away. */
function added(): void {
    createFor.value = choices.value.some((p) => p.id !== defaultPlaylistId.value) ? null : rules.value.length - 1;
}

function addTimeRule(): void {
    rules.value.push(createTimeRule(ruleTarget()));
    added();
}

function addAppointmentRule(): void {
    const first = calendars.value[0];
    if (!first) return;
    rules.value.push(createAppointmentRule(ruleTarget(), [first.id]));
    added();
}

function setRule(index: number, patch: Partial<ScheduleRule>): void {
    const target = rules.value[index];
    if (target) Object.assign(target, patch);
}

function moveRule(from: number, to: number): void {
    if (to < 0 || to >= rules.value.length) return;
    const [rule] = rules.value.splice(from, 1);
    rules.value.splice(to, 0, rule!);
}

function removeRule(index: number): void {
    rules.value.splice(index, 1);
    createFor.value = null;
}

function toggleDay(index: number, rule: TimeRule, day: number): void {
    const days = rule.weekdays.includes(day) ? rule.weekdays.filter((d) => d !== day) : [...rule.weekdays, day];
    setRule(index, { weekdays: days.sort((a, b) => a - b) });
}

function setTime(index: number, key: 'from' | 'to', value: string): void {
    if (/^\d{2}:\d{2}$/.test(value)) setRule(index, { [key]: value });
}

function setMinutes(index: number, key: 'minutesBefore' | 'minutesAfter', value: string): void {
    const n = Math.round(Number(value));
    if (value !== '' && Number.isFinite(n) && n >= 0 && n <= 24 * 60) setRule(index, { [key]: n });
}

/** The last calendar stays: a rule without one could never switch. */
function toggleCalendar(index: number, rule: AppointmentRule, id: number, on: boolean): void {
    const next = on ? [...rule.calendarIds, id] : rule.calendarIds.filter((c) => c !== id);
    if (next.length) setRule(index, { calendarIds: [...new Set(next)].sort((a, b) => a - b) });
}

function calendarName(id: number): string {
    return calendars.value.find((c) => c.id === id)?.name ?? `Kalender ${id}`;
}

// Preview

const PREVIEW_DAYS = 90; // the preview loads appointments this far ahead (usePreview)
const timeZone = computed(() => context.timeZone);
const today = computed(() => zonedDateKey(new Date(), timeZone.value));
const lastDay = computed(() => zonedDateKey(new Date(Date.now() + (PREVIEW_DAYS - 1) * 86_400_000), timeZone.value));
const previewDate = ref(today.value);
const now = zonedParts(new Date(), timeZone.value);
const previewMinute = ref(Math.floor((now.hour * 60 + now.minute) / 15) * 15);

const day = computed(() => {
    const [year, month, dayOfMonth] = (/^\d{4}-\d{2}-\d{2}$/.test(previewDate.value) ? previewDate.value : today.value)
        .split('-')
        .map(Number) as [number, number, number];
    return { year, month, day: dayOfMonth };
});

const weekdayName = computed(() => {
    const noon = zonedTimeToInstant({ ...day.value, hour: 12 }, timeZone.value);
    return WEEKDAYS[zonedParts(noon, timeZone.value).weekday - 1]!.long;
});

const timeline = computed(() =>
    planned.value ? dayTimeline(planned.value, day.value, timeZone.value, context.appointments) : [],
);

const decision = computed(() => {
    if (!planned.value) return null;
    const instant = zonedTimeToInstant(
        { ...day.value, hour: Math.floor(previewMinute.value / 60), minute: previewMinute.value % 60 },
        timeZone.value,
    );
    const ruleIndex = matchingRuleIndex(planned.value, {
        now: instant,
        timeZone: timeZone.value,
        clockConfirmed: true,
        appointments: context.appointments,
    });
    const playlistId = ruleIndex < 0 ? defaultPlaylistId.value : rules.value[ruleIndex]!.playlistId;
    return { ruleIndex, playlistId };
});

const hasAppointmentRules = computed(() => rules.value.some((r) => r.kind === 'appointment'));
</script>

<template>
    <div class="d-dialog-backdrop" @click.self="close">
        <section
            ref="dialog"
            class="d-dialog schedule"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-title"
            tabindex="-1"
            data-testid="schedule-dialog"
            @keydown.esc="close"
        >
            <header class="head">
                <h2 id="schedule-title">Zeitplan{{ screen ? ` – ${screen.name}` : '' }}</h2>
                <button class="d-btn d-btn--icon" type="button" aria-label="Schließen" @click="close">
                    <Icon name="close" />
                </button>
            </header>
            <p v-if="loading" class="muted">Lade …</p>
            <p v-else-if="loadError" class="d-banner d-banner--error" role="alert">{{ loadError }}</p>
            <template v-else-if="screen">
                <p class="muted intro">
                    Ein Screen zeigt seine <strong>Standard-Playlist</strong> – außer eine Regel sagt, dass zu bestimmten
                    Zeiten etwas anderes laufen soll. Zur Wahl stehen alle Playlists im Format des Screens; dieselbe
                    Playlist darf auf mehreren Screens laufen.
                </p>

                <section class="step">
                    <h3>Normalerweise zeigt dieser Screen</h3>
                    <PlaylistPicker
                        v-model="defaultPlaylistId"
                        :choices="choices"
                        :create="createPlaylist"
                        label="Standard-Playlist"
                        testid="default-playlist"
                        @edit="editSlides"
                    />
                </section>

                <section class="step">
                    <h3>Zu bestimmten Zeiten etwas anderes zeigen</h3>
                    <p v-if="!rules.length" class="muted small">
                        Noch keine Regel – es läuft immer „{{ nameOf(defaultPlaylistId) }}". Soll zum Beispiel sonntags
                        vormittags oder rund um den Gottesdienst eine andere Playlist laufen, lege eine Regel an.
                    </p>
                    <p v-else-if="rules.length > 1" class="muted small">Passen mehrere Regeln, gilt die obere.</p>
                    <ol class="rules">
                        <li
                            v-for="(rule, index) in rules"
                            :key="index"
                            class="rule"
                            :style="{ '--rule-color': colorOf(rule.playlistId) }"
                            data-testid="schedule-rule"
                        >
                            <div class="rule-head">
                                <span class="rank">{{ index + 1 }}</span>
                                <strong>{{ rule.kind === 'time' ? 'Zu bestimmten Uhrzeiten' : 'Rund um Termine' }}</strong>
                                <span class="spacer" />
                                <button
                                    class="d-btn d-btn--icon"
                                    type="button"
                                    aria-label="Nach oben – hat Vorrang"
                                    title="Nach oben – hat Vorrang"
                                    :disabled="index === 0"
                                    data-testid="rule-up"
                                    @click="moveRule(index, index - 1)"
                                >
                                    ↑
                                </button>
                                <button
                                    class="d-btn d-btn--icon"
                                    type="button"
                                    aria-label="Nach unten"
                                    title="Nach unten"
                                    :disabled="index === rules.length - 1"
                                    @click="moveRule(index, index + 1)"
                                >
                                    ↓
                                </button>
                                <button
                                    class="d-btn d-btn--icon d-btn--danger"
                                    type="button"
                                    aria-label="Regel entfernen"
                                    title="Regel entfernen"
                                    data-testid="rule-remove"
                                    @click="removeRule(index)"
                                >
                                    <Icon name="trash" />
                                </button>
                            </div>

                            <div v-if="rule.kind === 'time'" class="rule-body">
                                <div class="days" role="group" aria-label="Wochentage">
                                    <button
                                        v-for="d in WEEKDAYS"
                                        :key="d.day"
                                        type="button"
                                        class="day"
                                        :class="{ on: rule.weekdays.includes(d.day) }"
                                        :aria-pressed="rule.weekdays.includes(d.day)"
                                        :title="d.long"
                                        data-testid="rule-day"
                                        @click="toggleDay(index, rule, d.day)"
                                    >
                                        {{ d.short }}
                                    </button>
                                </div>
                                <label class="inline">
                                    von
                                    <input
                                        type="time"
                                        step="300"
                                        :value="rule.from"
                                        data-testid="rule-from"
                                        @change="setTime(index, 'from', ($event.target as HTMLInputElement).value)"
                                    >
                                </label>
                                <label class="inline">
                                    bis
                                    <input
                                        type="time"
                                        step="300"
                                        :value="rule.to"
                                        data-testid="rule-to"
                                        @change="setTime(index, 'to', ($event.target as HTMLInputElement).value)"
                                    >
                                </label>
                            </div>

                            <div v-else class="rule-body appointment">
                                <label class="inline">
                                    <input
                                        class="minutes"
                                        type="number"
                                        min="0"
                                        max="1440"
                                        :value="rule.minutesBefore"
                                        data-testid="rule-before"
                                        @input="setMinutes(index, 'minutesBefore', ($event.target as HTMLInputElement).value)"
                                    >
                                    Min. vor Beginn bis
                                </label>
                                <label class="inline">
                                    <input
                                        class="minutes"
                                        type="number"
                                        min="0"
                                        max="1440"
                                        :value="rule.minutesAfter"
                                        data-testid="rule-after"
                                        @input="setMinutes(index, 'minutesAfter', ($event.target as HTMLInputElement).value)"
                                    >
                                    Min. nach Ende eines Termins in
                                </label>
                                <div class="calendars">
                                    <label v-for="c in calendars" :key="c.id" class="check">
                                        <input
                                            type="checkbox"
                                            :checked="rule.calendarIds.includes(c.id)"
                                            @change="toggleCalendar(index, rule, c.id, ($event.target as HTMLInputElement).checked)"
                                        >
                                        {{ c.name }}
                                    </label>
                                    <span v-for="id in rule.calendarIds.filter((i) => !calendars.some((c) => c.id === i))" :key="id" class="muted small">
                                        {{ calendarName(id) }} (nicht sichtbar)
                                    </span>
                                </div>
                            </div>
                            <div class="rule-body shows">
                                <span class="arrow" aria-hidden="true">→</span>
                                <span>zeigt</span>
                                <PlaylistPicker
                                    :model-value="rule.playlistId"
                                    :choices="choices"
                                    :create="createPlaylist"
                                    :start-creating="createFor === index"
                                    hint="Dafür braucht es eine zweite Playlist: lege sie hier an – oder wähle oben in der Liste eine vorhandene."
                                    :label="`Playlist der Regel ${index + 1}`"
                                    testid="rule-playlist"
                                    @update:model-value="setRule(index, { playlistId: $event })"
                                    @edit="editSlides"
                                />
                            </div>
                        </li>
                    </ol>
                    <div class="adders">
                        <button class="d-btn" type="button" data-testid="add-time-rule" @click="addTimeRule">
                            <Icon name="clock" :size="16" /> Zu bestimmten Uhrzeiten
                        </button>
                        <button
                            class="d-btn"
                            type="button"
                            data-testid="add-appointment-rule"
                            :disabled="!calendars.length"
                            :title="calendars.length ? 'Vor, während und nach Terminen ausgewählter Kalender' : 'Keine Kalender sichtbar'"
                            @click="addAppointmentRule"
                        >
                            <Icon name="calendar" :size="16" /> Rund um Termine
                        </button>
                    </div>
                </section>

                <section class="step">
                    <h3>Vorschau: Was läuft wann?</h3>
                    <div class="preview-controls">
                        <label class="inline">
                            Tag
                            <input v-model="previewDate" type="date" :min="today" :max="lastDay" data-testid="preview-date">
                        </label>
                        <span class="muted small">{{ weekdayName }}</span>
                    </div>
                    <div class="timeline" data-testid="preview-timeline">
                        <button
                            v-for="segment in timeline"
                            :key="segment.start"
                            type="button"
                            class="segment"
                            :style="{
                                flexGrow: segment.end - segment.start,
                                background: colorOf(segment.playlistId),
                            }"
                            :title="`${fromMinutes(segment.start)}–${fromMinutes(segment.end === 1440 ? 1439 : segment.end)}: ${nameOf(segment.playlistId)}`"
                            @click="previewMinute = segment.start"
                        />
                        <span class="needle" :style="{ left: `${(previewMinute / 1440) * 100}%` }" aria-hidden="true" />
                    </div>
                    <div class="scale muted small" aria-hidden="true">
                        <span>0</span><span>6</span><span>12</span><span>18</span><span>24 Uhr</span>
                    </div>
                    <ul class="legend">
                        <li v-for="p in shown" :key="p.id" data-testid="schedule-playlist">
                            <span class="swatch" :style="{ background: colorOf(p.id) }" aria-hidden="true" />
                            {{ p.name }}
                            <span class="muted">· {{ p.slideIds.length }} {{ p.slideIds.length === 1 ? 'Slide' : 'Slides' }}</span>
                        </li>
                    </ul>
                    <label class="slider">
                        <span class="visually-hidden">Uhrzeit</span>
                        <input v-model.number="previewMinute" type="range" min="0" max="1425" step="15" data-testid="preview-time">
                    </label>
                    <p v-if="decision" class="decision" data-testid="preview-result">
                        {{ weekdayName }}, {{ fromMinutes(previewMinute) }} Uhr: läuft
                        <strong :style="{ color: colorOf(decision.playlistId) }">„{{ nameOf(decision.playlistId) }}"</strong>
                        {{ ' ' }}<span class="muted">
                            {{ decision.ruleIndex < 0 ? '– keine Regel passt, Standard' : `– Regel ${decision.ruleIndex + 1}` }}
                        </span>
                    </p>
                    <p v-if="hasAppointmentRules" class="muted small">
                        Termin-Regeln rechnen mit den Terminen der nächsten {{ PREVIEW_DAYS }} Tage. Der Fernseher wechselt erst,
                        wenn seine Uhr bestätigt ist.
                    </p>
                </section>

                <ul v-if="problems.length" class="problems" role="alert" data-testid="schedule-problems">
                    <li v-for="p in problems" :key="p">{{ p }}</li>
                </ul>
                <p v-if="conflict" class="d-banner d-banner--error" role="alert">
                    {{ conflict.updatedBy ?? 'Jemand' }} hat den Zeitplan von „{{ conflict.name }}" inzwischen gespeichert.
                    <button class="d-btn" type="button" @click="load">Neu laden</button>
                    <button class="d-btn" type="button" @click="saveAndClose(conflict.revision)">Meine Fassung speichern</button>
                </p>
                <p v-if="saveError" class="d-banner d-banner--error" role="alert">{{ saveError }}</p>
            </template>

            <div class="d-dialog-actions">
                <button class="d-btn" type="button" data-testid="schedule-cancel" @click="close">Abbrechen</button>
                <button class="d-btn d-btn--primary" type="button" :disabled="!canSave" data-testid="schedule-save" @click="saveAndClose()">
                    {{ saving ? 'Speichert …' : 'Speichern' }}
                </button>
            </div>
        </section>
    </div>
</template>

<style scoped>
.schedule {
    display: grid;
    gap: 10px;
    width: min(760px, 100%);
    overflow-y: auto;
}
.inline input,
.inline select {
    width: auto;
}
.head {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
h2,
h3 {
    margin: 0;
}
h3 {
    margin-top: 8px;
    font-size: 1em;
}
.intro {
    margin: 0;
}
.muted {
    color: var(--d-text-muted);
}
.small {
    font-size: var(--d-size-sm);
    font-weight: 400;
}
ul,
ol {
    margin: 0;
    padding: 0;
    list-style: none;
}
.swatch {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 3px;
}
.inline,
.check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}
.adders {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.step {
    display: grid;
    gap: 8px;
    padding: 12px 14px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius-lg);
}
.step h3 {
    margin: 0;
}
.step p {
    margin: 0;
}
.shows {
    padding-top: 6px;
    border-top: 1px dashed var(--d-divider);
}
.arrow {
    color: var(--d-text-muted);
}
.legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    font-size: var(--d-size-sm);
}
.legend li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.rules {
    display: grid;
    gap: 8px;
}
.rule {
    display: grid;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--d-divider);
    border-left: 4px solid var(--rule-color);
    border-radius: var(--d-radius);
    background: var(--d-panel);
}
.rule-head,
.rule-body {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}
.rank {
    display: inline-grid;
    place-items: center;
    width: 1.6em;
    height: 1.6em;
    border-radius: 50%;
    background: var(--rule-color);
    color: #fff;
    font-size: var(--d-size-sm);
    font-weight: 700;
}
.spacer {
    flex: 1;
}
.days {
    display: inline-flex;
    gap: 4px;
}
.day {
    min-width: 2.4em;
    min-height: 2.1em;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
    background: var(--d-surface);
    color: var(--d-text);
    font: inherit;
    cursor: pointer;
}
.day.on {
    border-color: var(--rule-color);
    background: var(--rule-color);
    color: #fff;
    font-weight: 700;
}
.minutes {
    width: 5em;
}
.calendars {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    width: 100%;
}
.preview-controls {
    display: flex;
    align-items: center;
    gap: 10px;
}
.timeline {
    position: relative;
    display: flex;
    height: 28px;
    overflow: hidden;
    border-radius: var(--d-radius);
}
.segment {
    flex-basis: 0;
    min-width: 0;
    padding: 0;
    border: 0;
    border-right: 1px solid rgb(255 255 255 / 0.5);
    cursor: pointer;
}
.segment:last-of-type {
    border-right: 0;
}
.needle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: var(--d-text);
    box-shadow: 0 0 0 1px var(--d-surface);
    pointer-events: none;
}
.scale {
    display: flex;
    justify-content: space-between;
}
.slider input {
    width: 100%;
}
.decision {
    margin: 0;
}
.problems {
    padding: 8px 12px;
    border-radius: var(--d-radius);
    background: var(--d-danger-pale);
    color: var(--d-danger);
}
.visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
}
</style>
