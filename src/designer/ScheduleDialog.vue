<script setup lang="ts">
/**
 * The designers' schedule (Plan.md, Nächste Schritte 17), opened from the
 * screen's tile on the start page: the screen's playlists, the rules that
 * switch between them in order of precedence, and a preview of any day. It
 * loads and saves on its own – through the editor store, so saving is the
 * editor's: against the schedule revision, slides and playlists included.
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { zonedDateKey, zonedParts, zonedTimeToInstant } from '../appointments/zoned';
import type { ScheduleRule } from '../model/schema';
import { matchingRuleIndex } from '../player/schedule';
import type { ScreenRepository } from '../store/screen-repository';
import { useEditorStore } from './editor-store';
import Icon from './Icon.vue';
import { usePreview } from './usePreview';
import {
    createAppointmentRule,
    createTimeRule,
    dayTimeline,
    fromMinutes,
    WEEKDAYS,
    type AppointmentRule,
    type TimeRule,
} from './schedule-ops';

const props = defineProps<{ slug: string; repository: ScreenRepository; author: string }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const router = useRouter();
const editor = useEditorStore();
const dialog = ref<HTMLElement | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);

// Appointments of the rule calendars, for the preview; the next 90 days, like the editor preview.
const ruleCalendarIds = computed(() => [
    ...new Set(editor.rules.flatMap((r) => (r.kind === 'appointment' ? r.calendarIds : []))),
]);
const { context, calendars } = usePreview(
    ruleCalendarIds,
    computed(() => []),
);

onMounted(async () => {
    dialog.value?.focus();
    try {
        editor.attach(props.repository);
        await editor.open(props.slug);
    } catch (e) {
        loadError.value = e instanceof Error ? e.message : String(e);
    } finally {
        loading.value = false;
    }
});

const canSave = computed(() => editor.dirty && !editor.problems.length && editor.status !== 'saving');

async function save(): Promise<boolean> {
    const ok = await editor.save(props.author);
    if (ok) emit('saved');
    return ok;
}

function close(): void {
    if (editor.dirty && !window.confirm('Änderungen am Zeitplan verwerfen?')) return;
    emit('close');
}

/** Slides are edited in the editor; unsaved schedule changes are saved first, not lost. */
async function editSlides(playlistId: string): Promise<void> {
    if (editor.dirty && !(await editor.save(props.author))) return;
    await router.push({ name: 'editor', params: { slug: props.slug }, query: { playlist: playlistId } });
}

const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0891b2', '#65a30d', '#dc2626'];
function colorOf(playlistId: string): string {
    const index = editor.playlists.findIndex((p) => p.id === playlistId);
    return PALETTE[(index < 0 ? 0 : index) % PALETTE.length]!;
}
function nameOf(playlistId: string): string {
    return editor.playlists.find((p) => p.id === playlistId)?.name || 'Playlist fehlt';
}
const defaultId = computed(() => editor.draft?.screen.defaultPlaylistId ?? '');

// Playlists

function addPlaylist(): void {
    editor.addPlaylist(`Playlist ${editor.playlists.length + 1}`);
}

function removePlaylist(id: string): void {
    const ruleCount = editor.rules.filter((r) => r.playlistId === id).length;
    const extra = ruleCount ? ` und ${ruleCount === 1 ? 'die Regel, die sie schaltet' : `die ${ruleCount} Regeln, die sie schalten`}` : '';
    if (window.confirm(`Playlist „${nameOf(id)}"${extra} entfernen? Slides, die nur hier stehen, gehen mit.`)) {
        editor.removePlaylist(id);
    }
}

// Rules

/** A new rule switches to a playlist other than the default – otherwise it would change nothing. */
function ruleTarget(): string {
    return (
        editor.playlists.find((p) => p.id !== defaultId.value && p.id === editor.playlist?.id)?.id ??
        editor.playlists.find((p) => p.id !== defaultId.value)?.id ??
        defaultId.value
    );
}

function addTimeRule(): void {
    editor.addRule(createTimeRule(ruleTarget()));
}

function addAppointmentRule(): void {
    const first = calendars.value[0];
    if (first) editor.addRule(createAppointmentRule(ruleTarget(), [first.id]));
}

function setRule(index: number, patch: Partial<ScheduleRule>): void {
    editor.updateRule(index, patch);
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
    editor.draft ? dayTimeline(editor.draft.screen, day.value, timeZone.value, context.appointments) : [],
);

const decision = computed(() => {
    if (!editor.draft) return null;
    const instant = zonedTimeToInstant(
        { ...day.value, hour: Math.floor(previewMinute.value / 60), minute: previewMinute.value % 60 },
        timeZone.value,
    );
    const ruleIndex = matchingRuleIndex(editor.draft.screen, {
        now: instant,
        timeZone: timeZone.value,
        clockConfirmed: true,
        appointments: context.appointments,
    });
    const playlistId = ruleIndex < 0 ? defaultId.value : editor.rules[ruleIndex]!.playlistId;
    return { ruleIndex, playlistId };
});

const hasAppointmentRules = computed(() => editor.rules.some((r) => r.kind === 'appointment'));
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
                <h2 id="schedule-title">Zeitplan{{ editor.draft ? ` – ${editor.draft.screen.name}` : '' }}</h2>
                <button class="d-btn d-btn--icon" type="button" aria-label="Schließen" @click="close">
                    <Icon name="close" />
                </button>
            </header>
            <p v-if="loading" class="muted">Lade …</p>
            <p v-else-if="loadError" class="d-banner d-banner--error" role="alert">{{ loadError }}</p>
            <template v-else-if="editor.draft">
                <p class="muted intro">
                    Welche Playlist wann läuft. Passt keine Regel, läuft die <strong>Standard-Playlist</strong>; passen
                    mehrere, gilt die <strong>obere</strong>. Die Slides einer Playlist gestaltest du im Editor.
                </p>

                <h3>Playlists</h3>
                <ul class="playlists">
                    <li v-for="p in editor.playlists" :key="p.id" data-testid="schedule-playlist">
                        <span class="swatch" :style="{ background: colorOf(p.id) }" aria-hidden="true" />
                        <input
                            class="name"
                            type="text"
                            maxlength="100"
                            :value="p.name"
                            :aria-label="`Name der Playlist ${p.name}`"
                            data-testid="playlist-name"
                            @input="editor.renamePlaylist(p.id, ($event.target as HTMLInputElement).value)"
                        >
                        <span class="count">{{ p.slideIds.length }} {{ p.slideIds.length === 1 ? 'Slide' : 'Slides' }}</span>
                        <label class="default" :title="p.id === defaultId ? 'Läuft, wenn keine Regel passt' : 'Zur Standard-Playlist machen'">
                            <input
                                type="radio"
                                name="default-playlist"
                                :checked="p.id === defaultId"
                                data-testid="playlist-default"
                                @change="editor.setDefaultPlaylist(p.id)"
                            >
                            Standard
                        </label>
                        <button
                            class="d-btn"
                            type="button"
                            :title="editor.dirty ? 'Speichert den Zeitplan und öffnet den Editor' : 'Öffnet den Editor'"
                            data-testid="playlist-edit"
                            @click="editSlides(p.id)"
                        >
                            Slides bearbeiten
                        </button>
                        <button
                            class="d-btn d-btn--icon d-btn--danger"
                            type="button"
                            :aria-label="`Playlist ${p.name} entfernen`"
                            :title="p.id === defaultId ? 'Die Standard-Playlist bleibt' : 'Entfernen'"
                            :disabled="p.id === defaultId"
                            data-testid="playlist-remove"
                            @click="removePlaylist(p.id)"
                        >
                            <Icon name="trash" />
                        </button>
                    </li>
                </ul>
                <div class="adders">
                    <button class="d-btn" type="button" data-testid="add-playlist" @click="addPlaylist">
                        <Icon name="plus" :size="16" /> Playlist
                    </button>
                </div>

                <h3>Regeln <span class="muted small">– die obere gewinnt</span></h3>
                <p v-if="!editor.rules.length" class="muted small">
                    Noch keine Regel: Es läuft immer „{{ nameOf(defaultId) }}".
                </p>
                <ol class="rules">
                    <li
                        v-for="(rule, index) in editor.rules"
                        :key="index"
                        class="rule"
                        :style="{ '--rule-color': colorOf(rule.playlistId) }"
                        data-testid="schedule-rule"
                    >
                        <div class="rule-head">
                            <span class="rank">{{ index + 1 }}</span>
                            <strong>{{ rule.kind === 'time' ? 'Nach Uhrzeit' : 'Nach Termin' }}</strong>
                            <label class="inline">
                                zeigt
                                <select
                                    :value="rule.playlistId"
                                    data-testid="rule-playlist"
                                    @change="setRule(index, { playlistId: ($event.target as HTMLSelectElement).value })"
                                >
                                    <option v-for="p in editor.playlists" :key="p.id" :value="p.id">{{ p.name }}</option>
                                </select>
                            </label>
                            <span class="spacer" />
                            <button
                                class="d-btn d-btn--icon"
                                type="button"
                                aria-label="Nach oben – hat Vorrang"
                                title="Nach oben – hat Vorrang"
                                :disabled="index === 0"
                                data-testid="rule-up"
                                @click="editor.moveRule(index, index - 1)"
                            >
                                ↑
                            </button>
                            <button
                                class="d-btn d-btn--icon"
                                type="button"
                                aria-label="Nach unten"
                                title="Nach unten"
                                :disabled="index === editor.rules.length - 1"
                                @click="editor.moveRule(index, index + 1)"
                            >
                                ↓
                            </button>
                            <button
                                class="d-btn d-btn--icon d-btn--danger"
                                type="button"
                                aria-label="Regel entfernen"
                                title="Regel entfernen"
                                data-testid="rule-remove"
                                @click="editor.removeRule(index)"
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
                    </li>
                </ol>
                <div class="adders">
                    <button class="d-btn" type="button" data-testid="add-time-rule" @click="addTimeRule">
                        <Icon name="clock" :size="16" /> Nach Uhrzeit
                    </button>
                    <button
                        class="d-btn"
                        type="button"
                        data-testid="add-appointment-rule"
                        :disabled="!calendars.length"
                        :title="calendars.length ? 'Um Termine ausgewählter Kalender herum' : 'Keine Kalender sichtbar'"
                        @click="addAppointmentRule"
                    >
                        <Icon name="calendar" :size="16" /> Nach Termin
                    </button>
                </div>

                <h3>Vorschau</h3>
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

                <ul v-if="editor.problems.length" class="problems" role="alert" data-testid="schedule-problems">
                    <li v-for="p in editor.problems" :key="p">{{ p }}</li>
                </ul>
                <p v-if="editor.status === 'conflict' && editor.conflict" class="d-banner d-banner--error" role="alert">
                    {{ editor.conflict.updatedBy ?? 'Jemand' }} hat „{{ editor.conflict.name }}" inzwischen gespeichert.
                    <button class="d-btn" type="button" @click="editor.discardAndReload()">Neu laden</button>
                    <button class="d-btn" type="button" @click="editor.overwrite(author).then((ok) => ok && emit('saved'))">
                        Meine Fassung speichern
                    </button>
                </p>
                <p v-else-if="editor.status === 'error' && editor.error && !editor.problems.length" class="d-banner d-banner--error" role="alert">
                    {{ editor.error }}
                </p>
            </template>

            <div class="d-dialog-actions">
                <button class="d-btn" type="button" data-testid="schedule-cancel" @click="close">Abbrechen</button>
                <button class="d-btn d-btn--primary" type="button" :disabled="!canSave" data-testid="schedule-save" @click="save">
                    {{ editor.status === 'saving' ? 'Speichert …' : 'Speichern' }}
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
.inline select,
.default input {
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
.playlists li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid var(--d-divider);
}
.swatch {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 3px;
}
.name {
    flex: 1 1 10em;
    min-width: 0;
}
.count {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    white-space: nowrap;
}
.default,
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
