<script setup lang="ts">
/**
 * A group as one row of the layer list (Plan.md 79, D9): handle, arrow, symbol, "Gruppe", the number of blocks and a
 * lock for all of them. Open, its members stand indented below as a list of their own that sorts among themselves.
 * A click on the row chooses the whole group; a click on a member chooses it alone.
 */
import { computed, ref } from 'vue';
import { t } from '../i18n/designer';
import { useEditorStore } from './editor-store';
import Icon from './Icon.vue';
import LayerItem from './LayerItem.vue';
import type { LayerRow, SummaryLookup } from './layers';
import { vTip } from './tip';
import { useSortable } from './useSortable';

const props = defineProps<{ groupId: string; rows: LayerRow[]; open: boolean; lookup: SummaryLookup }>();
const emit = defineEmits<{ toggle: []; chooseGroup: [event: MouseEvent]; chooseMember: [id: string, event: MouseEvent] }>();

const editor = useEditorStore();

const locked = computed(() => props.rows.some((r) => r.block.locked));
const whole = computed(() => props.rows.every((r) => editor.isSelected(r.block.id)));

// The members are listed top first: place d of the list is place n - 1 - d among them.
const members = ref<HTMLElement | null>(null);
useSortable({
    container: members,
    fixed: (index) => !!props.rows[index]?.block.locked,
    onMove: (from, to) => editor.moveGroupLayer(props.groupId, props.rows.length - 1 - from, props.rows.length - 1 - to),
});
</script>

<template>
    <li class="layer-group" data-sort-item data-testid="layer-group">
        <div class="layer-item" :class="{ 'layer-item--on': whole }" data-testid="layer-group-row" @click="emit('chooseGroup', $event)">
            <button class="layer-handle" type="button" data-sort-handle :disabled="locked" :aria-label="t.common.dragToSort" data-testid="layer-handle" @click.stop>
                <Icon name="grip" :size="14" />
            </button>
            <button
                class="layer-group-toggle"
                :class="{ 'layer-group-toggle--closed': !open }"
                type="button"
                :aria-expanded="open"
                :aria-label="open ? t.inspector.groupClose : t.inspector.groupOpen"
                data-testid="layer-group-toggle"
                @click.stop="emit('toggle')"
            >
                <Icon name="chevron-down" :size="14" />
            </button>
            <span
                v-if="editor.multiSelect"
                class="layer-check"
                :class="{ 'layer-check--on': whole }"
                role="checkbox"
                :aria-checked="whole"
                data-testid="layer-check"
            >
                <Icon v-if="whole" name="check" :size="12" />
            </span>
            <Icon name="group" :size="16" class="layer-icon" />
            <span class="layer-name">{{ t.inspector.group }}</span>
            <span class="layer-sub">{{ t.inspector.groupSize(rows.length) }}</span>
            <button
                v-tip="locked ? t.quick.unlock : t.common.lock"
                class="layer-lock"
                :class="{ 'layer-lock--on': locked }"
                type="button"
                :aria-pressed="locked"
                :aria-label="locked ? t.quick.unlock : t.common.lock"
                data-testid="layer-lock"
                @click.stop="editor.setLocked(rows.map((r) => r.block.id), !locked)"
            >
                <Icon :name="locked ? 'lock' : 'unlock'" :size="14" />
            </button>
        </div>
        <ol v-if="open" ref="members" class="layer-members" data-testid="layer-group-members">
            <LayerItem v-for="row in rows" :key="row.block.id" :block="row.block" :lookup="lookup" nested @choose="emit('chooseMember', row.block.id, $event)" />
        </ol>
    </li>
</template>

<style scoped>
.layer-group {
    display: grid;
    gap: 2px;
}
.layer-members {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
}
</style>
