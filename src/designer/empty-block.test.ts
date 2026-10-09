import { describe, expect, it } from 'vitest';
import type { BlockType } from '../model/schema';
import { centerCovered, emptyAction } from './empty-block';
import { createBlock } from './ops';

const STAGE = { width: 1920, height: 1080 };
const make = (type: BlockType) => createBlock(type, STAGE, [1]);

describe('emptyAction (Plan.md 79, C6)', () => {
    it('names what a fresh block lacks', () => {
        expect(emptyAction(make('image'))).toBe('Bild wählen');
        expect(emptyAction(make('video'))).toBe('Video wählen');
        expect(emptyAction(make('slideshow'))).toBe('Bilder hinzufügen');
        expect(emptyAction(make('web'))).toBe('Adresse eingeben');
        expect(emptyAction(make('qr'))).toBe('Inhalt eingeben');
        expect(emptyAction(make('posts'))).toBe('Gruppen wählen');
        expect(emptyAction(make('groups'))).toBe('Homepage wählen');
        expect(emptyAction(make('rooms'))).toBe('Räume wählen');
    });

    it('says nothing about blocks that always have what they need', () => {
        for (const type of ['text', 'shape', 'clock', 'appointment-list', 'next-appointment', 'countdown', 'church-header'] as const) {
            expect(emptyAction(make(type))).toBeNull();
        }
    });

    it('is quiet once the content is in', () => {
        expect(emptyAction({ ...make('image'), mediaId: 'm1' } as never)).toBeNull();
        expect(emptyAction({ ...make('video'), mediaId: 'm1' } as never)).toBeNull();
        expect(emptyAction({ ...make('slideshow'), mediaIds: ['m1'] } as never)).toBeNull();
        expect(emptyAction({ ...make('web'), url: 'https://example.org' } as never)).toBeNull();
        expect(emptyAction({ ...make('qr'), data: 'https://example.org' } as never)).toBeNull();
        expect(emptyAction({ ...make('posts'), groupIds: [5] } as never)).toBeNull();
        expect(emptyAction({ ...make('groups'), parentGroupId: 9 } as never)).toBeNull();
        expect(emptyAction({ ...make('rooms'), rooms: [{ resourceId: 3, hint: '', showTitles: true }] } as never)).toBeNull();
    });

    it('takes an address or a content of spaces for empty', () => {
        expect(emptyAction({ ...make('web'), url: '   ' } as never)).toBe('Adresse eingeben');
        expect(emptyAction({ ...make('qr'), data: ' ' } as never)).toBe('Inhalt eingeben');
    });
});

describe('centerCovered (Plan.md 79, C6)', () => {
    const frame = (id: string, x: number, y: number, width: number, height: number) => ({ ...make('qr'), id, x, y, width, height });
    const below = frame('a', 0, 0, 200, 200);

    it('is covered where a block above has the middle inside its frame', () => {
        expect(centerCovered(below, [below, frame('b', 90, 90, 50, 50)])).toBe(true);
    });

    it('is not covered by a block beside the middle, or one below it', () => {
        expect(centerCovered(below, [below, frame('b', 120, 0, 80, 200)])).toBe(false);
        expect(centerCovered(below, [frame('b', 90, 90, 50, 50), below])).toBe(false);
    });

    it('is not covered when alone', () => {
        expect(centerCovered(below, [below])).toBe(false);
    });
});
