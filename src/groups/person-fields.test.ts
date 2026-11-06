import { describe, expect, it } from 'vitest';
import type { PersonFieldInfo } from '../ct/api';
import { offeredPersonFields } from './person-fields';

const field = (key: string, extra: Partial<PersonFieldInfo> = {}): PersonFieldInfo => ({ key, name: key, secLevel: 1, isActive: true, type: 'text', category: 'f_address', hidden: false, ...extra });

describe('offeredPersonFields (Plan.md 115, G76)', () => {
    it('offers a free field like the nickname, from the person categories only', () => {
        const defs = [field('nickname', { category: 'f_church' }), field('email'), field('groupThing', { category: 'f_group' }), field('other', { category: 'f_unknown' })];
        expect(offeredPersonFields(defs).map((f) => f.key)).toEqual(['nickname', 'email']);
    });

    it('leaves out inactive and hidden fields', () => {
        expect(offeredPersonFields([field('a', { isActive: false }), field('b', { hidden: true }), field('c')]).map((f) => f.key)).toEqual(['c']);
    });

    it('takes text, comment, date, number and checkbox, but no choice fields', () => {
        const defs = ['text', 'date', 'number', 'checkbox', 'select', 'multiselect', 'radioselect', 'datetime'].map((type) => field(type, { type }));
        expect(offeredPersonFields(defs).map((f) => f.key)).toEqual(['text', 'date', 'number', 'checkbox']);
        expect(offeredPersonFields([field('note', { type: 'textarea' })]).map((f) => f.key)).toEqual(['note']);
    });

    it('leaves out name, username and GUID', () => {
        expect(offeredPersonFields(['firstName', 'lastName', 'cmsUserId', 'guid', 'job'].map((k) => field(k))).map((f) => f.key)).toEqual(['job']);
    });

    it('keeps only the first hit of a key that occurs in two categories', () => {
        const defs = [field('campusId', { category: 'f_church', name: 'Erste' }), field('campusId', { category: 'f_category', name: 'Zweite' })];
        expect(offeredPersonFields(defs).map((f) => f.name)).toEqual(['Erste']);
    });
});
