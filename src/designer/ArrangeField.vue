<script setup lang="ts">
/**
 * Align and distribute the chosen blocks (Plan.md 79, D4): six buttons for the edges and middles, two for spreading. The same
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

const EDGES: { edge: Edge; icon: IconName; label: string }[] = [
    { edge: 'left', icon: 'arrange-left', label: t.arrange.left },
    { edge: 'center', icon: 'arrange-center', label: t.arrange.center },
    { edge: 'right', icon: 'arrange-right', label: t.arrange.right },
    { edge: 'top', icon: 'arrange-top', label: t.arrange.top },
    { edge: 'middle', icon: 'arrange-middle', label: t.arrange.middle },
    { edge: 'bottom', icon: 'arrange-bottom', label: t.arrange.bottom },
];
const AXES: { axis: Axis; icon: IconName; label: string }[] = [
    { axis: 'x', icon: 'distribute-x', label: t.arrange.distributeX },
    { axis: 'y', icon: 'distribute-y', label: t.arrange.distributeY },
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
        <div class="arrange" role="group" :aria-label="t.arrange.label" data-testid="arrange">
            <div class="arrange-row">
                <button
                    v-for="e in EDGES"
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
            </div>
            <div class="arrange-row">
                <button
                    v-for="a in AXES"
                    :key="a.axis"
                    v-tip="distributeTip(a.axis, a.label)"
                    class="d-btn d-btn--icon"
                    :class="{ 'arrange-off': !!distributeBlocker(editor.selection, a.axis) }"
                    type="button"
                    :aria-label="a.label"
                    :aria-disabled="distributeBlocker(editor.selection, a.axis) ? 'true' : undefined"
                    :data-testid="`distribute-${a.axis}`"
                    @click="distribute(a.axis)"
                >
                    <Icon :name="a.icon" :size="16" />
                </button>
            </div>
        </div>
    </QuickField>
</template>

<style scoped>
.arrange {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--d-space-2);
}
.arrange-row {
    display: flex;
    gap: var(--d-space-1);
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
