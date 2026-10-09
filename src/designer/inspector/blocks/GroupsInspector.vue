<script setup lang="ts">
/**
 * The groups block (Plan.md 43, 79 B2): the groups of a ChurchTools group homepage, one at a time with a QR code or as a
 * list. Homepage and look go to the short menu.
 */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import { homepageGroups, selectGroups, type Group } from '../../../groups/normalize';
import type { Block, GroupFields } from '../../../model/schema';
import { useStageContext } from '../../../player/context';
import { GROUP_SECONDS } from '../../../player/paging';
import InspectorSection from '../../InspectorSection.vue';
import { useInspectorContext } from '../context';
import NumberField from '../fields/NumberField.vue';
import SegmentField from '../fields/SegmentField.vue';
import SelectField from '../fields/SelectField.vue';
import SortList, { type SortItem } from '../fields/SortList.vue';
import TileField from '../fields/TileField.vue';
import ToggleField from '../fields/ToggleField.vue';
import FontSection from '../FontSection.vue';
import { GROUPS_TILES } from '../layouts';
import { move as moveItem } from '../../ops';
import { useBlockEdit } from '../use-block';
import { useInspectorMode } from '../mode';

/** Labels in the order of `GroupFields` itself, so the fieldset needs no list of its own (Plan.md 43). */
const GROUP_SHOW_LABELS: Record<keyof GroupFields, string> = t.inspector.groupShow;
const GROUP_SHOW_KEYS = Object.keys(GROUP_SHOW_LABELS) as (keyof GroupFields)[];

const props = defineProps<{ block: Extract<Block, { type: 'groups' }> }>();
/** Only fields stand in the short menu; a hint or a line of text belongs to the inspector. */
const mode = useInspectorMode();
const { setBlock } = useBlockEdit(() => props.block);
/** The preview's stage context: the homepage's groups come from its live data. */
const stage = useStageContext();
const context = useInspectorContext();

const sorts = [
    { value: 'weekday', label: t.inspector.sortWeekday },
    { value: 'name-asc', label: t.inspector.sortNameAsc },
    { value: 'name-desc', label: t.inspector.sortNameDesc },
];
const perPages = [1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }));

/** The homepage's groups, from the preview's live data (Plan.md 43) – empty until it has loaded. */
const homepageGroupList = computed<Group[]>(() => homepageGroups(stage.groupHomepages, props.block.parentGroupId));

/** Whether the preview has the homepage yet – until then a chosen group is not "missing", only not loaded. */
const homepageLoaded = computed(() => (stage.groupHomepages ?? []).some((h) => h.parentGroupId === props.block.parentGroupId));

/**
 * Stored is the parent group's id, not the homepage's own id or hash – a group has at most one
 * homepage, and it survives the homepage being recreated (Plan.md 43, a). A fresh choice starts
 * without a selection: "every group, by weekday" until the designer picks some.
 */
function setHomepage(value: string | number): void {
    setBlock({ parentGroupId: value === '' ? undefined : Number(value), groupIds: [] });
}

/** Whether the stored parent group's homepage fell out of the list – its groups are gone from the TV (Plan.md 43, g). */
const homepageMissing = computed(() => props.block.parentGroupId !== undefined && !context.homepages.some((h) => h.parentGroupId === props.block.parentGroupId));

const homepages = computed(() => [
    { value: '', label: t.inspector.choose },
    ...context.homepages.map((h) => ({ value: h.parentGroupId, label: h.title })),
    ...(homepageMissing.value ? [{ value: props.block.parentGroupId!, label: t.inspector.homepageGone }] : []),
]);

/** Empty `groupIds` means "every group, in the chosen order"; switching it off starts from all of them, in that order. */
function toggleAll(all: boolean): void {
    setBlock({ groupIds: all ? [] : selectGroups(homepageGroupList.value, [], props.block.sort).map((g) => g.id) });
}

/** The chosen groups in their order; one the homepage no longer lists is named as gone (or only by number while it loads). */
const chosen = computed<SortItem[]>(() =>
    props.block.groupIds.map((id) => {
        const group = homepageGroupList.value.find((g) => g.id === id);
        if (group) return { key: id, label: group.name, keep: props.block.groupIds.length === 1 };
        return { key: id, label: homepageLoaded.value ? t.inspector.groupGone(id) : t.inspector.groupNumber(id), dimmed: true };
    }),
);

/** The homepage's groups not yet chosen, in the homepage's own order (Plan.md 43). */
const pickable = computed(() => {
    const picked = new Set(props.block.groupIds);
    return homepageGroupList.value.filter((g) => !picked.has(g.id));
});

/** New ones join at the end. */
function pick(id: number): void {
    setBlock({ groupIds: [...props.block.groupIds, id] });
}

function removeAt(index: number): void {
    setBlock({ groupIds: props.block.groupIds.filter((_, i) => i !== index) });
}

function move(from: number, to: number): void {
    if (to < 0 || to >= props.block.groupIds.length) return;
    setBlock({ groupIds: moveItem(props.block.groupIds, from, to) });
}

/** Folded sections say what is set inside (Plan.md 47). */
const fieldsSummary = computed(() => t.common.countOf(GROUP_SHOW_KEYS.filter((key) => props.block.show[key]).length, GROUP_SHOW_KEYS.length));
</script>

<template>
    <SelectField
        quick
        inline
        :model-value="block.parentGroupId ?? ''"
        :options="homepages"
        :label="t.inspector.groupsHomepage"
        testid="groups-homepage"
        @update:model-value="setHomepage"
    >
        <template #info>{{ t.inspector.homepageInfo }}</template>
    </SelectField>
    <p v-if="mode === 'full' && !context.homepages.length" class="hint">
        {{ t.inspector.noHomepage }}
    </p>

    <ToggleField
        :model-value="block.groupIds.length === 0"
        :label="t.inspector.allGroups"
        :disabled="block.groupIds.length === 0 && homepageGroupList.length === 0"
        testid="groups-all"
        @update:model-value="toggleAll"
    />
    <SegmentField
        v-if="block.groupIds.length === 0"
        :model-value="block.sort"
        :options="sorts"
        :label="t.inspector.order"
        testid="groups-sort"
        stacked
        @update:model-value="setBlock({ sort: $event })"
    >
        <template #info>{{ t.inspector.sortWeekdayInfo }}</template>
    </SegmentField>

    <InspectorSection v-if="block.groupIds.length" id="group-list" :title="t.inspector.groups" :summary="t.common.chosen(block.groupIds.length)">
        <SortList :items="chosen" :remove-label="t.common.remove" testid="group" @move="move" @remove="removeAt" />
        <ToggleField
            v-for="g in pickable"
            :key="g.id"
            :model-value="false"
            :label="g.name"
            :testid="`group-pick-${g.id}`"
            @update:model-value="pick(g.id)"
        />
    </InspectorSection>

    <TileField quick :model-value="block.layout" :options="GROUPS_TILES" :label="t.inspector.appearance" testid="groups-layout" @update:model-value="setBlock({ layout: $event })" />
    <SegmentField
        v-if="block.layout === 'card'"
        :model-value="block.perPage"
        :options="perPages"
        :label="t.inspector.groupsPerPage"
        testid="groups-per-page"
        @update:model-value="setBlock({ perPage: Number($event) })"
    >
        <template v-if="block.perPage > 1" #info>{{ t.inspector.perPageInfo(block.width >= block.height) }}</template>
    </SegmentField>
    <NumberField
        :model-value="block.pageSeconds ?? GROUP_SECONDS"
        :label="block.layout === 'card' && block.perPage === 1 ? t.inspector.secondsPerGroup : t.inspector.secondsPerPage"
        :unit="t.inspector.unitSeconds"
        :min="5"
        :max="120"
        testid="group-seconds"
        @update:model-value="setBlock({ pageSeconds: $event })"
    />

    <InspectorSection id="fields" :title="t.inspector.details" :summary="fieldsSummary">
        <template #info>
            {{ t.inspector.detailsInfo }}
        </template>
        <ToggleField
            v-for="key in GROUP_SHOW_KEYS"
            :key="key"
            :model-value="block.show[key]"
            :label="GROUP_SHOW_LABELS[key]"
            :disabled="(block.layout === 'list' && (key === 'note' || key === 'qr' || key === 'leaderImages')) || (key === 'leaderImages' && !block.show.leaders)"
            :testid="`group-show-${key}`"
            @update:model-value="setBlock({ show: { ...block.show, [key]: $event } })"
        />
    </InspectorSection>
    <FontSection :block="block" />
</template>

<style scoped>
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
