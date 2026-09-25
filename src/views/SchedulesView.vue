<script setup lang="ts">
/**
 * All schedules at a glance (Plan.md, Nächste Schritte 21): per screen the
 * default playlist, the rules in words, and what runs right now – evaluated
 * with the player's own rule matching. Beside them the first slide of the
 * playlist that runs now, or of the line one clicks. Editing opens the same
 * dialog as the screen's tile.
 */
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';
import { currentPerson, displayName } from '../ct/client';
import GroupCard from '../designer/GroupCard.vue';
import Icon from '../designer/Icon.vue';
import ModulePage from '../designer/ModulePage.vue';
import PageHeader from '../designer/PageHeader.vue';
import ScheduleDialog from '../designer/ScheduleDialog.vue';
import { ruleCalendarIds, runningNow } from '../designer/running';
import { ruleSummary } from '../designer/schedule-ops';
import SearchField from '../designer/SearchField.vue';
import SlideThumb from '../designer/SlideThumb.vue';
import { usePreview } from '../designer/usePreview';
import { blockCalendarIds, type ScreenDoc, type ThemeDoc } from '../model/schema';
import { getRepository } from '../store/backend';
import type { PlaylistOverview, ScreenRepository } from '../store/screen-repository';

const repository = shallowRef<ScreenRepository | null>(null);
const author = ref<string | null>(null);
const screens = ref<ScreenDoc[]>([]);
const playlists = ref(new Map<string, PlaylistOverview>());
const theme = ref<ThemeDoc | null>(null);
const error = ref<string | null>(null);
const editing = ref<string | null>(null);
const query = ref('');
/** Loaded: the page shows its frame before, and its content from then on. */
const ready = computed(() => author.value !== null && repository.value !== null);
/** The playlist a screen's preview shows, by screen id, once someone clicked a line; else what runs now. */
const chosen = reactive(new Map<string, string>());

// Appointments of the rule calendars, for "läuft jetzt", and of the previews' slides; the calendars' names for the rules in words.
const { context, calendars } = usePreview(
    computed(() => [
        ...new Set([
            ...ruleCalendarIds(screens.value),
            ...[...playlists.value.values()].flatMap((o) => (o.firstSlide?.blocks ?? []).flatMap(blockCalendarIds)),
        ]),
    ]),
    computed(() => [...playlists.value.values()].flatMap((o) => o.media)),
    theme,
);

const shown = computed(() => {
    const needle = query.value.trim().toLocaleLowerCase('de');
    if (!needle) return screens.value;
    return screens.value.filter((s) =>
        [s.name, ...[s.defaultPlaylistId, ...s.schedule.map((r) => r.playlistId)].map(playlistName)]
            .join(' ')
            .toLocaleLowerCase('de')
            .includes(needle),
    );
});

function playlistName(id: string): string {
    return playlists.value.get(id)?.playlist.name ?? 'Playlist fehlt';
}

function calendarName(id: number): string {
    return calendars.value.find((c) => c.id === id)?.name ?? `Kalender ${id}`;
}

/** What runs now: the rule that decides, -1 for the default playlist. */
function running(screen: ScreenDoc) {
    return runningNow(screen, context);
}

/** The line whose playlist the preview shows: the clicked one, else the one that runs now. */
function previewIndex(screen: ScreenDoc): number {
    const id = chosen.get(screen.id);
    if (id === undefined) return running(screen).ruleIndex;
    return id === 'default' ? -1 : Number(id);
}

function previewed(screen: ScreenDoc): PlaylistOverview | null {
    const index = previewIndex(screen);
    const id = index < 0 ? screen.defaultPlaylistId : screen.schedule[index]?.playlistId;
    return (id && playlists.value.get(id)) || null;
}

function choose(screen: ScreenDoc, index: number): void {
    chosen.set(screen.id, index < 0 ? 'default' : String(index));
}

async function refresh(): Promise<void> {
    if (!repository.value) return;
    const [list, overviews, stored] = await Promise.all([
        repository.value.listScreens(),
        repository.value.listPlaylists(),
        repository.value.loadTheme().catch(() => null),
    ]);
    screens.value = list;
    playlists.value = new Map(overviews.map((o) => [o.playlist.id, o]));
    theme.value = stored;
    // A saved schedule may have fewer lines than the one clicked before.
    chosen.clear();
}

onMounted(async () => {
    try {
        const [person, handle] = await Promise.all([currentPerson(), getRepository()]);
        repository.value = handle.repository;
        await refresh();
        author.value = displayName(person);
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
    }
});
</script>

<template>
    <ModulePage current="schedules">
        <PageHeader icon="calendar" title="Zeitpläne" testid="schedules-heading">
            Welche Playlist auf welchem Screen wann läuft. Passt keine Regel, läuft die Standard-Playlist; passen mehrere,
            gilt die obere. Ein Klick auf eine Zeile zeigt ihre Playlist.
        </PageHeader>

        <p v-if="error" class="d-banner d-banner--error" role="alert">{{ error }}</p>
        <p v-else-if="!ready" class="empty">Lade …</p>
        <template v-else>
            <SearchField
                v-model="query"
                placeholder="Suchen nach Screen oder Playlist …"
                label="Zeitpläne durchsuchen"
                testid="schedule-search"
            />

            <GroupCard
                icon="calendar"
                title="Alle Screens"
                :count="`${shown.length} ${shown.length === 1 ? 'Screen' : 'Screens'}`"
                heading-id="schedules-group"
            >
                <ul v-if="shown.length" class="schedules">
                    <li v-for="screen in shown" :key="screen.id" class="schedule" data-testid="schedule-row">
                        <figure class="preview">
                            <RouterLink
                                v-if="previewed(screen)"
                                class="thumb"
                                :to="{ name: 'editor', params: { id: previewed(screen)!.playlist.id } }"
                                :aria-label="`${previewed(screen)!.playlist.name} bearbeiten`"
                                data-testid="schedule-preview"
                            >
                                <SlideThumb :slide="previewed(screen)!.firstSlide" :stage="previewed(screen)!.playlist.stage" />
                            </RouterLink>
                            <SlideThumb v-else :slide="null" :stage="screen.stage" />
                            <figcaption>
                                {{ previewIndex(screen) === running(screen).ruleIndex ? 'Läuft jetzt' : 'Vorschau' }}:
                                <strong>{{ previewed(screen)?.playlist.name ?? 'Playlist fehlt' }}</strong>
                            </figcaption>
                        </figure>
                        <div class="details">
                            <div class="row-head">
                                <Icon
                                    :name="screen.stage.height > screen.stage.width ? 'portrait' : 'landscape'"
                                    :size="18"
                                    class="format"
                                />
                                <h3>{{ screen.name }}</h3>
                                <span class="now" data-testid="schedule-now">
                                    Jetzt: <strong>{{ playlistName(running(screen).playlistId) }}</strong>
                                </span>
                                <button class="d-btn" type="button" data-testid="schedule-edit" @click="editing = screen.slug">
                                    Bearbeiten
                                </button>
                            </div>
                            <ol class="rules">
                                <li
                                    v-for="(rule, index) in screen.schedule"
                                    :key="index"
                                    :class="{ active: running(screen).ruleIndex === index, previewed: previewIndex(screen) === index }"
                                    data-testid="schedule-rule-line"
                                >
                                    <button type="button" class="line" :aria-pressed="previewIndex(screen) === index" @click="choose(screen, index)">
                                        <span class="rank">{{ index + 1 }}</span>
                                        <span>{{ ruleSummary(rule, calendarName) }}</span>
                                        <span class="arrow" aria-hidden="true">→</span>
                                        <strong>{{ playlistName(rule.playlistId) }}</strong>
                                    </button>
                                </li>
                                <li
                                    :class="{ active: running(screen).ruleIndex < 0, previewed: previewIndex(screen) < 0 }"
                                    data-testid="schedule-default-line"
                                >
                                    <button type="button" class="line" :aria-pressed="previewIndex(screen) < 0" @click="choose(screen, -1)">
                                        <span class="rank rank--default" aria-hidden="true">·</span>
                                        <span>{{ screen.schedule.length ? 'sonst' : 'immer' }}</span>
                                        <span class="arrow" aria-hidden="true">→</span>
                                        <strong>{{ playlistName(screen.defaultPlaylistId) }}</strong>
                                        <span class="muted">(Standard)</span>
                                    </button>
                                </li>
                            </ol>
                        </div>
                    </li>
                </ul>
                <p v-else-if="!screens.length" class="empty">Noch keine Screens – sie legt ein Administrator an.</p>
                <p v-else class="empty">Kein Screen passt zur Suche.</p>
            </GroupCard>
        </template>

        <ScheduleDialog
            v-if="editing && repository && author !== null"
            :slug="editing"
            :repository="repository"
            :author="author"
            @close="editing = null"
            @saved="editing = null; refresh()"
        />
    </ModulePage>
</template>

<style scoped>
.schedules {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
}
.schedule {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 16px;
    align-items: start;
    padding: 12px 14px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
}
.preview {
    display: grid;
    gap: 6px;
    margin: 0;
}
.thumb,
.preview > .slide-thumb {
    display: block;
    overflow: hidden;
    border-radius: var(--d-radius);
}
.thumb:focus-visible {
    outline: 2px solid var(--d-accent);
    outline-offset: 2px;
}
figcaption {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
figcaption strong {
    color: var(--d-text);
}
.row-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
}
.row-head h3 {
    margin: 0;
    font-size: 1.05em;
}
.format {
    color: var(--d-text-muted);
}
.now {
    margin-left: auto;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.now strong {
    color: var(--d-success);
}
.rules {
    display: grid;
    gap: 4px;
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
    font-size: var(--d-size-sm);
}
.line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 8px;
    border: 0;
    border-radius: var(--d-radius);
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
}
.line:hover {
    background: var(--d-panel);
}
.previewed .line {
    background: var(--d-accent-pale);
}
.active .line {
    box-shadow: inset 3px 0 0 var(--d-success);
}
.rank {
    display: inline-grid;
    place-items: center;
    width: 1.5em;
    height: 1.5em;
    border-radius: 50%;
    background: var(--d-panel);
    font-weight: 700;
}
.rank--default {
    background: none;
}
.arrow {
    color: var(--d-text-muted);
}
.empty {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.muted {
    color: var(--d-text-muted);
}

/* Phone: the preview above the rules, "Jetzt" below the name. */
@media (max-width: 48rem) {
    .schedule {
        grid-template-columns: minmax(0, 1fr);
    }
    .now {
        order: 3;
        width: 100%;
        margin-left: 0;
    }
}
</style>
