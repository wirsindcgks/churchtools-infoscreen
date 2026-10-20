<script setup lang="ts">
/**
 * The posts block (Plan.md 33, 79 B2): the groups whose posts show (with the hint on non-public ones), then as the look the picture tiles, how many posts from
 * how long ago, how long each stays and what a post shows. Groups and look go to the short menu.
 */
import { computed, ref } from 'vue';
import { t } from '../../../i18n/designer';
import { th } from '../../../i18n/help';
import type { Block } from '../../../model/schema';
import { POST_SECONDS } from '../../../player/paging';
import InspectorSection from '../../InspectorSection.vue';
import { useInspectorContext } from '../context';
import NumberField from '../fields/NumberField.vue';
import SegmentField from '../fields/SegmentField.vue';
import TileField from '../fields/TileField.vue';
import QuickField from '../fields/QuickField.vue';
import ToggleField from '../fields/ToggleField.vue';
import FontSection from '../FontSection.vue';
import { TOGGLE_LIST_SEARCH_FROM, matchesName } from '../../name-search';
import SearchField from '../../SearchField.vue';
import { POSTS_TILES } from '../layouts';
import type { HelpTopic } from '../../help/types';
import { useBlockEdit } from '../use-block';
import { useInspectorMode } from '../mode';

const props = defineProps<{ block: Extract<Block, { type: 'posts' }> }>();
/** Only fields stand in the short menu; a hint or a line of text belongs to the inspector. */
const mode = useInspectorMode();
const { setBlock } = useBlockEdit(() => props.block);
const context = useInspectorContext();

const fits = [
    { value: 'cover', label: t.inspector.fitCover },
    { value: 'contain', label: t.inspector.fitContain },
];
const focuses = [
    { value: 'center', label: t.inspector.focusCenter },
    { value: 'top', label: t.inspector.focusTop },
    { value: 'bottom', label: t.inspector.focusBottom },
    { value: 'left', label: t.inspector.focusLeft },
    { value: 'right', label: t.inspector.focusRight },
];

/** Labels in the order the switches stand (Plan.md 96); the list shows neither picture nor name. */
const SHOW_LABELS = t.inspector.postShow;
const SHOW_KEYS = ['showGroup', 'showTitle', 'showImage', 'showText', 'showAuthor', 'showDate'] as const satisfies readonly (keyof typeof SHOW_LABELS)[];
const fieldsSummary = computed(() => t.common.countOf(SHOW_KEYS.filter((key) => props.block[key]).length, SHOW_KEYS.length));

/** The settings of "Darstellung" that explain themselves – only those that are there now. */
const p = th.posts;
const appearanceHelp = computed<HelpTopic>(() => {
    const card = props.block.layout === 'card';
    const image = card && props.block.showImage;
    return {
        intro: p.intro,
        items: [
            p.view,
            p.count,
            p.period,
            ...(card ? [p.seconds] : []),
            ...(image ? [p.fit] : []),
            ...(image && props.block.imageFit === 'cover' ? [p.focus] : []),
        ],
    };
});

const summary = computed(() => `${POSTS_TILES.find((o) => o.value === props.block.layout)?.label} · ${t.inspector.days(props.block.maxAgeDays)}`);

/** The fold and the chip of the short menu say it alike: "2 von 10". */
const groupsSummary = computed(() => t.common.countOf(props.block.groupIds.length, context.groups.length));

/** Many groups get a search (Plan.md 93); a chosen group stays in the list whatever it says. */
const query = ref('');
const searchable = computed(() => context.groups.length >= TOGGLE_LIST_SEARCH_FROM);
const groupsShown = computed(() => context.groups.filter((g) => props.block.groupIds.includes(g.id) || matchesName(g.name, query.value)));
/** Only chosen ones left: the search found nothing new. */
const nothingFound = computed(() => searchable.value && !!query.value.trim() && groupsShown.value.every((g) => props.block.groupIds.includes(g.id)));

/** Empty is allowed here (Plan.md 33): a fresh block starts without a group until one is chosen. */
function toggleGroup(id: number, on: boolean): void {
    const next = on ? [...props.block.groupIds, id] : props.block.groupIds.filter((g) => g !== id);
    setBlock({ groupIds: [...new Set(next)].sort((a, b) => a - b) });
}
</script>

<template>
    <!-- One chip "Gruppen 2 von 10" in the short menu, so a double click on the block can lead here (Plan.md 79, C5). -->
    <QuickField quick :label="t.inspector.groups" :face="block.groupIds.length ? t.quick.listFace(t.inspector.groups, groupsSummary) : t.quick.empty.posts">
        <InspectorSection id="post-groups" :title="t.inspector.groups" :summary="block.groupIds.length ? groupsSummary : t.common.none" :help="p.groups">
            <SearchField v-if="searchable" v-model="query" :placeholder="t.common.searchList" :label="t.common.searchList" testid="post-groups-search" />
            <ToggleField
                v-for="g in groupsShown"
                :key="g.id"
                :model-value="block.groupIds.includes(g.id)"
                :label="g.visibility !== 'public' ? `${g.name} · ${t.inspector.notPublic}` : g.name"
                :testid="`post-group-${g.id}`"
                @update:model-value="toggleGroup(g.id, $event)"
            />
            <p v-if="nothingFound" class="hint" data-testid="post-groups-search-empty">{{ t.common.nothingFound(query) }}</p>
            <p v-if="!context.groups.length" class="hint">{{ t.inspector.noPostGroups }}</p>
            <p v-if="mode === 'full' && block.groupIds.some((id) => context.groups.find((g) => g.id === id)?.visibility !== 'public')" class="hint" data-testid="posts-not-public">
                {{ t.inspector.postsNotPublic }}
            </p>
        </InspectorSection>
    </QuickField>
    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="summary" :help="appearanceHelp">
        <TileField quick :model-value="block.layout" :options="POSTS_TILES" :label="t.inspector.view" testid="posts-layout" @update:model-value="setBlock({ layout: $event })" />
        <NumberField :model-value="block.limit" :label="t.inspector.count" :min="1" :max="10" testid="posts-limit" @update:model-value="setBlock({ limit: $event })" />
        <NumberField
            :model-value="block.maxAgeDays"
            :label="t.inspector.period"
            :unit="t.inspector.unitDays(block.maxAgeDays)"
            :min="1"
            :max="365"
            testid="posts-days"
            @update:model-value="setBlock({ maxAgeDays: $event })"
        />
        <NumberField
            v-if="block.layout === 'card'"
            :model-value="block.pageSeconds ?? POST_SECONDS"
            :label="t.inspector.secondsPerPost"
            :unit="t.inspector.unitSeconds"
            :min="5"
            :max="120"
            testid="post-seconds"
            @update:model-value="setBlock({ pageSeconds: $event })"
        />
        <template v-if="block.layout === 'card' && block.showImage">
            <SegmentField :model-value="block.imageFit" :options="fits" :label="t.inspector.fit" testid="posts-fit" @update:model-value="setBlock({ imageFit: $event })" />
            <SegmentField
                v-if="block.imageFit === 'cover'"
                :model-value="block.imageFocus"
                :options="focuses"
                :label="t.inspector.focus"
                testid="posts-focus"
                stacked
                @update:model-value="setBlock({ imageFocus: $event })"
            />
        </template>
    </InspectorSection>
    <InspectorSection id="fields" :title="t.inspector.details" :summary="fieldsSummary" :help="p.details">
        <ToggleField
            v-for="key in SHOW_KEYS"
            :key="key"
            :model-value="block[key]"
            :label="SHOW_LABELS[key]"
            :disabled="block.layout === 'list' && (key === 'showImage' || key === 'showAuthor')"
            :testid="key === 'showImage' ? 'posts-image' : key === 'showAuthor' ? 'posts-author' : `posts-${key.slice(4).toLowerCase()}`"
            @update:model-value="setBlock({ [key]: $event })"
        />
    </InspectorSection>
    <FontSection :block="block" effects="shadow" />
</template>

<style scoped>
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
