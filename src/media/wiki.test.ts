import { churchtoolsClient } from '@churchtools/churchtools-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findOrCreateCategory, setCategoryInMenu } from './wiki';

describe('the wiki area of the media library (G36)', () => {
    afterEach(() => vi.restoreAllMocks());

    it('is created under „Ausgeblendet": the library is looked after in the designer', async () => {
        vi.spyOn(churchtoolsClient, 'get').mockResolvedValue([]);
        const post = vi.spyOn(churchtoolsClient, 'post').mockResolvedValue({ id: 7, name: 'Infoscreen' });
        await findOrCreateCategory();
        expect(post.mock.calls[0]?.[1]).toMatchObject({ name: 'Infoscreen', inMenu: false, fileAccessWithoutPermission: false });
    });

    it('moves between „Kategorien" and „Ausgeblendet" with the whole category, as PUT wants it', async () => {
        const put = vi.spyOn(churchtoolsClient, 'put').mockResolvedValue({ id: 1, name: 'Infoscreen', inMenu: false });
        await setCategoryInMenu({ id: 1, name: 'Infoscreen', sortKey: 99, campusId: null, inMenu: true, fileAccessWithoutPermission: false }, false);
        expect(put).toHaveBeenCalledWith('/wiki/categories/1', {
            name: 'Infoscreen',
            sortKey: 99,
            campusId: null,
            inMenu: false,
            fileAccessWithoutPermission: false,
        });
    });
});
