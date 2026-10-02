import { describe, expect, it } from 'vitest';
import { readSettings } from '../model/read';
import { SCHEMA_VERSION, type SettingsDoc } from '../model/schema';
import { settingsToSave } from './settings-doc';

const stored: SettingsDoc = {
    schema: { major: 1, minor: 19 },
    id: 'settings',
    kind: 'settings',
    designerGroupId: 11,
    deviceGroupId: 12,
    createdGroupIds: [11, 12],
    createdWikiCategoryId: 5,
    allowedServiceIds: [3, 7],
};

describe('settingsToSave', () => {
    it('keeps the allowed services when the groups are saved', () => {
        const saved = settingsToSave(stored, { designerGroupId: 21, deviceGroupId: undefined, createdGroupIds: [21], createdWikiCategoryId: 5 });
        expect(saved).toMatchObject({ designerGroupId: 21, createdGroupIds: [21], createdWikiCategoryId: 5, allowedServiceIds: [3, 7] });
        expect(saved.deviceGroupId).toBeUndefined();
        expect(saved.schema).toEqual(SCHEMA_VERSION);
    });

    it('keeps the groups and the wiki category when the allowed services are saved', () => {
        const saved = settingsToSave(stored, { allowedServiceIds: [7] });
        expect(saved).toMatchObject({ designerGroupId: 11, deviceGroupId: 12, createdGroupIds: [11, 12], createdWikiCategoryId: 5, allowedServiceIds: [7] });
    });

    it('may save an empty allowance and starts from nothing', () => {
        expect(settingsToSave(stored, { allowedServiceIds: [] }).allowedServiceIds).toEqual([]);
        expect(settingsToSave(null, { allowedServiceIds: [3] })).toEqual({ schema: SCHEMA_VERSION, allowedServiceIds: [3] });
    });

    it('is a document readSettings accepts, without id and kind of its own', () => {
        const saved = settingsToSave(stored, { allowedServiceIds: [7] });
        expect(saved).not.toHaveProperty('id');
        expect(readSettings({ ...saved, id: 'settings', kind: 'settings' }).allowedServiceIds).toEqual([7]);
    });
});
