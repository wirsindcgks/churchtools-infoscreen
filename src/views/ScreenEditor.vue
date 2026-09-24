<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import { currentPerson, displayName } from '../ct/client';
import AppBar from '../designer/AppBar.vue';
import EditorStage from '../designer/EditorStage.vue';
import { useEditorStore } from '../designer/editor-store';
import Icon from '../designer/Icon.vue';
import Inspector from '../designer/Inspector.vue';
import { BLOCK_LABELS } from '../designer/ops';
import MediaLibraryDialog from '../designer/MediaLibraryDialog.vue';
import SlideList from '../designer/SlideList.vue';
import { GRID_SIZES } from '../designer/snap';
import { usePreview } from '../designer/usePreview';
import type { BlockType, MediaDoc } from '../model/schema';
import { getRepository } from '../store/backend';

const route = useRoute();
const slug = String(route.params.slug);
const editor = useEditorStore();
const loadError = ref<string | null>(null);
const demo = ref(false);
const author = ref('');
const root = ref<HTMLElement | null>(null);
const top = ref(0);

const calendarIds = computed(() => editor.calendarIds);
const { calendars, problem } = usePreview(
    calendarIds,
    computed(() => editor.media),
);

/** Which picker the media library was opened for. */
const libraryFor = ref<'block' | 'background' | 'logo' | null>(null);
const libraryTarget = ref<string | null>(null);

function openLibrary(kind: 'block' | 'background' | 'logo'): void {
    libraryTarget.value = kind === 'background' ? null : (editor.block?.id ?? null);
    libraryFor.value = kind;
}

async function chosen(media: MediaDoc): Promise<void> {
    await editor.refreshMedia();
    if (libraryFor.value === 'block' && libraryTarget.value) {
        editor.updateBlock(libraryTarget.value, { mediaId: media.id });
    } else if (libraryFor.value === 'logo' && libraryTarget.value) {
        editor.updateBlock(libraryTarget.value, { logoMediaId: media.id });
    } else if (libraryFor.value === 'background') {
        editor.updateSlide({ background: { kind: 'media', mediaId: media.id } });
    }
    libraryFor.value = null;
}

const currentMediaId = computed(() => {
    if (libraryFor.value === 'block' && editor.block?.type === 'image') return editor.block.mediaId;
    if (libraryFor.value === 'logo' && editor.block?.type === 'church-header') return editor.block.logoMediaId;
    const bg = editor.slide?.background;
    return bg?.kind === 'media' ? bg.mediaId : undefined;
});

const statusText = computed(() => {
    switch (editor.status) {
        case 'saving':
            return 'Speichert …';
        case 'saved':
            return 'Gespeichert';
        case 'conflict':
            return 'Konflikt';
        case 'error':
            return 'Nicht gespeichert';
        default:
            return editor.dirty ? 'Ungespeicherte Änderungen' : 'Alles gespeichert';
    }
});

onMounted(async () => {
    top.value = root.value?.getBoundingClientRect().top ?? 0;
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onBeforeUnload);
    try {
        const [handle, person] = await Promise.all([getRepository(), currentPerson()]);
        author.value = displayName(person);
        demo.value = handle.demo;
        editor.attach(handle.repository);
        await editor.open(slug);
        await editor.refreshMedia();
    } catch (e) {
        loadError.value = e instanceof Error ? e.message : String(e);
    }
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('beforeunload', onBeforeUnload);
});

onBeforeRouteLeave(() => !editor.dirty || window.confirm('Ungespeicherte Änderungen verwerfen?'));

function onBeforeUnload(event: BeforeUnloadEvent): void {
    if (editor.dirty) event.preventDefault();
}

function save(): void {
    if (editor.draft && editor.status !== 'saving') void editor.save(author.value);
}

function onKey(event: KeyboardEvent): void {
    // With a dialog open, keys belong to the dialog – Delete must not hit the block behind it.
    if (libraryFor.value) {
        if (event.key === 'Escape') libraryFor.value = null;
        return;
    }
    const mod = event.metaKey || event.ctrlKey;
    const typing = (event.target as HTMLElement | null)?.closest('input, textarea, select');
    if (mod && event.key.toLowerCase() === 's') {
        event.preventDefault();
        save();
        return;
    }
    if (typing) return;
    if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) editor.redo();
        else editor.undo();
    } else if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        editor.redo();
    } else if (editor.block && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        editor.removeBlock(editor.block.id);
    } else if (event.key === 'Escape') {
        editor.selectBlock(null);
    } else if (editor.block && event.key.startsWith('Arrow')) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = { ArrowLeft: -step, ArrowRight: step }[event.key] ?? 0;
        const dy = { ArrowUp: -step, ArrowDown: step }[event.key] ?? 0;
        editor.updateBlock(editor.block.id, { x: editor.block.x + dx, y: editor.block.y + dy });
    }
}

const palette = Object.entries(BLOCK_LABELS) as [BlockType, string][];
</script>

<template>
    <div
        ref="root"
        class="infoscreen-designer editor"
        :style="{ height: `calc(100vh - ${top}px)`, '--stage-aspect': `${editor.stage.width} / ${editor.stage.height}` }"
    >
        <AppBar>
            <RouterLink class="back" to="/" title="Zur Übersicht der Screens">
                <Icon name="back" :size="16" /><span>Screens</span>
            </RouterLink>
            <strong class="title">{{ editor.draft?.screen.name ?? slug }}</strong>
            <span class="status" :class="`status--${editor.status}`" data-testid="save-status">{{ statusText }}</span>
            <template #actions>
                <div class="palette" role="group" aria-label="Block einfügen">
                    <button
                        v-for="[type, label] in palette"
                        :key="type"
                        class="d-btn"
                        type="button"
                        :data-testid="`add-${type}`"
                        :disabled="!editor.slide"
                        @click="editor.addBlock(type)"
                    >
                        + {{ label }}
                    </button>
                </div>
                <label class="grid-select" title="Blöcke rasten am Raster ein; mit gedrückter Alt-Taste frei platzieren">
                    Raster
                    <select
                        :value="editor.gridSize"
                        data-testid="grid-size"
                        @change="editor.setGridSize(Number(($event.target as HTMLSelectElement).value))"
                    >
                        <option v-for="size in GRID_SIZES" :key="size" :value="size">{{ size ? `${size} px` : 'aus' }}</option>
                    </select>
                </label>
                <button
                    class="d-btn d-btn--icon"
                    type="button"
                    title="Rückgängig (⌘Z)"
                    aria-label="Rückgängig"
                    :disabled="!editor.canUndo"
                    @click="editor.undo()"
                >
                    <Icon name="undo" />
                </button>
                <button
                    class="d-btn d-btn--icon"
                    type="button"
                    title="Wiederholen (⇧⌘Z)"
                    aria-label="Wiederholen"
                    :disabled="!editor.canRedo"
                    @click="editor.redo()"
                >
                    <Icon name="redo" />
                </button>
                <RouterLink class="d-link player-link" :to="{ name: 'player', query: { screen: slug } }" target="_blank">
                    <Icon name="play" :size="16" /> Player
                </RouterLink>
                <button
                    class="d-btn d-btn--primary"
                    type="button"
                    data-testid="save"
                    :disabled="!editor.dirty || editor.status === 'saving'"
                    @click="save"
                >
                    Speichern
                </button>
            </template>
        </AppBar>

        <p v-if="demo" class="d-banner d-banner--warning banner">
            Demo-Modus: Gespeichert wird in diesem Browser, nicht in ChurchTools; ein offener Player übernimmt Änderungen sofort.
        </p>
        <p v-if="editor.error" class="d-banner d-banner--error banner" role="alert">{{ editor.error }}</p>
        <p v-if="problem" class="d-banner d-banner--error banner" role="alert">Vorschaudaten: {{ problem }}</p>

        <p v-if="loadError" class="d-banner d-banner--error banner" role="alert">{{ loadError }}</p>
        <div v-else-if="editor.draft" class="columns">
            <SlideList />
            <EditorStage />
            <Inspector :calendars="calendars" @pick-image="openLibrary" />
        </div>

        <MediaLibraryDialog
            v-if="libraryFor && editor.draft"
            :screen="{ slug: editor.draft.screen.slug, name: editor.draft.screen.name }"
            :selected-media-id="currentMediaId"
            @choose="chosen"
            @close="libraryFor = null"
        />

        <div v-if="editor.status === 'conflict' && editor.conflict" class="d-dialog-backdrop" role="dialog" aria-modal="true">
            <div class="d-dialog" data-testid="conflict-dialog">
                <h2>Der Screen wurde inzwischen geändert</h2>
                <p>
                    {{ editor.conflict.updatedBy ?? 'Jemand' }} hat „{{ editor.conflict.name }}" gespeichert, während du
                    ihn bearbeitet hast
                    <template v-if="editor.conflict.updatedAt">
                        ({{ new Date(editor.conflict.updatedAt).toLocaleString('de-DE') }})
                    </template>.
                </p>
                <p>Beide Fassungen lassen sich nicht zusammenführen. Welche soll gelten?</p>
                <div class="d-dialog-actions">
                    <button class="d-btn" type="button" @click="editor.discardAndReload()">Die andere laden</button>
                    <button class="d-btn d-btn--primary" type="button" @click="editor.overwrite(author)">
                        Meine behalten
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.editor {
    display: flex;
    flex-direction: column;
    min-height: 480px;
    background: var(--d-surface);
}
.back,
.d-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--d-accent-strong);
    text-decoration: none;
    white-space: nowrap;
}
.back:hover,
.d-link:hover {
    text-decoration: underline;
}
.title {
    overflow: hidden;
    font-size: 1.1em;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.status {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    white-space: nowrap;
}
.status--conflict,
.status--error {
    color: var(--d-danger);
}
.status--saved {
    color: var(--d-success);
}
.grid-select {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.grid-select select {
    width: auto;
}
.palette {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}
.palette .d-btn {
    flex: none;
    padding: 0.3em 0.6em;
    font-size: var(--d-size-sm);
    white-space: nowrap;
}
.banner {
    border-radius: 0;
    font-size: var(--d-size-sm);
}
.columns {
    flex: 1;
    display: grid;
    grid-template-columns: 220px 1fr 300px;
    min-height: 0;
}

/*
 * Phone and narrow windows: one column – slides as a row to swipe, the
 * stage in its own aspect ratio, the inspector below; the page scrolls.
 * Designing with a finger comes with Plan.md, Nächste Schritte 11.
 */
@media (max-width: 48rem) {
    .editor {
        height: auto !important;
        min-height: 0;
    }
    .columns {
        grid-template-columns: minmax(0, 1fr);
    }
    .columns > :nth-child(2) {
        height: auto;
        aspect-ratio: var(--stage-aspect);
        max-height: 70vh;
    }
    .palette {
        flex: 1 1 100%;
        flex-wrap: nowrap;
        overflow-x: auto;
    }
}
</style>
