/**
 * The live agenda of ChurchTools, read the way its live view reads it (Plan.md 118, G81): the list of points with the
 * placeholder "not started" in front, the position as an index into it, the countdown and the delay from `switchdate`,
 * `addseconds` and the server time. Pure functions – what is fetched lives in `src/ct/api.ts` and `src/player/data.ts`.
 */

/** One point of `GET /events/{id}/agenda`, as far as this code reads it. */
export interface AgendaItemResponse {
    type?: string | null;
    title?: string | null;
    /** Seconds. */
    duration?: number | null;
    isBeforeEvent?: boolean | null;
    /** A song carries its name here; its `title` is empty (G81). */
    song?: { title?: string | null } | null;
}

/** A point of the live list. Index 0 of the list is the placeholder "not started": no title, no duration. */
export interface LiveItem {
    title: string;
    /** Seconds. */
    duration: number;
    song: boolean;
    beforeEvent: boolean;
}

/** An event of today with its agenda, ready for the live view. Times in milliseconds, so that it survives the offline copy. */
export interface AgendaEvent {
    eventId: number;
    calendarId: number;
    startMs: number;
    endMs: number;
    /** The live list: index 0 is the placeholder. */
    items: LiveItem[];
}

/** The answer of `loadAgendaLivePosition` (G81): all strings but `currentTime`; `null` before the first switch. */
export interface LivePositionResponse {
    pos_id?: string | number | null;
    switchdate?: string | null;
    addseconds?: string | number | null;
    currentTime?: number | null;
}

/** The position read from the server. Never stored on the device: it is old after a few seconds. */
export interface LivePosition {
    /** Index into the live list; 0 = not started. */
    index: number;
    /** Whether anybody has switched yet (`pos_id` was not `null`). */
    set: boolean;
    switchMs: number | null;
    addSeconds: number;
    /** Device time minus server time at the moment of reading, in milliseconds. */
    offsetMs: number;
}

/** The last readings of the positions by event id; `null` = the account may not read this one (no right, G81). */
export type LivePositions = Record<number, LivePosition | null>;

/** The agenda data the blocks read: the events of today with agenda, and the positions read lately. */
export interface AgendaFeed {
    events: AgendaEvent[];
    positions: LivePositions;
}

/** What the live view of ChurchTools shows: the current point, the next, the countdown and the delay. */
export interface AgendaDisplay {
    /** `soon` = before the start, the first point is announced instead of the current one. */
    kind: 'now' | 'soon';
    title: string;
    next: string | null;
    /** Seconds left of the current point; negative once it is over. `null` where there is none. */
    countdownSeconds: number | null;
    /** Seconds the current point began later than planned; negative = early. `null` where there is none. */
    delaySeconds: number | null;
    /** Seconds the current point is given – its duration and the added time; what the circle empties from. `null` where there is none. */
    lengthSeconds: number | null;
}

export interface AgendaPick {
    event: AgendaEvent;
    position: LivePosition | undefined;
    /** `upcoming`: not started yet; `live`: running; `ended`: over, the closing part is still shown. */
    phase: 'upcoming' | 'live' | 'ended';
}

/** The player asks for the position from this long before an event … */
export const POLL_BEFORE_MS = 30 * 60_000;
/** … until this long after its end; also the fallback for "the end is reached" when nobody switches on. */
export const POLL_AFTER_MS = 60 * 60_000;

const PLACEHOLDER: LiveItem = { title: '', duration: 0, song: false, beforeEvent: false };

/** The list of the live view: the placeholder, then the points in the delivered order without headers. */
export function liveItems(items: readonly AgendaItemResponse[]): LiveItem[] {
    const points = items
        .filter((item) => item.type !== 'header')
        .map((item): LiveItem => {
            const song = item.type === 'song';
            const own = (item.title ?? '').trim();
            return {
                title: own || (song ? (item.song?.title ?? '').trim() : ''),
                duration: Math.max(0, Number(item.duration) || 0),
                song,
                beforeEvent: item.isBeforeEvent === true,
            };
        });
    return [PLACEHOLDER, ...points];
}

/** The position from the answer; `nowMs` is the device time of the reading, which gives the offset to the server clock. */
export function parsePosition(raw: LivePositionResponse, nowMs: number): LivePosition {
    const set = raw.pos_id !== null && raw.pos_id !== undefined;
    const index = set ? Math.max(0, Math.trunc(Number(raw.pos_id)) || 0) : 0;
    const switched = raw.switchdate ? Date.parse(raw.switchdate) : NaN;
    return {
        index,
        set,
        switchMs: Number.isNaN(switched) ? null : switched,
        addSeconds: Number(raw.addseconds) || 0,
        offsetMs: typeof raw.currentTime === 'number' ? nowMs - raw.currentTime : 0,
    };
}

/** Server time for a device time, after the offset of the last reading; without a reading the device time. */
export function serverNow(deviceNowMs: number, position: LivePosition | undefined): number {
    return deviceNowMs - (position?.offsetMs ?? 0);
}

/** A song without a duration belongs to the point before it: "next" skips it. */
function skipped(item: LiveItem): boolean {
    return item.song && item.duration === 0;
}

/** The index of the next point after `index` that is shown as "next"; `null` at the end. */
export function nextIndex(items: readonly LiveItem[], index: number): number | null {
    for (let i = Math.max(0, index) + 1; i < items.length; i++) if (!skipped(items[i]!)) return i;
    return null;
}

/** When point `index` was planned to begin: the start of the event, less the points before it, plus the points ahead. */
export function plannedStartMs(event: AgendaEvent, index: number): number {
    let start = event.startMs;
    for (const item of event.items) if (item.beforeEvent) start -= item.duration * 1000;
    for (let i = 1; i < index && i < event.items.length; i++) start += event.items[i]!.duration * 1000;
    return start;
}

/** Seconds the current point began after its plan; `null` before the start (index 0) or without a switch time. */
export function delaySeconds(event: AgendaEvent, position: LivePosition): number | null {
    if (position.index === 0 || position.switchMs === null) return null;
    return Math.round((position.switchMs - plannedStartMs(event, position.index)) / 1000);
}

/** Seconds left of the current point: its duration and the added time, less what passed since the switch. */
export function countdownSeconds(event: AgendaEvent, position: LivePosition, serverNowMs: number): number | null {
    const item = event.items[position.index];
    if (position.index === 0 || !item || position.switchMs === null) return null;
    return Math.round(item.duration + position.addSeconds - (serverNowMs - position.switchMs) / 1000);
}

/**
 * Whether the event is over: its last point with a duration has run out – the position stands on it and its countdown
 * is spent, or stands behind it. What follows with 0:00 is the closing part and still belongs to the event. Without that,
 * an hour after the planned end.
 */
export function endReached(event: AgendaEvent, position: LivePosition | undefined, serverNowMs: number): boolean {
    if (serverNowMs >= event.endMs + POLL_AFTER_MS) return true;
    if (!position?.set) return false;
    let last = -1;
    event.items.forEach((item, i) => {
        if (i > 0 && item.duration > 0) last = i;
    });
    if (last < 0) return false;
    if (position.index > last) return true;
    return position.index === last && (countdownSeconds(event, position, serverNowMs) ?? 1) <= 0;
}

/**
 * The event to show among those of today: first one that is running (position set, end not reached); else the next one that
 * is not started – the first point is announced; else one that is over, whose closing part stays until another event is due.
 * `positions` are the last readings by event id.
 */
export function pickEvent(events: readonly AgendaEvent[], positions: Readonly<LivePositions>, deviceNowMs: number): AgendaPick | null {
    // An event whose position the account may not read stays out: the block would announce "gleich" forever.
    const sorted = events.filter((e) => e.items.length > 1 && positions[e.eventId] !== null).sort((a, b) => a.startMs - b.startMs || a.eventId - b.eventId);
    const state = sorted.map((event) => {
        const position = positions[event.eventId] ?? undefined;
        const over = endReached(event, position, serverNow(deviceNowMs, position));
        return { event, position, over };
    });
    const live = state.find((s) => s.position?.set && !s.over);
    if (live) return { event: live.event, position: live.position, phase: 'live' };
    const upcoming = state.find((s) => !s.position?.set && !s.over);
    if (upcoming) return { event: upcoming.event, position: upcoming.position, phase: 'upcoming' };
    const ended = state.filter((s) => s.position?.set).at(-1);
    return ended ? { event: ended.event, position: ended.position, phase: 'ended' } : null;
}

/** The events whose position is worth asking for now: from half an hour before the start until an hour after the end. */
export function pollableEvents(events: readonly AgendaEvent[], deviceNowMs: number): AgendaEvent[] {
    return events.filter((e) => deviceNowMs >= e.startMs - POLL_BEFORE_MS && deviceNowMs <= e.endMs + POLL_AFTER_MS);
}

/** What the view shows for a pick at this device time; `null` where there is nothing to say. */
export function agendaDisplay(pick: AgendaPick | null, deviceNowMs: number): AgendaDisplay | null {
    if (!pick) return null;
    const { event, position, phase } = pick;
    const last = event.items.length - 1;
    if (last < 1) return null;
    if (phase === 'upcoming' || !position || position.index === 0) {
        return { kind: 'soon', title: event.items[1]!.title, next: null, countdownSeconds: null, delaySeconds: null, lengthSeconds: null };
    }
    const index = Math.min(position.index, last);
    const next = nextIndex(event.items, index);
    return {
        kind: 'now',
        title: event.items[index]!.title,
        next: next === null ? null : event.items[next]!.title,
        countdownSeconds: countdownSeconds(event, { ...position, index }, serverNow(deviceNowMs, position)),
        delaySeconds: delaySeconds(event, { ...position, index }),
        lengthSeconds: event.items[index]!.duration + position.addSeconds,
    };
}
