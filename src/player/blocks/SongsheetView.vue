<script setup lang="ts">
/**
 * The block "Liedblatt" (schema 1.63, Plan.md 121 B): the text of the song that is running in the agenda, the chords above the syllable;
 * a song that is not running yet – the next one, or the first before the start – under "Als Nächstes". The head names title, key and
 * tempo, the foot keeps copyright and CCLI numbers (the licence of the church). What does not fit stands in columns, then in pages:
 * they are counted after the render (the width the columns take against the width of the block) and turn after the length of the
 * running song – by the time that passed since it began, or, without a duration, on a beat of its own. The agenda comes from `use-agenda.ts`, the choice of the song and the chords from `src/agenda/songsheet.ts`.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { UNTIMED_PAGE_SECONDS, lineSegments, sheetOf, sheetPage, songsheetPick } from '../../agenda/songsheet';
import type { Block } from '../../model/schema';
import { themeOf } from '../context';
import { textStyle } from '../format';
import { tp } from '../../i18n/player';
import PageProgress from './PageProgress.vue';
import { useAgenda } from './use-agenda';

const props = defineProps<{ block: Extract<Block, { type: 'songsheet' }>; slideSeconds?: number }>();
const { context, pick, display } = useAgenda(() => props.block);

// Every part is a computed of its own: the pick is made new each second, these keep their value (and so the render) while nothing changes.
const selected = computed(() => songsheetPick(pick.value));
const item = computed(() => selected.value?.item ?? null);
const songId = computed(() => selected.value?.id ?? '');
const upcoming = computed(() => selected.value?.upcoming ?? false);
const lengthSeconds = computed(() => selected.value?.lengthSeconds ?? null);
const sheet = computed(() => (item.value ? sheetOf(item.value) : null));
const showChords = computed(() => props.block.showChords);

/** Title · key · tempo; the key of the sheet is the one after transposing, else the one of the arrangement. */
const meta = computed(() => {
    const details = item.value?.songDetails;
    return [sheet.value?.key ?? details?.key, details?.bpm ? tp.agenda.bpm(details.bpm) : ''].filter(Boolean).join(' · ');
});

/** The lines to draw: without chords the lines that carry nothing else are left out (instrumental parts). */
const sections = computed(() =>
    (sheet.value?.sections ?? []).map((section) => ({
        label: section.label,
        lines: section.lines
            .filter((line) => showChords.value || line.text.trim() !== '')
            .map((line) => ({ plain: !showChords.value || !line.chords.length, text: line.text, segments: lineSegments(line) })),
    })).filter((section) => section.lines.length > 0),
);
const hasLines = computed(() => sections.value.length > 0);

// --- pages ---

const viewport = ref<HTMLElement | null>(null);
const columns = ref<HTMLElement | null>(null);
const pages = ref(1);
const pageWidth = ref(0);
const gap = computed(() => props.block.style.fontSize);
const columnWidth = computed(() => props.block.style.fontSize * 14);
const paged = computed(() => pages.value > 1);
const held = computed(() => context.paging === false || turnSeconds.value === 0);

/** Pages the columns take: the width they overflow with, against the width of the block. */
function measure(): void {
    const view = viewport.value;
    const cols = columns.value;
    if (!view || !cols || view.clientWidth <= 0) return;
    pageWidth.value = view.clientWidth;
    pages.value = Math.max(1, Math.ceil((cols.scrollWidth + gap.value) / (view.clientWidth + gap.value) - 0.02));
}

/** The running song with a duration: the page follows the time that passed since it began, so a reload keeps the place. */
const elapsedSeconds = computed(() => {
    const length = lengthSeconds.value;
    const left = display.value?.countdownSeconds;
    return length === null || length <= 0 || left === null || left === undefined ? null : length - left;
});
const timed = computed(() => (elapsedSeconds.value === null || pages.value < 2 || context.paging === false ? null : sheetPage(elapsedSeconds.value, lengthSeconds.value!, pages.value)));
/** A running song without a duration turns its pages round on a beat of its own. */
const untimed = computed(() => !upcoming.value && pages.value > 1 && context.paging !== false && !(lengthSeconds.value! > 0));
const round = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;
function turnRound(): void {
    clearInterval(timer);
    round.value = 0;
    if (!untimed.value) return;
    const count = pages.value;
    timer = setInterval(() => (round.value = (round.value + 1) % count), UNTIMED_PAGE_SECONDS * 1000);
}
const page = computed(() => (timed.value ? timed.value.page : untimed.value ? round.value : 0));
/** Seconds of the page shown, for the bar; 0 while pages do not turn (not running, one page, the designer). */
const turnSeconds = computed(() => timed.value?.turnSeconds ?? (untimed.value ? UNTIMED_PAGE_SECONDS : 0));
/** How far into its page the bar starts – taken when the page changes, not every second. */
const pageOffset = ref(0);
watch(
    [page, songId],
    () => {
        const turn = timed.value;
        pageOffset.value = turn && elapsedSeconds.value !== null ? Math.min(turn.turnSeconds, Math.max(0, elapsedSeconds.value - turn.page * turn.turnSeconds)) : 0;
    },
    { immediate: true },
);

watch([songId, upcoming, pages, untimed], () => turnRound());
watch(
    [
        songId,
        sheet,
        showChords,
        () => props.block.style.fontFamily,
        () => props.block.style.fontSize,
        () => props.block.style.lineHeight,
        () => props.block.style.letterSpacing,
        () => props.block.width,
        () => props.block.height,
        paged,
    ],
    () => void nextTick(measure),
);
onMounted(() => {
    measure();
    turnRound();
    void document.fonts?.ready.then(measure);
});
onBeforeUnmount(() => clearInterval(timer));

const columnsStyle = computed(() => ({
    columnWidth: `${columnWidth.value}px`,
    columnGap: `${gap.value}px`,
    transform: page.value ? `translateX(${-page.value * (pageWidth.value + gap.value)}px)` : undefined,
}));
const chordColor = computed(() => themeOf(context).accent);
</script>

<template>
    <div v-if="item" class="songsheet" :class="{ 'songsheet--paged': paged }" :style="textStyle(block.style)" data-testid="songsheet">
        <div class="head">
            <span v-if="upcoming" class="next" data-testid="songsheet-next">{{ tp.songsheet.next }}</span>
            <span class="title" data-testid="songsheet-title">{{ item.title }}</span>
            <span v-if="meta" class="meta" data-testid="songsheet-meta">{{ meta }}</span>
        </div>
        <div v-if="sheet && hasLines" ref="viewport" class="viewport">
            <div ref="columns" class="columns" :style="columnsStyle" data-testid="songsheet-text">
                <section v-for="(section, s) in sections" :key="s" class="section">
                    <div v-if="section.label" class="label" data-testid="songsheet-label">{{ section.label }}</div>
                    <div v-for="(line, l) in section.lines" :key="l" class="line">
                        <template v-if="line.plain">{{ line.text }}</template>
                        <span v-for="(segment, g) in line.segments" v-else :key="g" class="segment">
                            <span class="chord" :style="{ color: chordColor }" data-testid="songsheet-chord">{{ segment.chord ?? ' ' }}</span>
                            <span class="syllable">{{ segment.text }}</span>
                        </span>
                    </div>
                </section>
            </div>
        </div>
        <div v-else class="none" data-testid="songsheet-none">{{ tp.songsheet.none }}</div>
        <div v-if="sheet?.footer" class="foot" data-testid="songsheet-footer">{{ sheet.footer }}</div>
        <PageProgress v-if="paged" :key="page" :seconds="turnSeconds" :held="held" :offset="pageOffset" :size="8" :inset="16" :number="page + 1" :total="pages" :color="themeOf(context).text" />
    </div>
</template>

<style scoped>
.songsheet {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    line-height: 1.25;
}
/* The room for the bar of the pages, kept free only where there are pages. */
.songsheet--paged {
    padding-bottom: 32px;
}
.head {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.1em 0.6em;
    margin-bottom: 0.5em;
    font-weight: 700;
}
.next {
    font-size: 0.45em;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.7;
}
.title {
    min-width: 0;
}
.meta {
    font-size: 0.6em;
    font-weight: 600;
    opacity: 0.8;
}
.viewport {
    flex: 1;
    min-height: 0;
    overflow: hidden;
}
.columns {
    height: 100%;
    column-fill: auto;
}
.section {
    break-inside: avoid;
    margin-bottom: 0.8em;
}
.label {
    margin-bottom: 0.15em;
    font-size: 0.55em;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.7;
}
.line {
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
    font-weight: 700;
    line-height: 1.1;
    white-space: pre;
}
.syllable {
    /* A segment without text (a bar line, a chord alone) keeps the height of its neighbours. */
    min-height: 1.25em;
    white-space: pre;
}
.none {
    flex: 1;
    opacity: 0.7;
    font-size: 0.7em;
}
.foot {
    flex: none;
    margin-top: 0.6em;
    overflow: hidden;
    /* Small on purpose: the licence must be there, not read from the stage (user, 2026-11-11). */
    font-size: 0.22em;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.55;
}
</style>
