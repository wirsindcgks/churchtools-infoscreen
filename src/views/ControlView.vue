<script setup lang="ts">
/**
 * The phone page of the musicians (Plan.md 121 E2): they tap the part of the song a stage monitor ("Liedblatt") shows big.
 * A tap writes a choice into the category `steuerung`; the player reads it. Built for a dark stage, thumbs and a narrow screen.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { stepPart, type ControlDoc, type PartRef } from '../agenda/control';
import { agendaDisplay, clockText, pickEvent, type AgendaEvent, type AgendaPick, type LivePosition } from '../agenda/live';
import { sheetOf, songsheetPick } from '../agenda/songsheet';
import { fetchCalendars, fetchTimeZone } from '../ct/api';
import { currentPerson, displayName } from '../ct/client';
import { t } from '../i18n/designer';
import { LOCALE } from '../i18n/player';
import { appointmentWindow, churchToolsPlayerData } from '../player/data';
import { getRepository } from '../store/backend';
import type { ScreenRepository } from '../store/screen-repository';

const POLL_MS = 2500;

const loading = ref(true);
const unavailable = ref(false);
const failure = ref<string | null>(null);
const events = shallowRef<AgendaEvent[]>([]);
const eventId = ref<number | null>(null);
const position = shallowRef<LivePosition | null>(null);
const stored = shallowRef<ControlDoc | undefined>(undefined);
/** The tap that is not confirmed by a reading yet; shown at once. */
const local = shallowRef<ControlDoc | null>(null);
const opened = ref<number | null>(null);
const notSaved = ref(false);
const timeZone = ref('Europe/Berlin');
let repository: ScreenRepository | null = null;
let author = '';
let timer: ReturnType<typeof setTimeout> | undefined;
let gone = false;

const event = computed(() => events.value.find((e) => e.eventId === eventId.value) ?? null);
const control = computed(() => local.value ?? stored.value);
const pick = computed<AgendaPick | null>(() => {
    const e = event.value;
    if (!e) return null;
    return pickEvent([e], { [e.eventId]: position.value }, Date.now()) ?? { event: e, position: position.value ?? undefined, phase: 'upcoming' };
});
const shown = computed(() => (pick.value ? songsheetPick(pick.value, control.value) : null));
const shownIndex = computed(() => (shown.value && event.value ? event.value.items.indexOf(shown.value.item) : -1));
const activePart = computed<PartRef | null>(() => {
    const s = shown.value;
    if (!s || shownIndex.value < 0) return null;
    // Without a choice the screen shows part 1 (screens with "Nach Zeit blättern" are the exception, the page does not know the blocks).
    const section = s.section ?? ((sheetOf(s.item)?.sections.length ?? 0) > 0 ? 0 : undefined);
    return section === undefined ? null : { itemIndex: shownIndex.value, section };
});
const openIndex = computed(() => opened.value ?? shownIndex.value);
watch(shownIndex, () => (opened.value = null));

const hasSong = (e: AgendaEvent) => e.items.some((item, i) => i > 0 && item.song);
const time = (ms: number) => new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone: timeZone.value }).format(ms);
const eventLabel = (e: AgendaEvent) => t.control.eventOption(time(e.startMs));

const songs = computed(() =>
    (event.value?.items ?? []).flatMap((item, index) => {
        if (index < 1 || !item.song) return [];
        const sheet = sheetOf(item);
        return [{ index, title: item.title, key: sheet?.key ?? item.songDetails?.key, parts: sheet?.sections ?? [] }];
    }),
);

/** A second of its own, so that the clock of the plan runs between the readings. */
const tick = ref(Date.now());
const ticker = setInterval(() => (tick.value = Date.now()), 1000);
onBeforeUnmount(() => clearInterval(ticker));

/** Where the plan stands (user, 2026-11-11): the point that runs with its time left and the next one – as the block "Ablauf" sees it. */
const plan = computed(() => {
    const p = pick.value;
    if (!p) return null;
    const display = agendaDisplay(p, tick.value);
    if (!display) return { over: true as const };
    return {
        over: false as const,
        soon: display.kind === 'soon',
        title: display.title,
        clock: display.countdownSeconds === null ? null : clockText(display.countdownSeconds),
        late: (display.countdownSeconds ?? 0) < 0,
        next: display.next,
    };
});

const screenLine = computed(() => {
    const s = shown.value;
    if (!s) return t.control.screenNone;
    const sections = sheetOf(s.item)?.sections ?? [];
    const at = activePart.value?.section;
    const part = at === undefined ? null : sections[at] ? sections[at]!.label || t.control.part(at + 1) : null;
    // "Als Nächstes" shows its first part on the screen too: the line names it the same way.
    return s.upcoming ? t.control.screenNext(s.item.title, part) : t.control.screen(s.item.title, part);
});

const previous = computed(() => (event.value ? stepPart(event.value, activePart.value, -1) : null));
const following = computed(() => (event.value ? stepPart(event.value, activePart.value, 1) : null));

function preselected(list: AgendaEvent[]): AgendaEvent {
    const now = Date.now();
    return list.find((e) => e.startMs <= now && now <= e.endMs) ?? list.find((e) => e.startMs > now) ?? list[list.length - 1]!;
}

async function refresh(): Promise<void> {
    const id = eventId.value;
    if (id === null || !repository) return;
    const [pos, controls] = await Promise.all([churchToolsPlayerData.agendaPosition(id), repository.readControls()]);
    position.value = pos;
    stored.value = controls[id];
    // The reading has caught up with the tap: the stored choice counts again.
    if (local.value && stored.value && Date.parse(stored.value.at) >= Date.parse(local.value.at)) local.value = null;
}

function schedule(): void {
    if (gone) return;
    timer = setTimeout(async () => {
        try {
            await refresh();
            failure.value = null;
        } catch (e) {
            failure.value = t.control.failed(e instanceof Error ? e.message : null);
        }
        schedule();
    }, POLL_MS);
}

async function choose(part: PartRef): Promise<void> {
    const e = event.value;
    const item = e?.items[part.itemIndex];
    if (!e || !item || !repository) return;
    const doc: ControlDoc = { eventId: e.eventId, itemIndex: part.itemIndex, section: part.section, at: new Date().toISOString() };
    if (item.arrangementId !== undefined) doc.arrangementId = item.arrangementId;
    if (author) doc.by = author;
    notSaved.value = false;
    local.value = doc;
    try {
        await repository.writeControl(doc);
    } catch (error) {
        console.warn('Die Wahl konnte nicht gespeichert werden:', error);
        if (local.value === doc) local.value = null;
        notSaved.value = true;
    }
}

watch(eventId, async () => {
    local.value = null;
    stored.value = undefined;
    position.value = null;
    opened.value = null;
    try {
        await refresh();
    } catch (e) {
        failure.value = t.control.failed(e instanceof Error ? e.message : null);
    }
});

onMounted(async () => {
    try {
        const [person, handle, zone] = await Promise.all([currentPerson(), getRepository(), fetchTimeZone()]);
        repository = handle.repository;
        author = displayName(person);
        timeZone.value = zone;
        if ((await repository.controlCategoryId()) === null) {
            unavailable.value = true;
            return;
        }
        const calendarIds = (await fetchCalendars()).map((c) => c.id);
        const { from, to } = appointmentWindow(new Date(), zone, 1);
        events.value = (await churchToolsPlayerData.agendaEvents(calendarIds, from, to, zone, { sheets: true })).filter(hasSong).sort((a, b) => a.startMs - b.startMs);
        if (events.value.length) eventId.value = preselected(events.value).eventId;
        schedule();
    } catch (e) {
        failure.value = t.control.failed(e instanceof Error ? e.message : null);
    } finally {
        loading.value = false;
    }
});

onBeforeUnmount(() => {
    gone = true;
    clearTimeout(timer);
});
</script>

<template>
    <main class="infoscreen-designer control">
        <h1>{{ t.control.title }}</h1>
        <p v-if="loading" class="note">{{ t.control.loading }}</p>
        <p v-else-if="unavailable" class="note">{{ t.control.unavailable }}</p>
        <p v-else-if="failure && !event" class="note" role="alert">{{ failure }}</p>
        <p v-else-if="!events.length" class="note">{{ t.control.noEvents }}</p>
        <template v-else>
            <select v-if="events.length > 1" v-model="eventId" class="event" :aria-label="t.control.eventLabel">
                <option v-for="e in events" :key="e.eventId" :value="e.eventId">{{ eventLabel(e) }}</option>
            </select>
            <div v-if="plan" class="plan" data-testid="control-plan">
                <template v-if="plan.over">{{ t.control.planOver }}</template>
                <template v-else>
                    <div class="plan-now">
                        <span class="plan-label">{{ plan.soon ? t.control.planSoon : t.control.planNow }}</span>
                        <span class="plan-title">{{ plan.title }}</span>
                        <span v-if="plan.clock" class="plan-clock" :class="{ late: plan.late }">{{ plan.clock }}</span>
                    </div>
                    <div v-if="plan.next" class="plan-next">
                        <span class="plan-label">{{ t.control.planNext }}</span>
                        <span>{{ plan.next }}</span>
                    </div>
                </template>
            </div>
            <p class="screen">{{ screenLine }}</p>
            <p v-if="failure" class="warn" role="alert">{{ failure }}</p>
            <p v-if="notSaved" class="warn" role="alert">{{ t.control.notSaved }}</p>
            <ul class="songs">
                <li v-for="song in songs" :key="song.index" :class="{ shown: song.index === shownIndex }">
                    <button type="button" class="song" :aria-expanded="song.index === openIndex" @click="opened = song.index">
                        <span>{{ song.title }}</span>
                        <span v-if="song.key" class="key">{{ song.key }}</span>
                    </button>
                    <template v-if="song.index === openIndex">
                        <p v-if="!song.parts.length" class="note">{{ t.control.noSheet }}</p>
                        <div v-else class="parts">
                            <button
                                v-for="(part, n) in song.parts"
                                :key="n"
                                type="button"
                                class="part"
                                :class="{ active: activePart?.itemIndex === song.index && activePart.section === n }"
                                @click="choose({ itemIndex: song.index, section: n })"
                            >
                                {{ part.label || t.control.part(n + 1) }}
                            </button>
                        </div>
                    </template>
                </li>
            </ul>
            <nav class="steps">
                <button type="button" :disabled="!previous" @click="previous && choose(previous)">{{ t.control.back }}</button>
                <button type="button" :disabled="!following" @click="following && choose(following)">{{ t.control.next }}</button>
            </nav>
        </template>
    </main>
</template>

<style scoped>
.control {
    box-sizing: border-box;
    min-height: 100vh;
    /* Room for the big buttons at the bottom, which stand fixed over the list. */
    padding: 16px 16px calc(136px + env(safe-area-inset-bottom));
    background: #101114;
    color: #f2f2f2;
    font-size: 1.1rem;
    display: grid;
    align-content: start;
    gap: 12px;
}
h1 {
    margin: 0;
    font-size: 1.3rem;
}
p {
    margin: 0;
}
.note {
    color: #b8bcc4;
}
.warn {
    padding: 10px 12px;
    border-radius: 8px;
    background: #4a2020;
}
/* Where the plan stands: the running point big with its time, the next one below. */
.plan {
    margin-bottom: 8px;
    padding: 10px 12px;
    border-radius: 8px;
    background: #1d2027;
}
.plan-now,
.plan-next {
    display: flex;
    align-items: baseline;
    gap: 8px;
}
.plan-next {
    margin-top: 4px;
    opacity: 0.75;
}
.plan-label {
    flex: none;
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.7;
}
.plan-title {
    flex: 1;
    min-width: 0;
    font-size: 1.25rem;
    font-weight: 600;
}
.plan-clock {
    flex: none;
    font-size: 1.25rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}
.plan-clock.late {
    color: #f87171;
}
.screen {
    padding: 10px 12px;
    border-radius: 8px;
    background: #1d2027;
    font-weight: 600;
}
.event {
    min-height: 56px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid #3a3f4a;
    background: #1d2027;
    color: inherit;
    font-size: 1.1rem;
}
.songs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
}
.songs li {
    display: grid;
    gap: 8px;
}
button {
    min-height: 56px;
    border: 1px solid #3a3f4a;
    border-radius: 8px;
    background: #1d2027;
    color: inherit;
    font: inherit;
    cursor: pointer;
}
button:disabled {
    opacity: 0.4;
}
.song {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 0 14px;
    text-align: left;
}
.shown > .song {
    border-color: #6ea8ff;
}
.key {
    color: #b8bcc4;
    font-variant-numeric: tabular-nums;
}
.parts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.part {
    padding: 8px;
}
.part.active {
    background: #2f6fed;
    border-color: #6ea8ff;
    font-weight: 600;
}
.steps {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    background: #101114;
    border-top: 1px solid #3a3f4a;
}
/* Back and next are what a hand on stage reaches for blind: tall and in big letters (user, 2026-11-11). */
.steps button {
    min-height: 96px;
    font-size: 1.5rem;
    font-weight: 600;
}
</style>
