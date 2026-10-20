import { describe, expect, it } from 'vitest';
import { firstSentence } from '../designer/help/sentence';
import type { HelpItem } from '../designer/help/types';
import { th } from './help';

/** Every explained setting in the help texts, wherever it stands. */
function items(value: unknown): HelpItem[] {
    if (!value || typeof value !== 'object') return [];
    if ('term' in value && 'text' in value) return [value as HelpItem];
    return Object.values(value).flatMap(items);
}

describe('the help texts (Plan.md 98, D)', () => {
    it('each first sentence is a short tip of its own', () => {
        const all = items(th);
        expect(all.length).toBeGreaterThan(20);
        const tooLong = all.map((item) => firstSentence(item.text)).filter((s) => s.length > 120 || !/[.!?]$/.test(s));
        expect(tooLong).toEqual([]);
    });
});
