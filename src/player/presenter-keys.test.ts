import { describe, expect, it } from 'vitest';
import { presenterAction, presenterStep } from './presenter-keys';

describe('presenterStep', () => {
    it('steps forward on page down and arrow right', () => {
        for (const key of ['PageDown', 'ArrowRight']) expect(presenterStep({ key })).toBe(1);
    });

    it('steps back on page up and arrow left', () => {
        for (const key of ['PageUp', 'ArrowLeft']) expect(presenterStep({ key })).toBe(-1);
    });

    it('leaves other keys and the scrolling arrows to the page', () => {
        for (const key of ['ArrowUp', 'ArrowDown', ' ', 'Enter', 'b', 'Escape']) expect(presenterStep({ key })).toBeNull();
    });

    it('ignores a held key and keys with a modifier', () => {
        expect(presenterStep({ key: 'PageDown', repeat: true })).toBeNull();
        expect(presenterStep({ key: 'ArrowRight', ctrlKey: true })).toBeNull();
        expect(presenterStep({ key: 'ArrowRight', metaKey: true })).toBeNull();
        expect(presenterStep({ key: 'ArrowLeft', altKey: true })).toBeNull();
    });

    it('ignores keys while typing in a field', () => {
        expect(presenterStep({ key: 'PageDown', target: { tagName: 'INPUT' } as unknown as EventTarget })).toBeNull();
        expect(presenterStep({ key: 'ArrowLeft', target: { tagName: 'SELECT' } as unknown as EventTarget })).toBeNull();
        expect(presenterStep({ key: 'ArrowRight', target: { tagName: 'DIV', isContentEditable: true } as unknown as EventTarget })).toBeNull();
        expect(presenterStep({ key: 'PageDown', target: { tagName: 'BUTTON' } as unknown as EventTarget })).toBe(1);
    });
});

describe('presenterAction (the keys at the device of a screen, Plan.md 124 E)', () => {
    it('maps the page keys to the clicks of the phone', () => {
        expect(presenterAction({ key: 'PageDown' })).toBe('next');
        expect(presenterAction({ key: 'ArrowRight' })).toBe('next');
        expect(presenterAction({ key: 'PageUp' })).toBe('previous');
        expect(presenterAction({ key: 'ArrowLeft' })).toBe('previous');
    });

    it('takes b, B and the full stop for black', () => {
        for (const key of ['b', 'B', '.']) expect(presenterAction({ key })).toBe('black');
    });

    it('leaves other keys alone, and held keys, modifiers and typing', () => {
        for (const key of ['ArrowUp', ' ', 'Enter', 'x']) expect(presenterAction({ key })).toBeNull();
        expect(presenterAction({ key: 'b', repeat: true })).toBeNull();
        expect(presenterAction({ key: '.', ctrlKey: true })).toBeNull();
        expect(presenterAction({ key: 'b', target: { tagName: 'INPUT' } as unknown as EventTarget })).toBeNull();
    });
});
