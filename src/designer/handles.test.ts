import { describe, expect, it } from 'vitest';
import { handlesOutside } from './handles';

describe('handlesOutside', () => {
    it('puts the handles outside a block narrower or lower than three fingertips', () => {
        expect(handlesOutside({ width: 131, height: 400 })).toBe(true);
        expect(handlesOutside({ width: 400, height: 100 })).toBe(true);
        expect(handlesOutside({ width: 132, height: 132 })).toBe(false);
        expect(handlesOutside({ width: 390, height: 219 })).toBe(false);
    });
});
