<script setup lang="ts">
import { computed, ref } from 'vue';
import { PUBLIC_CALENDAR_PATH, type Calendar, type PostGroup } from '../ct/api';
import { homepageGroups, selectGroups, type Group, type HomepageEntry } from '../groups/normalize';
import type { Block, Fill, GroupFields, RoomEntry, TextStyle } from '../model/schema';
import { bannerShown } from '../player/banner';
import { themeOf, useStageContext } from '../player/context';
import { fontDef, FONTS } from '../player/fonts';
import { calendarColor, sizedImageUrl, verticalAlignOf } from '../player/format';
import { GROUP_SECONDS, PAGE_SECONDS, POST_SECONDS, slideSeconds } from '../player/paging';
import { qrShape } from '../player/qr';
import { listLayout } from '../player/theme';
import { pruneRoomsOff, toggleRoomsOff } from '../appointments/rooms';
import { allowedServiceIds, SERVICES_MAX, toggleServiceIds, type ServiceInfo } from '../appointments/services';
import type { RoomInfo } from '../rooms/normalize';
import { effectiveMotion, effectiveTransition } from '../player/slideshow';
import { embedAddress, webRefusal, withScheme } from '../player/web';
import { useEditorStore } from './editor-store';
import ColorField from './ColorField.vue';
import FillEditor from './FillEditor.vue';
import Icon from './Icon.vue';
import InfoHint from './InfoHint.vue';
import InspectorSection from './InspectorSection.vue';
import { formatDuration } from '../media/video';
import { BLOCK_ICONS, BLOCK_LABELS } from './ops';

/** `rooms`: the rooms the designer may see; null while they are not loaded yet. */
const props = defineProps<{ calendars: Calendar[]; hiddenCalendars?: Calendar[]; groups: PostGroup[]; homepages: HomepageEntry[]; rooms: RoomInfo[] | null; services?: ServiceInfo[] | null; allowedServices?: number[]; servicesFailed?: boolean }>();
const emit = defineEmits<{ 'pick-image': ['block' | 'background' | 'logo' | 'slideshow' | 'video'] }>();

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

/** An old block with the transition `zoom` is written as fade plus motion the moment either one changes. */
function setSlideshow(patch: { transition?: string; motion?: string }): void {
    const current = block.value;
    if (current?.type !== 'slideshow') return;
    setBlock({ transition: effectiveTransition(current), motion: effectiveMotion(current), ...patch });
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
    if (!next.length) return;
    const ids = [...new Set(next)].sort((a, b) => a - b);
    // A calendar that leaves the block leaves the list of those without rooms, too.
    setBlock({ calendarIds: ids, ...('roomsOffCalendarIds' in block.value ? { roomsOffCalendarIds: pruneRoomsOff(block.value.roomsOffCalendarIds, ids) } : {}) });
}

/** The chosen calendars a TV will not show, with names: not public (Plan.md 62). Ids in no list stay unnoticed. */
function hiddenChosen(b: NonNullable<typeof block.value>): Calendar[] {
    if (!('calendarIds' in b)) return [];
    return (props.hiddenCalendars ?? []).filter((k) => b.calendarIds.includes(k.id));
}

/** The chosen calendars to switch rooms for: with "Raum zeigen" on and more than one calendar; else null. */
function roomsFor(b: NonNullable<typeof block.value>): Calendar[] | null {
    if (b.type !== 'next-appointment' && b.type !== 'appointment-list') return null;
    if (!b.showRooms || b.calendarIds.length < 2) return null;
    if (b.type === 'appointment-list' && listLayout(b, themeOf(stage)) !== 'cards') return null;
    return props.calendars.filter((k) => b.calendarIds.includes(k.id));
}

function toggleRoomsFor(calendarId: number, shown: boolean): void {
    if (!block.value || (block.value.type !== 'next-appointment' && block.value.type !== 'appointment-list')) return;
    setBlock({ roomsOffCalendarIds: pruneRoomsOff(toggleRoomsOff(block.value.roomsOffCalendarIds, calendarId, shown), block.value.calendarIds) });
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

/** Empty `groupIds` means "every group, in the chosen order"; switching it off starts from all of them, in that order. */
function toggleAllGroups(checked: boolean): void {
    if (!block.value || block.value.type !== 'groups') return;
    setBlock({ groupIds: checked ? [] : selectGroups(homepageGroupList.value, [], block.value.sort).map((g) => g.id) });
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

/** The services to choose from: the showable ones an administrator allowed (Plan.md 58). Null while unknown. */
const choosableServices = computed<ServiceInfo[] | null>(() => {
    if (!props.services) return null;
    const allowed = new Set(allowedServiceIds(props.services.map((s) => s.id), props.allowedServices));
    return props.services.filter((s) => allowed.has(s.id));
});

/** Chosen services that can still be shown – only they count against the limit. */
function shownServiceCount(chosen: number[] | undefined): number {
    return toggleServiceIds(chosen, -1, false, choosableServices.value).length;
}

/** Services not showable any more leave the document with the next click (Plan.md 51). */
function toggleService(id: number, on: boolean): void {
    if (!block.value || (block.value.type !== 'next-appointment' && block.value.type !== 'appointment-list')) return;
    setBlock({ services: toggleServiceIds(block.value.services, id, on, choosableServices.value && !props.servicesFailed ? choosableServices.value : null) });
}

/** Most rooms a block holds – the schema's limit. */
const ROOMS_MAX = 30;

function roomEntries(): RoomEntry[] {
    return block.value?.type === 'rooms' ? block.value.rooms : [];
}

/** The name ChurchTools gives the room – from what the designer may see, else from the preview's data. */
function roomName(resourceId: number): string | null {
    return props.rooms?.find((r) => r.id === resourceId)?.name ?? stage.rooms?.find((r) => r.resourceId === resourceId)?.name ?? null;
}

/** The visible rooms not chosen yet, in ChurchTools' order. */
const pickableRooms = computed(() => {
    const chosen = new Set(roomEntries().map((r) => r.resourceId));
    return (props.rooms ?? []).filter((r) => !chosen.has(r.id));
});

function addRooms(infos: RoomInfo[]): void {
    const next = [...roomEntries(), ...infos.map((r): RoomEntry => ({ resourceId: r.id, hint: '', showTitles: true }))];
    setBlock({ rooms: next.slice(0, ROOMS_MAX) });
}

/** The chosen room joins the list, and the select reads "+ Raum" again. */
function pickRoom(select: HTMLSelectElement): void {
    addRooms(pickableRooms.value.filter((r) => r.id === Number(select.value)));
    select.value = '';
}

function setRoom(index: number, patch: Partial<RoomEntry>): void {
    setBlock({ rooms: roomEntries().map((r, i) => (i === index ? { ...r, ...patch } : r)) });
}

function moveRoom(index: number, target: number): void {
    const entries = [...roomEntries()];
    if (target < 0 || target >= entries.length) return;
    [entries[index], entries[target]] = [entries[target]!, entries[index]!];
    setBlock({ rooms: entries });
}

function removeRoom(index: number): void {
    setBlock({ rooms: roomEntries().filter((_, i) => i !== index) });
}

/** The other playlists showing the current slide, as one line; empty for an unlinked slide (Plan.md 49). */
const linkedNames = computed(() =>
    editor.slide
        ? editor
              .linkedIn(editor.slide.id)
              .map((p) => p.name)
              .join(', ')
        : '',
);

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
    const refusal = webRefusal(url, window.location.origin);
    if (refusal === 'own-instance') return 'Seiten des eigenen ChurchTools werden nicht eingebettet – dafür gibt es die Bausteine „Gruppen" und „QR-Code".';
    return refusal ? 'Nur Adressen mit https:// werden gezeigt.' : null;
}

/** The block whose pasted embed code held no address – shown until its next change. */
const embedProblemBlock = ref<string | null>(null);

/** An embed code pasted into the address field gives its address; without one the block stays as it was. */
function setWebUrl(input: HTMLInputElement): void {
    const pasted = input.value;
    const address = embedAddress(pasted);
    const current = block.value;
    if (!current) return;
    if (!address && /<iframe/i.test(pasted)) {
        embedProblemBlock.value = current.id;
        if (current.type === 'web') input.value = current.url;
        return;
    }
    embedProblemBlock.value = null;
    setBlock({ url: withScheme(address) });
}

function setSlideNumber(value: string): void {
    const n = Number(value);
    if (n >= 1 && n <= 3600) editor.updateSlide({ durationSeconds: n });
}

function mediaUrl(id: string | undefined, fit: 'crop' | 'max' = 'crop'): string | null {
    const media = id ? editor.media.find((m) => m.id === id) : undefined;
    return media ? sizedImageUrl(media.imageUrl, 272, 153, fit) : null;
}

/** The chosen video's name and length for the line under the button, "Film.mp4 · 0:12". */
function videoLabel(id: string | undefined): string | null {
    const media = id ? editor.media.find((m) => m.id === id) : undefined;
    if (!media) return null;
    const length = formatDuration(media.durationSeconds);
    return length ? `${media.name} · ${length}` : media.name;
}

/** Most pictures a slideshow holds – the schema's limit. */
const SLIDESHOW_MAX = 30;

function slideshowIds(): string[] {
    return block.value?.type === 'slideshow' ? block.value.mediaIds : [];
}

function mediaName(id: string): string | null {
    return editor.media.find((m) => m.id === id)?.name ?? null;
}

function moveSlideshowImage(index: number, target: number): void {
    const ids = [...slideshowIds()];
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setBlock({ mediaIds: ids });
}

function removeSlideshowImage(index: number): void {
    setBlock({ mediaIds: slideshowIds().filter((_, i) => i !== index) });
}

/** Between 3 and 60 seconds; anything else waits until the value is sensible. */
function setSlideshowSeconds(value: string): void {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 3 && n <= 60) setBlock({ seconds: n });
}

function setBackgroundKind(kind: string): void {
    if (kind === 'media') emit('pick-image', 'background');
    else editor.updateSlide({ background: slideFill.value });
}

const slideFill = computed<Fill>(() =>
    slide.value && slide.value.background.kind !== 'media' ? slide.value.background : { kind: 'solid', color: '#000000' },
);

/** Folded sections say what is set inside (Plan.md 47). */
const fontSummary = computed(() =>
    block.value && 'style' in block.value
        ? `${fontDef(block.value.style.fontFamily).label} · ${block.value.style.fontSize} px${block.value.style.uppercase ? ' · Großbuchstaben' : ''}`
        : '',
);
const positionSummary = computed(() =>
    block.value ? `${block.value.x}, ${block.value.y} · ${block.value.width} × ${block.value.height}` : '',
);
const fieldsSummary = computed(() =>
    block.value?.type === 'groups' ? `${GROUP_SHOW_KEYS.filter((key) => block.value!.type === 'groups' && block.value.show[key]).length} von ${GROUP_SHOW_KEYS.length}` : '',
);
const playlistSummary = computed(() =>
    editor.screens.length ? editor.screens.map((s) => s.name).join(', ') : 'noch keinem Screen',
);
const backgroundSummary = computed(() => {
    const background = slide.value?.background;
    if (!background) return '';
    return background.kind === 'solid' ? 'Farbe' : background.kind === 'linear-gradient' ? 'Verlauf' : 'Bild';
});
/** The colours a fill shows, as swatches beside the folded summary. */
const backgroundColors = computed(() => {
    const background = slide.value?.background;
    if (!background || background.kind === 'media') return [];
    return background.kind === 'solid' ? [background.color] : background.stops.map((stop) => stop.color);
});

const LAYERS = [
    { where: 'front', icon: 'layer-front', label: 'Ganz nach vorn' },
    { where: 'forward', icon: 'layer-forward', label: 'Eins vor' },
    { where: 'backward', icon: 'layer-backward', label: 'Eins zurück' },
    { where: 'back', icon: 'layer-back', label: 'Ganz nach hinten' },
] as const;

</script>

<template>
    <aside class="inspector">
        <!-- Block -->
        <section v-if="block" data-testid="block-inspector">
            <div class="block-head">
                <h3>
                    <Icon :name="BLOCK_ICONS[block.type]" :size="18" />
                    {{ BLOCK_LABELS[block.type] }}
                </h3>
                <div class="head-actions">
                    <!-- Plan.md, 25: locked, the whole block stays as it is until unlocked. -->
                    <button
                        class="d-btn lock-toggle"
                        :class="{ 'lock-toggle--on': block.locked }"
                        type="button"
                        :aria-pressed="!!block.locked"
                        :aria-label="block.locked ? 'Gesperrt' : 'Sperren'"
                        :title="block.locked ? 'Entsperren, um den Baustein wieder zu bearbeiten' : 'Sperren: nicht mehr verschieben, ändern oder löschen'"
                        data-testid="lock-toggle"
                        @click="editor.setLocked(block.id, !block.locked)"
                    >
                        <Icon :name="block.locked ? 'lock' : 'unlock'" :size="16" />
                        <span class="btn-word">{{ block.locked ? 'Gesperrt' : 'Sperren' }}</span>
                    </button>
                    <button
                        class="d-btn lock-toggle"
                        type="button"
                        title="Baustein löschen"
                        aria-label="Baustein löschen"
                        :disabled="!!block.locked"
                        data-testid="block-delete"
                        @click="editor.removeBlock(block.id)"
                    >
                        <Icon name="trash" :size="16" class="danger-icon" />
                        <span class="btn-word">Löschen</span>
                    </button>
                </div>
            </div>
            <p v-if="block.locked" class="hint" data-testid="locked-hint">
                Gesperrt: Der Baustein lässt sich nicht verschieben, ändern oder löschen, bis du ihn entsperrst.
            </p>
            <!-- A disabled fieldset disables every field and button inside it at once; a summary is none, so sections still fold. -->
            <fieldset class="lockable" :disabled="!!block.locked">
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

                <!-- Plan.md, 52: one library video, in a loop. -->
                <template v-if="block.type === 'video'">
                    <div class="media-pick">
                        <p v-if="videoLabel(block.mediaId)" class="video-name" data-testid="video-name">{{ videoLabel(block.mediaId) }}</p>
                        <p v-else-if="block.mediaId" class="hint" data-testid="video-name">Video fehlt</p>
                        <p v-else class="hint">Noch kein Video gewählt.</p>
                        <button class="d-btn" type="button" data-testid="pick-video" @click="emit('pick-image', 'video')">
                            {{ block.mediaId ? 'Anderes Video …' : 'Video wählen …' }}
                        </button>
                    </div>
                    <div class="hint-row hint-row--check">
                        <label class="check">
                            <input
                                type="checkbox"
                                :checked="block.sound ?? false"
                                data-testid="video-sound"
                                @change="setBlock({ sound: ($event.target as HTMLInputElement).checked })"
                            >
                            Ton
                        </label>
                        <InfoHint>Ton startet nur, wenn der Browser des Fernsehers es erlaubt – sonst läuft das Video stumm.</InfoHint>
                    </div>
                    <label class="d-field">
                        Einpassen
                        <select :value="block.fit ?? 'contain'" data-testid="video-fit" @change="setBlock({ fit: ($event.target as HTMLSelectElement).value })">
                            <option value="contain">Ganz zeigen</option>
                            <option value="cover">Fläche füllen</option>
                        </select>
                    </label>
                    <p class="hint">Die Slide dauert mindestens so lange wie das Video. Ohne Netz zeigt der Fernseher an dieser Stelle nichts.</p>
                </template>

                <!-- Plan.md, 46: library pictures one after the other. -->
                <template v-if="block.type === 'slideshow'">
                    <fieldset class="slideshow-images">
                        <legend>Bilder</legend>
                        <p v-if="!block.mediaIds.length" class="hint">Noch keine Bilder gewählt.</p>
                        <ol v-else class="slideshow-list" data-testid="slideshow-list">
                            <li v-for="(id, index) in block.mediaIds" :key="`${id}-${index}`" class="slideshow-row" data-testid="slideshow-row">
                                <img v-if="mediaUrl(id)" :src="mediaUrl(id)!" alt="">
                                <span v-else class="slideshow-missing" />
                                <span class="slideshow-name" :title="mediaName(id) ?? ''">{{ mediaName(id) ?? 'Bild fehlt' }}</span>
                                <button
                                    class="d-btn d-btn--icon"
                                    type="button"
                                    aria-label="Nach oben"
                                    title="Nach oben"
                                    :disabled="index === 0"
                                    data-testid="slideshow-up"
                                    @click="moveSlideshowImage(index, index - 1)"
                                >
                                    <Icon name="layer-forward" :size="14" />
                                </button>
                                <button
                                    class="d-btn d-btn--icon"
                                    type="button"
                                    aria-label="Nach unten"
                                    title="Nach unten"
                                    :disabled="index === block.mediaIds.length - 1"
                                    data-testid="slideshow-down"
                                    @click="moveSlideshowImage(index, index + 1)"
                                >
                                    <Icon name="layer-backward" :size="14" />
                                </button>
                                <button
                                    class="d-btn d-btn--icon"
                                    type="button"
                                    aria-label="Bild entfernen"
                                    title="Bild entfernen"
                                    data-testid="slideshow-remove"
                                    @click="removeSlideshowImage(index)"
                                >
                                    <Icon name="close" :size="14" />
                                </button>
                            </li>
                        </ol>
                        <div class="slideshow-add">
                            <button
                                class="d-btn"
                                type="button"
                                :disabled="block.mediaIds.length >= SLIDESHOW_MAX"
                                data-testid="pick-slideshow"
                                @click="emit('pick-image', 'slideshow')"
                            >
                                + Bilder
                            </button>
                            <span class="hint" data-testid="slideshow-count">{{ block.mediaIds.length }} von {{ SLIDESHOW_MAX }}</span>
                        </div>
                    </fieldset>
                    <label class="d-field">
                        Dauer je Bild (Sekunden)
                        <input
                            type="number"
                            min="3"
                            max="60"
                            :value="block.seconds ?? 6"
                            data-testid="slideshow-seconds"
                            v-on="edit"
                            @input="setSlideshowSeconds(($event.target as HTMLInputElement).value)"
                        >
                    </label>
                    <label class="d-field">
                        Einpassen
                        <select :value="block.fit ?? 'cover'" data-testid="slideshow-fit" @change="setBlock({ fit: ($event.target as HTMLSelectElement).value })">
                            <option value="contain">Ganz zeigen</option>
                            <option value="cover">Fläche füllen</option>
                        </select>
                    </label>
                    <label class="d-field">
                        Übergang
                        <select
                            :value="effectiveTransition(block)"
                            data-testid="slideshow-transition"
                            @change="setSlideshow({ transition: ($event.target as HTMLSelectElement).value })"
                        >
                            <option value="fade">Überblenden</option>
                            <option value="slide">Schieben</option>
                            <option value="wipe">Aufdecken</option>
                            <option value="none">Ohne</option>
                        </select>
                    </label>
                    <label class="d-field">
                        Bewegung
                        <select
                            :value="effectiveMotion(block)"
                            data-testid="slideshow-motion"
                            @change="setSlideshow({ motion: ($event.target as HTMLSelectElement).value })"
                        >
                            <option value="none">Keine</option>
                            <option value="in">Langsam hineinzoomen</option>
                            <option value="out">Langsam herauszoomen</option>
                            <option value="alternate">Abwechselnd</option>
                        </select>
                    </label>
                    <div class="hint-row">
                        <span>Laufzeit</span>
                        <InfoHint>Die Slide läuft so lange, bis jedes Bild einmal zu sehen war.</InfoHint>
                    </div>
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
                    <div class="hint-row">
                        <span class="hint">Zur Wahl stehen nur öffentliche Kalender.</span>
                        <InfoHint>
                            Öffentlich ist ein Kalender, den man in ChurchTools auch ohne Anmeldung sieht. Fehlt einer, gibt ihn frei, wer in
                            ChurchTools Berechtigungen verwalten darf: {{ PUBLIC_CALENDAR_PATH }}.
                        </InfoHint>
                    </div>
                    <label v-for="c in calendars" :key="c.id" class="check">
                        <input
                            type="checkbox"
                            :checked="block.calendarIds.includes(c.id)"
                            @change="toggleCalendar(c.id, ($event.target as HTMLInputElement).checked)"
                        >
                        <span class="swatch" :style="{ background: calendarColor(c.color) ?? 'transparent' }" />
                        {{ c.name }}
                    </label>
                    <template v-if="!calendars.length">
                        <p class="hint">Kein Kalender ist öffentlich.</p>
                        <p class="hint" data-testid="no-public-calendars">
                            Freigeben kann, wer in ChurchTools Berechtigungen verwalten darf: {{ PUBLIC_CALENDAR_PATH }}.
                        </p>
                    </template>
                    <p v-for="c in hiddenChosen(block)" :key="c.id" class="hint hidden-calendar" :data-testid="`hidden-calendar-${c.id}`">
                        {{ c.name }} – nicht öffentlich, erscheint auf keinem Fernseher
                        <button
                            class="d-btn"
                            type="button"
                            :disabled="block.calendarIds.length < 2"
                            :title="block.calendarIds.length < 2 ? 'Wähle zuerst einen anderen Kalender.' : undefined"
                            @click="toggleCalendar(c.id, false)"
                        >
                            Entfernen
                        </button>
                    </p>
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
                    <div class="hint-row">
                        <span>Zählweise</span>
                        <InfoHint>
                            Zählt bis zum Beginn des nächsten Termins dieser Kalender; ganztägige Termine zählen nicht mit.
                            Passt gut auf eine Playlist, die ein Zeitplan „30 Minuten vor Beginn“ einschaltet.
                        </InfoHint>
                    </div>
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
                    <!-- Plan.md, 50: the booked rooms beside the place; the list shows them as cards only. -->
                    <div v-if="block.type === 'next-appointment' || listLayout(block, themeOf(stage)) === 'cards'" class="hint-row hint-row--check">
                        <label class="check">
                            <input
                                type="checkbox"
                                :checked="block.showRooms ?? false"
                                data-testid="show-rooms"
                                @change="setBlock({ showRooms: ($event.target as HTMLInputElement).checked })"
                            >
                            Raum zeigen
                        </label>
                        <InfoHint>
                            Zeigt die gebuchten Räume des Termins neben dem Ort – nur bestätigte Buchungen, keine, die noch warten. Damit der Fernseher sie sieht, bekommt das Gerät mit „Rechte aktualisieren“ das Recht, alle Räume zu sehen; zeigt kein Screen mehr Räume an Terminen, nimmt „Rechte aktualisieren“ es zurück.
                        </InfoHint>
                    </div>
                    <!-- Plan.md, 51: rooms can be left out for single calendars. -->
                    <fieldset v-if="roomsFor(block)" class="rooms-for" data-testid="rooms-for">
                        <legend>Räume zeigen für:</legend>
                        <label v-for="c in roomsFor(block)" :key="c.id" class="check">
                            <input
                                type="checkbox"
                                :checked="!(block.roomsOffCalendarIds ?? []).includes(c.id)"
                                :data-testid="`rooms-calendar-${c.id}`"
                                @change="toggleRoomsFor(c.id, ($event.target as HTMLInputElement).checked)"
                            >
                            {{ c.name }}
                        </label>
                    </fieldset>
                    <!-- Plan.md, 51: who takes a service – only accepted assignments of services in groups open to all. -->
                    <fieldset
                        v-if="block.type === 'next-appointment' || listLayout(block, themeOf(stage)) === 'cards'"
                        data-testid="services-fieldset"
                    >
                        <legend class="legend-row">
                            Dienste zeigen
                            <InfoHint>
                                Zeigt, wer den Dienst übernimmt – nur zugesagte Einteilungen und nur Dienste aus Dienstgruppen, die in ChurchTools ‚Ohne Berechtigung einsehbar‘ sind. Die Vorschau zeigt, was dein Konto sehen darf. Damit der Fernseher die Dienste sieht, bekommt das Gerät mit „Rechte aktualisieren“ das Recht, die Events dieser Kalender zu sehen – und nimmt es zurück, wenn kein Baustein sie mehr braucht.
                            </InfoHint>
                        </legend>
                        <p v-if="servicesFailed" class="hint" data-testid="services-failed">Dienste konnten nicht geladen werden.</p>
                        <p v-else-if="services && !services.length" class="hint" data-testid="services-none">
                            Keine Dienste verfügbar – in ChurchTools ist keine Dienstgruppe ‚Ohne Berechtigung einsehbar‘.
                        </p>
                        <p v-else-if="choosableServices && !choosableServices.length" class="hint" data-testid="services-not-allowed">
                            Noch kein Dienst freigegeben – ein Administrator legt in den Einstellungen unter „Dienste auf Screens“ fest, welche gezeigt werden dürfen.
                        </p>
                        <label v-for="s in choosableServices ?? []" :key="s.id" class="check">
                            <input
                                type="checkbox"
                                :checked="(block.services ?? []).includes(s.id)"
                                :disabled="!(block.services ?? []).includes(s.id) && shownServiceCount(block.services) >= SERVICES_MAX"
                                :data-testid="`service-${s.id}`"
                                @change="toggleService(s.id, ($event.target as HTMLInputElement).checked)"
                            >
                            {{ s.name }}
                        </label>
                    </fieldset>
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
                    <div class="hint-row">
                        <span>Auswahl der Beiträge</span>
                        <InfoHint>Zeigt die neuesten Beiträge der gewählten Gruppen; abgelaufene nie.</InfoHint>
                    </div>
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
                        Alle Gruppen der Homepage
                    </label>
                    <label v-if="block.groupIds.length === 0" class="d-field">
                        Reihenfolge
                        <select
                            :value="block.sort"
                            data-testid="groups-sort"
                            @change="setBlock({ sort: ($event.target as HTMLSelectElement).value })"
                        >
                            <option value="weekday">Nach Wochentag (Montag zuerst)</option>
                            <option value="name-asc">Name A–Z</option>
                            <option value="name-desc">Name Z–A</option>
                        </select>
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

                    <div class="hint-row">
                        <span>Sichtbarkeit</span>
                        <InfoHint>
                            Zeigt nur Gruppen, die ChurchTools auf der Homepage öffentlich zeigt – mit und ohne Anmeldung
                            dieselben.
                        </InfoHint>
                    </div>
                    <InspectorSection id="fields" title="Angaben" :summary="fieldsSummary">
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
                        <p v-if="block.show.leaders" class="hint">
                            Namen erscheinen nur, wenn die Gruppen-Homepage in ChurchTools die Leiter zeigt – dann sind sie
                            ohnehin öffentlich.
                        </p>
                    </InspectorSection>
                </template>

                <!-- Plan.md, 46: which rooms are taken today – an overview or the door sign of the first room. -->
                <template v-if="block.type === 'rooms'">
                    <label class="d-field">
                        Anordnung
                        <select
                            :value="block.layout"
                            data-testid="rooms-layout"
                            @change="setBlock({ layout: ($event.target as HTMLSelectElement).value })"
                        >
                            <option value="overview">Übersicht – alle gewählten Räume</option>
                            <option value="door">Türschild – der erste Raum</option>
                        </select>
                    </label>
                    <label class="d-field">
                        Tage
                        <select
                            :value="block.days"
                            data-testid="rooms-days"
                            @change="setBlock({ days: Number(($event.target as HTMLSelectElement).value) })"
                        >
                            <option :value="1">Heute</option>
                            <option :value="2">Heute und morgen</option>
                        </select>
                    </label>
                    <label v-if="block.layout === 'overview'" class="d-field">
                        Sekunden je Seite
                        <input
                            type="number"
                            min="5"
                            max="120"
                            :value="block.pageSeconds ?? PAGE_SECONDS"
                            data-testid="rooms-seconds"
                            v-on="edit"
                            @input="setGroupSeconds(($event.target as HTMLInputElement).value)"
                        >
                    </label>
                    <p v-if="block.layout === 'door'" class="hint" data-testid="rooms-door-hint">
                        Das Türschild zeigt den ersten Raum der Liste.
                    </p>

                    <fieldset class="rooms-list">
                        <legend>Räume</legend>
                        <p class="hint" data-testid="rooms-confirmed-hint">Gezeigt werden nur bestätigte Buchungen, keine, die noch warten.</p>
                        <p v-if="!block.rooms.length" class="hint">Noch keine Räume gewählt.</p>
                        <div v-for="(entry, index) in block.rooms" :key="entry.resourceId" class="room-entry" data-testid="room-entry">
                            <div class="room-head">
                                <span v-if="roomName(entry.resourceId)" class="room-name" :title="roomName(entry.resourceId)!" data-testid="room-name">
                                    {{ roomName(entry.resourceId) }}
                                </span>
                                <span v-else class="room-name dimmed" data-testid="room-name">Raum {{ entry.resourceId }} – nicht sichtbar</span>
                                <button
                                    class="d-btn d-btn--icon"
                                    type="button"
                                    aria-label="Nach oben"
                                    title="Nach oben"
                                    :disabled="index === 0"
                                    data-testid="room-up"
                                    @click="moveRoom(index, index - 1)"
                                >
                                    ↑
                                </button>
                                <button
                                    class="d-btn d-btn--icon"
                                    type="button"
                                    aria-label="Nach unten"
                                    title="Nach unten"
                                    :disabled="index === block.rooms.length - 1"
                                    data-testid="room-down"
                                    @click="moveRoom(index, index + 1)"
                                >
                                    ↓
                                </button>
                                <button
                                    class="d-btn d-btn--icon"
                                    type="button"
                                    aria-label="Raum entfernen"
                                    title="Raum entfernen"
                                    data-testid="room-remove"
                                    @click="removeRoom(index)"
                                >
                                    <Icon name="close" :size="14" />
                                </button>
                            </div>
                            <label class="d-field">
                                Wegweiser
                                <input
                                    type="text"
                                    maxlength="100"
                                    :value="entry.hint"
                                    placeholder="z. B. 1. OG, links"
                                    data-testid="room-hint"
                                    v-on="edit"
                                    @input="setRoom(index, { hint: ($event.target as HTMLInputElement).value })"
                                >
                            </label>
                            <div class="hint-row hint-row--check">
                                <label class="check">
                                    <input
                                        type="checkbox"
                                        :checked="entry.showTitles"
                                        data-testid="room-titles"
                                        @change="setRoom(index, { showTitles: ($event.target as HTMLInputElement).checked })"
                                    >
                                    Titel zeigen
                                </label>
                                <InfoHint>
                                    Buchungstitel können Namen enthalten, etwa „Gespräch Familie X". Für solche Räume den Titel
                                    ausschalten – dann steht dort „Belegt".
                                </InfoHint>
                            </div>
                        </div>
                        <p v-if="rooms && !rooms.length" class="hint" data-testid="rooms-none">
                            Keine Räume sichtbar. Ein Administrator gibt der Gruppe „Infoscreen-Designer" unter Einstellungen
                            mit „Rechte aktualisieren" das Recht, Räume zu sehen.
                        </p>
                        <div v-else-if="rooms" class="room-add">
                            <select
                                :disabled="!pickableRooms.length || block.rooms.length >= ROOMS_MAX"
                                value=""
                                aria-label="Raum hinzufügen"
                                data-testid="rooms-add"
                                @change="pickRoom($event.target as HTMLSelectElement)"
                            >
                                <option value="">+ Raum</option>
                                <option v-for="r in pickableRooms" :key="r.id" :value="r.id">{{ r.name }}</option>
                            </select>
                            <button
                                class="d-btn"
                                type="button"
                                :disabled="!pickableRooms.length || block.rooms.length >= ROOMS_MAX"
                                data-testid="rooms-add-all"
                                @click="addRooms(pickableRooms)"
                            >
                                Alle Räume hinzufügen
                            </button>
                        </div>
                        <span v-if="rooms?.length" class="hint" data-testid="rooms-count">{{ block.rooms.length }} von {{ ROOMS_MAX }}</span>
                    </fieldset>
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
                        <div class="hint-row">
                            <span>Eigenes Logo</span>
                            <InfoHint>Ein eigenes Logo hilft, wenn das aus ChurchTools auf dem Hintergrund nicht zu sehen ist.</InfoHint>
                        </div>
                    </div>
                </template>

                <!-- Plan.md, 28: another website in a frame – a page of the church website, a widget. -->
                <template v-if="block.type === 'web'">
                    <div class="d-field">
                        <div class="hint-row">
                            <label for="web-url-input">Adresse oder Einbettungscode</label>
                            <InfoHint>
                                Statt der Adresse geht auch der Einbettungscode („iframe"), den Karten, Umfragen oder Pinnwände
                                anbieten – übernommen wird nur die Adresse darin. Die Seite wird nur gezeigt, nicht bedient. Ohne Netz bleibt der Rahmen leer. Viele große Seiten
                                wie Google verbieten das Einbetten – der Rahmen zeigt dann einen Fehler. Eigene Seiten, etwa die
                                der Gemeinde-Website, gehen meist.
                            </InfoHint>
                        </div>
                        <input
                            id="web-url-input"
                            type="text"
                            inputmode="url"
                            :value="block.url"
                            data-testid="web-url"
                            v-on="edit"
                            @change="setWebUrl($event.target as HTMLInputElement)"
                        >
                    </div>
                    <p class="hint" data-testid="web-enter-hint">Mit Enter übernehmen – erst dann lädt die Seite.</p>
                    <p v-if="embedProblemBlock === block.id" class="hint" data-testid="web-problem">Im Einbettungscode steht keine Adresse.</p>
                    <p v-else-if="webProblem(block.url)" class="hint" data-testid="web-problem">{{ webProblem(block.url) }}</p>
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
                    <div class="hint-row">
                        <span>Farben</span>
                        <InfoHint>Dunkel auf hell lesen alle Handykameras am sichersten.</InfoHint>
                    </div>
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
                </template>

                <InspectorSection v-if="'style' in block" id="font" title="Schrift" :summary="fontSummary">
                    <template #summary-extra>
                        <span class="swatch" :style="{ background: block.style.color }" />
                    </template>
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
                    </div>
                    <label class="check">
                        <input
                            type="checkbox"
                            :checked="block.style.uppercase ?? false"
                            data-testid="text-uppercase"
                            @change="setStyle({ uppercase: ($event.target as HTMLInputElement).checked })"
                        >
                        Großbuchstaben
                    </label>
                    <ColorField
                        label="Farbe"
                        testid="text-color"
                        :model-value="block.style.color"
                        @focus="edit.onFocus"
                        @blur="edit.onBlur"
                        @update:model-value="setStyle({ color: $event })"
                    />
                    <div class="grid2">
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
                        <label v-if="verticalAlignOf(block)" class="d-field">
                            Vertikal
                            <select
                                :value="verticalAlignOf(block)"
                                data-testid="text-vertical-align"
                                @change="setStyle({ verticalAlign: ($event.target as HTMLSelectElement).value as 'top' })"
                            >
                                <option value="top">Oben</option>
                                <option value="middle">Mittig</option>
                                <option value="bottom">Unten</option>
                            </select>
                        </label>
                    </div>
                </InspectorSection>

                <InspectorSection id="position" title="Position &amp; Ebene" :summary="positionSummary">
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
                    <div class="layer-row">
                        <span class="row-label">Ebene</span>
                        <div class="layer-buttons">
                            <button
                                v-for="layer in LAYERS"
                                :key="layer.where"
                                class="d-btn d-btn--icon"
                                type="button"
                                :title="layer.label"
                                :aria-label="layer.label"
                                :data-testid="`layer-${layer.where}`"
                                @click="editor.layerBlock(block.id, layer.where)"
                            >
                                <Icon :name="layer.icon" :size="16" />
                            </button>
                        </div>
                    </div>
                </InspectorSection>
            </fieldset>
        </section>

        <!-- Slide and screen -->
        <template v-else>
            <section v-if="slide" data-testid="slide-inspector">
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
                <!-- A slide that other playlists show too (Plan.md 49): changes here count there as well. -->
                <div v-if="linkedNames" class="linked" data-testid="slide-linked">
                    <span class="linked-text" :title="`Auch in: ${linkedNames}`" data-testid="slide-linked-in">
                        <Icon name="link" :size="14" />
                        <span class="linked-names">Auch in: {{ linkedNames }}</span>
                        <span v-if="editor.linkPending(slide.id)" class="linked-pending" data-testid="slide-link-pending">
                            ab dem Speichern
                        </span>
                    </span>
                    <InfoHint>
                        Änderungen an dieser Slide – auch Dauer und „Abgeschaltet" – gelten in allen genannten Playlists.
                        „Verknüpfung lösen" macht daraus eine eigene Kopie nur für diese Playlist.
                    </InfoHint>
                    <button class="d-btn" type="button" data-testid="slide-unlink" @click="editor.unlinkSlide(slide.id)">
                        Verknüpfung lösen
                    </button>
                </div>
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
                <InspectorSection id="background" title="Hintergrund" :summary="backgroundSummary">
                    <template #summary-extra>
                        <span v-for="(color, i) in backgroundColors" :key="i" class="swatch" :style="{ background: color }" />
                    </template>
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
                </InspectorSection>
            </section>

            <!-- The playlist is the designers' own (schema 1.4); where it runs, the screens' schedules decide. -->
            <section v-if="editor.draft">
                <InspectorSection id="playlist" title="Playlist" :summary="playlistSummary">
                    <div data-testid="playlist-info" class="playlist-info">
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
                            <dd data-testid="playlist-screens">{{ playlistSummary }}</dd>
                        </dl>
                        <div class="hint-row">
                            <span>Zeitplan</span>
                            <InfoHint>
                                Auf welchem Screen sie wann läuft, legt der Zeitplan des Screens fest – unter „Zeitpläne" oder an
                                der Kachel des Screens. Speichern ändert alle Screens, die sie zeigen.
                            </InfoHint>
                        </div>
                        <p v-if="bannerRunning" class="hint" data-testid="banner-status">
                            Hinweisband: „{{ editor.draft.playlist.banner!.text }}" – bearbeiten unter
                            <RouterLink :to="{ name: 'notices' }">Hinweise</RouterLink>
                        </p>
                        <p v-else class="hint" data-testid="banner-status">
                            Kein Hinweisband – anlegen unter <RouterLink :to="{ name: 'notices' }">Hinweise</RouterLink>
                        </p>
                    </div>
                </InspectorSection>
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
/* Phone and tablet upright: in the editor's sheet now (Plan.md 44, M4; 45) – it owns the border and the max-height. */
@media (max-width: 48rem), (min-width: 48.0625rem) and (max-width: 75rem) and (orientation: portrait) {
    .inspector {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        /* The sheet scrolls up and down only; the fields follow the width of the phone (Plan.md 44). */
        overflow-x: hidden;
        border-left: 0;
    }
}
section {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
}
h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 1.05em;
}
/* No boxes in boxes (Plan.md 47): a fieldset only groups; the sections bring the divider lines. */
fieldset {
    display: grid;
    gap: 8px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
}
.legend-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    box-sizing: border-box;
    width: 100%;
}
.rooms-for {
    margin-left: 1.6em;
}
legend {
    padding: 0;
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
/* The rooms of a block: name with reorder buttons, way-finder, title switch (Plan.md 46). Nothing may widen the column. */
.rooms-list {
    grid-template-columns: minmax(0, 1fr);
}
.room-entry {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
    min-width: 0;
    padding: 6px 0;
    border-top: 1px solid var(--d-divider);
}
.room-head {
    display: flex;
    align-items: center;
    gap: 6px;
}
.room-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
}
.room-add {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.room-add select {
    flex: 1;
    min-width: 0;
}
/* The pictures of a slideshow: thumbnail, file name, reorder and remove (Plan.md 46). */
.slideshow-images {
    /* A long file name must not widen the column: the track may shrink below its content. */
    grid-template-columns: minmax(0, 1fr);
}
.slideshow-list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
}
.slideshow-row {
    display: flex;
    align-items: center;
    gap: 6px;
}
.slideshow-row img,
.slideshow-missing {
    flex: none;
    width: 48px;
    height: 27px;
    border-radius: 3px;
    background: var(--d-panel);
    object-fit: cover;
}
.slideshow-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--d-size-sm);
}
.slideshow-add {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid var(--d-divider);
}
/* A small caption with its (i) at the end, the explanation opening below (Plan.md 47). */
.hint-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
/* A switch with its info circle: the switch reads like the other switches, not like a field label. */
.hint-row--check {
    color: inherit;
    font-size: inherit;
}
.layer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.row-label {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.layer-buttons {
    display: flex;
    gap: 4px;
}
.linked {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.linked-text {
    display: flex;
    flex: 1 1 12rem;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.linked-text .d-icon {
    flex: none;
}
.linked-pending {
    flex: none;
    font-style: italic;
}
.linked-names {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.playlist-info {
    display: grid;
    gap: 10px;
}
.media-pick {
    display: grid;
    gap: 6px;
}
.video-name {
    margin: 0;
    overflow-wrap: anywhere;
    font-weight: 700;
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
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}
.head-actions {
    display: flex;
    gap: 6px;
}
/* Over 48rem always two lines, whatever the name's length: name, then two equal buttons (Plan.md 47). */
@media (min-width: 48.0625rem) {
    .block-head {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        justify-content: stretch;
    }
    .head-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
    }
    .head-actions .lock-toggle {
        justify-content: center;
    }
}
.lock-toggle {
    gap: 4px;
    font-size: var(--d-size-sm);
}
/* Red only on the wastebasket (Plan.md 47). */
.danger-icon {
    color: var(--d-danger);
}
/* Below 48rem (the sheet on a phone) only the symbols: the word stays for screen readers. */
@media (max-width: 48rem) {
    .btn-word {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
    }
}
.lock-toggle--on {
    border-color: var(--d-accent);
    background: var(--d-accent-pale);
    color: var(--d-accent-strong);
}
/* Only a container: the fieldset exists to switch all fields off at once. */
.lockable {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
}
.lockable:disabled {
    opacity: 0.55;
}
/* Sections follow one another without the grid's gap; each brings its own divider line. */
.lockable > :deep(.section) + :deep(.section) {
    margin-top: -10px;
}
.hidden-calendar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
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
