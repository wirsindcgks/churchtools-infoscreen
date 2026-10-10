<script setup lang="ts">
/**
 * The row every field of the inspector shares (Plan.md 79, B2): the label on the left, the control on the right, an (i)
 * at the end of the row when the `info` slot is filled. `stacked` puts the label above a wide control; `end` pushes a small control (a switch) to the right edge; `wide` gives the label the room and sizes the control to its content (a
 * row of a list, such as a calendar). The `before` slot puts a small mark (a colour dot) in front of the label. In the short menu
 * (`quick` mode) a field without `quick` is not drawn at all.
 */
import HintRow from '../../HintRow.vue';
import { useFieldVisible } from '../mode';

const props = defineProps<{ label: string; for?: string; labelId?: string; stacked?: boolean; end?: boolean; wide?: boolean; quick?: boolean }>();
defineSlots<{ default(): unknown; info?(): unknown; before?(): unknown }>();
const visible = useFieldVisible(() => props.quick);
</script>

<template>
    <HintRow v-if="visible">
        <div class="d-field field-row" :class="{ 'field-row--stacked': stacked, 'field-row--wide': wide }">
            <div class="field-label-box">
                <slot name="before" />
                <label v-if="props.for" class="field-label" :for="props.for">{{ label }}</label>
                <span v-else :id="labelId" class="field-label">{{ label }}</span>
            </div>
            <div class="field-control" :class="{ 'field-control--end': end }">
                <slot />
            </div>
        </div>
        <template v-if="$slots.info" #info><slot name="info" /></template>
    </HintRow>
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
.field-control--end {
    justify-content: flex-end;
}
.field-control > :deep(*) {
    min-width: 0;
}
</style>
