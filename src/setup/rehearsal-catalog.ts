import type { RehearsalCatalogDoc } from '../agenda/control';

/**
 * The list for the musicians in `steuerung` (Plan.md 125 A, 135 D): the page "Musiker" keeps it in step with the release, so that a renamed
 * presentation or screen does not stay under its old name on the phone.
 */
export interface Named {
    id: string;
    name: string;
}

export interface CatalogLists {
    screens: Named[];
    playlists: Named[];
    clickScreens: Named[];
}

/** The same ids with the same names, in any order. */
function sameNamed(a: readonly Named[], b: readonly Named[]): boolean {
    return a.length === b.length && a.every((x) => b.some((y) => y.id === x.id && y.name === x.name));
}

/** Whether the stored list differs from what the release says – in the names or in the set of screens and presentations. A list that is missing differs only where something is released. */
export function catalogOutdated(stored: RehearsalCatalogDoc | null, wanted: CatalogLists): boolean {
    if (!stored) return wanted.screens.length + wanted.playlists.length + wanted.clickScreens.length > 0;
    return !sameNamed(stored.screens, wanted.screens) || !sameNamed(stored.playlists, wanted.playlists) || !sameNamed(stored.clickScreens, wanted.clickScreens);
}

/**
 * The names of the released presentations that still exist but have no rehearsal sheet any more (or never had): the page warns about them.
 * `all` – every presentation, `withSheet` – those with a sheet of the source "Probe".
 */
export function releasedWithoutSheet(releasedIds: readonly string[], all: readonly Named[], withSheet: readonly Named[]): string[] {
    return releasedIds.flatMap((id) => {
        const p = all.find((x) => x.id === id);
        return p && !withSheet.some((x) => x.id === id) ? [p.name] : [];
    });
}
