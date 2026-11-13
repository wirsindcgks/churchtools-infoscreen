<script setup lang="ts">
/**
 * The block "Liedblatt" (schema 1.63, Plan.md 121 B): the text of the song that is running in the agenda, the chords above the syllable;
 * a song that is not running yet – the next one, or the first before the start – under "Als Nächstes". The head names title, key and
 * tempo, the foot keeps copyright and CCLI numbers (the licence of the church). What does not fit stands in columns, then in pages:
 * they are counted after the render (the width the columns take against the width of the block) and turn after the length of the
 * running song – by the time that passed since it began, or, without a duration, on a beat of its own. The agenda comes from `use-agenda.ts`, the choice of the song and the chords from `src/agenda/songsheet.ts`.
 * The block shows one part (Plan.md 121 E): the one the musicians chose (`context.agenda.controls`), without a choice part 1 – also under
 * "Als Nächstes" – one size for the whole song: as large as its largest part fits, up to twice the font size, down to 30 % (user,
 * 2026-11-11: the text filled too little of the block); no columns and no pages; below it, faint, the heading and first line of the next part. Only with `pageByTime` and without a choice the whole text stands in columns.
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
const chosen = computed(() => songsheetPick(pick.value, pick.value ? context.agenda?.controls?.[pick.value.event.eventId] : undefined));
/**
 * The next song waits while the running point has more than `nextLeadMinutes` left (user, 2026-11-11: not through a whole sermon).
 * Only for "Als Nächstes" during a running point with a countdown – a tip, a running song and the time before the start show at once.
 */
const selected = computed(() => {
    const pickNow = chosen.value;
    const lead = props.block.nextLeadMinutes;
    const left = display.value?.countdownSeconds;
    const waiting = !!pickNow?.upcoming && lead !== undefined && display.value?.kind === 'now' && left !== null && left !== undefined && left > lead * 60;
    return waiting ? null : pickNow;
});
/**
 * In the designer a sheet with nothing to show takes the example song (`songExample`, user 2026-11-13: without text the font cannot be
 * judged) – no song right now, no file, or "Als Nächstes" waiting. A real song with text always wins; the player has no example.
 */
const example = computed(() => {
    const real = selected.value?.item;
    const realText = !!real && (sheetOf(real)?.sections.length ?? 0) > 0;
    return realText ? null : (context.songExample ?? null);
});
const item = computed(() => example.value ?? selected.value?.item ?? null);
const songId = computed(() => (example.value ? 'example' : (selected.value?.id ?? '')));
const upcoming = computed(() => !example.value && (selected.value?.upcoming ?? false));
const lengthSeconds = computed(() => (example.value ? null : (selected.value?.lengthSeconds ?? null)));
const sheet = computed(() => (item.value ? sheetOf(item.value) : null));
/** The part the musicians chose, else part 1 of the song shown; `undefined` only with "Nach Zeit blättern" (columns, pages by time). */
const section = computed(() => (example.value ? undefined : selected.value?.section) ?? (item.value && !props.block.pageByTime ? 0 : undefined));
const showChords = computed(() => props.block.showChords);

/** Title · key · tempo; the key of the sheet is the one after transposing, else the one of the arrangement. */
const meta = computed(() => {
    const details = item.value?.songDetails;
    return [sheet.value?.key ?? details?.key, details?.bpm ? tp.agenda.bpm(details.bpm) : ''].filter(Boolean).join(' · ');
});

/** The sections to draw, empty ones kept (their place is the index of a chosen part): without chords the lines that carry nothing else are left out (instrumental parts). */
const allSections = computed(() =>
    (sheet.value?.sections ?? []).map((part) => ({
        label: part.label,
        extra: part.extra,
        lines: part.lines
            .filter((line) => showChords.value || line.text.trim() !== '')
            .map((line) => ({ plain: !showChords.value || !line.chords.length, text: line.text, segments: lineSegments(line) })),
    })),
);
const sections = computed(() => allSections.value.filter((part) => part.lines.length > 0));
const hasLines = computed(() => sections.value.length > 0);

// --- a chosen part ---

/** The chosen part; a part that would be empty without chords shows its heading only. */
const part = computed(() => (section.value === undefined ? null : (allSections.value[section.value] ?? null)));
/** Heading and first line of the part after it, without chords; nothing after the last. */
const preview = computed(() => {
    const next = part.value && section.value !== undefined ? allSections.value[section.value + 1] : undefined;
    // A part outside the flow is no "next" (Plan.md 121 H).
    return next && !next.extra ? { label: next.label, text: next.lines.find((line) => line.text.trim() !== '')?.text ?? '' } : null;
});
const shown = computed(() => (part.value ? [part.value] : sections.value));
const showText = computed(() => (part.value ? true : !!sheet.value && hasLines.value));
/** The factor on the font size: smaller where the text does not fit; a chosen part also larger, up to {@link MAX_SCALE}. */
const scale = ref(1);
let fitRun = 0;
/** Down to this share of the set size: a flat block with a large font needs it for four lines with chords (test, 2026-11-11: half was short). */
const MIN_SCALE = 0.3;
/** Up to twice the set size: a part of four lines left most of a stage monitor empty (user, 2026-11-11). */
const MAX_SCALE = 2;

/** The height a part takes unbroken: its heading and lines with their margins – also where the columns broke it (multicol fragments). */
function naturalHeight(section: Element): number {
    let height = 0;
    for (const child of Array.from(section.children)) {
        const el = child as HTMLElement;
        const style = getComputedStyle(el);
        height += el.offsetHeight + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
    }
    return height;
}

/**
 * How far the text overflows: the tallest part against the height of the block; with a chosen part every part of the song (drawn unseen
 * in `measure`), also against the width; null unmeasurable.
 */
function overflow(): number | null {
    const view = viewport.value;
    const cols = part.value ? sizer.value : columns.value;
    if (!view || !cols || view.clientHeight <= 0 || view.clientWidth <= 0) return null;
    const tallest = Math.max(0, ...Array.from(cols.children, naturalHeight));
    const high = tallest / view.clientHeight;
    // A chosen part also by what the block itself overflows with – a second measure, should the parts be counted short.
    return part.value ? Math.max(high, view.scrollHeight / view.clientHeight, view.scrollWidth / view.clientWidth, cols.scrollWidth / view.clientWidth) : high;
}

/**
 * Measured after the render. A chosen part: the largest size between {@link MIN_SCALE} and {@link MAX_SCALE} at which every part of
 * the song fits, so that the text does not jump from part to part. The columns: back to full size, then smaller in steps until the
 * tallest part fits; then the pages counted.
 */
async function fit(): Promise<void> {
    const run = ++fitRun;
    scale.value = 1;
    await nextTick();
    if (part.value) {
        if (overflow() !== null) {
            let low = MIN_SCALE;
            let high = MAX_SCALE;
            for (let i = 0; i < 10 && run === fitRun; i++) {
                const mid = (low + high) / 2;
                scale.value = mid;
                await nextTick();
                const over = overflow();
                if (over === null) break;
                if (over <= 1.005) low = mid;
                else high = mid;
            }
            if (run === fitRun) scale.value = low;
        }
    } else {
        for (let i = 0; i < 12 && run === fitRun; i++) {
            const over = overflow();
            if (over === null || !(over > 1.005) || scale.value <= MIN_SCALE) break;
            scale.value = Math.max(MIN_SCALE, scale.value * Math.min(0.95, 1 / over));
            await nextTick();
        }
    }
    if (run === fitRun) countPages();
}

// --- pages ---

const viewport = ref<HTMLElement | null>(null);
const columns = ref<HTMLElement | null>(null);
/** All parts of a song with a chosen part, unseen, to find the one size for the whole song. */
const sizer = ref<HTMLElement | null>(null);
const pages = ref(1);
const pageWidth = ref(0);
const gap = computed(() => props.block.style.fontSize);
const columnWidth = computed(() => props.block.style.fontSize * 14);
const paged = computed(() => pages.value > 1);
const held = computed(() => context.paging === false || turnSeconds.value === 0);

/** Fits the text, then counts the pages. */
function measure(): void {
    void fit();
}

/** Pages the columns take: the width they overflow with, against the width of the block; a chosen part has one. */
function countPages(): void {
    if (part.value) {
        pages.value = 1;
        return;
    }
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
        () => section.value === undefined,
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
let resize: ResizeObserver | undefined;
watch(viewport, (view, old) => {
    if (old) resize?.unobserve(old);
    if (!view || typeof ResizeObserver === 'undefined') return;
    resize ??= new ResizeObserver(() => measure());
    resize.observe(view);
});
onMounted(() => {
    measure();
    turnRound();
    void document.fonts?.ready.then(measure);
});
onBeforeUnmount(() => {
    clearInterval(timer);
    resize?.disconnect();
});

const columnsStyle = computed(() =>
    part.value
        ? { fontSize: `${scale.value}em` }
        : {
              fontSize: scale.value < 1 ? `${scale.value}em` : undefined,
              columnWidth: `${columnWidth.value}px`,
              columnGap: `${gap.value}px`,
              transform: page.value ? `translateX(${-page.value * (pageWidth.value + gap.value)}px)` : undefined,
          },
);
const chordColor = computed(() => themeOf(context).accent);
/**
 * The head follows the alignment of the text: a centred song gets a centred head. "Schrift" is for the text, the head only names the
 * song (user, 2026-11-13: "es geht um den Text, nicht das Drumherum"): half the size of the text, shrinking with it, never growing –
 * at the full set size a large font (150 px) gave the title a third of the block and left the text small.
 */
const HEAD_SHARE = 0.5;
const headStyle = computed(() => ({
    justifyContent: { left: 'flex-start', center: 'center', right: 'flex-end' }[props.block.style.align],
    fontSize: `${HEAD_SHARE * Math.min(1, scale.value)}em`,
}));
</script>

<template>
    <div v-if="item" class="songsheet" :class="{ 'songsheet--paged': paged }" :style="textStyle(block.style)" data-testid="songsheet">
        <div class="head" :style="headStyle">
            <span v-if="example" class="next" data-testid="songsheet-example">{{ tp.songsheet.example }}</span>
            <span v-else-if="upcoming" class="next" data-testid="songsheet-next">{{ tp.songsheet.next }}</span>
            <span class="title" data-testid="songsheet-title">{{ item.title }}</span>
            <span v-if="meta" class="meta" data-testid="songsheet-meta">{{ meta }}</span>
        </div>
        <div v-if="showText" ref="viewport" class="viewport">
            <div ref="columns" class="columns" :class="{ 'columns--part': part }" :style="columnsStyle" data-testid="songsheet-text">
                <section v-for="(entry, s) in shown" :key="s" class="section" :data-testid="part ? 'songsheet-part' : undefined">
                    <div v-if="entry.label" class="label" data-testid="songsheet-label">{{ entry.label }}</div>
                    <div v-for="(line, l) in entry.lines" :key="l" class="line">
                        <template v-if="line.plain">{{ line.text }}</template>
                        <span v-for="(segment, g) in line.segments" v-else :key="g" class="segment">
                            <span class="chord" :style="{ color: chordColor }" data-testid="songsheet-chord">{{ segment.chord ?? ' ' }}</span>
                            <span class="syllable">{{ segment.text }}</span>
                        </span>
                    </div>
                </section>
            </div>
            <div v-if="part" ref="sizer" class="sizer" :style="columnsStyle" aria-hidden="true">
                <section v-for="(entry, s) in allSections" :key="s" class="section">
                    <div v-if="entry.label" class="label">{{ entry.label }}</div>
                    <div v-for="(line, l) in entry.lines" :key="l" class="line">
                        <template v-if="line.plain">{{ line.text }}</template>
                        <span v-for="(segment, g) in line.segments" v-else :key="g" class="segment">
                            <span class="chord">{{ segment.chord ?? ' ' }}</span>
                            <span class="syllable">{{ segment.text }}</span>
                        </span>
                    </div>
                </section>
            </div>
        </div>
        <div v-else class="none" data-testid="songsheet-none">{{ tp.songsheet.none }}</div>
        <div v-if="preview" class="preview" :style="{ fontSize: `${0.6 * scale}em` }" data-testid="songsheet-preview">
            <div v-if="preview.label" class="label">{{ preview.label }}</div>
            <div class="line">{{ preview.text }}</div>
        </div>
        <!-- The last part keeps the room of a preview: the block measures the same for every part, the size does not change. -->
        <div v-else-if="part" class="preview preview--room" :style="{ fontSize: `${0.6 * scale}em` }" aria-hidden="true">
            <div class="label">&nbsp;</div>
            <div class="line">&nbsp;</div>
        </div>
        <div v-if="sheet?.footer" class="foot" data-testid="songsheet-footer">{{ sheet.footer }}</div>
        <PageProgress v-if="paged" :key="page" :seconds="turnSeconds" :held="held" :offset="pageOffset" :size="8" :inset="16" :number="page + 1" :total="pages" :color="themeOf(context).text" />
    </div>
    <!-- No event today: only a large, faint note, the hint stands once, in "Ablauf" (Plan.md 123). An event without a song left shows
         nothing at all – the stage needs no word for it (user, 2026-11-11). -->
    <div v-else-if="context.agenda && !pick" class="empty empty--note" :style="textStyle(block.style)" data-testid="songsheet-empty">
        <svg class="note" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
        </svg>
    </div>
</template>

<style scoped>
/* Like the block "Ablauf": a quiet line once the agenda is read and there is no song to show. */
.empty {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 0.5em;
    opacity: 0.5;
    text-align: center;
}
.empty--note {
    opacity: 0.15;
}
/* The note of "no event today": 40 % of the block. */
.note {
    height: 40%;
}
.songsheet {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    /* A margin of its own, like the cards of "Ablauf": the text never touches the edge of the block (user, 2026-11-11). */
    box-sizing: border-box;
    /* At most 32 and 40 stage pixels: with a large font the margin took the room of the text. */
    padding: min(0.4em, 32px) min(0.5em, 40px);
    line-height: 1.25;
}
/* The room for the bar of the pages, kept free only where there are pages. */
.songsheet--paged {
    padding-bottom: max(0.4em, 32px);
}
.head {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.1em 0.6em;
    margin-bottom: 0.4em;
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
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}
/* Every part of the song, unseen, laid over the block: what it measures sets the one size of the song. */
.sizer {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    visibility: hidden;
    pointer-events: none;
}
/* On top of each other, not one below the other: only the tallest part may count, not all of them together. */
.sizer > .section {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
}
.columns {
    height: 100%;
    column-fill: auto;
}
.columns--part {
    height: auto;
}
/* The start of the next part of a chosen song: faint, so that it is seen to be next, not to be sung yet. */
/* Its size follows the text it previews (0.6 of it, set inline): unscaled it stood larger than a shrunk part and took its room. */
.preview {
    flex: none;
    margin-top: 0.4em;
    opacity: 0.5;
}
.preview--room {
    visibility: hidden;
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
