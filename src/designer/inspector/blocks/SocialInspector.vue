<script setup lang="ts">
/**
 * The social media block (Plan.md 80): the profiles by their links, the arrangement and the brand colours. The mark and
 * the name come from the link (`socialProfile`); a name typed here wins. Links, arrangement and colours go to the short menu.
 */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import type { Block, SocialLink } from '../../../model/schema';
import SocialMark from '../../../player/blocks/SocialMark.vue';
import { socialName, socialProfile } from '../../../player/social';
import InspectorSection from '../../InspectorSection.vue';
import QuickField from '../fields/QuickField.vue';
import SegmentField from '../fields/SegmentField.vue';
import SortList, { type SortItem } from '../fields/SortList.vue';
import TextField from '../fields/TextField.vue';
import ToggleField from '../fields/ToggleField.vue';
import { move as moveItem } from '../../ops';
import { useBlockEdit } from '../use-block';

/** Most links a block holds – the schema's limit. */
const SOCIAL_MAX = 12;

const props = defineProps<{ block: Extract<Block, { type: 'social' }> }>();
const { setBlock } = useBlockEdit(() => props.block);

const layouts = [
    { value: 'column', label: t.inspector.socialColumn },
    { value: 'row', label: t.inspector.socialRow },
];

const chosen = computed<SortItem[]>(() => props.block.links.map((link, index) => ({ key: index, label: socialName(link) || link.url })));

/** The field empties itself after the link joined the list; an empty entry changes nothing. */
function add(text: string): void {
    const url = text.trim();
    if (!url || props.block.links.length >= SOCIAL_MAX) return;
    setBlock({ links: [...props.block.links, { url }] });
}

function setLink(index: number, patch: Partial<SocialLink>): void {
    setBlock({ links: props.block.links.map((l, i) => (i === index ? { ...l, ...patch } : l)) });
}

function move(from: number, to: number): void {
    if (to < 0 || to >= props.block.links.length) return;
    setBlock({ links: moveItem(props.block.links, from, to) });
}

function remove(index: number): void {
    setBlock({ links: props.block.links.filter((_, i) => i !== index) });
}
</script>

<template>
    <!-- Adding and ordering the profiles are one chip "Profile · 2" in the short menu, the first field of the block. -->
    <QuickField quick :label="t.inspector.socialProfiles" :face="t.quick.count(t.inspector.socialProfiles, block.links.length)">
        <TextField
            stacked
            commit="change"
            inputmode="url"
            :model-value="''"
            :label="t.inspector.socialAdd"
            :placeholder="t.inspector.socialAddPlaceholder"
            :disabled="block.links.length >= SOCIAL_MAX"
            testid="social-add"
            @update:model-value="add"
        >
            <template #info>{{ t.inspector.socialInfo }}</template>
        </TextField>
        <span class="hint" data-testid="social-count">{{ t.common.countOf(block.links.length, SOCIAL_MAX) }}</span>
        <p v-if="block.links.length >= SOCIAL_MAX" class="hint">{{ t.inspector.socialFull }}</p>
        <p v-if="!block.links.length" class="hint">{{ t.inspector.socialEmpty }}</p>
        <InspectorSection v-else id="social-list" :title="t.inspector.socialProfiles" :summary="t.quick.count(t.inspector.socialProfiles, block.links.length)">
            <SortList :items="chosen" :remove-label="t.inspector.socialRemove" testid="social" row-testid="social-entry" @move="move" @remove="remove">
                <template #lead="{ index }">
                    <span class="mark"><SocialMark :kind="socialProfile(block.links[index]!.url).platform" :brand="block.brandColors !== false" :block-id="block.id" /></span>
                </template>
                <template #row="{ index }">
                    <TextField
                        stacked
                        commit="change"
                        inputmode="url"
                        :model-value="block.links[index]!.url"
                        :label="t.inspector.socialLink"
                        :maxlength="500"
                        testid="social-url"
                        @update:model-value="setLink(index, { url: $event.trim() })"
                    />
                    <TextField
                        stacked
                        :model-value="block.links[index]!.label ?? ''"
                        :label="t.inspector.socialLabel"
                        :placeholder="socialProfile(block.links[index]!.url).name"
                        :maxlength="100"
                        testid="social-label"
                        @update:model-value="setLink(index, { label: $event })"
                    />
                </template>
            </SortList>
        </InspectorSection>
    </QuickField>

    <SegmentField quick stacked :model-value="block.layout ?? 'column'" :options="layouts" :label="t.inspector.socialLayout" testid="social-layout" @update:model-value="setBlock({ layout: $event as 'column' | 'row' })" />
    <ToggleField quick :model-value="block.brandColors !== false" :label="t.inspector.socialBrand" testid="social-brand" @update:model-value="setBlock({ brandColors: $event })" />
</template>

<style scoped>
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.mark {
    display: grid;
    flex: none;
    width: 22px;
    font-size: 15px;
}
</style>
