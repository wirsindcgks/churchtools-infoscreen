<script setup lang="ts">
/**
 * The pictures of the media library as tiles: picture, name, and where it is
 * shown – "Foyer › Gottesdienst › Begrüßung" instead of the wiki page it was
 * uploaded to (Plan.md, Nächste Schritte 18). In the editor a click chooses a
 * picture; on the media library page there is nothing to choose for.
 */
import { computed } from 'vue';
import { usageLines, type MediaItem } from '../media/library';
import { sizedImageUrl } from '../player/format';

const props = defineProps<{ items: MediaItem[]; selectedMediaId?: string; choosable?: boolean }>();
const emit = defineEmits<{ choose: [MediaItem]; remove: [MediaItem] }>();

/** Two places fit under a picture; the rest are counted and in the tooltip. */
const SHOWN = 2;
const places = computed(() => new Map(props.items.map((item) => [item.fileId, usageLines(item.uses)])));
</script>

<template>
    <div class="media-grid">
        <figure
            v-for="item in items"
            :key="item.fileId"
            :class="{ selected: item.mediaId && item.mediaId === selectedMediaId }"
            data-testid="media-item"
        >
            <button v-if="choosable" class="pick" type="button" :title="`${item.name} verwenden`" @click="emit('choose', item)">
                <img :src="sizedImageUrl(item.imageUrl, 320, 180, 'crop')" :alt="item.name" loading="lazy">
            </button>
            <div v-else class="pick">
                <img :src="sizedImageUrl(item.imageUrl, 320, 180, 'crop')" :alt="item.name" loading="lazy">
            </div>
            <figcaption>
                <span class="name" :title="item.name">{{ item.name }}</span>
                <button class="delete" type="button" :title="`${item.name} löschen`" @click="emit('remove', item)">Löschen</button>
                <span
                    v-if="places.get(item.fileId)!.length"
                    class="uses"
                    :title="places.get(item.fileId)!.join('\n')"
                    data-testid="media-uses"
                >
                    <span v-for="line in places.get(item.fileId)!.slice(0, SHOWN)" :key="line" class="use">{{ line }}</span>
                    <span v-if="places.get(item.fileId)!.length > SHOWN" class="use more">
                        und {{ places.get(item.fileId)!.length - SHOWN }} weitere
                    </span>
                </span>
                <span v-else class="uses unused" data-testid="media-uses">Unbenutzt</span>
            </figcaption>
        </figure>
    </div>
</template>

<style scoped>
.media-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 14px;
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
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0 6px;
    padding: 4px 2px 0;
    font-size: var(--d-size-sm);
}
.name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-weight: 700;
}
.delete {
    border: 0;
    background: none;
    color: var(--d-danger);
    font: inherit;
    cursor: pointer;
}
.uses {
    grid-column: 1 / -1;
    display: grid;
    min-width: 0;
    color: var(--d-text-muted);
}
.use {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.unused {
    font-style: italic;
}
</style>
