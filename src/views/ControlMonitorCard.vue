<script setup lang="ts">
/**
 * The band under the head of the phone page (Plan.md 137 A): one coloured line that says what the screen shows – the word of the kind in bold
 * (Probe, Präsentation, Gottesdienst, Zeitplan), behind it the details. While a rehearsal runs the whole band is a button that opens a sheet
 * with "+1 Std", "+2 Std" and "Beenden"; where the screen is released for rehearsals, "Probe starten" stands at its right. Notes of the
 * transfer and of a silent screen take the place of the details.
 */
import { computed, ref } from 'vue';
import { t } from '../i18n/designer';
import type { Monitor, MonitorState } from './monitor-state';
import ControlSheet from './ControlSheet.vue';
import { EXTEND_HOURS } from './rehearsal-override';

const transferText = { saving: t.control.transferSaving, start: t.control.transferStart, extend: t.control.transferExtend, end: t.control.transferEnd, late: t.control.transferLate };

const props = defineProps<{
    monitor: Monitor;
    /** `null` – no position (yet): see `silent`. */
    state: MonitorState | null;
    /** The position was read and there is none. */
    silent: boolean;
    /** A rehearsal runs at the screen: the band then opens the sheet to extend and end it. */
    rehearsalRunning: boolean;
    /** The write of the rehearsal is on its way: the buttons rest. */
    busy: boolean;
    /** Between the tap and the screen taking it: the band says what happens meanwhile (see `useRehearsalControl`). */
    transfer?: 'saving' | 'start' | 'extend' | 'end' | 'late' | null;
}>();
const emit = defineEmits<{ startRehearsal: []; extend: [hours: number]; endRehearsal: [] }>();

const sheetOpen = ref(false);
/** Not while a service runs: a tap by mistake must not take the screen away from it (user, 2026-11-27). */
const canStart = computed(() => !props.rehearsalRunning && props.monitor.rehearsal && props.state?.kind !== 'service');
const visible = computed(() => !!props.state || props.silent || !!props.transfer || canStart.value);
const kind = computed(() => props.state?.kind ?? 'none');
/** A name stands behind its word with a dot; the time and the rehearsal line stand behind it as they are. */
const detail = computed(() => (props.state?.detail && (kind.value === 'presentation' || kind.value === 'schedule') ? `· ${props.state.detail}` : (props.state?.detail ?? null)));

function extend(hours: number): void {
    sheetOpen.value = false;
    emit('extend', hours);
}
function end(): void {
    sheetOpen.value = false;
    emit('endRehearsal');
}
</script>

<template>
    <section v-if="visible" class="monitor" data-testid="control-monitor">
        <component :is="rehearsalRunning ? 'button' : 'div'" class="band" :class="`tone-${kind}`" :type="rehearsalRunning ? 'button' : undefined" data-testid="monitor-band" @click="rehearsalRunning && (sheetOpen = true)">
            <span class="dot" aria-hidden="true" />
            <span class="text">
                <b v-if="state?.chip" class="word" data-testid="monitor-chip">{{ state.chip }}</b>
                <template v-if="transfer">
                    {{ ' ' }}<span class="transfer" :class="{ late: transfer === 'late' }" role="status" data-testid="monitor-transfer"><span v-if="transfer !== 'late'" class="transfer-ring" aria-hidden="true" />{{ transferText[transfer] }}</span>
                </template>
                <template v-else-if="silent">
                    <span data-testid="monitor-silent">{{ t.control.monitorSilent }}</span>
                </template>
                <template v-else-if="detail">
                    {{ ' ' }}<span data-testid="monitor-detail">{{ detail }}</span>
                </template>
            </span>
            <span v-if="rehearsalRunning" class="more" aria-hidden="true">›</span>
            <button v-else-if="canStart" type="button" class="start" data-testid="monitor-rehearsal" @click="emit('startRehearsal')">{{ t.control.rehearsalStart }} ›</button>
        </component>
        <ControlSheet v-if="sheetOpen && rehearsalRunning" :title="t.control.rehearsalSheetTitle(monitor.name)" icon="tv" @close="sheetOpen = false">
            <div class="row">
                <button v-for="h in EXTEND_HOURS" :key="h" type="button" class="choice" :disabled="busy" :data-testid="`monitor-extend-${h}`" @click="extend(h)">{{ t.control.rehearsalExtend(h) }}</button>
            </div>
            <button type="button" class="choice end" :disabled="busy" data-testid="monitor-end" @click="end">{{ t.control.rehearsalEnd }}</button>
        </ControlSheet>
    </section>
</template>

<style scoped>
.monitor {
    flex: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
}
p {
    margin: 0;
}
/* The colours of the drafts (Plan.md 137 A): background, dot, word. */
.band {
    --band: #1b1e25;
    --dot: #8b909a;
    --word: #c9ced6;
    display: flex;
    align-items: center;
    gap: 10px;
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    padding: 0 14px;
    border: 0;
    border-radius: 12px;
    background: var(--band);
    color: #f1f2f4;
    font: inherit;
    font-size: 15px;
    text-align: left;
}
button.band {
    cursor: pointer;
}
.tone-rehearsal {
    --band: #2b2610;
    --dot: #facc15;
    --word: #facc15;
}
.tone-presentation {
    --band: #231d3a;
    --dot: #a78bfa;
    --word: #c4b5fd;
}
.tone-service {
    --band: #12301f;
    --dot: #4ade80;
    --word: #86efac;
}
.dot {
    flex: none;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--dot);
}
.text {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.word {
    font-weight: 600;
    color: var(--word);
}
.more {
    flex: none;
    color: #d6cfa8;
}
/* The whole height of the band is the target; the label sits at the right edge. */
.start {
    flex: none;
    align-self: stretch;
    margin: 0 -14px 0 0;
    padding: 0 14px 0 8px;
    border: 0;
    background: none;
    color: #c9ced6;
    font: inherit;
    cursor: pointer;
}
.row {
    display: flex;
    gap: 8px;
}
.choice {
    flex: 1 1 0;
    min-height: 52px;
    padding: 0 12px;
    border: 1px solid #3a3f4a;
    border-radius: 10px;
    background: #2a2e37;
    color: #f1f2f4;
    font: inherit;
    cursor: pointer;
}
/* Longer in green, end in red (user, 2026-11-27): the two kinds of tap tell themselves apart at a glance. */
.row .choice {
    border-color: #2f7a4b;
    background: #143d24;
    color: #bbf7d0;
}
.choice.end {
    width: 100%;
    border-color: #8b2c2c;
    background: #4a1717;
    color: #fecaca;
}
.choice:disabled {
    opacity: 0.4;
}
/* Something happens (user, 2026-11-27): a turning ring until the screen took the tap. */
.transfer {
    color: #facc15;
}
.transfer.late {
    color: #fca5a5;
}
.transfer-ring {
    display: inline-block;
    box-sizing: border-box;
    width: 14px;
    height: 14px;
    margin-right: 8px;
    vertical-align: -2px;
    border: 2px solid #3a3f4a;
    border-top-color: #facc15;
    border-radius: 50%;
    animation: transfer-turn 0.8s linear infinite;
}
@keyframes transfer-turn {
    to {
        transform: rotate(360deg);
    }
}
@media (prefers-reduced-motion: reduce) {
    .transfer-ring {
        animation-duration: 2.4s;
    }
}
</style>
