import { describe, expect, it } from 'vitest';
import { serialize } from '../model/read';
import { textBlock, makeSlide } from '../model/testing';
import { BLOCK_LABELS, PALETTE, blockBelow as below, clampFrame, createBanner, createBlock, createScreenBundle, levelOf, textLevels, duplicateSlide, fitToStage, freeSpot, move, reorder, reorderMany, boundingBox, slugify, groupOf, withGroups, dropSingleGroups, gatherLayers } from './ops';
import { History } from './history';
import { DEFAULT_THEME, type Block, type BlockType } from '../model/schema';

const stage = { width: 1920, height: 1080 };

describe('designer operations', () => {
    it('suggests readable slugs', () => {
        expect(slugify('Foyer – Große Leinwand')).toBe('foyer-grosse-leinwand');
        expect(slugify('  Café Süd ')).toBe('cafe-sued');
    });

    it('creates a new screen that is valid to store', () => {
        const bundle = createScreenBundle({ name: 'Foyer', slug: 'foyer', orientation: 'portrait' });
        expect(bundle.screen.stage).toEqual({ width: 1080, height: 1920 });
        expect(bundle.playlists[0]?.slideIds).toEqual([bundle.slides[0]?.id]);
        expect(() => [bundle.screen, ...bundle.playlists, ...bundle.slides].forEach(serialize)).not.toThrow();
    });

    it('creates every block type valid and on the stage', () => {
        for (const type of Object.keys(BLOCK_LABELS) as BlockType[]) {
            const block = createBlock(type, stage, [2]);
            expect(() => serialize(makeSlide({ blocks: [block] }))).not.toThrow();
            expect(block.x + block.width).toBeLessThanOrEqual(stage.width);
        }
    });

    it('creates a line 800 x 40, 8 px thick, solid, in the accent of the design (Plan.md F1)', () => {
        expect(createBlock('line', stage)).toMatchObject({ type: 'line', width: 800, height: 40, thickness: 8, dash: 'solid', color: DEFAULT_THEME.accent });
        expect(BLOCK_LABELS.line).toBe('Linie');
    });

    it('creates a social block 900 x 360, empty, in a column with brand colours and a semibold 56 px font (Plan.md 80)', () => {
        const block = createBlock('social', stage);
        expect(block).toMatchObject({ type: 'social', width: 900, height: 360, links: [], layout: 'column', brandColors: true, style: { fontSize: 56, fontWeight: 600 } });
        expect(BLOCK_LABELS.social).toBe('Social Media');
    });

    it('creates a slideshow empty, with the defaults, at 1200 x 675', () => {
        expect(createBlock('slideshow', stage)).toMatchObject({
            mediaIds: [],
            fit: 'cover',
            seconds: 6,
            transition: 'fade',
            width: 1200,
            height: 675,
        });
    });

    it('creates a video empty, without sound, at 1280 x 720 (Plan.md 52)', () => {
        const block = createBlock('video', stage);
        expect(block).toMatchObject({ type: 'video', fit: 'contain', sound: false, width: 1280, height: 720 });
        expect(block).not.toHaveProperty('mediaId');
        expect(BLOCK_LABELS.video).toBe('Video');
    });

    it('creates a rooms block empty, as an overview of today, at 1400 x 700 (Plan.md 46)', () => {
        expect(createBlock('next-appointment', stage, [2])).toMatchObject({ showRooms: true });
        expect(createBlock('appointment-list', stage, [2])).toMatchObject({ showRooms: true });
        expect(createBlock('countdown', stage, [2])).not.toHaveProperty('showRooms');
        expect(createBlock('rooms', stage)).toMatchObject({ type: 'rooms', rooms: [], layout: 'overview', days: 1, width: 1400, height: 700 });
        expect(BLOCK_LABELS.rooms).toBe('Raumbelegung');
    });

    it('starts every block with a text style, and every banner, in the theme\'s font (Plan.md 40)', () => {
        const theme = { ...DEFAULT_THEME, font: 'oswald' };
        const styled = (Object.keys(BLOCK_LABELS) as BlockType[])
            .map((type) => createBlock(type, stage, [2], theme))
            .filter((block): block is Extract<Block, { style: unknown }> => 'style' in block);
        expect(styled.map((b) => b.type)).toEqual([
            'text',
            'clock',
            'appointment-list',
            'next-appointment',
            'church-header',
            'countdown',
            'posts',
            'groups',
            'rooms',
            'social',
        ]);
        for (const block of styled) expect(block.style.fontFamily).toBe('oswald');
        expect(createBanner(theme).style.fontFamily).toBe('oswald');
        expect(createBlock('text', stage)).toMatchObject({ style: { fontFamily: 'lato' } });
    });

    it('starts a groups block without a homepage, all items on but the leaders (Plan.md 43)', () => {
        expect(createBlock('groups', stage)).toMatchObject({
            type: 'groups',
            groupIds: [],
            layout: 'card',
            show: { name: true, image: true, when: true, targetGroup: true, category: true, note: true, leaders: false, places: true, qr: true },
        });
        expect(createBlock('groups', stage)).not.toHaveProperty('parentGroupId');
    });

    it('duplicates a slide with fresh ids', () => {
        const original = makeSlide({ blocks: [textBlock('a')] });
        const copy = duplicateSlide(original);
        expect(copy.id).not.toBe(original.id);
        expect(copy.blocks[0]?.id).not.toBe('a');
        expect(copy.name).toContain('Kopie');
    });

    it('never lets a block vanish from the stage or shrink to nothing', () => {
        expect(clampFrame({ x: 5000, y: -5000, width: 3.4, height: 100 }, stage)).toEqual({
            x: 1900,
            y: -80,
            width: 20,
            height: 100,
        });
    });

    it('changes paint order', () => {
        expect(reorder(['a', 'b', 'c'], 0, 'front')).toEqual(['b', 'c', 'a']);
        expect(reorder(['a', 'b', 'c'], 2, 'back')).toEqual(['c', 'a', 'b']);
        expect(reorder(['a', 'b', 'c'], 1, 'forward')).toEqual(['a', 'c', 'b']);
        expect(reorder(['a', 'b', 'c'], 1, 'backward')).toEqual(['b', 'a', 'c']);
    });

    it('changes the paint order of several at once (Plan.md 79, D1)', () => {
        const items = ['a', 'b', 'c', 'd', 'e'];
        // To the front or the back they keep their order among themselves.
        expect(reorderMany(items, [3, 1], 'front')).toEqual(['a', 'c', 'e', 'b', 'd']);
        expect(reorderMany(items, [3, 1], 'back')).toEqual(['b', 'd', 'a', 'c', 'e']);
        // One step: each moves one place, none passes another chosen one.
        expect(reorderMany(items, [1, 2], 'forward')).toEqual(['a', 'd', 'b', 'c', 'e']);
        expect(reorderMany(items, [1, 3], 'backward')).toEqual(['b', 'a', 'd', 'c', 'e']);
        expect(reorderMany(items, [3, 4], 'forward')).toEqual(items);
        expect(reorderMany(items, [0, 1], 'backward')).toEqual(items);
        expect(reorderMany(items, [0, 3, 4], 'forward')).toEqual(['b', 'a', 'c', 'd', 'e']);
        // One block behaves as `reorder`.
        expect(reorderMany(items, [2], 'forward')).toEqual(reorder(items, 2, 'forward'));
        expect(reorderMany(items, [], 'front')).toEqual(items);
    });

    it('finds groups, drops lone members and gathers layers (Plan.md 79, D9)', () => {
        const blocks = ['a', 'b', 'c', 'd'].map((id, i) => ({ ...textBlock(id), groupId: i === 1 || i === 3 ? 'g' : i === 0 ? 'h' : undefined }));
        expect(groupOf(blocks, 'b')).toEqual(['b', 'd']);
        expect(groupOf(blocks, 'c')).toEqual(['c']);
        expect(groupOf(blocks, 'zz')).toEqual(['zz']);
        expect(withGroups(blocks, ['d', 'c'])).toEqual(['b', 'c', 'd']);
        dropSingleGroups(blocks);
        expect(blocks.map((x) => x.groupId)).toEqual([undefined, 'g', undefined, 'g']);
        const items = ['a', 'b', 'c', 'd', 'e'];
        expect(gatherLayers(items, [0, 3])).toEqual(['b', 'c', 'a', 'd', 'e']);
        expect(gatherLayers(items, [1, 2])).toEqual(items);
        expect(gatherLayers(items, [4, 0])).toEqual(['b', 'c', 'd', 'a', 'e']);
        expect(gatherLayers(items, [])).toEqual(items);
    });

    it('measures the box around several frames', () => {
        expect(boundingBox([])).toBeNull();
        expect(boundingBox([{ x: 10, y: 20, width: 100, height: 50 }, { x: 60, y: 0, width: 100, height: 30 }])).toEqual({ x: 10, y: 0, width: 150, height: 70 });
    });

    it('moves list items', () => {
        expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
        expect(move(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    });
});

describe('History', () => {
    it('undoes and redoes snapshots', () => {
        const history = new History<{ n: number }>();
        let state = { n: 1 };
        history.record(state);
        state = { n: 2 };
        state = history.undo(state)!;
        expect(state).toEqual({ n: 1 });
        state = history.redo(state)!;
        expect(state).toEqual({ n: 2 });
    });

    it('drops the redo branch after a new change', () => {
        const history = new History<number>();
        history.record(1);
        history.undo(2);
        history.record(1);
        expect(history.canRedo).toBe(false);
    });

    it('is not affected by later mutation of a recorded object', () => {
        const history = new History<{ n: number }>();
        const state = { n: 1 };
        history.record(state);
        state.n = 5;
        expect(history.undo(state)).toEqual({ n: 1 });
    });

    it('keeps a bounded number of steps', () => {
        const history = new History<number>(2);
        [1, 2, 3].forEach((n) => history.record(n));
        expect(history.undo(4)).toBe(3);
        expect(history.undo(3)).toBe(2);
        expect(history.undo(2)).toBeNull();
    });
});

describe('a click on a locked block (Plan.md 25)', () => {
    const at = (id: string, x: number, locked = false) =>
        ({ id, type: 'shape', x, y: 0, width: 100, height: 100, fill: { kind: 'solid', color: '#000' }, locked }) as unknown as Block;
    const back = at('back', 0);
    const lockedBelow = at('locked-below', 0, true);
    const cover = at('cover', 0, true);

    it('reaches the topmost unlocked block below it at that point', () => {
        expect(below([back, lockedBelow, cover], cover, { x: 50, y: 50 })?.id).toBe('back');
    });

    it('reaches nothing where no unlocked block lies below', () => {
        expect(below([back, cover], cover, { x: 150, y: 50 })).toBeNull();
        expect(below([cover, back], cover, { x: 50, y: 50 })).toBeNull(); // above it, not below
    });
});

describe('the palette (Plan.md 47)', () => {
    it('lists every block type in German alphabetical order', () => {
        expect(PALETTE.map(([, label]) => label)).toEqual([
            'Beiträge',
            'Bild',
            'Countdown',
            'Fläche',
            'Galerie',
            'Gemeindekopf',
            'Gruppen',
            'Linie',
            'Nächster Termin',
            'QR-Code',
            'Raumbelegung',
            'Social Media',
            'Terminliste',
            'Text',
            'Uhr',
            'Video',
            'Webseite',
        ]);
    });

    describe('freeSpot (Plan.md 79, A6)', () => {
        const frame = { x: 360, y: 440, width: 1200, height: 200 };

        it('leaves a block where it is on an empty slide', () => {
            expect(freeSpot(frame, [], stage)).toEqual(frame);
        });

        it('steps 40 px down and right as often as needed – three texts, three places', () => {
            const placed: { x: number; y: number }[] = [];
            for (let i = 0; i < 3; i++) placed.push(freeSpot(createBlock('text', stage), placed, stage));
            expect(placed.map((b) => [b.x, b.y])).toEqual([
                [360, 440],
                [400, 480],
                [440, 520],
            ]);
        });

        it('ignores blocks that only come near', () => {
            expect(freeSpot(frame, [{ x: 361, y: 440 }, { x: 360, y: 441 }], stage)).toEqual(frame);
        });

        it('starts again at the top left, 40 px in, at the stage edge', () => {
            const big = { x: 100, y: 100, width: 1800, height: 1000 };
            // One step would run past the right and bottom edge.
            expect(freeSpot(big, [{ x: 100, y: 100 }], stage)).toMatchObject({ x: 40, y: 40 });
            // And the next one steps on from there.
            expect(freeSpot(big, [{ x: 100, y: 100 }, { x: 40, y: 40 }], stage)).toMatchObject({ x: 80, y: 80 });
        });

        it('does not loop where every spot is taken', () => {
            const big = { x: 40, y: 40, width: 1850, height: 1000 };
            expect(freeSpot(big, [{ x: 40, y: 40 }], stage)).toMatchObject({ x: 40, y: 40 });
        });
    });

    it('shrinks a block in its aspect ratio until it fits the stage', () => {
        const fitted = fitToStage({ width: 1400, height: 700 }, { width: 1080, height: 1920 });
        expect(fitted.width).toBeLessThanOrEqual(1080);
        expect(fitted.width / fitted.height).toBeCloseTo(2, 1);
        const same = { width: 400, height: 300 };
        expect(fitToStage(same, stage)).toBe(same);
    });
});

describe('text levels (Plan.md 79, C8)', () => {
    it('are 96/700, 60/600 and 44/400 at 1080, landscape and portrait alike', () => {
        const expected = {
            heading: { fontSize: 96, fontWeight: 700 },
            subtitle: { fontSize: 60, fontWeight: 600 },
            body: { fontSize: 44, fontWeight: 400 },
        };
        expect(textLevels({ width: 1920, height: 1080 })).toEqual(expected);
        expect(textLevels({ width: 1080, height: 1920 })).toEqual(expected);
    });
    it('scale with the shorter side', () => {
        expect(textLevels({ width: 1280, height: 720 })).toEqual({
            heading: { fontSize: 64, fontWeight: 700 },
            subtitle: { fontSize: 40, fontWeight: 600 },
            body: { fontSize: 29, fontWeight: 400 },
        });
    });
    it('levelOf needs size and weight to fit', () => {
        const stage = { width: 1920, height: 1080 };
        expect(levelOf({ fontSize: 96, fontWeight: 700 }, stage)).toBe('heading');
        expect(levelOf({ fontSize: 60, fontWeight: 600 }, stage)).toBe('subtitle');
        expect(levelOf({ fontSize: 44, fontWeight: 400 }, stage)).toBe('body');
        expect(levelOf({ fontSize: 45, fontWeight: 400 }, stage)).toBeNull();
        expect(levelOf({ fontSize: 44, fontWeight: 600 }, stage)).toBeNull();
        expect(levelOf({ fontSize: 64, fontWeight: 700 }, { width: 1280, height: 720 })).toBe('heading');
    });
    it('a new text block begins as a heading', () => {
        const block = createBlock('text', { width: 1920, height: 1080 });
        expect(block.type === 'text' && block.style).toMatchObject({ fontSize: 96, fontWeight: 700 });
    });
});

describe('turned blocks count by their box (Plan.md F1)', () => {
    const stage = { width: 1920, height: 1080 };
    const bar = { x: 900, y: 100, width: 600, height: 40 };

    it('boundingBox takes the box around each turned frame', () => {
        expect(boundingBox([{ ...bar, rotation: 90 }])).toEqual({ x: 1180, y: -180, width: 40, height: 600 });
        expect(boundingBox([bar, { x: 0, y: 0, width: 10, height: 10 }])).toEqual({ x: 0, y: 0, width: 1500, height: 140 });
    });

    it('clampFrame keeps the box of a narrow block turned by 90° on the stage and returns the frame', () => {
        // The frame is 600 wide and 40 high; turned, it stands 40 wide and 600 high around its middle.
        const clamped = clampFrame({ x: 100, y: -500, width: 600, height: 40, rotation: 90 }, stage);
        const box = boundingBox([{ ...clamped, rotation: 90 }])!;
        expect(clamped).toMatchObject({ width: 600, height: 40 });
        expect(box.y).toBe(-580); // 20 px of the box (MIN_BLOCK_SIZE) stay on the stage
        expect(box.y + box.height).toBe(20);
        expect(clampFrame({ x: 100, y: 100, width: 600, height: 40, rotation: 90 }, stage)).toMatchObject({ x: 100, y: 100 });
    });

    it('blockBelow reaches through to the box of a turned block', () => {
        const turned = { ...createBlock('shape', stage), id: 'turned', x: 900, y: 100, width: 600, height: 40, rotation: 90 } as Block;
        const cover = { ...createBlock('shape', stage), id: 'cover', x: 0, y: 0, width: 1920, height: 1080, locked: true } as Block;
        // At (1200, 300) the plain frame has nothing, the turned box has.
        expect(below([turned, cover], cover, { x: 1200, y: 300 })?.id).toBe('turned');
        expect(below([turned, cover], cover, { x: 1000, y: 300 })).toBeNull();
    });
});
