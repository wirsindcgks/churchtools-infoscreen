/**
 * What `saveSettings` is given: the settings as stored, with only the fields of one change replaced.
 * The settings document has several writers (the assistant's groups, the services an administrator
 * allows); none of them may lose what the others keep in it.
 */
import { SCHEMA_VERSION, type SettingsDoc } from '../model/schema';

export type SettingsFields = Omit<SettingsDoc, 'id' | 'kind'>;

/** The released rehearsal screens that still exist (Plan.md 125 A): the one reading of the release for the page, the plan and the check of rights. */
export function releasedRehearsalScreens(settings: Pick<SettingsDoc, 'rehearsalScreenIds'> | null | undefined, screens: readonly { id: string }[]): string[] {
    return (settings?.rehearsalScreenIds ?? []).filter((id) => screens.some((s) => s.id === id));
}

/** `current` is the stored document (null before the first save); a key in `changes` – even `undefined` – replaces it. */
export function settingsToSave(current: SettingsDoc | null, changes: Partial<SettingsFields>): SettingsFields {
    const kept: Partial<SettingsDoc> = { ...current };
    delete kept.id;
    delete kept.kind;
    return { ...kept, schema: { ...SCHEMA_VERSION }, ...changes };
}
