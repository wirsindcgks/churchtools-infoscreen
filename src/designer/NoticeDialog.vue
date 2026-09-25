<script setup lang="ts">
/**
 * A notice's band, edited once and shown on every playlist it is checked for
 * (Plan.md, Nächste Schritte 34) – "Heute Parkplatz gesperrt" no longer hides
 * in a playlist's inspector. Saves the playlist documents alone, through
 * `saveBanners`; slides stay untouched. `editing` identifies the group by its
 * band, matched against freshly loaded playlists (`JSON.stringify`, as
 * `groupBanners` does) – so a reload after a conflict finds it again.
 */
import { computed, onMounted, ref } from 'vue';
import type { Banner, ThemeDoc } from '../model/schema';
import BannerView from '../player/BannerView.vue';
import StageView from '../player/StageView.vue';
import { fitStage } from '../player/stage';
import { ConflictError, type ConflictInfo, type PlaylistOverview, type ScreenRepository } from '../store/screen-repository';
import BannerEditor from './BannerEditor.vue';
import Icon from './Icon.vue';
import { cloneJson, createBanner } from './ops';

const props = defineProps<{
    repository: ScreenRepository;
    author: string;
    theme: ThemeDoc;
    timeZone: string;
    /** The band of the group being edited, to find it again after a reload; null for a new notice. */
    editing: Banner | null;
}>();
const emit = defineEmits<{ close: []; saved: [] }>();

const dialog = ref<HTMLElement | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
const saving = ref(false);
const saveError = ref<string | null>(null);
const conflict = ref<ConflictInfo | null>(null);
const now = new Date();

const overviews = ref<PlaylistOverview[]>([]);
const banner = ref<Banner>(cloneJson(props.editing ?? createBanner(props.theme)));
/** Playlists the group already runs on – unchecking one of them clears its band on save. */
const originalIds = ref<Set<string>>(new Set());
const selected = ref<Set<string>>(new Set());
/** What `load` set up, to tell an actual edit from the form just having opened. */
const startJson = ref('');

const dirty = computed(() => JSON.stringify([banner.value, [...selected.value].sort()]) !== startJson.value);
const canSave = computed(() => dirty.value && banner.value.text.trim() !== '' && !saving.value && !loading.value);

async function load(): Promise<void> {
    loading.value = true;
    loadError.value = null;
    conflict.value = null;
    banner.value = cloneJson(props.editing ?? createBanner(props.theme));
    try {
        overviews.value = await props.repository.listPlaylists();
        originalIds.value = props.editing
            ? new Set(
                  overviews.value
                      .filter((o) => JSON.stringify(o.playlist.banner) === JSON.stringify(props.editing))
                      .map((o) => o.playlist.id),
              )
            : new Set();
        // New: preselected are the playlists a screen actually shows – editing keeps the group as it is.
        selected.value = props.editing
            ? new Set(originalIds.value)
            : new Set(overviews.value.filter((o) => o.screens.length > 0).map((o) => o.playlist.id));
    } catch (e) {
        loadError.value = e instanceof Error ? e.message : String(e);
    } finally {
        loading.value = false;
        startJson.value = JSON.stringify([banner.value, [...selected.value].sort()]);
    }
}

onMounted(() => {
    dialog.value?.focus();
    void load();
});

function toggle(id: string, on: boolean): void {
    const next = new Set(selected.value);
    if (on) next.add(id);
    else next.delete(id);
    selected.value = next;
}

function selectAll(): void {
    selected.value = new Set(overviews.value.map((o) => o.playlist.id));
}

function selectNone(): void {
    selected.value = new Set();
}

/** A checked playlist that already carries a band of its own – saving replaces it. */
function hasOtherBanner(overview: PlaylistOverview): boolean {
    return !!overview.playlist.banner && !originalIds.value.has(overview.playlist.id);
}

function revisionOf(id: string): number {
    return overviews.value.find((o) => o.playlist.id === id)?.playlist.revision ?? 0;
}

async function save(): Promise<void> {
    if (!canSave.value) return;
    saving.value = true;
    saveError.value = null;
    try {
        const set: Banner = { ...banner.value, text: banner.value.text.trim() };
        const toSet = [...selected.value];
        const toClear = [...originalIds.value].filter((id) => !selected.value.has(id));
        await props.repository.saveBanners(
            [
                ...toSet.map((id) => ({ playlistId: id, expectedRevision: revisionOf(id), banner: set })),
                ...toClear.map((id) => ({ playlistId: id, expectedRevision: revisionOf(id), banner: null })),
            ],
            { updatedBy: props.author },
        );
        emit('saved');
    } catch (e) {
        if (e instanceof ConflictError) conflict.value = e.current;
        else saveError.value = e instanceof Error ? e.message : String(e);
    } finally {
        saving.value = false;
    }
}

function close(): void {
    if (dirty.value && !window.confirm('Änderungen am Hinweis verwerfen?')) return;
    emit('close');
}

// The preview: a 16:9 box in the theme's colour, the band on a 1920×1080 stage – like a screen's tile.
const STAGE = { width: 1920, height: 1080 };
const previewWidth = ref(0);
const fit = computed(() => fitStage({ width: previewWidth.value, height: (previewWidth.value * 9) / 16 }, STAGE));
let observer: ResizeObserver | null = null;
function observe(el: unknown): void {
    if (el instanceof HTMLElement) {
        observer?.disconnect();
        observer = new ResizeObserver(([entry]) => {
            if (entry) previewWidth.value = entry.contentRect.width;
        });
        observer.observe(el);
    }
}
</script>

<template>
    <div class="d-dialog-backdrop" @click.self="close">
        <section
            ref="dialog"
            class="d-dialog notice"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notice-title"
            tabindex="-1"
            data-testid="notice-dialog"
            @keydown.esc="close"
        >
            <header class="head">
                <h2 id="notice-title">{{ editing ? 'Hinweis bearbeiten' : 'Neuer Hinweis' }}</h2>
                <button class="d-btn d-btn--icon" type="button" aria-label="Schließen" @click="close">
                    <Icon name="close" />
                </button>
            </header>
            <p v-if="loading" class="muted">Lade …</p>
            <p v-else-if="loadError" class="d-banner d-banner--error" role="alert">{{ loadError }}</p>
            <template v-else>
                <div
                    :ref="observe"
                    class="preview-box"
                    :style="previewWidth ? { height: `${(previewWidth * 9) / 16}px` } : undefined"
                    data-testid="notice-preview"
                >
                    <StageView v-if="previewWidth" :width="STAGE.width" :height="STAGE.height" :fit="fit">
                        <!-- No slide behind it here – the theme's colour stands in for whatever the screen shows. -->
                        <div class="stand-in" :style="{ background: theme.background }" />
                        <BannerView v-if="banner.text.trim()" :banner="banner" :stage-width="STAGE.width" />
                    </StageView>
                </div>

                <BannerEditor v-model="banner" :time-zone="timeZone" :now="now" />

                <section class="step">
                    <div class="step-head">
                        <h3>Läuft auf</h3>
                        <div class="playlist-tools">
                            <button class="d-btn" type="button" data-testid="notice-playlists-all" @click="selectAll">Alle</button>
                            <button class="d-btn" type="button" data-testid="notice-playlists-none" @click="selectNone">Keine</button>
                        </div>
                    </div>
                    <p v-if="!overviews.length" class="muted small">Noch keine Playlists.</p>
                    <ul v-else class="playlists">
                        <li v-for="o in overviews" :key="o.playlist.id">
                            <label class="check">
                                <input
                                    type="checkbox"
                                    :checked="selected.has(o.playlist.id)"
                                    :data-testid="`notice-playlist-${o.playlist.id}`"
                                    @change="toggle(o.playlist.id, ($event.target as HTMLInputElement).checked)"
                                >
                                <span class="name">{{ o.playlist.name }}</span>
                                <span class="muted small">
                                    {{ o.screens.length ? o.screens.map((s) => s.name).join(', ') : 'auf keinem Screen' }}
                                </span>
                                <span v-if="hasOtherBanner(o)" class="muted small warn">hat einen anderen Hinweis – wird ersetzt</span>
                            </label>
                        </li>
                    </ul>
                </section>

                <p v-if="conflict" class="d-banner d-banner--error" role="alert">
                    {{ conflict.updatedBy ?? 'Jemand' }} hat „{{ conflict.name }}" inzwischen geändert.
                    <button class="d-btn" type="button" @click="load">Neu laden</button>
                </p>
                <p v-if="saveError" class="d-banner d-banner--error" role="alert">{{ saveError }}</p>
            </template>

            <div class="d-dialog-actions">
                <button class="d-btn" type="button" data-testid="notice-cancel" @click="close">Abbrechen</button>
                <button class="d-btn d-btn--primary" type="button" :disabled="!canSave" data-testid="notice-save" @click="save">
                    {{ saving ? 'Speichert …' : 'Speichern' }}
                </button>
            </div>
        </section>
    </div>
</template>

<style scoped>
.notice {
    display: grid;
    gap: 12px;
    width: min(760px, 100%);
    overflow-y: auto;
}
.head {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
h2,
h3 {
    margin: 0;
}
h3 {
    font-size: 1em;
}
.muted {
    color: var(--d-text-muted);
}
.small {
    font-size: var(--d-size-sm);
}
.preview-box {
    position: relative;
    overflow: hidden;
    /* A band needs no large picture; the height is set from the measured width – with aspect-ratio
       alone the dialog's grid squeezed the box while the stage still painted over the fields below. */
    width: min(100%, 560px);
    justify-self: center;
    aspect-ratio: 16 / 9;
    flex-shrink: 0;
    border-radius: var(--d-radius);
}
.stand-in {
    position: absolute;
    inset: 0;
}
.step {
    display: grid;
    gap: 8px;
    padding: 12px 14px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius-lg);
}
.step-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.playlist-tools {
    display: flex;
    gap: 6px;
}
.playlists {
    display: grid;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
}
.check {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    padding: 4px 0;
}
.check input {
    width: auto;
    margin: 0;
}
.check .name {
    font-weight: 600;
}
.warn {
    color: var(--d-danger);
}
</style>
