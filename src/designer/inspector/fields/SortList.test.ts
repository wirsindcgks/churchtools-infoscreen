import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import SortList from './SortList.vue';

const items = [
    { key: 'a', label: 'Bild A', thumb: 'a.jpg' },
    { key: 'b', label: 'Bild B', thumb: null },
    { key: 'c', label: 'Bild C' },
];

function list() {
    return mount(SortList, { props: { items, removeLabel: 'Bild entfernen', testid: 'gallery' } });
}

describe('SortList', () => {
    it('draws a row per item with the same three symbol buttons, named for assistive technology', () => {
        const wrapper = list();
        expect(wrapper.findAll('[data-testid="gallery-row"]')).toHaveLength(3);
        const first = wrapper.get('[data-testid="gallery-row"]');
        expect(first.findAll('button').map((b) => b.attributes('aria-label'))).toEqual(['Nach oben', 'Nach unten', 'Bild entfernen']);
        expect(first.findAll('button svg')).toHaveLength(3);
    });

    it('cannot move the first up or the last down', () => {
        const wrapper = list();
        expect(wrapper.findAll('[data-testid="gallery-up"]')[0]!.attributes('disabled')).toBeDefined();
        expect(wrapper.findAll('[data-testid="gallery-down"]')[2]!.attributes('disabled')).toBeDefined();
        expect(wrapper.findAll('[data-testid="gallery-down"]')[0]!.attributes('disabled')).toBeUndefined();
    });

    it('reports moving and removing by index', async () => {
        const wrapper = list();
        await wrapper.findAll('[data-testid="gallery-down"]')[0]!.trigger('click');
        await wrapper.findAll('[data-testid="gallery-up"]')[2]!.trigger('click');
        await wrapper.findAll('[data-testid="gallery-remove"]')[1]!.trigger('click');
        expect(wrapper.emitted('move')).toEqual([[0, 1], [2, 1]]);
        expect(wrapper.emitted('remove')).toEqual([[1]]);
    });

    it('names the label, renames the row and keeps the remove button off where asked', () => {
        const wrapper = mount(SortList, {
            props: { items: [{ key: 1, label: 'Saal', keep: true }, { key: 2, label: 'Keller' }], removeLabel: 'Raum entfernen', testid: 'room', rowTestid: 'room-entry' },
        });
        expect(wrapper.findAll('[data-testid="room-entry"]')).toHaveLength(2);
        expect(wrapper.findAll('[data-testid="room-name"]').map((n) => n.text())).toEqual(['Saal', 'Keller']);
        expect(wrapper.findAll('[data-testid="room-remove"]').map((b) => b.attributes('disabled') !== undefined)).toEqual([true, false]);
    });

    it('lets a row carry more fields under its line', () => {
        const wrapper = mount(SortList, {
            props: { items: [{ key: 1, label: 'Saal' }, { key: 2, label: 'Keller' }], removeLabel: 'Raum entfernen', testid: 'room' },
            slots: { row: '<template #row="{ index }"><input :data-testid="`hint-${index}`"></template>' },
        });
        const rows = wrapper.findAll('[data-testid="room-row"]');
        expect(rows[1]!.find('[data-testid="hint-1"]').exists()).toBe(true);
        expect(rows[0]!.find('[data-testid="hint-1"]').exists()).toBe(false);
    });
});
