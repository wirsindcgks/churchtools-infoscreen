import { describe, expect, it } from 'vitest';
import { backTarget } from './control-back';

describe('backTarget (Plan.md 135)', () => {
    const origin = 'https://instance.example';
    it('goes back into the module when the phone page was opened from it – the designer instead of the pencil', () => {
        expect(backTarget(true, '', origin)).toBe('app');
        expect(backTarget(true, 'https://other.example/page', origin)).toBe('app');
    });
    it('goes back when the page before belongs to the same instance', () => {
        expect(backTarget(false, 'https://instance.example/ccm/infoscreen-designer/', origin)).toBe('back');
    });
    it('goes to the start page without a referrer or from another origin', () => {
        expect(backTarget(false, '', origin)).toBe('home');
        expect(backTarget(false, 'https://other.example/page', origin)).toBe('home');
        expect(backTarget(false, 'not a url', origin)).toBe('home');
    });
});
