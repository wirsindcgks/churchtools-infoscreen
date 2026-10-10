<script setup lang="ts">
/**
 * Align and distribute the chosen blocks (Plan.md 79, D4): per axis three buttons for the edges and the middle and one for spreading. The same
 * code stands in the inspector (`full`: the buttons right there), in the short menu over several blocks (a chip with this
 * panel below) and in the bar of a phone (a sheet) – `QuickField` makes the difference.
 * Aligning is off where nothing may move (all locked). Distributing keeps `aria-disabled` instead of `disabled`, so the
 * hint on hover can say why it is off.
 */
import { computed } from 'vue';
import { t } from '../i18n/designer';
import { alignTarget, distributeBlocker, type Axis, type Edge } from './arrange';
import { useEditorStore } from './editor-store';
import Icon, { type IconName } from './Icon.vue';
import QuickField from './inspector/fields/QuickField.vue';
import { vTip } from './tip';

const editor = useEditorStore();

type Button<T> = T & { icon: IconName; label: string };
const ROWS: { axis: Axis; edges: Button<{ edge: Edge }>[]; spread: Button<object> }[] = [
    {
        axis: 'x',
        edges: [
            { edge: 'left', icon: 'arrange-left', label: t.arrange.left },
            { edge: 'center', icon: 'arrange-center', label: t.arrange.center },
            { edge: 'right', icon: 'arrange-right', label: t.arrange.right },
        ],
        spread: { icon: 'distribute-x', label: t.arrange.distributeX },
    },
    {
        axis: 'y',
        edges: [
            { edge: 'top', icon: 'arrange-top', label: t.arrange.top },
            { edge: 'middle', icon: 'arrange-middle', label: t.arrange.middle },
            { edge: 'bottom', icon: 'arrange-bottom', label: t.arrange.bottom },
        ],
        spread: { icon: 'distribute-y', label: t.arrange.distributeY },
    },
];

const canAlign = computed(() => !!alignTarget(editor.selection, editor.stage));

/** The hint of a distribute button: its name, or why it is off. */
function distributeTip(axis: Axis, label: string): string {
    const why = distributeBlocker(editor.selection, axis);
    return why === 'few' ? t.arrange.few : why === 'locked' ? t.arrange.locked : label;
}

function distribute(axis: Axis): void {
    if (!distributeBlocker(editor.selection, axis)) editor.distributeSelection(axis);
}
</script>

<template>
    <QuickField quick :label="t.arrange.label" :face="t.arrange.label">
        <!-- One row per axis: its three edges, then spreading along it – narrow enough for a tablet's column (user, 2026-10-10). -->
        <div class="arrange" role="group" :aria-label="t.arrange.label" data-testid="arrange">
            <div v-for="row in ROWS" :key="row.axis" class="arrange-row">
                <button
                    v-for="e in row.edges"
                    :key="e.edge"
                    v-tip="e.label"
                    class="d-btn d-btn--icon"
                    type="button"
                    :aria-label="e.label"
                    :disabled="!canAlign"
                    :data-testid="`arrange-${e.edge}`"
                    @click="editor.alignSelection(e.edge)"
                >
                    <Icon :name="e.icon" :size="16" />
                </button>
                <button
                    v-tip="distributeTip(row.axis, row.spread.label)"
                    class="d-btn d-btn--icon arrange-spread"
                    :class="{ 'arrange-off': !!distributeBlocker(editor.selection, row.axis) }"
                    type="button"
                    :aria-label="row.spread.label"
                    :aria-disabled="distributeBlocker(editor.selection, row.axis) ? 'true' : undefined"
                    :data-testid="`distribute-${row.axis}`"
                    @click="distribute(row.axis)"
                >
                    <Icon :name="row.spread.icon" :size="16" />
                </button>
            </div>
        </div>
    </QuickField>
</template>

<style scoped>
.arrange {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--d-space-1);
}
.arrange-row {
    display: flex;
    gap: var(--d-space-1);
}
/* Spreading stands a step apart from the three edges of its axis. */
.arrange-spread {
    margin-left: var(--d-space-2);
}
/* Looks like a disabled button but stays hoverable, so the hint can give the reason. */
.arrange-off {
    opacity: 0.5;
    cursor: default;
}
.arrange-off:hover {
    background: inherit;
}
</style>
