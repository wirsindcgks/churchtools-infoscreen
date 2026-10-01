/**
 * The pictures and videos of the media library: list, upload, delete – shared by the
 * media library page and the dialog in the editor (Plan.md, Nächste Schritte
 * 16), each of which lays them out in its own frame.
 */
import { onMounted, ref } from 'vue';
import { MediaInUseError, MediaLibrary, wikiBackend, type MediaItem } from '../media/library';
import { prepareImage } from '../media/scale';
import { looksLikeVideo, videoProblem } from '../media/video';
import { ensureOverviewPage } from '../media/wiki';
import type { MediaDoc } from '../model/schema';
import { getRepository } from '../store/backend';

/** What an upload takes: the dialog for a block takes the kind the block needs, the library page both. */
export type MediaKinds = 'image' | 'video' | 'all';

/** What a file picker offers for the kinds. */
export function acceptFor(kinds: MediaKinds): string {
    const images = 'image/png,image/jpeg,image/webp,image/gif';
    return kinds === 'image' ? images : kinds === 'video' ? 'video/mp4' : `${images},video/mp4`;
}

/** `target`: the wiki page new uploads go to. `uploaded`: called with the documents of one finished upload. */
export function useMediaLibrary(
    target: () => { slug: string; name: string },
    uploaded?: (docs: MediaDoc[]) => void,
    kinds: MediaKinds = 'all',
) {
    const items = ref<MediaItem[]>([]);
    const loading = ref(true);
    const busy = ref<string | null>(null);
    const problem = ref<string | null>(null);
    const dragOver = ref(false);
    let library: MediaLibrary | null = null;

    async function reload(): Promise<void> {
        if (!library) return;
        items.value = await library.list();
    }

    onMounted(async () => {
        try {
            const { repository } = await getRepository();
            library = new MediaLibrary(wikiBackend, repository);
            await reload();
            // The overview page with instructions; a relative link works from inside ChurchTools.
            const category = await wikiBackend.category();
            void ensureOverviewPage(category.id, import.meta.env.BASE_URL).catch((e: unknown) =>
                console.warn('Anleitungsseite nicht geschrieben:', e),
            );
        } catch (e) {
            problem.value = message(e);
        } finally {
            loading.value = false;
        }
    });

    async function upload(files: FileList | File[] | null): Promise<void> {
        const dropped = [...(files ?? [])];
        const list = kinds === 'video' ? [] : dropped.filter((f) => f.type.startsWith('image/'));
        const candidates = kinds === 'image' ? [] : dropped.filter(looksLikeVideo);
        // Type and size are refused before anything is sent.
        const refused = candidates.flatMap((f) => videoProblem(f) ?? []);
        const videos = candidates.filter((f) => !videoProblem(f));
        if (!library || !(list.length || videos.length || refused.length)) return;
        problem.value = refused.length ? [...new Set(refused)].join(' ') : null;
        if (!list.length && !videos.length) return;
        try {
            const docs: MediaDoc[] = [];
            if (list.length) {
                const prepared = [];
                for (const [i, file] of list.entries()) {
                    busy.value = `Bereite vor: ${file.name} (${i + 1}/${list.length})`;
                    prepared.push(await prepareImage(file));
                }
                busy.value = `Lade ${list.length === 1 ? 'Bild' : `${list.length} Bilder`} hoch …`;
                docs.push(...(await library.upload(prepared, target())));
            }
            for (const [i, file] of videos.entries()) {
                busy.value = `Lade Video hoch: ${file.name} (${i + 1}/${videos.length}) …`;
                docs.push(await library.uploadVideo(file, target()));
            }
            await reload();
            uploaded?.(docs);
        } catch (e) {
            problem.value = `Hochladen fehlgeschlagen: ${message(e)}`;
        } finally {
            busy.value = null;
        }
    }

    async function adopt(item: MediaItem): Promise<MediaDoc | null> {
        if (!library) return null;
        try {
            return await library.adopt(item);
        } catch (e) {
            problem.value = message(e);
            return null;
        }
    }

    async function remove(item: MediaItem): Promise<void> {
        if (!library) return;
        problem.value = null;
        try {
            if (!window.confirm(`„${item.name}" aus ChurchTools löschen?`)) return;
            await library.remove(item);
        } catch (e) {
            if (!(e instanceof MediaInUseError)) {
                problem.value = message(e);
                return;
            }
            const where = e.usage.map((u) => `• ${u.playlist} › ${u.slide}`).join('\n');
            if (!window.confirm(`Das ${item.kind === 'video' ? 'Video' : 'Bild'} wird noch gezeigt:\n\n${where}\n\nDort bleibt eine leere Fläche. Trotzdem löschen?`)) return;
            await library.remove(item, true);
        }
        await reload();
    }

    /** Pictures dropped anywhere on the library are uploaded: `v-on="dropZone"`. */
    const dropZone = {
        dragover: (event: DragEvent) => {
            event.preventDefault();
            dragOver.value = true;
        },
        dragleave: (event: DragEvent) => {
            if (event.target === event.currentTarget) dragOver.value = false;
        },
        drop: (event: DragEvent) => {
            event.preventDefault();
            dragOver.value = false;
            void upload(event.dataTransfer?.files ?? null);
        },
    };

    return { items, loading, busy, problem, dragOver, dropZone, upload, adopt, remove, accept: acceptFor(kinds) };
}

function message(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}
