<script setup lang="ts">
/**
 * The song of the rehearsal on the phone page (Plan.md 121, "Proben", 135 C, D): the musicians search a song of the song database in a sheet
 * from below, choose its arrangement and tap its parts. A tap writes the rehearsal choice into the category `steuerung` – one for all rehearsal screens,
 * independent of any event. What another musician chose later is read every few seconds and shown here too.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';
import { stepSection, type RehearsalDoc } from '../agenda/control';
import { REHEARSAL_MAX_AGE_MS, type SongSheet } from '../agenda/songsheet';
import { fetchSong, searchSongs, type SongArrangementResponse, type SongResponse } from '../ct/api';
import { t } from '../i18n/designer';
import { loadArrangementSheet } from '../player/data';
import type { ScreenRepository } from '../store/screen-repository';
import Icon from '../designer/Icon.vue';
import ControlBar from './ControlBar.vue';
import ControlSheet from './ControlSheet.vue';
import ControlSongCard from './ControlSongCard.vue';
import { arrangementLabels } from './arrangement-labels';
import { sectionName } from './song-steps';
import { usePresenterKeys } from '../player/presenter-keys';

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

/** Search, then play (user, 2026-11-13): the search is a sheet from below, so the song and its parts keep the whole page. */
const searchOpen = ref(false);
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
/** A presenter steps like "Zurück" and "Weiter" (Plan.md 124 A) – once a sheet is there; in the search field the keys type. */
const presenter = usePresenterKeys((by) => {
    if (!sheet.value || sheetLoading.value) return;
    const target = by === 1 ? following.value : previous.value;
    if (target !== null) void choose(target);
});

const forwardHint = computed(() => (following.value === null || !sheet.value ? '' : sectionName(sheet.value.sections[following.value], following.value)));
/** At the last part "Vor" stays (Plan.md 124): the song changes by the search. */
const atEnd = computed(() => !!sheet.value && section.value !== null && following.value === null);

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

/** Back to the search, without a song: what "Lied beenden" leaves on this page. */
function clearSong(): void {
    ++loadRun;
    song.value = null;
    arrangementId.value = null;
    sheet.value = null;
    sheetLoading.value = false;
    section.value = null;
    closeSearch();
}

/** "Lied beenden" (user, 2026-11-13): the screens show the QR code again, every phone page the search. */
async function endSong(): Promise<void> {
    clearSong();
    const doc: RehearsalDoc = { kind: 'rehearsal', songId: 0, arrangementId: 0, section: 0, at: new Date().toISOString(), ended: true };
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
    if (doc.ended) {
        // Whoever is typing a search keeps it.
        if (!query.value.trim()) clearSong();
        else song.value = null;
        return;
    }
    if (song.value?.id !== doc.songId) {
        // Whoever is typing a search keeps it open; the song of the other musician shows once it is closed.
        song.value = await fetchSong(doc.songId);
    }
    await showArrangement(doc.arrangementId, doc.section);
}

async function refresh(): Promise<void> {
    const doc = await props.repository.readRehearsal();
    // A choice older than the screens keep it is none here either: the page shows what the screens show (user, 2026-11-13).
    if (doc && Date.parse(doc.at) > appliedAt && Date.now() - Date.parse(doc.at) <= REHEARSAL_MAX_AGE_MS) await adopt(doc);
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
        <ControlSheet v-if="searchOpen" :title="t.control.chooseSong" @close="closeSearch">
            <input ref="searchInput" v-model="query" type="search" class="search" :placeholder="t.control.search" :aria-label="t.control.search" data-testid="rehearsal-search">
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
            <!-- A rare step, so quiet: text only, at the foot of the sheet (user, 2026-11-27). -->
            <template v-if="song" #foot>
                <button type="button" class="end" data-testid="rehearsal-end" @click="endSong">
                    {{ t.control.endSong }}
                </button>
            </template>
        </ControlSheet>
        <template v-if="song">
            <div class="song" :class="{ fill: !!sheet }" data-testid="rehearsal-song">
                <ControlSongCard :title="song.name ?? ''" :song-key="sheet?.key" :parts="sheet?.sections ?? []" :active="section" :disabled="false" :hide-parts="!sheet" @choose="choose">
                    <template #action>
                        <button type="button" class="pick" :aria-label="t.control.chooseSong" data-testid="rehearsal-other" @click="openSearch"><Icon name="search" :size="22" /></button>
                    </template>
                    <template v-if="arrangements.length > 1" #sub>
                        <div class="arrangements" role="group" :aria-label="t.control.arrangement">
                            <button v-for="(a, i) in arrangements" :key="a.id" type="button" class="pill" :class="{ chosen: a.id === arrangementId }" :aria-pressed="a.id === arrangementId" @click="showArrangement(a.id, null, true)">
                                {{ labels[i] }}
                            </button>
                        </div>
                    </template>
                    <template v-if="atEnd && sheet && !sheetLoading" #foot>
                        <p class="note small" data-testid="rehearsal-end-note">{{ t.control.stepEndRehearsal }}</p>
                    </template>
                </ControlSongCard>
            </div>
            <p v-if="sheetLoading" class="note">{{ t.control.rehearsalLoading }}</p>
            <template v-else-if="sheet">
                <!-- In the fixed zone below the middle of the page (Plan.md 135 A). -->
                <Teleport defer to="#control-bar">
                    <ControlBar :back-disabled="previous === null" :forward-disabled="following === null" :hint="forwardHint" @back="previous !== null && choose(previous)" @forward="following !== null && choose(following)" />
                </Teleport>
                <p v-if="presenter" class="note" data-testid="rehearsal-presenter">{{ t.control.presenterDetected }}</p>
            </template>
            <p v-else class="note" data-testid="rehearsal-nosheet">
                {{ t.control.noRehearsalSheet }}
            </p>
        </template>
        <section v-else class="control-card none">
            <p class="note">{{ t.control.rehearsalNone }}</p>
            <button type="button" class="pick words" data-testid="rehearsal-other" @click="openSearch"><Icon name="search" :size="20" />{{ t.control.chooseSong }}</button>
        </section>
    </div>
</template>

<style scoped>
/* The middle is a column: the parts take what is left and roll inside, everything else stands. */
.rehearsal {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.rehearsal > * {
    flex: none;
    min-width: 0;
}
/* The card takes what is left; it may shrink, but not to nothing – the parts must stay in view, the middle rolls before they vanish (user, 2026-11-27). */
.rehearsal > .song {
    display: flex;
    flex-direction: column;
}
.rehearsal > .song.fill {
    flex: 1 1 0;
    min-height: 9rem;
}
p {
    margin: 0;
}
.note {
    color: #b8bcc4;
}
/* The line under the parts: one line, quiet. */
.note.small {
    flex: none;
    font-size: 0.85rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.warn {
    padding: 10px 12px;
    border-radius: 8px;
    background: #4a2020;
}
.none {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}
.end {
    justify-self: center;
    min-height: 44px;
    padding: 0 16px;
    border: 0;
    background: none;
    color: #b8bcc4;
    font: inherit;
    font-size: 0.95rem;
    text-align: center;
    text-decoration: underline;
    cursor: pointer;
}
.search {
    box-sizing: border-box;
    width: 100%;
    min-height: 52px;
    padding: 0 14px;
    border: 1px solid #3a3f4a;
    border-radius: 10px;
    background: #101114;
    color: #f2f2f2;
    font: inherit;
}
.search:focus {
    outline: none;
    border-color: #6b7180;
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
/* The magnifier alone, 44 × 44, in the head of the song card; the words only where no song is chosen yet. */
.pick {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 44px;
    min-height: 44px;
    padding: 0;
    text-align: center;
}
.pick.words {
    width: auto;
    padding: 0 12px;
    font-size: 0.95rem;
}
.arrangements {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
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
    list-style: none;
    margin: 0;
    padding: 0;
}
.results button {
    width: 100%;
    border: none;
    border-bottom: 1px solid #2a2e36;
    border-radius: 0;
    background: transparent;
}
</style>
