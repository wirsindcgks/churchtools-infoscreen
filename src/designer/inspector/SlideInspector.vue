<script setup lang="ts">
/**
 * The inspector while no block is chosen: the slide (name, duration, whether it shows, background) and the playlist
 * (Plan.md 79, B2). The background is one segment, "Farbe · Verlauf · Bild".
 */
import { computed, ref, watch } from 'vue';
import { t } from '../../i18n/designer';
import type { Fill } from '../../model/schema';
import { bannerShown } from '../../player/banner';
import { useStageContext } from '../../player/context';
import { sizedImageUrl } from '../../player/format';
import { slideSeconds } from '../../player/paging';
import { useEditorStore } from '../editor-store';
import { fillOfKind } from '../fill-kind';
import FillEditor from '../FillEditor.vue';
import HintRow from '../HintRow.vue';
import Icon from '../Icon.vue';
import InfoHint from '../InfoHint.vue';
import InspectorSection from '../InspectorSection.vue';
import { useInspectorContext } from './context';
import { useEdit } from './edit';
import MediaField from './fields/MediaField.vue';
import NumberField from './fields/NumberField.vue';
import SegmentField from './fields/SegmentField.vue';
import TextField from './fields/TextField.vue';
import ToggleField from './fields/ToggleField.vue';

const editor = useEditorStore();
/** The preview's stage context: paged lists report their page count there. */
const stage = useStageContext();
const context = useInspectorContext();
const slide = computed(() => editor.slide);
// The designer shows what the TV shows (Plan.md 38): named only while it still runs.
const bannerRunning = computed(() => bannerShown(editor.draft?.playlist.banner, stage.now, stage.timeZone));

/** Field edits are gestures: all keystrokes in one field are one undo step. */
const edit = useEdit();

/** The other playlists showing the current slide, as one line; empty for an unlinked slide (Plan.md 49). */
const linkedNames = computed(() =>
    editor.slide
        ? editor
              .linkedIn(editor.slide.id)
              .map((p) => p.name)
              .join(', ')
        : '',
);

/** Seconds the slide really runs when a paged list needs longer than its duration; else 0. */
const runsLonger = computed(() => {
    if (!slide.value) return 0;
    const seconds = slideSeconds(slide.value, stage.pages ?? {});
    return seconds > slide.value.durationSeconds ? seconds : 0;
});

function mediaUrl(id: string | undefined, fit: 'crop' | 'max' = 'crop'): string | null {
    const media = id ? editor.media.find((m) => m.id === id) : undefined;
    return media ? sizedImageUrl(media.imageUrl, 272, 153, fit) : null;
}

const slideFill = computed<Fill>(() =>
    slide.value && slide.value.background.kind !== 'media' ? slide.value.background : { kind: 'solid', color: '#000000' },
);

const backgroundKinds = [
    { value: 'solid', label: t.inspector.backgroundKind.solid },
    { value: 'linear-gradient', label: t.inspector.backgroundKind.gradient },
    { value: 'media', label: t.inspector.backgroundKind.image },
];

/**
 * "Bild" was chosen but no picture is in yet: the segment and the picture field show it, while the slide keeps its fill
 * until a picture is picked – cancelling the library loses nothing, and "Farbe" shows the old fill again.
 */
const wantsImage = ref(false);
watch(() => `${slide.value?.id}|${slide.value?.background.kind}`, () => {
    wantsImage.value = false;
});
const backgroundKind = computed(() => (wantsImage.value ? 'media' : (slide.value?.background.kind ?? 'solid')));

function setBackgroundKind(kind: string): void {
    if (!slide.value) return;
    if (kind === 'media') {
        wantsImage.value = true;
        if (slide.value.background.kind !== 'media') context.pickImage('background');
        return;
    }
    wantsImage.value = false;
    const next = fillOfKind(slideFill.value, kind as Fill['kind']);
    if (next !== slide.value.background) editor.updateSlide({ background: next });
}

const playlistSummary = computed(() =>
    editor.screens.length ? editor.screens.map((s) => s.name).join(', ') : t.inspector.noScreen,
);
const backgroundSummary = computed(() => {
    const background = slide.value?.background;
    if (!background) return '';
    return background.kind === 'solid' ? t.inspector.backgroundKind.solid : background.kind === 'linear-gradient' ? t.inspector.backgroundKind.gradient : t.inspector.backgroundKind.image;
});
/** The colours a fill shows, as swatches beside the folded summary. */
const backgroundColors = computed(() => {
    const background = slide.value?.background;
    if (!background || background.kind === 'media') return [];
    return background.kind === 'solid' ? [background.color] : background.stops.map((stop) => stop.color);
});
</script>

<template>
    <section v-if="slide" data-testid="slide-inspector">
        <TextField :model-value="slide.name" :label="t.common.name" :maxlength="100" testid="slide-name" @update:model-value="editor.updateSlide({ name: $event })" />
        <!-- A slide that other playlists show too (Plan.md 49): changes here count there as well. -->
        <div v-if="linkedNames" class="linked" data-testid="slide-linked">
            <span class="linked-text" :title="t.inspector.linkedAlso(linkedNames)" data-testid="slide-linked-in">
                <Icon name="link" :size="14" />
                <span class="linked-names">{{ t.inspector.linkedAlso(linkedNames) }}</span>
                <span v-if="editor.linkPending(slide.id)" class="linked-pending" data-testid="slide-link-pending">
                    {{ t.inspector.linkedPending }}
                </span>
            </span>
            <InfoHint>
                {{ t.inspector.linkedInfo }}
            </InfoHint>
            <button class="d-btn" type="button" data-testid="slide-unlink" @click="editor.unlinkSlide(slide.id)">
                {{ t.inspector.unlink }}
            </button>
        </div>
        <NumberField
            :model-value="slide.durationSeconds"
            :label="t.inspector.displaySeconds"
            :unit="t.inspector.unitSeconds"
            :min="1"
            :max="3600"
            testid="duration-input"
            @update:model-value="editor.updateSlide({ durationSeconds: $event })"
        />
        <ToggleField :model-value="slide.enabled" :label="t.inspector.enabled" testid="slide-enabled" @update:model-value="editor.updateSlide({ enabled: $event })" />
        <p v-if="runsLonger" class="hint" data-testid="duration-hint">
            {{ t.inspector.runsLonger(runsLonger) }}
        </p>
        <InspectorSection id="background" :title="t.inspector.background" :summary="backgroundSummary">
            <template #summary-extra>
                <span v-for="(color, i) in backgroundColors" :key="i" class="swatch" :style="{ background: color }" />
            </template>
            <SegmentField
                :model-value="backgroundKind"
                :options="backgroundKinds"
                :label="t.common.fill.kind"
                testid="background-kind"
                @update:model-value="setBackgroundKind(String($event))"
            />
            <MediaField
                v-if="backgroundKind === 'media'"
                :filled="slide.background.kind === 'media'"
                :pick-label="t.inspector.pickImage"
                :swap-label="t.inspector.swapImage"
                :preview-url="slide.background.kind === 'media' ? mediaUrl(slide.background.mediaId) : null"
                testid="pick-background"
                @pick="context.pickImage('background')"
            />
            <FillEditor
                v-else
                no-kind
                :model-value="slideFill"
                @focus="edit.onFocus"
                @blur="edit.onBlur"
                @update:model-value="editor.updateSlide({ background: $event })"
            />
        </InspectorSection>
    </section>

    <!-- The playlist is the designers' own (schema 1.4); where it runs, the screens' schedules decide. -->
    <section v-if="editor.draft">
        <InspectorSection id="playlist" :title="t.inspector.playlist" :summary="playlistSummary">
            <div data-testid="playlist-info" class="playlist-info">
                <TextField
                    :model-value="editor.draft.playlist.name"
                    :label="t.common.name"
                    :maxlength="100"
                    testid="playlist-name-input"
                    @update:model-value="editor.renamePlaylist($event)"
                />
                <dl>
                    <dt>{{ t.inspector.format }}</dt>
                    <dd>
                        {{ editor.stage.height > editor.stage.width ? t.inspector.portrait : t.inspector.landscape }},
                        {{ editor.stage.width }} × {{ editor.stage.height }} px
                    </dd>
                    <dt>{{ t.inspector.runsOn }}</dt>
                    <dd data-testid="playlist-screens">{{ playlistSummary }}</dd>
                </dl>
                <HintRow caption>
                    <span>{{ t.inspector.schedule }}</span>
                    <template #info>
                        {{ t.inspector.scheduleInfo }}
                    </template>
                </HintRow>
                <p v-if="bannerRunning" class="hint" data-testid="banner-status">
                    {{ t.inspector.bannerRunningBefore(editor.draft.playlist.banner!.text) }}
                    <RouterLink :to="{ name: 'notices' }">{{ t.inspector.bannerLink }}</RouterLink>
                </p>
                <p v-else class="hint" data-testid="banner-status">
                    {{ t.inspector.bannerNoneBefore }} <RouterLink :to="{ name: 'notices' }">{{ t.inspector.bannerLink }}</RouterLink>
                </p>
            </div>
        </InspectorSection>
    </section>
</template>

<style scoped>
section {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
}
.swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid var(--d-divider);
}
.linked {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 8px;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.linked-text {
    display: flex;
    flex: 1 1 12rem;
    align-items: center;
    gap: 6px;
    min-width: 0;
}
.linked-text .d-icon {
    flex: none;
}
.linked-pending {
    flex: none;
    font-style: italic;
}
.linked-names {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.playlist-info {
    display: grid;
    gap: 10px;
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin: 0;
    font-size: var(--d-size-sm);
}
dt {
    color: var(--d-text-muted);
}
dd {
    margin: 0;
}
</style>
