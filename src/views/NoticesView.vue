<script setup lang="ts">
/**
 * The band over slides, in a place of its own (Plan.md, Nächste Schritte
 * 34): buried in a playlist's inspector, "Heute Parkplatz gesperrt" found
 * nobody in time. Playlists with the exact same band are one entry here;
 * "Beenden" and "Entfernen" clear it from every playlist of the group at
 * once, checked against every revision before anything is written.
 */
import { computed, onMounted, ref, shallowRef } from 'vue';
import { currentPerson, displayName } from '../ct/client';
import GroupCard from '../designer/GroupCard.vue';
import Icon from '../designer/Icon.vue';
import ModulePage from '../designer/ModulePage.vue';
import { lastEdited } from '../designer/last-edited';
import { type BannerGroup, groupBanners, untilLabel } from '../designer/notices';
import { providePalette } from '../designer/palette';
import NoticeDialog from '../designer/NoticeDialog.vue';
import PageHeader from '../designer/PageHeader.vue';
import { usePreview } from '../designer/usePreview';
import { bannerKey, DEFAULT_THEME, type Banner, type ThemeDoc } from '../model/schema';
import { getRepository } from '../store/backend';
import type { PlaylistOverview, ScreenRepository } from '../store/screen-repository';

const repository = shallowRef<ScreenRepository | null>(null);
const author = ref<string | null>(null);
const overviews = ref<PlaylistOverview[]>([]);
const theme = ref<ThemeDoc | null>(null);
const error = ref<string | null>(null);
/** Loaded: the page shows its frame before, and its content from then on. */
const ready = computed(() => author.value !== null && repository.value !== null);

const dialogOpen = ref(false);
/** The group being edited, to preselect its playlists; null for a new notice. */
const editingBanner = ref<Banner | null>(null);

// Only the time and time zone matter here – no appointments or media, unlike the other pages' previews.
const { context } = usePreview(ref([]), ref([]), theme);
/** The dialog and new notices need an actual theme – without one yet, the defaults apply (Plan.md 27). */
const themeOrDefault = computed(() => theme.value ?? DEFAULT_THEME);
providePalette(themeOrDefault);

const groups = computed(() => groupBanners(overviews.value, context.now, context.timeZone));
const running = computed(() => groups.value.filter((g) => !g.expired));
const expired = computed(() => groups.value.filter((g) => g.expired));

function modeLabel(banner: Banner): string {
    return banner.mode === 'static' ? 'Stehend' : 'Laufschrift';
}

function onLabel(group: BannerGroup): string {
    const playlists = group.playlists.map((o) => o.playlist.name).join(', ');
    return group.screens.length ? `Auf: ${playlists} – läuft auf ${group.screens.map((s) => s.name).join(', ')}` : `Auf: ${playlists}`;
}

/** When and by whom the band was last changed; none for a band from before the stamp (Plan.md 66). */
function edited(group: BannerGroup) {
    return lastEdited(group.updatedAt, group.updatedBy, context.timeZone);
}

async function refresh(): Promise<void> {
    if (!repository.value) return;
    const [list, stored] = await Promise.all([
        repository.value.listPlaylists(),
        // The preview and new notices start in the theme's colours; without it the defaults apply.
        repository.value.loadTheme().catch(() => null),
    ]);
    overviews.value = list;
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
        window.alert(e instanceof Error ? e.message : String(e));
    }
    await refresh();
}

async function end(group: BannerGroup): Promise<void> {
    if (!window.confirm(`Hinweis „${group.banner.text}“ auf allen Playlists beenden?`)) return;
    await clear(group);
}
</script>

<template>
    <ModulePage current="notices">
        <template #actions>
            <button
                class="d-btn d-btn--create"
                type="button"
                aria-label="Neuer Hinweis"
                :disabled="!ready"
                data-testid="new-notice"
                @click="openNew"
            >
                <Icon name="plus" />
                <span class="create-label">Neuer Hinweis</span>
            </button>
        </template>

        <PageHeader icon="megaphone" title="Hinweise" testid="notices-heading">
            Ein Band über allen Slides – etwa „Heute Parkplatz gesperrt". Es läuft auf allen gewählten Playlists und
            verschwindet zur eingestellten Zeit von selbst.
        </PageHeader>

        <p v-if="error" class="d-banner d-banner--error" role="alert">{{ error }}</p>
        <p v-else-if="!ready" class="empty">Lade …</p>
        <template v-else>
            <GroupCard
                icon="megaphone"
                title="Laufende Hinweise"
                :count="`${running.length} ${running.length === 1 ? 'Hinweis' : 'Hinweise'}`"
                heading-id="notices-running"
            >
                <ul v-if="running.length" class="notices">
                    <li
                        v-for="group in running"
                        :key="bannerKey(group.banner)"
                        class="d-card notice-card"
                        data-testid="notice-card"
                    >
                        <p class="text">{{ group.banner.text }}</p>
                        <ul class="facts">
                            <li>{{ modeLabel(group.banner) }}</li>
                            <li>{{ untilLabel(group.banner.until) }}</li>
                            <li>{{ onLabel(group) }}</li>
                            <li v-if="edited(group)?.when" :title="edited(group)!.whenTitle!" data-testid="notice-edited-at">
                                <Icon name="clock" :size="16" />
                                <span>{{ edited(group)!.when }}</span>
                            </li>
                            <li v-if="edited(group)?.by" :title="edited(group)!.byTitle!" data-testid="notice-edited-by">
                                <Icon name="person" :size="16" />
                                <span>{{ edited(group)!.by }}</span>
                            </li>
                        </ul>
                        <div class="actions">
                            <button class="d-btn" type="button" data-testid="notice-edit" @click="edit(group)">Bearbeiten</button>
                            <button class="d-btn d-btn--danger" type="button" data-testid="notice-end" @click="end(group)">
                                Beenden
                            </button>
                        </div>
                    </li>
                </ul>
                <p v-else class="empty">Gerade läuft kein Hinweis.</p>
            </GroupCard>

            <GroupCard
                v-if="expired.length"
                icon="megaphone"
                title="Abgelaufen"
                :count="`${expired.length} ${expired.length === 1 ? 'Hinweis' : 'Hinweise'}`"
                heading-id="notices-expired"
            >
                <p class="empty expired-hint">Abgelaufene Hinweise verschwinden nach 7 Tagen von selbst.</p>
                <ul class="notices">
                    <li
                        v-for="group in expired"
                        :key="bannerKey(group.banner)"
                        class="d-card notice-card"
                        data-testid="notice-card-expired"
                    >
                        <p class="text">{{ group.banner.text }}</p>
                        <ul class="facts">
                            <li>{{ modeLabel(group.banner) }}</li>
                            <li>{{ untilLabel(group.banner.until) }}</li>
                            <li>{{ onLabel(group) }}</li>
                            <li v-if="edited(group)?.when" :title="edited(group)!.whenTitle!" data-testid="notice-edited-at">
                                <Icon name="clock" :size="16" />
                                <span>{{ edited(group)!.when }}</span>
                            </li>
                            <li v-if="edited(group)?.by" :title="edited(group)!.byTitle!" data-testid="notice-edited-by">
                                <Icon name="person" :size="16" />
                                <span>{{ edited(group)!.by }}</span>
                            </li>
                        </ul>
                        <div class="actions">
                            <button class="d-btn" type="button" data-testid="notice-remove" @click="clear(group)">
                                Entfernen
                            </button>
                        </div>
                    </li>
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
.notices {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
}
.notice-card {
    display: grid;
    gap: 4px;
    padding: 12px 14px;
}
.text {
    margin: 0;
    overflow: hidden;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
}
/* One fact per line; a long value wraps under its own words, not under the icon. */
.facts {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.facts li {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    max-width: 100%;
    min-width: 0;
    overflow-wrap: anywhere;
}
.facts li :deep(svg) {
    flex: none;
    margin-top: 0.1em;
}
.actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
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
