import { churchtoolsClient } from '@churchtools/churchtools-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { personGroupIds } from './load';

describe('personGroupIds', () => {
    afterEach(() => vi.restoreAllMocks());

    it('reads the ids from domainIdentifier, a string as ChurchTools sends it (measured 2026-09-28)', async () => {
        vi.spyOn(churchtoolsClient, 'get').mockResolvedValue([
            { group: { domainIdentifier: '28' } },
            { group: { domainIdentifier: null } },
        ]);
        expect(await personGroupIds(22)).toEqual([28]);
    });
});
