<script setup lang="ts">
/**
 * The tour behind the card "Neu hier?" (Plan.md 81): a ring around one place of the editor, the rest of the page
 * dimmed, and a speech bubble beside it. It opens and changes nothing; a place that is missing is skipped. Escape
 * and × close it (Escape is taken in the editor's `onKey`, where the keys belong to the open tour), a click beside
 * does nothing. The focus starts on "Weiter" and returns to where it was.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from '../i18n/designer';
import Icon from './Icon.vue';
import { INTRO_STEPS, bubblePlace, firstVisible, type Box, type IntroStepId } from './intro';

const props = defineProps<{ drafts: boolean }>();
const emit = defineEmits<{ close: [] }>();

const PAD = 4;
const viewport = ref({ width: window.innerWidth, height: window.innerHeight });
const steps = ref<{ id: IntroStepId; el: HTMLElement }[]>([]);
const index = ref(0);
const target = ref<Box | null>(null);
const bubble = ref<HTMLElement | null>(null);
const bubbleSize = ref({ width: 320, height: 160 });
const nextButton = ref<HTMLButtonElement | null>(null);
let before: HTMLElement | null = null;

function boxOf(el: Element): Box {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** The first visible place of every step; those without one drop out. */
function resolveSteps(): { id: IntroStepId; el: HTMLElement }[] {
    const size = { width: window.innerWidth, height: window.innerHeight };
    const found: { id: IntroStepId; el: HTMLElement }[] = [];
    for (const step of INTRO_STEPS) {
        const els = step.targets.map((selector) => document.querySelector<HTMLElement>(selector));
        const at = firstVisible(els.map((el) => (el ? boxOf(el) : null)), size);
        if (at >= 0 && els[at]) found.push({ id: step.id, el: els[at] as HTMLElement });
    }
    return found;
}

function measure(): void {
    viewport.value = { width: window.innerWidth, height: window.innerHeight };
    const el = steps.value[index.value]?.el;
    target.value = el && el.isConnected ? boxOf(el) : null;
    if (bubble.value) bubbleSize.value = { width: bubble.value.offsetWidth, height: bubble.value.offsetHeight };
}

function go(to: number): void {
    index.value = to;
    const el = steps.value[to]?.el;
    // A place scrolled out of sight is brought back; a fixed bar is not touched by this.
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    measure();
    void nextTick(measure);
}

onMounted(() => {
    before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    steps.value = resolveSteps();
    if (!steps.value.length) {
        emit('close');
        return;
    }
    go(0);
    nextButton.value?.focus();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
});
onBeforeUnmount(() => {
    window.removeEventListener('resize', measure);
    window.removeEventListener('scroll', measure, true);
    before?.focus();
});

const current = computed(() => steps.value[index.value]);
const last = computed(() => index.value === steps.value.length - 1);
const copy = computed(() => {
    const id = current.value?.id;
    if (!id) return null;
    const step = t.intro.steps[id];
    return { title: step.title, text: id === 'publish' && props.drafts ? t.intro.steps.publish.textDrafts : step.text };
});
const ring = computed(() =>
    target.value
        ? { left: `${target.value.left - PAD}px`, top: `${target.value.top - PAD}px`, width: `${target.value.width + 2 * PAD}px`, height: `${target.value.height + 2 * PAD}px` }
        : null,
);
const place = computed(() => {
    const spot = bubblePlace(target.value, bubbleSize.value, viewport.value);
    return { left: `${spot.left}px`, top: `${spot.top}px` };
});

function next(): void {
    if (last.value) emit('close');
    else go(index.value + 1);
}
</script>

<template>
    <div v-if="current && copy" class="intro-tour" role="dialog" aria-modal="true" aria-labelledby="intro-tour-title" :aria-label="t.intro.tourLabel" data-testid="intro-tour">
        <div v-if="ring" class="focus-ring" :style="ring" />
        <div v-else class="dim" />
        <div ref="bubble" class="bubble" :style="place">
            <button class="d-btn d-btn--icon d-btn--ghost close" type="button" :aria-label="t.intro.close" data-testid="intro-close" @click="emit('close')">
                <Icon name="close" :size="16" />
            </button>
            <p class="count" data-testid="intro-step">{{ t.intro.step(index + 1, steps.length) }}</p>
            <h2 id="intro-tour-title">{{ copy.title }}</h2>
            <p class="text">{{ copy.text }}</p>
            <div class="actions">
                <button class="d-btn" type="button" :disabled="index === 0" data-testid="intro-back" @click="go(index - 1)">{{ t.intro.back }}</button>
                <button ref="nextButton" class="d-btn d-btn--primary" type="button" data-testid="intro-next" @click="next">
                    {{ last ? t.intro.done : t.intro.next }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.intro-tour {
    position: fixed;
    inset: 0;
    z-index: 1100;
}
.focus-ring {
    position: fixed;
    box-sizing: border-box;
    border: 2px solid var(--d-accent);
    border-radius: var(--d-radius);
    box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.45);
    pointer-events: none;
}
.dim {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
}
.bubble {
    position: fixed;
    box-sizing: border-box;
    width: min(320px, calc(100vw - 16px));
    padding: var(--d-space-4);
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow);
}
.close {
    position: absolute;
    top: var(--d-space-2);
    right: var(--d-space-2);
}
.count {
    margin: 0 0 var(--d-space-1);
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
h2 {
    margin: 0 0 var(--d-space-2);
    font-size: 1.1em;
}
.text {
    margin: 0 0 var(--d-space-4);
}
.actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--d-space-2);
}
</style>
