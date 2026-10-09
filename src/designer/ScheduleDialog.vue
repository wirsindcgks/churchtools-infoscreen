<script setup lang="ts">
/**
 * What runs on a screen when (Plan.md, Nächste Schritte 17 and 19), opened
 * from the screen's tile: the default playlist, the rules that switch to
 * other playlists in order of precedence, and a preview of any day.
 * Playlists stand on their own (schema 1.4); the screen only chooses among
 * those of its format. Saves the schedule document alone, against its revision.
 */
import { computed, onMounted, ref } from 'vue';
import { t } from '../i18n/designer';
import { useRouter } from 'vue-router';
import { zonedDateKey, zonedParts, zonedTimeToInstant } from '../appointments/zoned';
import { sameStage, type AppointmentPoint, type ScheduleRule, type ScreenDoc } from '../model/schema';
import { matchingRuleIndex, ruleWindow } from '../player/schedule';
import { ConflictError, type ConflictInfo, type ScreenRepository, type StagedPlaylist } from '../store/screen-repository';
import { cloneJson } from './ops';
import AppointmentPointField from './AppointmentPointField.vue';
import Icon from './Icon.vue';
import PlaylistPicker from './PlaylistPicker.vue';
import { useConfirm } from './useConfirm';
import { usePreview } from './usePreview';
import {
    createAppointmentRule,
    createTimeRule,
    dayTimeline,
    fromMinutes,
    PALETTE,
    playlistColors,
    scheduleProblems,
    WEEKDAYS,
    WINDOW_PRESETS,
    windowPatch,
    type AppointmentRule,
    type TimeRule,
} from './schedule-ops';

const props = defineProps<{ slug: string; repository: ScreenRepository; author: string }>();
const emit = defineEmits<{ close: []; saved: [] }>();

const router = useRouter();
const { confirm } = useConfirm();
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
const { context, calendars, hiddenCalendars } = usePreview(
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

async function close(): Promise<void> {
    if (dirty.value && !(await confirm({ message: t.schedules.dialog.discard, confirmLabel: t.common.discard, danger: true }))) return;
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

const colors = computed(() =>
    playlistColors(defaultPlaylistId.value, rules.value, new Set(allPlaylists.value.map((p) => p.id))),
);
function colorOf(playlistId: string): string {
    return colors.value.get(playlistId) ?? PALETTE[0]!;
}
function nameOf(playlistId: string): string {
    return allPlaylists.value.find((p) => p.id === playlistId)?.name || t.common.playlistMissing;
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

/** A new window: `from` and `to`, and the nearest old-style window for players older than schema 1.5. */
function setWindow(index: number, from: AppointmentPoint, to: AppointmentPoint): void {
    setRule(index, windowPatch(from, to));
}

function isPreset(rule: AppointmentRule, preset: { from: AppointmentPoint; to: AppointmentPoint }): boolean {
    const { from, to } = ruleWindow(rule);
    return JSON.stringify([from, to]) === JSON.stringify([preset.from, preset.to]);
}

/** The last calendar stays: a rule without one could never switch. */
function toggleCalendar(index: number, rule: AppointmentRule, id: number, on: boolean): void {
    const next = on ? [...rule.calendarIds, id] : rule.calendarIds.filter((c) => c !== id);
    if (next.length) setRule(index, { calendarIds: [...new Set(next)].sort((a, b) => a - b) });
}

function calendarName(id: number): string {
    return [...calendars.value, ...hiddenCalendars.value].find((c) => c.id === id)?.name ?? t.schedules.dialog.calendarFallback(id);
}

/** A chosen calendar a TV does not show: the account sees it, but it is not public (Plan.md 62). */
function isHidden(id: number): boolean {
    return hiddenCalendars.value.some((c) => c.id === id);
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
                <h2 id="schedule-title">{{ screen ? t.schedules.dialog.titleFor(screen.name) : t.schedules.title }}</h2>
                <button class="d-btn d-btn--icon" type="button" :aria-label="t.common.close" @click="close">
                    <Icon name="close" />
                </button>
            </header>
            <p v-if="loading" class="muted">{{ t.common.loading }}</p>
            <p v-else-if="loadError" class="d-banner d-banner--error" role="alert">{{ loadError }}</p>
            <template v-else-if="screen">
                <p class="muted intro">
                    {{ t.schedules.dialog.introBefore }} <strong>{{ t.schedules.dialog.introDefault }}</strong> {{ t.schedules.dialog.introAfter }}
                </p>

                <section class="step">
                    <h3>{{ t.schedules.dialog.normally }}</h3>
                    <PlaylistPicker
                        v-model="defaultPlaylistId"
                        :choices="choices"
                        :create="createPlaylist"
                        :label="t.schedules.dialog.defaultPlaylist"
                        testid="default-playlist"
                        @edit="editSlides"
                    />
                </section>

                <section class="step">
                    <h3>{{ t.schedules.dialog.otherTimes }}</h3>
                    <p v-if="!rules.length" class="muted small">
                        {{ t.schedules.dialog.noRules(nameOf(defaultPlaylistId)) }}
                    </p>
                    <p v-else-if="rules.length > 1" class="muted small">{{ t.schedules.dialog.severalRules }}</p>
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
                                <strong>{{ rule.kind === 'time' ? t.schedules.dialog.atTimes : t.schedules.dialog.aroundAppointments }}</strong>
                                <span class="spacer" />
                                <button
                                    class="d-btn d-btn--icon"
                                    type="button"
                                    :aria-label="t.schedules.dialog.moveUp"
                                    :title="t.schedules.dialog.moveUp"
                                    :disabled="index === 0"
                                    data-testid="rule-up"
                                    @click="moveRule(index, index - 1)"
                                >
                                    ↑
                                </button>
                                <button
                                    class="d-btn d-btn--icon"
                                    type="button"
                                    :aria-label="t.common.moveDown"
                                    :title="t.common.moveDown"
                                    :disabled="index === rules.length - 1"
                                    @click="moveRule(index, index + 1)"
                                >
                                    ↓
                                </button>
                                <button
                                    class="d-btn d-btn--icon d-btn--danger"
                                    type="button"
                                    :aria-label="t.schedules.dialog.removeRule"
                                    :title="t.schedules.dialog.removeRule"
                                    data-testid="rule-remove"
                                    @click="removeRule(index)"
                                >
                                    <Icon name="trash" />
                                </button>
                            </div>

                            <div v-if="rule.kind === 'time'" class="rule-body">
                                <div class="days" role="group" :aria-label="t.schedules.dialog.weekdays">
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
                                    {{ t.schedules.dialog.from }}
                                    <input
                                        type="time"
                                        step="300"
                                        :value="rule.from"
                                        data-testid="rule-from"
                                        @change="setTime(index, 'from', ($event.target as HTMLInputElement).value)"
                                    >
                                </label>
                                <label class="inline">
                                    {{ t.schedules.dialog.to }}
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
                                <div class="presets" role="group" :aria-label="t.schedules.dialog.presets">
                                    <button
                                        v-for="preset in WINDOW_PRESETS"
                                        :key="preset.key"
                                        type="button"
                                        class="preset"
                                        :class="{ on: isPreset(rule, preset) }"
                                        :aria-pressed="isPreset(rule, preset)"
                                        :data-testid="`rule-preset-${preset.key}`"
                                        @click="setWindow(index, preset.from, preset.to)"
                                    >
                                        {{ preset.label }}
                                    </button>
                                </div>
                                <div class="window">
                                    {{ t.schedules.dialog.from }}
                                    <AppointmentPointField
                                        :point="ruleWindow(rule).from"
                                        :label="t.schedules.dialog.windowFrom"
                                        testid="rule-window-from"
                                        @change="setWindow(index, $event, ruleWindow(rule).to)"
                                    />
                                    {{ t.schedules.dialog.to }}
                                    <AppointmentPointField
                                        :point="ruleWindow(rule).to"
                                        :label="t.schedules.dialog.windowTo"
                                        testid="rule-window-to"
                                        @change="setWindow(index, ruleWindow(rule).from, $event)"
                                    />
                                </div>
                                <span class="muted small">{{ t.schedules.dialog.ofAppointmentIn }}</span>
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
                                        {{ calendarName(id) }} {{ isHidden(id) ? t.schedules.dialog.calendarIgnored : t.schedules.dialog.calendarInvisible }}
                                    </span>
                                </div>
                            </div>
                            <div class="rule-body shows">
                                <span class="arrow" aria-hidden="true">→</span>
                                <span>{{ t.schedules.dialog.shows }}</span>
                                <PlaylistPicker
                                    :model-value="rule.playlistId"
                                    :choices="choices"
                                    :create="createPlaylist"
                                    :start-creating="createFor === index"
                                    :hint="t.schedules.dialog.needSecond"
                                    :label="t.schedules.dialog.playlistOfRule(index + 1)"
                                    testid="rule-playlist"
                                    @update:model-value="setRule(index, { playlistId: $event })"
                                    @edit="editSlides"
                                />
                            </div>
                        </li>
                    </ol>
                    <div class="adders">
                        <button class="d-btn" type="button" data-testid="add-time-rule" @click="addTimeRule">
                            <Icon name="clock" :size="16" /> {{ t.schedules.dialog.atTimes }}
                        </button>
                        <button
                            class="d-btn"
                            type="button"
                            data-testid="add-appointment-rule"
                            :disabled="!calendars.length"
                            :title="calendars.length ? t.schedules.dialog.appointmentRuleTitle : t.schedules.dialog.noCalendars"
                            @click="addAppointmentRule"
                        >
                            <Icon name="calendar" :size="16" /> {{ t.schedules.dialog.aroundAppointments }}
                        </button>
                    </div>
                </section>

                <section class="step">
                    <h3>{{ t.schedules.dialog.previewTitle }}</h3>
                    <div class="preview-controls">
                        <label class="inline">
                            {{ t.schedules.dialog.day }}
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
                        <span>0</span><span>6</span><span>12</span><span>18</span><span>{{ t.schedules.dialog.endOfDay }}</span>
                    </div>
                    <ul class="legend">
                        <li v-for="p in shown" :key="p.id" data-testid="schedule-playlist">
                            <span class="swatch" :style="{ background: colorOf(p.id) }" aria-hidden="true" />
                            {{ p.name }}
                            <span class="muted">· {{ t.schedules.dialog.slideCount(p.slideIds.length) }}</span>
                        </li>
                    </ul>
                    <label class="slider">
                        <span class="visually-hidden">{{ t.schedules.dialog.time }}</span>
                        <input v-model.number="previewMinute" type="range" min="0" max="1425" step="15" data-testid="preview-time">
                    </label>
                    <p v-if="decision" class="decision" data-testid="preview-result">
                        {{ t.schedules.dialog.decisionRuns(weekdayName, fromMinutes(previewMinute)) }}
                        <strong :style="{ color: colorOf(decision.playlistId) }">„{{ nameOf(decision.playlistId) }}"</strong>
                        {{ ' ' }}<span class="muted">
                            {{ decision.ruleIndex < 0 ? t.schedules.dialog.decisionDefault : t.schedules.dialog.decisionRule(decision.ruleIndex + 1) }}
                        </span>
                    </p>
                    <p v-if="hasAppointmentRules" class="muted small">
                        {{ t.schedules.dialog.appointmentRulesHint(PREVIEW_DAYS) }}
                    </p>
                </section>

                <ul v-if="problems.length" class="problems" role="alert" data-testid="schedule-problems">
                    <li v-for="p in problems" :key="p">{{ p }}</li>
                </ul>
                <p v-if="conflict" class="d-banner d-banner--error" role="alert">
                    {{ t.schedules.dialog.conflict(conflict.updatedBy, conflict.name) }}
                    <button class="d-btn" type="button" @click="load">{{ t.schedules.dialog.reload }}</button>
                    <button class="d-btn" type="button" @click="saveAndClose(conflict.revision)">{{ t.schedules.dialog.keepMine }}</button>
                </p>
                <p v-if="saveError" class="d-banner d-banner--error" role="alert">{{ saveError }}</p>
            </template>

            <div class="d-dialog-actions">
                <button class="d-btn" type="button" data-testid="schedule-cancel" @click="close">{{ t.common.cancel }}</button>
                <button class="d-btn d-btn--primary" type="button" :disabled="!canSave" data-testid="schedule-save" @click="saveAndClose()">
                    {{ saving ? t.editor.status.saving : t.common.save }}
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
.appointment {
    display: grid;
    justify-items: start;
    gap: 8px;
}
.presets,
.window {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
}
.preset {
    min-height: 2em;
    padding: 0 0.8em;
    border: 1px solid var(--d-divider);
    border-radius: 999px;
    background: var(--d-surface);
    color: var(--d-text);
    font: inherit;
    font-size: var(--d-size-sm);
    cursor: pointer;
}
.preset.on {
    border-color: var(--rule-color);
    background: var(--rule-color);
    color: #fff;
    font-weight: 700;
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
