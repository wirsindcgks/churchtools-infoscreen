<script setup lang="ts">
/**
 * A screen on the start page, built after the group tiles of ChurchTools:
 * picture on top – the first slide of the playlist that runs now, as the TV
 * shows it – name and a line of facts below. The tile opens that playlist in
 * the editor; the rest is in the "…" menu.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { ScreenOverview } from '../store/screen-repository';
import Icon from './Icon.vue';
import type { Running } from './running';
import { copyPlayerUrl } from './player-url';
import SlideThumb from './SlideThumb.vue';

/**
 * `admin`: configure and delete are the administrators' (Plan.md, F).
 * `running`: what the schedule shows now (Plan.md 17); without it, the default playlist.
 */
const props = defineProps<{ overview: ScreenOverview; admin?: boolean; running?: Running }>();
const emit = defineEmits<{ remove: []; settings: []; schedule: [] }>();

const screen = computed(() => props.overview.screen);
const portrait = computed(() => screen.value.stage.height > screen.value.stage.width);
/** The playlist the tile shows and opens. */
const shown = computed(() => {
    const id = props.running?.playlistId ?? screen.value.defaultPlaylistId;
    return props.overview.playlists[id] ?? props.overview.playlists[screen.value.defaultPlaylistId] ?? null;
});
/** A rule decides right now – the tile says so, since it shows another playlist than the default. */
const byRule = computed(() => (props.running?.ruleIndex ?? -1) >= 0);

const menuOpen = ref(false);
const copied = ref(false);
const root = ref<HTMLElement | null>(null);

function closeOnOutside(event: Event): void {
    if (!root.value?.contains(event.target as Node)) menuOpen.value = false;
}
watch(menuOpen, (open) => {
    if (open) document.addEventListener('pointerdown', closeOnOutside);
    else document.removeEventListener('pointerdown', closeOnOutside);
});
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutside));

async function copy(): Promise<void> {
    copied.value = await copyPlayerUrl(screen.value.slug);
    if (copied.value) setTimeout(() => ((copied.value = false), (menuOpen.value = false)), 1200);
}

function remove(): void {
    menuOpen.value = false;
    emit('remove');
}

/** What the tile says about the schedule; the designers' part (Plan.md, Nächste Schritte 17). */
const scheduleLabel = computed(() => {
    const rules = screen.value.schedule.length;
    return rules ? `${rules} ${rules === 1 ? 'Regel' : 'Regeln'}` : 'Zeitplan';
});

function schedule(): void {
    menuOpen.value = false;
    emit('schedule');
}

function settings(): void {
    menuOpen.value = false;
    emit('settings');
}
</script>

<template>
    <article ref="root" class="d-card screen-card" data-testid="screen-card" @keydown.esc="menuOpen = false">
        <RouterLink
            class="open"
            :to="{ name: 'editor', params: { id: shown?.id ?? screen.defaultPlaylistId } }"
            :aria-label="`${shown?.name ?? screen.name} bearbeiten`"
            data-testid="open-editor"
        >
            <SlideThumb :slide="shown?.firstSlide ?? null" :stage="screen.stage" />
        </RouterLink>
        <div class="body">
            <div class="title-row">
                <h3 class="name">
                    <RouterLink :to="{ name: 'editor', params: { id: shown?.id ?? screen.defaultPlaylistId } }" tabindex="-1">
                        {{ screen.name || 'Ohne Namen' }}
                    </RouterLink>
                </h3>
                <div class="menu">
                    <button
                        class="d-btn d-btn--icon menu-button"
                        type="button"
                        :aria-expanded="menuOpen"
                        aria-haspopup="menu"
                        :aria-label="`Aktionen für ${screen.name}`"
                        title="Aktionen"
                        data-testid="screen-menu"
                        @click="menuOpen = !menuOpen"
                    >
                        <Icon name="more" />
                    </button>
                    <div v-if="menuOpen" class="menu-list" role="menu">
                        <RouterLink
                            role="menuitem"
                            :to="{ name: 'player', query: { screen: screen.slug } }"
                            target="_blank"
                            data-testid="open-player"
                            @click="menuOpen = false"
                        >
                            <Icon name="play" :size="16" /> Player öffnen
                        </RouterLink>
                        <button role="menuitem" type="button" data-testid="copy-address" @click="copy">
                            <Icon name="copy" :size="16" /> {{ copied ? 'Adresse kopiert' : 'Adresse kopieren' }}
                        </button>
                        <button role="menuitem" type="button" data-testid="screen-schedule-open" @click="schedule">
                            <Icon name="calendar" :size="16" /> Zeitplan
                        </button>
                        <button v-if="admin" role="menuitem" type="button" data-testid="screen-settings-open" @click="settings">
                            <Icon name="settings" :size="16" /> Einstellungen
                        </button>
                        <button v-if="admin" role="menuitem" type="button" class="danger" data-testid="delete-screen" @click="remove">
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
                <code :title="`Adresse für das Gerät: ${screen.slug}`">{{ screen.slug }}</code>
            </p>
            <p class="facts muted">
                <span
                    :title="byRule ? `Läuft jetzt nach Zeitplan – ${shown?.slideCount ?? 0} Slides` : `Standard-Playlist – ${shown?.slideCount ?? 0} Slides`"
                    :class="{ 'by-rule': byRule }"
                    data-testid="screen-playlist"
                >
                    <Icon name="list" :size="16" />
                    {{ shown?.name ?? 'Playlist fehlt' }}
                    <span v-if="byRule" class="now-tag" data-testid="screen-running">jetzt</span>
                </span>
                <button
                    class="schedule-link"
                    type="button"
                    :title="screen.schedule.length ? 'Zeitplan: welche Playlist wann läuft' : 'Zeitplan anlegen: zu bestimmten Zeiten andere Slides zeigen'"
                    data-testid="open-schedule"
                    @click="schedule"
                >
                    <Icon name="calendar" :size="16" />
                    {{ scheduleLabel }}
                </button>
                <span v-if="screen.updatedBy" :title="`Zuletzt gespeichert von ${screen.updatedBy}`">
                    <Icon name="person" :size="16" />
                    {{ screen.updatedBy }}
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
.by-rule {
    color: var(--d-text);
    font-weight: 700;
}
.now-tag {
    padding: 0 6px;
    border-radius: 999px;
    background: var(--d-success);
    color: var(--d-accent-text);
    font-size: 0.85em;
    font-weight: 700;
}
.facts code {
    overflow-wrap: anywhere;
}
.schedule-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 2em;
    margin: -0.3em -0.4em;
    padding: 0 0.4em;
    border: 0;
    border-radius: var(--d-radius);
    background: none;
    color: var(--d-accent-strong);
    font: inherit;
    cursor: pointer;
}
.schedule-link:hover {
    background: var(--d-accent-pale);
    text-decoration: underline;
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
.menu-list .danger {
    color: var(--d-danger);
}
</style>
