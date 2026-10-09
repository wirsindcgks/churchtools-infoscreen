<script setup lang="ts">
/**
 * The band over slides, in a place of its own (Plan.md, Nächste Schritte
 * 34): buried in a playlist's inspector, "Heute Parkplatz gesperrt" found
 * nobody in time. Playlists with the exact same band are one entry here;
 * "Beenden" and "Entfernen" clear it from every playlist of the group at
 * once, checked against every revision before anything is written.
 */
import { computed, onMounted, ref, shallowRef } from 'vue';
import { zonedDateKey, zonedParts } from '../appointments/zoned';
import { currentPerson, displayName } from '../ct/client';
import GroupCard from '../designer/GroupCard.vue';
import Icon from '../designer/Icon.vue';
import ModulePage from '../designer/ModulePage.vue';
import { lastEdited } from '../designer/last-edited';
import { type BannerGroup, groupBanners, noticeTimeline, untilLabel } from '../designer/notices';
import { providePalette } from '../designer/palette';
import NoticeDialog from '../designer/NoticeDialog.vue';
import NoticeThumb from '../designer/NoticeThumb.vue';
import PageHeader from '../designer/PageHeader.vue';
import Tile from '../designer/Tile.vue';
import { ruleCalendarIds } from '../designer/running';
import { fromMinutes, WEEKDAYS } from '../designer/schedule-ops';
import { usePreview } from '../designer/usePreview';
import WeekTimeline, { type TimelineDay } from '../designer/WeekTimeline.vue';
import { bannerKey, DEFAULT_THEME, type Banner, type ScreenDoc, type ThemeDoc } from '../model/schema';
import { getRepository } from '../store/backend';
import type { PlaylistOverview, ScreenRepository } from '../store/screen-repository';
import { t } from '../i18n/designer';
import { LOCALE } from '../i18n/player';
import { useConfirm } from '../designer/useConfirm';

const { confirm, notice } = useConfirm();

const repository = shallowRef<ScreenRepository | null>(null);
const author = ref<string | null>(null);
const overviews = ref<PlaylistOverview[]>([]);
const screens = ref<ScreenDoc[]>([]);
const theme = ref<ThemeDoc | null>(null);
const error = ref<string | null>(null);
/** Loaded: the page shows its frame before, and its content from then on. */
const ready = computed(() => author.value !== null && repository.value !== null);

const dialogOpen = ref(false);
/** The group being edited, to preselect its playlists; null for a new notice. */
const editingBanner = ref<Banner | null>(null);

// The time and zone, and the appointments of the rule calendars: a rule bound to an appointment decides when a band stands (Plan.md 69).
const { context } = usePreview(computed(() => ruleCalendarIds(screens.value)), ref([]), theme);
/** The dialog and new notices need an actual theme – without one yet, the defaults apply (Plan.md 27). */
const themeOrDefault = computed(() => theme.value ?? DEFAULT_THEME);
providePalette(themeOrDefault);

const groups = computed(() => groupBanners(overviews.value, context.now, context.timeZone));
const running = computed(() => groups.value.filter((g) => !g.expired));
const expired = computed(() => groups.value.filter((g) => g.expired));

function modeLabel(banner: Banner): string {
    return banner.mode === 'static' ? t.notices.modeStatic : t.notices.modeTicker;
}

/** "bis Sa., 27.09., 18:00"; for an expired band "abgelaufen am Sa., 27.09., 18:00", as `until` stands. */
function endLabel(group: BannerGroup): string {
    return untilLabel(group.banner.until, group.expired);
}

function screenNames(ids: readonly string[]): string {
    return ids.map((id) => screens.value.find((s) => s.id === id)?.name ?? '').join(', ');
}

/** When and by whom the band was last changed; none for a band from before the stamp (Plan.md 66). */
function edited(group: BannerGroup) {
    return lastEdited(group.updatedAt, group.updatedBy, context.timeZone);
}

async function refresh(): Promise<void> {
    if (!repository.value) return;
    const [list, screenList, stored] = await Promise.all([
        repository.value.listPlaylists(),
        repository.value.listScreens(),
        // The preview and new notices start in the theme's colours; without it the defaults apply.
        repository.value.loadTheme().catch(() => null),
    ]);
    overviews.value = list;
    screens.value = screenList;
    theme.value = stored;
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

// The week strip (Plan.md 69): seven days from today; a stretch's key is the screens it stands on.
const DAYS = 7;
const today = computed(() => {
    const [year, month, day] = zonedDateKey(context.now, context.timeZone).split('-').map(Number) as [number, number, number];
    return { year, month, day };
});
const needle = computed(() => {
    const p = zonedParts(context.now, context.timeZone);
    return { dayIndex: 0, minute: p.hour * 60 + p.minute };
});
const dayFormat = computed(
    () => new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }),
);
/** The strips of the running notices; they change with the day, the screens and the appointments, not with the clock's tick. */
const weeks = computed(
    () => new Map(running.value.map((g) => [bannerKey(g.banner), noticeTimeline(g, screens.value, today.value, DAYS, context.timeZone, context.appointments)])),
);

/** The screen line under the pointer or focus lights up its stretches; a stretch under the pointer lights up its screens' lines. */
const lineHover = ref<{ notice: string; screen: string } | null>(null);
const segmentHover = ref<{ notice: string; key: string } | null>(null);

function weekDays(group: BannerGroup): TimelineDay[] {
    const notice = bannerKey(group.banner);
    const lit = lineHover.value?.notice === notice ? lineHover.value.screen : null;
    return (weeks.value.get(notice) ?? []).map((day) => ({
        label: WEEKDAYS[day.weekday - 1]!.short,
        title: dayFormat.value.format(new Date(Date.UTC(day.date.year, day.date.month - 1, day.date.day))),
        segments: day.segments.map((segment) => ({
            start: segment.start,
            end: segment.end,
            color: segment.visible ? 'var(--d-accent)' : null,
            // A stretch that stands on the lit screen shares its key with the highlight, whoever else it stands on.
            key: lit !== null && segment.screenIds.includes(lit) ? lit : segment.screenIds.join('|'),
            label: segment.visible
                ? `${WEEKDAYS[day.weekday - 1]!.short} ${fromMinutes(segment.start)}–${fromMinutes(segment.end)}: ${screenNames(segment.screenIds)}`
                : '',
        })),
    }));
}

/** Whether the notice shows anywhere in the seven days. */
function showsAnywhere(group: BannerGroup): boolean {
    return (weeks.value.get(bannerKey(group.banner)) ?? []).some((day) => day.segments.some((s) => s.visible));
}

function isLinked(group: BannerGroup, screen: string): boolean {
    const hover = segmentHover.value;
    return hover?.notice === bannerKey(group.banner) && hover.key.split('|').includes(screen);
}

function openNew(): void {
    editingBanner.value = null;
    dialogOpen.value = true;
}

function edit(group: BannerGroup): void {
    editingBanner.value = group.banner;
    dialogOpen.value = true;
}

function closeDialog(): void {
    dialogOpen.value = false;
    editingBanner.value = null;
}

async function saved(): Promise<void> {
    closeDialog();
    await refresh();
}

/** Clears the band from every playlist of the group, checked against its own revision. */
async function clear(group: BannerGroup): Promise<void> {
    if (!repository.value) return;
    try {
        await repository.value.saveBanners(
            group.playlists.map((o) => ({ playlistId: o.playlist.id, expectedRevision: o.playlist.revision, banner: null })),
            { updatedBy: author.value ?? '' },
        );
    } catch (e) {
        await notice(e instanceof Error ? e.message : String(e));
    }
    await refresh();
}

async function end(group: BannerGroup): Promise<void> {
    if (!(await confirm({ message: t.notices.endConfirm(group.banner.text), confirmLabel: t.notices.end, danger: true }))) return;
    await clear(group);
}
</script>

<template>
    <ModulePage>
        <PageHeader icon="megaphone" :title="t.notices.title" testid="notices-heading">
            {{ t.notices.intro }}
            <template #actions>
                <button
                    class="d-btn d-btn--create"
                    type="button"
                    :aria-label="t.notices.new"
                    :disabled="!ready"
                    data-testid="new-notice"
                    @click="openNew"
                >
                    <Icon name="plus" />
                    <span class="create-label">{{ t.notices.new }}</span>
                </button>
            </template>
        </PageHeader>

        <p v-if="error" class="d-banner d-banner--error" role="alert">{{ error }}</p>
        <p v-else-if="!ready" class="empty">{{ t.common.loading }}</p>
        <template v-else>
            <GroupCard
                icon="megaphone"
                :title="t.notices.running"
                :count="t.notices.count(running.length)"
                heading-id="notices-running"
                :hide-heading="!expired.length"
            >
                <ul v-if="running.length" class="d-tiles">
                    <Tile
                        v-for="group in running"
                        :key="bannerKey(group.banner)"
                        :menu-label="t.home.card.actionsFor(group.banner.text)"
                        menu-testid="notice-menu"
                        data-testid="notice-card"
                    >
                        <template #media>
                            <button
                                class="thumb d-tile-media"
                                type="button"
                                :aria-label="t.schedules.edit"
                                :title="t.schedules.edit"
                                data-testid="notice-preview"
                                @click="edit(group)"
                            >
                                <NoticeThumb :banner="group.banner" :background="themeOrDefault.background" />
                            </button>
                        </template>
                        <template #title>{{ group.banner.text }}</template>
                        <template #menu="{ close }">
                            <button role="menuitem" type="button" data-testid="notice-edit" @click="close(); edit(group)">
                                <Icon name="pencil" :size="16" /> {{ t.schedules.edit }}
                            </button>
                            <button role="menuitem" type="button" class="danger" data-testid="notice-end" @click="close(); end(group)">
                                <Icon name="trash" :size="16" /> {{ t.notices.end }}
                            </button>
                        </template>
                        <section class="d-tile-section">
                            <WeekTimeline
                                class="week"
                                :days="weekDays(group)"
                                :now="needle"
                                :highlight="lineHover?.notice === bannerKey(group.banner) ? lineHover.screen : null"
                                @hover="(key) => (segmentHover = key === null ? null : { notice: bannerKey(group.banner), key })"
                            />
                            <p v-if="!showsAnywhere(group)" class="nowhere" data-testid="notice-nowhere">
                                {{ t.notices.nowhere }}
                            </p>
                        </section>
                        <section class="d-tile-section">
                            <ul class="d-facts">
                                <li>
                                    <Icon name="banner" :size="16" />
                                    <span>{{ modeLabel(group.banner) }}</span>
                                </li>
                                <li>
                                    <Icon name="timer" :size="16" />
                                    <span>{{ endLabel(group) }}</span>
                                </li>
                            </ul>
                        </section>
                        <section class="d-tile-section">
                            <ul class="d-facts">
                                <li>
                                    <Icon name="list" :size="16" />
                                    <span>{{ group.playlists.map((o) => o.playlist.name).join(', ') }}</span>
                                </li>
                                <li
                                    v-for="screen in group.screens"
                                    :key="screen.id"
                                    class="screen-line"
                                    :class="{ linked: isLinked(group, screen.id) }"
                                    data-testid="notice-screen-line"
                                    @mouseenter="lineHover = { notice: bannerKey(group.banner), screen: screen.id }"
                                    @mouseleave="lineHover = null"
                                    @focusin="lineHover = { notice: bannerKey(group.banner), screen: screen.id }"
                                    @focusout="lineHover = null"
                                >
                                    <Icon name="tv" :size="16" />
                                    <span>{{ screen.name }}</span>
                                </li>
                                <li v-if="!group.screens.length">
                                    <Icon name="tv" :size="16" />
                                    <span>{{ t.common.onNoScreen }}</span>
                                </li>
                            </ul>
                        </section>
                        <template v-if="edited(group)" #foot>
                            <ul class="d-facts">
                                <li v-if="edited(group)!.when" :title="edited(group)!.whenTitle!" data-testid="notice-edited-at">
                                    <Icon name="clock" :size="16" />
                                    <span>{{ edited(group)!.when }}</span>
                                </li>
                                <li v-if="edited(group)!.by" :title="edited(group)!.byTitle!" data-testid="notice-edited-by">
                                    <Icon name="person" :size="16" />
                                    <span>{{ edited(group)!.by }}</span>
                                </li>
                            </ul>
                        </template>
                    </Tile>
                </ul>
                <p v-else class="empty">{{ t.notices.noneRunning }}</p>
            </GroupCard>

            <GroupCard
                v-if="expired.length"
                icon="megaphone"
                :title="t.notices.expired"
                :count="t.notices.count(expired.length)"
                heading-id="notices-expired"
            >
                <p class="empty expired-hint">{{ t.notices.expiredHint }}</p>
                <ul class="d-tiles">
                    <Tile
                        v-for="group in expired"
                        :key="bannerKey(group.banner)"
                        :menu-label="t.home.card.actionsFor(group.banner.text)"
                        menu-testid="notice-menu"
                        data-testid="notice-card-expired"
                    >
                        <template #media>
                            <div class="d-tile-media">
                                <NoticeThumb :banner="group.banner" :background="themeOrDefault.background" />
                            </div>
                        </template>
                        <template #title>{{ group.banner.text }}</template>
                        <template #menu="{ close }">
                            <button role="menuitem" type="button" data-testid="notice-remove" @click="close(); clear(group)">
                                <Icon name="trash" :size="16" /> {{ t.common.remove }}
                            </button>
                        </template>
                        <section class="d-tile-section">
                            <ul class="d-facts">
                                <li>
                                    <Icon name="banner" :size="16" />
                                    <span>{{ modeLabel(group.banner) }}</span>
                                </li>
                                <li>
                                    <Icon name="timer" :size="16" />
                                    <span>{{ endLabel(group) }}</span>
                                </li>
                            </ul>
                        </section>
                        <section class="d-tile-section">
                            <ul class="d-facts">
                                <li>
                                    <Icon name="list" :size="16" />
                                    <span>{{ group.playlists.map((o) => o.playlist.name).join(', ') }}</span>
                                </li>
                                <li v-for="screen in group.screens" :key="screen.id">
                                    <Icon name="tv" :size="16" />
                                    <span>{{ screen.name }}</span>
                                </li>
                                <li v-if="!group.screens.length">
                                    <Icon name="tv" :size="16" />
                                    <span>{{ t.common.onNoScreen }}</span>
                                </li>
                            </ul>
                        </section>
                        <template v-if="edited(group)" #foot>
                            <ul class="d-facts">
                                <li v-if="edited(group)!.when" :title="edited(group)!.whenTitle!" data-testid="notice-edited-at">
                                    <Icon name="clock" :size="16" />
                                    <span>{{ edited(group)!.when }}</span>
                                </li>
                                <li v-if="edited(group)!.by" :title="edited(group)!.byTitle!" data-testid="notice-edited-by">
                                    <Icon name="person" :size="16" />
                                    <span>{{ edited(group)!.by }}</span>
                                </li>
                            </ul>
                        </template>
                    </Tile>
                </ul>
            </GroupCard>
        </template>

        <NoticeDialog
            v-if="dialogOpen && repository && author !== null"
            :repository="repository"
            :author="author"
            :theme="themeOrDefault"
            :time-zone="context.timeZone"
            :editing="editingBanner"
            @close="closeDialog"
            @saved="saved"
        />
    </ModulePage>
</template>

<style scoped>
/* A list, but laid out like the tiles' div elsewhere. */
ul.d-tiles {
    margin: 0;
    padding: 0;
    list-style: none;
}
.thumb {
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
}
.thumb:focus-visible {
    outline: 2px solid var(--d-accent);
    outline-offset: 2px;
}
.week {
    margin: 6px 0;
}
.nowhere {
    margin: 0 0 4px;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.screen-line {
    align-self: stretch;
    border-radius: var(--d-radius);
    margin: -3px -8px;
    padding: 3px 8px;
    max-width: none;
}
.screen-line:hover,
.screen-line.linked {
    background: var(--d-panel);
}
.empty {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.expired-hint {
    margin-bottom: 8px;
}
</style>
