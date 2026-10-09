/**
 * Whether the setup assistant may create the wiki area "Infoscreen" (Plan.md, Nächste Schritte 55 B). An
 * administrator who cannot see the area takes it for missing, and the assistant would create a second one – so it
 * creates only if no area is saved as created and the administrator may see the wiki at all.
 */
import { t } from '../i18n/designer';
import { WIKI_CATEGORY_NAME } from '../media/wiki';

export interface WikiCreationInput {
    /** The area the administrator sees under that name, if any. */
    visibleCategoryId: number | null;
    /** `createdWikiCategoryId` of the settings: an area this module created earlier. */
    createdCategoryId: number | null;
    /** `churchwiki: view` of the signed-in administrator. */
    canViewWiki: boolean;
}

export type WikiCreation = { create: true } | { create: false; problem?: string };

export function wikiCategoryCreation({ visibleCategoryId, createdCategoryId, canViewWiki }: WikiCreationInput): WikiCreation {
    if (visibleCategoryId !== null) return { create: false };
    if (createdCategoryId !== null) {
        return {
            create: false,
            problem: t.setup.wikiCreation.notVisible(WIKI_CATEGORY_NAME),
        };
    }
    if (!canViewWiki) {
        return {
            create: false,
            problem: t.setup.wikiCreation.noRight,
        };
    }
    return { create: true };
}
