/**
 * Where images live (G26): ChurchTools has no free file storage, so the module
 * keeps its own wiki category. Its start page `main` explains the infoscreen,
 * and every screen gets a page titled with its slug that carries its images.
 * Page titles cannot be changed later (Academy) – the slug is fixed anyway.
 *
 * The device needs no wiki rights: images are served through the image
 * service address, which works without sign-in (G14).
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

export async function findOrCreateCategory(): Promise<WikiCategory> {
    const categories = await churchtoolsClient.get<WikiCategory[]>('/wiki/categories');
    const found = categories.find((c) => c.name === WIKI_CATEGORY_NAME);
    if (found) return found;
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

Diese Kategorie gehört zum **Infoscreen Designer**. Gestaltet werden die Screens dort: [Infoscreen Designer öffnen](${extensionUrl})

## Was hier liegt

Jeder Screen hat eine eigene Seite, benannt nach seiner Adresse. An ihr hängen die Bilder, die für diesen Screen hochgeladen wurden. Ein Bild lässt sich trotzdem in jedem Screen verwenden.

## So kommt ein Screen auf den Fernseher

1. Im Designer einen Screen anlegen und gestalten.
2. Einen eigenen Benutzer für die Geräte einrichten, ohne Zwei-Faktor-Anmeldung und nur mit Leserechten.
3. Am Raspberry Pi die Player-Adresse des Screens mit dem Anmelde-Token dieses Benutzers öffnen.

## Gut zu wissen

- Bilder hier zu löschen entfernt sie auch von den Screens, die sie zeigen – im Designer wird vorher angezeigt, wo ein Bild verwendet wird.
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
