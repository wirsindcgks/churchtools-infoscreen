import { describe, expect, it, vi } from 'vitest';
import { readableAppointments } from './data';

const forbidden = () => Object.assign(new Error('403'), { response: { status: 403 } });

describe('readableAppointments', () => {
    it('asks once when every calendar is readable', async () => {
        const fetch = vi.fn(async (ids: number[]) => ids.map((id) => ({ id })));
        expect(await readableAppointments([1, 5], fetch)).toEqual([{ id: 1 }, { id: 5 }]);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('leaves out only the forbidden calendar when ChurchTools refuses the whole request (G35)', async () => {
        const fetch = vi.fn(async (ids: number[]) => {
            if (ids.includes(5)) throw forbidden();
            return ids.map((id) => ({ id }));
        });
        expect(await readableAppointments([1, 5, 4], fetch)).toEqual([{ id: 1 }, { id: 4 }]);
    });

    it('passes other errors through, e.g. a network failure', async () => {
        const fetch = vi.fn(async () => {
            throw new Error('Network Error');
        });
        await expect(readableAppointments([1, 5], fetch)).rejects.toThrow('Network Error');
    });
});
