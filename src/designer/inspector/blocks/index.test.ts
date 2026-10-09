import { describe, expect, it } from 'vitest';
import { BLOCK_LABELS } from '../../ops';
import { BLOCK_INSPECTORS } from '.';

describe('inspectors of the blocks', () => {
    it('has one for every block type (the type check says so, too: Record<BlockType, Component>)', () => {
        expect(Object.keys(BLOCK_INSPECTORS).sort()).toEqual(Object.keys(BLOCK_LABELS).sort());
        for (const inspector of Object.values(BLOCK_INSPECTORS)) expect(inspector).toBeTruthy();
    });
});
