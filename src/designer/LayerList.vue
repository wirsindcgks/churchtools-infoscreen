<script setup lang="ts">
/**
 * The layers of the slide as a list, top layer first (Plan.md 79, D6, D9): a row per block, a group as one row. A click
 * chooses the block or the group (Shift, Ctrl or ⌘ adds it; in the mode "Mehrere auswählen" every click does), a drag
 * changes the layer – a group moves as a whole, its members only among themselves.
 * It stands in "Anordnen" and, while nothing is chosen, over the slide's settings.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useEditorStore } from './editor-store';
import { useInspectorContext } from './inspector/context';
import LayerGroup from './LayerGroup.vue';
import LayerItem from './LayerItem.vue';
import { layerEntries } from './layers';
import { useSortable } from './useSortable';

/** A row was chosen on its own (no added click, outside the mode): on a phone the sheet closes then. */
const emit = defineEmits<{ picked: [] }>();

const editor = useEditorStore();
const context = useInspectorContext();

/** The entries, top first; a drag reorders the units in the slide (a unit with a locked block keeps its place). */
const entries = computed(() => layerEntries(editor.slide?.blocks ?? []));
const layerList = ref<HTMLElement | null>(null);
const isLockedAt = (index: number): boolean => {
    const entry = entries.value[index];
    return !!entry && (entry.kind === 'block' ? !!entry.row.block.locked : entry.rows.some((r) => r.block.locked));
};
// The list shows the units backwards: place d of the list is place n - 1 - d of the units.
useSortable({
    container: layerList,
    fixed: isLockedAt,
    onMove: (from, to) => editor.moveLayerUnit(entries.value.length - 1 - from, entries.value.length - 1 - to),
});

/** The open groups – a group is closed from the start, opens by itself when a part of it is chosen, and stays so until closed. */
const openGroups = ref(new Set<string>());
watch(
    () => editor.selectedBlockIds.join(','),
    () => {
        for (const entry of entries.value) {
            if (entry.kind !== 'group') continue;
            const count = entry.rows.filter((r) => editor.isSelected(r.block.id)).length;
            if (count > 0 && count < entry.rows.length) openGroups.value.add(entry.groupId);
        }
    },
    { immediate: true },
);
function toggleOpen(groupId: string): void {
    if (!openGroups.value.delete(groupId)) openGroups.value.add(groupId);
}

const lookup = {
    mediaName: (id: string) => editor.media.find((m) => m.id === id)?.name,
    calendarName: (id: number) => [...context.calendars, ...(context.hiddenCalendars ?? [])].find((c) => c.id === id)?.name,
    roomName: (id: number) => context.rooms?.find((r) => r.id === id)?.name,
};

function isAdding(event: MouseEvent): boolean {
    return event.shiftKey || event.ctrlKey || event.metaKey || editor.multiSelect;
}

function choose(id: string, event: MouseEvent): void {
    if (isAdding(event)) {
        editor.toggleBlock(id);
        return;
    }
    editor.selectBlock(id);
    emit('picked');
}

/** The whole group, found by its topmost member. */
function chooseGroup(id: string, event: MouseEvent): void {
    if (isAdding(event)) {
        editor.toggleGroup(id);
        return;
    }
    editor.pickBlock(id);
    emit('picked');
}

onBeforeUnmount(() => {
    editor.hoveredBlockId = null;
});
</script>

<template>
    <ol ref="layerList" class="layer-list" data-testid="layer-list">
        <template v-for="entry in entries" :key="entry.kind === 'block' ? entry.row.block.id : entry.groupId">
            <LayerItem v-if="entry.kind === 'block'" :block="entry.row.block" :lookup="lookup" @choose="choose(entry.row.block.id, $event)" />
            <LayerGroup
                v-else
                :group-id="entry.groupId"
                :rows="entry.rows"
                :open="openGroups.has(entry.groupId)"
                :lookup="lookup"
                @toggle="toggleOpen(entry.groupId)"
                @choose-group="chooseGroup(entry.rows[0]!.block.id, $event)"
                @choose-member="choose"
            />
        </template>
    </ol>
</template>

<style scoped>
/* The layers, top first; the members of an open group stand indented below its row. */
.layer-list {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
}
</style>
