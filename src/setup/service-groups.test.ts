import { describe, expect, it } from 'vitest';
import { grantableServiceGroups } from './service-groups';

describe('grantableServiceGroups (Plan.md 119, G84)', () => {
    it('leaves out the open groups and the ones the administrator does not see', () => {
        const groups = [{ id: 1, viewAll: true }, { id: 2, viewAll: false }, { id: 3 }, { id: 4, viewAll: null }];
        expect(grantableServiceGroups([1, 2, 3, 4, 9], groups)).toEqual([2, 3, 4]);
        expect(grantableServiceGroups([2], [])).toEqual([]);
    });
});
