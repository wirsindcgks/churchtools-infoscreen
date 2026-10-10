<script setup lang="ts">
/** The web page block (Plan.md 79, B2): its address and the size of the page in the box. Both go to the short menu. */
import { ref } from 'vue';
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import { embedAddress, webRefusal, withScheme } from '../../../player/web';
import SelectField from '../fields/SelectField.vue';
import TextField from '../fields/TextField.vue';
import { useBlockEdit } from '../use-block';
import { useInspectorMode } from '../mode';

const props = defineProps<{ block: Extract<Block, { type: 'web' }> }>();
/** Only fields stand in the short menu; a hint or a line of text belongs to the inspector. */
const mode = useInspectorMode();
const { setBlock } = useBlockEdit(() => props.block);

const zooms = [
    { value: 0.5, label: t.inspector.webZooms[50] },
    { value: 0.75, label: t.inspector.webZooms[75] },
    { value: 1, label: t.inspector.webZooms[100] },
    { value: 1.5, label: t.inspector.webZooms[150] },
    { value: 2, label: t.inspector.webZooms[200] },
    { value: 3, label: t.inspector.webZooms[300] },
];

/** Why an address is not shown – or null when it is. */
function webProblem(url: string): string | null {
    if (!url.trim()) return t.inspector.webEmpty;
    const refusal = webRefusal(url, window.location.origin);
    if (refusal === 'own-instance') return t.inspector.webOwnInstance;
    return refusal ? t.inspector.webHttps : null;
}

/** The block whose pasted embed code held no address – shown until its next change. */
const embedProblemBlock = ref<string | null>(null);

/** An embed code pasted into the address field gives its address; without one the block stays as it was (and the field shows that again). */
function setUrl(pasted: string): void {
    const address = embedAddress(pasted);
    if (!address && /<iframe/i.test(pasted)) {
        embedProblemBlock.value = props.block.id;
        return;
    }
    embedProblemBlock.value = null;
    setBlock({ url: withScheme(address) });
}
</script>

<template>
    <TextField
        quick
        stacked
        commit="change"
        input-id="web-url-input"
        inputmode="url"
        :model-value="block.url"
        :label="t.inspector.webAddress"
        testid="web-url"
        @update:model-value="setUrl"
    >
        <template #info>{{ t.inspector.webInfo }}</template>
    </TextField>
    <p v-if="mode === 'full' && embedProblemBlock === block.id" class="hint" data-testid="web-problem">{{ t.inspector.webNoAddressInCode }}</p>
    <p v-else-if="mode === 'full' && webProblem(block.url)" class="hint" data-testid="web-problem">{{ webProblem(block.url) }}</p>
    <SelectField quick :model-value="block.zoom" :options="zooms" :label="t.inspector.webSize" testid="web-zoom" @update:model-value="setBlock({ zoom: Number($event) })" />
</template>

<style scoped>
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
