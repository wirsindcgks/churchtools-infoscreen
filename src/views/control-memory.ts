import type { AgendaEvent } from '../agenda/live';

/**
 * What the stage page knew when it was left, kept in memory for this tab: the next visit shows it at once and reads anew behind it.
 * Without it every switch "Designer | Bühne" showed "Wird geladen …" and the switch itself only once the rights were read – it looked
 * like a reload of the whole page (user, 2026-11-13). `designerToo` is also set by the switch: who comes from the designer is a designer.
 */
export const controlMemory: { designerToo: boolean; events: AgendaEvent[] | null; eventId: number | null; timeZone: string | null } = {
    designerToo: false,
    events: null,
    eventId: null,
    timeZone: null,
};
