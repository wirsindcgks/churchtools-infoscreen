<script setup lang="ts">
/**
 * The phone page of the musicians (Plan.md 121 E2, 135): they steer the monitor in front of them. At the top the head names the monitor (the name
 * switches it where there are several) and the band below it says what it shows (from the position the screen reports into `status`), in the middle the song with its parts or the slides, below "Zurück"
 * and "Vor". Without a screen released for rehearsals or the click steering the page shows the song of the service alone. "Probe starten"
 * opens a sheet from below; a running rehearsal is extended and ended in a sheet opened from the band (Plan.md 137 A).
 * Built for a dark stage, thumbs and a narrow screen.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { RehearsalCatalogDoc } from '../agenda/control';
import { useRouter } from 'vue-router';
import { fetchTimeZone } from '../ct/api';
import { currentPerson, displayName } from '../ct/client';
import Icon from '../designer/Icon.vue';
import { t } from '../i18n/designer';
import { hasSlides, type PositionDoc } from '../model/position';
import { getRepository } from '../store/backend';
import type { ScreenRepository } from '../store/screen-repository';
import ControlMonitorCard from './ControlMonitorCard.vue';
import ControlRehearsal from './ControlRehearsal.vue';
import ControlRehearsalSheet from './ControlRehearsalSheet.vue';
import ControlService from './ControlService.vue';
import ControlSlides from './ControlSlides.vue';
import { buildClick, movedSlide, pollDelay } from './click-steering';
import { leaveControl } from './control-back';
import './control-card.css';
import { controlMemory } from './control-memory';
import { monitorList, monitorState, pickMonitor, rehearsalWithoutSheet, type Monitor } from './monitor-state';
import { useRehearsalControl } from './useRehearsalControl';
import { useWakeLock } from './useWakeLock';

// On stage the phone must not lock while the page is open (user, 2026-11-13).
useWakeLock();
/**
 * The page lies fixed over the whole window, above the bar of ChurchTools and the app banner of the iPad (Plan.md 135, Befunde G55 and
 * G57): nothing of the host stays to hide or to scroll. While it is open the page behind must not scroll either; the old values come back
 * on leaving.
 */
let scrollLocked: { el: HTMLElement; overflow: string; background: string }[] = [];
onMounted(() => {
    scrollLocked = [document.documentElement, document.body].map((el) => ({ el, overflow: el.style.overflow, background: el.style.backgroundColor }));
    // Dark behind it as well: the keyboard of iOS shifts the window and showed the white page of ChurchTools below the sheet (user, 2026-11-27).
    for (const { el } of scrollLocked) Object.assign(el.style, { overflow: 'hidden', backgroundColor: '#101114' });
});
onBeforeUnmount(() => {
    for (const { el, overflow, background } of scrollLocked) Object.assign(el.style, { overflow, backgroundColor: background });
    scrollLocked = [];
});

const router = useRouter();
// The last visit's monitors at once; the reading below replaces them.
const loading = ref(!controlMemory.monitors);
const unavailable = ref(false);
const failure = ref<string | null>(null);
const repository = shallowRef<ScreenRepository | null>(null);
const author = ref('');
const timeZone = ref(controlMemory.timeZone ?? 'Europe/Berlin');
const monitors = shallowRef<Monitor[]>(controlMemory.monitors ?? []);
const monitorId = ref(controlMemory.monitorId);
const monitor = computed(() => pickMonitor(monitors.value, monitorId.value));
/** The presentations released for rehearsals, from the catalog in `steuerung`. */
const catalog = shallowRef<RehearsalCatalogDoc | null>(null);
const sheetOpen = ref(false);

/** What the monitor reported; `positionRead` – a reading came, `null` then means that the screen reports nothing. */
const position = shallowRef<PositionDoc | null>(null);
const positionRead = ref(false);
/** The time of the last reading: it changes with every one, also where it brought the same position. */
const readAt = ref(0);
/** What the middle adds to the band: the start of the service. */
const info = shallowRef<{ eventStartMs: number | null }>({ eventStartMs: null });
const tick = ref(Date.now());
const ticker = setInterval(() => (tick.value = Date.now()), 1000);

const rehearsal = useRehearsalControl({ repository, author, screenId: computed(() => monitor.value?.id), position, now: tick });
/** The position with the own rehearsal write laid over it, until the screen reports it. */
const shownPosition = computed<PositionDoc | null>(() => {
    if (!position.value) return null;
    const own = rehearsal.shown.value;
    const shown: PositionDoc = { ...position.value, rehearsal: own ? { until: own.until, ...(own.by ? { by: own.by } : {}) } : undefined };
    if (!own) delete shown.rehearsal;
    return shown;
});
const state = computed(() => (monitor.value ? monitorState(shownPosition.value, { timeZone: timeZone.value, eventStartMs: info.value.eventStartMs }) : null));
const rehearsalRunning = computed(() => state.value?.kind === 'rehearsal');
/** The rehearsal runs, but the screen shows no rehearsal sheet (no song, no service): the middle says so. */
const noProbeSheet = computed(() => middle.value === 'none' && rehearsalWithoutSheet(position.value));
/** Without a monitor the song of the service stands alone. */
const middle = computed(() => (monitor.value ? (positionRead.value ? (state.value?.middle ?? 'none') : 'none') : 'service'));
const serviceEventId = computed(() => {
    const sheet = position.value?.songsheet;
    return monitor.value && sheet && sheet !== true && sheet.source === 'agenda' ? sheet.eventId : undefined;
});
const slidesPosition = computed(() => (position.value && hasSlides(position.value) ? position.value : null));
watch(middle, () => (info.value = { eventStartMs: null }));

// --- reading the position of the monitor: every 3 seconds, every second for 15 after an own click (G16), only while the page is seen ---

let lastClickMs: number | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let gone = false;
/** Counts the monitors chosen: a reading of a monitor left meanwhile is dropped. */
let run = 0;

async function read(): Promise<void> {
    const id = monitor.value?.id;
    if (!id || !repository.value) return;
    const r = run;
    const raw = await repository.value.readPosition(id);
    if (r !== run) return;
    position.value = raw;
    positionRead.value = true;
    readAt.value = Date.now();
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

/** Reads at once and keeps the pace – on opening, after a change of monitor and when the page becomes visible again. */
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

function clicked(): void {
    lastClickMs = Date.now();
    schedule();
}

/**
 * A presentation by click shows a song on one of its slides (Plan.md 135, user, 2026-11-26, choice b): "Vor" stays at the end of the song,
 * so below the song a line leads to the next slide – the same click as tapping it in the list of slides.
 */
const nextSlide = computed(() => {
    const p = slidesPosition.value;
    if (!p || (middle.value !== 'service' && middle.value !== 'rehearsal')) return null;
    // After the song on the last slide there is no next one: the line does not lead back to the start, unlike "Vor".
    if (p.slides[p.slides.length - 1]?.id === p.slideId) return null;
    const id = movedSlide(p, 1);
    return id ? { id, name: p.slides.find((s) => s.id === id)?.name || t.control.slideLine(p.number + 1, p.total, '') } : null;
});
const nextSlideNotSaved = ref(false);
async function goNextSlide(): Promise<void> {
    const p = slidesPosition.value;
    const target = nextSlide.value;
    const repo = repository.value;
    if (!p || !target || !repo || !monitor.value) return;
    nextSlideNotSaved.value = false;
    clicked();
    try {
        const current = await repo.readClick(monitor.value.id);
        await repo.writeClick(
            buildClick(current, { screenId: monitor.value.id, playlistId: p.playlistId, action: { do: 'goto', slideId: target.id }, at: new Date().toISOString(), by: author.value || undefined }),
        );
        clicked();
    } catch (error) {
        console.warn('Der Klick konnte nicht gespeichert werden:', error);
        nextSlideNotSaved.value = true;
    }
}

/** The sheet closes once the write went through; where it did not, it stays and says so. */
async function startRehearsal(playlistId: string, hours: number): Promise<void> {
    if (await rehearsal.start(playlistId, hours)) sheetOpen.value = false;
}

function chooseMonitor(id: string): void {
    switchOpen.value = false;
    monitorId.value = id;
    controlMemory.monitorId = id;
}

/** The list under the name in the head (Plan.md 137 A): a tap beside it and Escape close it. */
const switchOpen = ref(false);
const switchBox = ref<HTMLElement | null>(null);
function closeSwitchOnOutside(event: Event): void {
    if (switchOpen.value && !switchBox.value?.contains(event.target as Node)) switchOpen.value = false;
}
function closeSwitchOnEscape(event: KeyboardEvent): void {
    if (event.key === 'Escape') switchOpen.value = false;
}
watch(
    () => monitor.value?.id,
    () => {
        ++run;
        position.value = null;
        positionRead.value = false;
        info.value = { eventStartMs: null };
        sheetOpen.value = false;
        rehearsal.reset();
        failure.value = null;
        void start();
    },
);

onMounted(async () => {
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('pointerdown', closeSwitchOnOutside);
    document.addEventListener('keydown', closeSwitchOnEscape);
    try {
        const [person, handle, zone] = await Promise.all([currentPerson(), getRepository(), fetchTimeZone()]);
        repository.value = handle.repository;
        author.value = displayName(person);
        timeZone.value = zone;
        if ((await handle.repository.controlCategoryId()) === null) {
            unavailable.value = true;
            return;
        }
        // The list of the released screens; where it cannot be read the page shows the service alone, as without a release.
        catalog.value = await handle.repository
            .readRehearsalScreens()
            .then((read) => read.catalog)
            .catch(() => null);
        if (gone) return;
        const before = monitor.value?.id;
        monitors.value = monitorList(catalog.value);
        Object.assign(controlMemory, { monitors: monitors.value, timeZone: zone });
        // The monitor of the memory is still there, so its watcher does not read: read here.
        if (monitor.value && monitor.value.id === before) await start();
    } catch (e) {
        failure.value = t.control.failed(e instanceof Error ? e.message : null);
    } finally {
        loading.value = false;
    }
});

onBeforeUnmount(() => {
    gone = true;
    ++run;
    clearTimeout(timer);
    clearInterval(ticker);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('pointerdown', closeSwitchOnOutside);
    document.removeEventListener('keydown', closeSwitchOnEscape);
});
</script>

<template>
    <main class="infoscreen-designer control">
        <header class="head" data-testid="control-head">
            <a href="/" class="back" data-testid="control-back" :aria-label="t.control.backAria" @click.prevent="leaveControl(!!router.options.history.state.back)"><Icon name="back" :size="20" /></a>
            <template v-if="monitor && !unavailable">
                <!-- With several screens the name is the switch (user, 2026-11-27): the arrow says it opens; with one it is a name and nothing more. The TV before it says the name is a screen. -->
                <div v-if="monitors.length > 1" ref="switchBox" class="monitor-switch">
                    <button type="button" class="switch-button" aria-haspopup="true" :aria-expanded="switchOpen" :aria-label="t.control.monitorSwitchLabel(monitor.name)" data-testid="monitor-switch" @click="switchOpen = !switchOpen">
                        <Icon name="tv" :size="18" class="monitor-icon" /><span class="monitor-name" data-testid="monitor-name">{{ monitor.name }}</span><Icon name="chevron-down" :size="14" class="switch-chevron" />
                    </button>
                    <ul v-if="switchOpen" class="switch-list" role="group" :aria-label="t.control.screenChoose">
                        <li v-for="m in monitors" :key="m.id">
                            <button type="button" :class="{ chosen: m.id === monitor.id }" :aria-pressed="m.id === monitor.id" :data-testid="`monitor-option-${m.id}`" @click="chooseMonitor(m.id)">{{ m.name }}</button>
                        </li>
                    </ul>
                </div>
                <span v-else class="monitor-switch"><Icon name="tv" :size="18" class="monitor-icon" /><span class="monitor-name" data-testid="monitor-name">{{ monitor.name }}</span></span>
            </template>
            <h1>{{ t.control.title }}</h1>
        </header>
        <div class="middle" data-testid="control-middle">
            <p v-if="loading" class="note">{{ t.control.loading }}</p>
            <p v-else-if="unavailable" class="note">{{ t.control.unavailable }}</p>
            <template v-else>
                <ControlMonitorCard
                    v-if="monitor"
                    :monitor="monitor"
                    :state="state"
                    :silent="positionRead && !position"
                    :rehearsal-running="rehearsalRunning"
                    :busy="rehearsal.busy.value"
                    :transfer="rehearsal.transfer.value"
                    @start-rehearsal="sheetOpen = true"
                    @extend="(hours) => rehearsal.extend(hours)"
                    @end-rehearsal="rehearsal.end()"
                />
                <ControlRehearsalSheet
                    v-if="sheetOpen && monitor"
                    :monitor-name="monitor.name"
                    :playlists="catalog?.playlists ?? []"
                    :busy="rehearsal.busy.value"
                    :not-saved="rehearsal.notSaved.value"
                    @close="sheetOpen = false"
                    @start="startRehearsal"
                />
                <p v-if="rehearsal.notSaved.value && !sheetOpen" class="warn" role="alert">{{ t.control.notSaved }}</p>
                <p v-if="failure" class="warn" role="alert">{{ failure }}</p>
                <ControlService v-if="middle === 'service'" :repository="repository" :author="author" :time-zone="timeZone" :event-id="serviceEventId" :show-plan="!monitor" @info="(next) => (info = next)" />
                <ControlRehearsal v-else-if="middle === 'rehearsal' && repository" :repository="repository" :author="author" />
                <button v-if="nextSlide" type="button" class="next-slide" data-testid="control-next-slide" @click="goNextSlide">{{ t.control.nextSlide(nextSlide.name) }}</button>
                <p v-if="nextSlide && nextSlideNotSaved" class="warn" role="alert">{{ t.control.notSaved }}</p>
                <p v-else-if="noProbeSheet" class="note" data-testid="monitor-no-sheet">{{ t.control.noProbeSheet }}</p>
                <ControlSlides
                    v-else-if="middle === 'slides' && repository && slidesPosition && monitor"
                    :repository="repository"
                    :author="author"
                    :screen-id="monitor.id"
                    :position="slidesPosition"
                    :read-at="readAt"
                    @clicked="clicked"
                />
            </template>
        </div>
        <div id="control-bar" class="bar" data-testid="control-bar" />
    </main>
</template>

<style scoped>
/* Lies over the whole window (Plan.md 135): the z-index is above the bar of ChurchTools (1040), its app banner and its dialogs (1100). */
.control {
    position: fixed;
    inset: 0;
    z-index: 2000;
    box-sizing: border-box;
    height: 100vh;
    height: 100dvh;
    /* Three zones: the head and the bar stand fixed, only the middle may roll. */
    display: flex;
    flex-direction: column;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    background: #101114;
    color: #f2f2f2;
    font-size: 1.1rem;
    /* The page is always dark: the help "?" takes the turquoise of the dark mode of the designer. */
    --d-help: var(--color-teal-300, oklch(85.5% 0.138 181.071));
    --d-surface: #101114;
}
/* The title stays for screen readers; the link says it for the eyes. */
h1 {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
}
.head {
    flex: none;
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 8px;
    padding: 12px 16px;
}
/* Head (Plan.md 137 A): the back button with the arrow alone, 44 × 44, in the frame of the editor's "zurück" (user, 2026-11-26), in the dark of this page. */
.back {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    box-sizing: border-box;
    width: 44px;
    height: 44px;
    border: 1px solid #3a3f4a;
    border-radius: 10px;
    background: #1d2027;
    color: #f1f2f4;
    text-decoration: none;
}
.back:active {
    border-color: #6b7180;
}
/* A flex box of its own: with a percentage width on the button, Safari sized the name to almost nothing ("Confide…", user, 2026-11-27). */
.monitor-switch {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
}
/* Bold, but not `strong`: ChurchTools colours that dark blue. */
.monitor-name {
    min-width: 0;
    padding: 0 6px 0 0;
    font-size: 16px;
    font-weight: 600;
    color: #c9ced6;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
span.monitor-switch {
    align-items: center;
    gap: 6px;
    height: 44px;
}
/* The TV before the name, in both cases (user, 2026-11-27). */
.monitor-icon {
    flex: none;
    margin-left: 6px;
    color: #9aa0aa;
}
button {
    border: 1px solid #3a3f4a;
    border-radius: 8px;
    background: #1d2027;
    color: #f1f2f4;
    font: inherit;
    cursor: pointer;
}
/* The name as the switch: no frame, so it reads as the name; the arrow says it opens. */
.switch-button {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    height: 44px;
    padding: 0;
    border-color: transparent;
    background: none;
}
.switch-chevron {
    flex: none;
    color: #9aa0aa;
}
.switch-button[aria-expanded='true'] .switch-chevron {
    color: #f1f2f4;
}
.switch-list {
    position: absolute;
    z-index: 5;
    top: 100%;
    left: 0;
    margin: 4px 0 0;
    padding: 4px;
    min-width: 200px;
    max-width: calc(100vw - 32px);
    list-style: none;
    border: 1px solid #3a3f4a;
    border-radius: 10px;
    background: #1d2027;
}
.switch-list button {
    width: 100%;
    min-height: 48px;
    padding: 0 12px;
    border: 0;
    background: none;
    text-align: left;
}
.switch-list button.chosen {
    background: #2a2e37;
    font-weight: 600;
}
/* A column: the card stands, the song or the slides take what is left and roll inside their own card – the page does not scroll. */
.middle {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 0 16px 12px;
}
.middle > :deep(*) {
    min-width: 0;
}
.bar {
    flex: none;
    /* As in the drafts (Plan.md 137 C): no rule above; 18 px below, so eight parts of a song fit a small phone with the bar. */
    padding: 12px 12px 18px;
    background: #101114;
}
.bar:empty {
    display: none;
}
p {
    margin: 0;
}
.note {
    color: #b8bcc4;
}
.warn {
    flex: none;
    padding: 10px 12px;
    border-radius: 8px;
    background: #4a2020;
}
/* Like "Danach" below the song: a flat row, one tap away (Plan.md 137 B) – the next slide of a presentation by click (Plan.md 135, choice b). */
.next-slide {
    min-height: 52px;
    padding: 0 16px;
    border: 0;
    border-radius: 12px;
    background: #1b1e25;
    color: #f1f2f4;
    font: inherit;
    font-size: 16px;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
}
</style>
