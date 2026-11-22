import type { ServiceGroupResponse } from '../appointments/services';

/** Only the service groups the administrator sees and that are not open get a right for their notes (Plan.md 119, G84). */
export function grantableServiceGroups(ids: number[], groups: readonly ServiceGroupResponse[]): number[] {
    const closed = new Set(groups.filter((g) => typeof g.id === 'number' && g.viewAll !== true).map((g) => g.id));
    return ids.filter((id) => closed.has(id));
}
