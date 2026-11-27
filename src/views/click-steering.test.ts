import { describe, expect, it } from 'vitest';
import type { ClickDoc } from '../agenda/control';
import { buildClick, createQueue, FAST_POLL_MS, movedSlide, pollDelay, positionSettled, SLOW_POLL_MS } from './click-steering';

const base = { screenId: 's1', playlistId: 'p1', at: '2026-11-26T10:00:00.000Z', by: 'Anna' };
const old = (seqs: number[], over: Partial<ClickDoc> = {}): ClickDoc => ({
    kind: 'click',
    screenId: 's1',
    playlistId: 'p1',
    actions: seqs.map((seq) => ({ seq, do: 'next' as const })),
    at: '2026-11-26T09:59:00.000Z',
    ...over,
});

describe('buildClick (Plan.md 124 D)', () => {
    it('starts with seq 1 where there is no value', () => {
        expect(buildClick(null, { ...base, action: { do: 'next' } })).toEqual({ kind: 'click', screenId: 's1', playlistId: 'p1', actions: [{ seq: 1, do: 'next' }], at: base.at, by: 'Anna' });
    });

    it('gives the highest seq plus one and appends the action', () => {
        const doc = buildClick(old([4, 5]), { ...base, action: { do: 'goto', slideId: 'x' } });
        expect(doc.actions).toEqual([
            { seq: 4, do: 'next' },
            { seq: 5, do: 'next' },
            { seq: 6, do: 'goto', slideId: 'x' },
        ]);
    });

    it('keeps the latest nine and the new one: ten in all', () => {
        const doc = buildClick(old([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), { ...base, action: { do: 'black' } });
        expect(doc.actions.map((a) => a.seq)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    });

    it('drops the actions meant for another presentation, but keeps seq rising', () => {
        const doc = buildClick(old([7, 8], { playlistId: 'other' }), { ...base, action: { do: 'previous' } });
        expect(doc.playlistId).toBe('p1');
        expect(doc.actions).toEqual([{ seq: 9, do: 'previous' }]);
    });

    it('leaves out the name where there is none', () => {
        expect(buildClick(null, { ...base, by: undefined, action: { do: 'next' } }).by).toBeUndefined();
    });
});

describe('createQueue', () => {
    it('runs the tasks one after the other, in order, though they take different times', async () => {
        const queue = createQueue();
        const log: string[] = [];
        const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
        const a = queue(async () => {
            log.push('a start');
            await wait(20);
            log.push('a end');
            return 1;
        });
        const b = queue(async () => {
            log.push('b start');
            return 2;
        });
        expect(await Promise.all([a, b])).toEqual([1, 2]);
        expect(log).toEqual(['a start', 'a end', 'b start']);
    });

    it('goes on after a failing task, which still fails for its caller', async () => {
        const queue = createQueue();
        const failing = queue(async () => {
            throw new Error('nein');
        });
        const next = queue(async () => 'ja');
        await expect(failing).rejects.toThrow('nein');
        await expect(next).resolves.toBe('ja');
    });
});

describe('pollDelay (Plan.md 124 D)', () => {
    it('reads every second for 15 seconds after the own last click, else every 3 seconds', () => {
        expect(pollDelay(null, 100_000)).toBe(SLOW_POLL_MS);
        expect(pollDelay(100_000, 100_000)).toBe(FAST_POLL_MS);
        expect(pollDelay(100_000, 115_000)).toBe(FAST_POLL_MS);
        expect(pollDelay(100_000, 115_001)).toBe(SLOW_POLL_MS);
    });
});

describe('positionSettled, movedSlide', () => {
    it('is settled once the seq of the position reaches the own one', () => {
        expect(positionSettled({ seq: 4 }, 5)).toBe(false);
        expect(positionSettled({ seq: 5 }, 5)).toBe(true);
        expect(positionSettled({ seq: 9 }, 5)).toBe(true);
        expect(positionSettled(null, 5)).toBe(false);
        expect(positionSettled({ seq: 9 }, null)).toBe(false);
    });

    it('moves the slide along the list and stops at its ends (Plan.md 124)', () => {
        const position = { slideId: 'b', slides: [{ id: 'a', name: '' }, { id: 'b', name: '' }, { id: 'c', name: '' }] };
        expect(movedSlide(position, 1)).toBe('c');
        expect(movedSlide(position, -1)).toBe('a');
        expect(movedSlide({ ...position, slideId: 'c' }, 1)).toBeNull();
        expect(movedSlide({ ...position, slideId: 'a' }, -1)).toBeNull();
        expect(movedSlide({ ...position, slideId: 'zz' }, 1)).toBeNull();
    });
});
