import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProgressBar from './ProgressBar.vue';

describe('ProgressBar (Plan.md 86)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    const props = () => ({ startedAt: Date.now(), seconds: 10, held: null, bottom: 90, color: '#ff0000', textColor: '#ffffff', fontFamily: 'sans-serif', number: 3, total: 7 });
    const fill = (wrapper: ReturnType<typeof mount>) => wrapper.get<HTMLElement>('.fill').element;

    it('runs linearly over the time that is left, up to the full width', () => {
        const wrapper = mount(ProgressBar, { props: props() });
        expect(fill(wrapper).style.transition).toBe('transform 10000ms linear');
        expect(fill(wrapper).style.transform).toBe('scaleX(1)');
        expect(wrapper.get('[data-testid="slide-progress"]').attributes('style')).toContain('bottom: 122px');
    });

    it('names the slide by its place in the playlist, from two slides on', async () => {
        const wrapper = mount(ProgressBar, { props: props() });
        expect(wrapper.get('[data-testid="slide-number"]').text()).toBe('3/7');
        await wrapper.setProps({ number: 1, total: 1 });
        expect(wrapper.find('[data-testid="slide-number"]').exists()).toBe(false);
    });

    it('lies flush with the sides and the bottom without a number or rounding when set to the edge', () => {
        const wrapper = mount(ProgressBar, { props: { ...props(), edge: true } });
        const style = wrapper.get('[data-testid="slide-progress"]').attributes('style');
        expect(style).toContain('left: 0px');
        expect(style).toContain('right: 0px');
        expect(style).toContain('bottom: 90px');
        expect(wrapper.find('[data-testid="slide-number"]').exists()).toBe(false);
    });

    it('draws one track per slide as segments, the finished ones full, without a number (Plan.md 109)', async () => {
        const wrapper = mount(ProgressBar, { props: { ...props(), segments: true } });
        expect(wrapper.findAll('[data-testid="slide-segment"]')).toHaveLength(7);
        expect(wrapper.find('[data-testid="slide-number"]').exists()).toBe(false);
        expect(wrapper.findAll('.fill--done')).toHaveLength(2);
        const running = () => wrapper.findAll<HTMLElement>('.fill').filter((f) => f.element.style.transition);
        expect(running()).toHaveLength(1);
        expect(running()[0]!.element.style.transition).toBe('transform 10000ms linear');
        await wrapper.setProps({ number: 4 });
        expect(wrapper.findAll('.fill--done')).toHaveLength(3);
        expect(running()).toHaveLength(1);
    });

    it('continues from where it stands when the duration grows', async () => {
        const wrapper = mount(ProgressBar, { props: props() });
        vi.advanceTimersByTime(4000);
        await wrapper.setProps({ seconds: 20 });
        expect(fill(wrapper).style.transition).toBe('transform 16000ms linear');
    });

    it('stands still while held', async () => {
        const wrapper = mount(ProgressBar, { props: props() });
        await wrapper.setProps({ held: 2500 });
        expect(fill(wrapper).style.transition).toBe('none');
        expect(fill(wrapper).style.transform).toBe('scaleX(0.25)');
    });
});
