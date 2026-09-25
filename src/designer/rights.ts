/**
 * What a designer needs, checked against the signed-in person's own
 * permissions (Plan.md, F). Missing rights do not look like errors – they
 * look like empty lists (G20) –, so the designer names them instead of
 * showing "no screens yet".
 *
 * The module rights follow `CustomModulePermission` of build 32882 (G4): data
 * rights are lists of category ids. Their labels in the ChurchTools interface
 * are unknown until Custom Modules are enabled (T1), so the API key is shown
 * next to a German description.
 */
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { EXTENSION_KEY } from '../config';
import { WIKI_CATEGORY_NAME, type WikiCategory } from '../media/wiki';
import { CATEGORIES, type CategoryKey, type ScreenRepository } from '../store/screen-repository';

export interface ModulePermissions {
    view: boolean;
    'create custom category': boolean;
    'view custom category': number[];
    'view custom data': number[];
    'create custom data': number[];
    'edit custom data': number[];
    'delete custom data': number[];
}

/** Measured on the test instance: `churchwiki` in `/permissions/global`. */
export interface WikiPermissions {
    view: boolean;
    'view category': number[];
    'edit category': number[];
}

export interface RightsInput {
    /** `undefined`: not checked (demo mode has no module); `null`: no rights at all. */
    module: Partial<ModulePermissions> | null | undefined;
    /** The module's categories this person can see. */
    categories: Partial<Record<CategoryKey, number>>;
    wiki: Partial<WikiPermissions> | null;
    /** `null`: the wiki category "Infoscreen" is not visible. */
    wikiCategoryId: number | null;
}

export interface MissingRight {
    area: 'module' | 'wiki';
    /** What is missing, in German. */
    text: string;
    /** The permission key as the API names it, for whoever grants it. */
    key?: string;
    /** Which categories, or why it is needed. */
    detail?: string;
}

const ALL = Object.keys(CATEGORIES) as CategoryKey[];
/** Designers write content; screens and settings belong to the administrators (Plan.md, F). */
const WRITTEN: CategoryKey[] = ['playlists', 'slides', 'media'];

const DATA_RIGHTS: [keyof ModulePermissions, string, CategoryKey[]][] = [
    ['view custom data', 'Daten ansehen', ALL],
    ['create custom data', 'Daten anlegen', WRITTEN],
    ['edit custom data', 'Daten bearbeiten', WRITTEN],
    ['delete custom data', 'Daten löschen', WRITTEN],
];

const names = (keys: CategoryKey[]) => keys.map((k) => CATEGORIES[k].name).join(', ');

export function missingDesignerRights(input: RightsInput): MissingRight[] {
    return [...missingModuleRights(input), ...missingWikiRights(input)];
}

function missingModuleRights({ module, categories }: RightsInput): MissingRight[] {
    if (module === undefined) return [];
    const missing = (text: string, key?: string, detail?: string): MissingRight => ({ area: 'module', text, key, detail });
    if (module === null) return [missing('Keine Rechte am Modul „Infoscreen Designer"')];

    const result: MissingRight[] = [];
    if (!module.view) result.push(missing('Modul ansehen', 'view'));

    const hidden = ALL.filter((key) => categories[key] === undefined);
    if (hidden.length && !module['create custom category']) {
        // Not visible can mean "not created yet" or "not allowed to see" – both are named.
        result.push(
            missing(
                'Kategorien sehen',
                'view custom category',
                `${names(hidden)} – oder das Modul wurde noch nie von jemandem geöffnet, ` +
                    'der Kategorien anlegen darf (create custom category).',
            ),
        );
    }

    for (const [key, label, needed] of DATA_RIGHTS) {
        const granted = new Set((module[key] as number[] | undefined) ?? []);
        const lacking = needed.filter((k) => categories[k] !== undefined && !granted.has(categories[k]!));
        if (lacking.length) result.push(missing(label, key, names(lacking)));
    }
    return result;
}

function missingWikiRights({ wiki, wikiCategoryId }: RightsInput): MissingRight[] {
    const missing = (text: string, key?: string, detail?: string): MissingRight => ({ area: 'wiki', text, key, detail });
    if (!wiki?.view) return [missing('Wiki ansehen', 'churchwiki: view', 'für die Mediathek')];
    if (wikiCategoryId === null) {
        return [
            missing(
                `Wiki-Bereich „${WIKI_CATEGORY_NAME}" ansehen`,
                'view category',
                'Der Bereich ist nicht sichtbar – entweder fehlt dieses Recht, oder er entsteht erst beim ersten Bild-Upload.',
            ),
        ];
    }
    const result: MissingRight[] = [];
    if (!wiki['view category']?.includes(wikiCategoryId)) {
        result.push(missing(`Wiki-Bereich „${WIKI_CATEGORY_NAME}" ansehen`, 'view category', 'für die Mediathek'));
    }
    if (!wiki['edit category']?.includes(wikiCategoryId)) {
        result.push(missing(`Wiki-Bereich „${WIKI_CATEGORY_NAME}" bearbeiten`, 'edit category', 'für Bild-Uploads'));
    }
    return result;
}

/** Reads everything the check needs. In demo mode the module part is skipped: there is no module. */
/**
 * Whether this person may configure screens – create, change and delete them
 * (Plan.md, F: the administrators' part). Asked of the module rights on the
 * category `screens`, not of a ChurchTools admin right: the buttons follow
 * what the server allows, or they would end in a 403 (seen 2026-09-25 with an
 * account that may administer persons but no longer write screens).
 */
export function mayConfigureScreens(module: Partial<ModulePermissions> | null | undefined, screensCategoryId: number | undefined): boolean {
    if (!module || screensCategoryId === undefined) return false;
    const covers = (ids: number[] | undefined) => !!ids && (ids.includes(screensCategoryId) || ids.includes(-1));
    return covers(module['create custom data']) && covers(module['edit custom data']) && covers(module['delete custom data']);
}

export interface DesignerRights {
    missing: MissingRight[];
    /** See {@link mayConfigureScreens}; null in demo mode, which has no module rights to ask. */
    configureScreens: boolean | null;
}

export async function checkDesignerRights(repository: ScreenRepository, demo: boolean): Promise<DesignerRights> {
    const [permissions, categories, wikiCategories] = await Promise.all([
        churchtoolsClient.get<Record<string, unknown>>('/permissions/global'),
        demo ? Promise.resolve({}) : repository.visibleCategories(),
        churchtoolsClient.get<WikiCategory[]>('/wiki/categories'),
    ]);
    const module = demo ? undefined : ((permissions[EXTENSION_KEY] as Partial<ModulePermissions> | undefined) ?? null);
    return {
        missing: missingDesignerRights({
            module,
            categories,
            wiki: (permissions.churchwiki as Partial<WikiPermissions> | undefined) ?? null,
            wikiCategoryId: wikiCategories.find((c) => c.name === WIKI_CATEGORY_NAME)?.id ?? null,
        }),
        configureScreens: demo ? null : mayConfigureScreens(module, (categories as Partial<Record<CategoryKey, number>>).screens),
    };
}
