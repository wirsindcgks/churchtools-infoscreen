<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { currentPerson, displayName } from '../ct/client';
import AppBar from '../designer/AppBar.vue';
import BlockPalette from '../designer/BlockPalette.vue';
import EditorStage from '../designer/EditorStage.vue';
import { useEditorStore } from '../designer/editor-store';
import Icon from '../designer/Icon.vue';
import Inspector from '../designer/Inspector.vue';
import MediaLibraryDialog from '../designer/MediaLibraryDialog.vue';
import PlaylistPreview from '../designer/PlaylistPreview.vue';
import SlideList from '../designer/SlideList.vue';
import { usePreview } from '../designer/usePreview';
import type { MediaDoc } from '../model/schema';
import { MEDIA_PAGE } from '../media/library';
import { getRepository } from '../store/backend';

const route = useRoute();
const playlistId = String(route.params.id);

/**
 * Back to where one came from: the screens, whose tile opens the default
 * playlist, or the playlists page (schema 1.4). The previous path is the
 * router's, not the browser's – nothing outside the module.
 */
const cameFrom = String(useRouter().options.history.state.back ?? '');
const back = cameFrom === '/' || cameFrom.startsWith('/?')
    ? { to: { name: 'designer', query: useRouter().resolve(cameFrom).query }, label: 'Screens' }
    : { to: { name: 'playlists' }, label: 'Playlists' };
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

/** The preview of the unsaved draft, as the TV would show it. */
const previewing = ref(false);

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
        await editor.open(playlistId);
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
    if (previewing.value) return; // the preview has its own keys
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

</script>

<template>
    <div
        ref="root"
        class="infoscreen-designer editor"
        :style="{ height: `calc(100vh - ${top}px)`, '--stage-aspect': `${editor.stage.width} / ${editor.stage.height}` }"
    >
        <AppBar>
            <RouterLink
                class="back"
                :to="back.to"
                :title="`Editor verlassen, zurück zu „${back.label}“`"
                data-testid="leave-editor"
            >
                <Icon name="back" :size="18" /><span>{{ back.label }}</span>
            </RouterLink>
            <strong class="title">{{ editor.draft?.playlist.name || 'Playlist' }}</strong>
            <span class="status" :class="`status--${editor.status}`" data-testid="save-status">{{ statusText }}</span>
            <!-- The TVs check every 20 s for what was saved (Plan.md, 26); in demo mode an open player takes it at once. -->
            <span
                v-if="editor.status === 'saved' && editor.screens.length && !demo"
                class="status status-hint"
                data-testid="save-hint"
            >
                – {{ editor.screens.length === 1 ? 'der Fernseher zeigt' : 'die Fernseher zeigen' }} es in etwa 20 s
            </span>
            <template #actions>
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
                <button
                    class="d-btn preview-btn"
                    type="button"
                    title="Die Playlist abspielen wie auf dem Fernseher – mit allen Änderungen, ohne zu speichern"
                    data-testid="open-preview"
                    :disabled="!editor.slides.length"
                    @click="previewing = true"
                >
                    <Icon name="eye" :size="16" /> Vorschau
                </button>
                <!-- The player shows screens, not playlists: offer the screens this playlist runs on. -->
                <RouterLink
                    v-for="s in editor.screens.slice(0, 1)"
                    :key="s.id"
                    class="d-link player-link"
                    :to="{ name: 'player', query: { screen: s.slug } }"
                    target="_blank"
                    :title="`Player von „${s.name}“ öffnen – zeigt den gespeicherten Stand`"
                    data-testid="open-player"
                >
                    <Icon name="play" :size="16" /> Player<span v-if="editor.screens.length > 1" class="muted">: {{ s.name }}</span>
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
            <div class="stage-column">
                <BlockPalette />
                <EditorStage />
            </div>
            <Inspector :calendars="calendars" @pick-image="openLibrary" />
        </div>

        <PlaylistPreview
            v-if="previewing && editor.draft"
            :slides="editor.slides"
            :stage="editor.stage"
            :start-slide-id="editor.slide?.id"
            @close="previewing = false"
        />

        <MediaLibraryDialog
            v-if="libraryFor && editor.draft"
            :screen="MEDIA_PAGE"
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
.back {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
    min-height: 2.3em;
    padding: 0 12px 0 8px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
    background: var(--d-panel);
    color: var(--d-text);
    font-weight: 700;
    text-decoration: none;
}
.back:hover {
    border-color: var(--d-interactive);
    background: var(--d-accent-pale);
}
.back:focus-visible {
    outline: 2px solid var(--d-accent);
    outline-offset: 1px;
}
.d-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--d-accent-strong);
    text-decoration: none;
    white-space: nowrap;
}
.d-link:hover {
    text-decoration: underline;
}
.title {
    overflow: hidden;
    font-size: 1.1em;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.preview-btn {
    gap: 6px;
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
.banner {
    border-radius: 0;
    font-size: var(--d-size-sm);
}
.stage-column {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
}
.stage-column > :last-child {
    flex: 1;
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
    .stage-column > :last-child {
        flex: none;
        height: auto;
        aspect-ratio: var(--stage-aspect);
        max-height: 70vh;
    }
}
</style>
