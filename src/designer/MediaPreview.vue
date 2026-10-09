<script lang="ts">
import { ref } from 'vue';

/** What the stage is laid on; kept while the page is open, so it holds through paging and opening again. */
const background = ref<'dark' | 'light' | 'checker'>('dark');
</script>

<script setup lang="ts">
/**
 * A file of the media library, large (Plan.md, Nächste Schritte 53): a picture the way a TV shows it (at most
 * 1920 × 1080, fitted, never cropped) or a video with the browser's controls, on a background to switch – plain
 * pictures look different on white than on a dark slide, and the checkerboard shows what is transparent. Pages
 * through `items` without wrapping around. With `actionLabel` there is a button to choose the file; `notice` is a line under the header (the limit of a gallery).
 */
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { formatDuration } from '../media/video';
import { neighbours, usageLines, type MediaItem } from '../media/library';
import { sizedImageUrl } from '../player/format';
import { videoSrc } from '../player/video';
import FilterChips from './FilterChips.vue';
import Icon from './Icon.vue';
import { LOCALE } from '../i18n/player';

const props = defineProps<{ items: MediaItem[]; fileId: number; actionLabel?: string; notice?: string }>();
const emit = defineEmits<{ 'update:fileId': [number]; action: [MediaItem]; close: [] }>();

const BACKGROUNDS = [
    { key: 'dark', label: 'Dunkel' },
    { key: 'light', label: 'Hell' },
    { key: 'checker', label: 'Karo' },
] as const;

const position = computed(() => neighbours(props.items, props.fileId));
const item = computed(() => props.items.find((i) => i.fileId === props.fileId));
const places = computed(() => (item.value ? usageLines(item.value.uses) : []));
const size = computed(() => (item.value?.width && item.value.height ? `${item.value.width} × ${item.value.height} px` : ''));
const duration = computed(() => (item.value?.kind === 'video' ? formatDuration(item.value.durationSeconds) : ''));
const uploaded = computed(() => {
    const date = item.value?.createdAt ? new Date(item.value.createdAt) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
});

// The file is gone from the list (deleted, or a filter dropped it): nothing left to look at.
watch(
    item,
    (current) => {
        if (!current) emit('close');
    },
    { immediate: true },
);

function go(target: MediaItem | undefined): void {
    if (target) emit('update:fileId', target.fileId);
}

/**
 * Escape and the arrow keys. A document listener, not a handler on the dialog: WebKit does not focus a button on
 * click (see ModuleSidebar). The keys are stopped here – the editor listens on the window, and its Escape would
 * close the media library behind the preview as well.
 */
function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
        event.stopPropagation();
        emit('close');
    } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !event.altKey && !event.ctrlKey && !event.metaKey) {
        // On the video's own controls the arrows seek.
        if (event.target instanceof HTMLVideoElement) return;
        event.stopPropagation();
        event.preventDefault();
        go(event.key === 'ArrowLeft' ? position.value?.prev : position.value?.next);
    }
}

const closeButton = ref<HTMLButtonElement | null>(null);
let opener: Element | null = null;
onMounted(() => {
    opener = document.activeElement;
    closeButton.value?.focus();
    document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKey);
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
});
</script>

<template>
    <div v-if="item" class="backdrop" role="dialog" aria-modal="true" aria-label="Vorschau" data-testid="media-preview" @click.self="emit('close')">
        <div class="preview">
            <header>
                <button
                    class="d-btn d-btn--icon"
                    type="button"
                    aria-label="Vorige Datei"
                    title="Vorige Datei"
                    :disabled="!position?.prev"
                    data-testid="preview-prev"
                    @click="go(position?.prev)"
                >
                    <Icon name="back" />
                </button>
                <span class="position" aria-live="polite" data-testid="preview-position">{{ (position?.index ?? 0) + 1 }} von {{ position?.count ?? 0 }}</span>
                <button
                    class="d-btn d-btn--icon"
                    type="button"
                    aria-label="Nächste Datei"
                    title="Nächste Datei"
                    :disabled="!position?.next"
                    data-testid="preview-next"
                    @click="go(position?.next)"
                >
                    <Icon name="forward" />
                </button>
                <span class="spacer" />
                <FilterChips v-model="background" :options="BACKGROUNDS" label="Hintergrund" testid="preview-background" />
                <button
                    v-if="actionLabel"
                    class="d-btn d-btn--primary"
                    type="button"
                    data-testid="preview-action"
                    @click="emit('action', item)"
                >
                    {{ actionLabel }}
                </button>
                <button ref="closeButton" class="d-btn" type="button" data-testid="preview-close" @click="emit('close')">Schließen</button>
            </header>
            <p v-if="notice" class="banner" role="status" data-testid="preview-notice">{{ notice }}</p>
            <div class="body">
                <div class="stage" :data-background="background" data-testid="preview-stage">
                    <video
                        v-if="item.kind === 'video'"
                        :key="item.fileId"
                        :src="videoSrc(item) ?? undefined"
                        controls
                        autoplay
                        muted
                        playsinline
                        loop
                        :aria-label="item.name"
                        data-testid="preview-video"
                    />
                    <img v-else :key="item.fileId" :src="sizedImageUrl(item.imageUrl, 1920, 1080, 'max')" :alt="item.name" data-testid="preview-image">
                </div>
                <dl class="facts">
                    <dt class="name-label">Name</dt>
                    <dd class="name" data-testid="preview-name">{{ item.name }}</dd>
                    <template v-if="size">
                        <dt>Größe</dt>
                        <dd data-testid="preview-size">{{ size }}</dd>
                    </template>
                    <template v-if="duration">
                        <dt>Länge</dt>
                        <dd data-testid="preview-duration">{{ duration }}</dd>
                    </template>
                    <template v-if="uploaded">
                        <dt>Hochgeladen am</dt>
                        <dd data-testid="preview-uploaded">{{ uploaded }}</dd>
                    </template>
                    <dt>Wo läuft es</dt>
                    <dd data-testid="preview-uses">
                        <ul v-if="places.length">
                            <li v-for="line in places" :key="line">{{ line }}</li>
                        </ul>
                        <template v-else>Unbenutzt</template>
                    </dd>
                </dl>
            </div>
        </div>
    </div>
</template>

<style scoped>
.backdrop {
    position: fixed;
    inset: 0;
    /* Above ChurchTools' own top bar (z-index 1040) and the media library dialog, like every dialog. */
    z-index: 1100;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(15, 23, 42, 0.6);
}
.preview {
    display: flex;
    flex-direction: column;
    width: min(1400px, 100%);
    height: min(900px, 100%);
    min-height: 0;
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow);
}
header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--d-divider);
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
.position {
    min-width: 5.5em;
    text-align: center;
    font-variant-numeric: tabular-nums;
}
.body {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(0, 1fr) 18rem;
    gap: 16px;
    min-height: 0;
    padding: 16px;
}
.stage {
    position: relative;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
    background: #111827;
}
.stage[data-background='light'] {
    background: #fff;
}
.stage[data-background='checker'] {
    background-color: #fff;
    background-image:
        linear-gradient(45deg, #cbd5e1 25%, transparent 25%, transparent 75%, #cbd5e1 75%),
        linear-gradient(45deg, #cbd5e1 25%, transparent 25%, transparent 75%, #cbd5e1 75%);
    background-position: 0 0, 12px 12px;
    background-size: 24px 24px;
}
.stage img,
.stage video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
}
.facts {
    display: block;
    min-width: 0;
    margin: 0;
    overflow-y: auto;
}
.facts dt {
    margin-top: 12px;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.facts dd {
    margin: 0;
    overflow-wrap: anywhere;
}
.facts .name {
    font-size: 1.1em;
    font-weight: 700;
}
.facts ul {
    margin: 0;
    padding: 0;
    list-style: none;
}
.facts li + li {
    margin-top: 4px;
}
.name-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
}
@media (max-width: 48rem) {
    .backdrop {
        padding: 0;
    }
    .preview {
        width: 100%;
        height: 100%;
        border-radius: 0;
    }
    .body {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: minmax(12rem, 1fr) auto;
        gap: 12px;
        padding: 12px;
        overflow-y: auto;
    }
    .facts {
        max-height: 40vh;
    }
}
</style>
