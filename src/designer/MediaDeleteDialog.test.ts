// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../media/library';
import MediaDeleteDialog from './MediaDeleteDialog.vue';

function item(fileId: number, used = false): MediaItem {
    return {
        fileId,
        name: `bild-${fileId}.png`,
        imageUrl: `https://example.org/images/${fileId}/bild.png`,
        kind: 'image',
        page: 'mediathek',
        mediaId: `m-${fileId}`,
        uses: used
            ? [{ playlist: { id: 'p', name: 'Gottesdienst' }, slide: { id: 's', name: 'Begrüßung' }, screens: [{ id: 'f', slug: 'foyer', name: 'Foyer' }] }]
            : [],
    };
}

const find = (wrapper: ReturnType<typeof mount>, id: string) => wrapper.find(`[data-testid="${id}"]`);

describe('MediaDeleteDialog', () => {
    it('deletes unused files without a warning', async () => {
        const items = [item(1), item(2)];
        const wrapper = mount(MediaDeleteDialog, { props: { items } });
        expect(wrapper.find('h2').text()).toBe('2 Dateien löschen?');
        expect(find(wrapper, 'media-delete-warning').exists()).toBe(false);
        expect(find(wrapper, 'media-delete-unused-only').exists()).toBe(false);
        await find(wrapper, 'media-delete-confirm').trigger('click');
        expect(wrapper.emitted('confirm')).toEqual([[items]]);
    });

    it('names every place a file is still shown and offers to spare it', async () => {
        const items = [item(1, true), item(2)];
        const wrapper = mount(MediaDeleteDialog, { props: { items } });
        expect(find(wrapper, 'media-delete-warning').text()).toContain('Eine Datei wird noch gezeigt');
        expect(find(wrapper, 'media-delete-used').text()).toContain('Foyer › Gottesdienst › Begrüßung');
        expect(find(wrapper, 'media-delete-confirm').text()).toBe('Alle 2 löschen');
        await find(wrapper, 'media-delete-unused-only').trigger('click');
        expect(wrapper.emitted('confirm')).toEqual([[[items[1]]]]);
    });

    it('asks "Trotzdem löschen" for a single file in use', () => {
        const wrapper = mount(MediaDeleteDialog, { props: { items: [item(1, true)] } });
        expect(wrapper.find('h2').text()).toBe('„bild-1.png" löschen?');
        expect(find(wrapper, 'media-delete-confirm').text()).toBe('Trotzdem löschen');
        expect(find(wrapper, 'media-delete-unused-only').exists()).toBe(false);
    });
});
