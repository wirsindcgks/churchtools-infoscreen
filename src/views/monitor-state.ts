import type { RehearsalCatalogDoc } from '../agenda/control';
import { t } from '../i18n/designer';
import { LOCALE } from '../i18n/player';
import { hasSlides, type PositionDoc } from '../model/position';

/** The pure parts of the monitor card and the middle of the phone page (Plan.md 135 C). */

/** A screen the musicians may steer: released for rehearsals or for the click steering. */
export interface Monitor {
    id: string;
    name: string;
    /** Released for the rehearsal override, so "Probe …" is offered. */
    rehearsal: boolean;
}

/** The screens of both releases in `steuerung`, each once by id: the rehearsal screens first, then the click screens that are new. */
export function monitorList(catalog: Pick<RehearsalCatalogDoc, 'screens' | 'clickScreens'> | null): Monitor[] {
    if (!catalog) return [];
    const list: Monitor[] = catalog.screens.map((s) => ({ id: s.id, name: s.name, rehearsal: true }));
    for (const s of catalog.clickScreens) if (!list.some((m) => m.id === s.id)) list.push({ id: s.id, name: s.name, rehearsal: false });
    return list;
}

/** The remembered monitor while it is still released, else the first one; `null` without any. */
export function pickMonitor(list: Monitor[], remembered: string | null): Monitor | null {
    return list.find((m) => m.id === remembered) ?? list[0] ?? null;
}

/** What the middle of the page shows – never two of them: the song of the service, the song of the rehearsal, the slides, or nothing. */
export type Middle = 'service' | 'rehearsal' | 'slides' | 'none';

export interface MonitorState {
    /** The dot and the colour of the chip; `none` – the screen reports nothing. */
    kind: 'service' | 'rehearsal' | 'presentation' | 'schedule' | 'none';
    chip: string | null;
    /** What the position alone says below the chip; the middle may put its own lines in place of them (the own click, the plan of the service). */
    lines: string[];
    /** The small sentence about who follows the song. */
    note: string | null;
    middle: Middle;
}

const clock = (ms: number, timeZone: string) => new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone }).format(ms);

/** "zuletzt Anna, vor 5 s". */
export function lastClickText(by: string | null, at: number, now: number): string {
    return t.control.clickLast(by, t.control.clickAgo(Math.max(0, Math.round((now - at) / 1000))));
}

/** The lines of a presentation at the click: the slide and who clicked last. */
export function slideLines(shown: { slideId: string; number: number; total: number; slides: { id: string; name: string }[] }, last: { by: string | null; at: number } | null, now: number): string[] {
    const name = shown.slides.find((s) => s.id === shown.slideId)?.name ?? '';
    return [t.control.slideLine(shown.number, shown.total, name), ...(last ? [lastClickText(last.by, last.at, now)] : [])];
}

/**
 * What the monitor shows, from the position it reported (Plan.md 135 C): the chip, the lines below, and what the middle of the page shows.
 * The songsheet of the agenda counts first: a rehearsal over a presentation with such a songsheet shows the songs of the service, which is
 * what the screen shows. `null` – the screen reported nothing.
 * `eventStartMs`: the start of the event the songsheet follows, where the page knows it.
 */
export function monitorState(position: PositionDoc | null, now: number, context: { timeZone: string; eventStartMs?: number | null }): MonitorState | null {
    if (!position) return null;
    const sheet = position.songsheet && position.songsheet !== true ? position.songsheet : null;
    const name = position.playlistName || null;
    const clicking = position.advance !== 'time' && hasSlides(position);
    const middle: Middle = sheet ? (sheet.source === 'agenda' ? 'service' : 'rehearsal') : clicking ? 'slides' : 'none';
    const note = sheet ? (sheet.source === 'agenda' ? t.control.followService : t.control.followRehearsal) : null;
    if (sheet?.source === 'agenda') {
        const start = context.eventStartMs ?? null;
        return { kind: 'service', chip: t.control.monitorService(start === null ? null : clock(start, context.timeZone)), lines: [], note, middle };
    }
    if (position.rehearsal) {
        return { kind: 'rehearsal', chip: t.control.monitorRehearsal, lines: [t.control.monitorRehearsalLine(clock(Date.parse(position.rehearsal.until), context.timeZone), position.rehearsal.by ?? null)], note, middle };
    }
    if (clicking && hasSlides(position)) {
        const last = position.clickAt ? { by: position.by ?? null, at: Date.parse(position.clickAt) } : null;
        return { kind: 'presentation', chip: t.control.monitorPresentation(name), lines: slideLines(position, last, now), note, middle };
    }
    return { kind: 'schedule', chip: t.control.monitorSchedule(name), lines: [], note, middle };
}

/**
 * A rehearsal runs at the screen, but its songsheet is neither of the rehearsal nor of the service: the screen shows no rehearsal sheet
 * (Plan.md 135 D, a stale release). Of the position the screen reported – not of what the page laid over it.
 */
export function rehearsalWithoutSheet(position: PositionDoc | null): boolean {
    return !!position?.rehearsal && !(position.songsheet && position.songsheet !== true);
}
