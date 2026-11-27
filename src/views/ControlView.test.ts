import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RehearsalCatalogDoc } from '../agenda/control';
import type { AgendaEvent, LiveItem } from '../agenda/live';
import type { PositionDoc } from '../model/position';
import { churchToolsPlayerData } from '../player/data';
import ControlView from './ControlView.vue';
import { controlMemory } from './control-memory';

const store = vi.hoisted(() => ({ repository: null as unknown }));
vi.mock('vue-router', () => ({ useRouter: () => ({ options: { history: { state: { back: null } } } }) }));
vi.mock('../ct/client', () => ({ currentPerson: vi.fn(async () => ({})), displayName: () => 'Max' }));
vi.mock('../ct/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../ct/api')>()),
    fetchTimeZone: vi.fn(async () => 'Europe/Berlin'),
    fetchCalendars: vi.fn(async () => [{ id: 1 }]),
    fetchSong: vi.fn(async () => ({ id: 9, name: 'Lied', arrangements: [{ id: 4 }] })),
}));
vi.mock('../player/data', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../player/data')>()),
    loadArrangementSheet: vi.fn(async () => ({ sections: [{ label: 'Strophe', lines: [] }, { label: 'Refrain', lines: [] }] })),
}));
vi.mock('../store/backend', () => ({ getRepository: vi.fn(async () => ({ repository: store.repository })) }));

const NOW = new Date('2026-11-26T09:00:00Z');
const items = [
    { title: '', duration: 0, song: false, beforeEvent: true } as LiveItem,
    { title: 'Segenslied', duration: 300, song: true, beforeEvent: false, sheet: { sections: [{ label: 'Strophe 1', lines: [] }, { label: 'Refrain', lines: [] }] } } as unknown as LiveItem,
    { title: 'Halleluja', duration: 300, song: true, beforeEvent: false, sheet: { sections: [{ label: 'Strophe', lines: [] }] } } as unknown as LiveItem,
];
const event: AgendaEvent = { eventId: 7, calendarId: 1, startMs: NOW.getTime() + 30 * 60_000, endMs: NOW.getTime() + 90 * 60_000, items };

const catalog = (over: Partial<RehearsalCatalogDoc> = {}): RehearsalCatalogDoc => ({
    kind: 'rehearsalCatalog',
    screens: [{ id: 's1', name: 'Bühne' }],
    playlists: [{ id: 'p1', name: 'Probenblatt' }],
    clickScreens: [],
    at: NOW.toISOString(),
    ...over,
});
const position = (over: Partial<PositionDoc> = {}): PositionDoc => ({ kind: 'position', screenId: 's1', playlistId: 'p1', playlistName: 'Ablauf', advance: 'time', seq: 0, at: NOW.toISOString(), ...over });
const slides = { advance: 'click' as const, slideId: 'b', number: 2, total: 3, slides: [{ id: 'a', name: 'Begrüßung' }, { id: 'b', name: 'Lieder' }, { id: 'c', name: 'Segen' }] };

function setup(read: { catalog: RehearsalCatalogDoc | null; positions?: Record<string, PositionDoc | null>; rehearsal?: unknown }) {
    const repository = {
        controlCategoryId: vi.fn(async () => 1),
        readRehearsalScreens: vi.fn(async () => ({ catalog: read.catalog, overrides: {} })),
        readPosition: vi.fn(async (id: string) => read.positions?.[id] ?? null),
        readControls: vi.fn(async () => ({})),
        readRehearsal: vi.fn(async () => read.rehearsal ?? null),
        writeRehearsal: vi.fn(async () => {}),
        readClick: vi.fn(async () => null),
        writeControl: vi.fn(async () => {}),
    };
    store.repository = repository;
    // The buttons go to the bar of the page (Plan.md 135 A) – here they stay in place, so the wrapper finds them.
    const wrapper = mount(ControlView, { global: { stubs: { teleport: true } } });
    return { wrapper, repository };
}

describe('ControlView (Plan.md 135 C)', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
        vi.setSystemTime(NOW);
        Object.assign(controlMemory, { monitors: null, monitorId: null, events: null, eventId: null, timeZone: null });
        vi.spyOn(churchToolsPlayerData, 'agendaEvents').mockResolvedValue([event]);
        vi.spyOn(churchToolsPlayerData, 'agendaPosition').mockResolvedValue(null);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('shows the service alone without a released screen: no card, the song with "Danach", the buttons', async () => {
        const { wrapper, repository } = setup({ catalog: catalog({ screens: [] }) });
        await flushPromises();
        expect(wrapper.find('[data-testid="control-monitor"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid="control-area"]').exists()).toBe(false);
        expect(wrapper.get('[data-testid="control-plan"]').text()).toContain('Segenslied');
        expect(wrapper.get('[data-testid="control-current"]').text()).toContain('Strophe 1');
        expect(wrapper.get('[data-testid="control-after"]').text()).toBe('Danach: Halleluja ›');
        expect(wrapper.get('[data-testid="step-hint"]').text()).toBe('Refrain');
        expect(repository.readPosition).not.toHaveBeenCalled();
    });

    it('stays at the end of the song: "Vor" grey with the hint, "Danach" leads on', async () => {
        // The service runs: the first song began a minute ago.
        vi.spyOn(churchToolsPlayerData, 'agendaPosition').mockResolvedValue({ index: 1, set: true, switchMs: NOW.getTime() - 60_000, addSeconds: 0, offsetMs: 0 });
        const { wrapper, repository } = setup({ catalog: null });
        await flushPromises();
        await wrapper.get('[data-testid="step-forward"]').trigger('click');
        await flushPromises();
        expect(repository.writeControl).toHaveBeenCalledWith(expect.objectContaining({ eventId: 7, itemIndex: 1, section: 1, by: 'Max' }));
        await vi.advanceTimersByTimeAsync(2600);
        // The writing came back: the choice is the second part, the last one.
        expect(wrapper.get('[data-testid="step-forward"]').attributes('disabled')).toBeDefined();
        expect(wrapper.get('[data-testid="control-end"]').text()).toContain('Letzter Teil');
        await wrapper.get('[data-testid="control-after"]').trigger('click');
        expect(repository.writeControl).toHaveBeenLastCalledWith(expect.objectContaining({ itemIndex: 2, section: 0 }));
    });

    it('shows the card with the chip of the service and its song, for the event the screen follows', async () => {
        const { wrapper, repository } = setup({ catalog: catalog(), positions: { s1: position({ songsheet: { source: 'agenda', eventId: 7 } }) } });
        await flushPromises();
        expect(wrapper.get('[data-testid="monitor-name"]').text()).toBe('Bühne');
        expect(wrapper.get('[data-testid="monitor-chip"]').text()).toBe('Gottesdienst · 10:30');
        expect(wrapper.get('[data-testid="monitor-note"]').text()).toBe('Alle Liedblätter dieses Gottesdienstes folgen.');
        expect(wrapper.get('[data-testid="control-current"]').text()).toContain('Segenslied');
        // The plan stands in the card, not as a card of its own; one screen: no "Wechseln".
        expect(wrapper.find('[data-testid="control-plan"]').exists()).toBe(false);
        expect(wrapper.findAll('[data-testid="monitor-line"]').map((l) => l.text())).toEqual(['Jetzt: Segenslied']);
        expect(wrapper.find('[data-testid="monitor-switch"]').exists()).toBe(false);
        expect(repository.readPosition).toHaveBeenCalledWith('s1');
    });

    it('shows the slides for a presentation at the click, never together with a song', async () => {
        const { wrapper } = setup({ catalog: catalog({ screens: [], clickScreens: [{ id: 's1', name: 'Bühne' }] }), positions: { s1: position(slides) } });
        await flushPromises();
        expect(wrapper.get('[data-testid="monitor-chip"]').text()).toBe('Präsentation · Ablauf');
        expect(wrapper.findAll('[data-testid="monitor-line"]').map((l) => l.text())).toEqual(['Folie 2 von 3 · Lieder']);
        expect(wrapper.findAll('[data-testid="slide-list"] button')).toHaveLength(3);
        expect(wrapper.find('[data-testid="control-current"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid="control-rehearsal"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid="step-black"]').exists()).toBe(true);
        // Released for the click only: no rehearsal to start.
        expect(wrapper.find('[data-testid="monitor-rehearsal"]').exists()).toBe(false);
    });

    it('shows the song of the rehearsal for a songsheet of the rehearsal, with the chip of the rehearsal', async () => {
        const rehearsal = { until: '2026-11-26T18:11:00Z', by: 'Anna' };
        const { wrapper } = setup({ catalog: catalog(), positions: { s1: position({ rehearsal, songsheet: { source: 'rehearsal' } }) } });
        await flushPromises();
        expect(wrapper.get('[data-testid="monitor-chip"]').text()).toBe('Probe bis 19:11');
        expect(wrapper.get('[data-testid="monitor-line"]').text()).toBe('gestartet von Anna');
        expect(wrapper.get('[data-testid="monitor-note"]').text()).toBe('Alle Probenmonitore folgen.');
        expect(wrapper.find('[data-testid="control-rehearsal"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="control-service"]').exists()).toBe(false);
    });

    it('steps the song of the rehearsal, names the next part on "Vor" and stays at the last one', async () => {
        const rehearsal = { kind: 'rehearsal', songId: 9, arrangementId: 4, section: 0, at: NOW.toISOString() };
        const { wrapper, repository } = setup({ catalog: catalog(), positions: { s1: position({ songsheet: { source: 'rehearsal' } }) }, rehearsal });
        await flushPromises();
        expect(wrapper.get('[data-testid="rehearsal-song"]').text()).toContain('Strophe');
        expect(wrapper.get('[data-testid="step-hint"]').text()).toBe('Refrain');
        expect(wrapper.get('[data-testid="step-back"]').attributes('disabled')).toBeDefined();
        await wrapper.get('[data-testid="step-forward"]').trigger('click');
        await flushPromises();
        expect(repository.writeRehearsal).toHaveBeenCalledWith(expect.objectContaining({ songId: 9, arrangementId: 4, section: 1, by: 'Max' }));
        expect(wrapper.get('[data-testid="step-forward"]').attributes('disabled')).toBeDefined();
        expect(wrapper.get('[data-testid="rehearsal-end-note"]').text()).toContain('Letzter Teil');
    });

    it('leaves the middle empty for the schedule, and says where the screen reports nothing', async () => {
        const { wrapper } = setup({ catalog: catalog({ screens: [{ id: 's1', name: 'Bühne' }, { id: 's2', name: 'Saal' }] }), positions: { s1: position() } });
        await flushPromises();
        expect(wrapper.get('[data-testid="monitor-chip"]').text()).toBe('Zeitplan · Ablauf');
        expect(wrapper.get('[data-testid="monitor-line"]').text()).toBe('Nichts zu schalten.');
        expect(wrapper.find('[data-testid="control-service"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid="control-slides"]').exists()).toBe(false);
        await wrapper.get('[data-testid="monitor-switch"]').trigger('click');
        await wrapper.get('[data-testid="monitor-option-s2"]').trigger('click');
        await flushPromises();
        expect(wrapper.get('[data-testid="monitor-name"]').text()).toBe('Saal');
        expect(wrapper.get('[data-testid="monitor-silent"]').text()).toContain('meldet sich nicht');
        expect(wrapper.find('[data-testid="monitor-chip"]').exists()).toBe(false);
    });

    it('offers "Probe …" for a screen released for rehearsals, and opens the box under the card', async () => {
        const { wrapper } = setup({ catalog: catalog(), positions: { s1: position() } });
        await flushPromises();
        await wrapper.get('[data-testid="monitor-rehearsal"]').trigger('click');
        await flushPromises();
        expect(wrapper.find('[data-testid="control-screen"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="control-screen"] details').exists()).toBe(false);
        await wrapper.get('[data-testid="monitor-rehearsal"]').trigger('click');
        expect(wrapper.find('[data-testid="control-screen"]').exists()).toBe(false);
    });

    it('remembers the monitor chosen, and takes it again where it is still released', async () => {
        const two = catalog({ screens: [{ id: 's1', name: 'Bühne' }, { id: 's2', name: 'Saal' }] });
        const { wrapper } = setup({ catalog: two, positions: { s1: position(), s2: position({ screenId: 's2', playlistName: 'Saalschleife' }) } });
        await flushPromises();
        await wrapper.get('[data-testid="monitor-switch"]').trigger('click');
        await wrapper.get('[data-testid="monitor-option-s2"]').trigger('click');
        await flushPromises();
        expect(controlMemory.monitorId).toBe('s2');
        expect(wrapper.get('[data-testid="monitor-chip"]').text()).toBe('Zeitplan · Saalschleife');
        wrapper.unmount();
        const again = setup({ catalog: two, positions: { s2: position({ screenId: 's2' }) } });
        await flushPromises();
        expect(again.wrapper.get('[data-testid="monitor-name"]').text()).toBe('Saal');
    });

    it('reads the position every 3 seconds, every second after an own click, and not while the page is hidden', async () => {
        const { wrapper, repository } = setup({ catalog: catalog({ screens: [], clickScreens: [{ id: 's1', name: 'Bühne' }] }), positions: { s1: position(slides) } });
        await flushPromises();
        expect(repository.readPosition).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(3100);
        expect(repository.readPosition).toHaveBeenCalledTimes(2);
        await wrapper.get('[data-testid="step-forward"]').trigger('click');
        await flushPromises();
        const before = repository.readPosition.mock.calls.length;
        await vi.advanceTimersByTimeAsync(3100);
        expect(repository.readPosition.mock.calls.length - before).toBe(3);
        const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
        document.dispatchEvent(new Event('visibilitychange'));
        const stopped = repository.readPosition.mock.calls.length;
        await vi.advanceTimersByTimeAsync(10_000);
        expect(repository.readPosition.mock.calls.length).toBe(stopped);
        hidden.mockRestore();
        wrapper.unmount();
    });

    it('keeps the last position and says so when a reading fails', async () => {
        const { wrapper, repository } = setup({ catalog: catalog({ screens: [], clickScreens: [{ id: 's1', name: 'Bühne' }] }), positions: { s1: position(slides) } });
        await flushPromises();
        repository.readPosition.mockRejectedValueOnce(new Error('weg'));
        await vi.advanceTimersByTimeAsync(3100);
        expect(wrapper.get('[role="alert"]').text()).toContain('nicht erreichbar');
        expect(wrapper.get('[data-testid="monitor-line"]').text()).toContain('Folie 2 von 3');
    });
});
