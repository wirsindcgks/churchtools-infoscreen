<script setup lang="ts">
/**
 * The frame of the inspector (Plan.md 79, B2): the head with its four buttons, the inspector of the chosen block, then
 * "Anordnen" and "Genaue Maße". Without a block the slide and the playlist show instead. What a block shows lives in
 * `inspector/blocks/`, one component per type.
 */
import { computed, provide, ref } from 'vue';
import type { Calendar, PostGroup } from '../ct/api';
import { t } from '../i18n/designer';
import type { HomepageEntry } from '../groups/normalize';
import type { RoomInfo } from '../rooms/normalize';
import type { ServiceInfo } from '../appointments/services';
import { useEditorStore } from './editor-store';
import Icon from './Icon.vue';
import InspectorSection from './InspectorSection.vue';
import { BLOCK_INSPECTORS } from './inspector/blocks';
import { INSPECTOR_CONTEXT } from './inspector/context';
import NumberField from './inspector/fields/NumberField.vue';
import SlideInspector from './inspector/SlideInspector.vue';
import { layerRows, blockSummary } from './layers';
import { BLOCK_ICONS, BLOCK_LABELS } from './ops';
import { KEYS, withKeys } from './shortcuts';
import { vTip } from './tip';
import { useSortable } from './useSortable';

/** `rooms`: the rooms the designer may see; null while they are not loaded yet. */
const props = defineProps<{ calendars: Calendar[]; hiddenCalendars?: Calendar[]; groups: PostGroup[]; homepages: HomepageEntry[]; rooms: RoomInfo[] | null; services?: ServiceInfo[] | null; allowedServices?: number[]; servicesFailed?: boolean }>();
const emit = defineEmits<{ 'pick-image': ['block' | 'background' | 'logo' | 'slideshow' | 'video'] }>();

// The inspectors below read the lists through getters, so they follow the props.
provide(INSPECTOR_CONTEXT, {
    pickImage: (kind) => emit('pick-image', kind),
    get calendars() {
        return props.calendars;
    },
    get hiddenCalendars() {
        return props.hiddenCalendars;
    },
    get groups() {
        return props.groups;
    },
    get homepages() {
        return props.homepages;
    },
    get rooms() {
        return props.rooms;
    },
    get services() {
        return props.services;
    },
    get allowedServices() {
        return props.allowedServices;
    },
    get servicesFailed() {
        return props.servicesFailed;
    },
});

const editor = useEditorStore();
const block = computed(() => editor.block);

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

/** The layers, top first; a drag reorders them in the slide (a locked block keeps its place). */
const rows = computed(() => layerRows(editor.slide?.blocks ?? []));
const layerList = ref<HTMLElement | null>(null);
const isLockedAt = (index: number): boolean => !!editor.slide?.blocks[index]?.locked;
// The list shows the array backwards: place d of the list is place n - 1 - d of the slide.
useSortable({
    container: layerList,
    fixed: (index) => isLockedAt(rows.value.length - 1 - index),
    onMove: (from, to) => editor.moveBlockLayer(rows.value.length - 1 - from, rows.value.length - 1 - to),
});
const layerNumber = computed(() => (block.value ? (editor.slide?.blocks.findIndex((b) => b.id === block.value!.id) ?? -1) + 1 : 0));
const lookup = {
    mediaName: (id: string) => editor.media.find((m) => m.id === id)?.name,
    calendarName: (id: number) => [...props.calendars, ...(props.hiddenCalendars ?? [])].find((c) => c.id === id)?.name,
    roomName: (id: number) => props.rooms?.find((r) => r.id === id)?.name,
};

const LAYERS = [
    { where: 'front', icon: 'layer-front', label: t.inspector.layers.front },
    { where: 'forward', icon: 'layer-forward', label: t.inspector.layers.forward },
    { where: 'backward', icon: 'layer-backward', label: t.inspector.layers.backward },
    { where: 'back', icon: 'layer-back', label: t.inspector.layers.back },
] as const;
</script>

<template>
    <aside class="inspector">
        <section v-if="block" data-testid="block-inspector">
            <div class="block-head">
                <h3>
                    <Icon :name="BLOCK_ICONS[block.type]" :size="18" />
                    {{ BLOCK_LABELS[block.type] }}
                </h3>
                <div class="head-actions">
                    <!-- Plan.md, 25: locked, the whole block stays as it is until unlocked. -->
                    <button
                        v-tip="block.locked ? t.inspector.lockedTitle : t.inspector.lockTitle"
                        class="d-btn d-btn--icon"
                        :class="{ 'lock-toggle--on': block.locked }"
                        type="button"
                        :aria-pressed="!!block.locked"
                        :aria-label="block.locked ? t.common.locked : t.common.lock"
                        data-testid="lock-toggle"
                        @click="editor.setLocked(block.id, !block.locked)"
                    >
                        <Icon :name="block.locked ? 'lock' : 'unlock'" :size="18" />
                    </button>
                    <button
                        v-tip="withKeys(t.inspector.duplicateBlock, KEYS.duplicate)"
                        class="d-btn d-btn--icon"
                        type="button"
                        :aria-label="t.inspector.duplicateBlock"
                        data-testid="block-duplicate"
                        @click="editor.duplicateBlock(block.id)"
                    >
                        <Icon name="duplicate" :size="18" />
                    </button>
                    <button
                        v-tip="withKeys(t.inspector.copyBlock, KEYS.copy)"
                        class="d-btn d-btn--icon"
                        type="button"
                        :aria-label="t.inspector.copyBlock"
                        data-testid="block-copy"
                        @click="editor.copyBlock(block.id)"
                    >
                        <Icon name="copy" :size="18" />
                    </button>
                    <button
                        v-tip="withKeys(t.inspector.deleteBlock, KEYS.delete)"
                        class="d-btn d-btn--icon d-btn--danger delete-btn"
                        type="button"
                        :aria-label="t.inspector.deleteBlock"
                        :disabled="!!block.locked"
                        data-testid="block-delete"
                        @click="editor.removeBlock(block.id)"
                    >
                        <Icon name="trash" :size="18" />
                    </button>
                </div>
            </div>
            <p v-if="block.locked" class="hint" data-testid="locked-hint">
                {{ t.inspector.lockedHint }}
            </p>
            <!-- A disabled fieldset disables every field and button inside it at once; a summary is none, so sections still fold. -->
            <fieldset class="lockable" :disabled="!!block.locked">
                <component :is="BLOCK_INSPECTORS[block.type]" :block="block" />

                <InspectorSection id="arrange" :title="t.inspector.arrange" default-open>
                    <p class="layer-position" data-testid="layer-position">{{ t.inspector.layerOf(layerNumber, rows.length) }}</p>
                    <ol ref="layerList" class="layer-list" data-testid="layer-list">
                        <li
                            v-for="row in rows"
                            :key="row.block.id"
                            class="layer-item"
                            :class="{ 'layer-item--on': row.block.id === block.id }"
                            data-sort-item
                            data-testid="layer-row"
                            @click="editor.selectBlock(row.block.id)"
                        >
                            <button
                                class="layer-handle"
                                type="button"
                                data-sort-handle
                                :disabled="!!row.block.locked"
                                :aria-label="t.common.dragToSort"
                                data-testid="layer-handle"
                                @click.stop
                            >
                                <Icon name="grip" :size="14" />
                            </button>
                            <Icon :name="BLOCK_ICONS[row.block.type]" :size="16" class="layer-icon" />
                            <span class="layer-name">{{ BLOCK_LABELS[row.block.type] }}</span>
                            <span class="layer-sub">{{ blockSummary(row.block, lookup) }}</span>
                            <Icon v-if="row.block.locked" name="lock" :size="14" class="layer-lock" :data-testid="`layer-lock`" />
                        </li>
                    </ol>
                    <div class="layer-buttons">
                        <button
                            v-for="layer in LAYERS"
                            :key="layer.where"
                            v-tip="layer.label"
                            class="d-btn d-btn--icon"
                            type="button"
                            :aria-label="layer.label"
                            :data-testid="`layer-${layer.where}`"
                            @click="editor.layerBlock(block.id, layer.where)"
                        >
                            <Icon :name="layer.icon" :size="16" />
                        </button>
                    </div>
                </InspectorSection>

                <InspectorSection id="measures" :title="t.inspector.measures" :summary="positionSummary">
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

        <!-- Slide and playlist -->
        <SlideInspector v-else />
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
/* The layers, top first: symbol, name and short content; the chosen one on the accent's pale ground. */
.layer-list {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
}
.layer-item {
    display: flex;
    align-items: center;
    gap: var(--d-space-2);
    min-width: 0;
    min-height: 36px;
    padding: 0 var(--d-space-2);
    border-radius: var(--d-radius);
    cursor: pointer;
    user-select: none;
    -webkit-touch-callout: none;
}
.layer-item:hover {
    background: var(--d-panel);
}
.layer-item--on,
.layer-item--on:hover {
    background: var(--d-accent-pale);
    color: var(--d-accent-strong);
}
.layer-handle {
    display: grid;
    flex: none;
    place-items: center;
    width: 20px;
    height: 32px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--d-text-faint);
    cursor: grab;
}
.layer-handle:disabled {
    opacity: 0.3;
    cursor: default;
}
.layer-icon,
.layer-lock {
    flex: none;
    color: var(--d-text-muted);
}
.layer-name {
    flex: none;
    font-size: var(--d-size-sm);
    font-weight: var(--d-weight-normal);
}
.layer-sub {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
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
