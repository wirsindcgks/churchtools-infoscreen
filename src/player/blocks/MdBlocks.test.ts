import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import MdBlocks from './MdBlocks.vue';

const render = (text: string) => mount(MdBlocks, { props: { text } });

describe('MdBlocks', () => {
    it('sets a numbered list with its start', () => {
        const ol = render('2. x\n3. y').find('ol');
        expect(ol.attributes('start')).toBe('2');
        expect(ol.findAll('li').map((li) => li.text())).toEqual(['x', 'y']);
    });

    it('sets a plain list', () => {
        const wrapper = render('- a\n- b');
        expect(wrapper.find('ul').findAll('li')).toHaveLength(2);
        expect(wrapper.find('ol').exists()).toBe(false);
    });

    it('sets a quote', () => {
        expect(render('> Zitat').find('blockquote').text()).toBe('Zitat');
    });

    it('sets a table with head and alignment', () => {
        const wrapper = render('| a | b |\n| :--- | ---: |\n| 1 | 2 |');
        expect(wrapper.findAll('thead th').map((th) => th.text())).toEqual(['a', 'b']);
        expect(wrapper.findAll('tbody td').map((td) => td.text())).toEqual(['1', '2']);
        expect(wrapper.find('th').attributes('style')).toContain('text-align: left');
        expect(wrapper.findAll('th')[1]?.attributes('style')).toContain('text-align: right');
    });

    it('sets a paragraph', () => {
        const wrapper = render('Hallo **Welt**');
        expect(wrapper.find('.paragraph').text()).toBe('Hallo Welt');
        expect(wrapper.find('strong').text()).toBe('Welt');
    });
});
