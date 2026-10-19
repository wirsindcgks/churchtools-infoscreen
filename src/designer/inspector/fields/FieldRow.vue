<script setup lang="ts">
/**
 * The row every field of the inspector shares (Plan.md 79, B2): the label on the left, the control on the right, an (i)
 * at the end of the row when the `info` slot is filled. `stacked` puts the label above a wide control; `end` pushes a small control (a switch) to the right edge; `wide` gives the label the room and sizes the control to its content (a
 * row of a list, such as a calendar). The `before` slot puts a small mark (a colour dot) in front of the label. In the short menu
 * (`quick` mode) the row goes through `QuickField`: not drawn without `quick`, else a chip with `face` or, with `inline`, in the menu itself.
 * In the sheet of a phone's bar, whose title is the label already, the label is kept for a screen reader only (Plan.md 88, C).
 */
import { computed, inject, ref } from 'vue';
import HintRow from '../../HintRow.vue';
import InfoHint from '../../InfoHint.vue';
import { SHEET_TITLE } from '../mode';
import QuickField from './QuickField.vue';

const props = defineProps<{ label: string; for?: string; labelId?: string; stacked?: boolean; end?: boolean; wide?: boolean; quick?: boolean; face?: string; inline?: boolean; infoBeside?: boolean }>();
defineSlots<{ default(): unknown; info?(): unknown; before?(): unknown }>();
const sheetTitle = inject(SHEET_TITLE, ref(null));
const besideNow = computed(() => props.stacked && props.infoBeside);
</script>

<template>
    <QuickField v-slot="{ inSheet }" :quick="quick" :label="label" :face="face" :inline="inline">
        <HintRow>
            <div class="d-field field-row" :class="{ 'field-row--stacked': stacked, 'field-row--wide': wide, 'field-row--quiet': inSheet || sheetTitle === label }">
                <div class="field-label-box">
                    <slot name="before" />
                    <label v-if="props.for" class="field-label" :for="props.for">{{ label }}</label>
                    <span v-else :id="labelId" class="field-label">{{ label }}</span>
                </div>
                <div class="field-control" :class="{ 'field-control--end': end }">
                    <slot />
                    <!-- `infoBeside` on a stacked row: the (i) stands beside the control, centred on it, not between label and control. -->
                    <InfoHint v-if="besideNow && $slots.info" class="field-info"><slot name="info" /></InfoHint>
                </div>
            </div>
            <template v-if="!besideNow && $slots.info" #info><slot name="info" /></template>
        </HintRow>
    </QuickField>
</template>

<style scoped>
.field-row {
    grid-template-columns: minmax(0, 6.5rem) minmax(0, 1fr);
    align-items: center;
    gap: 0 8px;
}
.field-row--stacked {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    gap: 4px 0;
}
.field-row--quiet {
    gap: 0;
}
.field-row--quiet .field-label-box {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    white-space: nowrap;
    clip-path: inset(50%);
}
.field-row--wide {
    grid-template-columns: minmax(0, 1fr) auto;
}
.field-label-box {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.field-label {
    min-width: 0;
    overflow-wrap: anywhere;
}
.field-control {
    display: flex;
    align-items: center;
    min-width: 0;
    color: var(--d-text);
    font-size: var(--d-size);
}
.field-row--stacked .field-control {
    gap: 8px;
}
.field-control--end {
    justify-content: flex-end;
}
.field-control > :deep(*) {
    min-width: 0;
}
.field-control > .field-info {
    flex: none;
}
</style>
