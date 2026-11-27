<script setup lang="ts">
/**
 * The card of the monitor at the top of the middle (Plan.md 135 C, D): its name, "Wechseln" where there are several, a chip with what runs
 * (the "?" beside it shows who follows) and one small line below it. Where the screen is released for rehearsals: "Probe starten", and while a rehearsal runs the buttons to extend
 * and end it. What the screen shows comes from its position only.
 */
import { onBeforeUnmount, ref } from 'vue';
import HelpButton from '../designer/HelpButton.vue';
import Icon from '../designer/Icon.vue';
import { t } from '../i18n/designer';
import type { Monitor, MonitorState } from './monitor-state';
import { EXTEND_HOURS } from './rehearsal-override';

const transferText = { saving: t.control.transferSaving, start: t.control.transferStart, extend: t.control.transferExtend, end: t.control.transferEnd, late: t.control.transferLate };

defineProps<{
    monitors: Monitor[];
    monitor: Monitor;
    /** `null` – no position (yet): see `silent`. */
    state: MonitorState | null;
    /** The lines below the chip, as the page decided them. */
    lines: string[];
    /** The position was read and there is none. */
    silent: boolean;
    /** A rehearsal runs at the screen: the card then shows who started it, and the buttons to extend and end it. */
    rehearsalRunning: boolean;
    /** The write of the rehearsal is on its way: the buttons rest. */
    busy: boolean;
    /** Between the tap and the screen taking it: the card says what happens meanwhile (see `useRehearsalControl`). */
    transfer?: 'saving' | 'start' | 'extend' | 'end' | 'late' | null;
}>();
const emit = defineEmits<{ choose: [id: string]; startRehearsal: []; extend: [hours: number]; endRehearsal: [] }>();

/** The list under "Wechseln": a tap beside it and Escape close it. */
const open = ref(false);
/** The sentence about who follows, shown by the "?" at the chip. */
const infoOpen = ref(false);
const box = ref<HTMLElement | null>(null);
function closeOnOutside(event: Event): void {
    if (open.value && !box.value?.contains(event.target as Node)) open.value = false;
}
function closeOnEscape(event: KeyboardEvent): void {
    if (event.key === 'Escape') open.value = false;
}
document.addEventListener('pointerdown', closeOnOutside);
document.addEventListener('keydown', closeOnEscape);
onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', closeOnOutside);
    document.removeEventListener('keydown', closeOnEscape);
});
function pick(id: string): void {
    open.value = false;
    emit('choose', id);
}
</script>

<template>
    <section class="control-card monitor" data-testid="control-monitor">
        <div class="monitor-top">
            <span class="monitor-name" data-testid="monitor-name">{{ monitor.name }}</span>
            <p v-if="state?.chip" class="chip" :class="`tone-${state.kind}`" data-testid="monitor-chip"><span class="dot" aria-hidden="true" />{{ state.chip }}</p>
            <HelpButton v-if="state?.note" :label="t.control.monitorInfo" :shown="infoOpen" data-testid="monitor-info" @toggle="infoOpen = !infoOpen" />
            <div v-if="monitors.length > 1" ref="box" class="monitor-switch">
                <button type="button" class="switch-button" aria-haspopup="true" :aria-expanded="open" data-testid="monitor-switch" @click="open = !open">
                    {{ t.control.monitorSwitch }}<Icon name="chevron-down" :size="16" />
                </button>
                <ul v-if="open" class="switch-list" role="group" :aria-label="t.control.screenChoose">
                    <li v-for="m in monitors" :key="m.id">
                        <button type="button" :class="{ chosen: m.id === monitor.id }" :aria-pressed="m.id === monitor.id" :data-testid="`monitor-option-${m.id}`" @click="pick(m.id)">{{ m.name }}</button>
                    </li>
                </ul>
            </div>
        </div>
        <p v-if="state?.note && infoOpen" class="line note" data-testid="monitor-note">{{ state.note }}</p>
        <p v-if="lines.length" class="line" data-testid="monitor-line">{{ lines.join(' · ') }}</p>
        <p v-if="transfer" class="line transfer" :class="{ late: transfer === 'late' }" role="status" data-testid="monitor-transfer">
            <span v-if="transfer !== 'late'" class="transfer-ring" aria-hidden="true" /><span>{{ transferText[transfer] }}</span>
        </p>
        <p v-if="silent" class="line" data-testid="monitor-silent">{{ t.control.monitorSilent }}</p>
        <div v-if="rehearsalRunning" class="actions">
            <button v-for="h in EXTEND_HOURS" :key="h" type="button" :disabled="busy" :data-testid="`monitor-extend-${h}`" @click="emit('extend', h)">{{ t.control.rehearsalExtend(h) }}</button>
            <button type="button" :disabled="busy" data-testid="monitor-end" @click="emit('endRehearsal')">{{ t.control.rehearsalEnd }}</button>
        </div>
        <button v-else-if="monitor.rehearsal" type="button" class="rehearsal" data-testid="monitor-rehearsal" @click="emit('startRehearsal')">{{ t.control.rehearsalStart }}</button>
    </section>
</template>

<style scoped>
/* Compact (user, 2026-11-27): the song gets the space – name and chip in one row, one small line, flat buttons. */
.monitor {
    flex: none;
    display: grid;
    gap: 6px;
    padding: 10px 12px;
}
p {
    margin: 0;
}
.monitor-top {
    display: flex;
    align-items: center;
    gap: 8px;
}
/* Bold, but not `strong`: ChurchTools colours that dark blue. */
.monitor-name {
    min-width: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #f1f2f4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.monitor-switch {
    position: relative;
    flex: none;
    margin-left: auto;
}
button {
    border: 1px solid #3a3f4a;
    border-radius: 8px;
    background: #1d2027;
    color: #f1f2f4;
    font: inherit;
    cursor: pointer;
}
.switch-button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 36px;
    padding: 0 8px 0 10px;
    font-size: 0.9rem;
}
.switch-button[aria-expanded='true'] {
    border-color: #6b7180;
}
.switch-list {
    position: absolute;
    z-index: 5;
    top: 100%;
    right: 0;
    margin: 4px 0 0;
    padding: 4px;
    min-width: 200px;
    list-style: none;
    border: 1px solid #3a3f4a;
    border-radius: 10px;
    background: #1d2027;
}
.switch-list button {
    width: 100%;
    min-height: 48px;
    padding: 0 12px;
    border: 0;
    background: none;
    text-align: left;
}
.switch-list button.chosen {
    background: #2a2e37;
    font-weight: 600;
}
/* The chip never shortens: the name gives way. */
.chip {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 10px 2px 8px;
    border-radius: 999px;
    background: #2a2e37;
    font-size: 0.85rem;
    font-weight: 600;
    white-space: nowrap;
}
.dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #8b909a;
}
.tone-service .dot {
    background: #4ade80;
}
.tone-rehearsal .dot {
    background: #facc15;
}
.tone-presentation .dot {
    background: #a78bfa;
}
/* The "?" at the chip is the one of the help in the inspector (user, 2026-11-27); it stands beside the chip, not at the end of the row. */
.monitor-top .help-btn {
    margin-left: 0;
}
.line {
    color: #f1f2f4;
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.line.note {
    color: #b8bcc4;
    white-space: normal;
}
.rehearsal {
    justify-self: start;
    min-height: 38px;
    padding: 0 14px;
    font-size: 0.9rem;
}
.actions {
    display: flex;
    gap: 8px;
}
.actions button {
    flex: 1 1 0;
    min-height: 38px;
    padding: 0 8px;
    font-size: 0.9rem;
}
button:disabled {
    opacity: 0.4;
}
/* Something happens (user, 2026-11-27): a turning ring until the screen took the tap. */
.line.transfer {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #facc15;
    white-space: normal;
}
.line.transfer.late {
    color: #fca5a5;
}
.transfer-ring {
    flex: none;
    width: 14px;
    height: 14px;
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
