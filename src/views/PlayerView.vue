<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue';
import { useRoute } from 'vue-router';
import { enableTokenLogin } from '../ct/client';
import type { MediaDoc, SlideDoc } from '../model/schema';
import { imageSource, provideStageContext, type StageContext } from '../player/context';
import { browserDeps, createPlayer } from '../player/controller';
import { createChurchToolsPlayerData } from '../player/data';
import { readDeviceLogin, reloadWithDeviceLogin, withDeviceLogin } from '../player/device-login';
import { screenImageUrls, slideImageUrls } from '../player/images';
import { createMediaCache } from '../player/media-cache';
import { createPreloader } from '../player/preload';
import { useRotation } from '../player/rotation';
import { activePlaylistId } from '../player/schedule';
import { registerPlayerServiceWorker } from '../player/service-worker';
import { fitStage } from '../player/stage';
import { loadingVars } from '../player/theme';
import { bannerShown } from '../player/banner';
import BannerView from '../player/BannerView.vue';
import SlideView from '../player/SlideView.vue';
import { onStoreChanged } from '../store/backend';
import StageView from '../player/StageView.vue';

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
    rooms: [],
    media: new Map<string, MediaDoc>(),
    images: new Map<string, string>(),
    pages: {},
    paging: true,
});
provideStageContext(context);

// Once the player has shown something for the first time (Plan.md, 37; G10) – registering earlier would
// still leave a restart before that first success with the browser's error page, since nothing is cached
// yet. The designer never reaches this view, so it never registers.
let serviceWorkerRegistered = false;
watch(
    () => state?.phase,
    (phase) => {
        if (phase !== 'running' || serviceWorkerRegistered) return;
        serviceWorkerRegistered = true;
        registerPlayerServiceWorker(import.meta.env.BASE_URL);
    },
);

// Every loaded configuration – from the offline copy or fresh – brings its images onto the device,
// the church logo included: a new logo is a new address (G29).
const mediaCache = createMediaCache();
watch(
    () => state && ([state.screen, state.churchLogo] as const),
    async (current) => {
        const [loaded, churchLogo] = current ?? [];
        if (!loaded) return;
        const stage = loaded.screen.stage;
        context.images = await mediaCache.sync(screenImageUrls(loaded.slides, loaded.media, stage, churchLogo ?? null));
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
        context.rooms = state.rooms;
        context.media = new Map((state.screen?.media ?? []).map((m) => [m.id, m]));
        context.theme = state.screen?.theme ?? null;
    },
    { immediate: true },
);

const playlist = computed(() => {
    const loaded = state?.screen;
    if (!loaded) return null;
    const playlistId = activePlaylistId(loaded.screen, {
        now: context.now,
        timeZone: context.timeZone,
        clockConfirmed: context.clockConfirmed,
        appointments: context.appointments,
    });
    return (
        loaded.playlists.find((p) => p.id === playlistId) ??
        loaded.playlists.find((p) => p.id === loaded.screen.defaultPlaylistId) ??
        null
    );
});

const slides = computed<SlideDoc[]>(() => {
    const loaded = state?.screen;
    if (!loaded || !playlist.value) return [];
    const byId = new Map(loaded.slides.map((s) => [s.id, s]));
    return playlist.value.slideIds.map((id) => byId.get(id)).filter((s): s is SlideDoc => !!s && s.enabled);
});

/** The playlist's band (Plan.md 32), until its time is up. */
const banner = computed(() => {
    const band = playlist.value?.banner;
    return bannerShown(band, context.now, context.timeZone) ? band : null;
});

const { index, current, scheduleNext } = useRotation(slides, () => context.pages ?? {});

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
function onResize(): void {
    viewport.width = window.innerWidth;
    viewport.height = window.innerHeight;
}

let ticker: ReturnType<typeof setInterval> | undefined;
let unsubscribe: () => void = () => {};
onMounted(() => {
    window.addEventListener('resize', onResize);
    ticker = setInterval(() => (context.now = new Date()), 1000);
    scheduleNext();
    void player?.start();
    if (player) unsubscribe = onStoreChanged(player.refreshNow);
});
onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize);
    clearInterval(ticker);
    player?.stop();
    unsubscribe();
});
</script>

<template>
    <!-- Covers the ChurchTools chrome without touching it (G6). -->
    <div class="player" data-testid="player">
        <p v-if="!slug" class="message" role="alert">Kein Screen angegeben (Parameter „screen" fehlt).</p>
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
                <p v-if="!current" class="stage-message">Diese Playlist enthält keine aktive Slide.</p>
                <BannerView v-if="banner" :banner="banner" :stage-width="stage.width" />
            </StageView>
            <!-- Old content with a discreet marker beats a black screen. -->
            <span v-if="state.staleSince" class="stale" data-testid="stale" title="Keine Verbindung zu ChurchTools" />
        </template>
    </div>
</template>

<style scoped>
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
