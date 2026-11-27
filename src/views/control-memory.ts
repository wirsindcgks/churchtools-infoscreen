import type { AgendaEvent } from '../agenda/live';
import type { Monitor } from './monitor-state';

/**
 * What the stage page knew when it was left, kept in memory for this tab: the next visit shows it at once and reads anew behind it.
 * Without it every way from the designer to the stage page showed "Wird geladen …" and the head only once the rights were read – it looked
 * like a reload of the whole page (user, 2026-11-13).
 */
export const controlMemory: { monitors: Monitor[] | null; monitorId: string | null; events: AgendaEvent[] | null; eventId: number | null; timeZone: string | null } = {
    monitors: null,
    monitorId: null,
    events: null,
    eventId: null,
    timeZone: null,
};
