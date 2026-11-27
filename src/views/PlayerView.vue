<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import { enableTokenLogin } from '../ct/client';
import type { ClickAction } from '../agenda/control';
import { shownSlideIds } from '../model/embeds';
import { INTERACTION_WAIT_SECONDS, type MediaDoc, type SlideDoc } from '../model/schema';
import { imageSource, provideStageContext, themeOf, type StageContext } from '../player/context';
import { browserDeps, createPlayer } from '../player/controller';
import { createChurchToolsPlayerData } from '../player/data';
import { readDeviceLogin, reloadWithDeviceLogin, withDeviceLogin } from '../player/device-login';
import { screenImageUrls, slideImageUrls } from '../player/images';
import { applyCustomFonts } from '../player/custom-fonts';
import { createMediaCache } from '../player/media-cache';
import { createVideoCache } from '../player/video-cache';
import { screenVideoUrls } from '../player/video';
import { createPreloader } from '../player/preload';
import { turnsWithin } from '../player/paging';
import { canStepSlide, effectiveAdvance, songsheetOf, songsheetOfSlides } from '../player/click';
import { presenterAction } from '../player/presenter-keys';
import { placeInRotation, useRotation } from '../player/rotation';
import { activeOverride, activePlaylistId, type ScheduleContext } from '../player/schedule';
import { keepPlayerStorage, registerPlayerServiceWorker, watchForNewVersion } from '../player/service-worker';
import { INTERVALS } from '../player/timing';
import { fitStage } from '../player/stage';
import { loadingVars } from '../player/theme';
import { bandInset, bannerShown } from '../player/banner';
import BannerView from '../player/BannerView.vue';
import { fontStack } from '../player/fonts';
import { progressTextColor } from '../player/progress-color';
import ProgressBar from '../player/ProgressBar.vue';
import SlideView from '../player/SlideView.vue';
import { onStoreChanged } from '../store/backend';
import StageView from '../player/StageView.vue';
import { tp } from '../i18n/player';

const route = useRoute();
const slug = typeof route.query.screen === 'string' ? route.query.screen : null;

// Way B: the token sits in the fragment – ChurchTools has taken it out of the query, if it signed in (G9).
const login = readDeviceLogin(new URL(window.location.href));
if (login) {
    enableTokenLogin(login);
    // A manual reload loads what the address bar shows; without the token in the query, after 24 hours (G32)
    // or once someone else in this browser signs out, that is the ChurchTools login page without our script.
    window.history.replaceState(window.history.state, '', withDeviceLogin(window.location.href, login));
}

const player = slug
    ? createPlayer(slug, createChurchToolsPlayerData(login), {
          ...browserDeps,
          // A plain reload would load the address without the token – after 24 hours (G32) the page without our
          // script; with the token already in the address bar, this reloads instead of a no-op `replace` (G9).
          reload: () => (login ? reloadWithDeviceLogin(window.location, login) : window.location.reload()),
      })
    : null;
const state = player?.state;

const context = reactive<StageContext>({
    now: new Date(),
    timeZone: 'UTC',
    clockConfirmed: false,
    churchName: '',
    churchLogo: null,
    appointments: [],
    posts: [],
    groupHomepages: [],
    people: undefined,
    agenda: undefined,
    rooms: [],
    media: new Map<string, MediaDoc>(),
    images: new Map<string, string>(),
    pages: {},
    turns: {},
    songsheetEvents: {},
    paging: true,
});
provideStageContext(context);

// Once the player has shown something for the first time (Plan.md, 37; G10) – registering earlier would
// still leave a restart before that first success with the browser's error page, since nothing is cached
// yet. The designer never reaches this view, so it never registers. Then there is something worth keeping, too.
let serviceWorkerRegistered = false;
let stopVersionWatch: () => void = () => {};
watch(
    () => state?.phase,
    (phase) => {
        if (phase !== 'running' || serviceWorkerRegistered) return;
        serviceWorkerRegistered = true;
        registerPlayerServiceWorker(import.meta.env.BASE_URL);
        if (import.meta.env.PROD) {
            void keepPlayerStorage();
            // A newer version on the TV within a quarter of an hour, not only after the nightly reload (Plan.md 117).
            if (player) stopVersionWatch = watchForNewVersion(import.meta.env.BASE_URL, player.newVersion, INTERVALS.updateCheckMs);
        }
    },
);

// Every loaded configuration – from the offline copy or fresh – brings its images onto the device,
// the church logo included: a new logo is a new address (G29).
const mediaCache = createMediaCache();
// Videos too, but one at a time and only where the service worker runs – it is what plays them from the device.
const videoCache = createVideoCache();
watch(
    () => state && ([state.screen, state.churchLogo] as const),
    async (current) => {
        const [loaded, churchLogo] = current ?? [];
        if (!loaded) return;
        const stage = loaded.screen.stage;
        context.images = await mediaCache.sync(screenImageUrls(loaded.slides, loaded.media, stage, churchLogo ?? null));
        if (import.meta.env.PROD && 'serviceWorker' in navigator) void videoCache.sync(screenVideoUrls(loaded.slides, loaded.media));
    },
    { immediate: true },
);

watch(
    () =>
        state &&
        ([
            state.timeZone,
            state.clockConfirmed,
            state.churchName,
            state.churchLogo,
            state.appointments,
            state.posts,
            state.groupHomepages,
            state.people,
            state.agenda,
            state.rehearsal,
            state.rooms,
            state.screen,
        ] as const),
    () => {
        if (!state) return;
        context.timeZone = state.timeZone;
        context.clockConfirmed = state.clockConfirmed;
        context.churchName = state.churchName;
        context.churchLogo = state.churchLogo;
        context.appointments = state.appointments;
        context.posts = state.posts;
        context.groupHomepages = state.groupHomepages;
        context.people = state.people;
        context.agenda = state.agenda;
        context.rehearsal = state.rehearsal;
        context.rooms = state.rooms;
        context.media = new Map((state.screen?.media ?? []).map((m) => [m.id, m]));
        context.theme = state.screen?.theme ?? null;
        // The church's own fonts (Plan.md 103): without a copy and without a network the text keeps drawing in Lato.
        void applyCustomFonts(state.screen?.theme);
    },
    { immediate: true },
);

/** What the schedule decides with: the override of the musicians included (Plan.md 125 B). */
const scheduleContext = computed<ScheduleContext | null>(() => {
    const loaded = state?.screen;
    if (!loaded) return null;
    return {
        now: context.now,
        timeZone: context.timeZone,
        clockConfirmed: context.clockConfirmed,
        appointments: context.appointments,
        agenda: context.agenda ?? { events: [], positions: {} },
        override: {
            doc: state?.override,
            release: { screenIds: loaded.rehearsalScreenIds ?? [], playlistIds: loaded.rehearsalPlaylistIds ?? [] },
        },
    };
});

/** The override of the musicians that runs now – the same decision as for the presentation below; the same object while it holds. */
const override = computed(() => {
    const loaded = state?.screen;
    const schedule = scheduleContext.value;
    return loaded && schedule?.override ? activeOverride(loaded.screen, schedule.override.doc, schedule.override.release, schedule) : null;
});

const playlist = computed(() => {
    const loaded = state?.screen;
    const schedule = scheduleContext.value;
    if (!loaded || !schedule) return null;
    const playlistId = activePlaylistId(loaded.screen, schedule);
    return (
        loaded.playlists.find((p) => p.id === playlistId) ??
        loaded.playlists.find((p) => p.id === loaded.screen.defaultPlaylistId) ??
        null
    );
});

/** How the presentation moves on at this screen (Plan.md 124 C); "by time" without the release for the click steering. */
const advance = computed(() => effectiveAdvance(playlist.value, state?.screen?.screen.id ?? '', state?.screen?.clickScreenIds));
// "Per click" shows no bar (like the editor's stage): the blocks then show their own progress, and they page only by a click.
watchEffect(() => {
    context.slideProgress = !!playlist.value?.progress && advance.value !== 'click';
    context.paging = advance.value !== 'click';
    context.handPaging = advance.value === 'click';
});

const slides = computed<SlideDoc[]>(() => {
    const loaded = state?.screen;
    if (!loaded || !playlist.value) return [];
    const byId = new Map(loaded.slides.map((s) => [s.id, s]));
    return shownSlideIds(playlist.value, loaded.playlists).map((id) => byId.get(id)).filter((s): s is SlideDoc => !!s && s.enabled);
});

/** The playlist's band (Plan.md 32), until its time is up. */
const banner = computed(() => {
    const band = playlist.value?.banner;
    return bannerShown(band, context.now, context.timeZone) ? band : null;
});

const { index, current, scheduleNext, startedAt, heldAt, seconds, step, setPaused } = useRotation(slides, () => context.pages ?? {});
// "Per click" the rotation holds the slide, like a paused preview; only a click moves on.
watch(() => advance.value === 'click', (held) => setPaused(held), { immediate: true });

const preload = createPreloader();
watch(
    [current, () => context.images],
    () => {
        const list = slides.value;
        if (list.length < 2) return;
        const next = list[(index.value + 1) % list.length];
        if (next) {
            const urls = slideImageUrls(next, context.media, stage.value, context.churchLogo ?? null);
            preload(urls.map((url) => imageSource(context, url)));
        }
    },
);

const viewport = reactive({ width: window.innerWidth, height: window.innerHeight });
/** The church's colours while loading, once the device knows them. */
const loadingStyle = computed(() => loadingVars(state?.screen?.theme));
/** The screen's name once the device knows it, its address before. */
const loadingName = computed(() => state?.screen?.screen.name || slug);
const stage = computed(() => state?.screen?.screen.stage ?? { width: 1920, height: 1080 });
const fit = computed(() => fitStage(viewport, stage.value, state?.screen?.screen.overscanPercent ?? 0));
/** Paging by touch or mouse (Plan.md 127): a setting of the screen, off unless an administrator switched it on. */
const interactive = computed(() => state?.screen?.screen.interactive ?? false);
const waitSeconds = computed(() => state?.screen?.screen.interactionWaitSeconds ?? INTERACTION_WAIT_SECONDS);
/**
 * Someone is at the screen (Plan.md 127 C): from a tap or a movement of the mouse until the wait has passed without input.
 * Meanwhile the cursor shows, and arrows set to "after the first tap" too; arrows set to "always" stay.
 */
const engaged = ref(false);
let engagedTimer: ReturnType<typeof setTimeout> | undefined;
function engage(): void {
    if (!interactive.value) return;
    engaged.value = true;
    clearTimeout(engagedTimer);
    engagedTimer = setTimeout(() => (engaged.value = false), waitSeconds.value * 1000);
}
const arrowsShown = computed(() => interactive.value && (state?.screen?.screen.interactionArrows !== 'after-tap' || engaged.value));
/** The arrows follow the corners of the design, round or square, like the cards on the slides. */
const squareArrows = computed(() => themeOf(context).corners === 'square');
function pageBy(by: number): void {
    engage();
    // A paged block on the slide turns first; the slide stays with its full time (Plan.md 127 D).
    if (current.value && turnsWithin(current.value, context.turns ?? {}, by)) {
        context.pageStep = { by, at: Date.now() };
        step(0, waitSeconds.value);
        return;
    }
    step(by, waitSeconds.value);
}

/** The stage is black (Plan.md 124 C) – above banner and bar; a presentation of its own starts without it. */
const black = ref(false);
/** The `seq` of the click applied last, with the name and time of the click value, for the position written to `status`. */
const appliedSeq = ref(0);
const appliedBy = ref<{ by?: string; at?: string }>({});
/** One step of a click: a paged block on the slide turns first, else the slide moves; no least time and no `engage()`, unlike touch (Plan.md 124 C). */
function clickBy(by: number): void {
    if (current.value && turnsWithin(current.value, context.turns ?? {}, by)) {
        context.pageStep = { by, at: Date.now() };
        step(0);
        return;
    }
    // "Vor" on the last slide starts over, "Zurück" on the first holds (Plan.md 124, user 2026-11-27).
    if (canStepSlide(index.value, slides.value.length, by)) step(by);
}
function applyClick(action: ClickAction): void {
    // Black goes with any click and nothing else happens, as in a slide show program.
    if (black.value) {
        black.value = false;
        return;
    }
    if (action.do === 'black') {
        black.value = true;
    } else if (action.do === 'goto') {
        const count = slides.value.length;
        const target = slides.value.findIndex((s) => s.id === action.slideId);
        if (target >= 0 && target !== index.value % count) step(target - (index.value % count));
    } else {
        clickBy(action.do === 'next' ? 1 : -1);
    }
}
/**
 * A presenter at the device of this screen (Plan.md 124 E): the keys do what a click from the phone does, and the position says so. Only
 * where clicks count at all – at a released screen with a presentation that is not "by time"; the song parts stay with the phone.
 */
const presenterOn = computed(() => (state?.screen?.screen.presenterKeys ?? false) && advance.value !== 'time');
function onPresenterKey(event: KeyboardEvent): void {
    if (!presenterOn.value) return;
    const action = presenterAction(event);
    if (!action) return;
    event.preventDefault();
    appliedBy.value = { by: tp.presenterBy, at: new Date().toISOString() };
    applyClick({ seq: appliedSeq.value, do: action });
}
/** Batches wait for each other, and each action for the blocks to have settled: two clicks in a row page a list twice. */
let clickQueue: Promise<void> = Promise.resolve();
watch(
    () => state?.clicks,
    (batch) => {
        if (!batch || batch.playlistId !== playlist.value?.id) return;
        clickQueue = clickQueue.then(async () => {
            for (const action of batch.actions) {
                applyClick(action);
                await nextTick();
                await nextTick();
            }
            appliedSeq.value = batch.seq;
            appliedBy.value = { by: batch.by, at: batch.at };
        });
    },
);
watch(
    () => playlist.value?.id,
    () => {
        black.value = false;
        appliedSeq.value = 0;
        appliedBy.value = {};
    },
);
/** What the songsheet block of the slide on show says of its source; a computed of its own so that a block reporting its event moves the position. */
const songsheet = computed(() => (current.value ? songsheetOf(current.value, context.songsheetEvents ?? {}) : undefined));
/**
 * The events the songsheet blocks reported, kept while the presentation runs: a block reports only while it is on show, and the position of
 * a presentation by time must not change with every round between "event known" and "unknown".
 */
const seenEvents = reactive<Record<string, number>>({});
watch(
    () => ({ ...context.songsheetEvents }),
    (events) => Object.assign(seenEvents, events),
    { immediate: true },
);
watch(
    () => playlist.value?.id,
    () => {
        for (const id of Object.keys(seenEvents)) delete seenEvents[id];
    },
);
/** The songsheet of the presentation as a whole, for the position by time (`songsheetOfSlides`). */
const playlistSongsheet = computed(() => songsheetOfSlides(slides.value, seenEvents));
// Where the screen stands, for the phone page (Plan.md 135 B). Where clicks count it follows slide, black and clicks; by time it follows only
// presentation, rehearsal and songsheet – no write per slide. The player drops what did not change and reports only a released screen.
watch(
    [advance, playlist, override, current, slides, black, appliedSeq, appliedBy, songsheet, playlistSongsheet],
    () => {
        const slide = current.value;
        const running = playlist.value;
        if (!player || !running) return;
        const common = {
            playlistId: running.id,
            playlistName: running.name,
            advance: advance.value,
            ...(override.value ? { rehearsal: { until: override.value.until, ...(override.value.by ? { by: override.value.by } : {}) } } : {}),
        };
        if (advance.value === 'time') {
            player.reportPosition({ ...common, ...(playlistSongsheet.value ? { songsheet: playlistSongsheet.value } : {}), seq: 0 });
            return;
        }
        if (!slide) return;
        const place = placeInRotation(slides.value, slide.id);
        player.reportPosition({
            ...common,
            slideId: slide.id,
            number: place.number,
            total: place.total,
            slides: slides.value.map((s) => ({ id: s.id, name: s.name })),
            ...(songsheet.value ? { songsheet: songsheet.value } : {}),
            ...(black.value ? { black: true as const } : {}),
            seq: appliedSeq.value,
            ...(appliedBy.value.by ? { by: appliedBy.value.by } : {}),
            ...(appliedBy.value.at ? { clickAt: appliedBy.value.at } : {}),
        });
    },
    { immediate: true },
);
function onResize(): void {
    viewport.width = window.innerWidth;
    viewport.height = window.innerHeight;
}

let ticker: ReturnType<typeof setInterval> | undefined;
let unsubscribe: () => void = () => {};
onMounted(() => {
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onPresenterKey);
    ticker = setInterval(() => (context.now = new Date()), 1000);
    scheduleNext();
    void player?.start();
    if (player) unsubscribe = onStoreChanged(player.refreshNow);
});
onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onPresenterKey);
    clearInterval(ticker);
    clearTimeout(engagedTimer);
    player?.stop();
    unsubscribe();
    stopVersionWatch();
});
</script>

<template>
    <!-- Covers the ChurchTools chrome without touching it (G6). -->
    <div class="player" :class="{ 'player--engaged': engaged }" data-testid="player" @pointermove="engage">
        <p v-if="!slug" class="message" role="alert">{{ tp.noScreen }}</p>
        <!--
            Loading – also while a screen with rules waits a moment for the clock check,
            instead of showing the wrong playlist. A small scene tells what happens: slides
            are gathered, a title, an image and lines of text are set on a screen, then a
            shine polishes it for the TV; below, only the screen's name. In the church's colours (theme accent, text and
            background) as soon as the device knows them. Everything moves by transform and
            opacity only: the compositor moves layers painted once, which a Pi manages. All
            parts share one cycle, so they stay in step; the scene fades in after a short
            pause, so a quick load does not flash.
        -->
        <div
            v-else-if="!state || state.phase === 'loading'"
            class="message loading"
            :style="loadingStyle"
            data-testid="player-loading"
        >
            <div class="loading-inner">
                <div class="scene" aria-hidden="true">
                    <span class="card card-back" />
                    <span class="card card-mid" />
                    <div class="screen">
                        <span class="piece title" />
                        <span class="piece image" />
                        <span class="piece line line-1" />
                        <span class="piece line line-2" />
                        <span class="piece line line-3" />
                        <span class="shine" />
                    </div>
                    <span class="sparkle" />
                    <span class="stand" />
                </div>
                <span class="label">{{ loadingName }}</span>
            </div>
        </div>
        <p v-else-if="state.phase === 'error'" class="message" role="alert">{{ state.error }}</p>
        <template v-else>
            <StageView :width="stage.width" :height="stage.height" :fit="fit">
                <Transition name="fade">
                    <SlideView
                        v-if="current"
                        :key="current.id"
                        :slide="current"
                        :width="stage.width"
                        :height="stage.height"
                    />
                </Transition>
                <p v-if="!current" class="stage-message">{{ tp.noActiveSlide }}</p>
                <BannerView v-if="banner" :banner="banner" :stage-width="stage.width" />
                <ProgressBar
                    v-if="playlist?.progress && current && advance !== 'click'"
                    :started-at="startedAt"
                    :seconds="seconds"
                    :held="heldAt"
                    :bottom="bandInset(banner)"
                    :color="themeOf(context).accent"
                    :text-color="progressTextColor(current.background).color"
                    :shadow="progressTextColor(current.background).shadow"
                    :font-family="fontStack(themeOf(context).font)"
                    :number="(index % slides.length) + 1"
                    :total="slides.length"
                    :edge="playlist?.progressPlacement === 'edge'"
                    :segments="playlist?.progressStyle === 'segments'"
                />
                <template v-if="interactive">
                    <div class="kiosk-zone kiosk-back" data-testid="kiosk-back" @click="pageBy(-1)">
                        <Transition name="fade">
                            <span v-if="arrowsShown" class="kiosk-arrow" :class="{ 'kiosk-arrow--square': squareArrows }" data-testid="kiosk-arrow-back" aria-hidden="true">
                                <svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7" /></svg>
                            </span>
                        </Transition>
                    </div>
                    <div class="kiosk-zone kiosk-forward" data-testid="kiosk-forward" @click="pageBy(1)">
                        <Transition name="fade">
                            <span v-if="arrowsShown" class="kiosk-arrow" :class="{ 'kiosk-arrow--square': squareArrows }" data-testid="kiosk-arrow-forward" aria-hidden="true">
                                <svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
                            </span>
                        </Transition>
                    </div>
                </template>
                <div v-if="black" class="stage-black" data-testid="stage-black" />
            </StageView>
            <!-- Old content with a discreet marker beats a black screen. -->
            <span v-if="state.staleSince" class="stale" data-testid="stale" :title="tp.noConnection" />
        </template>
    </div>
</template>

<style scoped>
/* Black over the whole stage, banner and bar included (Plan.md 124 C); taps still reach the zones below. */
.stage-black {
    position: absolute;
    inset: 0;
    z-index: 30;
    background: #000;
    pointer-events: none;
}
/* Invisible halves of the stage above everything else: left pages back, right forward. */
.kiosk-zone {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50%;
    z-index: 10;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
}
.kiosk-back {
    left: 0;
}
.kiosk-forward {
    right: 0;
}
/* Small and see-through at the edge, in stage pixels (the stage scales them): they say paging works, not cover the slide. */
.kiosk-arrow {
    position: absolute;
    top: 50%;
    width: 88px;
    height: 88px;
    margin-top: -44px;
    border-radius: 50%;
    background: rgb(0 0 0 / 28%);
    opacity: 0.75;
    pointer-events: none;
}
.kiosk-arrow--square {
    border-radius: 0;
}
.kiosk-back .kiosk-arrow {
    left: 24px;
}
.kiosk-forward .kiosk-arrow {
    right: 24px;
}
.kiosk-arrow svg {
    width: 100%;
    height: 100%;
    padding: 20px;
    box-sizing: border-box;
    fill: none;
    stroke: #fff;
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
}
/* The cursor stays hidden on a TV; at an interactive screen it shows while someone is there. */
.player.player--engaged {
    cursor: auto;
}
.player {
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    background: #000;
    overflow: hidden;
    cursor: none;
}
.message.loading {
    --load-cycle: 5.6s;
    background: var(--load-bg);
    color: var(--load-text);
}
.loading-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    /* Opacity only, like everything below: a quick load shows nothing at all. */
    animation: loading-in 0.8s ease-out 0.4s both;
}
.scene {
    position: relative;
    width: 7em;
    height: 4.6em;
    margin-bottom: 1.1em;
}
/* The slides gathered behind the screen. */
.card,
.screen {
    position: absolute;
    left: 0;
    top: 0;
    width: 7em;
    height: 3.94em;
    border-radius: 0.22em;
}
.card {
    background: color-mix(in srgb, var(--load-text) 6%, transparent);
    box-shadow: inset 0 0 0 0.05em color-mix(in srgb, var(--load-text) 18%, transparent);
}
.card-back {
    animation: card-back var(--load-cycle) cubic-bezier(0.2, 0.7, 0.2, 1) infinite;
}
.card-mid {
    animation: card-mid var(--load-cycle) cubic-bezier(0.2, 0.7, 0.2, 1) infinite;
}
.screen {
    overflow: hidden;
    background: color-mix(in srgb, var(--load-text) 5%, var(--load-bg));
    box-shadow:
        inset 0 0 0 0.08em color-mix(in srgb, var(--load-text) 40%, transparent),
        0 0.3em 0.9em color-mix(in srgb, #000 22%, transparent);
}
.stand {
    position: absolute;
    left: 50%;
    top: 4.12em;
    width: 1.6em;
    height: 0.08em;
    margin-left: -0.8em;
    border-radius: 0.04em;
    background: color-mix(in srgb, var(--load-text) 40%, transparent);
}
/* What the slide is made of, set in one by one. */
.piece {
    position: absolute;
    border-radius: 0.06em;
}
.title {
    left: 8%;
    top: 13%;
    width: 50%;
    height: 11%;
    background: var(--load-accent);
    transform-origin: left center;
    animation: piece-title var(--load-cycle) cubic-bezier(0.2, 0.7, 0.2, 1) infinite;
}
.image {
    right: 8%;
    top: 34%;
    width: 34%;
    height: 52%;
    border-radius: 0.1em;
    background: linear-gradient(
        150deg,
        color-mix(in srgb, var(--load-accent) 70%, transparent),
        color-mix(in srgb, var(--load-accent) 25%, transparent)
    );
    animation: piece-image var(--load-cycle) cubic-bezier(0.2, 0.7, 0.2, 1) infinite;
}
.line {
    left: 8%;
    height: 6%;
    background: color-mix(in srgb, var(--load-text) 35%, transparent);
    transform-origin: left center;
}
.line-1 {
    top: 39%;
    width: 44%;
    animation: piece-line-1 var(--load-cycle) cubic-bezier(0.2, 0.7, 0.2, 1) infinite;
}
.line-2 {
    top: 54%;
    width: 38%;
    animation: piece-line-2 var(--load-cycle) cubic-bezier(0.2, 0.7, 0.2, 1) infinite;
}
.line-3 {
    top: 69%;
    width: 26%;
    animation: piece-line-3 var(--load-cycle) cubic-bezier(0.2, 0.7, 0.2, 1) infinite;
}
/* The polish: a soft band of light sweeps across once the slide is complete. */
.shine {
    position: absolute;
    top: -20%;
    left: 0;
    width: 30%;
    height: 140%;
    background: linear-gradient(
        90deg,
        transparent,
        color-mix(in srgb, color-mix(in srgb, var(--load-accent) 25%, #fff) 55%, transparent),
        transparent
    );
    transform: translateX(-150%) skewX(-18deg);
    animation: shine var(--load-cycle) ease-in-out infinite;
}
.sparkle {
    position: absolute;
    right: -0.55em;
    top: -0.6em;
    width: 1.1em;
    height: 1.1em;
    background: var(--load-accent);
    /* A four-pointed star. */
    clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%);
    opacity: 0;
    animation: sparkle var(--load-cycle) ease-out infinite;
}
.label {
    font-size: 0.75em;
    letter-spacing: 0.04em;
    opacity: 0.7;
}
/*
 * One cycle, in steps: gather the slides (0–12 %), set title, image and lines
 * (8–42 %), polish (46–66 %), hold, let it all go (86–96 %) and start over.
 */
@keyframes card-back {
    0% {
        opacity: 0;
        transform: translate(1.4em, -0.1em);
    }
    10%,
    86% {
        opacity: 1;
        transform: translate(0.5em, -0.5em);
    }
    96%,
    100% {
        opacity: 0;
        transform: translate(0.5em, -0.5em);
    }
}
@keyframes card-mid {
    0%,
    4% {
        opacity: 0;
        transform: translate(1.4em, 0.1em);
    }
    14%,
    86% {
        opacity: 1;
        transform: translate(0.25em, -0.25em);
    }
    96%,
    100% {
        opacity: 0;
        transform: translate(0.25em, -0.25em);
    }
}
@keyframes piece-title {
    0%,
    10% {
        opacity: 0;
        transform: scaleX(0);
    }
    18%,
    86% {
        opacity: 1;
        transform: scaleX(1);
    }
    96%,
    100% {
        opacity: 0;
        transform: scaleX(1);
    }
}
@keyframes piece-image {
    0%,
    18% {
        opacity: 0;
        transform: translateY(0.3em) scale(0.85);
    }
    28%,
    86% {
        opacity: 1;
        transform: none;
    }
    96%,
    100% {
        opacity: 0;
        transform: none;
    }
}
@keyframes piece-line-1 {
    0%,
    24% {
        opacity: 0;
        transform: scaleX(0);
    }
    32%,
    86% {
        opacity: 1;
        transform: scaleX(1);
    }
    96%,
    100% {
        opacity: 0;
        transform: scaleX(1);
    }
}
@keyframes piece-line-2 {
    0%,
    29% {
        opacity: 0;
        transform: scaleX(0);
    }
    37%,
    86% {
        opacity: 1;
        transform: scaleX(1);
    }
    96%,
    100% {
        opacity: 0;
        transform: scaleX(1);
    }
}
@keyframes piece-line-3 {
    0%,
    34% {
        opacity: 0;
        transform: scaleX(0);
    }
    42%,
    86% {
        opacity: 1;
        transform: scaleX(1);
    }
    96%,
    100% {
        opacity: 0;
        transform: scaleX(1);
    }
}
@keyframes shine {
    0%,
    46% {
        transform: translateX(-150%) skewX(-18deg);
    }
    64%,
    100% {
        transform: translateX(420%) skewX(-18deg);
    }
}
@keyframes sparkle {
    0%,
    58% {
        opacity: 0;
        transform: scale(0) rotate(0deg);
    }
    64% {
        opacity: 1;
        transform: scale(1) rotate(45deg);
    }
    76%,
    100% {
        opacity: 0;
        transform: scale(0.2) rotate(90deg);
    }
}
@keyframes loading-in {
    from {
        opacity: 0;
    }
}
/* Less motion: the finished slide stands still. */
@media (prefers-reduced-motion: reduce) {
    .loading-inner,
    .card,
    .piece,
    .shine,
    .sparkle {
        animation: none;
    }
    .card-back {
        transform: translate(0.5em, -0.5em);
    }
    .card-mid {
        transform: translate(0.25em, -0.25em);
    }
}
.message,
.stage-message {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 5vw;
    color: #ccc;
    font: 400 clamp(16px, 2.5vw, 48px) / 1.3 system-ui, sans-serif;
    text-align: center;
}
.stage-message {
    font-size: 48px;
}
.stale {
    position: absolute;
    right: 12px;
    bottom: 12px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #d97706;
    opacity: 0.7;
}
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.8s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
