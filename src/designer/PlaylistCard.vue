<script setup lang="ts">
/**
 * A playlist on the playlists page (Plan.md, Nächste Schritte 19): its first
 * slide, name, format, and on which screens it runs. The tile opens the
 * editor; duplicating copies its slides too; deleting waits until no screen
 * shows it.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { PlaylistOverview } from '../store/screen-repository';
import Icon from './Icon.vue';
import SlideThumb from './SlideThumb.vue';

const props = defineProps<{ overview: PlaylistOverview }>();
const emit = defineEmits<{ remove: []; duplicate: [] }>();

const playlist = computed(() => props.overview.playlist);
const portrait = computed(() => playlist.value.stage.height > playlist.value.stage.width);
const inUse = computed(() => props.overview.screens.length > 0);

const menuOpen = ref(false);
const root = ref<HTMLElement | null>(null);

function closeOnOutside(event: Event): void {
    if (!root.value?.contains(event.target as Node)) menuOpen.value = false;
}
watch(menuOpen, (open) => {
    if (open) document.addEventListener('pointerdown', closeOnOutside);
    else document.removeEventListener('pointerdown', closeOnOutside);
});
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutside));

function remove(): void {
    menuOpen.value = false;
    emit('remove');
}

function duplicate(): void {
    menuOpen.value = false;
    emit('duplicate');
}
</script>

<template>
    <article ref="root" class="d-card screen-card" data-testid="playlist-card" @keydown.esc="menuOpen = false">
        <RouterLink
            class="open"
            :to="{ name: 'editor', params: { id: playlist.id } }"
            :aria-label="`${playlist.name} bearbeiten`"
            data-testid="open-playlist"
        >
            <SlideThumb :slide="overview.firstSlide" :stage="playlist.stage" />
        </RouterLink>
        <div class="body">
            <div class="title-row">
                <h3 class="name">
                    <RouterLink :to="{ name: 'editor', params: { id: playlist.id } }" tabindex="-1">
                        {{ playlist.name || 'Ohne Namen' }}
                    </RouterLink>
                </h3>
                <div class="menu">
                    <button
                        class="d-btn d-btn--icon menu-button"
                        type="button"
                        :aria-expanded="menuOpen"
                        aria-haspopup="menu"
                        :aria-label="`Aktionen für ${playlist.name}`"
                        title="Aktionen"
                        data-testid="playlist-menu"
                        @click="menuOpen = !menuOpen"
                    >
                        <Icon name="more" />
                    </button>
                    <div v-if="menuOpen" class="menu-list" role="menu">
                        <button role="menuitem" type="button" data-testid="duplicate-playlist" @click="duplicate">
                            <Icon name="copy" :size="16" /> Duplizieren
                        </button>
                        <button
                            role="menuitem"
                            type="button"
                            class="danger"
                            :disabled="inUse"
                            :title="inUse ? 'Läuft noch auf einem Screen – erst dort im Zeitplan eine andere wählen' : undefined"
                            data-testid="delete-playlist"
                            @click="remove"
                        >
                            <Icon name="trash" :size="16" /> Löschen
                        </button>
                    </div>
                </div>
            </div>
            <p class="facts">
                <span :title="portrait ? 'Hochkant' : 'Quer'">
                    <Icon :name="portrait ? 'portrait' : 'landscape'" :size="16" />
                    {{ portrait ? 'Hochkant' : 'Quer' }}
                </span>
                <span title="Slides">
                    <Icon name="slides" :size="16" />
                    {{ overview.slideCount }}
                </span>
            </p>
            <p class="facts muted" data-testid="playlist-screens">
                <span :title="inUse ? 'Läuft auf diesen Screens' : 'Noch kein Screen zeigt sie'">
                    <Icon name="tv" :size="16" />
                    {{ inUse ? overview.screens.map((s) => s.name).join(', ') : 'auf keinem Screen' }}
                </span>
            </p>
        </div>
    </article>
</template>

<style scoped>
.screen-card {
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: visible;
    transition: box-shadow 0.15s, border-color 0.15s;
}
.screen-card:hover {
    border-color: var(--d-interactive);
    box-shadow: 0 4px 12px -4px #0000001f;
}
.open {
    display: block;
    overflow: hidden;
    border-radius: var(--d-radius-lg) var(--d-radius-lg) 0 0;
}
.open:focus-visible {
    outline: 2px solid var(--d-accent);
    outline-offset: 2px;
}
.body {
    display: grid;
    gap: 4px;
    padding: 6px 14px 12px;
}
.title-row {
    display: flex;
    align-items: flex-start;
    gap: 4px;
}
.name {
    flex: 1;
    margin: 0;
    padding-top: 0.35em;
    font-size: 1em;
    font-weight: 700;
    overflow-wrap: anywhere;
}
.name a {
    color: inherit;
    text-decoration: none;
}
.facts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 14px;
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.facts span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.facts code {
    overflow-wrap: anywhere;
}
.menu {
    position: relative;
    margin: 0 -8px 0 0;
}
.menu-button {
    border-color: transparent;
    background: transparent;
    color: var(--d-text-muted);
}
.menu-list {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 10;
    display: grid;
    min-width: 190px;
    padding: 4px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow);
}
.menu-list a,
.menu-list button {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    padding: 6px 10px;
    border: 0;
    border-radius: var(--d-radius);
    background: none;
    color: var(--d-text);
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
}
.menu-list a:hover,
.menu-list button:hover {
    background: var(--d-panel);
}
.menu-list button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}
.menu-list .danger {
    color: var(--d-danger);
}
</style>
