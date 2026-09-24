<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { enableTokenLogin } from '../ct/client';
import type { MediaDoc, SlideDoc } from '../model/schema';
import { provideStageContext, type StageContext } from '../player/context';
import { createPlayer } from '../player/controller';
import { churchToolsPlayerData } from '../player/data';
import { activePlaylistId } from '../player/schedule';
import { fitStage } from '../player/stage';
import SlideView from '../player/SlideView.vue';
import StageView from '../player/StageView.vue';

const route = useRoute();
const slug = typeof route.query.screen === 'string' ? route.query.screen : null;

const token = route.query.login_token;
const personId = Number(route.query.user_id);
if (typeof token === 'string' && Number.isInteger(personId)) enableTokenLogin(token, personId);

const player = slug ? createPlayer(slug, churchToolsPlayerData) : null;
const state = player?.state;

const context = reactive<StageContext>({
    now: new Date(),
    timeZone: 'UTC',
    clockConfirmed: false,
    churchName: '',
    appointments: [],
    media: new Map<string, MediaDoc>(),
});
provideStageContext(context);

watch(
    () => state && [state.timeZone, state.clockConfirmed, state.churchName, state.appointments, state.screen] as const,
    () => {
        if (!state) return;
        context.timeZone = state.timeZone;
        context.clockConfirmed = state.clockConfirmed;
        context.churchName = state.churchName;
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

let rotation: ReturnType<typeof setTimeout> | undefined;
function scheduleNext(): void {
    clearTimeout(rotation);
    const seconds = current.value?.durationSeconds ?? 10;
    rotation = setTimeout(() => {
        index.value = slides.value.length ? (index.value + 1) % slides.value.length : 0;
        scheduleNext();
    }, seconds * 1000);
}
// A new playlist starts from its first slide.
watch(
    () => slides.value.map((s) => s.id).join(),
    () => {
        index.value = 0;
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
onMounted(() => {
    window.addEventListener('resize', onResize);
    ticker = setInterval(() => (context.now = new Date()), 1000);
    scheduleNext();
    void player?.start();
});
onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize);
    clearInterval(ticker);
    clearTimeout(rotation);
    player?.stop();
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
