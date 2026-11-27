<script setup lang="ts">
/**
 * The song of the service on the phone page (Plan.md 121 E2, 135 C): the musicians tap the part of the song a stage monitor ("Liedblatt")
 * shows big. A tap writes a choice into the category `steuerung` per event; the player reads it – all songsheets of the event follow.
 * With `eventId` the page follows the event the monitor shows; without it (no screen released) it lets the musician pick the event.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { type ControlDoc, type PartRef } from '../agenda/control';
import { agendaDisplay, clockText, pickEvent, type AgendaEvent, type AgendaPick, type LivePosition } from '../agenda/live';
import { sheetOf, songsLeft, songsheetPick } from '../agenda/songsheet';
import { fetchCalendars } from '../ct/api';
import { t } from '../i18n/designer';
import { LOCALE } from '../i18n/player';
import { appointmentWindow, churchToolsPlayerData } from '../player/data';
import { usePresenterKeys } from '../player/presenter-keys';
import type { ScreenRepository } from '../store/screen-repository';
import Icon from '../designer/Icon.vue';
import ControlBar from './ControlBar.vue';
import ControlSong from './ControlSong.vue';
import ControlSongCard from './ControlSongCard.vue';
import { controlMemory } from './control-memory';
import { firstSection, partName, songAfter, stayInSong, type SongEntry } from './song-steps';

const props = defineProps<{
    /** `null` while the page still gets it: what the last visit knew shows meanwhile. */
    repository: ScreenRepository | null;
    author: string;
    timeZone: string;
    /** The event the monitor shows; missing – the musician picks one. */
    eventId?: number;
    /** The plan ("Jetzt", "Dann") stands here as a card, where no monitor card carries it. */
    showPlan: boolean;
}>();
/** What the band of the monitor says for the service: the start of the event. */
const emit = defineEmits<{ info: [info: { eventStartMs: number | null }] }>();

const POLL_MS = 2500;

const loaded = ref(!!controlMemory.events);
const failure = ref<string | null>(null);
const events = shallowRef<AgendaEvent[]>(controlMemory.events ?? []);
const chosenId = ref<number | null>(controlMemory.eventId);
const eventId = computed(() => props.eventId ?? chosenId.value);
const position = shallowRef<LivePosition | null>(null);
const stored = shallowRef<ControlDoc | undefined>(undefined);
/** The tap that is not confirmed by a reading yet; shown at once. */
const local = shallowRef<ControlDoc | null>(null);
const opened = ref<number | null>(null);
const allOpen = ref(false);
const notSaved = ref(false);
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
watch(shownIndex, () => (opened.value = null));
const toggle = (index: number) => (opened.value = opened.value === index ? null : index);

const hasSong = (e: AgendaEvent) => e.items.some((item, i) => i > 0 && item.song);
const time = (ms: number) => new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone: props.timeZone }).format(ms);
const eventLabel = (e: AgendaEvent) => t.control.eventOption(time(e.startMs));

const songs = computed<SongEntry[]>(() =>
    (event.value?.items ?? []).flatMap((item, index) => {
        if (index < 1 || !item.song) return [];
        const sheet = sheetOf(item);
        return [{ index, title: item.title, key: sheet?.key ?? item.songDetails?.key, parts: sheet?.sections ?? [] }];
    }),
);

/**
 * A long service got crowded (user, 2026-11-11): the song on the screen stands apart with its parts, the next one small below it, all
 * others in the list "Alle Lieder" – the played ones pale, but still to be tapped.
 */
const reached = computed(() => {
    if (shownIndex.value >= 0) return shownIndex.value;
    const p = pick.value;
    return p && p.phase !== 'upcoming' && p.position && p.position.index > 0 ? p.position.index : 1;
});
const current = computed(() => songs.value.find((s) => s.index === shownIndex.value) ?? null);
const upNext = computed(() => songAfter(songs.value, current.value, reached.value));
const played = (index: number) => index < reached.value;

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
watch(
    () => event.value?.startMs ?? null,
    (eventStartMs) => emit('info', { eventStartMs }),
    { immediate: true },
);

/**
 * No tap once the event is over or no song is left: after "– Ende –" a stray tap brought a song back to the TV (user, 2026-11-11). The
 * screen ignores such taps as well (`songsheetPick`).
 */
const stepping = computed(() => !!event.value && !!pick.value && !(plan.value?.over ?? false) && songsLeft(pick.value));
/** "Vor" and "Zurück" stay within the song (Plan.md 124): the next song comes by "Danach" or with the agenda. */
const previous = computed(() => (stepping.value ? stayInSong(event.value!, activePart.value, -1) : null));
const following = computed(() => (stepping.value ? stayInSong(event.value!, activePart.value, 1) : null));
const atEnd = computed(() => stepping.value && !!activePart.value && !following.value);
const forwardHint = computed(() => (following.value ? partName(event.value!, following.value) : ''));
/** A presenter steps like "Zurück" and "Vor" (Plan.md 124 A). */
const presenter = usePresenterKeys((by) => {
    const target = by === 1 ? following.value : previous.value;
    if (target) void choose(target);
});

function preselected(list: AgendaEvent[]): AgendaEvent {
    const now = Date.now();
    return list.find((e) => e.startMs <= now && now <= e.endMs) ?? list.find((e) => e.startMs > now) ?? list[list.length - 1]!;
}

async function refresh(): Promise<void> {
    const id = eventId.value;
    const repository = props.repository;
    if (id === null || !repository) return;
    const [pos, controls] = await Promise.all([churchToolsPlayerData.agendaPosition(id), repository.readControls()]);
    // Another event was chosen while the reading ran.
    if (id !== eventId.value) return;
    position.value = pos;
    stored.value = controls[id];
    // The reading has caught up with the tap: the stored choice counts again.
    if (local.value && stored.value && Date.parse(stored.value.at) >= Date.parse(local.value.at)) local.value = null;
}

async function guarded(read: () => Promise<void>): Promise<void> {
    try {
        await read();
        failure.value = null;
    } catch (e) {
        failure.value = t.control.failed(e instanceof Error ? e.message : null);
    }
}

function schedule(): void {
    if (gone) return;
    timer = setTimeout(async () => {
        await guarded(refresh);
        schedule();
    }, POLL_MS);
}

async function choose(part: PartRef): Promise<void> {
    const e = event.value;
    const item = e?.items[part.itemIndex];
    const repository = props.repository;
    if (!e || !item || !repository) return;
    const doc: ControlDoc = { eventId: e.eventId, itemIndex: part.itemIndex, section: part.section, at: new Date().toISOString() };
    if (item.arrangementId !== undefined) doc.arrangementId = item.arrangementId;
    if (props.author) doc.by = props.author;
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

/** "Danach" chooses the first part of the song that follows. */
function chooseNext(): void {
    const song = upNext.value;
    const section = song ? firstSection(song.parts) : null;
    if (song && section !== null) void choose({ itemIndex: song.index, section });
}

watch(chosenId, (id) => (controlMemory.eventId = id));
watch(eventId, async () => {
    local.value = null;
    stored.value = undefined;
    position.value = null;
    opened.value = null;
    await guarded(refresh);
});
// The repository comes after the first frame: read once it is there.
watch(
    () => props.repository,
    (repository) => repository && void guarded(refresh),
);

onMounted(async () => {
    schedule();
    try {
        const calendarIds = (await fetchCalendars()).map((c) => c.id);
        const { from, to } = appointmentWindow(new Date(), props.timeZone, 1);
        const read = (await churchToolsPlayerData.agendaEvents(calendarIds, from, to, props.timeZone, { sheets: true })).filter(hasSong).sort((a, b) => a.startMs - b.startMs);
        if (gone) return;
        events.value = read;
        // An event chosen on the last visit stays chosen while it is still there.
        if (!read.some((e) => e.eventId === chosenId.value)) chosenId.value = read.length ? preselected(read).eventId : null;
        controlMemory.events = read;
        // The event may not have changed, so its watcher does not read: read here.
        await guarded(refresh);
    } catch (e) {
        failure.value = t.control.failed(e instanceof Error ? e.message : null);
    } finally {
        loaded.value = true;
    }
});

onBeforeUnmount(() => {
    gone = true;
    clearTimeout(timer);
});
</script>

<template>
    <div class="service" data-testid="control-service">
        <p v-if="!loaded" class="note">{{ t.control.loading }}</p>
        <p v-else-if="failure && !event" class="note" role="alert">{{ failure }}</p>
        <p v-else-if="!events.length" class="note">{{ t.control.noEvents }}</p>
        <p v-else-if="!event" class="note" data-testid="control-gone">{{ t.control.eventGone }}</p>
        <template v-else>
            <select v-if="props.eventId === undefined && events.length > 1" v-model="chosenId" class="event" :aria-label="t.control.eventLabel">
                <option v-for="e in events" :key="e.eventId" :value="e.eventId">{{ eventLabel(e) }}</option>
            </select>
            <div v-if="showPlan && plan" class="plan control-card" data-testid="control-plan">
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
            <p v-if="plan && !plan.over && !stepping" class="locked control-card" data-testid="control-locked">{{ t.control.noSongsLeft }}</p>
            <p v-if="failure" class="warn" role="alert">{{ failure }}</p>
            <p v-if="notSaved" class="warn" role="alert">{{ t.control.notSaved }}</p>
            <div v-if="current" class="current" data-testid="control-current">
                <ControlSongCard
                    :title="current.title"
                    :song-key="current.key"
                    :parts="current.parts"
                    :active="activePart?.itemIndex === current.index ? activePart.section : null"
                    :disabled="!stepping"
                    @choose="(n) => choose({ itemIndex: current!.index, section: n })"
                >
                    <template v-if="atEnd" #foot>
                        <p class="note small" data-testid="control-end">{{ t.control.stepEnd }}</p>
                    </template>
                </ControlSongCard>
            </div>
            <button v-if="upNext" type="button" class="after" :disabled="!stepping || firstSection(upNext.parts) === null" data-testid="control-after" @click="chooseNext">
                <span><span class="after-label">{{ t.control.after }}</span> · {{ upNext.title }}</span><span class="after-pill">{{ t.control.afterGo }}</span>
            </button>
            <section v-if="songs.length > 1" class="all control-card" data-testid="control-all">
                <button type="button" class="all-toggle" :aria-expanded="allOpen" @click="allOpen = !allOpen">
                    <span>{{ t.control.allSongs(songs.length) }}</span>
                    <Icon class="fold" name="chevron-down" :size="20" />
                </button>
                <ul v-if="allOpen" class="all-list">
                    <ControlSong
                        v-for="song in songs"
                        :key="song.index"
                        :title="song.title"
                        :song-key="song.key"
                        :parts="song.parts"
                        :open="opened === song.index"
                        :active="activePart?.itemIndex === song.index ? activePart.section : null"
                        :shown="song.index === current?.index"
                        :played="played(song.index) && song.index !== current?.index"
                        :disabled="!stepping"
                        @toggle="toggle(song.index)"
                        @choose="(n) => choose({ itemIndex: song.index, section: n })"
                    />
                </ul>
            </section>
            <p v-if="presenter" class="note" data-testid="control-presenter">{{ t.control.presenterDetected }}</p>
            <!-- In the fixed zone below the middle of the page (Plan.md 135 A). -->
            <Teleport defer to="#control-bar">
                <ControlBar :back-disabled="!previous" :forward-disabled="!following" :hint="forwardHint" @back="previous && choose(previous)" @forward="following && choose(following)" />
            </Teleport>
        </template>
    </div>
</template>

<style scoped>
/* The page's middle is a column: the song takes what is left and rolls inside, everything else stands. */
.service {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.service > * {
    flex: none;
    min-width: 0;
}
.service > .current {
    flex: 1 1 0;
    /* The card takes what is left, but is never squeezed to nothing: the parts stay in view, the middle rolls before they vanish. */
    min-height: 9rem;
    display: flex;
    flex-direction: column;
}
p {
    margin: 0;
}
.note {
    color: #b8bcc4;
}
/* The line under the parts: one line, quiet. */
.note.small {
    flex: none;
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.warn {
    padding: 10px 12px;
    border-radius: 8px;
    background: #4a2020;
}
.locked {
    font-weight: 600;
}
/* Where the plan stands: the running point big with its time, the next one below. */
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
.event {
    min-height: 56px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid #3a3f4a;
    background: #1d2027;
    color: inherit;
    font-size: 1.1rem;
}
button {
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
/* The next song, a flat row at the foot of the middle (Plan.md 137 B): it is not the song on the screen, but one tap away. */
.after {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 52px;
    padding: 0 16px;
    border: 0;
    border-radius: 12px;
    background: #1b1e25;
    font-size: 16px;
    text-align: left;
}
.after > :first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.after-label {
    color: #8b919c;
}
/* A word in a frame instead of "›", like "Ändern" in the band (user, 2026-11-27); the whole row stays the target. */
.after-pill {
    flex: none;
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 12px;
    border: 1px solid #6b7180;
    border-radius: 999px;
    color: #e6e8ec;
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
}
/* A fold one sees as such: the arrow on the right turns when it opens (user, 2026-11-26). */
.all {
    padding: 0 12px;
}
.all-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    padding: 0;
    border: 0;
    background: none;
    color: #b8bcc4;
}
.all-toggle[aria-expanded='true'] .fold {
    transform: rotate(180deg);
}
.fold {
    flex: none;
    transition: transform 0.15s;
}
@media (prefers-reduced-motion: reduce) {
    .fold {
        transition: none;
    }
}
.all-list {
    list-style: none;
    margin: 0;
    padding: 0 0 12px;
    display: grid;
    gap: 8px;
    /* Only this list rolls, so the page does not. */
    max-height: 45dvh;
    overflow-y: auto;
    overscroll-behavior: contain;
}
</style>
