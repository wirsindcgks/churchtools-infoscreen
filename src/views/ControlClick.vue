<script setup lang="ts">
/**
 * The area "Bildschirm" of the phone page (Plan.md 124 D): the musicians click through the presentation of a screen released for the
 * click steering – back, forward, black, a slide to tap. A click is written as a value per screen into `steuerung` (the player reads it),
 * the screen reports where it stands into `status` (read here). Where the slide shows a songsheet, forward and back step its parts first,
 * the same way as the areas "Gottesdienst" and "Probe" do.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { ControlDoc, RehearsalDoc } from '../agenda/control';
import { agendaDisplay, pickEvent, type AgendaEvent, type LivePosition } from '../agenda/live';
import { REHEARSAL_MAX_AGE_MS, sheetOf, songsLeft, songsheetPick, type SongSheet } from '../agenda/songsheet';
import { fetchCalendars, fetchSong } from '../ct/api';
import { t } from '../i18n/designer';
import { appointmentWindow, churchToolsPlayerData, loadArrangementSheet } from '../player/data';
import { hasSlides, type ClickPosition } from '../model/position';
import type { ScreenRepository } from '../store/screen-repository';
import { controlMemory } from './control-memory';
import {
    buildClick,
    createQueue,
    decideStep,
    movedSlide,
    OPTIMISTIC_MAX_MS,
    PARTS_POLL_MS,
    pollDelay,
    positionSettled,
    type StepDecision,
    type StepSources,
} from './click-steering';
import { usePresenterKeys } from '../player/presenter-keys';

const props = defineProps<{ repository: ScreenRepository; author: string; timeZone: string; screens: { id: string; name: string }[] }>();

const chosenId = ref<string | null>(controlMemory.clickScreenId);
const screen = computed(() => props.screens.find((s) => s.id === chosenId.value) ?? props.screens[0] ?? null);
const position = shallowRef<ClickPosition | null>(null);
const failure = ref<string | null>(null);
const notSaved = ref(false);
/** A second of its own for "vor 5 s" and the clock of the agenda. */
const tick = ref(Date.now());
/** The own last click (ms), for the pace of the reading. */
let lastClickMs: number | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let ticker: ReturnType<typeof setInterval> | undefined;
let gone = false;
/** Counts the screens chosen: a reading of a screen left meanwhile is dropped. */
let run = 0;
const enqueue = createQueue();

// --- the own clicks, shown at once ---

/** What the own last click makes of the display until the screen reports it (`position.seq` ≥ `seq`); `seq` is known once the click is written. */
interface Pending {
    token: number;
    slideId: string;
    number: number;
    black: boolean;
    seq: number | null;
    at: number;
}
const pending = shallowRef<Pending | null>(null);
let token = 0;

/** What the screen shows: its position, with the own click not yet confirmed laid over it. */
const shown = computed(() => {
    const p = position.value;
    if (!p) return null;
    const over = pending.value;
    return over ? { ...p, slideId: over.slideId, number: over.number, black: over.black } : { ...p, black: !!p.black };
});
const slideName = computed(() => shown.value?.slides.find((s) => s.id === shown.value!.slideId)?.name ?? '');
const lastClick = computed(() => {
    const over = pending.value;
    if (over) return { by: props.author || null, at: over.at };
    const p = position.value;
    return p?.clickAt ? { by: p.by ?? null, at: Date.parse(p.clickAt) } : null;
});
const lastClickText = computed(() => (lastClick.value ? t.control.clickLast(lastClick.value.by, t.control.clickAgo(Math.max(0, Math.round((tick.value - lastClick.value.at) / 1000)))) : ''));

// --- the parts of a songsheet on the slide, read only while the screen stands on one ---

const songsheet = computed(() => position.value?.songsheet);
const sourceKey = computed(() => {
    const s = songsheet.value;
    return s && s !== true ? (s.source === 'agenda' ? `agenda:${s.eventId}` : 'rehearsal') : '';
});
/** The event of the agenda the screen follows; `null` where it is not to be found, no entry until it is read. */
const loadedEvent = shallowRef<{ eventId: number; event: AgendaEvent | null } | null>(null);
const agendaControl = shallowRef<ControlDoc | undefined>(undefined);
const localControl = shallowRef<ControlDoc | null>(null);
const agendaPosition = shallowRef<LivePosition | null>(null);
/** The rehearsal as read: no entry yet; `doc: null` where no song is chosen. */
const loadedRehearsal = shallowRef<{ doc: RehearsalDoc | null; sheet: SongSheet | null } | null>(null);
const localRehearsal = shallowRef<RehearsalDoc | null>(null);
let partsReadAt = 0;
/** Whether the parts of the songsheet on show have been read once; the decision waits for it. */
const partsReady = ref(false);
let sheetKey = '';

const sources = computed<StepSources>(() => {
    const s = songsheet.value;
    if (!s || s === true) return {};
    if (s.source === 'agenda') {
        const loaded = loadedEvent.value;
        if (!loaded || loaded.eventId !== s.eventId || !partsReady.value) return {};
        const event = loaded.event;
        if (!event) return { agenda: null };
        const at = tick.value;
        const pick = pickEvent([event], { [event.eventId]: agendaPosition.value }, at) ?? { event, position: agendaPosition.value ?? undefined, phase: 'upcoming' as const };
        // As on the page of the service: no step once the agenda is over or no song is left.
        if (!agendaDisplay(pick, at) || !songsLeft(pick)) return { agenda: null };
        const control = localControl.value ?? agendaControl.value;
        const picked = songsheetPick(pick, control);
        const itemIndex = picked ? event.items.indexOf(picked.item) : -1;
        // Without a choice the screen shows part 1.
        const section = picked ? (picked.section ?? ((sheetOf(picked.item)?.sections.length ?? 0) > 0 ? 0 : undefined)) : undefined;
        return { agenda: { event, part: itemIndex >= 0 && section !== undefined ? { itemIndex, section } : null } };
    }
    const read = loadedRehearsal.value;
    if (!read) return {};
    const doc = localRehearsal.value ?? read.doc;
    if (!doc || !read.sheet) return { rehearsal: null };
    return { rehearsal: { sheet: read.sheet, section: doc.section } };
});

async function loadEvent(eventId: number): Promise<AgendaEvent | null> {
    const known = controlMemory.events?.find((e) => e.eventId === eventId);
    if (known) return known;
    const calendarIds = (await fetchCalendars()).map((c) => c.id);
    const { from, to } = appointmentWindow(new Date(), props.timeZone, 1);
    const events = await churchToolsPlayerData.agendaEvents(calendarIds, from, to, props.timeZone, { sheets: true });
    return events.find((e) => e.eventId === eventId) ?? null;
}

/** Reads what the parts of the songsheet need – the choice of the agenda and its position, or the song of the rehearsal. */
async function readParts(r: number): Promise<void> {
    const s = songsheet.value;
    if (!s || s === true) return;
    if (s.source === 'agenda') {
        if (loadedEvent.value?.eventId !== s.eventId) {
            const event = await loadEvent(s.eventId);
            if (r !== run) return;
            loadedEvent.value = { eventId: s.eventId, event };
        }
        if (!loadedEvent.value.event) {
            partsReadAt = Date.now();
            partsReady.value = true;
            return;
        }
        const [pos, controls] = await Promise.all([churchToolsPlayerData.agendaPosition(s.eventId), props.repository.readControls()]);
        if (r !== run) return;
        agendaPosition.value = pos;
        agendaControl.value = controls[s.eventId];
        // The reading has caught up with the own tap: the stored choice counts again.
        if (localControl.value && agendaControl.value && Date.parse(agendaControl.value.at) >= Date.parse(localControl.value.at)) localControl.value = null;
    } else {
        const doc = await props.repository.readRehearsal();
        if (r !== run) return;
        const usable = doc && !doc.ended && Date.now() - Date.parse(doc.at) <= REHEARSAL_MAX_AGE_MS ? doc : null;
        let sheet = loadedRehearsal.value?.sheet ?? null;
        const key = usable ? `${usable.songId}:${usable.arrangementId}` : '';
        if (key !== sheetKey) {
            sheet = null;
            if (usable) {
                const song = await fetchSong(usable.songId).catch(() => null);
                const arrangement = song?.arrangements?.find((a) => a.id === usable.arrangementId);
                sheet = arrangement ? await loadArrangementSheet(arrangement).catch(() => null) : null;
            }
            if (r !== run) return;
            sheetKey = key;
        }
        loadedRehearsal.value = { doc: usable, sheet };
        if (localRehearsal.value && usable && Date.parse(usable.at) >= Date.parse(localRehearsal.value.at)) localRehearsal.value = null;
    }
    partsReadAt = Date.now();
    partsReady.value = true;
}

// --- reading the position ---

async function read(): Promise<void> {
    const id = screen.value?.id;
    if (!id) return;
    const r = run;
    const raw = await props.repository.readPosition(id);
    if (r !== run) return;
    // Without slides – the presentation runs by time – there is nothing to click: as without a position (Plan.md 135 B; the look follows with C).
    const read = raw && hasSlides(raw) ? raw : null;
    position.value = read;
    const over = pending.value;
    if (over && (positionSettled(read, over.seq) || Date.now() - over.at > OPTIMISTIC_MAX_MS)) pending.value = null;
    // A new slide with another source starts over with the parts.
    if (sourceKey.value && Date.now() - partsReadAt >= PARTS_POLL_MS) await readParts(r);
}

function schedule(): void {
    clearTimeout(timer);
    if (gone || document.visibilityState !== 'visible') return;
    timer = setTimeout(async () => {
        try {
            await read();
            failure.value = null;
        } catch (e) {
            // The last position stays.
            failure.value = t.control.failed(e instanceof Error ? e.message : null);
        }
        schedule();
    }, pollDelay(lastClickMs, Date.now()));
}

/** Reads at once and keeps the pace – on opening, after a change of screen and when the page becomes visible again. */
async function start(): Promise<void> {
    clearTimeout(timer);
    if (gone || document.visibilityState !== 'visible') return;
    try {
        await read();
        failure.value = null;
    } catch (e) {
        failure.value = t.control.failed(e instanceof Error ? e.message : null);
    }
    schedule();
}

function onVisibility(): void {
    if (document.visibilityState === 'visible') void start();
    else clearTimeout(timer);
}

watch(
    sourceKey,
    () => {
        // Another source: what was read for the one before does not count. Sync, so that the reading of the same round starts afresh.
        partsReadAt = 0;
        partsReady.value = false;
        loadedRehearsal.value = null;
        sheetKey = '';
        localControl.value = null;
        localRehearsal.value = null;
    },
    { flush: 'sync' },
);

function pickScreen(event: Event): void {
    chosenId.value = (event.target as HTMLSelectElement).value;
    controlMemory.clickScreenId = chosenId.value;
}
watch(
    () => screen.value?.id,
    () => {
        ++run;
        position.value = null;
        pending.value = null;
        partsReadAt = 0;
        partsReady.value = false;
        loadedEvent.value = null;
        loadedRehearsal.value = null;
        sheetKey = '';
        failure.value = null;
        notSaved.value = false;
        void start();
    },
);

// --- clicking ---

/** Without a position nothing is to be clicked. */
const clickable = computed(() => !!position.value && !!screen.value);
const black = computed(() => !!shown.value?.black);
const decision = (by: 1 | -1) => (position.value ? decideStep(songsheet.value, black.value, sources.value, by) : null);
/** While an own click on the slides is unconfirmed the slide on show is not the one of the position: its songsheet is unknown, only slides are clicked. */
const stepsBlocked = (by: 1 | -1) => !clickable.value || decision(by) === null || decision(by)?.kind === 'none';
/** Why a button stands grey: the song ends there. The slides never grey a button – the phone does not know the pages of a block, the player decides. */
const endNote = computed(() => {
    if (!clickable.value) return '';
    const rehearsal = songsheet.value && songsheet.value !== true && songsheet.value.source === 'rehearsal';
    // Only the end of a song needs words – the next song comes another way; at its first part the grey "Zurück" says enough (user, 2026-11-26).
    return decision(1)?.kind === 'none' ? (rehearsal ? t.control.clickEndRehearsal : t.control.clickEnd) : '';
});

/** Writes the click value of the screen: reads it first, adds the action, writes it – one after the other (`enqueue`), so that no `seq` is given twice. */
function sendClick(action: { do: 'next' | 'previous' | 'black' } | { do: 'goto'; slideId: string }, over: Omit<Pending, 'token' | 'seq' | 'at'>): void {
    const p = position.value;
    const s = screen.value;
    if (!p || !s) return;
    const mine = ++token;
    lastClickMs = Date.now();
    pending.value = { ...over, token: mine, seq: null, at: lastClickMs };
    notSaved.value = false;
    const at = new Date().toISOString();
    void enqueue(async () => {
        const current = await props.repository.readClick(s.id);
        const doc = buildClick(current, { screenId: s.id, playlistId: p.playlistId, action, at, by: props.author || undefined });
        await props.repository.writeClick(doc);
        return doc.actions[doc.actions.length - 1]!.seq;
    }).then(
        (seq) => {
            if (pending.value?.token === mine) pending.value = { ...pending.value, seq };
            // A reading that came in between may already have caught up.
            if (pending.value?.token === mine && positionSettled(position.value, seq)) pending.value = null;
            schedule();
        },
        (error) => {
            console.warn('Der Klick konnte nicht gespeichert werden:', error);
            if (pending.value?.token === mine) pending.value = null;
            notSaved.value = true;
        },
    );
    schedule();
}

/** The own display after a click: the slide it moves to (`null` = it stays) and black. */
function after(step: { do: 'next' | 'previous' } | { do: 'goto'; slideId: string } | { do: 'black' }): Omit<Pending, 'token' | 'seq' | 'at'> {
    const now = shown.value!;
    // A click while black only lifts the black (as in a slide show program).
    if (now.black) return { slideId: now.slideId, number: now.number, black: false };
    if (step.do === 'black') return { slideId: now.slideId, number: now.number, black: true };
    if (step.do === 'goto') {
        const at = now.slides.findIndex((s) => s.id === step.slideId);
        return at < 0 ? { slideId: now.slideId, number: now.number, black: false } : { slideId: step.slideId, number: at + 1, black: false };
    }
    const by = step.do === 'next' ? 1 : -1;
    const target = movedSlide(now, by);
    // At the ends nothing moves in the display – the player stays there, unless a block on the slide still has a page (the phone cannot know).
    if (target === null) return { slideId: now.slideId, number: now.number, black: false };
    return { slideId: target, number: now.number + by, black: false };
}

function writePart(decided: Extract<StepDecision, { kind: 'part' | 'section' }>): void {
    const stamp = new Date().toISOString();
    notSaved.value = false;
    if (decided.kind === 'part') {
        const event = loadedEvent.value?.event;
        const item = event?.items[decided.part.itemIndex];
        if (!event || !item) return;
        const doc: ControlDoc = { eventId: event.eventId, itemIndex: decided.part.itemIndex, section: decided.part.section, at: stamp };
        if (item.arrangementId !== undefined) doc.arrangementId = item.arrangementId;
        if (props.author) doc.by = props.author;
        localControl.value = doc;
        lastClickMs = Date.now();
        void enqueue(() => props.repository.writeControl(doc)).catch((error) => {
            console.warn('Die Wahl konnte nicht gespeichert werden:', error);
            if (localControl.value === doc) localControl.value = null;
            notSaved.value = true;
        });
    } else {
        const base = localRehearsal.value ?? loadedRehearsal.value?.doc;
        if (!base) return;
        const doc: RehearsalDoc = { kind: 'rehearsal', songId: base.songId, arrangementId: base.arrangementId, section: decided.section, at: stamp };
        if (props.author) doc.by = props.author;
        localRehearsal.value = doc;
        lastClickMs = Date.now();
        void enqueue(() => props.repository.writeRehearsal(doc)).catch((error) => {
            console.warn('Die Wahl konnte nicht gespeichert werden:', error);
            if (localRehearsal.value === doc) localRehearsal.value = null;
            notSaved.value = true;
        });
    }
    schedule();
}

function step(by: 1 | -1): void {
    if (!clickable.value) return;
    // Unconfirmed click on the slides: the slide on show may not be the one of the position, so no parts are stepped – only slides.
    const decided = pending.value ? decideStep(undefined, black.value, {}, by) : decision(by);
    if (!decided) return;
    if (decided.kind === 'none') return;
    if (decided.kind === 'slide') {
        const action = { do: decided.do };
        sendClick(action, after(action));
    } else writePart(decided);
}

function blackClick(): void {
    if (!clickable.value) return;
    const action = { do: 'black' as const };
    sendClick(action, after(action));
}

function goto(slideId: string): void {
    if (!clickable.value) return;
    const action = { do: 'goto' as const, slideId };
    sendClick(action, after(action));
}

const presenter = usePresenterKeys(step);

onMounted(() => {
    ticker = setInterval(() => (tick.value = Date.now()), 1000);
    document.addEventListener('visibilitychange', onVisibility);
    void start();
});
onBeforeUnmount(() => {
    gone = true;
    ++run;
    clearTimeout(timer);
    clearInterval(ticker);
    document.removeEventListener('visibilitychange', onVisibility);
});
</script>

<template>
    <div class="click" data-testid="control-click">
        <select v-if="screens.length > 1" class="pick" :value="screen?.id" :aria-label="t.control.screenChoose" data-testid="click-screen" @change="pickScreen">
            <option v-for="s in screens" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <p v-if="failure" class="warn" role="alert">{{ failure }}</p>
        <p v-if="notSaved" class="warn" role="alert">{{ t.control.notSaved }}</p>
        <template v-if="shown">
            <p class="where control-card" data-testid="click-slide">
                <strong>{{ t.control.clickSlide(shown.number, shown.total, slideName) }}</strong>
                <small>{{ t.control.clickScreenName(screen!.name) }}</small>
            </p>
            <p v-if="lastClickText" class="note" data-testid="click-last">{{ lastClickText }}</p>
            <p class="label">{{ t.control.clickSlides }}</p>
            <ul class="slides" data-testid="click-slides">
                <li v-for="(s, i) in shown.slides" :key="s.id">
                    <button type="button" :class="{ active: s.id === shown.slideId }" :aria-current="s.id === shown.slideId" @click="goto(s.id)">
                        <span class="n">{{ i + 1 }}</span>{{ s.name || t.control.clickSlide(i + 1, shown.total, '') }}
                    </button>
                </li>
            </ul>
            <p v-if="endNote" class="note" data-testid="click-end">{{ endNote }}</p>
            <p v-if="presenter" class="note" data-testid="click-presenter">{{ t.control.presenterDetectedClick }}</p>
        </template>
        <p v-else class="note" data-testid="click-none">{{ t.control.clickNone }}</p>
        <!-- In the fixed zone below the middle of the page (Plan.md 135 A). -->
        <Teleport defer to="#control-bar">
            <nav class="steps">
                <button type="button" :disabled="stepsBlocked(-1)" data-testid="click-back" @click="step(-1)">{{ t.control.back }}</button>
                <button type="button" :disabled="stepsBlocked(1)" data-testid="click-forward" @click="step(1)">{{ t.control.clickForward }}</button>
                <button type="button" class="black" :class="{ on: black }" :disabled="!clickable" :aria-pressed="black" data-testid="click-black" @click="blackClick">
                    {{ black ? t.control.clickBlackOff : t.control.clickBlack }}
                </button>
            </nav>
        </Teleport>
    </div>
</template>

<style scoped>
.click {
    display: grid;
    gap: 12px;
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
.pick {
    min-height: 56px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid #3a3f4a;
    background: #1d2027;
    color: inherit;
    font-size: 1.1rem;
}
.where {
    display: grid;
    gap: 2px;
}
/* ChurchTools colours `strong` dark blue: on the dark page the line was hardly to read (user, 2026-11-26). */
.where strong {
    color: #f1f2f4;
    font-size: 1.25rem;
}
.where small {
    color: #b8bcc4;
    font-size: 0.85rem;
}
.label {
    margin-top: 4px;
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.7;
}
.slides {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
}
button {
    min-height: 56px;
    padding: 8px 14px;
    border: 1px solid #3a3f4a;
    border-radius: 8px;
    background: #1d2027;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
}
.slides button {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
}
.slides .n {
    flex: none;
    min-width: 1.6em;
    color: #b8bcc4;
    font-variant-numeric: tabular-nums;
}
button.active {
    background: #2f6fed;
    border-color: #6ea8ff;
    font-weight: 600;
}
button.active .n {
    color: inherit;
}
button:disabled {
    opacity: 0.4;
}
.steps {
    display: grid;
    grid-template-columns: 1fr 1fr 0.8fr;
    gap: 8px;
}
/* Back and forward are what a hand on stage reaches for blind: tall and in big letters, like the other areas. */
.steps button {
    min-height: 80px;
    font-size: 1.5rem;
    font-weight: 600;
    text-align: center;
}
.steps .black {
    font-size: 1.1rem;
}
.steps .black.on {
    background: #f2f2f2;
    border-color: #f2f2f2;
    color: #101114;
}
</style>
