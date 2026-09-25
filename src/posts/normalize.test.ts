import { describe, expect, it } from 'vitest';
import { groupColor, normalizePosts, revivePosts, selectPosts, type Post, type PostResponse } from './normalize';

function raw(id: number, extra: Partial<PostResponse> = {}): PostResponse {
    return {
        id,
        title: `Beitrag ${id}`,
        content: 'Text',
        publishedDate: '2026-09-25T20:53:50Z',
        group: { domainIdentifier: '31', title: 'ISD-Beitragstest', color: { key: 'teal' } },
        actor: { title: 'Erika Beispiel' },
        ...extra,
    };
}

describe('normalizePosts', () => {
    it('reads a post with an image and one without', () => {
        const [withImage, withoutImage] = normalizePosts([
            raw(4, { imagesMeta: [{ imageUrl: 'https://example.church.tools/images/1/hash', aspectRatio: 1 }] }),
            raw(5),
        ]);
        expect(withImage).toMatchObject({
            id: 4,
            groupId: 31,
            groupName: 'ISD-Beitragstest',
            color: '#14b8a6',
            title: 'Beitrag 4',
            author: 'Erika Beispiel',
            imageUrl: 'https://example.church.tools/images/1/hash',
            imageRatio: 1,
        });
        expect(withImage?.publishedAt).toEqual(new Date('2026-09-25T20:53:50Z'));
        expect(withoutImage).toMatchObject({ id: 5, imageUrl: null, imageRatio: null });
    });

    it('reads the group avatar: its own initials and image, else the first letter of its name', () => {
        const [withInitials, withImage, withNeither] = normalizePosts([
            raw(20, { group: { domainIdentifier: '31', title: 'ISD-Beitragstest', initials: 'IB' } }),
            raw(21, { group: { domainIdentifier: '31', title: 'ISD-Beitragstest', imageUrl: 'https://example.church.tools/images/2/hash' } }),
            raw(22, { group: { domainIdentifier: '31', title: 'isd-beitragstest' } }),
        ]);
        expect(withInitials).toMatchObject({ groupInitials: 'IB', groupImageUrl: null });
        expect(withImage).toMatchObject({ groupInitials: 'I', groupImageUrl: 'https://example.church.tools/images/2/hash' });
        expect(withNeither).toMatchObject({ groupInitials: 'I', groupImageUrl: null });
    });

    it('skips a banned post', () => {
        expect(normalizePosts([raw(6, { isBanned: true })])).toEqual([]);
    });

    it('skips a post without a readable publishedDate', () => {
        expect(normalizePosts([raw(7, { publishedDate: null }), raw(8, { publishedDate: 'bald' })])).toEqual([]);
    });

    it('skips a post without a numeric group id', () => {
        expect(normalizePosts([raw(9, { group: { domainIdentifier: null } })])).toEqual([]);
    });

    it('reads the expiry date, or null without one', () => {
        const [expiring, open] = normalizePosts([
            raw(10, { expirationDate: '2026-10-22T19:53:00Z' }),
            raw(11, { expirationDate: null }),
        ]);
        expect(expiring?.expiresAt).toEqual(new Date('2026-10-22T19:53:00Z'));
        expect(open?.expiresAt).toBeNull();
    });
});

describe('groupColor', () => {
    it('looks a known key up', () => {
        expect(groupColor({ key: 'teal' })).toBe('#14b8a6');
        expect(groupColor({ key: 'red' })).toBe('#ef4444');
    });

    it('maps a semantic key to its colour', () => {
        expect(groupColor({ key: 'success' })).toBe('#22c55e');
        expect(groupColor({ key: 'critical' })).toBe('#ef4444');
        expect(groupColor({ key: 'warning' })).toBe('#f59e0b');
    });

    it('falls back to the theme accent for accent, basic, unknown and no colour', () => {
        expect(groupColor({ key: 'accent' })).toBeNull();
        expect(groupColor({ key: 'basic' })).toBeNull();
        expect(groupColor({ key: 'glitter' })).toBeNull();
        expect(groupColor(null)).toBeNull();
        expect(groupColor(undefined)).toBeNull();
    });
});

describe('selectPosts', () => {
    const now = new Date('2026-09-25T21:00:00Z');
    const post = (id: number, extra: Partial<Post> = {}): Post => ({
        id,
        groupId: 31,
        groupName: 'ISD-Beitragstest',
        color: null,
        groupInitials: 'I',
        groupImageUrl: null,
        title: `Beitrag ${id}`,
        content: 'Text',
        publishedAt: now,
        expiresAt: null,
        author: null,
        imageUrl: null,
        imageRatio: null,
        ...extra,
    });

    it('keeps only the chosen groups', () => {
        const posts = [post(1, { groupId: 31 }), post(2, { groupId: 25 })];
        expect(selectPosts(posts, { groupIds: [31], now, maxAgeDays: 30, limit: 10 }).map((p) => p.id)).toEqual([1]);
    });

    it('drops posts older than maxAgeDays and posts published in the future', () => {
        const posts = [
            post(1, { publishedAt: new Date(now.getTime() - 10 * 86_400_000) }), // within 30 days
            post(2, { publishedAt: new Date(now.getTime() - 40 * 86_400_000) }), // too old
            post(3, { publishedAt: new Date(now.getTime() + 86_400_000) }), // published tomorrow
        ];
        expect(selectPosts(posts, { groupIds: [31], now, maxAgeDays: 30, limit: 10 }).map((p) => p.id)).toEqual([1]);
    });

    it('drops expired posts, keeps posts without an expiry', () => {
        const posts = [
            post(1, { expiresAt: new Date(now.getTime() - 1000) }),
            post(2, { expiresAt: new Date(now.getTime() + 1000) }),
            post(3, { expiresAt: null }),
        ];
        expect(selectPosts(posts, { groupIds: [31], now, maxAgeDays: 30, limit: 10 }).map((p) => p.id)).toEqual([2, 3]);
    });

    it('sorts newest first and applies the limit', () => {
        const posts = [
            post(1, { publishedAt: new Date(now.getTime() - 3000) }),
            post(2, { publishedAt: new Date(now.getTime() - 1000) }),
            post(3, { publishedAt: new Date(now.getTime() - 2000) }),
        ];
        expect(selectPosts(posts, { groupIds: [31], now, maxAgeDays: 30, limit: 2 }).map((p) => p.id)).toEqual([2, 3]);
    });
});

describe('revivePosts', () => {
    it('turns the JSON round trip\'s date strings back into Date objects', () => {
        const posts: Post[] = [
            {
                id: 1,
                groupId: 31,
                groupName: 'ISD-Beitragstest',
                color: null,
                groupInitials: 'I',
                groupImageUrl: null,
                title: 'Beitrag',
                content: 'Text',
                publishedAt: new Date('2026-09-25T20:53:50Z'),
                expiresAt: new Date('2026-10-22T19:53:00Z'),
                author: null,
                imageUrl: null,
                imageRatio: null,
            },
        ];
        const revived = revivePosts(JSON.parse(JSON.stringify(posts)));
        expect(revived[0]?.publishedAt).toEqual(new Date('2026-09-25T20:53:50Z'));
        expect(revived[0]?.expiresAt).toEqual(new Date('2026-10-22T19:53:00Z'));
        expect(revived[0]?.publishedAt).toBeInstanceOf(Date);
    });

    it('keeps a missing expiry as null', () => {
        const [revived] = revivePosts([
            {
                id: 1,
                groupId: 31,
                groupName: 'ISD-Beitragstest',
                color: null,
                groupInitials: 'I',
                groupImageUrl: null,
                title: 'Beitrag',
                content: 'Text',
                publishedAt: new Date('2026-09-25T20:53:50Z'),
                expiresAt: null,
                author: null,
                imageUrl: null,
                imageRatio: null,
            },
        ]);
        expect(revived?.expiresAt).toBeNull();
    });
});
