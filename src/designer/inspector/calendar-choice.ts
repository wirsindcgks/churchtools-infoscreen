import { computed } from 'vue';
import type { Block } from '../../model/schema';
import { pruneRoomsOff } from '../../appointments/rooms';
import type { Calendar } from '../../ct/api';
import { useInspectorContext } from './context';
import { useBlockEdit } from './use-block';

type CalendarBlock = Extract<Block, { calendarIds: number[] }>;

/** The calendar choice of a block with calendars (Plan.md 62), for the `CalendarField` of its inspector. */
export function useCalendarChoice(block: () => CalendarBlock) {
    const context = useInspectorContext();
    const { setBlock } = useBlockEdit(block);

    /** Never fewer than one calendar; a calendar that leaves the block leaves the list of those without rooms, too. */
    function toggleCalendar(id: number, on: boolean): void {
        const current = block();
        const next = on ? [...current.calendarIds, id] : current.calendarIds.filter((c) => c !== id);
        if (!next.length) return;
        const ids = [...new Set(next)].sort((a, b) => a - b);
        setBlock({ calendarIds: ids, ...('roomsOffCalendarIds' in current ? { roomsOffCalendarIds: pruneRoomsOff(current.roomsOffCalendarIds, ids) } : {}) });
    }

    /** The chosen calendars a TV will not show, with names: not public (Plan.md 62). Ids in no list stay unnoticed. */
    const hidden = computed<Calendar[]>(() => (context.hiddenCalendars ?? []).filter((k) => block().calendarIds.includes(k.id)));

    return { calendars: computed(() => context.calendars), hidden, toggleCalendar };
}
