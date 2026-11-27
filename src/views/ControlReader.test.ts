import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SheetSection } from '../agenda/songsheet';
import ControlReader from './ControlReader.vue';
import { isAway } from './reader-scale';

const parts: SheetSection[] = [
    { label: 'Strophe', lines: [{ text: 'Halleluja', chords: [{ at: 0, chord: 'C' }, { at: 5, chord: 'G' }] }] },
    { label: 'Refrain', lines: [{ text: 'Ohne Akkorde', chords: [] }] },
    { label: 'Bridge', lines: [] },
];
const reader = (over: Record<string, unknown> = {}) => mount(ControlReader, { props: { title: 'Lied', songKey: 'C', parts, active: 1, ...over } });

describe('ControlReader (Plan.md 138)', () => {
    beforeEach(() => localStorage.clear());

    it('marks the running part and leaves the others pale; chords stand over the syllables', () => {
        const wrapper = reader();
        const list = wrapper.findAll('[data-testid="reader-part"]');
        expect(list.map((p) => p.classes('running'))).toEqual([false, true, false]);
        expect(list.map((p) => p.attributes('aria-current'))).toEqual([undefined, 'true', undefined]);
        expect(list[0]!.classes()).toContain('pale');
        expect(wrapper.findAll('[data-testid="reader-chord"]').map((c) => c.text())).toEqual(['C', 'G']);
        expect(wrapper.text()).toContain('Ohne Akkorde');
    });

    it('takes the first part as running without a choice', () => {
        const wrapper = reader({ active: null });
        expect(wrapper.findAll('[data-testid="reader-part"]')[0]!.classes()).toContain('running');
    });

    it('says so where the song has no text, or no song runs', () => {
        expect(reader({ parts: [] }).get('[data-testid="reader-none"]').text()).toContain('keinen Text zum Mitlesen');
        expect(reader({ title: null, parts: [] }).text()).toContain('Gerade läuft kein Lied.');
    });

    it('enlarges the font by "+", disables the button at the end and remembers the step', async () => {
        const wrapper = reader();
        const scroller = () => wrapper.get('[data-testid="reader-scroller"]').attributes('style');
        expect(scroller()).toContain('--reader-scale: 1');
        await wrapper.get('[data-testid="reader-larger"]').trigger('click');
        expect(scroller()).toContain('--reader-scale: 1.15');
        for (let i = 0; i < 6; i++) await wrapper.get('[data-testid="reader-larger"]').trigger('click');
        expect(scroller()).toContain('--reader-scale: 2');
        expect(wrapper.get('[data-testid="reader-larger"]').attributes('disabled')).toBeDefined();
        wrapper.unmount();
        expect(reader().get('[data-testid="reader-scroller"]').attributes('style')).toContain('--reader-scale: 2');
    });

    it('goes down to the smallest step and stops there', async () => {
        const wrapper = reader();
        for (let i = 0; i < 3; i++) await wrapper.get('[data-testid="reader-smaller"]').trigger('click');
        expect(wrapper.get('[data-testid="reader-scroller"]').attributes('style')).toContain('--reader-scale: 0.7');
        expect(wrapper.get('[data-testid="reader-smaller"]').attributes('disabled')).toBeDefined();
    });

    it('calls the pill for a running part whose start is above the area or less than three lines above its bottom', () => {
        expect(isAway(100, 100, 600, 30)).toBe(false);
        expect(isAway(300, 100, 600, 30)).toBe(false);
        expect(isAway(40, 100, 600, 30)).toBe(true);
        expect(isAway(520, 100, 600, 30)).toBe(true);
        expect(isAway(500, 100, 600, 30)).toBe(false);
    });
});
