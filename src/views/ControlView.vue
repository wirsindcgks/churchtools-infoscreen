<script setup lang="ts">
/**
 * The phone page of the musicians (Plan.md 121 E2): they tap the part of the song a stage monitor ("Liedblatt") shows big.
 * A tap writes a choice into the category `steuerung`; the player reads it. Built for a dark stage, thumbs and a narrow screen.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { stepPart, type ControlDoc, type PartRef } from '../agenda/control';
import { agendaDisplay, clockText, pickEvent, type AgendaEvent, type AgendaPick, type LivePosition } from '../agenda/live';
import { sheetOf, songsLeft, songsheetPick } from '../agenda/songsheet';
import { fetchCalendars, fetchTimeZone } from '../ct/api';
import { currentPerson, displayName } from '../ct/client';
import { t } from '../i18n/designer';
import { LOCALE } from '../i18n/player';
import { appointmentWindow, churchToolsPlayerData } from '../player/data';
import ControlRehearsal from './ControlRehearsal.vue';
import ControlSong from './ControlSong.vue';
import { controlMemory } from './control-memory';
import { useWakeLock } from './useWakeLock';
import Icon from '../designer/Icon.vue';
import { useOffsetTop } from '../designer/useOffsetTop';
import { getRepository } from '../store/backend';
import type { ScreenRepository } from '../store/screen-repository';

const POLL_MS = 2500;
// On stage the phone must not lock while the page is open (user, 2026-11-13).
useWakeLock();
/**
 * The page stands in the flow of the host page like the designer: below the bar of ChurchTools and at the same place, with the same
 * margins – fixed over the window, the bar hid its first line and the switch moved from side to side (user, 2026-11-13). The margins
 * of the host page take the dark colour while the page is open, so no white frame shows (v0.59.1); they are given back on leaving.
 */
const page = ref<HTMLElement | null>(null);
const top = useOffsetTop(page);
const STAGE_BACKGROUND = '#101114';
let painted: { el: HTMLElement; background: string }[] = [];
onMounted(() => {
    for (let el = page.value?.parentElement ?? null; el; el = el.parentElement) {
        painted.push({ el, background: el.style.background });
        el.style.background = STAGE_BACKGROUND;
    }
});
onBeforeUnmount(() => {
    for (const { el, background } of painted) el.style.background = background;
    painted = [];
});

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
/** The same repository for the area "Probe", which is built when the page knows it. */
const rehearsalRepository = shallowRef<ScreenRepository | null>(null);
const area = ref(controlMemory.area);
watch(area, (value) => (controlMemory.area = value));

/** The list under the button in the head: "Gottesdienst" and "Probe". A tap beside it and Escape close it. */
const areaOpen = ref(false);
const areaBox = ref<HTMLElement | null>(null);
const areaEntries = computed(() => [
    { value: 'service' as const, text: t.control.service, hint: t.control.areaServiceHint },
    { value: 'rehearsal' as const, text: t.control.rehearsal, hint: t.control.areaRehearsalHint },
]);
function chooseArea(value: 'service' | 'rehearsal'): void {
    area.value = value;
    areaOpen.value = false;
}
function closeAreaOnOutside(event: Event): void {
    if (areaOpen.value && !areaBox.value?.contains(event.target as Node)) areaOpen.value = false;
}
function closeAreaOnEscape(event: KeyboardEvent): void {
    if (event.key === 'Escape') areaOpen.value = false;
}
document.addEventListener('pointerdown', closeAreaOnOutside);
document.addEventListener('keydown', closeAreaOnEscape);
onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', closeAreaOnOutside);
    document.removeEventListener('keydown', closeAreaOnEscape);
});
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
watch(shownIndex, () => (opened.value = null));
const toggle = (index: number) => (opened.value = opened.value === index ? null : index);

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

/**
 * A long service got crowded (user, 2026-11-11): the song on the screen stands apart with its parts, the next one small below it,
 * all others folded away – the played ones pale, but still to be tapped.
 */
const reached = computed(() => {
    if (shownIndex.value >= 0) return shownIndex.value;
    const p = pick.value;
    return p && p.phase !== 'upcoming' && p.position && p.position.index > 0 ? p.position.index : 1;
});
const current = computed(() => songs.value.find((s) => s.index === shownIndex.value) ?? null);
const upNext = computed(() => songs.value.find((s) => (current.value ? s.index > current.value.index : s.index >= reached.value)) ?? null);
const others = computed(() => songs.value.filter((s) => s !== current.value && s !== upNext.value));
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

const screenLine = computed(() => {
    const s = shown.value;
    if (!s) return t.control.screenNone;
    const sections = sheetOf(s.item)?.sections ?? [];
    const at = activePart.value?.section;
    const part = at === undefined ? null : sections[at] ? sections[at]!.label || t.control.part(at + 1) : null;
    // "Als Nächstes" shows its first part on the screen too: the line names it the same way.
    return s.upcoming ? t.control.screenNext(s.item.title, part) : t.control.screen(s.item.title, part);
});

/**
 * No tap once the event is over or no song is left: after "– Ende –" a stray tap brought a song back to the TV (user, 2026-11-11). The
 * screen ignores such taps as well (`songsheetPick`).
 */
const stepping = computed(() => !!event.value && !!pick.value && !(plan.value?.over ?? false) && songsLeft(pick.value));
const previous = computed(() => (stepping.value ? stepPart(event.value!, activePart.value, -1) : null));
const following = computed(() => (stepping.value ? stepPart(event.value!, activePart.value, 1) : null));

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

watch(eventId, (id) => (controlMemory.eventId = id));
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

/** Also in the designers' group (or an administrator): the button "Designer" in the head leads back. The same test as the start page's. */
const designerToo = ref(controlMemory.designerToo);

onMounted(async () => {
    // The last visit's state at once; the reading below replaces it.
    if (controlMemory.events) {
        events.value = controlMemory.events;
        timeZone.value = controlMemory.timeZone ?? timeZone.value;
        eventId.value = controlMemory.eventId;
        loading.value = false;
    }
    void getRepository()
        .then((handle) => handle.repository.visibleCategories())
        .then((categories) => (designerToo.value = controlMemory.designerToo = Object.keys(categories).length > 0))
        .catch(() => null);
    try {
        const [person, handle, zone] = await Promise.all([currentPerson(), getRepository(), fetchTimeZone()]);
        repository = handle.repository;
        rehearsalRepository.value = handle.repository;
        author = displayName(person);
        timeZone.value = zone;
        if ((await repository.controlCategoryId()) === null) {
            unavailable.value = true;
            return;
        }
        const calendarIds = (await fetchCalendars()).map((c) => c.id);
        const { from, to } = appointmentWindow(new Date(), zone, 1);
        const read = (await churchToolsPlayerData.agendaEvents(calendarIds, from, to, zone, { sheets: true })).filter(hasSong).sort((a, b) => a.startMs - b.startMs);
        if (gone) return;
        events.value = read;
        // An event chosen on the last visit stays chosen while it is still there.
        const kept = read.some((e) => e.eventId === eventId.value) ? eventId.value : null;
        eventId.value = kept ?? (read.length ? preselected(read).eventId : null);
        Object.assign(controlMemory, { events: read, timeZone: zone });
        // The event did not change, so its watcher does not read: read here – the repository was not there for the remembered one.
        if (kept !== null) await refresh();
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
    <main ref="page" class="infoscreen-designer control" :style="{ '--page-top': `${top}px` }">
        <header class="head" data-testid="control-head">
            <h1>{{ t.control.title }}</h1>
            <div ref="areaBox" class="area-box">
                <button
                    type="button"
                    class="area-button"
                    aria-haspopup="true"
                    :aria-expanded="areaOpen"
                    :aria-label="t.control.areaChoose"
                    data-testid="control-area"
                    @click="areaOpen = !areaOpen"
                >
                    <span class="area-prefix">{{ t.control.title }} ·</span>
                    <strong>{{ area === 'service' ? t.control.service : t.control.rehearsal }}</strong>
                    <Icon name="chevron-down" :size="18" />
                </button>
                <ul v-if="areaOpen" class="area-list" role="group" :aria-label="t.control.areaChoose">
                    <li v-for="entry in areaEntries" :key="entry.value">
                        <button type="button" :class="{ chosen: area === entry.value }" :aria-pressed="area === entry.value" :data-testid="`control-area-${entry.value}`" @click="chooseArea(entry.value)">
                            {{ entry.text }}<small>{{ entry.hint }}</small>
                        </button>
                    </li>
                </ul>
            </div>
            <RouterLink v-if="designerToo" :to="{ name: 'designer' }" class="to-designer" :aria-label="t.modeSwitch.designer" :title="t.modeSwitch.designer" data-testid="mode-designer">
                <Icon name="pencil" :size="20" />
            </RouterLink>
        </header>
        <p v-if="loading" class="note">{{ t.control.loading }}</p>
        <p v-else-if="unavailable" class="note">{{ t.control.unavailable }}</p>
        <template v-else>
            <ControlRehearsal v-if="area === 'rehearsal' && rehearsalRepository" :repository="rehearsalRepository" :author="author" />
            <template v-else-if="area === 'service'">
                <p v-if="failure && !event" class="note" role="alert">{{ failure }}</p>
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
                    <p v-if="plan && !plan.over && !stepping" class="screen" data-testid="control-locked">{{ t.control.noSongsLeft }}</p>
                    <p v-else class="screen">{{ screenLine }}</p>
                    <p v-if="failure" class="warn" role="alert">{{ failure }}</p>
                    <p v-if="notSaved" class="warn" role="alert">{{ t.control.notSaved }}</p>
                    <ul v-if="current" class="songs" data-testid="control-current">
                        <ControlSong
                            :title="current.title"
                            :song-key="current.key"
                            :parts="current.parts"
                            :open="true"
                            :active="activePart?.itemIndex === current.index ? activePart.section : null"
                            shown
                            :disabled="!stepping"
                            @choose="(n) => choose({ itemIndex: current!.index, section: n })"
                        />
                    </ul>
                    <template v-if="upNext">
                        <p class="label">{{ t.control.upNext }}</p>
                        <ul class="songs" data-testid="control-next">
                            <ControlSong
                                :title="upNext.title"
                                :song-key="upNext.key"
                                :parts="upNext.parts"
                                :open="opened === upNext.index"
                                :active="null"
                                :disabled="!stepping"
                                @toggle="toggle(upNext.index)"
                                @choose="(n) => choose({ itemIndex: upNext!.index, section: n })"
                            />
                        </ul>
                    </template>
                    <details v-if="others.length" class="all" data-testid="control-all">
                        <summary>{{ t.control.allSongs(others.length) }}</summary>
                        <ul class="songs">
                            <ControlSong
                                v-for="song in others"
                                :key="song.index"
                                :title="song.title"
                                :song-key="song.key"
                                :parts="song.parts"
                                :open="opened === song.index"
                                :active="null"
                                :played="played(song.index)"
                                :disabled="!stepping"
                                @toggle="toggle(song.index)"
                                @choose="(n) => choose({ itemIndex: song.index, section: n })"
                            />
                        </ul>
                    </details>
                    <nav class="steps">
                        <button type="button" :disabled="!previous" @click="previous && choose(previous)">{{ t.control.back }}</button>
                        <button type="button" :disabled="!following" @click="following && choose(following)">{{ t.control.next }}</button>
                    </nav>
                </template>
            </template>
        </template>
    </main>
</template>

<style scoped>
.control {
    box-sizing: border-box;
    /* Down to the window's visible lower edge, below the bar of ChurchTools – like the designer's frame (ModulePage). */
    min-height: calc(100vh - var(--page-top, 0px));
    min-height: calc(100dvh - var(--page-top, 0px));
    /* The margins of the designer's frame, so that the switch stands at the same place; room for the big buttons fixed at the bottom. */
    padding: var(--d-space-4) var(--d-space-4) calc(136px + env(safe-area-inset-bottom));
    background: #101114;
    color: #f2f2f2;
    font-size: 1.1rem;
    display: grid;
    align-content: start;
    gap: 12px;
}
@media (max-width: 48rem) {
    .control {
        padding-inline: var(--d-space-3);
        padding-top: var(--d-space-3);
    }
}
/* The title stays for screen readers; the button in the head says it for the eyes. */
h1 {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
}
.head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
}
.area-box {
    position: relative;
    min-width: 0;
}
/* Looks like a choice (user, 2026-11-13: on the phone the dropdown was not to be recognised – no colour of its own, the dark blue of
   ChurchTools' buttons came through): framed like the tiles, light text, the arrow at the end. */
.head .area-button {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 10px 0 14px;
    border: 1px solid #3a3f4a;
    border-radius: 10px;
    background: #1d2027;
    color: #f1f2f4;
    font-size: 1.05rem;
    white-space: nowrap;
    cursor: pointer;
}
.head .area-button[aria-expanded='true'] {
    border-color: #6b7180;
}
.head .area-button strong {
    color: #f1f2f4;
}
.area-prefix {
    color: #b8bcc4;
}
.area-list {
    position: absolute;
    z-index: 5;
    top: 100%;
    left: 0;
    margin: 4px 0 0;
    padding: 4px;
    min-width: 230px;
    list-style: none;
    border: 1px solid #3a3f4a;
    border-radius: 10px;
    background: #1d2027;
}
.area-list button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 48px;
    padding: 0 12px;
    border: 0;
    border-radius: 8px;
    background: none;
    color: #f1f2f4;
    font: inherit;
    line-height: 1.3;
    text-align: left;
    cursor: pointer;
}
.area-list button.chosen {
    background: #2a2e37;
    font-weight: 600;
}
.area-list small {
    color: #b8bcc4;
    font-size: 0.8rem;
    font-weight: 400;
}
/* A light, neutral ring (user, 2026-11-13) – blue is kept for the running part alone. */
.to-designer {
    display: grid;
    flex: none;
    place-items: center;
    width: 44px;
    height: 44px;
    box-sizing: border-box;
    border: 2px solid #c9ccd3;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    color: #f1f2f4;
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
.label {
    margin-top: 4px;
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.7;
}
/* The rest of a long service, folded away. */
.all {
    margin-top: 8px;
    border-top: 1px solid #3a3f4a;
    padding-top: 12px;
}
.all summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    cursor: pointer;
    color: #b8bcc4;
}
.all > .songs {
    margin-top: 8px;
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
