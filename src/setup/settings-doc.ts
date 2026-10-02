/**
 * What `saveSettings` is given: the settings as stored, with only the fields of one change replaced.
 * The settings document has several writers (the assistant's groups, the services an administrator
 * allows); none of them may lose what the others keep in it.
 */
import { SCHEMA_VERSION, type SettingsDoc } from '../model/schema';

export type SettingsFields = Omit<SettingsDoc, 'id' | 'kind'>;

/** `current` is the stored document (null before the first save); a key in `changes` – even `undefined` – replaces it. */
export function settingsToSave(current: SettingsDoc | null, changes: Partial<SettingsFields>): SettingsFields {
    const kept: Partial<SettingsDoc> = { ...current };
    delete kept.id;
    delete kept.kind;
    return { ...kept, schema: { ...SCHEMA_VERSION }, ...changes };
}
