<script setup lang="ts">
/**
 * The page "Verlauf" (Plan.md 100): who changed what, when – the last 30 days, newest first, one sentence per entry, to be
 * narrowed by person and by area. The editor links here with `?playlist=<id>` for the history of one presentation. Opening
 * the page tidies up: whoever may edit the category deletes the entries older than 30 days, for everyone else the list
 * hides them. Without the category or the right to see it the page says when the changelog begins.
 */
import { computed, onMounted, ref, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { administrator, isAdministrator } from '../designer/administrator';
import { relativeWhen } from '../designer/last-edited';
import { describeChange } from '../designer/change-lines';
import { provideHelp } from '../designer/help/register';
import HelpBar from '../designer/HelpBar.vue';
import Icon from '../designer/Icon.vue';
import InspectorHelp from '../designer/InspectorHelp.vue';
import ModulePage from '../designer/ModulePage.vue';
import PageHeader from '../designer/PageHeader.vue';
import SelectMenu from '../designer/SelectMenu.vue';
import { th } from '../i18n/help';
import { t } from '../i18n/designer';
import { LOCALE } from '../i18n/player';
import { CHANGE_AREAS, type ChangeArea, type ChangeDoc } from '../model/schema';
import { churchToolsPlayerData } from '../player/data';
import { getRepository } from '../store/backend';

const route = useRoute();
const router = useRouter();

/** null while loading; an unavailable changelog (no category, no right) is `unavailable`. */
const entries = shallowRef<ChangeDoc[] | null>(null);
const unavailable = ref(false);
const error = ref<string | null>(null);
const timeZone = ref(Intl.DateTimeFormat().resolvedOptions().timeZone);
const person = ref('');
const area = ref('');
const admin = computed(() => administrator.value === true);

/** The presentation the page is narrowed to, from the editor's menu. */
const playlistId = computed(() => (typeof route.query.playlist === 'string' ? route.query.playlist : ''));
const playlistName = computed(() => entries.value?.find((e) => e.area === 'playlist' && e.targetId === playlistId.value)?.targetName ?? '');

const help = provideHelp(() => t.history.title, () => th.history.intro);
help.addGeneral(() => th.history.items);
function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && help.open.value) help.close();
}

onMounted(async () => {
    window.addEventListener('keydown', onKey);
    void isAdministrator();
    churchToolsPlayerData.timeZone().then(
        (zone) => (timeZone.value = zone),
        () => undefined,
    );
    try {
        const { repository } = await getRepository();
        const list = await repository.changelog.list();
        unavailable.value = list === null;
        entries.value = list ?? [];
        // Tidying up is for whoever may; for everyone else the call ends quietly at the first refused deletion.
        if (list) void repository.changelog.prune().catch(() => undefined);
    } catch (e) {
        error.value = e instanceof Error ? e.message : t.history.failed;
    }
});

const persons = computed(() =>
    [...new Set((entries.value ?? []).map((e) => e.by))].sort((a, b) => a.localeCompare(b, LOCALE)).map((by) => ({ value: by, label: by || t.history.unknownPerson })),
);
const personOptions = computed(() => [{ value: '', label: t.history.allPersons }, ...persons.value]);
const areaOptions = computed(() => [
    { value: '', label: t.history.allAreas },
    ...CHANGE_AREAS.map((a) => ({ value: a, label: t.history.areas[a] })),
]);

const shown = computed(() =>
    (entries.value ?? []).filter(
        (e) =>
            (!person.value || e.by === person.value) &&
            (!area.value || e.area === area.value) &&
            (!playlistId.value || (e.area === 'playlist' && e.targetId === playlistId.value)),
    ),
);
const lines = computed(() =>
    shown.value.map((entry) => ({
        entry,
        ...describeChange(entry),
        when: relativeWhen(entry.at, timeZone.value),
        area: t.history.areas[entry.area as ChangeArea],
    })),
);

function showAll(): void {
    void router.replace({ name: 'history' });
}
</script>

<template>
    <ModulePage>
        <PageHeader icon="clock" :title="t.history.title" testid="history-heading">
            {{ t.history.intro }}
            <template #actions><InspectorHelp /></template>
        </PageHeader>

        <p v-if="error" class="d-banner d-banner--error" role="alert">{{ error }}</p>
        <p v-else-if="entries === null" class="empty">{{ t.history.loading }}</p>
        <div v-else-if="unavailable" class="d-card unavailable" data-testid="history-unavailable">
            <p>{{ t.history.unavailable }}</p>
            <RouterLink v-if="admin" :to="{ name: 'setup' }" class="d-btn" data-testid="history-setup-link">{{ t.history.unavailableLink }}</RouterLink>
        </div>
        <template v-else>
            <div class="filters">
                <label class="d-field">
                    {{ t.history.personLabel }}
                    <SelectMenu v-model="person" :options="personOptions" testid="history-person" />
                </label>
                <label class="d-field">
                    {{ t.history.areaLabel }}
                    <SelectMenu v-model="area" :options="areaOptions" testid="history-area" />
                </label>
                <p v-if="playlistId" class="only" data-testid="history-only">
                    <span>{{ playlistName ? t.history.only(playlistName) : t.history.onlyUnnamed }}</span>
                    <button class="d-btn" type="button" data-testid="history-show-all" @click="showAll">{{ t.history.showAll }}</button>
                </p>
            </div>

            <p v-if="!entries.length" class="empty" data-testid="history-empty">{{ t.history.empty }}</p>
            <p v-else-if="!lines.length" class="empty" data-testid="history-no-match">{{ t.history.noMatch }}</p>
            <ul v-else class="entries" :aria-label="t.history.listLabel" data-testid="history-list">
                <li v-for="line in lines" :key="line.entry.id" class="entry" data-testid="history-entry" :data-area="line.entry.area">
                    <span class="mark"><Icon name="clock" :size="16" /></span>
                    <div class="text">
                        <p class="sentence">{{ line.text }}</p>
                        <p v-if="line.names" class="names">{{ line.names }}</p>
                        <p class="meta">
                            <span>{{ line.when }}</span>
                            <span>{{ line.entry.by || t.history.unknownPerson }}</span>
                            <span>{{ line.area }}</span>
                        </p>
                    </div>
                </li>
            </ul>
            <p class="note">{{ t.history.note }}</p>
        </template>
        <HelpBar />
    </ModulePage>
</template>

<style scoped>
.empty,
.note {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.unavailable p {
    margin: 0 0 var(--d-space-3);
}
.filters {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--d-space-3);
}
.filters .d-field {
    min-width: 14rem;
}
.only {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--d-space-2);
    margin: 0;
    font-weight: var(--d-weight-button);
}
.entries {
    display: grid;
    gap: var(--d-space-2);
    margin: 0;
    padding: 0;
    list-style: none;
}
.entry {
    display: flex;
    gap: var(--d-space-3);
    padding: var(--d-space-3);
    border: 1px solid var(--d-edge);
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
}
.mark {
    display: grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--d-radius-lg);
    background: var(--d-accent-pale);
    color: var(--d-accent);
}
.text {
    min-width: 0;
}
.text p {
    margin: 0;
    overflow-wrap: anywhere;
}
.names {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--d-space-3);
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
