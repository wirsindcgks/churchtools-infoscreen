<script setup lang="ts">
/**
 * The media library as a section of its own (Plan.md, Nächste Schritte 16
 * and 18): all pictures with where they are shown, search, "Unbenutzt" to
 * tidy up, upload and delete – without opening a playlist first. Uploads go
 * to the wiki page "Mediathek"; the wiki category stays the storage behind
 * it (G8).
 */
import { computed, ref } from 'vue';
import FilterChips from '../designer/FilterChips.vue';
import GroupCard from '../designer/GroupCard.vue';
import Icon from '../designer/Icon.vue';
import MediaGrid from '../designer/MediaGrid.vue';
import ModulePage from '../designer/ModulePage.vue';
import PageHeader from '../designer/PageHeader.vue';
import SearchField from '../designer/SearchField.vue';
import { useMediaLibrary } from '../designer/useMediaLibrary';
import { filterMedia, MEDIA_PAGE as GENERAL, type MediaShow } from '../media/library';

const { items, loading, busy, problem, dragOver, dropZone, upload, remove } = useMediaLibrary(() => GENERAL);

const query = ref('');
const show = ref<MediaShow>('all');
const shown = computed(() => filterMedia(items.value, query.value, show.value));

const SHOW = [
    { key: 'all', label: 'Alle', title: 'Alle Bilder' },
    { key: 'used', label: 'Verwendet', title: 'Verwendete Bilder' },
    { key: 'unused', label: 'Unbenutzt', title: 'Unbenutzte Bilder' },
] as const;

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
                aria-label="Bilder hochladen"
                :disabled="!!busy || loading"
                data-testid="media-upload-button"
                @click="input?.click()"
            >
                <Icon name="plus" />
                <span class="create-label">Bilder hochladen</span>
            </button>
            <input
                ref="input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                hidden
                data-testid="media-upload"
                @change="picked"
            >
        </template>

        <PageHeader icon="image" title="Mediathek" testid="media-heading">
            Bilder für alle Screens. Sie liegen im Wiki-Bereich „Infoscreen" von ChurchTools – dort bitte nichts löschen,
            sonst fehlt das Bild auf den Fernsehern. Wer ein Bild kennt, kann es ohne Anmeldung abrufen; nichts
            Vertrauliches hochladen.
        </PageHeader>

        <SearchField
            v-model="query"
            placeholder="Suchen nach Bild, Screen, Playlist oder Slide …"
            label="Bilder durchsuchen"
            testid="media-search"
        />

        <GroupCard
            icon="image"
            :title="SHOW.find((s) => s.key === show)!.title"
            :count="`${shown.length} ${shown.length === 1 ? 'Bild' : 'Bilder'}`"
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
            <p v-if="loading" class="empty">Lade Bilder …</p>
            <MediaGrid v-else-if="shown.length" :items="shown" @remove="remove" />
            <p v-else-if="!items.length" class="empty">
                Noch keine Bilder. Hochladen oben rechts oder einfach hierher ziehen.
            </p>
            <p v-else class="empty">Kein Bild passt zu Suche und Filter.</p>
        </GroupCard>
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
.empty {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
