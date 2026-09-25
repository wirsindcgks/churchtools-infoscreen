import { describe, expect, it, vi } from 'vitest';
import { makeSlide } from '../model/testing';
import type { Block } from '../model/schema';
import type { Post } from '../posts/normalize';
import { mergePosts, postNeeds, readableAppointments } from './data';

const forbidden = () => Object.assign(new Error('403'), { response: { status: 403 } });

const style = { fontFamily: 'sans', fontSize: 56, fontWeight: 400 as const, color: '#fff', align: 'left' as const };
const postsBlock = (overrides: Partial<Extract<Block, { type: 'posts' }>> = {}): Block => ({
    id: 'p',
    type: 'posts',
    x: 0,
    y: 0,
    width: 1400,
    height: 700,
    groupIds: [31],
    limit: 3,
    maxAgeDays: 30,
    layout: 'card',
    showImage: true,
    showAuthor: false,
    style,
    ...overrides,
});

describe('postNeeds', () => {
    it('ignores posts blocks without a group', () => {
        expect(postNeeds([makeSlide({ blocks: [postsBlock({ groupIds: [] })] })])).toEqual([]);
    });

    it('groups blocks that share the same, sorted set of groups into one entry with the largest limit', () => {
        const slide = makeSlide({
            blocks: [
                postsBlock({ id: 'a', groupIds: [31, 25], limit: 3 }),
                postsBlock({ id: 'b', groupIds: [25, 31], limit: 5 }), // same set, different order
                postsBlock({ id: 'c', groupIds: [28], limit: 2 }),
            ],
        });
        expect(postNeeds([slide])).toEqual([
            { groupIds: [25, 31], limit: 5 },
            { groupIds: [28], limit: 2 },
        ]);
    });
});

describe('mergePosts', () => {
    const post = (id: number): Post => ({
        id,
        groupId: 31,
        groupName: 'ISD-Beitragstest',
        color: null,
        groupInitials: 'I',
        groupImageUrl: null,
        title: `Beitrag ${id}`,
        content: '',
        publishedAt: new Date('2026-09-25T08:00:00Z'),
        expiresAt: null,
        author: null,
        imageUrl: null,
        imageRatio: null,
    });

    it('dedupes posts fetched under different needs by id', () => {
        expect(mergePosts([[post(1), post(2)], [post(2), post(3)]]).map((p) => p.id).sort()).toEqual([1, 2, 3]);
    });
});

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
