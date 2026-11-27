import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClickDoc } from '../agenda/control';
import type { ClickPosition } from '../model/position';
import type { ScreenRepository } from '../store/screen-repository';
import ControlSlides from './ControlSlides.vue';

const NOW = new Date('2026-11-26T10:00:00Z');
const position = (over: Partial<ClickPosition> = {}): ClickPosition => ({
    kind: 'position',
    screenId: 's1',
    playlistId: 'p1',
    advance: 'click',
    slideId: 'b',
    number: 2,
    total: 3,
    slides: [
        { id: 'a', name: 'Begrüßung' },
        { id: 'b', name: 'Lieder' },
        { id: 'c', name: 'Segen' },
    ],
    seq: 0,
    at: NOW.toISOString(),
    ...over,
});

function mountWith(initial: ClickPosition, click: ClickDoc | null = null) {
    // Like the store: what is written is what the next read returns.
    const store = { click };
    const repository = {
        readClick: vi.fn(async () => store.click),
        writeClick: vi.fn(async (doc: ClickDoc) => {
            store.click = doc;
        }),
    };
    const wrapper = mount(ControlSlides, {
        props: { repository: repository as unknown as ScreenRepository, author: 'Max', screenId: 's1', position: initial, readAt: 1 },
        // The buttons go to the bar of the page (Plan.md 135 A) – here they stay in place, so the wrapper finds them.
        global: { stubs: { teleport: true } },
    });
    /** The page reads the position again: what the screen reports now. */
    const reads = async (next: ClickPosition) => {
        await wrapper.setProps({ position: next, readAt: Date.now() });
    };
    const lines = () => (wrapper.emitted('info') ?? []).at(-1)![0] as { lines: string[] };
    return { wrapper, repository, reads, lines };
}

describe('ControlSlides (Plan.md 124 D, 135 C)', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
        vi.setSystemTime(NOW);
    });
    afterEach(() => vi.useRealTimers());

    it('lists the slides with the running one marked, and names the next one on "Vor"', async () => {
        const { wrapper, lines } = mountWith(position({ by: 'Anna', clickAt: new Date(NOW.getTime() - 5000).toISOString() }));
        await flushPromises();
        expect(wrapper.findAll('[data-testid="slide-list"] button')).toHaveLength(3);
        expect(wrapper.get('[data-testid="slide-list"] button.active').text()).toContain('Lieder');
        expect(wrapper.get('[data-testid="step-hint"]').text()).toBe('Segen');
        expect(lines().lines).toEqual(['Folie 2 von 3 · Lieder', 'zuletzt Anna, vor 5 s']);
    });

    it('writes a click with the next seq, shown at once, until the screen reports it', async () => {
        const { wrapper, repository, reads, lines } = mountWith(position());
        await wrapper.get('[data-testid="step-forward"]').trigger('click');
        // Shown at once, before anything is written.
        expect(lines().lines[0]).toBe('Folie 3 von 3 · Segen');
        expect(wrapper.emitted('clicked')).toBeTruthy();
        await flushPromises();
        expect(repository.writeClick.mock.calls[0]![0]).toMatchObject({ screenId: 's1', playlistId: 'p1', by: 'Max', actions: [{ seq: 1, do: 'next' }] });
        // The screen has not reported yet: the own click holds, with the author as the last one.
        await reads(position());
        expect(lines().lines).toEqual(['Folie 3 von 3 · Segen', 'zuletzt Max, vor 0 s']);
        // It has: the position counts again.
        await reads(position({ slideId: 'c', number: 3, seq: 1, by: 'Max', clickAt: NOW.toISOString() }));
        expect(lines().lines[0]).toBe('Folie 3 von 3 · Segen');
        expect(wrapper.get('[data-testid="slide-list"] button.active').text()).toContain('Segen');
    });

    it('lets an own click that the screen never confirms go after 20 seconds', async () => {
        const { wrapper, reads, lines } = mountWith(position());
        await wrapper.get('[data-testid="step-forward"]').trigger('click');
        await flushPromises();
        await vi.advanceTimersByTimeAsync(21_000);
        await reads(position());
        expect(lines().lines[0]).toBe('Folie 2 von 3 · Lieder');
    });

    it('clicks in order, each with its own seq', async () => {
        const { wrapper, repository } = mountWith(position());
        await wrapper.get('[data-testid="step-forward"]').trigger('click');
        await wrapper.get('[data-testid="step-back"]').trigger('click');
        await wrapper.get('[data-testid="step-black"]').trigger('click');
        await flushPromises();
        const last = repository.writeClick.mock.calls.at(-1)![0] as ClickDoc;
        expect(last.actions.map((a) => [a.seq, a.do])).toEqual([
            [1, 'next'],
            [2, 'previous'],
            [3, 'black'],
        ]);
    });

    it('shows black and lifts it with the next click, which then moves nothing', async () => {
        const { wrapper, repository, lines } = mountWith(position({ black: true }));
        expect(wrapper.get('[data-testid="step-black"]').text()).toBe('Schwarz aufheben');
        await wrapper.get('[data-testid="step-forward"]').trigger('click');
        expect(lines().lines[0]).toBe('Folie 2 von 3 · Lieder');
        expect(wrapper.get('[data-testid="step-black"]').text()).toBe('Schwarz');
        await flushPromises();
        expect(repository.writeClick).toHaveBeenCalledTimes(1);
    });

    it('goes to a slide of the list', async () => {
        const { wrapper, repository } = mountWith(position());
        await wrapper.findAll('[data-testid="slide-list"] button')[0]!.trigger('click');
        await flushPromises();
        expect(repository.writeClick.mock.calls[0]![0].actions).toEqual([{ seq: 1, do: 'goto', slideId: 'a' }]);
    });

    it('says "Nicht gespeichert" where the write fails, and takes the display back', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { wrapper, repository, lines } = mountWith(position());
        repository.writeClick.mockRejectedValueOnce(new Error('weg'));
        await wrapper.get('[data-testid="step-forward"]').trigger('click');
        await flushPromises();
        expect(wrapper.text()).toContain('Nicht gespeichert');
        expect(lines().lines[0]).toBe('Folie 2 von 3 · Lieder');
    });

    it('starts over after the last slide: "Vor" names the first and moves the display there (user, 2026-11-27)', async () => {
        const { wrapper, repository, lines } = mountWith(position({ slideId: 'c', number: 3 }));
        const forward = wrapper.get('[data-testid="step-forward"]');
        expect(forward.attributes('disabled')).toBeUndefined();
        expect(wrapper.get('[data-testid="step-hint"]').text()).toContain('Begrüßung');
        await forward.trigger('click');
        await flushPromises();
        expect(repository.writeClick.mock.calls[0]![0].actions).toEqual([{ seq: 1, do: 'next' }]);
        expect(lines().lines[0]).toBe('Folie 1 von 3 · Begrüßung');
    });

    it('keeps "Zurück" usable on the first slide and does not move the display there (the player decides)', async () => {
        const { wrapper, repository, lines } = mountWith(position({ slideId: 'a', number: 1 }));
        await wrapper.get('[data-testid="step-back"]').trigger('click');
        await flushPromises();
        expect(repository.writeClick.mock.calls[0]![0].actions).toEqual([{ seq: 1, do: 'previous' }]);
        expect(lines().lines[0]).toBe('Folie 1 von 3 · Begrüßung');
    });

    it('takes a presenter key like the button', async () => {
        const { repository } = mountWith(position());
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        await flushPromises();
        expect(repository.writeClick.mock.calls[0]![0].actions).toEqual([{ seq: 1, do: 'next' }]);
    });
});
