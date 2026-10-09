<script setup lang="ts">
/**
 * The inspector while no block is chosen: the slide (name, duration, background) and the playlist. Moved out of
 * `Inspector.vue` unchanged (Plan.md 79, B2, part 1).
 */
import { computed } from 'vue';
import { t } from '../../i18n/designer';
import type { Fill } from '../../model/schema';
import { bannerShown } from '../../player/banner';
import { useStageContext } from '../../player/context';
import { sizedImageUrl } from '../../player/format';
import { slideSeconds } from '../../player/paging';
import { useEditorStore } from '../editor-store';
import FillEditor from '../FillEditor.vue';
import HintRow from '../HintRow.vue';
import Icon from '../Icon.vue';
import InfoHint from '../InfoHint.vue';
import InspectorSection from '../InspectorSection.vue';
import { useInspectorContext } from './context';
import { useEdit } from './edit';

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

function setSlideNumber(value: string): void {
    const n = Number(value);
    if (n >= 1 && n <= 3600) editor.updateSlide({ durationSeconds: n });
}

function mediaUrl(id: string | undefined, fit: 'crop' | 'max' = 'crop'): string | null {
    const media = id ? editor.media.find((m) => m.id === id) : undefined;
    return media ? sizedImageUrl(media.imageUrl, 272, 153, fit) : null;
}

function setBackgroundKind(kind: string): void {
    if (kind === 'media') context.pickImage('background');
    else editor.updateSlide({ background: slideFill.value });
}

const slideFill = computed<Fill>(() =>
    slide.value && slide.value.background.kind !== 'media' ? slide.value.background : { kind: 'solid', color: '#000000' },
);

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
        <label class="d-field d-field--inline">
            {{ t.common.name }}
            <input
                type="text"
                maxlength="100"
                :value="slide.name"
                v-on="edit"
                @input="editor.updateSlide({ name: ($event.target as HTMLInputElement).value })"
            >
        </label>
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
        <div class="grid2">
            <label class="d-field">
                {{ t.inspector.displaySeconds }}
                <input
                    type="number"
                    min="1"
                    max="3600"
                    :value="slide.durationSeconds"
                    data-testid="duration-input"
                    v-on="edit"
                    @input="setSlideNumber(($event.target as HTMLInputElement).value)"
                >
            </label>
            <label class="check check--inline">
                <input
                    type="checkbox"
                    :checked="slide.enabled"
                    @change="editor.updateSlide({ enabled: ($event.target as HTMLInputElement).checked })"
                >
                {{ t.inspector.enabled }}
            </label>
        </div>
        <p v-if="runsLonger" class="hint" data-testid="duration-hint">
            {{ t.inspector.runsLonger(runsLonger) }}
        </p>
        <InspectorSection id="background" :title="t.inspector.background" :summary="backgroundSummary">
            <template #summary-extra>
                <span v-for="(color, i) in backgroundColors" :key="i" class="swatch" :style="{ background: color }" />
            </template>
            <label class="d-field d-field--inline">
                {{ t.inspector.backgroundFrom }}
                <select
                    :value="slide.background.kind === 'media' ? 'media' : 'fill'"
                    data-testid="background-kind"
                    @change="setBackgroundKind(($event.target as HTMLSelectElement).value)"
                >
                    <option value="fill">{{ t.inspector.backgroundFill }}</option>
                    <option value="media">{{ t.inspector.backgroundImage }}</option>
                </select>
            </label>
            <div v-if="slide.background.kind === 'media'" class="media-pick">
                <img v-if="mediaUrl(slide.background.mediaId)" :src="mediaUrl(slide.background.mediaId)!" alt="">
                <button class="d-btn" type="button" @click="context.pickImage('background')">{{ t.inspector.otherImage }}</button>
            </div>
            <FillEditor
                v-else
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
                <label class="d-field d-field--inline">
                    {{ t.common.name }}
                    <input
                        type="text"
                        maxlength="100"
                        :value="editor.draft.playlist.name"
                        data-testid="playlist-name-input"
                        v-on="edit"
                        @input="editor.renamePlaylist(($event.target as HTMLInputElement).value)"
                    >
                </label>
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
.grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    align-items: end;
}
.check {
    display: flex;
    align-items: center;
    gap: 6px;
}
.check--inline {
    padding-bottom: 0.4em;
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
.media-pick {
    display: grid;
    gap: 6px;
}
.video-name {
    margin: 0;
    overflow-wrap: anywhere;
    font-weight: 700;
}
.media-pick img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: var(--d-radius);
    background: var(--d-panel);
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
