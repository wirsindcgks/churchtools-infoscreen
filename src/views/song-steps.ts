import { stepPart, type PartRef } from '../agenda/control';
import type { AgendaEvent } from '../agenda/live';
import { sheetOf, type SheetSection } from '../agenda/songsheet';
import { t } from '../i18n/designer';

/** The pure parts of the song on the phone page (Plan.md 135 C): the steps within a song and the song after it. */

/**
 * The part "Vor" or "Zurück" goes to, within the song – never over its border (Plan.md 124): at the last part "Vor" stays, at the first
 * "Zurück" too; the song changes with the agenda or by the choice of a musician ("Danach"). `current` – the part on show, `null` before
 * any (forward then leads to the first part of the agenda). From a part outside the flow forward `stepPart` would lead to the next song,
 * which stays out as well.
 */
export function stayInSong(event: AgendaEvent, current: PartRef | null, direction: 1 | -1): PartRef | null {
    const part = stepPart(event, current, direction);
    return part && (!current || part.itemIndex === current.itemIndex) ? part : null;
}

/** The name of a part on its button. */
export function sectionName(section: SheetSection | undefined, index: number): string {
    return section?.label || t.control.part(index + 1);
}

/** The name of a part of the agenda; empty for a part that is not there. */
export function partName(event: AgendaEvent, part: PartRef | null): string {
    const item = part ? event.items[part.itemIndex] : undefined;
    const sections = item ? (sheetOf(item)?.sections ?? []) : [];
    return part && sections[part.section] ? sectionName(sections[part.section], part.section) : '';
}

/** The first part in the flow, which "Danach" chooses; `null` for a song without a sheet. */
export function firstSection(parts: SheetSection[]): number | null {
    const at = parts.findIndex((p) => !p.extra);
    return at >= 0 ? at : parts.length ? 0 : null;
}

/** A song of the agenda as the page lists it: the index of its item, its name, key and parts. */
export interface SongEntry {
    index: number;
    title: string;
    key?: string;
    parts: SheetSection[];
}

/**
 * The song after the one on show; without one the first song from the point the plan reached (`reached`, an index of the items). `null`
 * after the last.
 */
export function songAfter(songs: SongEntry[], current: SongEntry | null, reached: number): SongEntry | null {
    return songs.find((s) => (current ? s.index > current.index : s.index >= reached)) ?? null;
}
