<script setup lang="ts">
/**
 * The media library as a section of its own (Plan.md, Nächste Schritte 16
 * and 18): all pictures and videos with where they are shown, search, "Unbenutzt" to
 * tidy up, upload and delete – one file or several picked by their checkbox, after a dialog that names every
 * place a file is still shown – without opening a playlist first. Uploads go
 * to the wiki page "Mediathek"; the wiki category stays the storage behind
 * it (G8).
 */
import { computed, ref } from 'vue';
import FilterChips from '../designer/FilterChips.vue';
import GroupCard from '../designer/GroupCard.vue';
import Icon from '../designer/Icon.vue';
import MediaDeleteDialog from '../designer/MediaDeleteDialog.vue';
import MediaGrid from '../designer/MediaGrid.vue';
import MediaPreview from '../designer/MediaPreview.vue';
import ModulePage from '../designer/ModulePage.vue';
import PageHeader from '../designer/PageHeader.vue';
import SearchField from '../designer/SearchField.vue';
import { useMediaLibrary } from '../designer/useMediaLibrary';
import { filterMedia, MEDIA_PAGE as GENERAL, type MediaItem, type MediaShow } from '../media/library';

const { items, loading, busy, problem, dragOver, dropZone, upload, removeMany, reload, accept } = useMediaLibrary(() => GENERAL);

const query = ref('');
const show = ref<MediaShow>('all');
const shown = computed(() => filterMedia(items.value, query.value, show.value));

/** The file open in the preview; it pages through `shown`, so search and filter apply. */
const previewId = ref<number | null>(null);

const SHOW = [
    { key: 'all', label: 'Alle', title: 'Alle Bilder und Videos' },
    { key: 'used', label: 'Verwendet', title: 'Verwendete Bilder und Videos' },
    { key: 'unused', label: 'Unbenutzt', title: 'Unbenutzte Bilder und Videos' },
] as const;

/** File ids picked by their checkbox. A file hidden by search or filter stays picked – and is named in the dialog. */
const selected = ref<number[]>([]);
const picks = computed(() => items.value.filter((i) => selected.value.includes(i.fileId)));
const allShown = computed(() => shown.value.length > 0 && shown.value.every((i) => selected.value.includes(i.fileId)));

function toggle(item: MediaItem): void {
    selected.value = selected.value.includes(item.fileId)
        ? selected.value.filter((id) => id !== item.fileId)
        : [...selected.value, item.fileId];
}

function toggleAll(): void {
    const ids = shown.value.map((i) => i.fileId);
    selected.value = allShown.value
        ? selected.value.filter((id) => !ids.includes(id))
        : [...new Set([...selected.value, ...ids])];
}

const deleting = ref(false);
/** Where each file is shown is read again first: the dialog must not promise "unbenutzt" from an old list. */
async function askDelete(): Promise<void> {
    await reload().catch(() => undefined);
    selected.value = picks.value.map((i) => i.fileId);
    deleting.value = picks.value.length > 0;
}

async function confirmDelete(list: MediaItem[]): Promise<void> {
    deleting.value = false;
    const gone = await removeMany(list);
    selected.value = selected.value.filter((id) => !gone.includes(id));
}

const input = ref<HTMLInputElement | null>(null);
async function picked(): Promise<void> {
    await upload(input.value?.files ?? null);
    if (input.value) input.value.value = '';
}
</script>

<template>
    <ModulePage current="media">
        <template #actions>
            <button
                class="d-btn d-btn--create"
                type="button"
                aria-label="Bilder und Videos hochladen"
                :disabled="!!busy || loading"
                data-testid="media-upload-button"
                @click="input?.click()"
            >
                <Icon name="plus" />
                <span class="create-label">Hochladen</span>
            </button>
            <input
                ref="input"
                type="file"
                :accept="accept"
                multiple
                hidden
                data-testid="media-upload"
                @change="picked"
            >
        </template>

        <PageHeader icon="image" title="Mediathek" testid="media-heading">
            Bilder und Videos für alle Screens. Sie liegen im Wiki-Bereich „Infoscreen" von ChurchTools – dort bitte nichts löschen,
            sonst fehlt die Datei auf den Fernsehern. Wer ein Bild kennt, kann es ohne Anmeldung abrufen; nichts
            Vertrauliches hochladen. Videos: MP4 (H.264) bis 128 MB.
        </PageHeader>

        <SearchField
            v-model="query"
            placeholder="Suchen nach Datei, Screen, Playlist oder Slide …"
            label="Mediathek durchsuchen"
            testid="media-search"
        />

        <GroupCard
            icon="image"
            :title="SHOW.find((s) => s.key === show)!.title"
            :count="`${shown.length} ${shown.length === 1 ? 'Datei' : 'Dateien'}`"
            heading-id="media-group"
            class="library"
            :class="{ 'library--drop': dragOver }"
            data-testid="media-library"
            v-on="dropZone"
        >
            <template #tools>
                <FilterChips v-model="show" :options="SHOW" label="Verwendung" testid="media-filter" />
            </template>
            <p v-if="busy" class="d-banner">{{ busy }}</p>
            <p v-if="problem" class="d-banner d-banner--error" role="alert">{{ problem }}</p>
            <p v-if="loading" class="empty">Lade Mediathek …</p>
            <template v-else-if="shown.length">
                <div class="selection" data-testid="media-selection">
                    <label class="all">
                        <input type="checkbox" :checked="allShown" data-testid="media-select-all" @change="toggleAll">
                        Alle auswählen
                    </label>
                    <template v-if="picks.length">
                        <span class="picked" aria-live="polite">{{ picks.length }} ausgewählt</span>
                        <button class="d-btn" type="button" data-testid="media-selection-clear" @click="selected = []">
                            Auswahl aufheben
                        </button>
                        <button
                            class="d-btn d-btn--danger"
                            type="button"
                            :disabled="!!busy"
                            data-testid="media-delete-selected"
                            @click="askDelete"
                        >
                            <Icon name="trash" :size="16" /> Löschen
                        </button>
                    </template>
                </div>
                <MediaGrid
                    :items="shown"
                    selectable
                    :selected="selected"
                    @toggle="toggle"
                    @preview="previewId = $event.fileId"
                />
            </template>
            <p v-else-if="!items.length" class="empty">
                Noch keine Bilder oder Videos. Hochladen oben rechts oder einfach hierher ziehen.
            </p>
            <p v-else class="empty">Nichts passt zu Suche und Filter.</p>
        </GroupCard>

        <MediaDeleteDialog v-if="deleting" :items="picks" @close="deleting = false" @confirm="confirmDelete" />
        <MediaPreview v-if="previewId !== null" v-model:file-id="previewId" :items="shown" @close="previewId = null" />
    </ModulePage>
</template>

<style scoped>
.library--drop {
    outline: 2px dashed var(--d-accent);
    outline-offset: -2px;
}
.library .d-banner {
    margin-bottom: 12px;
}
.selection {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    min-height: 36px;
    margin-bottom: 12px;
    font-size: var(--d-size-sm);
}
.all {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
}
.all input {
    flex: none;
    width: 18px;
    height: 18px;
    margin: 0;
    padding: 0;
    accent-color: var(--d-accent);
}
.picked {
    margin-left: auto;
    font-weight: 700;
}
.empty {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
