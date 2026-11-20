import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import MdBlocks from './MdBlocks.vue';

describe('MdBlocks – nested lists (Plan.md 131)', () => {
    it('indents a nested list inside its item, numbered on its own', () => {
        const wrapper = mount(MdBlocks, { props: { text: '1. a\n   - b\n     1. b1\n   - c\n2. d' } });
        const outer = wrapper.find('.md-blocks > ol');
        expect(outer.attributes('data-depth')).toBe('0');
        expect(outer.findAll(':scope > li')).toHaveLength(2);

        const nested = outer.find(':scope > li > ul');
        expect(nested.attributes('data-depth')).toBe('1');
        const items = nested.findAll(':scope > li');
        expect(items).toHaveLength(2);
        expect(items[1]?.text()).toBe('c');
        const deepest = items[0]!.find(':scope > ol');
        expect(deepest.attributes('data-depth')).toBe('2');
        expect(deepest.text()).toBe('b1');
    });
});
