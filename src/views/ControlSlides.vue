<script setup lang="ts">
/**
 * The slides of a presentation at the click on the phone page (Plan.md 124 D, 135 C): back, forward, a slide to tap (no "Schwarz" on the phone since Plan.md 137 C; a screen that is black – set at its device – says so). A click is
 * written as a value per screen into `steuerung` (the player reads it), the screen reports where it stands into `status` (the page reads
 * it and hands it over). The own click shows at once and holds until the screen reports it.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';
import { t } from '../i18n/designer';
import { usePresenterKeys } from '../player/presenter-keys';
import type { ClickPosition } from '../model/position';
import type { ScreenRepository } from '../store/screen-repository';
import ControlBar from './ControlBar.vue';
import { buildClick, createQueue, movedSlide, OPTIMISTIC_MAX_MS, positionSettled } from './click-steering';
import ControlNow from './ControlNow.vue';
import { lastClickText } from './monitor-state';

const props = defineProps<{
    repository: ScreenRepository;
    author: string;
    screenId: string;
    position: ClickPosition;
    /** The time of the last reading, which changes with every one: a reading that brings the same position still settles the own click. */
    readAt: number;
}>();
/** `clicked` – the page reads faster for a while. */
const emit = defineEmits<{ clicked: [] }>();

const notSaved = ref(false);
/** A second of its own for "vor 5 s". */
const tick = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | undefined;
const enqueue = createQueue();

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
    const over = pending.value;
    return over ? { ...props.position, slideId: over.slideId, number: over.number, black: over.black } : { ...props.position, black: !!props.position.black };
});
const lastClick = computed(() => {
    const over = pending.value;
    if (over) return { by: props.author || null, at: over.at };
    return props.position.clickAt ? { by: props.position.by ?? null, at: Date.parse(props.position.clickAt) } : null;
});
/** The "Jetzt" row (Plan.md 137 B): the running slide by its name or its number, and where it stands. */
const now = computed(() => {
    const id = shown.value.slideId;
    const at = shown.value.slides.findIndex((s) => s.id === id);
    // A screen that is black (set at its device) says so; a click on "Vor" lifts it (Plan.md 137 C).
    return { title: shown.value.black ? t.control.nowBlack : shown.value.slides[at]?.name || t.control.slideNumber(shown.value.number), number: shown.value.number, total: shown.value.total };
});
const lastText = computed(() => (lastClick.value ? lastClickText(lastClick.value.by, lastClick.value.at, tick.value) : null));

// A reading came in: the own click may be confirmed or too old to hold.
watch(
    () => [props.position, props.readAt],
    () => {
        const over = pending.value;
        if (over && (positionSettled(props.position, over.seq) || Date.now() - over.at > OPTIMISTIC_MAX_MS)) pending.value = null;
    },
);
// Another screen: the click of the one before does not hold.
watch(
    () => props.screenId,
    () => {
        pending.value = null;
        notSaved.value = false;
    },
);

/** What "Vor" leads to: the name of the next slide, where the phone knows one. */
const forwardHint = computed(() => {
    const id = shown.value.black ? null : movedSlide(shown.value, 1);
    return id ? (shown.value.slides.find((s) => s.id === id)?.name ?? '') : '';
});

/** Writes the click value of the screen: reads it first, adds the action, writes it – one after the other (`enqueue`), so that no `seq` is given twice. */
function sendClick(action: { do: 'next' | 'previous' } | { do: 'goto'; slideId: string }, over: Omit<Pending, 'token' | 'seq' | 'at'>): void {
    const p = props.position;
    const id = props.screenId;
    const mine = ++token;
    pending.value = { ...over, token: mine, seq: null, at: Date.now() };
    notSaved.value = false;
    const at = new Date().toISOString();
    emit('clicked');
    void enqueue(async () => {
        const current = await props.repository.readClick(id);
        const doc = buildClick(current, { screenId: id, playlistId: p.playlistId, action, at, by: props.author || undefined });
        await props.repository.writeClick(doc);
        return doc.actions[doc.actions.length - 1]!.seq;
    }).then(
        (seq) => {
            if (pending.value?.token === mine) pending.value = { ...pending.value, seq };
            // A reading that came in between may already have caught up.
            if (pending.value?.token === mine && positionSettled(props.position, seq)) pending.value = null;
            emit('clicked');
        },
        (error) => {
            console.warn('Der Klick konnte nicht gespeichert werden:', error);
            if (pending.value?.token === mine) pending.value = null;
            notSaved.value = true;
        },
    );
}

/** The own display after a click: the slide it moves to (`null` = it stays) and black. */
function after(step: { do: 'next' | 'previous' } | { do: 'goto'; slideId: string }): Omit<Pending, 'token' | 'seq' | 'at'> {
    const now = shown.value;
    // A click while black only lifts the black (as in a slide show program).
    if (now.black) return { slideId: now.slideId, number: now.number, black: false };
    if (step.do === 'goto') {
        const at = now.slides.findIndex((s) => s.id === step.slideId);
        return at < 0 ? { slideId: now.slideId, number: now.number, black: false } : { slideId: step.slideId, number: at + 1, black: false };
    }
    const by = step.do === 'next' ? 1 : -1;
    const target = movedSlide(now, by);
    // At the ends nothing moves in the display – the player stays there, unless a block on the slide still has a page (the phone cannot know).
    if (target === null) return { slideId: now.slideId, number: now.number, black: false };
    return { slideId: target, number: now.slides.findIndex((s) => s.id === target) + 1, black: false };
}

function step(by: 1 | -1): void {
    const action = { do: by === 1 ? ('next' as const) : ('previous' as const) };
    sendClick(action, after(action));
}

function goto(slideId: string): void {
    const action = { do: 'goto' as const, slideId };
    sendClick(action, after(action));
}

const presenter = usePresenterKeys(step);

// The running slide stays in view when the list rolls (Plan.md 135).
const list = useTemplateRef<HTMLElement>('list');
watch(
    () => shown.value.slideId,
    async () => {
        await nextTick();
        list.value?.querySelector('.active')?.scrollIntoView?.({ block: 'nearest' });
    },
    { immediate: true },
);

onMounted(() => (ticker = setInterval(() => (tick.value = Date.now()), 1000)));
onBeforeUnmount(() => clearInterval(ticker));
</script>

<template>
    <div class="slides" data-testid="control-slides">
        <p v-if="notSaved" class="warn" role="alert">{{ t.control.notSaved }}</p>
        <ControlNow :title="now.title" :number="now.number" :total="now.total" />
        <p v-if="lastText" class="last" data-testid="slides-last">{{ lastText }}</p>
        <ul ref="list" class="slide-list" data-testid="slide-list">
            <li v-for="(s, i) in shown.slides" :key="s.id">
                <button
                    type="button"
                    :class="{ active: s.id === shown.slideId, played: i + 1 < shown.number }"
                    :aria-current="s.id === shown.slideId"
                    @click="goto(s.id)"
                >
                    <span class="n">{{ i + 1 }}</span>{{ s.name || t.control.slideNumber(i + 1) }}
                </button>
            </li>
        </ul>
        <p v-if="presenter" class="note" data-testid="slides-presenter">{{ t.control.presenterDetected }}</p>
        <!-- In the fixed zone below the middle of the page (Plan.md 135 A). -->
        <Teleport defer to="#control-bar">
            <ControlBar :back-disabled="false" :forward-disabled="false" :hint="forwardHint" @back="step(-1)" @forward="step(1)" />
        </Teleport>
    </div>
</template>

<style scoped>
/* The middle is a column: the list takes what is left and rolls inside (Plan.md 137 B). */
.slides {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.slides > * {
    flex: none;
    min-width: 0;
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
/* Right under the "Jetzt" row, closer to it than to the list. */
.last {
    margin-top: -8px;
    font-size: 13px;
    color: #8b919c;
}
.slide-list {
    flex: 1 1 0;
    min-height: 9rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    align-content: start;
    gap: 4px;
}
button {
    display: flex;
    align-items: center;
    gap: 14px;
    box-sizing: border-box;
    width: 100%;
    min-height: 52px;
    padding: 0 14px;
    border: 0;
    border-radius: 12px;
    background: #1b1e25;
    color: inherit;
    font: inherit;
    font-size: 17px;
    text-align: left;
    cursor: pointer;
}
.n {
    flex: none;
    width: 18px;
    color: #8b919c;
    font-variant-numeric: tabular-nums;
}
/* Played: no background, pale – the slides before the running one. */
button.played {
    background: none;
    color: #8b919c;
}
button.active {
    min-height: 58px;
    background: #2f6fed;
    font-size: 18px;
    font-weight: 600;
}
button.active .n {
    color: inherit;
}
</style>
