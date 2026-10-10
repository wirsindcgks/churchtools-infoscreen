<script setup lang="ts">
/**
 * The frame of the inspector (Plan.md 79, B2): the head with its four buttons, the inspector of the chosen block, then
 * "Anordnen" and "Genaue Maße". With several blocks chosen (D5) the head says "3 Bausteine" and only "Anordnen" follows.
 * Without a block the slide and the playlist show instead. What a block shows lives in
 * `inspector/blocks/`, one component per type.
 */
import { computed } from 'vue';
import type { Calendar, PostGroup } from '../ct/api';
import { t } from '../i18n/designer';
import type { HomepageEntry } from '../groups/normalize';
import type { RoomInfo } from '../rooms/normalize';
import type { ServiceInfo } from '../appointments/services';
import { useEditorStore } from './editor-store';
import ArrangeField from './ArrangeField.vue';
import Icon from './Icon.vue';
import InspectorSection from './InspectorSection.vue';
import { BLOCK_INSPECTORS } from './inspector/blocks';
import { provideInspectorContext } from './inspector/context';
import NumberField from './inspector/fields/NumberField.vue';
import SlideInspector from './inspector/SlideInspector.vue';
import LayerList from './LayerList.vue';
import { layerRows } from './layers';
import { BLOCK_ICONS, BLOCK_LABELS } from './ops';
import { KEYS, withKeys } from './shortcuts';
import { vTip } from './tip';

/** `rooms`: the rooms the designer may see; null while they are not loaded yet. */
const props = defineProps<{ calendars: Calendar[]; hiddenCalendars?: Calendar[]; groups: PostGroup[]; homepages: HomepageEntry[]; rooms: RoomInfo[] | null; services?: ServiceInfo[] | null; allowedServices?: number[]; servicesFailed?: boolean }>();
/** `picked`: a block was chosen from the list of the slide's blocks (on a phone the sheet closes then). */
const emit = defineEmits<{ 'pick-image': ['block' | 'background' | 'logo' | 'slideshow' | 'video']; picked: [] }>();

// The inspectors below read the lists through getters, so they follow the props.
provideInspectorContext(() => props, (kind) => emit('pick-image', kind));

const editor = useEditorStore();
const block = computed(() => editor.block);
const selection = computed(() => editor.selection);
const ids = computed(() => editor.selectedBlockIds);
const allLocked = computed(() => selection.value.length > 0 && selection.value.every((b) => b.locked));
const many = computed(() => selection.value.length > 1);

const FRAME_FIELDS = [
    { key: 'x', min: undefined },
    { key: 'y', min: undefined },
    { key: 'width', min: 1 },
    { key: 'height', min: 1 },
] as const;

/** Folded sections say what is set inside (Plan.md 47). */
const positionSummary = computed(() =>
    block.value ? `${block.value.x}, ${block.value.y} · ${block.value.width} × ${block.value.height}` : '',
);

/** The layers, top first. */
const rows = computed(() => layerRows(editor.slide?.blocks ?? []));
const layerNumber = computed(() => (block.value ? (editor.slide?.blocks.findIndex((b) => b.id === block.value!.id) ?? -1) + 1 : 0));
const LAYERS = [
    { where: 'front', icon: 'layer-front', label: t.inspector.layers.front },
    { where: 'forward', icon: 'layer-forward', label: t.inspector.layers.forward },
    { where: 'backward', icon: 'layer-backward', label: t.inspector.layers.backward },
    { where: 'back', icon: 'layer-back', label: t.inspector.layers.back },
] as const;
</script>

<template>
    <aside class="inspector">
        <section v-if="selection.length" data-testid="block-inspector">
            <div class="block-head">
                <h3>
                    <template v-if="block">
                        <Icon :name="BLOCK_ICONS[block.type]" :size="18" />
                        {{ BLOCK_LABELS[block.type] }}
                    </template>
                    <template v-else>
                        <Icon name="grid" :size="18" />
                        <span data-testid="multi-title">{{ editor.groupSelected ? t.editor.groupCount(selection.length) : t.editor.blocksCount(selection.length) }}</span>
                    </template>
                </h3>
                <div class="head-actions">
                    <!-- Plan.md, 25: locked, the whole block stays as it is until unlocked. -->
                    <button
                        v-tip="many ? (allLocked ? t.inspector.unlockBlocksTitle : t.inspector.lockBlocksTitle) : allLocked ? t.inspector.lockedTitle : t.inspector.lockTitle"
                        class="d-btn d-btn--icon"
                        :class="{ 'lock-toggle--on': allLocked }"
                        type="button"
                        :aria-pressed="allLocked"
                        :aria-label="allLocked ? t.common.locked : t.common.lock"
                        data-testid="lock-toggle"
                        @click="editor.setLocked(ids, !allLocked)"
                    >
                        <Icon :name="allLocked ? 'lock' : 'unlock'" :size="18" />
                    </button>
                    <button
                        v-if="editor.canGroup"
                        v-tip="withKeys(t.common.group, KEYS.group)"
                        class="d-btn d-btn--icon"
                        type="button"
                        :aria-label="t.common.group"
                        data-testid="inspector-group"
                        @click="editor.groupBlocks(ids)"
                    >
                        <Icon name="group" :size="18" />
                    </button>
                    <button
                        v-if="editor.canUngroup"
                        v-tip="withKeys(t.common.ungroup, KEYS.ungroup)"
                        class="d-btn d-btn--icon"
                        type="button"
                        :aria-label="t.common.ungroup"
                        data-testid="inspector-ungroup"
                        @click="editor.ungroupBlocks(ids)"
                    >
                        <Icon name="ungroup" :size="18" />
                    </button>
                    <button
                        v-tip="withKeys(many ? t.inspector.duplicateBlocks : t.inspector.duplicateBlock, KEYS.duplicate)"
                        class="d-btn d-btn--icon"
                        type="button"
                        :aria-label="many ? t.inspector.duplicateBlocks : t.inspector.duplicateBlock"
                        data-testid="block-duplicate"
                        @click="editor.duplicateBlocks(ids)"
                    >
                        <Icon name="duplicate" :size="18" />
                    </button>
                    <button
                        v-tip="withKeys(many ? t.inspector.copyBlocks : t.inspector.copyBlock, KEYS.copy)"
                        class="d-btn d-btn--icon"
                        type="button"
                        :aria-label="many ? t.inspector.copyBlocks : t.inspector.copyBlock"
                        data-testid="block-copy"
                        @click="editor.copyBlocks(ids)"
                    >
                        <Icon name="copy" :size="18" />
                    </button>
                    <button
                        v-tip="withKeys(many ? t.inspector.deleteBlocks : t.inspector.deleteBlock, KEYS.delete)"
                        class="d-btn d-btn--icon d-btn--danger delete-btn"
                        type="button"
                        :aria-label="many ? t.inspector.deleteBlocks : t.inspector.deleteBlock"
                        :disabled="allLocked"
                        data-testid="block-delete"
                        @click="editor.removeBlocks(ids)"
                    >
                        <Icon name="trash" :size="18" />
                    </button>
                </div>
            </div>
            <p v-if="block?.locked" class="hint" data-testid="locked-hint">
                {{ t.inspector.lockedHint }}
            </p>
            <!-- A disabled fieldset disables every field and button inside it at once; a summary is none, so sections still fold. -->
            <fieldset class="lockable" :disabled="!!block?.locked">
                <component :is="BLOCK_INSPECTORS[block.type]" v-if="block" :block="block" />

                <InspectorSection id="arrange" :title="t.inspector.arrange" default-open>
                    <ArrangeField />
                    <p v-if="block" class="layer-position" data-testid="layer-position">{{ t.inspector.layerOf(layerNumber, rows.length) }}</p>
                    <LayerList @picked="emit('picked')" />
                    <div class="layer-buttons">
                        <button
                            v-for="layer in LAYERS"
                            :key="layer.where"
                            v-tip="layer.label"
                            class="d-btn d-btn--icon"
                            type="button"
                            :aria-label="layer.label"
                            :data-testid="`layer-${layer.where}`"
                            @click="editor.layerBlocks(ids, layer.where)"
                        >
                            <Icon :name="layer.icon" :size="16" />
                        </button>
                    </div>
                </InspectorSection>

                <InspectorSection v-if="block" id="measures" :title="t.inspector.measures" :summary="positionSummary">
                    <div class="measures">
                        <NumberField
                            v-for="field in FRAME_FIELDS"
                            :key="field.key"
                            stacked
                            unit="px"
                            :model-value="block[field.key]"
                            :min="field.min"
                            :label="t.inspector.frameFields[field.key]"
                            :testid="`inspector-${field.key}`"
                            @update:model-value="editor.updateBlock(block.id, { [field.key]: $event })"
                        />
                    </div>
                </InspectorSection>
            </fieldset>
        </section>

        <template v-else>
            <!-- Without a block chosen the slide's blocks come first, for the finger and for blocks hidden under others. -->
            <InspectorSection v-if="rows.length" id="slide-blocks" :title="t.inspector.slideBlocks" default-open class="slide-blocks" data-testid="slide-blocks">
                <p class="layer-position">{{ t.inspector.topIsFront }}</p>
                <LayerList @picked="emit('picked')" />
            </InspectorSection>
            <!-- Slide and playlist -->
            <SlideInspector />
        </template>
    </aside>
</template>

<style scoped>
.inspector {
    overflow-y: auto;
    min-height: 0;
    padding: var(--d-space-1) var(--d-space-4) var(--d-space-5);
    /* The surface is the card around it (the editor's column, or the sheet at the bottom). */
}
/* Phone and tablet upright: in the editor's sheet now (Plan.md 44, M4; 45) – it owns the border and the max-height. */
@media (max-width: 48rem), (min-width: 48.0625rem) and (max-width: 75rem) and (orientation: portrait) {
    .inspector {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        /* The sheet scrolls up and down only; the fields follow the width of the phone (Plan.md 44). */
        overflow-x: hidden;
        padding-top: var(--d-space-3);
    }
}
section {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--d-space-3);
}
h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 1.05em;
}
.layer-position {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
/* The first part of the inspector: no line above it, one below, then the slide's own fields. */
.inspector .slide-blocks {
    margin-bottom: var(--d-space-3);
    border-top: 0;
    border-bottom: 1px solid var(--d-divider);
}
.layer-buttons {
    display: flex;
    gap: var(--d-space-1);
}
.block-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--d-space-2);
}
/* Lock, duplicate and copy on the left, the wastebasket alone on the right (Plan.md 79, B3). */
.head-actions {
    display: flex;
    gap: var(--d-space-1);
}
.delete-btn {
    margin-left: auto;
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
    gap: var(--d-space-3);
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
    margin-top: calc(var(--d-space-3) * -1);
}
.measures {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--d-space-2) var(--d-space-3);
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
