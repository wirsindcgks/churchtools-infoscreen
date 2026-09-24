import { describe, expect, it } from 'vitest';
import { assertAuthenticated, NotAuthenticatedError } from './client';

describe('assertAuthenticated', () => {
    it('accepts a real person', () => {
        const person = { id: 16, firstName: 'Anna', lastName: 'Muster' };
        expect(assertAuthenticated(person)).toBe(person);
    });

    it('rejects the anonymous pseudo person ChurchTools returns with status 200', () => {
        expect(() => assertAuthenticated({ id: -1, firstName: '', lastName: 'Anonymous' })).toThrow(
            NotAuthenticatedError,
        );
    });

    it('rejects a missing response', () => {
        expect(() => assertAuthenticated(undefined)).toThrow(NotAuthenticatedError);
    });
});
