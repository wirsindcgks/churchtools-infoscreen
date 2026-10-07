<script setup lang="ts">
/**
 * A playlist on the playlists page (Plan.md, Nächste Schritte 19): its first
 * slide, name, format, when and by whom it was last edited, and on which screens it runs. The tile opens the
 * editor; duplicating copies its slides too; deleting waits until no screen
 * shows it.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { bannerShown } from '../player/banner';
import { useStageContext } from '../player/context';
import type { PlaylistOverview } from '../store/screen-repository';
import Icon from './Icon.vue';
import { lastEdited } from './last-edited';
import SlideThumb from './SlideThumb.vue';

const props = defineProps<{ overview: PlaylistOverview }>();
const emit = defineEmits<{ remove: []; duplicate: [] }>();

const context = useStageContext();
const playlist = computed(() => props.overview.playlist);
const portrait = computed(() => playlist.value.stage.height > playlist.value.stage.width);
const inUse = computed(() => props.overview.screens.length > 0);
/** A band is running (Plan.md, Nächste Schritte 34) – not one that only sits there, expired. */
const hasBanner = computed(() => bannerShown(playlist.value.banner, context.now, context.timeZone));

/** When and by whom it was last edited – in the church's time zone, like every time here. */
const edited = computed(() => lastEdited(props.overview.editedAt, props.overview.editedBy, context.timeZone));

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
    <article ref="root" class="d-card d-tile" data-testid="playlist-card" @keydown.esc="menuOpen = false">
        <RouterLink
            class="open d-tile-media"
            :to="{ name: 'editor', params: { id: playlist.id } }"
            :aria-label="`${playlist.name} bearbeiten`"
            data-testid="open-playlist"
        >
            <SlideThumb :slide="overview.firstSlide" :stage="playlist.stage" />
        </RouterLink>
        <div class="d-tile-body">
            <div class="title-row">
                <h3 class="d-tile-title">
                    <RouterLink :to="{ name: 'editor', params: { id: playlist.id } }" tabindex="-1">
                        {{ playlist.name || 'Ohne Namen' }}
                    </RouterLink>
                </h3>
                <span
                    v-if="hasBanner"
                    class="banner-flag"
                    :title="`Hinweisband: „${playlist.banner!.text}“`"
                    data-testid="playlist-banner"
                >
                    <Icon name="megaphone" :size="14" /> Hinweis
                </span>
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
            <ul class="d-facts">
                <li :title="portrait ? 'Hochkant' : 'Quer'">
                    <Icon :name="portrait ? 'portrait' : 'landscape'" :size="16" />
                    {{ portrait ? 'Hochkant' : 'Quer' }}
                </li>
                <li title="Slides">
                    <Icon name="slides" :size="16" />
                    {{ overview.slideCount }}
                </li>
                <li class="d-facts-gap" :title="inUse ? 'Läuft auf diesen Screens' : 'Noch kein Screen zeigt sie'" data-testid="playlist-screens">
                    <Icon name="tv" :size="16" />
                    {{ inUse ? overview.screens.map((s) => s.name).join(', ') : 'auf keinem Screen' }}
                </li>
                <li v-if="edited?.when" class="d-facts-gap" :title="edited.whenTitle!" data-testid="playlist-edited">
                    <Icon name="clock" :size="16" />
                    <span data-testid="playlist-edited-at">{{ edited.when }}</span>
                </li>
                <li v-if="edited?.by" :class="{ 'd-facts-gap': !edited.when }" :title="edited.byTitle!" data-testid="playlist-edited-by">
                    <Icon name="person" :size="16" />
                    <span>{{ edited.by }}</span>
                </li>
            </ul>
        </div>
    </article>
</template>

<style scoped>
.open:focus-visible {
    outline: 2px solid var(--d-accent);
    outline-offset: 2px;
}
.title-row {
    display: flex;
    align-items: flex-start;
    gap: 4px;
}
.title-row .d-tile-title {
    flex: 1;
    min-width: 0;
}
.d-tile-title a {
    color: inherit;
    text-decoration: none;
}
.banner-flag {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--d-accent-pale);
    color: var(--d-accent);
    font-size: var(--d-size-sm);
    font-weight: 600;
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
