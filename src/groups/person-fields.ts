/**
 * Which person fields the setup offers an administrator to release and the designer to show (Plan.md 115, G76): every field
 * `GET /fields` names for a person that is active, not hidden and of a type that shows as plain text. The release by the
 * administrator stays the second barrier (`SettingsDoc.personFields`).
 */
import type { PersonFieldInfo } from '../ct/api';

/** The categories of `GET /fields` that hold person fields; `f_group` are fields of groups. */
const PERSON_CATEGORIES = ['f_address', 'f_church', 'f_category', 'f_dep', 'f_growpath', 'f_datasecurity'];

/** Types shown as text (`textarea` as Markdown, like a comment field of a member). Choice fields (`select` …) not yet: their option names are partly translation keys and carry their own levels (G76). */
const SHOWN_TYPES = ['text', 'textarea', 'date', 'number', 'checkbox'];

/** The name is shown anyway; username and GUID are technology. */
const EXCLUDED_KEYS = ['firstName', 'lastName', 'cmsUserId', 'guid'];

/** The fields to offer, in the order of `GET /fields`; a key that occurs twice counts once (the first hit). */
export function offeredPersonFields(defs: readonly PersonFieldInfo[]): PersonFieldInfo[] {
    const seen = new Set<string>();
    return defs.filter((f) => {
        if (!PERSON_CATEGORIES.includes(f.category) || !f.isActive || f.hidden || !SHOWN_TYPES.includes(f.type) || EXCLUDED_KEYS.includes(f.key) || seen.has(f.key)) return false;
        seen.add(f.key);
        return true;
    });
}
