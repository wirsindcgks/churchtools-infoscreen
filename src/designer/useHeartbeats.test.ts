import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, shallowRef } from 'vue';
import type { HeartbeatDoc } from '../model/heartbeat';
import type { ScreenRepository } from '../store/screen-repository';
import { useHeartbeats } from './useHeartbeats';

const beat: HeartbeatDoc = {
    kind: 'heartbeat',
    screen: 'foyer',
    at: '2026-10-05T12:32:00Z',
    version: '0.18.1',
    playlistId: 'p1',
    clockConfirmed: true,
};

function host(listHeartbeats: () => Promise<Map<string, HeartbeatDoc> | null>, withRepository = true) {
    const repository = shallowRef<ScreenRepository | null>(withRepository ? ({ listHeartbeats } as unknown as ScreenRepository) : null);
    let exposed!: ReturnType<typeof useHeartbeats>;
    const wrapper = mount(
        defineComponent({
            setup() {
                exposed = useHeartbeats(repository);
                return () => h('div');
            },
        }),
    );
    return { wrapper, exposed, repository };
}

describe('useHeartbeats (Plan.md 77)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-05T12:40:00Z'));
    });
    afterEach(() => vi.useRealTimers());

    it('reloads every minute and moves the clock along', async () => {
        const list = vi.fn().mockResolvedValue(new Map([['foyer', beat]]));
        const { exposed } = host(list);
        expect(exposed.heartbeats.value).toBeNull();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(list).toHaveBeenCalledTimes(1);
        expect(exposed.heartbeats.value?.get('foyer')).toEqual(beat);
        expect(exposed.now.value.toISOString()).toBe('2026-10-05T12:41:00.000Z');
        await vi.advanceTimersByTimeAsync(120_000);
        expect(list).toHaveBeenCalledTimes(3);
    });

    it('stops with the component', async () => {
        const list = vi.fn().mockResolvedValue(new Map());
        const { wrapper } = host(list);
        wrapper.unmount();
        await vi.advanceTimersByTimeAsync(300_000);
        expect(list).not.toHaveBeenCalled();
    });

    it('turns a failure into null, silently', async () => {
        const { exposed } = host(vi.fn().mockRejectedValue(new Error('403')));
        await exposed.refreshHeartbeats();
        expect(exposed.heartbeats.value).toBeNull();
    });

    it('does nothing without a repository', async () => {
        const list = vi.fn();
        const { exposed } = host(list, false);
        await exposed.refreshHeartbeats();
        expect(list).not.toHaveBeenCalled();
    });
});
