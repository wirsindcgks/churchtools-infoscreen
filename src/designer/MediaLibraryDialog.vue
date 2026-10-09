<script setup lang="ts">
/**
 * The media library in the editor: choose a picture for a block or the
 * background – the same pictures, with where they are shown, as on the media
 * library page. It shows what the block needs: pictures, or with `kind`
 * "video" (the video block, Plan.md 52) only videos. A single upload is chosen right away. With `multiple` (the
 * slideshow, Plan.md 46) a click marks pictures in order, an upload is marked
 * instead of chosen, and "Hinzufügen" hands over all of them at once. The eye on a tile opens the preview
 * (Plan.md 53), which can choose or mark the file too.
 */
import { computed, ref } from 'vue';
import { t } from '../i18n/designer';
import type { MediaItem } from '../media/library';
import type { MediaDoc } from '../model/schema';
import MediaGrid from './MediaGrid.vue';
import MediaPreview from './MediaPreview.vue';
import { useMediaLibrary } from './useMediaLibrary';

const props = withDefaults(
    defineProps<{ screen: { slug: string; name: string }; selectedMediaId?: string; multiple?: boolean; max?: number; kind?: 'image' | 'video' }>(),
    { kind: 'image', selectedMediaId: undefined, max: undefined },
);
const emit = defineEmits<{ choose: [MediaDoc]; chooseMany: [MediaDoc[]]; close: [] }>();

/** File ids of the marked pictures, in the order they were marked. */
const marked = ref<number[]>([]);
const limit = computed(() => props.max ?? Infinity);
const limitHint = ref(false);
const LIMIT_TEXT = t.media.dialog.limit;
let limitTimer: ReturnType<typeof setTimeout> | undefined;
function tooMany(): void {
    limitHint.value = true;
    clearTimeout(limitTimer);
    limitTimer = setTimeout(() => (limitHint.value = false), 3000);
}
function mark(fileIds: number[]): void {
    for (const id of fileIds) {
        if (marked.value.includes(id)) continue;
        if (marked.value.length >= limit.value) return tooMany();
        marked.value.push(id);
    }
}

const { items, loading, busy, problem, dragOver, dropZone, upload, adopt, remove, accept } = useMediaLibrary(
    () => props.screen,
    (docs) => {
        if (props.multiple) mark(docs.map((d) => d.fileId));
        else if (docs.length === 1) emit('choose', docs[0]!);
    },
    props.kind,
);
const shown = computed(() => items.value.filter((i) => i.kind === props.kind));
/** The file open in the preview; it pages through `shown`. */
const previewId = ref<number | null>(null);
const previewAction = computed(() => {
    if (!props.multiple) return t.media.dialog.use;
    return previewId.value !== null && marked.value.includes(previewId.value) ? t.media.dialog.unmark : t.media.dialog.mark;
});
const noun = computed(() => (props.kind === 'video' ? t.media.nouns.videos : t.media.nouns.images));

async function choose(item: MediaItem): Promise<void> {
    if (props.multiple) {
        if (marked.value.includes(item.fileId)) marked.value = marked.value.filter((id) => id !== item.fileId);
        else mark([item.fileId]);
        return;
    }
    const doc = await adopt(item);
    if (doc) emit('choose', doc);
}

/** Every marked picture becomes a media document, in the order marked. */
async function addMarked(): Promise<void> {
    const docs: MediaDoc[] = [];
    for (const id of marked.value) {
        const item = items.value.find((i) => i.fileId === id);
        const doc = item ? await adopt(item) : null;
        if (doc) docs.push(doc);
    }
    if (docs.length) emit('chooseMany', docs);
}

/** A click on the backdrop closes; the second click of a double click (on the button that opened the library) does not. */
function onBackdrop(event: MouseEvent): void {
    if (event.detail > 1) return;
    emit('close');
}

const input = ref<HTMLInputElement | null>(null);
async function picked(): Promise<void> {
    await upload(input.value?.files ?? null);
    if (input.value) input.value.value = '';
}
</script>

<template>
    <div class="backdrop" role="dialog" aria-modal="true" :aria-label="t.media.title" @click.self="onBackdrop">
        <div class="library" :class="{ 'library--drop': dragOver }" data-testid="media-library" v-on="dropZone">
            <header>
                <h2>{{ t.media.title }}</h2>
                <span class="hint">{{ t.media.dialog.hintBefore(noun) }} <code>{{ screen.slug }}</code>{{ t.media.dialog.hintAfter }}</span>
                <span class="spacer" />
                <button class="d-btn d-btn--create" type="button" :disabled="!!busy || loading" @click="input?.click()">
                    {{ t.media.dialog.upload(noun) }}
                </button>
                <button
                    v-if="multiple"
                    class="d-btn d-btn--primary"
                    type="button"
                    :disabled="!marked.length || !!busy"
                    data-testid="media-add"
                    @click="addMarked"
                >
                    {{ t.media.dialog.add(marked.length) }}
                </button>
                <button class="d-btn" type="button" @click="emit('close')">{{ t.common.close }}</button>
                <input
                    ref="input"
                    type="file"
                    :accept="accept"
                    multiple
                    hidden
                    data-testid="media-upload"
                    @change="picked"
                >
            </header>
            <p v-if="busy" class="banner">{{ busy }}</p>
            <p v-if="problem" class="banner banner--error" role="alert">{{ problem }}</p>
            <p v-if="limitHint" class="banner" role="status" data-testid="media-limit">{{ LIMIT_TEXT }}</p>
            <div class="body">
                <p v-if="loading" class="empty">{{ t.media.dialog.loading(noun) }}</p>
                <MediaGrid
                    v-else-if="shown.length"
                    :items="shown"
                    :selected-media-id="selectedMediaId"
                    choosable
                    :multiple="multiple"
                    :marked="marked"
                    @choose="choose"
                    @remove="remove"
                    @preview="previewId = $event.fileId"
                />
                <p v-else class="empty">{{ t.media.dialog.empty(noun) }}</p>
            </div>
        </div>
        <MediaPreview
            v-if="previewId !== null"
            v-model:file-id="previewId"
            :items="shown"
            :action-label="previewAction"
            :notice="limitHint ? LIMIT_TEXT : undefined"
            @action="choose"
            @close="previewId = null"
        />
    </div>
</template>

<style scoped>
.backdrop {
    position: fixed;
    inset: 0;
    /* Above ChurchTools' own top bar (z-index 1040), like every dialog. */
    z-index: 1100;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(15, 23, 42, 0.45);
}
.library {
    display: flex;
    flex-direction: column;
    width: min(1100px, 100%);
    max-height: 100%;
    min-height: 0;
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow);
}
.library--drop {
    outline: 2px dashed var(--d-accent);
    outline-offset: -2px;
}
header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--d-divider);
}
h2 {
    margin: 0;
    font-size: 1.15em;
}
.hint {
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
.body {
    overflow-y: auto;
    padding: 16px;
}
.empty {
    margin: 0;
    padding: 24px 0;
    color: var(--d-text-muted);
    text-align: center;
}
@media (max-width: 48rem) {
    .backdrop {
        padding: 8px;
    }
}
</style>
