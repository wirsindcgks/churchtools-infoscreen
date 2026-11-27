import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OverrideDoc, RehearsalCatalogDoc } from '../agenda/control';
import type { ScreenRepository } from '../store/screen-repository';
import ControlScreen from './ControlScreen.vue';

const NOW = new Date('2026-11-11T18:00:00Z');
const catalog: RehearsalCatalogDoc = {
    kind: 'rehearsalCatalog',
    screens: [{ id: 's1', name: 'Probenraum' }],
    playlists: [{ id: 'p1', name: 'Probenblatt' }, { id: 'p2', name: 'Band' }],
    clickScreens: [],
    at: '2026-11-11T09:00:00Z',
};

function mountWith(read: { catalog: RehearsalCatalogDoc | null; overrides: Record<string, OverrideDoc> }, screenId = 's1') {
    // Like the store: what is written is what the next read returns.
    const repository = {
        readRehearsalScreens: vi.fn(async () => ({ catalog: read.catalog, overrides: { ...read.overrides } })),
        writeOverride: vi.fn(async (doc: OverrideDoc) => {
            read.overrides[doc.screenId] = doc;
        }),
    };
    const wrapper = mount(ControlScreen, { props: { repository: repository as unknown as ScreenRepository, author: 'Max', timeZone: 'Europe/Berlin', screenId } });
    return { wrapper, repository };
}

describe('ControlScreen (Plan.md 125 C, 135 C)', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
        vi.setSystemTime(NOW);
    });
    afterEach(() => vi.useRealTimers());

    it('says whom to ask without a catalog', async () => {
        const { wrapper } = mountWith({ catalog: null, overrides: {} });
        await flushPromises();
        expect(wrapper.get('[data-testid="control-screen-none"]').text()).toContain('freigegeben');
    });

    it('says whom to ask for a screen that is not released for rehearsals', async () => {
        const { wrapper } = mountWith({ catalog, overrides: {} }, 'other');
        await flushPromises();
        expect(wrapper.get('[data-testid="control-screen-none"]').text()).toContain('freigegeben');
        expect(wrapper.find('[data-testid="control-screen-show"]').exists()).toBe(false);
    });

    it('writes screen, presentation, duration and author', async () => {
        const { wrapper, repository } = mountWith({ catalog, overrides: {} });
        await flushPromises();
        await wrapper.get('[data-testid="control-screen-hours-3"]').trigger('click');
        await wrapper.get('[data-testid="control-screen-show"]').trigger('click');
        await flushPromises();
        const doc = repository.writeOverride.mock.calls[0]![0] as OverrideDoc;
        expect(doc).toMatchObject({ kind: 'override', screenId: 's1', playlistId: 'p1', by: 'Max' });
        expect(Date.parse(doc.until) - Date.parse(doc.at)).toBe(3 * 3600_000);
        expect(wrapper.find('[data-testid="control-screen-running"]').exists()).toBe(true);
    });

    const running: OverrideDoc = { kind: 'override', screenId: 's1', playlistId: 'p2', until: '2026-11-11T19:30:00Z', at: '2026-11-11T17:30:00Z', by: 'Anna' };

    it('shows what runs and ends it', async () => {
        const { wrapper, repository } = mountWith({ catalog, overrides: { s1: running } });
        await flushPromises();
        const box = wrapper.get('[data-testid="control-screen-running"]').text();
        expect(box).toContain('Band bis 20:30');
        expect(box).toContain('von Anna');
        await wrapper.get('[data-testid="control-screen-end"]').trigger('click');
        await flushPromises();
        expect(repository.writeOverride.mock.calls[0]![0]).toMatchObject({ screenId: 's1', playlistId: '', ended: true, by: 'Max' });
        expect(wrapper.find('[data-testid="control-screen-running"]').exists()).toBe(false);
    });

    it('extends with a new end', async () => {
        const { wrapper, repository } = mountWith({ catalog, overrides: { s1: running } });
        await flushPromises();
        await wrapper.get('[data-testid="control-screen-extend"]').trigger('click');
        await flushPromises();
        const doc = repository.writeOverride.mock.calls[0]![0] as OverrideDoc;
        expect(doc.playlistId).toBe('p2');
        expect(Date.parse(doc.until)).toBe(NOW.getTime() + 2 * 3600_000);
    });
});
