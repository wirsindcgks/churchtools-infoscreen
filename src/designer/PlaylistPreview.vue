<script setup lang="ts">
/**
 * The playlist as the TV would show it – from the unsaved draft, full
 * screen: the player's own rotation, paged lists, cross-fades and live
 * appointments. Nothing is saved; closing returns to the editor where it was.
 * Unlike a TV it can hold a slide and step through them.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import type { Banner, SlideDoc } from '../model/schema';
import { bannerShown } from '../player/banner';
import BannerView from '../player/BannerView.vue';
import { provideStageContext, useStageContext, type StageContext } from '../player/context';
import { slideSeconds } from '../player/paging';
import { useRotation } from '../player/rotation';
import SlideView from '../player/SlideView.vue';
import { fitStage } from '../player/stage';
import StageView from '../player/StageView.vue';
import Icon from './Icon.vue';

const props = defineProps<{
    slides: SlideDoc[];
    stage: { width: number; height: number };
    startSlideId?: string;
    /** The playlist's band, as the TV shows it over every slide (Plan.md 32). */
    banner?: Banner | null;
}>();
const emit = defineEmits<{ close: [] }>();

/** The editor's live data – time, appointments, media – with pages that really turn. */
const parent = useStageContext();
const paused = ref(false);
const context = reactive<StageContext>({
    get now() {
        return parent.now;
    },
    get timeZone() {
        return parent.timeZone;
    },
    clockConfirmed: true,
    get churchName() {
        return parent.churchName;
    },
    get churchLogo() {
        return parent.churchLogo;
    },
    get appointments() {
        return parent.appointments;
    },
    get media() {
        return parent.media;
    },
    // The theme too: accent, corners and layouts as on the TV (Plan.md, 27).
    get theme() {
        return parent.theme;
    },
    pages: {},
    get paging() {
        return !paused.value;
    },
});
provideStageContext(context);

/** Only what the TV shows: switched-off slides are left out, as there. */
const shown = computed(() => props.slides.filter((s) => s.enabled));
const rotation = useRotation(shown, () => context.pages ?? {});
const { current, index } = rotation;
watch(paused, (value) => rotation.setPaused(value));

const seconds = computed(() => (current.value ? slideSeconds(current.value, context.pages ?? {}) : 0));

const viewport = reactive({ width: window.innerWidth, height: window.innerHeight });
const fit = computed(() => fitStage(viewport, props.stage));
function onResize(): void {
    viewport.width = window.innerWidth;
    viewport.height = window.innerHeight;
}

/** The controls step aside while the preview runs untouched, like on a TV. */
const idle = ref(false);
let idleTimer: ReturnType<typeof setTimeout> | undefined;
function wake(): void {
    idle.value = false;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => (idle.value = true), 2500);
}

function onKey(event: KeyboardEvent): void {
    // The editor's keys must not reach the slide behind the preview.
    event.stopPropagation();
    wake();
    if (event.key === 'Escape') emit('close');
    else if (event.key === 'ArrowRight') rotation.step(1);
    else if (event.key === 'ArrowLeft') rotation.step(-1);
    else if (event.key === ' ') {
        event.preventDefault();
        paused.value = !paused.value;
    } else return;
    event.preventDefault();
}

onMounted(() => {
    const start = shown.value.findIndex((s) => s.id === props.startSlideId);
    index.value = Math.max(0, start);
    rotation.scheduleNext();
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey, true);
    wake();
});
onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKey, true);
    clearTimeout(idleTimer);
});
</script>

<template>
    <div
        class="preview"
        :class="{ idle }"
        role="dialog"
        aria-modal="true"
        aria-label="Vorschau der Playlist"
        data-testid="playlist-preview"
        @pointermove="wake"
    >
        <StageView :width="stage.width" :height="stage.height" :fit="fit">
            <Transition name="fade">
                <SlideView v-if="current" :key="current.id" :slide="current" :width="stage.width" :height="stage.height" />
            </Transition>
            <p v-if="!current" class="stage-message">Diese Playlist enthält keine aktive Slide.</p>
            <BannerView v-if="bannerShown(banner, parent.now, parent.timeZone)" :banner="banner!" :stage-width="stage.width" />
        </StageView>

        <div class="controls" data-testid="preview-controls">
            <span class="badge">Vorschau – nicht gespeichert</span>
            <button type="button" aria-label="Vorige Slide" title="Vorige Slide (←)" @click="rotation.step(-1)">
                <Icon name="back" />
            </button>
            <button
                type="button"
                :aria-label="paused ? 'Weiter abspielen' : 'Anhalten'"
                :title="paused ? 'Weiter abspielen (Leertaste)' : 'Anhalten (Leertaste)'"
                data-testid="preview-pause"
                @click="paused = !paused"
            >
                <Icon :name="paused ? 'play' : 'pause'" />
            </button>
            <button
                type="button"
                aria-label="Nächste Slide"
                title="Nächste Slide (→)"
                data-testid="preview-next"
                @click="rotation.step(1)"
            >
                <Icon name="forward" />
            </button>
            <span v-if="current" class="where" data-testid="preview-where">
                {{ (index % shown.length) + 1 }}/{{ shown.length }} · {{ current.name }} · {{ seconds }} s{{ paused ? ' · angehalten' : '' }}
            </span>
            <button type="button" class="close" title="Vorschau schließen (Esc)" data-testid="preview-close" @click="emit('close')">
                <Icon name="close" /> Schließen
            </button>
        </div>
    </div>
</template>

<style scoped>
.preview {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: #000;
}
.stage-message {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    color: #ccc;
    font: 400 32px/1.3 system-ui, sans-serif;
}
.controls {
    position: absolute;
    left: 50%;
    bottom: 20px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 6px;
    max-width: calc(100% - 32px);
    padding: 6px 10px;
    border-radius: 999px;
    background: rgb(15 23 42 / 0.82);
    color: #fff;
    font: 400 14px/1.3 system-ui, sans-serif;
    transform: translateX(-50%);
    transition: opacity 0.3s ease;
}
/* Untouched for a moment: the controls fade out, the preview looks like the TV. */
.idle .controls {
    opacity: 0;
}
.idle {
    cursor: none;
}
.controls button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 36px;
    min-height: 36px;
    justify-content: center;
    padding: 0 8px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
}
.controls button:hover,
.controls button:focus-visible {
    background: rgb(255 255 255 / 0.15);
}
.badge {
    padding: 2px 10px;
    border-radius: 999px;
    background: #f59e0b;
    color: #111;
    font-weight: 700;
    white-space: nowrap;
}
.where {
    padding: 0 6px;
    opacity: 0.85;
    white-space: nowrap;
}
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.8s ease; /* as on the TV */
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
