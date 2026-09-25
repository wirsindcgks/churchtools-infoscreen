<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
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

const index = ref(0);
const current = computed(() => (slides.value.length ? slides.value[index.value % slides.value.length] : null));

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

let rotation: ReturnType<typeof setTimeout> | undefined;
function scheduleNext(): void {
    clearTimeout(rotation);
    const seconds = current.value?.durationSeconds ?? 10;
    rotation = setTimeout(() => {
        index.value = slides.value.length ? (index.value + 1) % slides.value.length : 0;
        scheduleNext();
    }, seconds * 1000);
}
// A changed duration applies at once, not only after the current slide has run out.
watch(
    () => current.value?.durationSeconds,
    () => scheduleNext(),
);
// After a change the player stays on the slide it shows; only if that slide is gone
// (or another playlist took over) does it start from the beginning.
// Compared as a string: the list is recomputed every second (it depends on the clock),
// and a new array each time must not count as a change – that would stall the rotation.
watch(
    () => slides.value.map((s) => s.id).join(','),
    (joined, previousJoined) => {
        const ids = joined ? joined.split(',') : [];
        const previous = previousJoined ? previousJoined.split(',') : [];
        const shown = previous[index.value % Math.max(previous.length, 1)];
        const position = shown ? ids.indexOf(shown) : -1;
        index.value = position >= 0 ? position : 0;
        scheduleNext();
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
    clearTimeout(rotation);
    player?.stop();
    unsubscribe();
});
</script>

<template>
    <!-- Covers the ChurchTools chrome without touching it (G6). -->
    <div class="player" data-testid="player">
        <p v-if="!slug" class="message" role="alert">Kein Screen angegeben (Parameter „screen" fehlt).</p>
        <p v-else-if="state?.phase === 'loading'" class="message">Lade „{{ slug }}" …</p>
        <p v-else-if="state?.phase === 'error'" class="message" role="alert">{{ state.error }}</p>
        <template v-else-if="state">
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
