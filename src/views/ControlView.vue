<script setup lang="ts">
/**
 * The phone page of the musicians (Plan.md 121 E2): they tap the part of the song a stage monitor ("Liedblatt") shows big.
 * A tap writes a choice into the category `steuerung`; the player reads it. Built for a dark stage, thumbs and a narrow screen.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { stepPart, type ControlDoc, type PartRef } from '../agenda/control';
import { pickEvent, type AgendaEvent, type AgendaPick, type LivePosition } from '../agenda/live';
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
    if (!s || s.section === undefined || shownIndex.value < 0) return null;
    return { itemIndex: shownIndex.value, section: s.section };
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

const screenLine = computed(() => {
    const s = shown.value;
    if (!s) return t.control.screenNone;
    if (s.upcoming) return t.control.screenNext(s.item.title);
    const sections = sheetOf(s.item)?.sections ?? [];
    const part = s.section === undefined ? null : sections[s.section] ? sections[s.section]!.label || t.control.part(s.section + 1) : null;
    return t.control.screen(s.item.title, part);
});

const previous = computed(() => (event.value ? stepPart(event.value, activePart.value, -1) : null));
/** Without a chosen part "Weiter" starts at the first part of the song the screen shows, not at the first song of the agenda. */
const following = computed(() => {
    if (!event.value) return null;
    if (!activePart.value && shown.value && (sheetOf(shown.value.item)?.sections.length ?? 0) > 0) return { itemIndex: shownIndex.value, section: 0 };
    return stepPart(event.value, activePart.value, 1);
});

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
