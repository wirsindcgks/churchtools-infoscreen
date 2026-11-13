import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import QrCode from './QrCode.vue';
import { controlUrl } from './player-url';

describe('QrCode', () => {
    it('draws a square black-on-white SVG of the address', () => {
        const wrapper = mount(QrCode, { props: { value: 'https://example.org/steuerung', size: 140 } });
        const svg = wrapper.get('svg');
        const [, , w, h] = svg.attributes('viewBox')!.split(' ').map(Number);
        expect(w).toBe(h);
        // At least version 1 (21 modules) plus the quiet zone of the block "QR-Code".
        expect(w!).toBeGreaterThan(21);
        expect(svg.attributes('width')).toBe('140');
        expect(wrapper.get('rect').attributes('fill')).toBe('#ffffff');
        expect(wrapper.get('path').attributes('d')!.length).toBeGreaterThan(500);
    });

    it('draws nothing for an empty address', () => {
        expect(mount(QrCode, { props: { value: '' } }).find('svg').exists()).toBe(false);
    });
});

describe('controlUrl', () => {
    it('is the absolute address of the route control', () => {
        expect(controlUrl()).toBe(`${window.location.origin}${import.meta.env.BASE_URL}steuerung`);
    });
});
