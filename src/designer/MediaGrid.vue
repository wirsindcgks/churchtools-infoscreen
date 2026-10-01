<script setup lang="ts">
/**
 * The pictures and videos of the media library as tiles: picture, name, and where it is
 * shown – "Foyer › Gottesdienst › Begrüßung" instead of the wiki page it was
 * uploaded to (Plan.md, Nächste Schritte 18). In the editor a click chooses a
 * picture, and a small eye on the tile opens the preview; on the media library page
 * there is nothing to choose for, so a click opens the preview (Plan.md 53). With `multiple`
 * a click marks or unmarks: the tile shows the running number of the choice, `marked`
 * holds the file ids in that order.
 */
import { computed } from 'vue';
import { usageLines, type MediaItem } from '../media/library';
import { formatDuration } from '../media/video';
import { sizedImageUrl } from '../player/format';
import { videoSrc } from '../player/video';
import Icon from './Icon.vue';

const props = defineProps<{ items: MediaItem[]; selectedMediaId?: string; choosable?: boolean; multiple?: boolean; marked?: number[] }>();
const emit = defineEmits<{ choose: [MediaItem]; remove: [MediaItem]; preview: [MediaItem] }>();

/** Two places fit under a picture; the rest are counted and in the tooltip. */
const SHOWN = 2;
const numberOf = (item: MediaItem): number => (props.marked?.indexOf(item.fileId) ?? -1) + 1;
const places = computed(() => new Map(props.items.map((item) => [item.fileId, usageLines(item.uses)])));
</script>

<template>
    <div class="media-grid">
        <figure
            v-for="item in items"
            :key="item.fileId"
            :class="{ selected: (item.mediaId && item.mediaId === selectedMediaId) || numberOf(item) > 0 }"
            data-testid="media-item"
        >
            <button
                class="pick"
                type="button"
                :title="choosable ? (multiple ? `${item.name} markieren` : `${item.name} verwenden`) : `${item.name} ansehen`"
                :aria-pressed="choosable && multiple ? numberOf(item) > 0 : undefined"
                @click="choosable ? emit('choose', item) : emit('preview', item)"
            >
                <template v-if="item.kind === 'video'">
                    <video :src="videoSrc(item) ?? undefined" preload="metadata" muted playsinline :aria-label="item.name" />
                    <span class="badge"><Icon name="play" :size="12" /><template v-if="formatDuration(item.durationSeconds)">{{ formatDuration(item.durationSeconds) }}</template></span>
                </template>
                <img v-else :src="sizedImageUrl(item.imageUrl, 320, 180, 'crop')" :alt="item.name" loading="lazy">
                <span v-if="multiple && numberOf(item) > 0" class="mark" data-testid="media-mark">{{ numberOf(item) }}</span>
            </button>
            <!-- Beside the tile button, not in it: a button in a button is not valid. -->
            <button
                v-if="choosable"
                class="look"
                type="button"
                :aria-label="`${item.name} ansehen`"
                :title="`${item.name} ansehen`"
                data-testid="media-preview-open"
                @click="emit('preview', item)"
            >
                <Icon name="eye" :size="16" />
            </button>
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
    position: relative;
    margin: 0;
    border: 2px solid transparent;
    border-radius: var(--d-radius-lg);
}
figure.selected {
    border-color: var(--d-accent);
}
.pick {
    position: relative;
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
.mark {
    position: absolute;
    top: 6px;
    left: 6px;
    min-width: 24px;
    padding: 2px 6px;
    border-radius: 12px;
    background: var(--d-accent);
    color: #fff;
    font-size: var(--d-size-sm);
    font-weight: 700;
    line-height: 20px;
    text-align: center;
}
/* The eye sits on the figure, over the picture, top right – the running number is top left. */
.look {
    position: absolute;
    top: 6px;
    right: 6px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: rgba(15, 23, 42, 0.75);
    color: #fff;
    cursor: pointer;
    opacity: 0;
}
figure:hover .look,
figure:focus-within .look,
.look:focus-visible {
    opacity: 1;
}
@media (hover: none) {
    .look {
        opacity: 1;
    }
}
.pick img,
.pick video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}
/* The still of a video: the first frame, never played; the badge says it is one. */
.badge {
    position: absolute;
    right: 6px;
    bottom: 6px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    border-radius: 12px;
    background: rgba(15, 23, 42, 0.75);
    color: #fff;
    font-size: var(--d-size-sm);
    font-weight: 700;
    line-height: 20px;
}
button.pick:hover img,
button.pick:hover video {
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
