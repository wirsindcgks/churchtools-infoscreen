<script setup lang="ts">
/**
 * The frame of the inspector (Plan.md 79, B2): the head with its four buttons, the inspector of the chosen block, then
 * "Anordnen" and "Genaue Maße". Without a block the slide and the playlist show instead. What a block shows lives in
 * `inspector/blocks/`, one component per type.
 */
import { computed, provide } from 'vue';
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
import { BLOCK_ICONS, BLOCK_LABELS } from './ops';

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
                        class="d-btn lock-toggle"
                        :class="{ 'lock-toggle--on': block.locked }"
                        type="button"
                        :aria-pressed="!!block.locked"
                        :aria-label="block.locked ? t.common.locked : t.common.lock"
                        :title="block.locked ? t.inspector.lockedTitle : t.inspector.lockTitle"
                        data-testid="lock-toggle"
                        @click="editor.setLocked(block.id, !block.locked)"
                    >
                        <Icon :name="block.locked ? 'lock' : 'unlock'" :size="16" />
                        <span class="btn-word">{{ block.locked ? t.common.locked : t.common.lock }}</span>
                    </button>
                    <button
                        class="d-btn lock-toggle"
                        type="button"
                        :title="t.inspector.duplicateBlock"
                        :aria-label="t.inspector.duplicateBlock"
                        data-testid="block-duplicate"
                        @click="editor.duplicateBlock(block.id)"
                    >
                        <Icon name="duplicate" :size="16" />
                        <span class="btn-word">{{ t.common.duplicate }}</span>
                    </button>
                    <button
                        class="d-btn lock-toggle"
                        type="button"
                        :title="t.inspector.copyBlock"
                        :aria-label="t.inspector.copyBlock"
                        data-testid="block-copy"
                        @click="editor.copyBlock(block.id)"
                    >
                        <Icon name="copy" :size="16" />
                        <span class="btn-word">{{ t.common.copy }}</span>
                    </button>
                    <button
                        class="d-btn lock-toggle"
                        type="button"
                        :title="t.inspector.deleteBlock"
                        :aria-label="t.inspector.deleteBlock"
                        :disabled="!!block.locked"
                        data-testid="block-delete"
                        @click="editor.removeBlock(block.id)"
                    >
                        <Icon name="trash" :size="16" class="danger-icon" />
                        <span class="btn-word">{{ t.common.delete }}</span>
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
                    <div class="layer-row">
                        <span class="row-label">{{ t.inspector.layer }}</span>
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
/* Over 48rem always two lines, whatever the name's length: name, then four equal buttons – symbol over word (Plan.md 47, 79). */
@media (min-width: 48.0625rem) {
    .block-head {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        justify-content: stretch;
    }
    .head-actions {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
    }
    .head-actions .lock-toggle {
        flex-direction: column;
        justify-content: center;
        gap: 2px;
        min-width: 0;
        padding-inline: 2px;
        font-size: 12px;
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
.measures {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 12px;
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
