import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RehearsalCatalogDoc } from '../agenda/control';
import type { AgendaEvent, LiveItem } from '../agenda/live';
import type { PositionDoc } from '../model/position';
import { churchToolsPlayerData } from '../player/data';
import type { SongResponse } from '../ct/api';
import * as ctApi from '../ct/api';
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
    searchSongs: vi.fn(async () => []),
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
        writeOverride: vi.fn<(doc: unknown) => Promise<void>>(async () => {}),
        readClick: vi.fn(async () => null),
        writeClick: vi.fn(async () => {}),
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
        expect(wrapper.get('[data-testid="control-after"]').text()).toBe('Danach · Halleluja›');
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
        expect(wrapper.get('[data-testid="control-current"] [data-testid="control-end"]').text()).toBe('Letzter Teil – nächstes Lied über „Danach“.');
        await wrapper.get('[data-testid="control-after"]').trigger('click');
        expect(repository.writeControl).toHaveBeenLastCalledWith(expect.objectContaining({ itemIndex: 2, section: 0 }));
    });

    it('shows the card with the chip of the service and its song, for the event the screen follows', async () => {
        const { wrapper, repository } = setup({ catalog: catalog(), positions: { s1: position({ songsheet: { source: 'agenda', eventId: 7 } }) } });
        await flushPromises();
        // The back button is the arrow alone (Plan.md 137 A).
        expect(wrapper.get('[data-testid="control-back"]').text()).toBe('');
        expect(wrapper.get('[data-testid="monitor-name"]').text()).toBe('Bühne');
        expect(wrapper.get('[data-testid="monitor-chip"]').text()).toBe('Gottesdienst');
        expect(wrapper.get('[data-testid="monitor-detail"]').text()).toBe('10:30');
        // No "?" with a sentence about who follows: it brought nothing (user, 2026-11-27).
        expect(wrapper.find('[data-testid="monitor-info"]').exists()).toBe(false);
        expect(wrapper.get('[data-testid="control-current"]').text()).toContain('Segenslied');
        // The plan stands in the card, not as a card of its own; one screen: no "Wechseln".
        expect(wrapper.find('[data-testid="control-plan"]').exists()).toBe(false);
        // The line under the band is gone: what runs stands in the "Jetzt" row (Plan.md 137 B).
        expect(wrapper.find('[data-testid="monitor-line"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid="monitor-switch"]').exists()).toBe(false);
        expect(repository.readPosition).toHaveBeenCalledWith('s1');
        // While the service runs no rehearsal can be started by mistake, although the screen is released for rehearsals.
        expect(wrapper.find('[data-testid="monitor-rehearsal"]').exists()).toBe(false);
    });

    it('leads from a song in a presentation by click to its next slide (choice b), and not from the last one', async () => {
        const { wrapper, repository } = setup({ catalog: catalog({ clickScreens: [{ id: 's1', name: 'Bühne' }] }), positions: { s1: position({ ...slides, songsheet: { source: 'agenda', eventId: 7 } }) } });
        await flushPromises();
        // The song is in the middle, below it the line to the next slide – no list of slides beside it.
        expect(wrapper.get('[data-testid="control-current"]').text()).toContain('Segenslied');
        expect(wrapper.find('[data-testid="control-slides"]').exists()).toBe(false);
        expect(wrapper.get('[data-testid="control-next-slide"]').text()).toBe('Nächste Folie: Segen ›');
        await wrapper.get('[data-testid="control-next-slide"]').trigger('click');
        await flushPromises();
        expect(repository.writeClick).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'click', screenId: 's1', playlistId: 'p1', actions: [expect.objectContaining({ seq: 1, do: 'goto', slideId: 'c' })], by: 'Max' }),
        );
    });

    it('shows no line to the next slide on the last slide or without slides', async () => {
        const last = setup({ catalog: catalog({ clickScreens: [{ id: 's1', name: 'Bühne' }] }), positions: { s1: position({ ...slides, slideId: 'c', number: 3, songsheet: { source: 'agenda', eventId: 7 } }) } });
        await flushPromises();
        expect(last.wrapper.find('[data-testid="control-next-slide"]').exists()).toBe(false);
        last.wrapper.unmount();
        const byTime = setup({ catalog: catalog(), positions: { s1: position({ songsheet: { source: 'agenda', eventId: 7 } }) } });
        await flushPromises();
        expect(byTime.wrapper.find('[data-testid="control-next-slide"]').exists()).toBe(false);
    });

    it('shows the slides for a presentation at the click, never together with a song', async () => {
        const { wrapper } = setup({ catalog: catalog({ screens: [], clickScreens: [{ id: 's1', name: 'Bühne' }] }), positions: { s1: position(slides) } });
        await flushPromises();
        expect(wrapper.get('[data-testid="monitor-band"]').text()).toBe('Präsentation · Ablauf');
        expect(wrapper.get('[data-testid="control-now"]').text()).toBe('JetztLieder2 von 3');
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
        expect(wrapper.get('[data-testid="monitor-chip"]').text()).toBe('Probe');
        expect(wrapper.get('[data-testid="monitor-band"]').text()).toBe('Probe bis 19:11 · Anna›');
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
        // The hint stands in the card of the song, under the parts.
        expect(wrapper.get('[data-testid="rehearsal-song"] [data-testid="rehearsal-end-note"]').text()).toBe('Letzter Teil – anderes Lied über die Lupe.');
    });

    it('ends the song of the rehearsal from the sheet of the search, and the page then offers the search again', async () => {
        const rehearsal = { kind: 'rehearsal', songId: 9, arrangementId: 4, section: 0, at: NOW.toISOString() };
        const { wrapper, repository } = setup({ catalog: catalog(), positions: { s1: position({ songsheet: { source: 'rehearsal' } }) }, rehearsal });
        await flushPromises();
        await wrapper.get('[data-testid="rehearsal-other"]').trigger('click');
        await wrapper.get('[role="dialog"] [data-testid="rehearsal-end"]').trigger('click');
        await flushPromises();
        expect(repository.writeRehearsal).toHaveBeenCalledWith(expect.objectContaining({ ended: true, songId: 0 }));
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid="rehearsal-song"]').exists()).toBe(false);
        expect(wrapper.get('[data-testid="rehearsal-other"]').text()).toBe('Lied wählen');
    });

    it('leaves the middle empty for the schedule, and says where the screen reports nothing', async () => {
        const { wrapper } = setup({ catalog: catalog({ screens: [{ id: 's1', name: 'Bühne' }, { id: 's2', name: 'Saal' }] }), positions: { s1: position() } });
        await flushPromises();
        expect(wrapper.get('[data-testid="monitor-band"]').text()).toContain('Zeitplan · Ablauf');
        // No line below: "Nichts zu schalten." confused more than it said (user, 2026-11-27).
        expect(wrapper.find('[data-testid="monitor-line"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid="control-service"]').exists()).toBe(false);
        expect(wrapper.find('[data-testid="control-slides"]').exists()).toBe(false);
        await wrapper.get('[data-testid="monitor-switch"]').trigger('click');
        await wrapper.get('[data-testid="monitor-option-s2"]').trigger('click');
        await flushPromises();
        expect(wrapper.get('[data-testid="monitor-name"]').text()).toBe('Saal');
        expect(wrapper.get('[data-testid="monitor-silent"]').text()).toContain('meldet sich nicht');
        expect(wrapper.find('[data-testid="monitor-chip"]').exists()).toBe(false);
    });

    it('offers "Probe starten" for a screen released for rehearsals, and opens a sheet from below', async () => {
        const { wrapper, repository } = setup({ catalog: catalog(), positions: { s1: position() } });
        await flushPromises();
        expect(wrapper.find('[data-testid="control-screen"]').exists()).toBe(false);
        expect(wrapper.get('[data-testid="monitor-rehearsal"]').text()).toBe('Probe starten ›');
        await wrapper.get('[data-testid="monitor-rehearsal"]').trigger('click');
        expect(wrapper.get('[role="dialog"] h2').text()).toBe('Probe auf „Bühne“');
        await wrapper.get('[data-testid="control-sheet-cancel"]').trigger('click');
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
        expect(repository.writeOverride).not.toHaveBeenCalled();
    });

    it('starts the rehearsal from the sheet: writes the override, closes the sheet and shows the rehearsal in the card at once', async () => {
        const { wrapper, repository } = setup({ catalog: catalog(), positions: { s1: position() } });
        await flushPromises();
        await wrapper.get('[data-testid="monitor-rehearsal"]').trigger('click');
        await wrapper.get('[data-testid="rehearsal-sheet-start"]').trigger('click');
        await flushPromises();
        const doc = repository.writeOverride.mock.calls[0]![0] as { screenId: string; playlistId: string; until: string; at: string; by: string };
        expect(doc).toMatchObject({ kind: 'override', screenId: 's1', playlistId: 'p1', by: 'Max' });
        expect(Date.parse(doc.until) - Date.parse(doc.at)).toBe(2 * 3600_000);
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
        expect(wrapper.get('[data-testid="monitor-chip"]').text()).toBe('Probe');
        expect(wrapper.get('[data-testid="monitor-band"]').classes()).toContain('tone-rehearsal');
        expect(wrapper.find('[data-testid="monitor-rehearsal"]').exists()).toBe(false);
        // Until the screen reports it, the card says that it switches (user, 2026-11-27: "es passiert nichts").
        expect(wrapper.get('[data-testid="monitor-transfer"]').text()).toBe('Wechselt zur Probe …');
    });

    it('keeps the sheet open and says so where the write fails', async () => {
        const { wrapper, repository } = setup({ catalog: catalog(), positions: { s1: position() } });
        await flushPromises();
        repository.writeOverride.mockRejectedValueOnce(new Error('weg'));
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        await wrapper.get('[data-testid="monitor-rehearsal"]').trigger('click');
        await wrapper.get('[data-testid="rehearsal-sheet-start"]').trigger('click');
        await flushPromises();
        expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
        expect(wrapper.get('[role="alert"]').text()).toContain('Nicht gespeichert');
        expect(wrapper.find('[data-testid="monitor-end"]').exists()).toBe(false);
    });

    describe('while a rehearsal runs', () => {
        const rehearsal = { until: '2026-11-26T09:52:00Z', by: 'Anna' };
        const running = (over: Partial<PositionDoc> = {}) => position({ rehearsal, songsheet: { source: 'rehearsal' }, ...over });

        it('says it once in the band – the word, the end and who started it – and opens a sheet with the three buttons, and no sentences that stay', async () => {
            const { wrapper } = setup({ catalog: catalog(), positions: { s1: running() } });
            await flushPromises();
            expect(wrapper.get('[data-testid="monitor-chip"]').text()).toBe('Probe');
            expect(wrapper.get('[data-testid="monitor-band"]').text()).toBe('Probe bis 10:52 · Anna›');
            expect(wrapper.find('[data-testid="monitor-line"]').exists()).toBe(false);
            // Neither the sentence about the service (it stands in the sheet "Probe starten") nor the one about who follows stays in the card.
            expect(wrapper.find('[data-testid="monitor-rehearsal-note"]').exists()).toBe(false);
            expect(wrapper.find('[data-testid="monitor-note"]').exists()).toBe(false);
            expect(wrapper.text()).not.toContain('Ein Gottesdienst laut Zeitplan');
            expect(wrapper.text()).not.toContain('Alle Probenmonitore folgen');
            // The buttons wait in the sheet that the band opens.
            expect(wrapper.find('[data-testid="monitor-extend-1"]').exists()).toBe(false);
            await wrapper.get('[data-testid="monitor-band"]').trigger('click');
            expect(wrapper.get('[role="dialog"] h2').text()).toBe('Probe auf „Bühne“');
            expect(wrapper.get('[data-testid="monitor-extend-1"]').text()).toBe('+1 Std');
            expect(wrapper.get('[data-testid="monitor-extend-2"]').text()).toBe('+2 Std');
            expect(wrapper.get('[data-testid="monitor-end"]').text()).toBe('Beenden');
            expect(wrapper.find('[data-testid="monitor-rehearsal"]').exists()).toBe(false);
            expect(wrapper.find('[data-testid="control-screen"]').exists()).toBe(false);
            // Nothing twice: the end of the rehearsal and its author stand in one place.
            expect(wrapper.text().match(/10:52/g)).toHaveLength(1);
            expect(wrapper.text().match(/Anna/g)).toHaveLength(1);
            expect(wrapper.find('[data-testid="monitor-transfer"]').exists()).toBe(false);
        });

        it('extends from the end that stands, for the presentation that runs, and shows the new end at once', async () => {
            const { wrapper, repository } = setup({ catalog: catalog(), positions: { s1: running({ playlistId: 'p1' }) } });
            await flushPromises();
            await wrapper.get('[data-testid="monitor-band"]').trigger('click');
            await wrapper.get('[data-testid="monitor-extend-2"]').trigger('click');
            await flushPromises();
            expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
            const doc = repository.writeOverride.mock.calls[0]![0] as { playlistId: string; until: string; by: string };
            expect(doc).toMatchObject({ playlistId: 'p1', until: '2026-11-26T11:52:00.000Z', by: 'Max' });
            expect(wrapper.get('[data-testid="monitor-chip"]').text()).toBe('Probe');
            expect(wrapper.get('[data-testid="monitor-band"]').classes()).toContain('tone-rehearsal');
            expect(wrapper.get('[data-testid="monitor-transfer"]').text()).toBe('Übernimmt die Zeit …');
        });

        it('ends the rehearsal and offers "Probe starten" again', async () => {
            const { wrapper, repository } = setup({ catalog: catalog(), positions: { s1: running() } });
            await flushPromises();
            await wrapper.get('[data-testid="monitor-band"]').trigger('click');
            await wrapper.get('[data-testid="monitor-end"]').trigger('click');
            await flushPromises();
            expect(repository.writeOverride.mock.calls[0]![0]).toMatchObject({ screenId: 's1', playlistId: '', ended: true, by: 'Max' });
            expect(wrapper.find('[data-testid="monitor-end"]').exists()).toBe(false);
            expect(wrapper.find('[data-testid="monitor-rehearsal"]').exists()).toBe(true);
            expect(wrapper.get('[data-testid="monitor-transfer"]').text()).toBe('Zurück zum Zeitplan …');
        });

        it('shows the song with its parts and the magnifier, no "Schwarz" in the bar although the presentation is at the click', async () => {
            const song = { kind: 'rehearsal', songId: 9, arrangementId: 4, section: 0, at: NOW.toISOString() };
            const { wrapper } = setup({ catalog: catalog(), positions: { s1: running(slides) }, rehearsal: song });
            await flushPromises();
            const card = wrapper.get('[data-testid="rehearsal-song"]');
            expect(card.get('[data-testid="song-title"]').text()).toBe('Lied');
            // Name and key in one row, the magnifier alone beside them.
            expect(card.get('[data-testid="song-title"]').element.parentElement!.querySelector('[data-testid="rehearsal-other"]')).not.toBeNull();
            expect(card.get('[data-testid="rehearsal-other"]').text()).toBe('');
            expect(card.get('[data-testid="rehearsal-other"]').attributes('aria-label')).toBe('Lied wählen');
            // The parts are in the card, not squeezed out of it.
            expect(card.findAll('.part').map((b) => b.text())).toEqual(['Strophe', 'Refrain']);
            // One arrangement: no chips.
            expect(card.find('.arrangements').exists()).toBe(false);
            expect(wrapper.find('[data-testid="step-black"]').exists()).toBe(false);
            expect(wrapper.text()).not.toContain('Schwarz');
            expect(wrapper.find('[data-testid="slide-list"]').exists()).toBe(false);
            // "Lied beenden" is not on the page, but in the sheet of the search.
            expect(wrapper.find('[data-testid="rehearsal-end"]').exists()).toBe(false);
            await card.get('[data-testid="rehearsal-other"]').trigger('click');
            expect(wrapper.get('[role="dialog"] [data-testid="rehearsal-end"]').text()).toBe('Lied beenden');
        });

        it('opens the search of the song as a sheet, and a find closes it', async () => {
            vi.mocked(ctApi.searchSongs).mockResolvedValue([{ id: 9, name: 'Lied', arrangements: [{ id: 4, isDefault: true }] } as SongResponse]);
            const { wrapper, repository } = setup({ catalog: catalog(), positions: { s1: running() } });
            await flushPromises();
            expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
            await wrapper.get('[data-testid="rehearsal-other"]').trigger('click');
            expect(wrapper.get('[role="dialog"] h2').text()).toBe('Lied wählen');
            await wrapper.get('[data-testid="rehearsal-search"]').setValue('Lie');
            await vi.advanceTimersByTimeAsync(400);
            await wrapper.get('[data-testid="rehearsal-results"] button').trigger('click');
            await flushPromises();
            expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
            expect(repository.writeRehearsal).toHaveBeenCalledWith(expect.objectContaining({ songId: 9, arrangementId: 4 }));
        });

        it('says that the screen shows no rehearsal sheet, instead of the song card', async () => {
            const { wrapper } = setup({ catalog: catalog(), positions: { s1: position({ rehearsal }) } });
            await flushPromises();
            expect(wrapper.get('[data-testid="monitor-no-sheet"]').text()).toBe('Der Bildschirm zeigt kein Probenblatt.');
            expect(wrapper.find('[data-testid="control-rehearsal"]').exists()).toBe(false);
        });
    });

    it('remembers the monitor chosen, and takes it again where it is still released', async () => {
        const two = catalog({ screens: [{ id: 's1', name: 'Bühne' }, { id: 's2', name: 'Saal' }] });
        const { wrapper } = setup({ catalog: two, positions: { s1: position(), s2: position({ screenId: 's2', playlistName: 'Saalschleife' }) } });
        await flushPromises();
        await wrapper.get('[data-testid="monitor-switch"]').trigger('click');
        await wrapper.get('[data-testid="monitor-option-s2"]').trigger('click');
        await flushPromises();
        expect(controlMemory.monitorId).toBe('s2');
        expect(wrapper.get('[data-testid="monitor-band"]').text()).toContain('Zeitplan · Saalschleife');
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
        expect(wrapper.get('[data-testid="control-now"]').text()).toContain('2 von 3');
    });
});
