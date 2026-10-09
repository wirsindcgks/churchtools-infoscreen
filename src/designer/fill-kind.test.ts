import { describe, expect, it } from 'vitest';
import type { Fill } from '../model/schema';
import { fillOfKind } from './fill-kind';

describe('fillOfKind', () => {
    it('keeps a fill of the same kind as it is', () => {
        const solid: Fill = { kind: 'solid', color: '#ff0000' };
        expect(fillOfKind(solid, 'solid')).toBe(solid);
    });

    it('starts a gradient from the colour and runs it to black', () => {
        expect(fillOfKind({ kind: 'solid', color: '#ff0000' }, 'linear-gradient')).toEqual({
            kind: 'linear-gradient',
            angle: 135,
            stops: [{ color: '#ff0000', at: 0 }, { color: '#000000', at: 1 }],
        });
    });

    it('takes the first colour of a gradient as the solid colour', () => {
        const gradient: Fill = { kind: 'linear-gradient', angle: 90, stops: [{ color: '#00ff00', at: 0 }, { color: '#0000ff', at: 1 }] };
        expect(fillOfKind(gradient, 'solid')).toEqual({ kind: 'solid', color: '#00ff00' });
    });
});
