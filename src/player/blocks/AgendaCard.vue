<script setup lang="ts">
/**
 * The block "Ablauf" in its own look (Plan.md 118, Stück 3), after the card of the next appointment: a card with the tile (planned
 * time or position) and the title of the current item, a badge for the service, the countdown as a large ring at the right, the delay
 * as a pill beside the badge, the note and the people as lines – and "Dann" as a card beside it (design "H2", user, 2026-11-10), in a
 * narrow block a bar below. The time left is shown as digits "3:12" or as the ring; a frame around "Jetzt" turns green, yellow, red with
 * it. The numbers come from `use-agenda.ts` via `AgendaView.vue`.
 */
import { computed } from 'vue';
import { clockText, signalState, type AgendaDisplay } from '../../agenda/live';
import type { Block } from '../../model/schema';
import { themeOf, useStageContext } from '../context';
import { formatTime, textStyle, tint } from '../format';
import { tp } from '../../i18n/player';
import AgendaRing from './AgendaRing.vue';
import CalendarBadge from './CalendarBadge.vue';

const props = defineProps<{
    block: Extract<Block, { type: 'agenda' }>;
    display: AgendaDisplay;
    circle: { value: string; unit: string; negative: boolean } | null;
    lateMinutes: number | null;
    left: number;
}>();
const context = useStageContext();

const tileKind = computed(() => props.block.tile ?? 'time');
const tileStyle = computed(() => ({ background: tint(themeOf(context).accent, 28) }));
const pillStyle = computed(() => ({ borderColor: tint(themeOf(context).accent, 60), background: tint(themeOf(context).accent, 14) }));
const time = (ms: number) => formatTime(new Date(ms), context.timeZone);

/** The badge: the first service, else "Lied" for a song. */
const badge = computed(() => props.display.service ?? (props.display.song ? tp.agenda.song : null));
const now = computed(() => props.display.kind === 'now');
const showCountdown = computed(() => now.value && props.block.showCountdown && props.circle !== null);
const showDelay = computed(() => now.value && props.block.showDelay && props.lateMinutes !== null);
const showNote = computed(() => props.block.showNote && !!props.display.note);
const showResponsible = computed(() => props.block.showResponsible && !!props.display.responsible);
const showNext = computed(() => props.block.showNext && props.display.next !== null);
/** The ring is the large part of the card: it is read from the stage. */

const digits = computed(() => (props.block.countdownStyle ?? 'digits') === 'digits');
/** The frame around "Jetzt"; none before the start. */
const signal = computed(() => (props.block.showSignal && now.value ? signalState(props.display.countdownSeconds, props.block.warnMinutes ?? 1) : null));
/** A block narrower than 1.3 times its height puts "Dann" below as a bar. */
const narrow = computed(() => props.block.width < props.block.height * 1.3);
/** The people without the service the badge already names: "Leitung: Anna Beispiel" under "LEITUNG" becomes "Anna Beispiel". */
function withoutService(line: string | null, service: string | null): string | null {
    if (!line || !service) return line;
    const prefix = `${service}: `;
    return line.startsWith(prefix) && !line.includes(' · ') ? line.slice(prefix.length) : line;
}
const people = computed(() => withoutService(props.display.responsible, props.display.service));
const nextPeople = computed(() => withoutService(props.display.nextResponsible, props.display.nextService));
/** The countdown stands on the level of the title, at the right (user, 2026-11-10). */
const diameter = computed(() => Math.min(props.block.height * 0.42, props.block.width * 0.2));
const nextMinutes = computed(() => (props.display.nextDurationSeconds ? Math.round(props.display.nextDurationSeconds / 60) : 0));
</script>

<template>
    <div class="agenda-card" :class="{ 'agenda-card--narrow': narrow }" :style="textStyle(block.style)" data-testid="agenda-card">
        <div class="hero hero--main" :class="signal ? `signal--${signal}` : ''">
            <span v-if="signal" class="signal-frame" :data-state="signal" data-testid="agenda-signal" />
            <div class="hero-text">
                <div class="hero-head">
                    <span v-if="tileKind !== 'none'" class="tile" :style="tileStyle" data-testid="agenda-tile">
                        <template v-if="tileKind === 'time'">
                            <span class="big">{{ time(display.plannedStartMs) }}</span>
                            <span class="small">{{ tp.agenda.clock }}</span>
                        </template>
                        <template v-else>
                            <span class="big">{{ display.number }}</span>
                            <span class="small">{{ tp.agenda.of(display.count) }}</span>
                        </template>
                    </span>
                    <div class="hero-titles">
                        <div class="hero-line">
                            <span class="label" data-testid="agenda-now-label">{{ display.kind === 'soon' ? tp.agenda.soon : tp.agenda.now }}</span>
                            <CalendarBadge v-if="badge" :name="badge" :color="null" data-testid="agenda-service" />
                            <!-- The delay sits in this line, not in one of its own: the title keeps the room. -->
                            <span v-if="showDelay && lateMinutes !== null" class="pill" :class="{ 'pill--late': lateMinutes > 0, 'delay--late': lateMinutes > 0 }" :style="pillStyle" data-testid="agenda-delay">
                                {{ tp.agenda.delay(lateMinutes) }}
                            </span>
                        </div>
                        <div class="hero-title" data-testid="agenda-now">{{ display.title }}</div>
                    </div>
                    <template v-if="showCountdown && circle && display.countdownSeconds !== null">
                        <div v-if="digits" class="digits digits--side" :class="{ 'digits--over': circle.negative }" data-testid="agenda-countdown">{{ clockText(display.countdownSeconds) }}</div>
                        <AgendaRing v-else :circle="circle" :left="left" :diameter="diameter" testid="agenda-countdown" class="card-ring card-ring--side" warn scaled />
                    </template>
                </div>
                <div v-if="showResponsible" class="hero-meta">
                    <span data-testid="agenda-responsible">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" /></svg>
                        <span>{{ people }}</span>
                    </span>
                </div>
                <!-- Note and duration carry a sign like the people (user, 2026-11-10). -->
                <div v-if="showNote" class="hero-note-row">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8.5l3.5 3.5v13.5H6z" /><path d="M14.5 3.5V7H18M9 11.5h6M9 15.5h6" /></svg>
                    <p class="hero-note" data-testid="agenda-note">{{ display.note }}</p>
                </div>
            </div>
        </div>
        <div v-if="showNext" class="hero next-card" data-testid="agenda-next-card">
            <!-- The service beside "Dann", as in "Jetzt" (user, 2026-11-10); a narrow block keeps one plain line. -->
            <div class="hero-line">
                <span class="label" data-testid="agenda-next-label">{{ tp.agenda.next }}</span>
                <CalendarBadge v-if="!narrow && display.nextService" :name="display.nextService" :color="null" data-testid="agenda-next-service" />
            </div>
            <span v-if="tileKind === 'time' && display.nextPlannedStartMs !== null" class="next-time" data-testid="agenda-next-time">{{ time(display.nextPlannedStartMs) }}</span>
            <span class="next-title" data-testid="agenda-next">{{ display.next }}</span>
            <template v-if="!narrow">
                <!-- The people as in "Jetzt": a person with the person sign (user, 2026-11-10). -->
                <div v-if="block.showResponsible && nextPeople" class="hero-meta next-people" data-testid="agenda-next-responsible">
                    <span>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" /></svg>
                        <span>{{ nextPeople }}</span>
                    </span>
                </div>
                <div v-if="nextMinutes > 0" class="hero-meta next-duration">
                    <span>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
                        <span data-testid="agenda-next-duration">{{ tp.agenda.shortMinutes(nextMinutes) }}</span>
                    </span>
                </div>
            </template>
        </div>
    </div>
</template>

<style scoped>
.agenda-card {
    display: flex;
    flex-direction: row;
    gap: 0.25em;
    width: 100%;
    height: 100%;
    line-height: 1.15;
}
.agenda-card--narrow {
    flex-direction: column;
}
.hero {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.6em;
    box-sizing: border-box;
    min-width: 0;
    min-height: 0;
    padding: 0.8em;
    border-radius: var(--isd-radius, 0.4em);
    background: var(--isd-card, color-mix(in srgb, currentColor 7%, transparent));
    /*
     * A fine outline in the text colour: the cards stay apart from the slide on any background, also where the design
     * gives them no surface or one as dark as the slide (seen on a black slide, 2026-11-10). Stage pixels, the same on both cards.
     */
    border: 3px solid color-mix(in srgb, currentColor 22%, transparent);
}
.agenda-card > .hero:first-child {
    flex: 3;
}
/*
 * The card holds a tile, a title and the time left: at the block's own size (a heading, 96 px) the title would have no room.
 * Everything in it is measured from this, so "Schrift" still sets the size. The thickness of the frame is 0.25 of it.
 */
.hero--main {
    font-size: 0.65em;
}
/* The frame lies inside the card, over its padding; it follows the time left. */
.signal-frame {
    position: absolute;
    /*
     * Over the card's outline as well (3px, see `.hero`): one surface, no seam between outline and frame – two of them left
     * a dark hairline on the TV where the stage is scaled (user, 2026-11-10).
     */
    inset: -3px;
    border-radius: inherit;
    box-shadow: inset 0 0 0 calc(0.25em + 3px) var(--signal, transparent);
    pointer-events: none;
    transition: box-shadow 0.4s;
}
.signal--ok {
    --signal: #30a46c;
}
.signal--warn {
    --signal: #f5a524;
}
.signal--over {
    --signal: #e5484d;
}
/* With the signal frame on, the grey outline takes its colour and becomes part of the frame (user, 2026-11-10). */
.signal--ok,
.signal--warn,
.signal--over {
    border-color: var(--signal);
    transition: border-color 0.4s;
}
@media (prefers-reduced-motion: reduce) {
    .signal-frame,
    .signal--ok,
    .signal--warn,
    .signal--over {
        transition: none;
    }
}
.hero-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    /* The parts spread over the card; with too little room the end gives way (note first). */
    justify-content: space-between;
    gap: 0.4em;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
}
.digits {
    flex-shrink: 0;
    font-size: 2.4em;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    line-height: 0.95;
}
.digits--over {
    color: #e5484d;
}
.card-ring {
    align-self: flex-start;
}
/* "Dann": a smaller card beside "Jetzt", a column; in a narrow block one line across the width. */
.next-card {
    flex: 1;
    align-items: flex-start;
    gap: 0.4em;
    font-size: 0.55em;
}
.agenda-card--narrow .next-card {
    flex: none;
    flex-direction: row;
    align-items: baseline;
    gap: 0.8em;
    padding: 0.5em 0.8em;
}
.hero-head {
    display: flex;
    flex-shrink: 0;
    align-items: flex-start;
    gap: 0.7em;
}
.tile {
    display: inline-grid;
    flex: none;
    place-content: center;
    justify-items: center;
    min-width: 2.6em;
    height: 2.6em;
    padding: 0 0.2em;
    box-sizing: border-box;
    border-radius: var(--isd-radius, 0.3em);
    line-height: 1;
}
.big {
    font-size: 1.15em;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}
.small {
    margin-top: 0.15em;
    font-size: 0.5em;
    letter-spacing: 0.08em;
    opacity: 0.85;
}
.hero-titles {
    display: grid;
    justify-items: start;
    gap: 0.25em;
    min-width: 0;
}
.hero-line {
    display: flex;
    align-items: center;
    gap: 0.6em;
    max-width: 100%;
}
.label {
    font-size: 0.4em;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.7;
}
.next-card .label {
    font-size: 0.6em;
}
.hero-title {
    display: -webkit-box;
    overflow: hidden;
    justify-self: stretch;
    font-size: 1.5em;
    font-weight: 700;
    line-height: 1.1;
    overflow-wrap: anywhere;
    hyphens: auto;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}
.pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    padding: 0.2em 0.65em;
    border: 0.1em solid;
    border-radius: var(--isd-pill, 999px);
    font-size: 0.55em;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.3;
    white-space: nowrap;
}
.pill--late {
    color: #e5484d;
}
.hero-meta svg {
    flex: none;
    width: 1em;
    height: 1em;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}
/* Three lines at most; the note gives way first when the block is small. */
.hero-note-row {
    display: flex;
    align-items: flex-start;
    gap: 0.45em;
    min-height: 0;
    overflow: hidden;
    font-size: 0.7em;
}
.hero-note-row svg {
    flex: none;
    width: 1em;
    height: 1em;
    /* On the first line of the note, which is set at 1.45. */
    margin-top: 0.22em;
    opacity: 0.85;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}
.hero-note {
    display: -webkit-box;
    margin: 0;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    line-height: 1.45;
    opacity: 0.85;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
}
.hero-meta {
    display: grid;
    flex-shrink: 0;
    justify-items: start;
    font-size: 0.7em;
    font-weight: 600;
}
.hero-meta > span {
    display: inline-flex;
    align-items: flex-start;
    gap: 0.45em;
}
.next-time {
    flex: none;
    font-size: 1.5em;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    opacity: 0.75;
}
.next-title {
    display: -webkit-box;
    overflow: hidden;
    min-width: 0;
    font-size: 1.1em;
    font-weight: 700;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
}
.next-people {
    font-size: 0.8em;
}
.next-duration {
    font-size: 0.8em;
    opacity: 0.8;
}
.agenda-card--narrow .next-time {
    font-size: 1em;
    font-weight: 600;
}
.agenda-card--narrow .next-title {
    display: block;
    flex: 1;
    font-size: 1em;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.digits--side,
.card-ring--side {
    margin-left: auto;
    align-self: center;
}
</style>
