<script setup lang="ts">
/**
 * The reading mode of the phone page (Plan.md 138): the sheet of the running song with text and chords to read along, e.g. on an iPad on the music stand.
 * All parts stand below each other, the running one in full colour, the others pale; it follows the running part. Nothing here switches the screen.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { lineSegments, type SheetSection } from '../agenda/songsheet';
import Icon from '../designer/Icon.vue';
import { t } from '../i18n/designer';
import { isAway, readScale, scaleSteps, writeScale } from './reader-scale';

const props = defineProps<{
    /** `null` – no song runs. */
    title: string | null;
    songKey?: string;
    parts: SheetSection[];
    /** The part the screen shows; without one the first part counts as running. */
    active: number | null;
}>();

const scroller = useTemplateRef<HTMLElement>('scroller');
const scaleIndex = ref(readScale());
const scale = computed(() => scaleSteps[scaleIndex.value]!);
const running = computed(() => (props.parts.length ? Math.min(props.active ?? 0, props.parts.length - 1) : null));
/** Parts in the flow first, the ones outside it behind them (as in the sheet). */
const order = computed(() => {
    const all = props.parts.map((part, n) => ({ part, n }));
    return [...all.filter((e) => !e.part.extra), ...all.filter((e) => e.part.extra)];
});
/** The part the reader follows: its element, found by number. */
function runningElement(): HTMLElement | null {
    return running.value === null ? null : (scroller.value?.querySelector<HTMLElement>(`[data-part="${running.value}"]`) ?? null);
}

const smooth = () => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function toRunning(animated: boolean): void {
    rest(animated);
    runningElement()?.scrollIntoView?.({ block: 'start', behavior: animated && smooth() ? 'smooth' : 'auto' });
}

/** Whether the start of the running part is out of the reading area; where nothing is laid out (tests) it never is. */
const away = ref(false);
let settle: ReturnType<typeof setTimeout> | undefined;
let settling = false;
let resize: ResizeObserver | undefined;
function measure(): void {
    const box = scroller.value;
    const el = runningElement();
    if (settling || !box || !el) return;
    const rect = box.getBoundingClientRect();
    if (rect.height === 0) {
        away.value = false;
        return;
    }
    const style = getComputedStyle(box);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.35;
    away.value = isAway(el.getBoundingClientRect().top, rect.top, rect.bottom, lineHeight);
}
/** The automatic roll is no reason for the pill: it waits until the roll has come to rest. */
function rest(animated: boolean): void {
    away.value = false;
    settling = true;
    clearTimeout(settle);
    settle = setTimeout(
        () => {
            settling = false;
            measure();
        },
        animated ? 700 : 50,
    );
}
function observe(): void {
    away.value = false;
    resize?.disconnect();
    if (scroller.value && typeof ResizeObserver !== 'undefined') {
        resize = new ResizeObserver(measure);
        resize.observe(scroller.value);
    }
}

watch(running, async () => {
    await nextTick();
    toRunning(true);
    observe();
});
// A new song brings its running part to the top as well.
watch(
    () => props.parts,
    async () => {
        await nextTick();
        toRunning(false);
        observe();
    },
);
onMounted(async () => {
    await nextTick();
    toRunning(false);
    observe();
});
onBeforeUnmount(() => {
    resize?.disconnect();
    clearTimeout(settle);
});

async function step(by: number): Promise<void> {
    scaleIndex.value = Math.min(scaleSteps.length - 1, Math.max(0, scaleIndex.value + by));
    writeScale(scaleIndex.value);
    await nextTick();
    toRunning(false);
}
</script>

<template>
    <section class="reader" data-testid="control-reader">
        <header class="reader-head">
            <h2 class="reader-title" data-testid="song-title">{{ title ?? t.control.readerNoSong }}</h2>
            <span v-if="title !== null && songKey" class="reader-key" data-testid="song-key">{{ songKey }}</span>
            <span class="reader-gap" />
            <template v-if="title !== null && parts.length">
                <button type="button" class="size" :aria-label="t.control.readerSmaller" :disabled="scaleIndex === 0" data-testid="reader-smaller" @click="step(-1)"><Icon name="minus" :size="22" /></button>
                <button type="button" class="size" :aria-label="t.control.readerLarger" :disabled="scaleIndex === scaleSteps.length - 1" data-testid="reader-larger" @click="step(1)"><Icon name="plus" :size="22" /></button>
            </template>
        </header>
        <p v-if="title !== null && !parts.length" class="none" data-testid="reader-none">{{ t.control.readerNone }}</p>
        <div v-else-if="title !== null" class="body">
            <div ref="scroller" class="scroller" :style="{ '--reader-scale': scale }" data-testid="reader-scroller" @scroll.passive="measure">
                <section
                    v-for="{ part, n } in order"
                    :key="n"
                    class="part"
                    :class="{ running: running === n, pale: running !== n }"
                    :data-part="n"
                    :aria-current="running === n ? 'true' : undefined"
                    data-testid="reader-part"
                >
                    <div v-if="part.label" class="label">{{ part.label }}</div>
                    <div v-for="(line, l) in part.lines" :key="l" class="line">
                        <template v-if="!line.chords.length">{{ line.text }}</template>
                        <span v-for="(segment, g) in lineSegments(line)" v-else :key="g" class="segment">
                            <span class="chord" data-testid="reader-chord">{{ segment.chord ?? ' ' }}</span>
                            <span class="syllable">{{ segment.text }}</span>
                        </span>
                    </div>
                </section>
            </div>
            <button v-if="away" type="button" class="follow" data-testid="reader-follow" @click="toRunning(true)">{{ t.control.readerFollow }}</button>
        </div>
    </section>
</template>

<style scoped>
.reader {
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
}
.reader-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 12px;
}
.reader-title {
    flex: 0 1 auto;
    min-width: 0;
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    line-height: 1.2;
    color: #f2f2f2;
    overflow-wrap: anywhere;
}
.reader-key {
    flex: none;
    color: #8b919c;
    font-variant-numeric: tabular-nums;
}
.reader-key::before {
    content: '· ';
}
.reader-gap {
    flex: 1;
}
/* Flat 44 × 44 like the magnifier. */
.size {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: #1b1e25;
    color: #f1f2f4;
    cursor: pointer;
}
.size:disabled {
    opacity: 0.4;
}
.none {
    margin: 0;
    color: #b8bcc4;
}
.body {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
}
.scroller {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    /* Room below, so that the last parts too can come to the top. */
    padding-bottom: 50%;
    /* Lines stay readable on a wide screen (relative to its own font). */
    max-width: 46em;
    font-size: calc(clamp(20px, 2.6vw + 10px, 32px) * var(--reader-scale, 1));
    line-height: 1.35;
    color: #f1f2f4;
}
.part {
    margin-bottom: 1em;
    transition: opacity 0.2s;
}
.part.pale {
    opacity: 0.4;
}
.label {
    margin-bottom: 0.2em;
    font-size: 0.55em;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.7;
}
.line {
    display: flex;
    flex-wrap: wrap;
    white-space: pre-wrap;
}
.segment {
    display: inline-flex;
    flex-direction: column;
    vertical-align: bottom;
}
.chord {
    padding-right: 0.4em;
    font-size: 0.8em;
    font-weight: 600;
    line-height: 1.1;
    white-space: pre;
    color: #8ab4ff;
}
.syllable {
    min-height: 1.25em;
    white-space: pre;
}
.follow {
    position: absolute;
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    min-height: 44px;
    padding: 0 18px;
    border: 1px solid #6b7180;
    border-radius: 999px;
    background: #1d2027;
    color: #f1f2f4;
    font: inherit;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
}
@media (prefers-reduced-motion: reduce) {
    .part {
        transition: none;
    }
}
</style>
