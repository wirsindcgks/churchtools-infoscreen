import { churchtoolsClient } from '@churchtools/churchtools-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCategory, findCategory, setCategoryInMenu } from './wiki';

describe('the wiki area of the media library (G36, Plan.md F)', () => {
    afterEach(() => vi.restoreAllMocks());

    it('findCategory looks for the area by name and creates nothing without a match', async () => {
        const get = vi.spyOn(churchtoolsClient, 'get').mockResolvedValue([]);
        const post = vi.spyOn(churchtoolsClient, 'post');
        expect(await findCategory()).toBeNull();
        expect(get).toHaveBeenCalledWith('/wiki/categories');
        expect(post).not.toHaveBeenCalled();
    });

    it('findCategory returns a matching area unchanged', async () => {
        vi.spyOn(churchtoolsClient, 'get').mockResolvedValue([{ id: 7, name: 'Infoscreen' }]);
        expect(await findCategory()).toEqual({ id: 7, name: 'Infoscreen' });
    });

    it('createCategory is created under „Ausgeblendet": the library is looked after in the designer', async () => {
        const post = vi.spyOn(churchtoolsClient, 'post').mockResolvedValue({ id: 7, name: 'Infoscreen' });
        await createCategory();
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
