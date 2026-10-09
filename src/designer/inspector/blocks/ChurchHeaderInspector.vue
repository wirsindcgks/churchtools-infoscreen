<script setup lang="ts">
/**
 * The church header (Plan.md 79, B2): whether the name and the logo show, and which logo. Name, logo and (from the font
 * section) the colour go to the short menu; choosing a logo does not.
 */
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import { useInspectorContext } from '../context';
import MediaField from '../fields/MediaField.vue';
import ToggleField from '../fields/ToggleField.vue';
import FontSection from '../FontSection.vue';
import { useBlockEdit } from '../use-block';

const props = defineProps<{ block: Extract<Block, { type: 'church-header' }> }>();
const { setBlock, mediaUrl } = useBlockEdit(() => props.block);
const context = useInspectorContext();
</script>

<template>
    <ToggleField quick :model-value="block.showName" :label="t.inspector.showChurchName" :quick-label="t.quick.short.name" testid="show-name" @update:model-value="setBlock({ showName: $event })" />
    <ToggleField quick :model-value="block.showLogo" :label="t.inspector.showLogo" :quick-label="t.quick.short.logo" testid="show-logo" @update:model-value="setBlock({ showLogo: $event })">
        <template #info>{{ t.inspector.logoInfo }}</template>
    </ToggleField>
    <MediaField
        v-if="block.showLogo"
        contain
        :filled="!!block.logoMediaId"
        :pick-label="t.inspector.pickLogo"
        :swap-label="t.inspector.swapLogo"
        :preview-url="mediaUrl(block.logoMediaId, 'max')"
        :caption="mediaUrl(block.logoMediaId, 'max') ? null : t.inspector.churchLogo"
        caption-muted
        testid="pick-logo"
        @pick="context.pickImage('logo')"
    >
        <button v-if="block.logoMediaId" class="d-btn media-reset" type="button" data-testid="reset-logo" @click="setBlock({ logoMediaId: undefined })">
            {{ t.inspector.resetLogo }}
        </button>
    </MediaField>
    <FontSection :block="block" />
</template>

<style scoped>
.media-reset {
    justify-content: center;
}
</style>
