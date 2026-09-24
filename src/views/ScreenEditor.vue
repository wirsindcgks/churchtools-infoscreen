<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import { currentPerson, displayName } from '../ct/client';
import EditorStage from '../designer/EditorStage.vue';
import { useEditorStore } from '../designer/editor-store';
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
    <div ref="root" class="infoscreen-designer editor" :style="{ height: `calc(100vh - ${top}px)` }">
        <header class="toolbar">
            <RouterLink class="back" to="/">← Screens</RouterLink>
            <strong class="title">{{ editor.draft?.screen.name ?? slug }}</strong>
            <span class="status" :class="`status--${editor.status}`" data-testid="save-status">{{ statusText }}</span>
            <span class="spacer" />
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
            <button class="d-btn" type="button" title="Rückgängig (⌘Z)" :disabled="!editor.canUndo" @click="editor.undo()">
                ↶
            </button>
            <button class="d-btn" type="button" title="Wiederholen (⇧⌘Z)" :disabled="!editor.canRedo" @click="editor.redo()">
                ↷
            </button>
            <RouterLink class="d-link" :to="{ name: 'player', query: { screen: slug } }" target="_blank">Player ↗</RouterLink>
            <button
                class="d-btn d-btn--primary"
                type="button"
                data-testid="save"
                :disabled="!editor.dirty || editor.status === 'saving'"
                @click="save"
            >
                Speichern
            </button>
        </header>

        <p v-if="demo" class="banner">
            Demo-Modus: Custom Modules sind nicht freigeschaltet. Gespeichert wird in diesem Browser; ein offener Player übernimmt Änderungen sofort.
        </p>
        <p v-if="editor.error" class="banner banner--error" role="alert">{{ editor.error }}</p>
        <p v-if="problem" class="banner banner--error" role="alert">Vorschaudaten: {{ problem }}</p>

        <p v-if="loadError" class="banner banner--error" role="alert">{{ loadError }}</p>
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

        <div v-if="editor.status === 'conflict' && editor.conflict" class="dialog-backdrop" role="dialog" aria-modal="true">
            <div class="dialog" data-testid="conflict-dialog">
                <h2>Der Screen wurde inzwischen geändert</h2>
                <p>
                    {{ editor.conflict.updatedBy ?? 'Jemand' }} hat „{{ editor.conflict.name }}" gespeichert, während du
                    ihn bearbeitet hast
                    <template v-if="editor.conflict.updatedAt">
                        ({{ new Date(editor.conflict.updatedAt).toLocaleString('de-DE') }})
                    </template>.
                </p>
                <p>Beide Fassungen lassen sich nicht zusammenführen. Welche soll gelten?</p>
                <div class="dialog-actions">
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
.toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--d-divider);
}
.back,
.d-link {
    color: var(--d-accent-strong);
    text-decoration: none;
}
.back:hover,
.d-link:hover {
    text-decoration: underline;
}
.title {
    font-size: 1.1em;
}
.status {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.status--conflict,
.status--error {
    color: var(--d-danger);
}
.status--saved {
    color: var(--d-success);
}
.spacer {
    flex: 1;
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
    padding: 0.3em 0.6em;
    font-size: var(--d-size-sm);
}
.banner {
    margin: 0;
    padding: 6px 12px;
    background: var(--d-warning-pale);
    font-size: var(--d-size-sm);
}
.banner--error {
    background: var(--d-danger-pale);
}
.columns {
    flex: 1;
    display: grid;
    grid-template-columns: 220px 1fr 300px;
    min-height: 0;
}
.dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    background: rgba(15, 23, 42, 0.45);
}
.dialog {
    max-width: 460px;
    padding: 20px 24px;
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow);
}
.dialog h2 {
    margin: 0 0 8px;
    font-size: 1.2em;
}
.dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
}
</style>
