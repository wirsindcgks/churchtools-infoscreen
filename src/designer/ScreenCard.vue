<script setup lang="ts">
/**
 * A screen on the start page, built after the group tiles of ChurchTools:
 * picture on top – the first slide of the playlist that runs now, as the TV
 * shows it – name and the facts below, one per line. The tile opens that playlist in
 * the editor; the rest is in the "…" menu.
 */
import { computed, ref } from 'vue';
import { t } from '../i18n/designer';
import { useStageContext } from '../player/context';
import type { ScreenOverview } from '../store/screen-repository';
import Icon from './Icon.vue';
import type { AliveState } from './alive';
import { lastEdited } from './last-edited';
import type { Running } from './running';
import { copyPlayerUrl } from './player-url';
import SlideThumb from './SlideThumb.vue';
import Tile from './Tile.vue';

/**
 * `admin`: configure and delete are the administrators' (Plan.md, F).
 * `running`: what the schedule shows now (Plan.md 17); without it, the default playlist.
 * `alive`: the sign of life (Plan.md 59); null while this person cannot see it – then the tile has no line for it.
 */
const props = defineProps<{ overview: ScreenOverview; admin?: boolean; running?: Running; alive?: AliveState | null }>();
const emit = defineEmits<{ remove: []; settings: []; rename: []; schedule: [] }>();

const screen = computed(() => props.overview.screen);
const context = useStageContext();
/** When and by whom the screen or its schedule was last saved (Plan.md 66). */
const edited = computed(() => lastEdited(screen.value.updatedAt, screen.value.updatedBy, context.timeZone));
const portrait = computed(() => screen.value.stage.height > screen.value.stage.width);
/** The playlist the tile shows and opens. */
const shown = computed(() => {
    const id = props.running?.playlistId ?? screen.value.defaultPlaylistId;
    return props.overview.playlists[id] ?? props.overview.playlists[screen.value.defaultPlaylistId] ?? null;
});
/** A rule decides right now – the tile says so, since it shows another playlist than the default. */
const byRule = computed(() => (props.running?.ruleIndex ?? -1) >= 0);

const copied = ref(false);

/** Stays open for a moment to say "Kopiert", then closes. */
async function copy(close: () => void): Promise<void> {
    copied.value = await copyPlayerUrl(screen.value.slug);
    if (copied.value) setTimeout(() => ((copied.value = false), close()), 1200);
}

/** What the tile says about the schedule; the designers' part (Plan.md, Nächste Schritte 17). */
const scheduleLabel = computed(() => {
    const rules = screen.value.schedule.length;
    return rules ? t.home.card.rules(rules) : t.home.card.schedule;
});
</script>

<template>
    <Tile data-testid="screen-card" :menu-label="t.home.card.actionsFor(screen.name)" menu-testid="screen-menu">
        <template #media>
            <RouterLink
                class="open d-tile-media"
                :to="{ name: 'editor', params: { id: shown?.id ?? screen.defaultPlaylistId } }"
                :aria-label="t.home.card.edit(shown?.name ?? screen.name)"
                data-testid="open-editor"
            >
                <SlideThumb :slide="shown?.firstSlide ?? null" :stage="screen.stage" />
            </RouterLink>
        </template>
        <template #title>
            <RouterLink :to="{ name: 'editor', params: { id: shown?.id ?? screen.defaultPlaylistId } }" tabindex="-1">
                {{ screen.name || t.home.card.unnamed }}
            </RouterLink>
        </template>
        <template #menu="{ close }">
            <RouterLink
                role="menuitem"
                :to="{ name: 'player', query: { screen: screen.slug } }"
                target="_blank"
                data-testid="open-player"
                @click="close"
            >
                <Icon name="play" :size="16" /> {{ t.home.card.openPlayer }}
            </RouterLink>
            <button role="menuitem" type="button" data-testid="copy-address" @click="copy(close)">
                <Icon name="copy" :size="16" /> {{ copied ? t.home.card.copied : t.home.card.copy }}
            </button>
            <button role="menuitem" type="button" data-testid="screen-schedule-open" @click="close(); emit('schedule')">
                <Icon name="calendar" :size="16" /> {{ t.home.card.schedule }}
            </button>
            <button v-if="admin" role="menuitem" type="button" data-testid="screen-rename-open" @click="close(); emit('rename')">
                <Icon name="pencil" :size="16" /> {{ t.home.card.rename }}
            </button>
            <button v-if="admin" role="menuitem" type="button" data-testid="screen-settings-open" @click="close(); emit('settings')">
                <Icon name="settings" :size="16" /> {{ t.common.settings }}
            </button>
            <button v-if="admin" role="menuitem" type="button" class="danger" data-testid="delete-screen" @click="close(); emit('remove')">
                <Icon name="trash" :size="16" /> {{ t.common.delete }}
            </button>
        </template>
        <section v-if="alive" class="d-tile-section">
            <ul class="d-facts">
                <li :title="alive.title" data-testid="screen-alive" :data-alive="alive.kind">
                    <span class="alive-dot" :class="`is-${alive.kind}`" aria-hidden="true" />
                    <span>{{ alive.text }}</span>
                </li>
            </ul>
        </section>
        <section class="d-tile-section">
            <ul class="d-facts">
                <li>
                    <Icon name="id" :size="16" />
                    <code :title="t.home.card.addressTitle(screen.slug)">{{ screen.slug }}</code>
                </li>
                <li :title="portrait ? t.common.portrait : t.common.landscape">
                    <Icon :name="portrait ? 'portrait' : 'landscape'" :size="16" />
                    {{ portrait ? t.common.portrait : t.common.landscape }}
                </li>
            </ul>
        </section>
        <section class="d-tile-section">
            <ul class="d-facts">
                <li
                    :title="byRule ? t.home.card.byRuleTitle(shown?.slideCount ?? 0) : t.home.card.defaultTitle(shown?.slideCount ?? 0)"
                    :class="{ 'by-rule': byRule }"
                    data-testid="screen-playlist"
                >
                    <Icon name="list" :size="16" />
                    <span>
                        {{ shown?.name ?? t.common.playlistMissing }}
                        <span v-if="byRule" class="now-tag" data-testid="screen-running">{{ t.home.card.now }}</span>
                    </span>
                </li>
                <li>
                    <button
                        class="schedule-link"
                        type="button"
                        :title="screen.schedule.length ? t.home.card.scheduleTitle : t.home.card.scheduleCreateTitle"
                        data-testid="open-schedule"
                        @click="emit('schedule')"
                    >
                        <Icon name="calendar" :size="16" />
                        {{ scheduleLabel }}
                    </button>
                </li>
            </ul>
        </section>
        <template v-if="edited" #foot>
            <ul class="d-facts">
                <li v-if="edited.when" :title="edited.whenTitle!" data-testid="screen-edited-at">
                    <Icon name="clock" :size="16" />
                    <span>{{ edited.when }}</span>
                </li>
                <li v-if="edited.by" :title="edited.byTitle!" data-testid="screen-edited-by">
                    <Icon name="person" :size="16" />
                    <span>{{ edited.by }}</span>
                </li>
            </ul>
        </template>
    </Tile>
</template>

<style scoped>
.open:focus-visible {
    outline: 2px solid var(--d-accent);
    outline-offset: 2px;
}
.d-tile-title a {
    color: inherit;
    text-decoration: none;
}
.alive-dot {
    flex: none;
    width: 0.65em;
    height: 0.65em;
    /* Centred in the 16 px of an icon, so the text lines up with the lines below (Plan.md 76). */
    margin: 0.4em calc((16px - 0.65em) / 2) 0;
    border-radius: 50%;
    background: var(--d-text-muted);
}
.alive-dot.is-online {
    background: var(--d-success);
}
.alive-dot.is-offline {
    background: var(--d-danger);
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
</style>
