import { describe, expect, it } from 'vitest';
import { quickFieldPlace, quickMenuPlace } from './quick-menu';

const host = { width: 1000, height: 600 };
const menu = { width: 300, height: 44 };

describe('quickMenuPlace (Plan.md 79, C1)', () => {
    it('stands centred above the block with 8 px of air', () => {
        expect(quickMenuPlace({ left: 400, top: 200, width: 200, height: 100 }, menu, host)).toEqual({ left: 350, top: 148, place: 'above' });
    });

    it('goes below the block where the top has no room', () => {
        expect(quickMenuPlace({ left: 400, top: 20, width: 200, height: 100 }, menu, host)).toEqual({ left: 350, top: 128, place: 'below' });
    });

    it('goes inside, at the top edge, where neither side has room', () => {
        expect(quickMenuPlace({ left: 400, top: 10, width: 200, height: 580 }, menu, host)).toEqual({ left: 350, top: 18, place: 'inside' });
    });

    it('takes exactly the room it needs above', () => {
        expect(quickMenuPlace({ left: 400, top: 52, width: 200, height: 100 }, menu, host).place).toBe('above');
        expect(quickMenuPlace({ left: 400, top: 51, width: 200, height: 100 }, menu, host).place).toBe('below');
    });

    it('is kept within the host on the left and on the right', () => {
        expect(quickMenuPlace({ left: 0, top: 200, width: 40, height: 100 }, menu, host).left).toBe(0);
        expect(quickMenuPlace({ left: 960, top: 200, width: 40, height: 100 }, menu, host).left).toBe(700);
    });

    it('starts at the left edge when it is wider than the host', () => {
        expect(quickMenuPlace({ left: 100, top: 200, width: 200, height: 100 }, { width: 1200, height: 44 }, host).left).toBe(0);
    });
});

describe('quickFieldPlace (Plan.md 79, C1)', () => {
    const field = { width: 300, height: 200 };
    const hostRect = { left: 0, top: 0, width: 1000, height: 600 };

    it('stands under the chip, flush left', () => {
        const chip = { left: 200, top: 100, width: 80, height: 32 };
        expect(quickFieldPlace(chip, { left: 100, top: 96, width: 500, height: 44 }, field, hostRect)).toEqual({ dx: 0, above: false });
    });

    it('moves sideways to stay in the host', () => {
        const menuRect = { left: 600, top: 96, width: 400, height: 44 };
        expect(quickFieldPlace({ left: 900, top: 100, width: 80, height: 32 }, menuRect, field, hostRect).dx).toBe(-200);
        expect(quickFieldPlace({ left: -20, top: 100, width: 80, height: 32 }, menuRect, field, hostRect).dx).toBe(20);
    });

    it('goes above the menu where there is no room below', () => {
        const menuRect = { left: 100, top: 500, width: 500, height: 44 };
        expect(quickFieldPlace({ left: 200, top: 504, width: 80, height: 32 }, menuRect, field, hostRect).above).toBe(true);
    });

    it('stays below where above has even less room', () => {
        const menuRect = { left: 100, top: 20, width: 500, height: 44 };
        const small = { left: 0, top: 0, width: 1000, height: 150 };
        expect(quickFieldPlace({ left: 200, top: 24, width: 80, height: 32 }, menuRect, field, small).above).toBe(false);
    });
});
