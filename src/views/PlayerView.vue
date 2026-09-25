<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue';
import { useRoute } from 'vue-router';
import { enableTokenLogin } from '../ct/client';
import type { MediaDoc, SlideDoc } from '../model/schema';
import { imageSource, provideStageContext, type StageContext } from '../player/context';
import { browserDeps, createPlayer } from '../player/controller';
import { createChurchToolsPlayerData } from '../player/data';
import {
    readDeviceLogin,
    rememberDeviceLogin,
    rememberedDeviceLogin,
    withDeviceLogin,
    withoutDeviceLogin,
} from '../player/device-login';
import { screenImageUrls, slideImageUrls } from '../player/images';
import { createMediaCache } from '../player/media-cache';
import { createPreloader } from '../player/preload';
import { useRotation } from '../player/rotation';
import { activePlaylistId } from '../player/schedule';
import { fitStage } from '../player/stage';
import SlideView from '../player/SlideView.vue';
import { onStoreChanged } from '../store/backend';
import StageView from '../player/StageView.vue';

const route = useRoute();
const slug = typeof route.query.screen === 'string' ? route.query.screen : null;

// Way B: the token sits in the fragment – ChurchTools has taken it out of the query, if it signed in (G9) –
// or, after the player has tidied the address, in the tab's session storage.
const login = readDeviceLogin(new URL(window.location.href)) ?? rememberedDeviceLogin();
if (login) {
    enableTokenLogin(login);
    rememberDeviceLogin(login);
    // Off the address bar, off photos and screenshots. It stays in the kiosk configuration and the history.
    window.history.replaceState(window.history.state, '', withoutDeviceLogin(window.location.href));
}

const player = slug
    ? createPlayer(slug, createChurchToolsPlayerData(login), {
          ...browserDeps,
          // A plain reload would load the address without the token – after 24 hours (G32) the page without our script.
          reload: () =>
              login ? window.location.replace(withDeviceLogin(window.location.href, login)) : window.location.reload(),
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
    media: new Map<string, MediaDoc>(),
    images: new Map<string, string>(),
    pages: {},
    paging: true,
});
provideStageContext(context);

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
        ([state.timeZone, state.clockConfirmed, state.churchName, state.churchLogo, state.appointments, state.screen] as const),
    () => {
        if (!state) return;
        context.timeZone = state.timeZone;
        context.clockConfirmed = state.clockConfirmed;
        context.churchName = state.churchName;
        context.churchLogo = state.churchLogo;
        context.appointments = state.appointments;
        context.media = new Map((state.screen?.media ?? []).map((m) => [m.id, m]));
    },
    { immediate: true },
);

const slides = computed<SlideDoc[]>(() => {
    const loaded = state?.screen;
    if (!loaded) return [];
    const playlistId = activePlaylistId(loaded.screen, {
        now: context.now,
        timeZone: context.timeZone,
        clockConfirmed: context.clockConfirmed,
        appointments: context.appointments,
    });
    const playlist =
        loaded.playlists.find((p) => p.id === playlistId) ??
        loaded.playlists.find((p) => p.id === loaded.screen.defaultPlaylistId);
    const byId = new Map(loaded.slides.map((s) => [s.id, s]));
    return (playlist?.slideIds ?? []).map((id) => byId.get(id)).filter((s): s is SlideDoc => !!s && s.enabled);
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
            instead of showing the wrong playlist. The hourglass turns by a CSS transform
            only: the compositor moves one layer, nothing is painted again, and it is gone
            once the screen shows.
        -->
        <div v-else-if="!state || state.phase === 'loading'" class="message loading" data-testid="player-loading">
            <svg class="hourglass" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 2h12M6 22h12M7 2c0 5 5 7 5 10s-5 5-5 10M17 2c0 5-5 7-5 10s5 5 5 10" />
                <path class="sand" d="M9.5 19.5h5l-2.5-3z" />
            </svg>
            <span>Lade „{{ slug }}“ …</span>
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
.loading {
    flex-direction: column;
    gap: 0.6em;
}
.hourglass {
    width: 2.2em;
    height: 2.2em;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    animation: hourglass-turn 2.4s ease-in-out infinite;
}
.hourglass .sand {
    fill: currentColor;
    stroke: none;
    opacity: 0.8;
}
/* Rest, then turn over – like a real one. Transform only: no layout, no repaint. */
@keyframes hourglass-turn {
    0%,
    60% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(180deg);
    }
}
@media (prefers-reduced-motion: reduce) {
    .hourglass {
        animation: none;
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
