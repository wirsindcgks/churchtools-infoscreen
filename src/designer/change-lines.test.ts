import { describe, expect, it } from 'vitest';
import { buildChange } from '../store/changelog';
import { describeChange } from './change-lines';

const line = (overrides: Parameters<typeof buildChange>[0]) => describeChange(buildChange(overrides));
const base = { area: 'playlist' as const, targetId: 'p1', targetName: 'Foyer', by: 'Anna', now: new Date('2026-10-21T10:00:00Z') };

describe('describeChange (Plan.md 100)', () => {
    it('words a publication with counts and names the slides apart', () => {
        const result = line({ ...base, action: 'published', details: ['changed:Begrüßung', 'changed:Termine', 'added:Dank', 'removed:2'] });
        expect(result.text).toBe('„Foyer“ veröffentlicht: 2 Folien geändert, 1 neu, 2 Folien entfernt');
        expect(result.names).toBe('Begrüßung, Termine, Dank');
    });

    it('words the other operations', () => {
        expect(line({ ...base, action: 'created' }).text).toBe('„Foyer“ angelegt');
        expect(line({ ...base, action: 'duplicated', details: ['source:Advent'] }).text).toBe('„Foyer“ angelegt, als Kopie von „Advent“');
        expect(line({ ...base, action: 'deleted' }).text).toBe('„Foyer“ gelöscht');
        expect(line({ ...base, area: 'screen', action: 'schedule', details: ['rules:3'] }).text).toBe('Zeitplan von „Foyer“ geändert: 3 Regeln');
        expect(line({ ...base, action: 'banners', details: ['banner:set'] }).text).toBe('Hinweisband von „Foyer“ gesetzt');
        expect(line({ ...base, area: 'screen', action: 'settings', details: ['renamed:Eingang'] }).text).toBe('Einstellungen von „Foyer“ geändert: vorher „Eingang“');
        expect(line({ ...base, area: 'theme', action: 'saved' }).text).toBe('Design geändert');
    });

    it('does not fail on an action it does not know', () => {
        expect(line({ ...base, action: 'zukunft' }).text).toBe('„Foyer“: zukunft');
    });
});
