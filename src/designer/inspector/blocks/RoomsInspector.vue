<script setup lang="ts">
/**
 * The room occupancy (Plan.md 46, 79 B2): which rooms are taken – an overview or the door sign of the first room. Rooms,
 * look and period go to the short menu; look, period and page time stand in "Darstellung".
 */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import type { Block, RoomEntry } from '../../../model/schema';
import { useStageContext } from '../../../player/context';
import { PAGE_SECONDS } from '../../../player/paging';
import type { RoomInfo } from '../../../rooms/normalize';
import Icon from '../../Icon.vue';
import InspectorSection from '../../InspectorSection.vue';
import { useInspectorContext } from '../context';
import QuickField from '../fields/QuickField.vue';
import NumberField from '../fields/NumberField.vue';
import SortList, { type SortItem } from '../fields/SortList.vue';
import TextField from '../fields/TextField.vue';
import TileField from '../fields/TileField.vue';
import ToggleField from '../fields/ToggleField.vue';
import FontSection from '../FontSection.vue';
import { ROOMS_TILES } from '../layouts';
import { move as moveItem } from '../../ops';
import { useBlockEdit } from '../use-block';
import { useInspectorMode } from '../mode';

/** Most rooms a block holds – the schema's limit. */
const ROOMS_MAX = 30;

const props = defineProps<{ block: Extract<Block, { type: 'rooms' }> }>();
/** Only fields stand in the short menu; a hint or a line of text belongs to the inspector. */
const mode = useInspectorMode();
const { setBlock } = useBlockEdit(() => props.block);
/** The preview's stage context: a room's name may come from its data when the designer may not see the room. */
const stage = useStageContext();
const context = useInspectorContext();

const summary = computed(() => `${ROOMS_TILES.find((o) => o.value === props.block.layout)?.label} · ${props.block.days} ${t.inspector.unitDays}`);

/** The name ChurchTools gives the room – from what the designer may see, else from the preview's data. */
function roomName(resourceId: number): string | null {
    return context.rooms?.find((r) => r.id === resourceId)?.name ?? stage.rooms?.find((r) => r.resourceId === resourceId)?.name ?? null;
}

/** The chosen rooms in their order; one the designer may not see is named by number. */
const chosen = computed<SortItem[]>(() =>
    props.block.rooms.map((entry) => {
        const name = roomName(entry.resourceId);
        return { key: entry.resourceId, label: name ?? t.inspector.roomHidden(entry.resourceId), dimmed: !name };
    }),
);

/** The visible rooms not chosen yet, in ChurchTools' order. */
const pickable = computed(() => {
    const picked = new Set(props.block.rooms.map((r) => r.resourceId));
    return (context.rooms ?? []).filter((r) => !picked.has(r.id));
});

function addRooms(infos: RoomInfo[]): void {
    const next = [...props.block.rooms, ...infos.map((r): RoomEntry => ({ resourceId: r.id, hint: '', showTitles: true }))];
    setBlock({ rooms: next.slice(0, ROOMS_MAX) });
}

/** The chosen room joins the list, and the select reads "+ Raum" again. */
function pickRoom(select: HTMLSelectElement): void {
    addRooms(pickable.value.filter((r) => r.id === Number(select.value)));
    select.value = '';
}

function setRoom(index: number, patch: Partial<RoomEntry>): void {
    setBlock({ rooms: props.block.rooms.map((r, i) => (i === index ? { ...r, ...patch } : r)) });
}

function move(from: number, to: number): void {
    if (to < 0 || to >= props.block.rooms.length) return;
    setBlock({ rooms: moveItem(props.block.rooms, from, to) });
}

function remove(index: number): void {
    setBlock({ rooms: props.block.rooms.filter((_, i) => i !== index) });
}
</script>

<template>
    <!-- Choosing and ordering the rooms are one chip "Räume · 2" in the short menu, the first field of the block (Plan.md 79, C5). -->
    <QuickField quick :label="t.inspector.rooms" :face="t.quick.count(t.inspector.rooms, block.rooms.length)">
        <!-- Plan.md 86: an instance without the type "Raum" shows no room until an administrator chooses a type. -->
        <p v-if="context.rooms && !context.rooms.length" class="hint" data-testid="rooms-none">
            {{ context.roomTypeMissing ? t.inspector.roomTypeMissing : t.inspector.noRooms }}
        </p>
        <div v-else-if="context.rooms" class="room-add">
            <!-- Looks like `SelectField` (Plan.md 88): the chevron instead of the global arrow. -->
            <span class="select-box">
                <select
                    :disabled="!pickable.length || block.rooms.length >= ROOMS_MAX"
                    value=""
                    :aria-label="t.inspector.addRoomLabel"
                    data-testid="rooms-add"
                    @change="pickRoom($event.target as HTMLSelectElement)"
                >
                    <option value="">{{ t.inspector.addRoom }}</option>
                    <option v-for="r in pickable" :key="r.id" :value="r.id">{{ r.name }}</option>
                </select>
                <Icon name="chevron-down" :size="14" class="select-icon" />
            </span>
            <button class="d-btn" type="button" :disabled="!pickable.length || block.rooms.length >= ROOMS_MAX" data-testid="rooms-add-all" @click="addRooms(pickable)">
                {{ t.inspector.addAllRooms }}
            </button>
        </div>
        <p v-if="!block.rooms.length" class="hint">{{ t.inspector.noRoomsChosen }}</p>
        <InspectorSection v-else id="room-list" :title="t.inspector.rooms" :summary="t.common.countOf(block.rooms.length, ROOMS_MAX)">
            <template #info>{{ t.inspector.roomsInfo }}</template>
            <SortList :items="chosen" :remove-label="t.inspector.removeRoom" testid="room" row-testid="room-entry" @move="move" @remove="remove">
                <template #row="{ index }">
                    <TextField
                        :model-value="block.rooms[index]!.hint"
                        :label="t.inspector.signpost"
                        :placeholder="t.inspector.signpostPlaceholder"
                        :maxlength="100"
                        testid="room-hint"
                        @update:model-value="setRoom(index, { hint: $event })"
                    />
                    <ToggleField :model-value="block.rooms[index]!.showTitles" :label="t.inspector.showTitles" testid="room-titles" @update:model-value="setRoom(index, { showTitles: $event })">
                        <template #info>{{ t.inspector.showTitlesInfo }}</template>
                    </ToggleField>
                </template>
            </SortList>
        </InspectorSection>
    </QuickField>

    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="summary">
        <TileField quick :model-value="block.layout" :options="ROOMS_TILES" :label="t.inspector.view" testid="rooms-layout" @update:model-value="setBlock({ layout: $event })" />
        <NumberField
            quick
            :model-value="block.days"
            :label="t.inspector.period"
            :unit="t.inspector.unitDays"
            :min="1"
            :max="14"
            testid="rooms-days"
            @update:model-value="setBlock({ days: $event })"
        />
        <NumberField
            v-if="block.layout === 'overview'"
            :model-value="block.pageSeconds ?? PAGE_SECONDS"
            :label="t.inspector.secondsPerPage"
            :unit="t.inspector.unitSeconds"
            :min="5"
            :max="120"
            testid="rooms-seconds"
            @update:model-value="setBlock({ pageSeconds: $event })"
        />
        <p v-if="mode === 'full' && block.layout === 'door'" class="hint" data-testid="rooms-door-hint">
            {{ t.inspector.doorHint }}
        </p>
    </InspectorSection>
    <FontSection :block="block" effects="shadow" />
</template>

<style scoped>
.room-add {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.select-box {
    position: relative;
    display: flex;
    flex: 1 1 9rem;
    min-width: 9rem;
}
.select-box select {
    flex: 1;
    padding-right: 32px;
    background-image: none;
}
.select-icon {
    position: absolute;
    top: 50%;
    right: 12px;
    transform: translateY(-50%);
    pointer-events: none;
}
.room-add .d-btn {
    flex: none;
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
