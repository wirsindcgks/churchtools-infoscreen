<script setup lang="ts">
/**
 * What the appointment list and the next appointment share beyond their calendars (Plan.md 79, B2): the
 * booked room where no place is entered (Plan.md 50), the rooms to leave out per calendar (Plan.md 51) and per
 * room (Plan.md 82) and the services (Plan.md 51, 58; cards only). None of it goes to the short menu.
 */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import { pruneRoomOffIds, roomsShownInLayout, pruneRoomsOff, toggleRoomOff, toggleRoomsOff } from '../../../appointments/rooms';
import { allowedServiceIds, SERVICES_MAX, toggleServiceIds, type ServiceInfo } from '../../../appointments/services';
import type { Calendar } from '../../../ct/api';
import type { Block } from '../../../model/schema';
import { themeOf, useStageContext } from '../../../player/context';
import { listLayout } from '../../../player/theme';
import InspectorSection from '../../InspectorSection.vue';
import { useInspectorContext } from '../context';
import ToggleField from '../fields/ToggleField.vue';
import { useFieldVisible } from '../mode';
import { useBlockEdit } from '../use-block';

const props = defineProps<{ block: Extract<Block, { type: 'appointment-list' | 'next-appointment' }> }>();
const { setBlock } = useBlockEdit(() => props.block);
/** The preview's stage context: the theme decides the layout of a list that follows it. */
const stage = useStageContext();
const context = useInspectorContext();
const visible = useFieldVisible(() => false);

/** Rooms show in every form of both blocks; services in the card forms only. */
const withServices = computed(() => props.block.type === 'next-appointment' || listLayout(props.block, themeOf(stage)) === 'cards');

/** Whether rooms show: the list by the layout it really has (lists from before 1.34 show none in rows), the next appointment by its switch. */
const roomsOn = computed(() => (props.block.type === 'appointment-list' ? roomsShownInLayout(props.block, listLayout(props.block, themeOf(stage))) : props.block.showRooms === true));

function setShowRooms(on: boolean): void {
    setBlock(props.block.type === 'appointment-list' ? { showRooms: on, roomsInRows: undefined } : { showRooms: on });
}

/** The chosen calendars to switch rooms for: with "Raum zeigen" on and more than one calendar; else null. */
const roomsFor = computed<Calendar[] | null>(() => {
    const b = props.block;
    if (!roomsOn.value || b.calendarIds.length < 2) return null;
    return context.calendars.filter((k) => b.calendarIds.includes(k.id));
});

/** The rooms to switch with "Raum zeigen" on; empty while the master data is missing. */
const roomList = computed(() => (roomsOn.value ? (context.rooms ?? []) : []));

const calendarsOff = computed(() => (roomsFor.value ?? []).some((k) => (props.block.roomsOffCalendarIds ?? []).includes(k.id)));
const roomsOff = computed(() => roomList.value.some((r) => (props.block.roomsOffIds ?? []).includes(r.id)));

/** What the section says when closed: "Alle", or how many rooms are named; "eingeschränkt" when both groups cut. */
const roomsForSummary = computed(() => {
    if (calendarsOff.value && roomsOff.value) return t.inspector.roomsRestricted;
    if (roomsOff.value) {
        const off = props.block.roomsOffIds ?? [];
        return t.common.countOf(roomList.value.filter((r) => !off.includes(r.id)).length, roomList.value.length);
    }
    const shown = roomsFor.value ?? [];
    const off = props.block.roomsOffCalendarIds ?? [];
    const count = shown.filter((k) => !off.includes(k.id)).length;
    return count === shown.length ? t.inspector.all : t.common.countOf(count, shown.length);
});

function toggleRoomsFor(calendarId: number, shown: boolean): void {
    setBlock({ roomsOffCalendarIds: pruneRoomsOff(toggleRoomsOff(props.block.roomsOffCalendarIds, calendarId, shown), props.block.calendarIds) });
}

/** Rooms that are gone from the master data leave the list with the next click – only while the master data is known. */
function toggleRoomsRoom(roomId: number, shown: boolean): void {
    const off = toggleRoomOff(props.block.roomsOffIds, roomId, shown);
    setBlock({ roomsOffIds: context.rooms?.length ? pruneRoomOffIds(off, context.rooms) : off.length ? off : undefined });
}

/** The services to choose from: the showable ones an administrator allowed (Plan.md 58). Null while unknown. */
const choosableServices = computed<ServiceInfo[] | null>(() => {
    if (!context.services) return null;
    const allowed = new Set(allowedServiceIds(context.services.map((s) => s.id), context.allowedServices));
    return context.services.filter((s) => allowed.has(s.id));
});

/** Chosen services that can still be shown – only they count against the limit. */
const shownServiceCount = computed(() => toggleServiceIds(props.block.services, -1, false, choosableServices.value).length);

/** Services not showable any more leave the document with the next click (Plan.md 51). */
function toggleService(id: number, on: boolean): void {
    setBlock({ services: toggleServiceIds(props.block.services, id, on, choosableServices.value && !context.servicesFailed ? choosableServices.value : null) });
}

const servicesSummary = computed(() => (shownServiceCount.value ? t.common.chosen(shownServiceCount.value) : t.common.none));
</script>

<template>
    <template v-if="visible">
        <!-- Plan.md, 50: the booked rooms where no place is entered; Plan.md 82: in both forms of the list. -->
        <ToggleField
            :model-value="roomsOn"
            :label="t.inspector.showRoom"
            testid="show-rooms"
            @update:model-value="setShowRooms($event)"
        >
            <template #info>{{ t.inspector.showRoomInfo }}</template>
        </ToggleField>
        <p v-if="roomsOn && context.roomTypeMissing" class="hint" data-testid="room-type-missing">{{ t.inspector.roomTypeMissing }}</p>
        <!-- Plan.md, 51 and 82: rooms can be left out for single calendars and single rooms. -->
        <InspectorSection v-if="roomsOn" id="rooms-for" :title="t.inspector.roomsFor" :summary="roomsForSummary">
            <div class="groups" data-testid="rooms-for">
                <div v-if="roomsFor" class="group">
                    <h4 class="group-title">{{ t.inspector.roomsForCalendars }}</h4>
                    <div class="list">
                        <ToggleField
                            v-for="c in roomsFor"
                            :key="c.id"
                            :model-value="!(block.roomsOffCalendarIds ?? []).includes(c.id)"
                            :label="c.name"
                            :testid="`rooms-calendar-${c.id}`"
                            @update:model-value="toggleRoomsFor(c.id, $event)"
                        />
                    </div>
                </div>
                <div class="group">
                    <h4 class="group-title">{{ t.inspector.roomsForRooms }}</h4>
                    <div v-if="roomList.length" class="list">
                        <ToggleField
                            v-for="r in roomList"
                            :key="r.id"
                            :model-value="!(block.roomsOffIds ?? []).includes(r.id)"
                            :label="r.name"
                            :testid="`rooms-room-${r.id}`"
                            @update:model-value="toggleRoomsRoom(r.id, $event)"
                        />
                    </div>
                    <p v-else class="hint" data-testid="rooms-none">{{ t.inspector.roomsNone }}</p>
                    <p class="hint">{{ t.inspector.roomsOffInfo }}</p>
                </div>
            </div>
        </InspectorSection>
        <!-- Plan.md, 51: who takes a service – only accepted assignments of services in groups open to all. -->
        <template v-if="withServices">
            <InspectorSection id="services" :title="t.inspector.servicesTitle" :summary="servicesSummary">
                <template #info>
                    {{ t.inspector.servicesInfo }}
                </template>
                <div class="list" data-testid="services-fieldset">
                    <ToggleField
                        v-for="s in choosableServices ?? []"
                        :key="s.id"
                        :model-value="(block.services ?? []).includes(s.id)"
                        :label="s.name"
                        :disabled="!(block.services ?? []).includes(s.id) && shownServiceCount >= SERVICES_MAX"
                        :testid="`service-${s.id}`"
                        @update:model-value="toggleService(s.id, $event)"
                    />
                </div>
            </InspectorSection>
            <p v-if="context.servicesFailed" class="hint" data-testid="services-failed">{{ t.inspector.servicesFailed }}</p>
            <p v-else-if="context.services && !context.services.length" class="hint" data-testid="services-none">
                {{ t.inspector.servicesNone }}
            </p>
            <p v-else-if="choosableServices && !choosableServices.length" class="hint" data-testid="services-not-allowed">
                {{ t.inspector.servicesNotAllowed }}
            </p>
        </template>
    </template>
</template>

<style scoped>
/* A list of switches inside a section; the section brings the gap. */
.list {
    display: grid;
    gap: 8px;
}
.groups {
    display: grid;
    gap: 14px;
}
.group {
    display: grid;
    gap: 8px;
}
.group-title {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    font-weight: 600;
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
