<script setup lang="ts">
/**
 * A playlist on the playlists page (Plan.md, Nächste Schritte 19): its first
 * slide, name, format, when and by whom it was last edited, and on which screens it runs. The tile opens the
 * editor; duplicating copies its slides too; deleting waits until no screen
 * shows it.
 */
import { computed } from 'vue';
import { t } from '../i18n/designer';
import type { HeartbeatDoc } from '../model/heartbeat';
import { bannerShown } from '../player/banner';
import { useStageContext } from '../player/context';
import type { PlaylistOverview } from '../store/screen-repository';
import { liveScreens } from './alive';
import Icon from './Icon.vue';
import { lastEdited } from './last-edited';
import LiveFlag from './LiveFlag.vue';
import SlideThumb from './SlideThumb.vue';
import Tile from './Tile.vue';

const props = defineProps<{
    overview: PlaylistOverview;
    /** The signs of life by screen slug; null where they cannot be read – then no hint (Plan.md 77). */
    heartbeats?: Map<string, HeartbeatDoc> | null;
    now?: Date;
}>();
const emit = defineEmits<{ remove: []; duplicate: [] }>();

const context = useStageContext();
const playlist = computed(() => props.overview.playlist);
const portrait = computed(() => playlist.value.stage.height > playlist.value.stage.width);
const inUse = computed(() => props.overview.screens.length > 0);
/** A band is running (Plan.md, Nächste Schritte 34) – not one that only sits there, expired. */
const hasBanner = computed(() => bannerShown(playlist.value.banner, context.now, context.timeZone));

/** The screens that show it right now, by their own signs of life (Plan.md 77). */
const live = computed(() =>
    liveScreens(playlist.value.id, props.overview.screens, props.heartbeats ?? null, props.now ?? context.now),
);

/** When and by whom it was last edited – in the church's time zone, like every time here. */
const edited = computed(() => lastEdited(props.overview.editedAt, props.overview.editedBy, context.timeZone));
</script>

<template>
    <Tile data-testid="playlist-card" :menu-label="t.home.card.actionsFor(playlist.name)" menu-testid="playlist-menu">
        <template #media>
            <RouterLink
                class="open d-tile-media"
                :to="{ name: 'editor', params: { id: playlist.id } }"
                :aria-label="t.home.card.edit(playlist.name)"
                data-testid="open-playlist"
            >
                <SlideThumb :slide="overview.firstSlide" :stage="playlist.stage" />
            </RouterLink>
        </template>
        <template v-if="live.length || hasBanner" #marks>
            <LiveFlag v-if="live.length" overlay :live="live" :time-zone="context.timeZone" data-testid="playlist-live" />
            <span
                v-if="hasBanner"
                class="d-tile-mark"
                :title="t.playlists.card.bannerTitle(playlist.banner!.text)"
                data-testid="playlist-banner"
            >
                <Icon name="megaphone" :size="14" /> {{ t.playlists.card.banner }}
            </span>
        </template>
        <template #title>
            <RouterLink :to="{ name: 'editor', params: { id: playlist.id } }" tabindex="-1">
                {{ playlist.name || t.home.card.unnamed }}
            </RouterLink>
        </template>
        <template #menu="{ close }">
            <button role="menuitem" type="button" data-testid="duplicate-playlist" @click="close(); emit('duplicate')">
                <Icon name="copy" :size="16" /> {{ t.playlists.card.duplicate }}
            </button>
            <button
                role="menuitem"
                type="button"
                class="danger"
                :disabled="inUse"
                :title="inUse ? t.playlists.card.deleteBlocked : undefined"
                data-testid="delete-playlist"
                @click="close(); emit('remove')"
            >
                <Icon name="trash" :size="16" /> {{ t.common.delete }}
            </button>
        </template>
        <section class="d-tile-section">
            <ul class="d-facts">
                <li :title="portrait ? t.common.portrait : t.common.landscape">
                    <Icon :name="portrait ? 'portrait' : 'landscape'" :size="16" />
                    {{ portrait ? t.common.portrait : t.common.landscape }}
                </li>
                <li :title="t.playlists.card.slides">
                    <Icon name="slides" :size="16" />
                    {{ overview.slideCount }}
                </li>
            </ul>
        </section>
        <section class="d-tile-section">
            <ul class="d-facts">
                <li :title="inUse ? t.playlists.card.runsOn : t.playlists.card.runsNowhere" data-testid="playlist-screens">
                    <Icon name="tv" :size="16" />
                    {{ inUse ? overview.screens.map((s) => s.name).join(', ') : t.common.onNoScreen }}
                </li>
            </ul>
        </section>
        <template v-if="edited" #foot>
            <ul class="d-facts">
                <li v-if="edited.when" :title="edited.whenTitle!" data-testid="playlist-edited">
                    <Icon name="clock" :size="16" />
                    <span data-testid="playlist-edited-at">{{ edited.when }}</span>
                </li>
                <li v-if="edited.by" :title="edited.byTitle!" data-testid="playlist-edited-by">
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
</style>
