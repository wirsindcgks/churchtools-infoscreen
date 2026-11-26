import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClickDoc, RehearsalDoc } from '../agenda/control';
import type { PositionDoc } from '../model/position';
import type { ScreenRepository } from '../store/screen-repository';
import ControlClick from './ControlClick.vue';
import { controlMemory } from './control-memory';

vi.mock('../ct/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../ct/api')>()), fetchSong: vi.fn(async () => ({ id: 9, name: 'Lied', arrangements: [{ id: 4 }] })) }));
vi.mock('../player/data', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../player/data')>()),
    loadArrangementSheet: vi.fn(async () => ({ sections: [{ label: 'Strophe', lines: [] }, { label: 'Refrain', lines: [] }] })),
}));

const NOW = new Date('2026-11-26T10:00:00Z');
const position = (over: Partial<PositionDoc> = {}): PositionDoc => ({
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

function mountWith(read: { position: PositionDoc | null; click: ClickDoc | null; rehearsal?: RehearsalDoc | null }) {
    // Like the store: what is written is what the next read returns.
    const repository = {
        readPosition: vi.fn(async () => read.position),
        readClick: vi.fn(async () => read.click),
        writeClick: vi.fn(async (doc: ClickDoc) => {
            read.click = doc;
        }),
        readRehearsal: vi.fn(async () => read.rehearsal ?? null),
        writeRehearsal: vi.fn(async (doc: RehearsalDoc) => {
            read.rehearsal = doc;
        }),
    };
    const wrapper = mount(ControlClick, {
        props: { repository: repository as unknown as ScreenRepository, author: 'Max', timeZone: 'Europe/Berlin', screens: [{ id: 's1', name: 'Bühne' }] },
        // The buttons go to the bar of the page (Plan.md 135 A) – here they stay in place, so the wrapper finds them.
        global: { stubs: { teleport: true } },
    });
    return { wrapper, repository };
}

describe('ControlClick (Plan.md 124 D)', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
        vi.setSystemTime(NOW);
        controlMemory.clickScreenId = null;
    });
    afterEach(() => vi.useRealTimers());

    it('says that nothing is running without a position, and clicks nothing', async () => {
        const { wrapper } = mountWith({ position: null, click: null });
        await flushPromises();
        expect(wrapper.get('[data-testid="click-none"]').text()).toContain('keine Präsentation mit Klicksteuerung');
        expect(wrapper.get('[data-testid="click-forward"]').attributes('disabled')).toBeDefined();
        expect(wrapper.get('[data-testid="click-black"]').attributes('disabled')).toBeDefined();
    });

    it('shows the slide, the screen, the list and the last click', async () => {
        const { wrapper } = mountWith({ position: position({ by: 'Anna', clickAt: new Date(NOW.getTime() - 5000).toISOString() }), click: null });
        await flushPromises();
        expect(wrapper.get('[data-testid="click-slide"]').text()).toContain('Folie 2 von 3 – Lieder');
        expect(wrapper.get('[data-testid="click-slide"]').text()).toContain('Bildschirm: Bühne');
        expect(wrapper.get('[data-testid="click-last"]').text()).toBe('zuletzt Anna, vor 5 s');
        expect(wrapper.findAll('[data-testid="click-slides"] button')).toHaveLength(3);
        expect(wrapper.get('[data-testid="click-slides"] button.active').text()).toContain('Lieder');
    });

    it('writes a click with the next seq at once shown, until the screen reports it', async () => {
        const read = { position: position(), click: null as ClickDoc | null };
        const { wrapper, repository } = mountWith(read);
        await flushPromises();
        await wrapper.get('[data-testid="click-forward"]').trigger('click');
        // Shown at once, before anything is written.
        expect(wrapper.get('[data-testid="click-slide"]').text()).toContain('Folie 3 von 3 – Segen');
        await flushPromises();
        expect(repository.writeClick.mock.calls[0]![0]).toMatchObject({ screenId: 's1', playlistId: 'p1', by: 'Max', actions: [{ seq: 1, do: 'next' }] });
        // The screen has not reported yet: the own click holds.
        await vi.advanceTimersByTimeAsync(1100);
        expect(wrapper.get('[data-testid="click-slide"]').text()).toContain('Folie 3 von 3');
        // It has: the position counts again.
        read.position = position({ slideId: 'c', number: 3, seq: 1, by: 'Max', clickAt: NOW.toISOString() });
        await vi.advanceTimersByTimeAsync(1100);
        expect(wrapper.get('[data-testid="click-slide"]').text()).toContain('Folie 3 von 3');
        expect(wrapper.get('[data-testid="click-last"]').text()).toContain('zuletzt Max');
    });

    it('clicks in order, each with its own seq', async () => {
        const { wrapper, repository } = mountWith({ position: position(), click: null });
        await flushPromises();
        await wrapper.get('[data-testid="click-forward"]').trigger('click');
        await wrapper.get('[data-testid="click-back"]').trigger('click');
        await wrapper.get('[data-testid="click-black"]').trigger('click');
        await flushPromises();
        const last = repository.writeClick.mock.calls.at(-1)![0] as ClickDoc;
        expect(last.actions.map((a) => [a.seq, a.do])).toEqual([
            [1, 'next'],
            [2, 'previous'],
            [3, 'black'],
        ]);
    });

    it('shows black and lifts it with the next click, which then moves nothing', async () => {
        const read = { position: position({ black: true }), click: null as ClickDoc | null };
        const { wrapper, repository } = mountWith(read);
        await flushPromises();
        expect(wrapper.get('[data-testid="click-black"]').text()).toBe('Schwarz aufheben');
        await wrapper.get('[data-testid="click-forward"]').trigger('click');
        expect(wrapper.get('[data-testid="click-slide"]').text()).toContain('Folie 2 von 3');
        expect(wrapper.get('[data-testid="click-black"]').text()).toBe('Schwarz');
        await flushPromises();
        expect(repository.writeClick).toHaveBeenCalledTimes(1);
    });

    it('goes to a slide of the list', async () => {
        const { wrapper, repository } = mountWith({ position: position(), click: null });
        await flushPromises();
        await wrapper.findAll('[data-testid="click-slides"] button')[0]!.trigger('click');
        await flushPromises();
        expect(repository.writeClick.mock.calls[0]![0].actions).toEqual([{ seq: 1, do: 'goto', slideId: 'a' }]);
    });

    it('reads every 3 seconds, every second for 15 seconds after an own click, and not while the page is hidden', async () => {
        const { wrapper, repository } = mountWith({ position: position(), click: null });
        await flushPromises();
        expect(repository.readPosition).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(3100);
        expect(repository.readPosition).toHaveBeenCalledTimes(2);
        await wrapper.get('[data-testid="click-forward"]').trigger('click');
        await flushPromises();
        const before = repository.readPosition.mock.calls.length;
        await vi.advanceTimersByTimeAsync(3100);
        expect(repository.readPosition.mock.calls.length - before).toBe(3);
        await vi.advanceTimersByTimeAsync(20_000);
        const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
        document.dispatchEvent(new Event('visibilitychange'));
        const stopped = repository.readPosition.mock.calls.length;
        await vi.advanceTimersByTimeAsync(10_000);
        expect(repository.readPosition.mock.calls.length).toBe(stopped);
        hidden.mockRestore();
        wrapper.unmount();
    });

    it('keeps the last position and says so when a reading fails', async () => {
        const { wrapper, repository } = mountWith({ position: position(), click: null });
        await flushPromises();
        repository.readPosition.mockRejectedValueOnce(new Error('weg'));
        await vi.advanceTimersByTimeAsync(3100);
        expect(wrapper.get('[role="alert"]').text()).toContain('nicht erreichbar');
        expect(wrapper.get('[data-testid="click-slide"]').text()).toContain('Folie 2 von 3');
    });

    it('says "Nicht gespeichert" where the write fails, and takes the display back', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { wrapper, repository } = mountWith({ position: position(), click: null });
        await flushPromises();
        repository.writeClick.mockRejectedValueOnce(new Error('weg'));
        await wrapper.get('[data-testid="click-forward"]').trigger('click');
        await flushPromises();
        expect(wrapper.text()).toContain('Nicht gespeichert');
        expect(wrapper.get('[data-testid="click-slide"]').text()).toContain('Folie 2 von 3');
    });

    it('steps the sections of the rehearsal song first, then stays at the last part (a songsheet with the source "Probe")', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const rehearsal = { kind: 'rehearsal' as const, songId: 9, arrangementId: 4, section: 0, at: NOW.toISOString() };
        const read = { position: position({ songsheet: { source: 'rehearsal' } }), click: null as ClickDoc | null, rehearsal: rehearsal as RehearsalDoc | null };
        const { wrapper, repository } = mountWith(read);
        await flushPromises();
        await vi.advanceTimersByTimeAsync(100);
        await flushPromises();
        // Part 1 of 2: forward steps the song, the screen stays.
        await wrapper.get('[data-testid="click-forward"]').trigger('click');
        await flushPromises();
        expect(repository.writeRehearsal).toHaveBeenCalledWith(expect.objectContaining({ songId: 9, arrangementId: 4, section: 1, by: 'Max' }));
        expect(repository.writeClick).not.toHaveBeenCalled();
        // The last part: forward stays – the button is grey and says why, nothing is written (Plan.md 124).
        await wrapper.get('[data-testid="click-forward"]').trigger('click');
        await flushPromises();
        await vi.advanceTimersByTimeAsync(4000);
        await flushPromises();
        expect(wrapper.get('[data-testid="click-forward"]').attributes('disabled')).toBeDefined();
        expect(wrapper.get('[data-testid="click-end"]').text()).toContain('Letzter Teil');
        expect(repository.writeClick).not.toHaveBeenCalled();
    });

    it('keeps the buttons usable at the first and last slide, and does not move the display there (the player decides)', async () => {
        const read = { position: position({ slideId: 'c', number: 3 }), click: null as ClickDoc | null };
        const { wrapper, repository } = mountWith(read);
        await flushPromises();
        const forward = wrapper.get('[data-testid="click-forward"]');
        expect(forward.attributes('disabled')).toBeUndefined();
        await forward.trigger('click');
        await flushPromises();
        expect(repository.writeClick.mock.calls[0]![0].actions).toEqual([{ seq: 1, do: 'next' }]);
        expect(wrapper.get('[data-testid="click-slide"]').text()).toContain('Folie 3 von 3');
    });
});
