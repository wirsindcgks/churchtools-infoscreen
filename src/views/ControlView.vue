<script setup lang="ts">
/**
 * The phone page of the musicians (Plan.md 121 E2, 135): they steer the monitor in front of them. At the top the card of the monitor says
 * what it shows (from the position the screen reports into `status`), in the middle the song with its parts or the slides, below "Zurück"
 * and "Vor". Without a screen released for rehearsals or the click steering the page shows the song of the service alone. "Probe starten"
 * opens a sheet from below; a running rehearsal is extended and ended in the card.
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
/** What the middle adds to the card: the lines of the plan or of the own click, the start of the service. */
const info = shallowRef<{ lines: string[]; eventStartMs: number | null }>({ lines: [], eventStartMs: null });
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
const state = computed(() => (monitor.value ? monitorState(shownPosition.value, tick.value, { timeZone: timeZone.value, eventStartMs: info.value.eventStartMs }) : null));
const rehearsalRunning = computed(() => state.value?.kind === 'rehearsal');
/** The rehearsal runs, but the screen shows no rehearsal sheet (no song, no service): the middle says so. */
const noProbeSheet = computed(() => middle.value === 'none' && rehearsalWithoutSheet(position.value));
const lines = computed(() => (info.value.lines.length ? info.value.lines : (state.value?.lines ?? [])));
/** Without a monitor the song of the service stands alone. */
const middle = computed(() => (monitor.value ? (positionRead.value ? (state.value?.middle ?? 'none') : 'none') : 'service'));
const serviceEventId = computed(() => {
    const sheet = position.value?.songsheet;
    return monitor.value && sheet && sheet !== true && sheet.source === 'agenda' ? sheet.eventId : undefined;
});
const slidesPosition = computed(() => (position.value && hasSlides(position.value) ? position.value : null));
watch(middle, () => (info.value = { lines: [], eventStartMs: null }));

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
    monitorId.value = id;
    controlMemory.monitorId = id;
}
watch(
    () => monitor.value?.id,
    () => {
        ++run;
        position.value = null;
        positionRead.value = false;
        info.value = { lines: [], eventStartMs: null };
        sheetOpen.value = false;
        rehearsal.reset();
        failure.value = null;
        void start();
    },
);

onMounted(async () => {
    document.addEventListener('visibilitychange', onVisibility);
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
});
</script>

<template>
    <main class="infoscreen-designer control">
        <header class="head" data-testid="control-head">
            <a href="/" class="back" data-testid="control-back" :aria-label="t.control.backAria" @click.prevent="leaveControl(!!router.options.history.state.back)"><Icon name="back" :size="18" /><span>{{ t.control.backToChurchTools }}</span></a>
            <h1>{{ t.control.title }}</h1>
        </header>
        <div class="middle" data-testid="control-middle">
            <p v-if="loading" class="note">{{ t.control.loading }}</p>
            <p v-else-if="unavailable" class="note">{{ t.control.unavailable }}</p>
            <template v-else>
                <ControlMonitorCard
                    v-if="monitor"
                    :monitors="monitors"
                    :monitor="monitor"
                    :state="state"
                    :lines="lines"
                    :silent="positionRead && !position"
                    :rehearsal-running="rehearsalRunning"
                    :busy="rehearsal.busy.value"
                    :transfer="rehearsal.transfer.value"
                    @choose="chooseMonitor"
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
                <p v-else-if="noProbeSheet" class="control-card note" data-testid="monitor-no-sheet">{{ t.control.noProbeSheet }}</p>
                <ControlSlides
                    v-else-if="middle === 'slides' && repository && slidesPosition && monitor"
                    :repository="repository"
                    :author="author"
                    :screen-id="monitor.id"
                    :position="slidesPosition"
                    :read-at="readAt"
                    @clicked="clicked"
                    @info="(next) => (info = next)"
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
    padding: 8px 12px;
}
/* Like "zurück" in the editor – a framed button with the arrow (user, 2026-11-26) –, in the dark of this page. */
.back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: none;
    box-sizing: border-box;
    min-height: 44px;
    padding: 0 14px 0 10px;
    border: 1px solid #3a3f4a;
    border-radius: 10px;
    background: #1d2027;
    color: #f1f2f4;
    font-size: 1.05rem;
    text-decoration: none;
    white-space: nowrap;
}
.back:active {
    border-color: #6b7180;
}
/* A column: the card stands, the song or the slides take what is left and roll inside their own card – the page does not scroll. */
.middle {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 4px 12px 12px;
}
.middle > :deep(*) {
    min-width: 0;
}
.bar {
    flex: none;
    padding: 10px 12px 12px;
    border-top: 1px solid #3a3f4a;
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
/* Like "Danach" below the song: dashed, quiet – the next slide of a presentation by click (Plan.md 135, choice b). */
.next-slide {
    min-height: 52px;
    padding: 0 14px;
    border: 1px dashed #3a3f4a;
    border-radius: 12px;
    background: transparent;
    color: #b8bcc4;
    font: inherit;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
}
</style>
