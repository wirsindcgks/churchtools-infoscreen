import { describe, expect, it } from 'vitest';
import { GROUP_RIGHT_NAMES, settingsAbilities, type GroupPermissions } from './abilities';

const TYPE = 4;
const abilities = (section: GroupPermissions | undefined, created = [25, 28], type: number | null = TYPE) =>
    settingsAbilities(section, created, type);

describe('settingsAbilities (Plan.md 63)', () => {
    it('allows everything when the section is not readable', () => {
        for (const a of Object.values(abilities(undefined))) expect(a).toEqual({ allowed: true, missing: [] });
    });

    it('allows nothing without a group right, and names what is missing', () => {
        const a = abilities({});
        expect(a.refresh).toEqual({ allowed: false, missing: [GROUP_RIGHT_NAMES.view] });
        expect(a.remove).toEqual({ allowed: false, missing: [GROUP_RIGHT_NAMES.delete] });
        expect(a.create).toEqual({ allowed: false, missing: [GROUP_RIGHT_NAMES.createType, GROUP_RIGHT_NAMES.viewType] });
    });

    it('lets "Gruppen verwalten" alone do everything', () => {
        for (const a of Object.values(abilities({ 'administer groups': true }))) expect(a.allowed).toBe(true);
    });

    it('refresh: every created group must be seen – by id or by the type', () => {
        expect(abilities({ 'view group': [25, 28] }).refresh.allowed).toBe(true);
        expect(abilities({ 'view group': [25] }).refresh.allowed).toBe(false);
        expect(abilities({ 'view groups of grouptype': [TYPE] }).refresh.allowed).toBe(true);
        expect(abilities({ 'view groups of grouptype': [9] }).refresh.allowed).toBe(false);
    });

    it('remove: every created group must be deletable – by id or by the type; seeing is not enough', () => {
        expect(abilities({ 'delete group': [25, 28] }).remove.allowed).toBe(true);
        expect(abilities({ 'delete group': [28] }).remove.allowed).toBe(false);
        expect(abilities({ 'delete groups of grouptype': [TYPE] }).remove.allowed).toBe(true);
        expect(abilities({ 'view group': [25, 28], 'view groups of grouptype': [TYPE] }).remove.allowed).toBe(false);
    });

    it('create: wants creating and seeing for the type – creating alone is not enough (G50)', () => {
        expect(abilities({ 'create groups of grouptype': [TYPE], 'view groups of grouptype': [TYPE] }).create).toEqual({ allowed: true, missing: [] });
        const onlyCreate = abilities({ 'create groups of grouptype': [TYPE] }).create;
        expect(onlyCreate).toEqual({ allowed: false, missing: [GROUP_RIGHT_NAMES.viewType] });
        const onlyView = abilities({ 'view groups of grouptype': [TYPE] }).create;
        expect(onlyView).toEqual({ allowed: false, missing: [GROUP_RIGHT_NAMES.createType] });
        expect(abilities({ 'create groups of grouptype': [9], 'view groups of grouptype': [9] }).create.allowed).toBe(false);
    });

    it('without a type only "Gruppen verwalten" and the id lists count', () => {
        const section = { 'create groups of grouptype': [TYPE], 'view groups of grouptype': [TYPE], 'delete groups of grouptype': [TYPE] };
        const a = abilities(section, [25], null);
        expect([a.refresh.allowed, a.remove.allowed, a.create.allowed]).toEqual([false, false, false]);
        const byId = abilities({ 'view group': [25], 'delete group': [25] }, [25], null);
        expect([byId.refresh.allowed, byId.remove.allowed]).toEqual([true, true]);
        expect(abilities({ 'administer groups': true }, [25], null).create.allowed).toBe(true);
    });

    it('has nothing to refresh or remove without created groups', () => {
        const a = abilities({}, []);
        expect([a.refresh.allowed, a.remove.allowed]).toEqual([true, true]);
    });
});
