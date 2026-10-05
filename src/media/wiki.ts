/**
 * Where images live (G26): ChurchTools has no free file storage, so the module
 * keeps its own wiki category. Its start page `main` explains why the area
 * exists; uploads go to the page "Mediathek", older ones hang on a page per
 * screen, titled with its slug.
 * Page titles cannot be changed later (Academy) – the slug is fixed anyway.
 *
 * Images are served through the image service address, which works without
 * sign-in (G14). Videos only come through the download address, which wants
 * the right to see the category (G47).
 */
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { httpStatus } from '../ct/client';

export const WIKI_CATEGORY_NAME = 'Infoscreen';
const OVERVIEW_PAGE = 'main';
/** Marks text the module wrote, so that it never overwrites what people wrote. */
const MARKER = '<!-- infoscreen-designer -->';

export interface WikiCategory {
    id: number;
    name: string;
    sortKey?: number;
    campusId?: number | null;
    /** „Im Menü anzeigen": off, the wiki lists it under „Ausgeblendet" – it does not vanish (G36). */
    inMenu?: boolean;
    fileAccessWithoutPermission?: boolean;
}

export interface WikiPage {
    guid: string;
    title: string;
    text?: string | null;
}

export interface WikiFile {
    id: number;
    name: string;
    imageUrl: string | null;
    /** Download address; the only one a video has (G42). */
    fileUrl?: string | null;
    size?: number | null;
    imageMetadata?: { width?: number; height?: number } | null;
    meta?: { createdDate?: string };
}

/**
 * Shows the area among the wiki's categories or moves it under
 * „Ausgeblendet" (G36). `PUT` takes the whole category, so the other
 * fields are sent as they are.
 */
export async function setCategoryInMenu(category: WikiCategory, inMenu: boolean): Promise<WikiCategory> {
    return churchtoolsClient.put<WikiCategory>(`/wiki/categories/${category.id}`, {
        name: category.name,
        sortKey: category.sortKey ?? 99,
        campusId: category.campusId ?? null,
        inMenu,
        fileAccessWithoutPermission: category.fileAccessWithoutPermission ?? false,
    });
}

/** What „Automatische Einrichtung rückgängig machen" managed to do about the area's visibility. */
export type WikiRestoreOutcome = 'shown' | 'already-shown' | { error: string };

/**
 * Wording for the log line after „Automatische Einrichtung rückgängig machen" tries to put the
 * wiki area back among „Kategorien" (Plan.md, F, 2026-09-28): it is never
 * deleted, whether or not the assistant created it – only shown again, so
 * administrators without the removed groups still find the pictures.
 */
export function wikiRestoreLogLine(categoryName: string, outcome: WikiRestoreOutcome): string {
    if (outcome === 'shown') {
        return `Wiki-Bereich „${categoryName}" bleibt erhalten und steht im Wiki wieder unter „Kategorien" – dort lassen sich die Bilder sichern.`;
    }
    if (outcome === 'already-shown') {
        return `Wiki-Bereich „${categoryName}" bleibt erhalten – dort lassen sich die Bilder sichern.`;
    }
    return `Wiki-Bereich konnte nicht wieder eingeblendet werden: ${outcome.error} – im Wiki unter „Ausgeblendet" zu finden.`;
}

/** Looks for the module's wiki category by name; `null` without a match, never creates one (Plan.md, F). */
export async function findCategory(): Promise<WikiCategory | null> {
    const categories = await churchtoolsClient.get<WikiCategory[]>('/wiki/categories');
    return categories.find((c) => c.name === WIKI_CATEGORY_NAME) ?? null;
}

/** Creates the module's wiki category. Only the setup assistant calls this, and remembers the id (Plan.md, F). */
export async function createCategory(): Promise<WikiCategory> {
    return churchtoolsClient.post<WikiCategory>('/wiki/categories', {
        name: WIKI_CATEGORY_NAME,
        sortKey: 99,
        // The media library lives in the designer; the wiki keeps it out of sight under „Ausgeblendet" (G36).
        inMenu: false,
        // Explicit booleans: without them ChurchTools answers 400 (G8).
        fileAccessWithoutPermission: false,
    });
}

export function listPages(categoryId: number): Promise<WikiPage[]> {
    // Not paginated: getAllPages fails here for lack of pagination metadata.
    return churchtoolsClient.get<WikiPage[]>(`/wiki/categories/${categoryId}/pages`);
}

async function getPage(categoryId: number, title: string): Promise<WikiPage | null> {
    try {
        return await churchtoolsClient.get<WikiPage>(`/wiki/categories/${categoryId}/pages/${encodeURIComponent(title)}`);
    } catch (error) {
        if (httpStatus(error) === 404) return null;
        throw error;
    }
}

/** The carrier page of one screen, created on its first upload. */
export async function ensureScreenPage(categoryId: number, slug: string, screenName: string): Promise<WikiPage> {
    const existing = await getPage(categoryId, slug);
    if (existing) return existing;
    return churchtoolsClient.post<WikiPage>(`/wiki/categories/${categoryId}/pages`, {
        title: slug,
        isMarkdown: true,
        text: `${MARKER}\nBilder für den Infoscreen **${screenName}** (Adresse \`${slug}\`).\n\nHochgeladen und ausgewählt werden sie im Infoscreen Designer. Wer hier ein Bild löscht, das noch auf einem Screen verwendet wird, lässt dort eine leere Fläche zurück.`,
    });
}

/** Writes the instructions to the start page – but only while nobody else has written there. */
export async function ensureOverviewPage(categoryId: number, extensionUrl: string): Promise<void> {
    const page = await getPage(categoryId, OVERVIEW_PAGE);
    const text = page?.text ?? '';
    if (text.trim() !== '' && !text.startsWith(MARKER)) return;
    const body = overviewText(extensionUrl);
    if (text === body) return;
    if (page) {
        // Reading works by title, changing only by GUID (G27).
        await churchtoolsClient.patch(`/wiki/categories/${categoryId}/pages/${page.guid}`, { text: body, isMarkdown: true });
    } else {
        await churchtoolsClient.post(`/wiki/categories/${categoryId}/pages`, { title: OVERVIEW_PAGE, text: body, isMarkdown: true });
    }
}

export function overviewText(extensionUrl: string): string {
    return `${MARKER}
# Infoscreen

Diese Kategorie gehört zum **Infoscreen Designer**, mit dem die Gemeinde ihre Fernseher im Foyer und in den Räumen gestaltet: [Infoscreen Designer öffnen](${extensionUrl})

## Warum es diesen Bereich gibt

Die Fernseher zeigen Bilder – Plakate, Logos, Hintergründe. ChurchTools bietet einer Erweiterung keinen eigenen Dateispeicher; Bilder kann sie nur an eine Seite im Wiki hängen. Deshalb legt der Designer diesen Bereich an und speichert hier, was in seiner **Mediathek** hochgeladen wird. Das Wiki ist nur der Ablageort: Hochgeladen, ausgewählt und gelöscht wird im Designer.

Damit er im Wiki nicht stört, lässt er sich in den Einstellungen des Designers unter „Ausgeblendet" verschieben – neu angelegt steht er schon dort.

## Was hier liegt

- **Mediathek**: die Bilder, die im Designer hochgeladen wurden.
- Seiten, die nach der Adresse eines Screens benannt sind: Bilder aus der Zeit, als jeder Screen seine eigenen hatte. Sie lassen sich weiter in jedem Screen verwenden.

## Gut zu wissen

- Bilder hier zu löschen entfernt sie auch von den Fernsehern, die sie zeigen. Im Designer wird vorher angezeigt, wo ein Bild verwendet wird – dort löschen ist sicherer.
- Bildadressen sind ohne Anmeldung abrufbar, geschützt nur durch eine lange Zufallskennung. Bitte keine vertraulichen Bilder hochladen.
- Diese Seite schreibt der Designer selbst, solange sie niemand ändert. Wer sie bearbeitet, übernimmt sie.
`;
}

export function listFiles(categoryId: number, pageGuid: string): Promise<WikiFile[]> {
    return churchtoolsClient.get<WikiFile[]>(`/files/wiki_${categoryId}/${pageGuid}`);
}

export async function uploadFile(categoryId: number, pageGuid: string, file: Blob, name: string): Promise<WikiFile> {
    const form = new FormData();
    form.append('files[]', file, name);
    const uploaded = await churchtoolsClient.post<WikiFile[]>(`/files/wiki_${categoryId}/${pageGuid}`, form);
    const first = uploaded[0];
    if (!first) throw new Error('ChurchTools hat keine Datei zurückgegeben.');
    return first;
}

export async function deleteFile(fileId: number): Promise<void> {
    await churchtoolsClient.deleteApi(`/files/${fileId}`);
}
