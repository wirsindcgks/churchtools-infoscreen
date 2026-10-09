<script setup lang="ts">
/**
 * The posts block (Plan.md 33, 79 B2): the groups whose posts show, the look as picture tiles, how many posts from
 * how long ago, how long each stays. Groups and look go to the short menu.
 */
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import { POST_SECONDS } from '../../../player/paging';
import InspectorSection from '../../InspectorSection.vue';
import { useInspectorContext } from '../context';
import NumberField from '../fields/NumberField.vue';
import TileField from '../fields/TileField.vue';
import QuickField from '../fields/QuickField.vue';
import ToggleField from '../fields/ToggleField.vue';
import FontSection from '../FontSection.vue';
import { POSTS_TILES } from '../layouts';
import { useBlockEdit } from '../use-block';
import { useInspectorMode } from '../mode';

const props = defineProps<{ block: Extract<Block, { type: 'posts' }> }>();
/** Only fields stand in the short menu; a hint or a line of text belongs to the inspector. */
const mode = useInspectorMode();
const { setBlock } = useBlockEdit(() => props.block);
const context = useInspectorContext();

/** Empty is allowed here (Plan.md 33): a fresh block starts without a group until one is chosen. */
function toggleGroup(id: number, on: boolean): void {
    const next = on ? [...props.block.groupIds, id] : props.block.groupIds.filter((g) => g !== id);
    setBlock({ groupIds: [...new Set(next)].sort((a, b) => a - b) });
}
</script>

<template>
    <!-- One chip "Gruppen · 2" in the short menu, so a double click on the block can lead here (Plan.md 79, C5). -->
    <QuickField quick :label="t.inspector.groups" :face="t.quick.count(t.inspector.groups, block.groupIds.length)">
        <InspectorSection id="post-groups" :title="t.inspector.groups" :summary="block.groupIds.length ? t.common.chosen(block.groupIds.length) : t.common.none">
            <template #info>{{ t.inspector.postGroupsInfo }}</template>
            <ToggleField
                v-for="g in context.groups"
                :key="g.id"
                :model-value="block.groupIds.includes(g.id)"
                :label="g.visibility !== 'public' ? `${g.name} · ${t.inspector.notPublic}` : g.name"
                :testid="`post-group-${g.id}`"
                @update:model-value="toggleGroup(g.id, $event)"
            />
            <p v-if="!context.groups.length" class="hint">{{ t.inspector.noPostGroups }}</p>
        </InspectorSection>
    </QuickField>
    <p v-if="mode === 'full' && block.groupIds.some((id) => context.groups.find((g) => g.id === id)?.visibility !== 'public')" class="hint" data-testid="posts-not-public">
        {{ t.inspector.postsNotPublic }}
    </p>
    <TileField quick :model-value="block.layout" :options="POSTS_TILES" :label="t.inspector.appearance" testid="posts-layout" @update:model-value="setBlock({ layout: $event })" />
    <NumberField :model-value="block.limit" :label="t.inspector.count" :min="1" :max="10" testid="posts-limit" @update:model-value="setBlock({ limit: $event })" />
    <NumberField
        :model-value="block.maxAgeDays"
        :label="t.inspector.period"
        :unit="t.inspector.unitDays"
        :min="1"
        :max="365"
        testid="posts-days"
        @update:model-value="setBlock({ maxAgeDays: $event })"
    >
        <template #info>{{ t.inspector.periodPostsInfo }}</template>
    </NumberField>
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
    <ToggleField :model-value="block.showImage" :label="t.inspector.showImage" testid="posts-image" @update:model-value="setBlock({ showImage: $event })" />
    <ToggleField :model-value="block.showAuthor" :label="t.inspector.showAuthor" testid="posts-author" @update:model-value="setBlock({ showAuthor: $event })" />
    <FontSection :block="block" />
</template>

<style scoped>
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
