<script setup lang="ts">
/**
 * The area "Probe" of the phone page (Plan.md 121, "Proben"): the musicians search a song of the song database, choose its arrangement and
 * tap its parts. A tap writes the rehearsal choice into the category `steuerung` – one for all rehearsal screens, independent of any event.
 * What another musician chose later is read every few seconds and shown here too.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';
import { stepSection, type RehearsalDoc } from '../agenda/control';
import type { SongSheet } from '../agenda/songsheet';
import { fetchSong, searchSongs, type SongArrangementResponse, type SongResponse } from '../ct/api';
import { t } from '../i18n/designer';
import { loadArrangementSheet } from '../player/data';
import type { ScreenRepository } from '../store/screen-repository';
import Icon from '../designer/Icon.vue';
import ControlSong from './ControlSong.vue';
import { arrangementLabels } from './arrangement-labels';

const props = defineProps<{ repository: ScreenRepository; author: string }>();

const POLL_MS = 2500;
const SEARCH_MS = 300;
const MIN_QUERY = 2;

const query = ref('');
const results = shallowRef<SongResponse[]>([]);
const searching = ref(false);
/** Whether `results` answers the current query – "Kein Lied gefunden." shows only then. */
const searched = ref(false);
const song = shallowRef<SongResponse | null>(null);
const arrangementId = ref<number | null>(null);
const sheet = shallowRef<SongSheet | null>(null);
const sheetLoading = ref(false);
const section = ref<number | null>(null);
const notSaved = ref(false);
const failure = ref<string | null>(null);
/** The `at` (ms) of the latest choice this page showed or wrote; only a younger one of another musician is taken over. */
let appliedAt = 0;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let searchRun = 0;
let loadRun = 0;
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let gone = false;

/**
 * Search, then play (user, 2026-11-13): with a song the search folds away behind "Anderes Lied"; without one it is all there is.
 */
const searchOpen = ref(false);
const showSearch = computed(() => !song.value || searchOpen.value);
const searchInput = useTemplateRef<HTMLInputElement>('searchInput');

async function openSearch(): Promise<void> {
    searchOpen.value = true;
    await nextTick();
    searchInput.value?.focus();
}

function closeSearch(): void {
    searchOpen.value = false;
    query.value = '';
    results.value = [];
}

const arrangements = computed(() => (song.value?.arrangements ?? []).filter((a): a is SongArrangementResponse & { id: number } => typeof a.id === 'number'));
const previous = computed(() => (sheet.value ? stepSection(sheet.value, section.value, -1) : null));
const following = computed(() => (sheet.value ? stepSection(sheet.value, section.value, 1) : null));

const labels = computed(() => arrangementLabels(arrangements.value, t.control.arrangement));

/**
 * Shows an arrangement. `start` – the musician picked it here: the screens show it at once, from its first part (user, 2026-11-13);
 * without a readable sheet part 0 is written all the same, so the screens leave the song before.
 */
async function showArrangement(id: number | null, at: number | null, start = false): Promise<void> {
    const run = ++loadRun;
    // A pick of this page beats a choice of another musician that comes in while the sheet loads.
    if (start) appliedAt = Date.now();
    arrangementId.value = id;
    section.value = at;
    sheet.value = null;
    const chosen = arrangements.value.find((a) => a.id === id);
    if (!chosen) return;
    sheetLoading.value = true;
    let loaded: SongSheet | null = null;
    try {
        loaded = await loadArrangementSheet(chosen).catch(() => null);
        if (run === loadRun) sheet.value = loaded;
    } finally {
        if (run === loadRun) sheetLoading.value = false;
    }
    if (start && run === loadRun) await choose(stepSection(loaded, null, 1) ?? 0);
}

function pickSong(found: SongResponse): void {
    song.value = found;
    closeSearch();
    const list = (found.arrangements ?? []).filter((a) => typeof a.id === 'number');
    void showArrangement((list.find((a) => a.isDefault) ?? list[0])?.id ?? null, null, true);
}

watch(query, (text) => {
    clearTimeout(searchTimer);
    const run = ++searchRun;
    const trimmed = text.trim();
    searched.value = false;
    if (trimmed.length < MIN_QUERY) {
        results.value = [];
        searching.value = false;
        return;
    }
    searching.value = true;
    searchTimer = setTimeout(async () => {
        try {
            const found = await searchSongs(trimmed);
            if (run !== searchRun) return;
            results.value = found.filter((s) => typeof s.id === 'number');
            searched.value = true;
            failure.value = null;
        } catch (e) {
            if (run === searchRun) failure.value = t.control.failed(e instanceof Error ? e.message : null);
        } finally {
            if (run === searchRun) searching.value = false;
        }
    }, SEARCH_MS);
});

async function choose(n: number): Promise<void> {
    if (!song.value?.id || arrangementId.value === null) return;
    section.value = n;
    const doc: RehearsalDoc = {
        kind: 'rehearsal',
        songId: song.value.id,
        arrangementId: arrangementId.value,
        section: n,
        at: new Date().toISOString(),
    };
    if (props.author) doc.by = props.author;
    appliedAt = Date.parse(doc.at);
    notSaved.value = false;
    try {
        await props.repository.writeRehearsal(doc);
    } catch (error) {
        console.warn('Die Wahl konnte nicht gespeichert werden:', error);
        notSaved.value = true;
    }
}

/** Takes over what another musician chose later than this page knows. */
async function adopt(doc: RehearsalDoc): Promise<void> {
    appliedAt = Date.parse(doc.at);
    if (song.value?.id !== doc.songId) {
        // Whoever is typing a search keeps it open; the song of the other musician shows once it is closed.
        if (!song.value && query.value.trim()) searchOpen.value = true;
        song.value = await fetchSong(doc.songId);
    }
    await showArrangement(doc.arrangementId, doc.section);
}

async function refresh(): Promise<void> {
    const doc = await props.repository.readRehearsal();
    if (doc && Date.parse(doc.at) > appliedAt) await adopt(doc);
}

function schedule(): void {
    if (gone) return;
    pollTimer = setTimeout(async () => {
        try {
            await refresh();
            failure.value = null;
        } catch (e) {
            failure.value = t.control.failed(e instanceof Error ? e.message : null);
        }
        schedule();
    }, POLL_MS);
}

onMounted(async () => {
    try {
        await refresh();
    } catch (e) {
        failure.value = t.control.failed(e instanceof Error ? e.message : null);
    }
    schedule();
});

onBeforeUnmount(() => {
    gone = true;
    clearTimeout(searchTimer);
    clearTimeout(pollTimer);
});
</script>

<template>
    <div class="rehearsal" data-testid="control-rehearsal">
        <p v-if="failure" class="warn" role="alert">{{ failure }}</p>
        <p v-if="notSaved" class="warn" role="alert">{{ t.control.notSaved }}</p>
        <template v-if="showSearch">
            <div class="field search-row">
                <input ref="searchInput" v-model="query" type="search" class="search" :placeholder="t.control.search" :aria-label="t.control.search" data-testid="rehearsal-search">
                <button v-if="song" type="button" class="icon" :aria-label="t.control.closeSearch" :title="t.control.closeSearch" @click="closeSearch">
                    <Icon name="close" :size="20" />
                </button>
            </div>
            <p v-if="searching" class="note">{{ t.control.searching }}</p>
            <p v-else-if="searched && !results.length" class="note" data-testid="rehearsal-none">
                {{ t.control.noSong }}
            </p>
            <ul v-if="results.length" class="results" data-testid="rehearsal-results">
                <li v-for="found in results" :key="found.id!">
                    <button type="button" @click="pickSong(found)">
                        {{ found.name }}
                    </button>
                </li>
            </ul>
        </template>
        <template v-if="song && !searchOpen">
            <!-- Title and magnifier in one frame like a search field: it is the title that is searched (user, 2026-11-13); the whole frame opens the search. -->
            <div class="field head" @click="openSearch">
                <h2 class="title" data-testid="rehearsal-title">
                    {{ song.name }}<span v-if="sheet?.key" class="key">{{ sheet.key }}</span>
                </h2>
                <button type="button" class="icon" data-testid="rehearsal-other" :aria-label="t.control.otherSong" :title="t.control.otherSong" @click.stop="openSearch">
                    <Icon name="search" :size="20" />
                </button>
            </div>
            <div v-if="arrangements.length > 1" class="arrangements" role="group" :aria-label="t.control.arrangement">
                <button v-for="(a, i) in arrangements" :key="a.id" type="button" class="pill" :class="{ chosen: a.id === arrangementId }" :aria-pressed="a.id === arrangementId" @click="showArrangement(a.id, null, true)">
                    {{ labels[i] }}
                </button>
            </div>
            <p v-if="sheetLoading" class="note">{{ t.control.rehearsalLoading }}</p>
            <template v-else-if="sheet">
                <ul class="songs" data-testid="rehearsal-song">
                    <ControlSong :title="song.name ?? ''" :song-key="sheet.key" :parts="sheet.sections" open bare :active="section" :disabled="false" @choose="choose" />
                </ul>
                <nav class="steps">
                    <button type="button" :disabled="previous === null" @click="previous !== null && choose(previous)">
                        {{ t.control.back }}
                    </button>
                    <button type="button" :disabled="following === null" @click="following !== null && choose(following)">
                        {{ t.control.next }}
                    </button>
                </nav>
            </template>
            <p v-else class="note" data-testid="rehearsal-nosheet">
                {{ t.control.noRehearsalSheet }}
            </p>
        </template>
        <p v-else-if="!song && !results.length && !searching && !searched" class="note">
            {{ t.control.rehearsalNone }}
        </p>
    </div>
</template>

<style scoped>
.rehearsal {
    display: grid;
    gap: 12px;
}
p {
    margin: 0;
}
.note {
    color: #b8bcc4;
}
.warn {
    padding: 10px 12px;
    border-radius: 8px;
    background: #4a2020;
}
/* One frame for both states – the title with the magnifier, the search with the cross – so the icon keeps its place. */
.field {
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    min-height: 56px;
    padding: 4px 6px 4px 14px;
    border: 1px solid #3a3f4a;
    border-radius: 10px;
    background: #1d2027;
}
.head {
    cursor: pointer;
}
.search {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    outline: none;
}
.field:focus-within {
    border-color: #6b7180;
}
.title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 1.6rem;
    line-height: 1.2;
    overflow-wrap: anywhere;
}
.title .key {
    margin-left: 0.5em;
    color: #b8bcc4;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
}
.arrangements {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
button {
    min-height: 56px;
    padding: 8px 14px;
    border: 1px solid #3a3f4a;
    border-radius: 8px;
    background: #1d2027;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
}
/* Magnifier and cross inside the frame: plain, light, the same size and place. */
.icon {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    min-height: 44px;
    box-sizing: border-box;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: #f1f2f4;
}
.pill {
    min-height: 32px;
    padding: 3px 11px;
    border-radius: 999px;
    background: transparent;
    font-size: 0.8em;
    color: #b8bcc4;
}
.pill.chosen {
    border-color: #e6e8ec;
    color: inherit;
    font-weight: 600;
}
.results {
    gap: 0;
}
.results button {
    width: 100%;
    border: none;
    border-bottom: 1px solid #2a2e36;
    border-radius: 0;
    background: transparent;
}
button.active {
    background: #2f6fed;
    border-color: #6ea8ff;
    font-weight: 600;
}
button:disabled {
    opacity: 0.4;
}
.steps {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    background: #101114;
    border-top: 1px solid #3a3f4a;
}
/* Back and next are what a hand on stage reaches for blind: tall and in big letters, like the page of the service. */
.steps button {
    min-height: 96px;
    font-size: 1.5rem;
    font-weight: 600;
    text-align: center;
}
</style>
