<script setup lang="ts">
/**
 * The section "Bildschirm" of the area "Probe" (Plan.md 125 C): the musicians choose a released screen, a released rehearsal presentation
 * and a duration, and the screen shows the presentation until then. Written as an override into the category `steuerung`, read by the
 * player. The list of screens and presentations comes from the catalog in `steuerung` – the musicians may read neither screens nor settings.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { OverrideDoc, RehearsalCatalogDoc } from '../agenda/control';
import { t } from '../i18n/designer';
import { LOCALE } from '../i18n/player';
import { OVERRIDE_MAX_MS } from '../player/schedule';
import type { ScreenRepository } from '../store/screen-repository';
import { controlMemory } from './control-memory';

const props = defineProps<{ repository: ScreenRepository; author: string; timeZone: string }>();

const POLL_MS = 10_000;
const HOUR_MS = 60 * 60 * 1000;
const HOURS = [1, 2, 3];

const catalog = ref<RehearsalCatalogDoc | null>(null);
const overrides = ref<Record<string, OverrideDoc>>({});
const now = ref(Date.now());
const chosenScreen = ref<string | null>(controlMemory.screenId);
const chosenPlaylist = ref<string | null>(null);
const hours = ref(2);
const notSaved = ref(false);
const failure = ref<string | null>(null);
/** While a write runs the buttons rest: two quick taps would otherwise race for the same value (or create two). */
const busy = ref(false);
/** The presentation last chosen per screen on this page – an ended override no longer names one. */
const lastPlaylist: Record<string, string> = {};
let readRun = 0;
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let gone = false;

const screens = computed(() => catalog.value?.screens ?? []);
const playlists = computed(() => catalog.value?.playlists ?? []);

/** Whether the override still holds: not ended and neither past its end nor past the limit from its start. */
function runs(doc: OverrideDoc | undefined): doc is OverrideDoc {
    return !!doc && !doc.ended && now.value < Math.min(Date.parse(doc.until), Date.parse(doc.at) + OVERRIDE_MAX_MS);
}

const runningScreens = computed(() => screens.value.filter((s) => runs(overrides.value[s.id])));
const screen = computed(() => screens.value.find((s) => s.id === chosenScreen.value) ?? runningScreens.value[0] ?? screens.value[0] ?? null);
const running = computed(() => (screen.value && runs(overrides.value[screen.value.id]) ? overrides.value[screen.value.id]! : null));
const playlist = computed(() => {
    const id = chosenPlaylist.value ?? (screen.value ? lastPlaylist[screen.value.id] : undefined) ?? running.value?.playlistId;
    return playlists.value.find((p) => p.id === id) ?? playlists.value[0] ?? null;
});

const time = (ms: number) => new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone: props.timeZone }).format(ms);
const endOf = (doc: OverrideDoc) => Math.min(Date.parse(doc.until), Date.parse(doc.at) + OVERRIDE_MAX_MS);

const summary = computed(() => {
    if (!screens.value.length || !playlists.value.length) return t.control.screenTitle;
    const list = runningScreens.value;
    const text = list.length > 1 ? t.control.screenMany(list.length) : list.length === 1 ? t.control.screenUntil(time(endOf(overrides.value[list[0]!.id]!))) : t.control.screenSchedule;
    return `${t.control.screenTitle} · ${text}`;
});
const runningName = computed(() => (running.value ? (playlists.value.find((p) => p.id === running.value!.playlistId)?.name ?? t.control.overrideOther) : ''));
const endsAt = computed(() => time(now.value + hours.value * HOUR_MS));

function pickScreen(id: string): void {
    chosenScreen.value = id;
    chosenPlaylist.value = null;
    controlMemory.screenId = id;
}

async function refresh(): Promise<void> {
    const run = readRun;
    const read = await props.repository.readRehearsalScreens();
    now.value = Date.now();
    // A write that started or ended since the request started is newer than what it read.
    if (run !== readRun || busy.value) return;
    catalog.value = read.catalog;
    overrides.value = read.overrides;
}

async function write(doc: OverrideDoc): Promise<void> {
    if (busy.value) return;
    if (props.author) doc.by = props.author;
    busy.value = true;
    notSaved.value = false;
    try {
        await props.repository.writeOverride(doc);
    } catch (error) {
        console.warn('Das Überschreiben konnte nicht gespeichert werden:', error);
        notSaved.value = true;
        return;
    } finally {
        ++readRun;
        busy.value = false;
    }
    now.value = Date.now();
    overrides.value = { ...overrides.value, [doc.screenId]: doc };
    try {
        await refresh();
    } catch (e) {
        failure.value = t.control.failed(e instanceof Error ? e.message : null);
    }
}

function show(playlistId: string): Promise<void> {
    const at = new Date();
    const id = screen.value!.id;
    lastPlaylist[id] = playlistId;
    return write({ kind: 'override', screenId: id, playlistId, until: new Date(at.getTime() + hours.value * HOUR_MS).toISOString(), at: at.toISOString() });
}

async function showChosen(): Promise<void> {
    if (screen.value && playlist.value) await show(playlist.value.id);
}

async function extend(): Promise<void> {
    if (running.value) await show(running.value.playlistId);
}

async function end(): Promise<void> {
    if (!screen.value) return;
    const at = new Date().toISOString();
    await write({ kind: 'override', screenId: screen.value.id, playlistId: '', until: at, at, ended: true });
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
    clearTimeout(pollTimer);
});
</script>

<template>
    <details class="screen-box" data-testid="control-screen">
        <summary data-testid="control-screen-summary">{{ summary }}</summary>
        <div class="body">
            <p v-if="failure" class="warn" role="alert">{{ failure }}</p>
            <p v-if="notSaved" class="warn" role="alert">{{ t.control.notSaved }}</p>
            <p v-if="!screens.length" class="note" data-testid="control-screen-none">{{ t.control.screenNoRelease }}</p>
            <p v-else-if="!playlists.length" class="note" data-testid="control-screen-none">{{ t.control.screenNoPlaylist }}</p>
            <template v-else>
                <div v-if="screens.length > 1" class="pills" role="group" :aria-label="t.control.screenChoose">
                    <button v-for="s in screens" :key="s.id" type="button" class="pill" :class="{ chosen: s.id === screen?.id }" :aria-pressed="s.id === screen?.id" @click="pickScreen(s.id)">
                        {{ s.name }}
                    </button>
                </div>
                <p v-else class="name">{{ screens[0]!.name }}</p>
                <template v-if="running">
                    <div data-testid="control-screen-running">
                        <p class="name">{{ t.control.overrideRunning(runningName, time(endOf(running))) }}</p>
                        <p v-if="running.by" class="note">{{ t.control.overrideBy(running.by) }}</p>
                    </div>
                    <p class="small">{{ t.control.overrideServiceNote }}</p>
                </template>
                <div v-else-if="playlists.length > 1" class="pills" role="group" :aria-label="t.control.playlistChoose">
                    <button v-for="p in playlists" :key="p.id" type="button" class="pill" :class="{ chosen: p.id === playlist?.id }" :aria-pressed="p.id === playlist?.id" @click="chosenPlaylist = p.id">
                        {{ p.name }}
                    </button>
                </div>
                <p v-else class="name">{{ playlists[0]!.name }}</p>
                <div class="pills" role="group" :aria-label="t.control.durationChoose">
                    <button v-for="h in HOURS" :key="h" type="button" class="pill" :class="{ chosen: h === hours }" :aria-pressed="h === hours" :data-testid="`control-screen-hours-${h}`" @click="hours = h">
                        {{ t.control.duration(h) }}
                    </button>
                    <span v-if="!running" class="note">{{ t.control.screenEndsAt(endsAt) }}</span>
                </div>
                <div v-if="running" class="actions">
                    <button type="button" :disabled="busy" data-testid="control-screen-extend" @click="extend">{{ t.control.overrideExtend }}</button>
                    <button type="button" :disabled="busy" data-testid="control-screen-end" @click="end">{{ t.control.overrideEnd }}</button>
                </div>
                <button v-else type="button" class="show" :disabled="busy" data-testid="control-screen-show" @click="showChosen">{{ t.control.screenShow }}</button>
            </template>
        </div>
    </details>
</template>

<style scoped>
.screen-box {
    border: 1px solid #3a3f4a;
    border-radius: 10px;
    background: #1d2027;
}
summary {
    display: flex;
    align-items: center;
    min-height: 56px;
    padding: 4px 14px;
    cursor: pointer;
}
.body {
    display: grid;
    gap: 12px;
    padding: 4px 14px 14px;
}
p {
    margin: 0;
}
.name {
    font-weight: 600;
}
.note {
    color: #b8bcc4;
}
.small {
    color: #b8bcc4;
    font-size: 0.85em;
}
.warn {
    padding: 10px 12px;
    border-radius: 8px;
    background: #4a2020;
}
.pills {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}
.actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
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
    text-align: center;
    cursor: pointer;
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
.show {
    background: #2f6fed;
    border-color: #6ea8ff;
    font-weight: 600;
}
</style>
