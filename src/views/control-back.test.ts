import { describe, expect, it } from 'vitest';
import { backTarget } from './control-back';

describe('backTarget (Plan.md 135)', () => {
    const origin = 'https://instance.example';
    it('goes back when the page before belongs to the same instance', () => {
        expect(backTarget('https://instance.example/ccm/infoscreen-designer/', origin)).toBe('back');
    });
    it('goes to the start page without a referrer or from another origin', () => {
        expect(backTarget('', origin)).toBe('home');
        expect(backTarget('https://other.example/page', origin)).toBe('home');
        expect(backTarget('not a url', origin)).toBe('home');
    });
});
