<script setup lang="ts">
/**
 * The pictures of the media library: list, upload, delete – shared by the
 * dialog in the editor and the media library page (Plan.md, Nächste Schritte 16).
 */
import { onMounted, ref } from 'vue';
import { MediaInUseError, MediaLibrary, wikiBackend, type MediaItem } from '../media/library';
import { prepareImage } from '../media/scale';
import { ensureOverviewPage } from '../media/wiki';
import type { MediaDoc } from '../model/schema';
import { sizedImageUrl } from '../player/format';
import { getRepository } from '../store/backend';

const props = defineProps<{
    /** The wiki page new uploads go to: the screen's own, or the general one of the media library page. */
    target: { slug: string; name: string };
    selectedMediaId?: string;
    /** In the editor a click on a picture chooses it; on the media library page there is nothing to choose for. */
    choosable?: boolean;
}>();
const emit = defineEmits<{ choose: [MediaDoc] }>();

const items = ref<MediaItem[]>([]);
const loading = ref(true);
const busy = ref<string | null>(null);
const problem = ref<string | null>(null);
const dragOver = ref(false);
const input = ref<HTMLInputElement | null>(null);
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

function message(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

async function upload(files: FileList | File[] | null): Promise<void> {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith('image/'));
    if (!library || !list.length) return;
    problem.value = null;
    try {
        const prepared = [];
        for (const [i, file] of list.entries()) {
            busy.value = `Bereite vor: ${file.name} (${i + 1}/${list.length})`;
            prepared.push(await prepareImage(file));
        }
        busy.value = `Lade ${list.length === 1 ? 'Bild' : `${list.length} Bilder`} hoch …`;
        const docs = await library.upload(prepared, props.target);
        await reload();
        if (props.choosable && docs.length === 1) emit('choose', docs[0]!);
    } catch (e) {
        problem.value = `Hochladen fehlgeschlagen: ${message(e)}`;
    } finally {
        busy.value = null;
        if (input.value) input.value.value = '';
    }
}

async function choose(item: MediaItem): Promise<void> {
    if (!library) return;
    try {
        emit('choose', await library.adopt(item));
    } catch (e) {
        problem.value = message(e);
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
        if (!window.confirm(`Das Bild wird noch gezeigt:\n\n${where}\n\nDort bleibt eine leere Fläche. Trotzdem löschen?`)) return;
        await library.remove(item, true);
    }
    await reload();
}

function onDrop(event: DragEvent): void {
    dragOver.value = false;
    void upload(event.dataTransfer?.files ?? null);
}
</script>

<template>
    <div
        class="media-panel"
        :class="{ 'media-panel--drop': dragOver }"
        data-testid="media-library"
        @dragover.prevent="dragOver = true"
        @dragleave.self="dragOver = false"
        @drop.prevent="onDrop"
    >
        <header>
            <slot name="title" />
            <span class="spacer" />
            <button class="d-btn d-btn--create" type="button" :disabled="!!busy || loading" @click="input?.click()">
                Bilder hochladen
            </button>
            <slot name="actions" />
            <input
                ref="input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                hidden
                data-testid="media-upload"
                @change="upload(($event.target as HTMLInputElement).files)"
            >
        </header>

        <p v-if="busy" class="banner">{{ busy }}</p>
        <p v-if="problem" class="banner banner--error" role="alert">{{ problem }}</p>

        <p v-if="loading" class="empty">Lade Bilder …</p>
        <div v-else-if="items.length" class="grid">
            <figure
                v-for="item in items"
                :key="item.fileId"
                :class="{ selected: item.mediaId && item.mediaId === selectedMediaId }"
                data-testid="media-item"
            >
                <button
                    v-if="choosable"
                    class="pick"
                    type="button"
                    :title="`${item.name} verwenden`"
                    @click="choose(item)"
                >
                    <img :src="sizedImageUrl(item.imageUrl, 320, 180, 'crop')" :alt="item.name" loading="lazy">
                </button>
                <div v-else class="pick">
                    <img :src="sizedImageUrl(item.imageUrl, 320, 180, 'crop')" :alt="item.name" loading="lazy">
                </div>
                <figcaption>
                    <span class="name" :title="item.name">{{ item.name }}</span>
                    <span class="page">{{ item.page }}</span>
                    <button class="delete" type="button" title="Löschen" @click="remove(item)">Löschen</button>
                </figcaption>
            </figure>
        </div>
        <p v-else class="empty">
            Noch keine Bilder. Hochladen per Knopf oder einfach hierher ziehen.
        </p>
    </div>
</template>

<style scoped>
.media-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    max-height: 100%;
    border: 2px solid transparent;
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
}
.media-panel--drop {
    border-color: var(--d-accent);
    border-style: dashed;
}
header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--d-divider);
}
.page {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.spacer {
    flex: 1;
}
.banner {
    margin: 0;
    padding: 6px 16px;
    background: var(--d-accent-pale);
    font-size: var(--d-size-sm);
}
.banner--error {
    background: var(--d-danger-pale);
}
.grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
    overflow-y: auto;
    padding: 16px;
}
figure {
    margin: 0;
    border: 2px solid transparent;
    border-radius: var(--d-radius-lg);
}
figure.selected {
    border-color: var(--d-accent);
}
.pick {
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    border-radius: var(--d-radius);
    background: var(--d-panel);
    cursor: pointer;
    aspect-ratio: 16 / 9;
    overflow: hidden;
}
.pick img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}
button.pick:hover img {
    opacity: 0.85;
}
figcaption {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0 6px;
    padding: 4px 2px 0;
    font-size: var(--d-size-sm);
}
.name,
.page {
    grid-column: 1;
    min-width: 0;
}
.name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.delete {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
    border: 0;
    background: none;
    color: var(--d-danger);
    font: inherit;
    cursor: pointer;
}
.empty {
    padding: 40px 16px;
    margin: 0;
    color: var(--d-text-muted);
    text-align: center;
}
</style>
