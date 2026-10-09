<script setup lang="ts">
/**
 * The inspector of the blocks that have not moved to their own component yet (Plan.md 79, B2, part 1): their content
 * as it was in `Inspector.vue`, unchanged, followed by the shared "Schrift" section. Part 2 dissolves it.
 */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import { homepageGroups, selectGroups, type Group } from '../../../groups/normalize';
import type { Block, GroupFields, RoomEntry } from '../../../model/schema';
import { themeOf, useStageContext } from '../../../player/context';
import { GROUP_SECONDS, PAGE_SECONDS, POST_SECONDS } from '../../../player/paging';
import { listLayout } from '../../../player/theme';
import { pruneRoomsOff, toggleRoomsOff } from '../../../appointments/rooms';
import { allowedServiceIds, SERVICES_MAX, toggleServiceIds, type ServiceInfo } from '../../../appointments/services';
import type { Calendar } from '../../../ct/api';
import type { RoomInfo } from '../../../rooms/normalize';
import { effectiveMotion, effectiveTransition } from '../../../player/slideshow';
import { useEditorStore } from '../../editor-store';
import CalendarField from '../../CalendarField.vue';
import HintRow from '../../HintRow.vue';
import Icon from '../../Icon.vue';
import InspectorSection from '../../InspectorSection.vue';
import { useInspectorContext } from '../context';
import { useEdit } from '../edit';
import FontSection from '../FontSection.vue';
import { useBlockEdit } from '../use-block';

/** Labels in the order of `GroupFields` itself, so the fieldset needs no list of its own (Plan.md 43). */
const GROUP_SHOW_LABELS: Record<keyof GroupFields, string> = t.inspector.groupShow;
const GROUP_SHOW_KEYS = Object.keys(GROUP_SHOW_LABELS) as (keyof GroupFields)[];

const editor = useEditorStore();
/** The preview's stage context: paged lists report their page count there. */
const stage = useStageContext();
const context = useInspectorContext();
const props = defineProps<{ block: Block }>();
const block = computed(() => props.block);
const slide = computed(() => editor.slide);

/** Field edits are gestures: all keystrokes in one field are one undo step. */
const edit = useEdit();
const { setBlock, mediaUrl } = useBlockEdit(() => props.block);

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
    return (context.hiddenCalendars ?? []).filter((k) => b.calendarIds.includes(k.id));
}

/** The chosen calendars to switch rooms for: with "Raum zeigen" on and more than one calendar; else null. */
function roomsFor(b: NonNullable<typeof block.value>): Calendar[] | null {
    if (b.type !== 'next-appointment' && b.type !== 'appointment-list') return null;
    if (!b.showRooms || b.calendarIds.length < 2) return null;
    if (b.type === 'appointment-list' && listLayout(b, themeOf(stage)) !== 'cards') return null;
    return context.calendars.filter((k) => b.calendarIds.includes(k.id));
}

function roomsForSummary(b: NonNullable<typeof block.value>): string {
    const shown = roomsFor(b) ?? [];
    const off = 'roomsOffCalendarIds' in b ? (b.roomsOffCalendarIds ?? []) : [];
    const count = shown.filter((k) => !off.includes(k.id)).length;
    return count === shown.length ? t.inspector.all : t.common.countOf(count, shown.length);
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
    return !context.homepages.some((h) => h.parentGroupId === parentGroupId);
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
    if (!context.services) return null;
    const allowed = new Set(allowedServiceIds(context.services.map((s) => s.id), context.allowedServices));
    return context.services.filter((s) => allowed.has(s.id));
});

/** Chosen services that can still be shown – only they count against the limit. */
function shownServiceCount(chosen: number[] | undefined): number {
    return toggleServiceIds(chosen, -1, false, choosableServices.value).length;
}

/** Services not showable any more leave the document with the next click (Plan.md 51). */
function toggleService(id: number, on: boolean): void {
    if (!block.value || (block.value.type !== 'next-appointment' && block.value.type !== 'appointment-list')) return;
    setBlock({ services: toggleServiceIds(block.value.services, id, on, choosableServices.value && !context.servicesFailed ? choosableServices.value : null) });
}

function servicesSummary(chosen: number[] | undefined): string {
    const count = shownServiceCount(chosen);
    return count ? t.common.chosen(count) : t.common.none;
}

/** Most rooms a block holds – the schema's limit. */
const ROOMS_MAX = 30;

function roomEntries(): RoomEntry[] {
    return block.value?.type === 'rooms' ? block.value.rooms : [];
}

/** The name ChurchTools gives the room – from what the designer may see, else from the preview's data. */
function roomName(resourceId: number): string | null {
    return context.rooms?.find((r) => r.id === resourceId)?.name ?? stage.rooms?.find((r) => r.resourceId === resourceId)?.name ?? null;
}

/** The visible rooms not chosen yet, in ChurchTools' order. */
const pickableRooms = computed(() => {
    const chosen = new Set(roomEntries().map((r) => r.resourceId));
    return (context.rooms ?? []).filter((r) => !chosen.has(r.id));
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

/** Between 3 and 120 seconds; anything else waits until the value is sensible, like the duration field. */
function setPageSeconds(value: string): void {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 3 && n <= 120) setBlock({ pageSeconds: n });
}

/** How a paged list will run – with the page count the stage preview measured. */
function pageHint(list: Extract<Block, { type: 'appointment-list' }>): string {
    const pages = stage.pages?.[list.id] ?? 1;
    if (pages < 2) return t.inspector.pageHintOne;
    const perPage = list.pageSeconds ?? PAGE_SECONDS;
    const needed = pages * perPage;
    const duration = slide.value?.durationSeconds ?? 0;
    return needed > duration
        ? t.inspector.pageHintLonger(pages, perPage, needed, duration)
        : t.inspector.pageHintEven(pages, Math.round(duration / pages));
}

/** '' follows the theme (Plan.md, 27): the block then changes with it. */
function setLayout(value: string): void {
    setBlock({ layout: value || undefined });
}

/** The theme's layout in words, for the option that follows it. */
const themeLayout = computed(() => (themeOf(stage).appointments === 'large' ? t.inspector.layoutModern : t.inspector.layoutNative));

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

/** Folded sections say what is set inside (Plan.md 47). */
const fieldsSummary = computed(() =>
    block.value?.type === 'groups' ? t.common.countOf(GROUP_SHOW_KEYS.filter((key) => block.value!.type === 'groups' && block.value.show[key]).length, GROUP_SHOW_KEYS.length) : '',
);
</script>

<template>
    <!-- Plan.md, 46: library pictures one after the other. -->
    <template v-if="block.type === 'slideshow'">
        <div class="slideshow-add">
            <button
                class="d-btn"
                type="button"
                :disabled="block.mediaIds.length >= SLIDESHOW_MAX"
                data-testid="pick-slideshow"
                @click="context.pickImage('slideshow')"
            >
                {{ t.inspector.addImages }}
            </button>
            <span class="hint" data-testid="slideshow-count">{{ t.common.countOf(block.mediaIds.length, SLIDESHOW_MAX) }}</span>
        </div>
        <p v-if="!block.mediaIds.length" class="hint">{{ t.inspector.noImages }}</p>
        <InspectorSection v-else id="slideshow-images" :title="t.inspector.images" :summary="t.inspector.imageCount(block.mediaIds.length)">
            <ol class="slideshow-list" data-testid="slideshow-list">
                <li v-for="(id, index) in block.mediaIds" :key="`${id}-${index}`" class="slideshow-row" data-testid="slideshow-row">
                    <img v-if="mediaUrl(id)" :src="mediaUrl(id)!" alt="">
                    <span v-else class="slideshow-missing" />
                    <span class="slideshow-name" :title="mediaName(id) ?? ''">{{ mediaName(id) ?? t.inspector.imageMissing }}</span>
                    <button
                        class="d-btn d-btn--icon"
                        type="button"
                        :aria-label="t.common.moveUp"
                        :title="t.common.moveUp"
                        :disabled="index === 0"
                        data-testid="slideshow-up"
                        @click="moveSlideshowImage(index, index - 1)"
                    >
                        <Icon name="layer-forward" :size="14" />
                    </button>
                    <button
                        class="d-btn d-btn--icon"
                        type="button"
                        :aria-label="t.common.moveDown"
                        :title="t.common.moveDown"
                        :disabled="index === block.mediaIds.length - 1"
                        data-testid="slideshow-down"
                        @click="moveSlideshowImage(index, index + 1)"
                    >
                        <Icon name="layer-backward" :size="14" />
                    </button>
                    <button
                        class="d-btn d-btn--icon"
                        type="button"
                        :aria-label="t.inspector.removeImage"
                        :title="t.inspector.removeImage"
                        data-testid="slideshow-remove"
                        @click="removeSlideshowImage(index)"
                    >
                        <Icon name="close" :size="14" />
                    </button>
                </li>
            </ol>
        </InspectorSection>
        <label class="d-field d-field--inline">
            {{ t.inspector.secondsPerImage }}
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
        <label class="d-field d-field--inline">
            {{ t.inspector.fit }}
            <select :value="block.fit ?? 'cover'" data-testid="slideshow-fit" @change="setBlock({ fit: ($event.target as HTMLSelectElement).value })">
                <option value="contain">{{ t.inspector.fitContain }}</option>
                <option value="cover">{{ t.inspector.fitCover }}</option>
            </select>
        </label>
        <label class="d-field d-field--inline">
            {{ t.inspector.transition }}
            <select
                :value="effectiveTransition(block)"
                data-testid="slideshow-transition"
                @change="setSlideshow({ transition: ($event.target as HTMLSelectElement).value })"
            >
                <option value="fade">{{ t.inspector.transitions.fade }}</option>
                <option value="slide">{{ t.inspector.transitions.slide }}</option>
                <option value="wipe">{{ t.inspector.transitions.wipe }}</option>
                <option value="none">{{ t.inspector.transitions.none }}</option>
            </select>
        </label>
        <label class="d-field d-field--inline">
            {{ t.inspector.motion }}
            <select
                :value="effectiveMotion(block)"
                data-testid="slideshow-motion"
                @change="setSlideshow({ motion: ($event.target as HTMLSelectElement).value })"
            >
                <option value="none">{{ t.inspector.motions.none }}</option>
                <option value="in">{{ t.inspector.motions.in }}</option>
                <option value="out">{{ t.inspector.motions.out }}</option>
                <option value="alternate">{{ t.inspector.motions.alternate }}</option>
            </select>
        </label>
        <HintRow caption>
            <span>{{ t.inspector.runtime }}</span>
            <template #info>{{ t.inspector.slideshowRuntimeInfo }}</template>
        </HintRow>
    </template>

    <CalendarField
        v-if="'calendarIds' in block"
        :calendars="context.calendars"
        :chosen-ids="block.calendarIds"
        :hidden="hiddenChosen(block)"
        @toggle="toggleCalendar"
    />

    <!-- Plan.md, 32: the time until the next appointment of these calendars. -->
    <template v-if="block.type === 'countdown'">
        <label class="check">
            <input
                type="checkbox"
                :checked="block.showTitle"
                data-testid="countdown-title"
                @change="setBlock({ showTitle: ($event.target as HTMLInputElement).checked })"
            >
            {{ t.inspector.showTitle }}
        </label>
        <label class="d-field d-field--inline">
            {{ t.inspector.duringAppointment }}
            <input
                type="text"
                maxlength="200"
                :value="block.runningText"
                :placeholder="t.inspector.runningPlaceholder"
                data-testid="countdown-running-text"
                v-on="edit"
                @input="setBlock({ runningText: ($event.target as HTMLInputElement).value })"
            >
        </label>
        <HintRow caption>
            <span>{{ t.inspector.countMode }}</span>
            <template #info>
                {{ t.inspector.countInfo }}
            </template>
        </HintRow>
    </template>

    <template v-if="block.type === 'appointment-list' || block.type === 'next-appointment'">
        <!-- Plan.md, 20: the look of the WordPress plugin's list and highlighted event. -->
        <label class="d-field d-field--inline">
            {{ t.inspector.appearance }}
            <select
                v-if="block.type === 'appointment-list'"
                :value="block.layout ?? ''"
                data-testid="list-layout"
                @change="setLayout(($event.target as HTMLSelectElement).value)"
            >
                <option value="">{{ t.inspector.layoutTheme(themeLayout) }}</option>
                <option value="rows">{{ t.inspector.layoutRows }}</option>
                <option value="cards">{{ t.inspector.layoutCards }}</option>
            </select>
            <select
                v-else
                :value="block.layout ?? ''"
                data-testid="next-layout"
                @change="setLayout(($event.target as HTMLSelectElement).value)"
            >
                <option value="">{{ t.inspector.layoutTheme(themeLayout) }}</option>
                <option value="classic">{{ t.inspector.layoutClassic }}</option>
                <option value="card">{{ t.inspector.layoutCard }}</option>
            </select>
        </label>
        <template v-if="block.type === 'appointment-list'">
            <div class="grid2">
                <label class="d-field">
                    {{ t.inspector.daysAhead }}
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
                    {{ t.inspector.atMost }}
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
                    {{ t.inspector.secondsPerPage }}
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
                {{ t.inspector.showAll }}
            </label>
            <p v-if="block.showAll" class="hint" data-testid="page-hint">{{ pageHint(block) }}</p>
        </template>
        <label v-else class="check">
            <input
                type="checkbox"
                :checked="block.showImage"
                @change="setBlock({ showImage: ($event.target as HTMLInputElement).checked })"
            >
            {{ t.inspector.showAppointmentImage }}
        </label>
        <!-- Plan.md, 50: the booked rooms where no place is entered; the list shows them as cards only. -->
        <HintRow v-if="block.type === 'next-appointment' || listLayout(block, themeOf(stage)) === 'cards'">
            <label class="check">
                <input
                    type="checkbox"
                    :checked="block.showRooms ?? false"
                    data-testid="show-rooms"
                    @change="setBlock({ showRooms: ($event.target as HTMLInputElement).checked })"
                >
                {{ t.inspector.showRoom }}
            </label>
            <template #info>
                {{ t.inspector.showRoomInfo }}
            </template>
        </HintRow>
        <!-- Plan.md, 51: rooms can be left out for single calendars. -->
        <InspectorSection v-if="roomsFor(block)" id="rooms-for" :title="t.inspector.roomsFor" :summary="roomsForSummary(block)">
            <div class="list" data-testid="rooms-for">
                <label v-for="c in roomsFor(block)" :key="c.id" class="check">
                    <input
                        type="checkbox"
                        :checked="!(block.roomsOffCalendarIds ?? []).includes(c.id)"
                        :data-testid="`rooms-calendar-${c.id}`"
                        @change="toggleRoomsFor(c.id, ($event.target as HTMLInputElement).checked)"
                    >
                    {{ c.name }}
                </label>
            </div>
        </InspectorSection>
        <!-- Plan.md, 51: who takes a service – only accepted assignments of services in groups open to all. -->
        <template v-if="block.type === 'next-appointment' || listLayout(block, themeOf(stage)) === 'cards'">
            <InspectorSection id="services" :title="t.inspector.servicesTitle" :summary="servicesSummary(block.services)">
                <template #info>
                    {{ t.inspector.servicesInfo }}
                </template>
                <div class="list" data-testid="services-fieldset">
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
                </div>
            </InspectorSection>
            <p v-if="context.servicesFailed" class="hint" data-testid="services-failed">{{ t.inspector.servicesFailed }}</p>
            <p v-else-if="context.services && !context.services.length" class="hint" data-testid="services-none">
                {{ t.inspector.servicesNone }}
            </p>
            <p v-else-if="choosableServices && !choosableServices.length" class="hint" data-testid="services-not-allowed">
                {{ t.inspector.servicesNotAllowed }}
            </p>
        </template>
    </template>

    <!-- Plan.md, 33: posts of ChurchTools groups, after the terminlists' cards. -->
    <template v-if="block.type === 'posts'">
        <InspectorSection id="post-groups" :title="t.inspector.groups" :summary="block.groupIds.length ? t.common.chosen(block.groupIds.length) : t.common.none">
            <template #info>{{ t.inspector.postGroupsInfo }}</template>
            <label v-for="g in context.groups" :key="g.id" class="check">
                <input
                    type="checkbox"
                    :checked="block.groupIds.includes(g.id)"
                    :data-testid="`post-group-${g.id}`"
                    @change="togglePostGroup(g.id, ($event.target as HTMLInputElement).checked)"
                >
                {{ g.name }}
                <span v-if="g.visibility !== 'public'" class="dimmed">{{ t.inspector.notPublic }}</span>
            </label>
            <p v-if="!context.groups.length" class="hint">{{ t.inspector.noPostGroups }}</p>
        </InspectorSection>
        <p
            v-if="block.groupIds.some((id) => context.groups.find((g) => g.id === id)?.visibility !== 'public')"
            class="hint"
            data-testid="posts-not-public"
        >
            {{ t.inspector.postsNotPublic }}
        </p>
        <label class="d-field d-field--inline">
            {{ t.inspector.appearance }}
            <select
                :value="block.layout"
                data-testid="posts-layout"
                @change="setBlock({ layout: ($event.target as HTMLSelectElement).value })"
            >
                <option value="card">{{ t.inspector.postsLayoutCard }}</option>
                <option value="list">{{ t.inspector.layoutList }}</option>
            </select>
        </label>
        <div class="grid2">
            <label class="d-field">
                {{ t.inspector.count }}
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
                {{ t.inspector.maxAgeDays }}
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
        <label v-if="block.layout === 'card'" class="d-field d-field--inline">
            {{ t.inspector.secondsPerPost }}
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
            {{ t.inspector.showImage }}
        </label>
        <label class="check">
            <input
                type="checkbox"
                :checked="block.showAuthor"
                @change="setBlock({ showAuthor: ($event.target as HTMLInputElement).checked })"
            >
            {{ t.inspector.showAuthor }}
        </label>
    </template>

    <!-- Plan.md, 43: groups of a ChurchTools group homepage, one at a time with a QR code or as a list. -->
    <template v-if="block.type === 'groups'">
        <HintRow>
            <label class="d-field d-field--inline">
                {{ t.inspector.groupsHomepage }}
                <select
                    :value="block.parentGroupId ?? ''"
                    data-testid="groups-homepage"
                    @change="setGroupsHomepage(($event.target as HTMLSelectElement).value)"
                >
                    <option value="">{{ t.inspector.choose }}</option>
                    <option v-for="h in context.homepages" :key="h.parentGroupId" :value="h.parentGroupId">{{ h.title }}</option>
                    <option v-if="groupsHomepageMissing" :value="block.parentGroupId">
                        {{ t.inspector.homepageGone }}
                    </option>
                </select>
            </label>
            <template #info>
                {{ t.inspector.homepageInfo }}
            </template>
        </HintRow>
        <p v-if="!context.homepages.length" class="hint">
            {{ t.inspector.noHomepage }}
        </p>

        <label class="check">
            <input
                type="checkbox"
                :checked="block.groupIds.length === 0"
                :disabled="block.groupIds.length === 0 && homepageGroupList.length === 0"
                data-testid="groups-all"
                @change="toggleAllGroups(($event.target as HTMLInputElement).checked)"
            >
            {{ t.inspector.allGroups }}
        </label>
        <label v-if="block.groupIds.length === 0" class="d-field d-field--inline">
            {{ t.inspector.order }}
            <select
                :value="block.sort"
                data-testid="groups-sort"
                @change="setBlock({ sort: ($event.target as HTMLSelectElement).value })"
            >
                <option value="weekday">{{ t.inspector.sortWeekday }}</option>
                <option value="name-asc">{{ t.inspector.sortNameAsc }}</option>
                <option value="name-desc">{{ t.inspector.sortNameDesc }}</option>
            </select>
        </label>

        <InspectorSection v-if="block.groupIds.length" id="group-list" :title="t.inspector.groups" :summary="t.common.chosen(block.groupIds.length)">
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
                        :aria-label="t.common.moveUp"
                        :title="t.common.moveUp"
                        :disabled="index === 0"
                        :data-testid="`group-up-${id}`"
                        @click="moveGroupId(index, index - 1)"
                    >
                        ↑
                    </button>
                    <button
                        class="d-btn d-btn--icon"
                        type="button"
                        :aria-label="t.common.moveDown"
                        :title="t.common.moveDown"
                        :disabled="index === block.groupIds.length - 1"
                        :data-testid="`group-down-${id}`"
                        @click="moveGroupId(index, index + 1)"
                    >
                        ↓
                    </button>
                </template>
                <span v-else-if="!homepageLoaded" class="dimmed">{{ t.inspector.groupNumber(id) }}</span>
                <template v-else>
                    <span class="dimmed">{{ t.inspector.groupGone(id) }}</span>
                    <span class="spacer" />
                    <button class="d-btn" type="button" :data-testid="`group-missing-${id}`" @click="removeGroupId(id)">
                        {{ t.common.remove }}
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
        </InspectorSection>

        <label class="d-field d-field--inline">
            {{ t.inspector.appearance }}
            <select
                :value="block.layout"
                data-testid="groups-layout"
                @change="setBlock({ layout: ($event.target as HTMLSelectElement).value })"
            >
                <option value="card">{{ t.inspector.groupsLayoutCard }}</option>
                <option value="list">{{ t.inspector.layoutList }}</option>
            </select>
        </label>
        <HintRow v-if="block.layout === 'card'">
            <label class="d-field d-field--inline">
                {{ t.inspector.groupsPerPage }}
                <select
                    :value="block.perPage"
                    data-testid="groups-per-page"
                    @change="setBlock({ perPage: Number(($event.target as HTMLSelectElement).value) })"
                >
                    <option v-for="n in 4" :key="n" :value="n">{{ n }}</option>
                </select>
            </label>
            <template v-if="block.perPage > 1" #info>
                {{ t.inspector.perPageInfo(block.width >= block.height) }}
            </template>
        </HintRow>
        <label class="d-field d-field--inline">
            {{ block.layout === 'card' && block.perPage === 1 ? t.inspector.secondsPerGroup : t.inspector.secondsPerPage }}
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

        <InspectorSection id="fields" :title="t.inspector.details" :summary="fieldsSummary">
            <template #info>
                {{ t.inspector.detailsInfo }}
            </template>
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
        </InspectorSection>
    </template>

    <!-- Plan.md, 46: which rooms are taken today – an overview or the door sign of the first room. -->
    <template v-if="block.type === 'rooms'">
        <label class="d-field d-field--inline">
            {{ t.inspector.roomsLayout }}
            <select
                :value="block.layout"
                data-testid="rooms-layout"
                @change="setBlock({ layout: ($event.target as HTMLSelectElement).value })"
            >
                <option value="overview">{{ t.inspector.roomsOverview }}</option>
                <option value="door">{{ t.inspector.roomsDoor }}</option>
            </select>
        </label>
        <label class="d-field d-field--inline">
            {{ t.inspector.days }}
            <select
                :value="block.days"
                data-testid="rooms-days"
                @change="setBlock({ days: Number(($event.target as HTMLSelectElement).value) })"
            >
                <option :value="1">{{ t.inspector.today }}</option>
                <option :value="2">{{ t.inspector.todayTomorrow }}</option>
            </select>
        </label>
        <label v-if="block.layout === 'overview'" class="d-field d-field--inline">
            {{ t.inspector.secondsPerPage }}
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
            {{ t.inspector.doorHint }}
        </p>

        <p v-if="context.rooms && !context.rooms.length" class="hint" data-testid="rooms-none">
            {{ t.inspector.noRooms }}
        </p>
        <div v-else-if="context.rooms" class="room-add">
            <select
                :disabled="!pickableRooms.length || block.rooms.length >= ROOMS_MAX"
                value=""
                :aria-label="t.inspector.addRoomLabel"
                data-testid="rooms-add"
                @change="pickRoom($event.target as HTMLSelectElement)"
            >
                <option value="">{{ t.inspector.addRoom }}</option>
                <option v-for="r in pickableRooms" :key="r.id" :value="r.id">{{ r.name }}</option>
            </select>
            <button
                class="d-btn"
                type="button"
                :disabled="!pickableRooms.length || block.rooms.length >= ROOMS_MAX"
                data-testid="rooms-add-all"
                @click="addRooms(pickableRooms)"
            >
                {{ t.inspector.addAllRooms }}
            </button>
        </div>
        <span v-if="context.rooms?.length" class="hint" data-testid="rooms-count">{{ t.common.countOf(block.rooms.length, ROOMS_MAX) }}</span>
        <p v-if="!block.rooms.length" class="hint">{{ t.inspector.noRoomsChosen }}</p>
        <InspectorSection v-else id="room-list" :title="t.inspector.rooms" :summary="t.inspector.roomCount(block.rooms.length)">
            <template #info>{{ t.inspector.roomsInfo }}</template>
            <div v-for="(entry, index) in block.rooms" :key="entry.resourceId" class="room-entry" data-testid="room-entry">
                <div class="room-head">
                    <span v-if="roomName(entry.resourceId)" class="room-name" :title="roomName(entry.resourceId)!" data-testid="room-name">
                        {{ roomName(entry.resourceId) }}
                    </span>
                    <span v-else class="room-name dimmed" data-testid="room-name">{{ t.inspector.roomHidden(entry.resourceId) }}</span>
                    <button
                        class="d-btn d-btn--icon"
                        type="button"
                        :aria-label="t.common.moveUp"
                        :title="t.common.moveUp"
                        :disabled="index === 0"
                        data-testid="room-up"
                        @click="moveRoom(index, index - 1)"
                    >
                        ↑
                    </button>
                    <button
                        class="d-btn d-btn--icon"
                        type="button"
                        :aria-label="t.common.moveDown"
                        :title="t.common.moveDown"
                        :disabled="index === block.rooms.length - 1"
                        data-testid="room-down"
                        @click="moveRoom(index, index + 1)"
                    >
                        ↓
                    </button>
                    <button
                        class="d-btn d-btn--icon"
                        type="button"
                        :aria-label="t.inspector.removeRoom"
                        :title="t.inspector.removeRoom"
                        data-testid="room-remove"
                        @click="removeRoom(index)"
                    >
                        <Icon name="close" :size="14" />
                    </button>
                </div>
                <label class="d-field d-field--inline">
                    {{ t.inspector.signpost }}
                    <input
                        type="text"
                        maxlength="100"
                        :value="entry.hint"
                        :placeholder="t.inspector.signpostPlaceholder"
                        data-testid="room-hint"
                        v-on="edit"
                        @input="setRoom(index, { hint: ($event.target as HTMLInputElement).value })"
                    >
                </label>
                <HintRow>
                    <label class="check">
                        <input
                            type="checkbox"
                            :checked="entry.showTitles"
                            data-testid="room-titles"
                            @change="setRoom(index, { showTitles: ($event.target as HTMLInputElement).checked })"
                        >
                        {{ t.inspector.showTitles }}
                    </label>
                    <template #info>
                        {{ t.inspector.showTitlesInfo }}
                    </template>
                </HintRow>
            </div>
        </InspectorSection>
    </template>

    <template v-if="block.type === 'church-header'">
        <label class="check">
            <input
                type="checkbox"
                :checked="block.showName"
                @change="setBlock({ showName: ($event.target as HTMLInputElement).checked })"
            >
            {{ t.inspector.showChurchName }}
        </label>
        <HintRow>
            <label class="check">
                <input
                    type="checkbox"
                    data-testid="show-logo"
                    :checked="block.showLogo"
                    @change="setBlock({ showLogo: ($event.target as HTMLInputElement).checked })"
                >
                {{ t.inspector.showLogo }}
            </label>
            <template #info>{{ t.inspector.logoInfo }}</template>
        </HintRow>
        <div v-if="block.showLogo" class="media-pick">
            <img v-if="mediaUrl(block.logoMediaId, 'max')" class="logo-preview" :src="mediaUrl(block.logoMediaId, 'max')!" alt="">
            <p v-else class="hint">{{ t.inspector.churchLogo }}</p>
            <button class="d-btn" type="button" data-testid="pick-logo" @click="context.pickImage('logo')">
                {{ t.inspector.pickLogo }}
            </button>
            <button
                v-if="block.logoMediaId"
                class="d-btn"
                type="button"
                data-testid="reset-logo"
                @click="setBlock({ logoMediaId: undefined })"
            >
                {{ t.inspector.resetLogo }}
            </button>
        </div>
    </template>

    <FontSection v-if="'style' in block" :block="block" />
</template>

<style scoped>
/* A checkbox list inside a section; the section brings the gap. */
.list {
    display: grid;
    gap: 8px;
}
.grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    align-items: end;
}
.check {
    display: flex;
    align-items: center;
    gap: 6px;
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
</style>
