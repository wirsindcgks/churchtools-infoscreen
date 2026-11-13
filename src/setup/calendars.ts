/** Only public and released calendars get a right for their events; the rest is named by the check (Plan.md 73, 85 b). */
export function grantableCalendars(ids: number[], publicIds: readonly number[], releasedIds: readonly number[]): number[] {
    const showable = new Set([...publicIds, ...releasedIds]);
    return ids.filter((id) => showable.has(id));
}
