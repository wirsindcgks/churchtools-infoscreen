<script setup lang="ts">
/**
 * The pictures and videos of the media library as tiles: picture, name, and where it is
 * shown – "Foyer › Gottesdienst › Begrüßung" instead of the wiki page it was
 * uploaded to (Plan.md, Nächste Schritte 18). In the editor a click chooses a
 * picture, and a small eye on the tile opens the preview; on the media library page
 * there is nothing to choose for, so a click opens the preview (Plan.md 53). With `multiple`
 * a click marks or unmarks: the tile shows the running number of the choice, `marked`
 * holds the file ids in that order. With `selectable` (the media library page) every tile has a
 * checkbox to pick files for deleting – several at once – in place of its own "Löschen".
 */
import { computed } from 'vue';
import { usageLines, type MediaItem } from '../media/library';
import { formatDuration } from '../media/video';
import { sizedImageUrl } from '../player/format';
import { videoSrc } from '../player/video';
import Icon from './Icon.vue';
import { lastEdited } from './last-edited';

const props = defineProps<{
    items: MediaItem[];
    selectedMediaId?: string;
    choosable?: boolean;
    multiple?: boolean;
    marked?: number[];
    selectable?: boolean;
    /** File ids of the tiles picked through their checkbox. */
    selected?: number[];
    /** The media library page: when and by whom each file was uploaded. Not in the picking dialog (Plan.md 66). */
    details?: boolean;
    /** The church's time zone, for the upload time. */
    timeZone?: string;
}>();
const emit = defineEmits<{ choose: [MediaItem]; remove: [MediaItem]; preview: [MediaItem]; toggle: [MediaItem] }>();

/** Two places fit under a picture; the rest are counted and in the tooltip. */
const SHOWN = 2;
const numberOf = (item: MediaItem): number => (props.marked?.indexOf(item.fileId) ?? -1) + 1;
const uploads = computed(() =>
    props.details
        ? new Map(
              props.items.map((item) => [
                  item.fileId,
                  lastEdited(item.createdAt, item.createdBy, props.timeZone ?? 'UTC', 'Hochgeladen'),
              ]),
          )
        : new Map<number, ReturnType<typeof lastEdited>>(),
);
const places = computed(() => new Map(props.items.map((item) => [item.fileId, usageLines(item.uses)])));
</script>

<template>
    <div class="media-grid">
        <figure
            v-for="item in items"
            :key="item.fileId"
            class="d-card"
            :class="{ selected: (item.mediaId && item.mediaId === selectedMediaId) || numberOf(item) > 0 || selected?.includes(item.fileId) }"
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
            <label v-if="selectable" class="tile-check" :title="`${item.name} auswählen`">
                <input
                    type="checkbox"
                    :checked="selected?.includes(item.fileId)"
                    :aria-label="`${item.name} auswählen`"
                    data-testid="media-select"
                    @change="emit('toggle', item)"
                >
            </label>
            <figcaption>
                <span class="name" :title="item.name">{{ item.name }}</span>
                <button v-if="!selectable" class="delete" type="button" :title="`${item.name} löschen`" @click="emit('remove', item)">Löschen</button>
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
                <span v-if="uploads.get(item.fileId)" class="facts">
                    <span
                        v-if="uploads.get(item.fileId)!.when"
                        :title="uploads.get(item.fileId)!.whenTitle!"
                        data-testid="media-edited-at"
                    >
                        <Icon name="clock" :size="16" />
                        <span>{{ uploads.get(item.fileId)!.when }}</span>
                    </span>
                    <span
                        v-if="uploads.get(item.fileId)!.by"
                        :title="uploads.get(item.fileId)!.byTitle!"
                        data-testid="media-edited-by"
                    >
                        <Icon name="person" :size="16" />
                        <span>{{ uploads.get(item.fileId)!.by }}</span>
                    </span>
                </span>
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
/* A tile like those of the screens and playlists: picture on top, the facts below. */
figure {
    position: relative;
    display: flex;
    flex-direction: column;
    margin: 0;
    transition: box-shadow 0.15s, border-color 0.15s;
}
figure:hover {
    border-color: var(--d-interactive);
    box-shadow: 0 4px 12px -4px #0000001f;
}
figure.selected {
    border-color: var(--d-accent);
    box-shadow: 0 0 0 1px var(--d-accent);
}
.pick {
    position: relative;
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    border-radius: var(--d-radius-lg) var(--d-radius-lg) 0 0;
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
/*
 * The checkbox lies on the picture, where the running number does – the two never show together.
 * Not named `select`: a stylesheet ChurchTools loads later gives that class `position: relative`,
 * which put the box under the picture (Befunde G43, Nachtrag).
 */
.tile-check {
    position: absolute;
    top: 6px;
    left: 6px;
    z-index: 1;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    margin: 0;
    cursor: pointer;
}
/* No box around it (wish of the user, 2026-10-05): a shadow keeps it visible on light and dark pictures alike. */
.tile-check input {
    position: static;
    flex: none;
    width: 18px;
    height: 18px;
    margin: 0;
    padding: 0;
    accent-color: var(--d-accent);
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
    cursor: pointer;
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
    padding: 8px 14px 12px;
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
/* One fact per line, as on the other tiles; a long name wraps under its own words, not under the icon. */
.facts {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    margin-top: 4px;
    color: var(--d-text-muted);
}
.facts > span {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    max-width: 100%;
    min-width: 0;
    overflow-wrap: anywhere;
}
.facts :deep(svg) {
    flex: none;
    margin-top: 0.1em;
}
</style>
