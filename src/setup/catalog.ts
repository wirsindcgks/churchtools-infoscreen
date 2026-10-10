/**
 * Permission ids by name. Rights of a role come as bare numbers (G30), and the
 * ids of this extension's rights are handed out when it is installed – 2010
 * to 2018 on the test instance, possibly others elsewhere (G33). The only
 * source that names them is the legacy `churchauth` master data. It needs a
 * session with CSRF token, which the page has inside ChurchTools; in local
 * development through the proxy it has not, and the callers say so.
 */
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { t } from '../i18n/designer';

interface AuthEntry {
    id: number | string;
    auth: string;
    /** The right as the permission management of ChurchTools words it, e.g. "Einzelnen Kalender sehen". */
    bezeichnung?: string | null;
}

/**
 * The modules as ChurchTools' own overview of a person's rights heads them ("Personen: …", read off
 * the test instance on 2026-10-02). A module not listed here gives its right without a heading.
 */
const MODULE_NAMES: Record<string, string> = {
    churchdb: 'Personen',
    churchcal: 'Kalender',
    churchservice: 'Events',
    churchresource: 'Ressourcen',
    churchwiki: 'Wiki',
};

export interface AuthCatalog {
    /** The id of a right, e.g. `id('infoscreen-designer', 'view')`; undefined if unknown. */
    id(module: string, auth: string): number | undefined;
    /**
     * A right by its id, in the words of ChurchTools: `name(403)` → "Kalender: Einzelnen Kalender sehen".
     * Without a wording in the catalogue, module and API name ("churchcal: view category"); undefined if unknown.
     */
    name(id: number): string | undefined;
}

export function catalogFrom(authTable: Record<string, Record<string, AuthEntry>>): AuthCatalog {
    const names = new Map<number, string>();
    for (const [module, rights] of Object.entries(authTable)) {
        for (const [auth, entry] of Object.entries(rights ?? {})) {
            const wording = entry.bezeichnung?.trim();
            const heading = MODULE_NAMES[module];
            names.set(Number(entry.id), wording ? (heading ? `${heading}: ${wording}` : wording) : `${module}: ${entry.auth ?? auth}`);
        }
    }
    return {
        id(module, auth) {
            const entry = authTable[module]?.[auth];
            return entry ? Number(entry.id) : undefined;
        },
        name: (id) => names.get(id),
    };
}

export async function loadAuthCatalog(): Promise<AuthCatalog> {
    const data = (await churchtoolsClient.oldApi('churchauth/ajax', 'getMasterData')) as {
        auth_table?: Record<string, Record<string, AuthEntry>>;
    };
    if (!data?.auth_table) throw new Error(t.setup.catalogUnreadable);
    return catalogFrom(data.auth_table);
}
