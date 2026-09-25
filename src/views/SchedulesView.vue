<script setup lang="ts">
/**
 * All schedules at a glance (Plan.md, Nächste Schritte 21): per screen the
 * default playlist, the rules in words, and what runs right now – evaluated
 * with the player's own rule matching. Editing opens the same dialog as the
 * screen's tile.
 */
import { computed, onMounted, ref, shallowRef } from 'vue';
import { currentPerson, displayName } from '../ct/client';
import Icon from '../designer/Icon.vue';
import ModulePage from '../designer/ModulePage.vue';
import ScheduleDialog from '../designer/ScheduleDialog.vue';
import { ruleSummary } from '../designer/schedule-ops';
import { usePreview } from '../designer/usePreview';
import type { ScreenDoc } from '../model/schema';
import { matchingRuleIndex } from '../player/schedule';
import { canManagePermissions } from '../setup/load';
import { getRepository } from '../store/backend';
import type { ScreenRepository } from '../store/screen-repository';

const repository = shallowRef<ScreenRepository | null>(null);
const author = ref<string | null>(null);
const screens = ref<ScreenDoc[]>([]);
const playlistNames = ref(new Map<string, string>());
const admin = ref(false);
const error = ref<string | null>(null);
const editing = ref<string | null>(null);

// Appointments of all rule calendars, for "läuft jetzt"; the calendars' names for the rules in words.
const { context, calendars } = usePreview(
    computed(() => [
        ...new Set(
            screens.value.flatMap((s) => s.schedule.flatMap((r) => (r.kind === 'appointment' ? r.calendarIds : []))),
        ),
    ]),
    computed(() => []),
);

function playlistName(id: string): string {
    return playlistNames.value.get(id) ?? 'Playlist fehlt';
}

function calendarName(id: number): string {
    return calendars.value.find((c) => c.id === id)?.name ?? `Kalender ${id}`;
}

/** What runs now: the rule that decides, -1 for the default playlist. */
function runningNow(screen: ScreenDoc): { ruleIndex: number; playlistId: string } {
    const ruleIndex = matchingRuleIndex(screen, {
        now: context.now,
        timeZone: context.timeZone,
        clockConfirmed: true,
        appointments: context.appointments,
    });
    return { ruleIndex, playlistId: ruleIndex < 0 ? screen.defaultPlaylistId : screen.schedule[ruleIndex]!.playlistId };
}

async function refresh(): Promise<void> {
    if (!repository.value) return;
    const [list, playlists] = await Promise.all([repository.value.listScreens(), repository.value.listPlaylists()]);
    screens.value = list;
    playlistNames.value = new Map(playlists.map((o) => [o.playlist.id, o.playlist.name]));
}

onMounted(async () => {
    try {
        const [person, handle, isAdmin] = await Promise.all([
            currentPerson(),
            getRepository(),
            canManagePermissions().catch(() => false),
        ]);
        admin.value = isAdmin;
        repository.value = handle.repository;
        await refresh();
        author.value = displayName(person);
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
    }
});
</script>

<template>
    <div class="infoscreen-designer home">
        <p v-if="error" class="d-banner d-banner--error page-message" role="alert">{{ error }}</p>
        <template v-else-if="author !== null && repository">
            <ModulePage current="schedules" :admin="admin">
                <div class="page-title">
                    <span class="title-icon"><Icon name="calendar" :size="20" /></span>
                    <h1 data-testid="schedules-heading">Zeitpläne</h1>
                </div>
                <p class="muted intro">
                    Welche Playlist auf welchem Screen wann läuft. Passt keine Regel, läuft die Standard-Playlist;
                    passen mehrere, gilt die obere.
                </p>

                <section class="d-card group" aria-labelledby="schedules-group">
                    <header>
                        <span class="group-icon"><Icon name="calendar" /></span>
                        <div>
                            <h2 id="schedules-group">Alle Screens</h2>
                            <span class="muted">{{ screens.length }} {{ screens.length === 1 ? 'Screen' : 'Screens' }}</span>
                        </div>
                    </header>
                    <ul v-if="screens.length" class="schedules">
                        <li v-for="screen in screens" :key="screen.id" class="schedule" data-testid="schedule-row">
                            <div class="row-head">
                                <Icon
                                    :name="screen.stage.height > screen.stage.width ? 'portrait' : 'landscape'"
                                    :size="18"
                                    class="format"
                                />
                                <h3>{{ screen.name }}</h3>
                                <span class="now" data-testid="schedule-now">
                                    Jetzt: <strong>{{ playlistName(runningNow(screen).playlistId) }}</strong>
                                </span>
                                <button
                                    class="d-btn"
                                    type="button"
                                    data-testid="schedule-edit"
                                    @click="editing = screen.slug"
                                >
                                    Bearbeiten
                                </button>
                            </div>
                            <ol class="rules">
                                <li
                                    v-for="(rule, index) in screen.schedule"
                                    :key="index"
                                    :class="{ active: runningNow(screen).ruleIndex === index }"
                                    data-testid="schedule-rule-line"
                                >
                                    <span class="rank">{{ index + 1 }}</span>
                                    <span>{{ ruleSummary(rule, calendarName) }}</span>
                                    <span class="arrow" aria-hidden="true">→</span>
                                    <strong>{{ playlistName(rule.playlistId) }}</strong>
                                </li>
                                <li :class="{ active: runningNow(screen).ruleIndex < 0 }" data-testid="schedule-default-line">
                                    <span class="rank rank--default" aria-hidden="true">·</span>
                                    <span>{{ screen.schedule.length ? 'sonst' : 'immer' }}</span>
                                    <span class="arrow" aria-hidden="true">→</span>
                                    <strong>{{ playlistName(screen.defaultPlaylistId) }}</strong>
                                    <span class="muted">(Standard)</span>
                                </li>
                            </ol>
                        </li>
                    </ul>
                    <p v-else class="empty muted">Noch keine Screens – sie legt ein Administrator an.</p>
                </section>
            </ModulePage>

            <ScheduleDialog
                v-if="editing"
                :slug="editing"
                :repository="repository"
                :author="author"
                @close="editing = null"
                @saved="editing = null; refresh()"
            />
        </template>
        <p v-else class="page-message muted">Lade …</p>
    </div>
</template>

<style scoped>
.home {
    min-height: 100%;
}
.page-message {
    margin: 24px 16px;
}
.page-title {
    display: flex;
    align-items: center;
    gap: 12px;
}
.page-title h1 {
    margin: 0;
    font-size: 1.8em;
}
.title-icon,
.group-icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: var(--d-radius-lg);
    background: var(--d-accent-pale);
    color: var(--d-accent);
}
.group-icon {
    border-radius: 50%;
}
.group {
    padding: 16px 20px 20px;
}
.group header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
}
.intro {
    margin: -8px 0 0;
}
.schedules {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
}
.schedule {
    padding: 12px 14px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
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
.rules li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: var(--d-radius);
}
.rules li.active {
    background: var(--d-accent-pale);
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
.group h2 {
    margin: 0;
    font-size: 1.15em;
}
.empty {
    display: grid;
    justify-items: start;
    gap: 10px;
    margin: 0;
}
.empty p {
    margin: 0;
}
.muted {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}

/* Phone: "Jetzt" moves below the name. */
@media (max-width: 48rem) {
    .page-title h1 {
        font-size: 1.4em;
    }
    .title-icon {
        display: none;
    }
    .group {
        padding: 12px;
    }
    .now {
        order: 3;
        width: 100%;
        margin-left: 0;
    }
}
</style>
