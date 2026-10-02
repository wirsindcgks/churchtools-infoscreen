<script setup lang="ts">
/**
 * Asks before files of the media library are deleted – one or several. A file a slide still shows is never
 * deleted without saying so: it is listed with every place it runs, and with unused files beside it the dialog
 * offers to delete only those.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { usageLines, type MediaItem } from '../media/library';
import { sizedImageUrl } from '../player/format';
import Icon from './Icon.vue';

const props = defineProps<{ items: MediaItem[] }>();
const emit = defineEmits<{ confirm: [MediaItem[]]; close: [] }>();

const used = computed(() => props.items.filter((i) => i.uses.length > 0));
const unused = computed(() => props.items.filter((i) => i.uses.length === 0));
const files = (n: number) => `${n} ${n === 1 ? 'Datei' : 'Dateien'}`;
const title = computed(() =>
    props.items.length === 1 ? `„${props.items[0]!.name}" löschen?` : `${files(props.items.length)} löschen?`,
);

/** A document listener like the preview's: WebKit does not focus a button on click. */
function onKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    emit('close');
}
const cancel = ref<HTMLButtonElement | null>(null);
onMounted(() => {
    cancel.value?.focus();
    document.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => document.removeEventListener('keydown', onKey));
</script>

<template>
    <div class="d-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="media-delete-title" @click.self="emit('close')">
        <div class="d-dialog" data-testid="media-delete-dialog">
            <h2 id="media-delete-title">{{ title }}</h2>
            <p class="lead">Die Dateien werden aus ChurchTools gelöscht. Das lässt sich nicht rückgängig machen.</p>

            <template v-if="used.length">
                <p class="d-banner d-banner--warning" role="alert" data-testid="media-delete-warning">
                    {{ used.length === 1 ? 'Eine Datei wird' : `${used.length} Dateien werden` }} noch gezeigt. Nach dem
                    Löschen bleibt dort eine leere Fläche.
                </p>
                <ul class="list" data-testid="media-delete-used">
                    <li v-for="item in used" :key="item.fileId">
                        <span v-if="item.kind === 'video'" class="thumb"><Icon name="video" :size="16" /></span>
                        <img v-else class="thumb" :src="sizedImageUrl(item.imageUrl, 96, 54, 'crop')" alt="">
                        <div>
                            <span class="name">{{ item.name }}</span>
                            <span v-for="line in usageLines(item.uses)" :key="line" class="use">{{ line }}</span>
                        </div>
                    </li>
                </ul>
            </template>

            <template v-if="unused.length && items.length > 1">
                <h3>Unbenutzt ({{ unused.length }})</h3>
                <ul class="list" data-testid="media-delete-unused">
                    <li v-for="item in unused" :key="item.fileId">
                        <span v-if="item.kind === 'video'" class="thumb"><Icon name="video" :size="16" /></span>
                        <img v-else class="thumb" :src="sizedImageUrl(item.imageUrl, 96, 54, 'crop')" alt="">
                        <div><span class="name">{{ item.name }}</span></div>
                    </li>
                </ul>
            </template>

            <div class="d-dialog-actions">
                <button ref="cancel" class="d-btn" type="button" data-testid="media-delete-cancel" @click="emit('close')">
                    Abbrechen
                </button>
                <button
                    v-if="used.length && unused.length"
                    class="d-btn"
                    type="button"
                    data-testid="media-delete-unused-only"
                    @click="emit('confirm', unused)"
                >
                    Nur unbenutzte löschen ({{ unused.length }})
                </button>
                <button class="d-btn d-btn--danger" type="button" data-testid="media-delete-confirm" @click="emit('confirm', items)">
                    <Icon name="trash" :size="16" />
                    {{ used.length ? (unused.length ? `Alle ${items.length} löschen` : 'Trotzdem löschen') : 'Löschen' }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.d-dialog {
    width: min(520px, 100%);
}
.lead {
    margin: 0 0 12px;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
h3 {
    margin: 16px 0 0;
    font-size: 1em;
}
.list {
    display: grid;
    gap: 8px;
    max-height: 30vh;
    margin: 10px 0 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
    font-size: var(--d-size-sm);
}
.list li {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    align-items: start;
    gap: 10px;
}
.thumb {
    display: grid;
    place-items: center;
    width: 64px;
    height: 36px;
    border-radius: var(--d-radius);
    background: var(--d-panel);
    color: var(--d-text-muted);
    object-fit: cover;
}
.list div {
    display: grid;
    min-width: 0;
}
.name {
    overflow: hidden;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.use {
    overflow: hidden;
    color: var(--d-text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
