<script setup lang="ts">
import { computed } from 'vue';
import type { Calendar, PostGroup } from '../ct/api';
import { homepageGroups, selectGroups, type Group, type HomepageEntry } from '../groups/normalize';
import type { Block, Fill, GroupFields, TextStyle } from '../model/schema';
import { bannerShown } from '../player/banner';
import { themeOf, useStageContext } from '../player/context';
import { fontDef, FONTS } from '../player/fonts';
import { sizedImageUrl } from '../player/format';
import { GROUP_SECONDS, PAGE_SECONDS, POST_SECONDS, slideSeconds } from '../player/paging';
import { qrShape } from '../player/qr';
import { webFrame, withScheme } from '../player/web';
import { useEditorStore } from './editor-store';
import ColorField from './ColorField.vue';
import FillEditor from './FillEditor.vue';
import Icon from './Icon.vue';
import { BLOCK_LABELS } from './ops';

const props = defineProps<{ calendars: Calendar[]; groups: PostGroup[]; homepages: HomepageEntry[] }>();
const emit = defineEmits<{ 'pick-image': ['block' | 'background' | 'logo'] }>();

/** Labels in the order of `GroupFields` itself, so the fieldset needs no list of its own (Plan.md 43). */
const GROUP_SHOW_LABELS: Record<keyof GroupFields, string> = {
    name: 'Name',
    image: 'Bild',
    when: 'Wochentag und Uhrzeit',
    targetGroup: 'Zielgruppe',
    category: 'Kategorie',
    note: 'Beschreibung',
    leaders: 'Leitung',
    leaderImages: 'Bild der Leitung',
    places: 'Freie Plätze',
    qr: 'QR-Code zur Gruppenseite',
};
const GROUP_SHOW_KEYS = Object.keys(GROUP_SHOW_LABELS) as (keyof GroupFields)[];

const editor = useEditorStore();
/** The preview's stage context: paged lists report their page count there. */
const stage = useStageContext();
const block = computed(() => editor.block);
const slide = computed(() => editor.slide);
// The designer shows what the TV shows (Plan.md 38): named only while it still runs.
const bannerRunning = computed(() => bannerShown(editor.draft?.playlist.banner, stage.now, stage.timeZone));

/** Field edits are gestures: all keystrokes in one field are one undo step. */
const edit = { onFocus: () => editor.beginGesture(), onBlur: () => editor.endGesture() };

function setBlock(patch: Record<string, unknown>): void {
    if (block.value) editor.updateBlock(block.value.id, patch as Partial<Block>);
}

function setNumber(key: string, value: string): void {
    const n = Number(value);
    if (value !== '' && Number.isFinite(n)) setBlock({ [key]: n });
}

function setStyle(patch: Partial<TextStyle>): void {
    if (block.value && 'style' in block.value) setBlock({ style: { ...block.value.style, ...patch } });
}

function toggleCalendar(id: number, on: boolean): void {
    if (!block.value || !('calendarIds' in block.value)) return;
    const next = on ? [...block.value.calendarIds, id] : block.value.calendarIds.filter((c) => c !== id);
    if (next.length) setBlock({ calendarIds: [...new Set(next)].sort((a, b) => a - b) });
}

/** Empty is allowed here (Plan.md 33): a fresh block starts without a group until one is chosen. */
function togglePostGroup(id: number, on: boolean): void {
    if (!block.value || block.value.type !== 'posts') return;
    const next = on ? [...block.value.groupIds, id] : block.value.groupIds.filter((g) => g !== id);
    setBlock({ groupIds: [...new Set(next)].sort((a, b) => a - b) });
}

/** Between 5 and 120 seconds; anything else waits until the value is sensible. */
function setPostSeconds(value: string): void {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 5 && n <= 120) setBlock({ pageSeconds: n });
}

/** The homepage's groups, from the preview's live data (Plan.md 43) – empty until it has loaded. */
const homepageGroupList = computed<Group[]>(() =>
    block.value && block.value.type === 'groups' ? homepageGroups(stage.groupHomepages, block.value.parentGroupId) : [],
);

/** Whether the preview has the homepage yet – until then a chosen group is not "missing", only not loaded. */
const homepageLoaded = computed(
    () =>
        block.value?.type === 'groups' &&
        (stage.groupHomepages ?? []).some((h) => h.parentGroupId === (block.value as { parentGroupId?: number }).parentGroupId),
);

/**
 * Stored is the parent group's id, not the homepage's own id or hash – a group has at most one
 * homepage, and it survives the homepage being recreated (Plan.md 43, a). A fresh choice starts
 * without a selection: "every group, by weekday" until the designer picks some.
 */
function setGroupsHomepage(value: string): void {
    if (!block.value || block.value.type !== 'groups') return;
    setBlock({ parentGroupId: value === '' ? undefined : Number(value), groupIds: [] });
}

/** Whether the stored parent group's homepage fell out of the list – its groups are gone from the TV (Plan.md 43, g). */
const groupsHomepageMissing = computed(() => {
    if (!block.value || block.value.type !== 'groups' || block.value.parentGroupId === undefined) return false;
    const parentGroupId = block.value.parentGroupId;
    return !props.homepages.some((h) => h.parentGroupId === parentGroupId);
});

/** Empty `groupIds` means "every group, by weekday"; switching it off starts from all of them, in that order. */
function toggleAllGroups(checked: boolean): void {
    if (!block.value || block.value.type !== 'groups') return;
    setBlock({ groupIds: checked ? [] : selectGroups(homepageGroupList.value, []).map((g) => g.id) });
}

/** Adds or removes a group from the explicit choice; order is preserved, new ones join at the end. */
function toggleGroupPick(id: number, on: boolean): void {
    if (!block.value || block.value.type !== 'groups') return;
    const next = on ? [...block.value.groupIds, id] : block.value.groupIds.filter((g) => g !== id);
    setBlock({ groupIds: next });
}

function removeGroupId(id: number): void {
    if (!block.value || block.value.type !== 'groups') return;
    setBlock({ groupIds: block.value.groupIds.filter((g) => g !== id) });
}

function moveGroupId(index: number, target: number): void {
    if (!block.value || block.value.type !== 'groups' || target < 0 || target >= block.value.groupIds.length) return;
    const ids = [...block.value.groupIds];
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setBlock({ groupIds: ids });
}

/** The homepage's groups not yet chosen, in the homepage's own order (Plan.md 43). */
const pickableGroupList = computed(() => {
    if (!block.value || block.value.type !== 'groups') return [] as Group[];
    const chosen = new Set(block.value.groupIds);
    return homepageGroupList.value.filter((g) => !chosen.has(g.id));
});

/** Between 5 and 120 seconds, like the posts block's. */
function setGroupSeconds(value: string): void {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 5 && n <= 120) setBlock({ pageSeconds: n });
}

/** Seconds the slide really runs when a paged list needs longer than its duration; else 0. */
const runsLonger = computed(() => {
    if (!slide.value) return 0;
    const seconds = slideSeconds(slide.value, stage.pages ?? {});
    return seconds > slide.value.durationSeconds ? seconds : 0;
});

/** Between 3 and 120 seconds; anything else waits until the value is sensible, like the duration field. */
function setPageSeconds(value: string): void {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 3 && n <= 120) setBlock({ pageSeconds: n });
}

/** How a paged list will run – with the page count the stage preview measured. */
function pageHint(list: Extract<Block, { type: 'appointment-list' }>): string {
    const pages = stage.pages?.[list.id] ?? 1;
    if (pages < 2) return 'Alle Termine passen auf eine Seite.';
    const perPage = list.pageSeconds ?? PAGE_SECONDS;
    const needed = pages * perPage;
    const duration = slide.value?.durationSeconds ?? 0;
    return needed > duration
        ? `Ergibt ${pages} Seiten à ${perPage} s – die Slide läuft dafür ${needed} s statt ${duration} s.`
        : `Ergibt ${pages} Seiten, je ${Math.round(duration / pages)} s.`;
}

/** '' follows the theme (Plan.md, 27): the block then changes with it. */
function setLayout(value: string): void {
    setBlock({ layout: value || undefined });
}

/** The theme's layout in words, for the option that follows it. */
const themeLayout = computed(() => (themeOf(stage).appointments === 'large' ? 'modern' : 'nativ'));

/** Why an address is not shown – or null when it is. */
function webProblem(url: string): string | null {
    if (!url.trim()) return 'Noch keine Adresse – der Baustein bleibt leer.';
    return webFrame(url, window.location.origin) ? null : 'Nur Adressen mit https:// werden gezeigt.';
}

function setSlideNumber(value: string): void {
    const n = Number(value);
    if (n >= 1 && n <= 3600) editor.updateSlide({ durationSeconds: n });
}

function mediaUrl(id: string | undefined, fit: 'crop' | 'max' = 'crop'): string | null {
    const media = id ? editor.media.find((m) => m.id === id) : undefined;
    return media ? sizedImageUrl(media.imageUrl, 272, 153, fit) : null;
}

function setBackgroundKind(kind: string): void {
    if (kind === 'media') emit('pick-image', 'background');
    else editor.updateSlide({ background: slideFill.value });
}

const slideFill = computed<Fill>(() =>
    slide.value && slide.value.background.kind !== 'media' ? slide.value.background : { kind: 'solid', color: '#000000' },
);

</script>

<template>
    <aside class="inspector">
        <!-- Block -->
        <section v-if="block" data-testid="block-inspector">
            <div class="block-head">
                <h3>{{ BLOCK_LABELS[block.type] }}</h3>
                <!-- Plan.md, 25: locked, the whole block stays as it is until unlocked. -->
                <button
                    class="d-btn lock-toggle"
                    :class="{ 'lock-toggle--on': block.locked }"
                    type="button"
                    :aria-pressed="!!block.locked"
                    :title="block.locked ? 'Entsperren, um den Baustein wieder zu bearbeiten' : 'Sperren: nicht mehr verschieben, ändern oder löschen'"
                    data-testid="lock-toggle"
                    @click="editor.setLocked(block.id, !block.locked)"
                >
                    <Icon :name="block.locked ? 'lock' : 'unlock'" :size="16" />
                    {{ block.locked ? 'Gesperrt' : 'Sperren' }}
                </button>
            </div>
            <p v-if="block.locked" class="hint" data-testid="locked-hint">
                Gesperrt: Der Baustein lässt sich nicht verschieben, ändern oder löschen, bis du ihn entsperrst.
            </p>
            <!-- A disabled fieldset disables every field and button inside it at once. -->
            <fieldset class="lockable" :disabled="!!block.locked">
                <div class="grid4">
                    <label v-for="key in ['x', 'y', 'width', 'height'] as const" :key="key" class="d-field">
                        {{ { x: 'X', y: 'Y', width: 'Breite', height: 'Höhe' }[key] }}
                        <input
                            type="number"
                            :value="block[key]"
                            :data-testid="`inspector-${key}`"
                            v-on="edit"
                            @input="setNumber(key, ($event.target as HTMLInputElement).value)"
                        >
                    </label>
                </div>

                <label v-if="block.type === 'text'" class="d-field">
                    Text
                    <textarea
                        rows="3"
                        :value="block.text"
                        data-testid="text-input"
                        v-on="edit"
                        @input="setBlock({ text: ($event.target as HTMLTextAreaElement).value })"
                    />
                </label>

                <template v-if="block.type === 'shape'">
                    <FillEditor
                        :model-value="block.fill"
                        @focus="edit.onFocus"
                        @blur="edit.onBlur"
                        @update:model-value="setBlock({ fill: $event })"
                    />
                    <label class="d-field">
                        Ecken abrunden (px)
                        <input
                            type="number"
                            min="0"
                            :value="block.cornerRadius"
                            v-on="edit"
                            @input="setNumber('cornerRadius', ($event.target as HTMLInputElement).value)"
                        >
                    </label>
                </template>

                <template v-if="block.type === 'image'">
                    <div class="media-pick">
                        <img v-if="mediaUrl(block.mediaId)" :src="mediaUrl(block.mediaId)!" alt="">
                        <p v-else class="hint">Noch kein Bild gewählt.</p>
                        <button class="d-btn" type="button" data-testid="pick-image" @click="emit('pick-image', 'block')">
                            Bild wählen …
                        </button>
                    </div>
                    <label class="d-field">
                        Einpassen
                        <select :value="block.fit" @change="setBlock({ fit: ($event.target as HTMLSelectElement).value })">
                            <option value="contain">Ganz zeigen</option>
                            <option value="cover">Fläche füllen</option>
                        </select>
                    </label>
                </template>

                <label v-if="block.type === 'clock'" class="d-field">
                    Anzeige
                    <select :value="block.format" @change="setBlock({ format: ($event.target as HTMLSelectElement).value })">
                        <option value="time">Uhrzeit</option>
                        <option value="date">Datum</option>
                        <option value="datetime">Datum und Uhrzeit</option>
                    </select>
                </label>

                <fieldset v-if="'calendarIds' in block">
                    <legend>Kalender</legend>
                    <label v-for="c in calendars" :key="c.id" class="check">
                        <input
                            type="checkbox"
                            :checked="block.calendarIds.includes(c.id)"
                            @change="toggleCalendar(c.id, ($event.target as HTMLInputElement).checked)"
                        >
                        <span class="swatch" :style="{ background: c.color ?? 'transparent' }" />
                        {{ c.name }}
                    </label>
                    <p v-if="!calendars.length" class="hint">Keine Kalender sichtbar.</p>
                </fieldset>

                <!-- Plan.md, 32: the time until the next appointment of these calendars. -->
                <template v-if="block.type === 'countdown'">
                    <label class="check">
                        <input
                            type="checkbox"
                            :checked="block.showTitle"
                            data-testid="countdown-title"
                            @change="setBlock({ showTitle: ($event.target as HTMLInputElement).checked })"
                        >
                        Titel des Termins zeigen
                    </label>
                    <label class="d-field">
                        Während des Termins
                        <input
                            type="text"
                            maxlength="200"
                            :value="block.runningText"
                            placeholder="leer: zum nächsten Termin zählen"
                            data-testid="countdown-running-text"
                            v-on="edit"
                            @input="setBlock({ runningText: ($event.target as HTMLInputElement).value })"
                        >
                    </label>
                    <p class="hint">
                        Zählt bis zum Beginn des nächsten Termins dieser Kalender; ganztägige Termine zählen nicht mit.
                        Passt gut auf eine Playlist, die ein Zeitplan „30 Minuten vor Beginn“ einschaltet.
                    </p>
                </template>

                <template v-if="block.type === 'appointment-list' || block.type === 'next-appointment'">
                    <!-- Plan.md, 20: the look of the WordPress plugin's list and highlighted event. -->
                    <label class="d-field">
                        Darstellung
                        <select
                            v-if="block.type === 'appointment-list'"
                            :value="block.layout ?? ''"
                            data-testid="list-layout"
                            @change="setLayout(($event.target as HTMLSelectElement).value)"
                        >
                            <option value="">Wie im Design ({{ themeLayout }})</option>
                            <option value="rows">Zeilen – Datum, Uhrzeit, Titel</option>
                            <option value="cards">Karten – Datumskachel, Datum über Uhrzeit, Titel, Kategorie rechts</option>
                        </select>
                        <select
                            v-else
                            :value="block.layout ?? ''"
                            data-testid="next-layout"
                            @change="setLayout(($event.target as HTMLSelectElement).value)"
                        >
                            <option value="">Wie im Design ({{ themeLayout }})</option>
                            <option value="classic">Schlicht</option>
                            <option value="card">Hervorgehoben – Karte mit Beschreibung und Ort</option>
                        </select>
                    </label>
                    <template v-if="block.type === 'appointment-list'">
                        <div class="grid2">
                            <label class="d-field">
                                Tage voraus
                                <input
                                    type="number"
                                    min="1"
                                    max="366"
                                    :value="block.horizonDays"
                                    v-on="edit"
                                    @input="setNumber('horizonDays', ($event.target as HTMLInputElement).value)"
                                >
                            </label>
                            <label v-if="!block.showAll" class="d-field">
                                Höchstens
                                <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    :value="block.limit"
                                    v-on="edit"
                                    @input="setNumber('limit', ($event.target as HTMLInputElement).value)"
                                >
                            </label>
                            <label v-else class="d-field">
                                Sekunden je Seite
                                <input
                                    type="number"
                                    min="3"
                                    max="120"
                                    :value="block.pageSeconds ?? PAGE_SECONDS"
                                    data-testid="page-seconds"
                                    v-on="edit"
                                    @input="setPageSeconds(($event.target as HTMLInputElement).value)"
                                >
                            </label>
                        </div>
                        <!-- Plan.md, 23: every appointment of the horizon, page by page. -->
                        <label class="check">
                            <input
                                type="checkbox"
                                :checked="block.showAll ?? false"
                                data-testid="show-all"
                                @change="setBlock({ showAll: ($event.target as HTMLInputElement).checked })"
                            >
                            Alle Termine zeigen, seitenweise
                        </label>
                        <p v-if="block.showAll" class="hint" data-testid="page-hint">{{ pageHint(block) }}</p>
                    </template>
                    <label v-else class="check">
                        <input
                            type="checkbox"
                            :checked="block.showImage"
                            @change="setBlock({ showImage: ($event.target as HTMLInputElement).checked })"
                        >
                        Terminbild zeigen
                    </label>
                </template>

                <!-- Plan.md, 33: posts of ChurchTools groups, after the terminlists' cards. -->
                <template v-if="block.type === 'posts'">
                    <fieldset>
                        <legend>Gruppen</legend>
                        <label v-for="g in groups" :key="g.id" class="check">
                            <input
                                type="checkbox"
                                :checked="block.groupIds.includes(g.id)"
                                :data-testid="`post-group-${g.id}`"
                                @change="togglePostGroup(g.id, ($event.target as HTMLInputElement).checked)"
                            >
                            {{ g.name }}
                            <span v-if="g.visibility !== 'public'" class="dimmed">nicht öffentlich</span>
                        </label>
                        <p v-if="!groups.length" class="hint">Keine Gruppe mit Beiträgen sichtbar.</p>
                    </fieldset>
                    <p
                        v-if="block.groupIds.some((id) => groups.find((g) => g.id === id)?.visibility !== 'public')"
                        class="hint"
                        data-testid="posts-not-public"
                    >
                        Der Fernseher zeigt nur Beiträge öffentlicher Gruppen. Die Vorschau hier zeigt mehr, weil sie mit
                        deinen Rechten liest.
                    </p>
                    <label class="d-field">
                        Darstellung
                        <select
                            :value="block.layout"
                            data-testid="posts-layout"
                            @change="setBlock({ layout: ($event.target as HTMLSelectElement).value })"
                        >
                            <option value="card">Hervorgehoben – ein Beitrag nach dem anderen</option>
                            <option value="list">Liste – mehrere untereinander</option>
                        </select>
                    </label>
                    <div class="grid2">
                        <label class="d-field">
                            Anzahl
                            <input
                                type="number"
                                min="1"
                                max="10"
                                :value="block.limit"
                                v-on="edit"
                                @input="setNumber('limit', ($event.target as HTMLInputElement).value)"
                            >
                        </label>
                        <label class="d-field">
                            Nur der letzten … Tage
                            <input
                                type="number"
                                min="1"
                                max="365"
                                :value="block.maxAgeDays"
                                v-on="edit"
                                @input="setNumber('maxAgeDays', ($event.target as HTMLInputElement).value)"
                            >
                        </label>
                    </div>
                    <label v-if="block.layout === 'card'" class="d-field">
                        Sekunden je Beitrag
                        <input
                            type="number"
                            min="5"
                            max="120"
                            :value="block.pageSeconds ?? POST_SECONDS"
                            data-testid="post-seconds"
                            v-on="edit"
                            @input="setPostSeconds(($event.target as HTMLInputElement).value)"
                        >
                    </label>
                    <label class="check">
                        <input
                            type="checkbox"
                            :checked="block.showImage"
                            @change="setBlock({ showImage: ($event.target as HTMLInputElement).checked })"
                        >
                        Bild zeigen
                    </label>
                    <label class="check">
                        <input
                            type="checkbox"
                            :checked="block.showAuthor"
                            @change="setBlock({ showAuthor: ($event.target as HTMLInputElement).checked })"
                        >
                        Namen der Autorin oder des Autors zeigen
                    </label>
                    <p class="hint">Zeigt die neuesten Beiträge der gewählten Gruppen; abgelaufene nie.</p>
                </template>

                <!-- Plan.md, 43: groups of a ChurchTools group homepage, one at a time with a QR code or as a list. -->
                <template v-if="block.type === 'groups'">
                    <label class="d-field">
                        Gruppen-Homepage
                        <select
                            :value="block.parentGroupId ?? ''"
                            data-testid="groups-homepage"
                            @change="setGroupsHomepage(($event.target as HTMLSelectElement).value)"
                        >
                            <option value="">– wählen –</option>
                            <option v-for="h in homepages" :key="h.parentGroupId" :value="h.parentGroupId">{{ h.title }}</option>
                            <option v-if="groupsHomepageMissing" :value="block.parentGroupId">
                                (nicht mehr vorhanden)
                            </option>
                        </select>
                    </label>
                    <p v-if="!homepages.length" class="hint">
                        Noch keine Gruppen-Homepage. In ChurchTools die Obergruppe öffnen, dann Einstellungen →
                        Allgemein → Außendarstellung → „Gruppenhomepage erstellen".
                    </p>

                    <label class="check">
                        <input
                            type="checkbox"
                            :checked="block.groupIds.length === 0"
                            :disabled="block.groupIds.length === 0 && homepageGroupList.length === 0"
                            data-testid="groups-all"
                            @change="toggleAllGroups(($event.target as HTMLInputElement).checked)"
                        >
                        Alle Gruppen der Homepage, nach Wochentag
                    </label>

                    <fieldset v-if="block.groupIds.length">
                        <legend>Gruppen</legend>
                        <div v-for="(id, index) in block.groupIds" :key="id" class="group-row">
                            <template v-if="homepageGroupList.find((g) => g.id === id)">
                                <label class="check">
                                    <input
                                        type="checkbox"
                                        checked
                                        :disabled="block.groupIds.length === 1"
                                        @change="toggleGroupPick(id, ($event.target as HTMLInputElement).checked)"
                                    >
                                    {{ homepageGroupList.find((g) => g.id === id)!.name }}
                                </label>
                                <span class="spacer" />
                                <button
                                    class="d-btn d-btn--icon"
                                    type="button"
                                    aria-label="Nach oben"
                                    title="Nach oben"
                                    :disabled="index === 0"
                                    :data-testid="`group-up-${id}`"
                                    @click="moveGroupId(index, index - 1)"
                                >
                                    ↑
                                </button>
                                <button
                                    class="d-btn d-btn--icon"
                                    type="button"
                                    aria-label="Nach unten"
                                    title="Nach unten"
                                    :disabled="index === block.groupIds.length - 1"
                                    :data-testid="`group-down-${id}`"
                                    @click="moveGroupId(index, index + 1)"
                                >
                                    ↓
                                </button>
                            </template>
                            <span v-else-if="!homepageLoaded" class="dimmed">Gruppe {{ id }}</span>
                            <template v-else>
                                <span class="dimmed">Gruppe {{ id }} – nicht mehr auf der Homepage</span>
                                <span class="spacer" />
                                <button class="d-btn" type="button" :data-testid="`group-missing-${id}`" @click="removeGroupId(id)">
                                    Entfernen
                                </button>
                            </template>
                        </div>
                        <label v-for="g in pickableGroupList" :key="g.id" class="check">
                            <input
                                type="checkbox"
                                :data-testid="`group-pick-${g.id}`"
                                @change="toggleGroupPick(g.id, ($event.target as HTMLInputElement).checked)"
                            >
                            {{ g.name }}
                        </label>
                    </fieldset>

                    <label class="d-field">
                        Darstellung
                        <select
                            :value="block.layout"
                            data-testid="groups-layout"
                            @change="setBlock({ layout: ($event.target as HTMLSelectElement).value })"
                        >
                            <option value="card">Hervorgehoben – eine Gruppe nach der anderen</option>
                            <option value="list">Liste – mehrere untereinander</option>
                        </select>
                    </label>
                    <label v-if="block.layout === 'card'" class="d-field">
                        Gruppen je Seite
                        <select
                            :value="block.perPage"
                            data-testid="groups-per-page"
                            @change="setBlock({ perPage: Number(($event.target as HTMLSelectElement).value) })"
                        >
                            <option v-for="n in 4" :key="n" :value="n">{{ n }}</option>
                        </select>
                    </label>
                    <p v-if="block.layout === 'card' && block.perPage > 1" class="hint">
                        {{ block.width >= block.height ? 'Nebeneinander' : 'Untereinander' }}; jede Karte richtet sich nach
                        ihrer eigenen Form – zwei in einem breiten Baustein stehen hochkant.
                    </p>
                    <label class="d-field">
                        {{ block.layout === 'card' && block.perPage === 1 ? 'Sekunden je Gruppe' : 'Sekunden je Seite' }}
                        <input
                            type="number"
                            min="5"
                            max="120"
                            :value="block.pageSeconds ?? GROUP_SECONDS"
                            data-testid="group-seconds"
                            v-on="edit"
                            @input="setGroupSeconds(($event.target as HTMLInputElement).value)"
                        >
                    </label>

                    <fieldset>
                        <legend>Angaben</legend>
                        <label v-for="key in GROUP_SHOW_KEYS" :key="key" class="check">
                            <input
                                type="checkbox"
                                :checked="block.show[key]"
                                :disabled="(block.layout === 'list' && (key === 'note' || key === 'qr' || key === 'leaderImages')) || (key === 'leaderImages' && !block.show.leaders)"
                                :data-testid="`group-show-${key}`"
                                @change="setBlock({ show: { ...block.show, [key]: ($event.target as HTMLInputElement).checked } })"
                            >
                            {{ GROUP_SHOW_LABELS[key] }}
                        </label>
                        <p v-if="block.layout === 'list'" class="hint">
                            Beschreibung und QR-Code nur in der Darstellung „Hervorgehoben".
                        </p>
                    </fieldset>
                    <p v-if="block.show.leaders" class="hint">
                        Namen erscheinen nur, wenn die Gruppen-Homepage in ChurchTools die Leiter zeigt – dann sind sie
                        ohnehin öffentlich.
                    </p>
                    <p class="hint">
                        Zeigt nur Gruppen, die ChurchTools auf der Homepage öffentlich zeigt – mit und ohne Anmeldung
                        dieselben.
                    </p>
                </template>

                <template v-if="block.type === 'church-header'">
                    <label class="check">
                        <input
                            type="checkbox"
                            :checked="block.showName"
                            @change="setBlock({ showName: ($event.target as HTMLInputElement).checked })"
                        >
                        Gemeindenamen zeigen
                    </label>
                    <label class="check">
                        <input
                            type="checkbox"
                            data-testid="show-logo"
                            :checked="block.showLogo"
                            @change="setBlock({ showLogo: ($event.target as HTMLInputElement).checked })"
                        >
                        Logo zeigen
                    </label>
                    <div v-if="block.showLogo" class="media-pick">
                        <img v-if="mediaUrl(block.logoMediaId, 'max')" class="logo-preview" :src="mediaUrl(block.logoMediaId, 'max')!" alt="">
                        <p v-else class="hint">Das Logo aus den Gemeindeinfos von ChurchTools.</p>
                        <button class="d-btn" type="button" data-testid="pick-logo" @click="emit('pick-image', 'logo')">
                            Eigenes Logo wählen …
                        </button>
                        <button
                            v-if="block.logoMediaId"
                            class="d-btn"
                            type="button"
                            data-testid="reset-logo"
                            @click="setBlock({ logoMediaId: undefined })"
                        >
                            Logo aus ChurchTools verwenden
                        </button>
                        <p class="hint">Ein eigenes Logo hilft, wenn das aus ChurchTools auf dem Hintergrund nicht zu sehen ist.</p>
                    </div>
                </template>

                <!-- Plan.md, 28: another website in a frame – a page of the church website, a widget. -->
                <template v-if="block.type === 'web'">
                    <label class="d-field">
                        Adresse
                        <input
                            type="text"
                            inputmode="url"
                            :value="block.url"
                            data-testid="web-url"
                            v-on="edit"
                            @change="setBlock({ url: withScheme(($event.target as HTMLInputElement).value) })"
                        >
                    </label>
                    <p class="hint" data-testid="web-enter-hint">Mit Enter übernehmen – erst dann lädt die Seite.</p>
                    <p v-if="webProblem(block.url)" class="hint" data-testid="web-problem">{{ webProblem(block.url) }}</p>
                    <label class="d-field">
                        Größe der Seite
                        <select :value="block.zoom" data-testid="web-zoom" @change="setNumber('zoom', ($event.target as HTMLSelectElement).value)">
                            <option :value="0.5">50 % – mehr passt hinein</option>
                            <option :value="0.75">75 %</option>
                            <option :value="1">100 %</option>
                            <option :value="1.5">150 %</option>
                            <option :value="2">200 % – für Seiten, die fürs Handy gemacht sind</option>
                            <option :value="3">300 %</option>
                        </select>
                    </label>
                    <p class="hint">
                        Die Seite wird nur gezeigt, nicht bedient. Ohne Netz bleibt der Rahmen leer. Viele große Seiten wie
                        Google verbieten das Einbetten – der Rahmen zeigt dann einen Fehler. Eigene Seiten, etwa die der
                        Gemeinde-Website, gehen meist.
                    </p>
                </template>

                <template v-if="block.type === 'qr'">
                    <label class="d-field">
                        Inhalt – meist eine Adresse
                        <input
                            type="text"
                            placeholder="https://…"
                            maxlength="1000"
                            :value="block.data"
                            data-testid="qr-data"
                            v-on="edit"
                            @input="setBlock({ data: ($event.target as HTMLInputElement).value })"
                        >
                    </label>
                    <p v-if="block.data.trim() && !qrShape(block.data)" class="hint">Zu lang für einen QR-Code.</p>
                    <div class="grid2">
                        <ColorField
                            label="Farbe"
                            :model-value="block.color"
                            @focus="edit.onFocus"
                            @blur="edit.onBlur"
                            @update:model-value="setBlock({ color: $event })"
                        />
                        <ColorField
                            label="Hintergrund"
                            :model-value="block.background"
                            @focus="edit.onFocus"
                            @blur="edit.onBlur"
                            @update:model-value="setBlock({ background: $event })"
                        />
                    </div>
                    <p class="hint">Dunkel auf hell lesen alle Handykameras am sichersten.</p>
                </template>

                <fieldset v-if="'style' in block">
                    <legend>Schrift</legend>
                    <div class="grid2">
                        <label class="d-field wide">
                            Schriftart
                            <select
                                data-testid="font-family"
                                :value="fontDef(block.style.fontFamily).key"
                                @change="setStyle({ fontFamily: ($event.target as HTMLSelectElement).value })"
                            >
                                <option v-for="f in FONTS" :key="f.key" :value="f.key" :style="{ fontFamily: `'${f.family}'` }">
                                    {{ f.label }}
                                </option>
                            </select>
                        </label>
                        <label class="d-field">
                            Größe (px)
                            <input
                                type="number"
                                min="8"
                                :value="block.style.fontSize"
                                v-on="edit"
                                @input="
                                    Number(($event.target as HTMLInputElement).value) >= 1 &&
                                        setStyle({ fontSize: Number(($event.target as HTMLInputElement).value) })
                                "
                            >
                        </label>
                        <label class="d-field">
                            Stärke
                            <select
                                :value="block.style.fontWeight"
                                @change="setStyle({ fontWeight: Number(($event.target as HTMLSelectElement).value) as 400 })"
                            >
                                <option :value="400">Normal</option>
                                <option :value="600">Halbfett</option>
                                <option :value="700">Fett</option>
                            </select>
                        </label>
                        <ColorField
                            label="Farbe"
                            testid="text-color"
                            :model-value="block.style.color"
                            @focus="edit.onFocus"
                            @blur="edit.onBlur"
                            @update:model-value="setStyle({ color: $event })"
                        />
                    </div>
                    <label class="d-field">
                        Ausrichtung
                        <select
                            :value="block.style.align"
                            @change="setStyle({ align: ($event.target as HTMLSelectElement).value as 'left' })"
                        >
                            <option value="left">Links</option>
                            <option value="center">Mittig</option>
                            <option value="right">Rechts</option>
                        </select>
                    </label>
                </fieldset>

                <fieldset>
                    <legend>Ebene</legend>
                    <div class="buttons">
                        <button class="d-btn" type="button" @click="editor.layerBlock(block.id, 'front')">Ganz nach vorn</button>
                        <button class="d-btn" type="button" @click="editor.layerBlock(block.id, 'forward')">Eins vor</button>
                        <button class="d-btn" type="button" @click="editor.layerBlock(block.id, 'backward')">Eins zurück</button>
                        <button class="d-btn" type="button" @click="editor.layerBlock(block.id, 'back')">Ganz nach hinten</button>
                    </div>
                </fieldset>
                <button class="d-btn d-btn--danger" type="button" @click="editor.removeBlock(block.id)">Block löschen</button>
            </fieldset>
        </section>

        <!-- Slide and screen -->
        <template v-else>
            <section v-if="slide" data-testid="slide-inspector">
                <h3>Slide</h3>
                <label class="d-field">
                    Name
                    <input
                        type="text"
                        maxlength="100"
                        :value="slide.name"
                        v-on="edit"
                        @input="editor.updateSlide({ name: ($event.target as HTMLInputElement).value })"
                    >
                </label>
                <div class="grid2">
                    <label class="d-field">
                        Anzeigedauer (s)
                        <input
                            type="number"
                            min="1"
                            max="3600"
                            :value="slide.durationSeconds"
                            data-testid="duration-input"
                            v-on="edit"
                            @input="setSlideNumber(($event.target as HTMLInputElement).value)"
                        >
                    </label>
                    <label class="check check--inline">
                        <input
                            type="checkbox"
                            :checked="slide.enabled"
                            @change="editor.updateSlide({ enabled: ($event.target as HTMLInputElement).checked })"
                        >
                        Wird gezeigt
                    </label>
                </div>
                <p v-if="runsLonger" class="hint" data-testid="duration-hint">
                    Läuft {{ runsLonger }} s – so lange braucht die Terminliste für alle Seiten.
                </p>
                <fieldset>
                    <legend>Hintergrund</legend>
                    <label class="d-field">
                        Hintergrund aus
                        <select
                            :value="slide.background.kind === 'media' ? 'media' : 'fill'"
                            data-testid="background-kind"
                            @change="setBackgroundKind(($event.target as HTMLSelectElement).value)"
                        >
                            <option value="fill">Farbe oder Verlauf</option>
                            <option value="media">Bild</option>
                        </select>
                    </label>
                    <div v-if="slide.background.kind === 'media'" class="media-pick">
                        <img v-if="mediaUrl(slide.background.mediaId)" :src="mediaUrl(slide.background.mediaId)!" alt="">
                        <button class="d-btn" type="button" @click="emit('pick-image', 'background')">Anderes Bild …</button>
                    </div>
                    <FillEditor
                        v-else
                        :model-value="slideFill"
                        @focus="edit.onFocus"
                        @blur="edit.onBlur"
                        @update:model-value="editor.updateSlide({ background: $event })"
                    />
                </fieldset>
            </section>

            <!-- The playlist is the designers' own (schema 1.4); where it runs, the screens' schedules decide. -->
            <section v-if="editor.draft" data-testid="playlist-info">
                <h3>Playlist</h3>
                <label class="d-field">
                    Name
                    <input
                        type="text"
                        maxlength="100"
                        :value="editor.draft.playlist.name"
                        data-testid="playlist-name-input"
                        v-on="edit"
                        @input="editor.renamePlaylist(($event.target as HTMLInputElement).value)"
                    >
                </label>
                <dl>
                    <dt>Format</dt>
                    <dd>
                        {{ editor.stage.height > editor.stage.width ? 'Hochkant' : 'Quer' }},
                        {{ editor.stage.width }} × {{ editor.stage.height }} px
                    </dd>
                    <dt>Läuft auf</dt>
                    <dd data-testid="playlist-screens">
                        {{ editor.screens.length ? editor.screens.map((s) => s.name).join(', ') : 'noch keinem Screen' }}
                    </dd>
                </dl>
                <p class="hint">
                    Auf welchem Screen sie wann läuft, legt der Zeitplan des Screens fest – unter „Zeitpläne" oder an der
                    Kachel des Screens. Speichern ändert alle Screens, die sie zeigen.
                </p>
                <p v-if="bannerRunning" class="hint" data-testid="banner-status">
                    Hinweisband: „{{ editor.draft.playlist.banner!.text }}" – bearbeiten unter
                    <RouterLink :to="{ name: 'notices' }">Hinweise</RouterLink>
                </p>
                <p v-else class="hint" data-testid="banner-status">
                    Kein Hinweisband – anlegen unter <RouterLink :to="{ name: 'notices' }">Hinweise</RouterLink>
                </p>
            </section>
        </template>
    </aside>
</template>

<style scoped>
.inspector {
    overflow-y: auto;
    min-height: 0;
    padding: 12px 14px 24px;
    border-left: 1px solid var(--d-divider);
    background: var(--d-surface);
}
/* Phone: in the editor's sheet now (Plan.md 44, M4) – it owns the border and the max-height. */
@media (max-width: 48rem) {
    .inspector {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        /* The sheet scrolls up and down only; the fields follow the width of the phone (Plan.md 44). */
        overflow-x: hidden;
        border-left: 0;
    }
}
section + section {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--d-divider);
}
section {
    display: grid;
    gap: 10px;
}
h3 {
    margin: 0;
    font-size: 1.05em;
}
fieldset {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 8px 10px 10px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
}
legend {
    padding: 0 4px;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    align-items: end;
}
.grid2 .wide {
    grid-column: 1 / -1;
}
.grid4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
}
.check {
    display: flex;
    align-items: center;
    gap: 6px;
}
.check--inline {
    padding-bottom: 0.4em;
}
/* A chosen group with its reorder buttons, or a missing one with "Entfernen" (Plan.md 43). */
.group-row {
    display: flex;
    align-items: center;
    gap: 6px;
}
.group-row .check {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.spacer {
    flex: 1;
}
.swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid var(--d-divider);
}
.buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
}
.buttons .d-btn {
    justify-content: center;
    font-size: var(--d-size-sm);
}
.media-pick {
    display: grid;
    gap: 6px;
}
.media-pick img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: var(--d-radius);
    background: var(--d-panel);
}
/* A logo is shown whole; the checkerboard makes white and black logos visible alike. */
.media-pick img.logo-preview {
    object-fit: contain;
    background: repeating-conic-gradient(var(--d-panel) 0 25%, var(--d-interactive) 0 50%) 0 0 / 16px 16px;
}
.invalid {
    color: var(--d-danger);
    font-size: var(--d-size-sm);
}
.block-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.lock-toggle {
    gap: 4px;
    font-size: var(--d-size-sm);
}
.lock-toggle--on {
    border-color: var(--d-accent);
    background: var(--d-accent-pale);
    color: var(--d-accent-strong);
}
/* Only a container: the fieldset exists to switch all fields off at once. */
.lockable {
    display: grid;
    gap: inherit;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
}
.lockable:disabled {
    opacity: 0.55;
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.dimmed {
    margin-left: 4px;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin: 0;
    font-size: var(--d-size-sm);
}
dt {
    color: var(--d-text-muted);
}
dd {
    margin: 0;
}
</style>
