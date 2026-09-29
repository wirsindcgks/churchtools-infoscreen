<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import type { SlideDoc } from '../model/schema';
import { useStageContext } from '../player/context';
import { slideSeconds } from '../player/paging';
import SlideView from '../player/SlideView.vue';
import StageView from '../player/StageView.vue';
import { fitStage } from '../player/stage';
import { useEditorStore } from './editor-store';
import Icon from './Icon.vue';
import SlideImportDialog from './SlideImportDialog.vue';

const editor = useEditorStore();
/** The preview's stage context: paged lists report their pages there (Plan.md, 23). */
const stage = useStageContext();
const THUMB_WIDTH = 176;
/** On a phone the row is one line tall instead of a filmstrip beside the stage (Plan.md 44). */
const THUMB_HEIGHT_PHONE = 64;
const PHONE_TILE_MIN_WIDTH = 104;

/** How long the slide really runs: longer than set when a paged list needs the time. */
function runs(slide: SlideDoc): { seconds: number; longer: boolean } {
    const seconds = slideSeconds(slide, stage.pages ?? {});
    return { seconds, longer: seconds > slide.durationSeconds };
}

/** Reactive, unlike a CSS media query alone: the thumbnail's own size follows it in script. */
const phoneQuery = window.matchMedia('(max-width: 48rem)');
const phone = ref(phoneQuery.matches);
function onPhoneChange(event: MediaQueryListEvent): void {
    phone.value = event.matches;
}
phoneQuery.addEventListener('change', onPhoneChange);
onBeforeUnmount(() => phoneQuery.removeEventListener('change', onPhoneChange));

const thumb = computed(() => {
    if (phone.value) {
        const height = THUMB_HEIGHT_PHONE;
        const width = Math.round((height * editor.stage.width) / editor.stage.height);
        return { width, height, fit: fitStage({ width, height }, editor.stage) };
    }
    const height = Math.round((THUMB_WIDTH * editor.stage.height) / editor.stage.width);
    return { width: THUMB_WIDTH, height, fit: fitStage({ width: THUMB_WIDTH, height }, editor.stage) };
});
/** A fixed tile width on a phone, so a long name cannot widen the tile (Plan.md 44). */
const tileWidth = computed(() => (phone.value ? Math.max(PHONE_TILE_MIN_WIDTH, thumb.value.width) : null));

/** Whether the row is open, kept per viewer; without storage it simply defaults to open (Plan.md 44). */
const OPEN_KEY = 'infoscreen-designer:slides-open';
function storedOpen(): boolean {
    try {
        return window.localStorage.getItem(OPEN_KEY) !== '0';
    } catch {
        return true;
    }
}
const open = ref(storedOpen());
function toggleOpen(): void {
    open.value = !open.value;
    try {
        window.localStorage.setItem(OPEN_KEY, open.value ? '1' : '0');
    } catch {
        // Private window or blocked storage: it just opens by default again next time.
    }
}

const selectedIndex = computed(() => editor.slides.findIndex((s) => s.id === editor.slide?.id) + 1);

const importing = ref(false);
const dragging = ref<number | null>(null);
const over = ref<number | null>(null);

function drop(index: number): void {
    if (dragging.value !== null) editor.moveSlide(dragging.value, index);
    dragging.value = null;
    over.value = null;
}

function remove(id: string, name: string): void {
    if (window.confirm(`Slide „${name}" aus dieser Playlist entfernen?`)) editor.removeSlide(id);
}

function removeCurrent(): void {
    if (editor.slide) remove(editor.slide.id, editor.slide.name);
}
</script>

<template>
    <aside class="slide-list">
        <header class="header-desktop">
            <strong>Slides</strong>
            <span class="count">{{ editor.slides.length }}</span>
        </header>
        <!-- Phone: a collapsible row instead of a header, with the current slide's actions beside it (Plan.md 44). -->
        <div class="header-phone">
            <button
                type="button"
                class="toggle"
                data-testid="slides-toggle"
                :aria-expanded="open"
                aria-controls="slide-list-ol"
                @click="toggleOpen"
            >
                <span class="toggle-label">
                    Slides <span class="count">{{ editor.slides.length }}</span>
                    <span v-if="!open && editor.slide" class="current" data-testid="slides-current">
                        · {{ selectedIndex }}. {{ editor.slide.name }}
                    </span>
                </span>
                <Icon name="chevron-down" :size="16" :class="['toggle-chevron', { open }]" />
            </button>
            <button
                class="d-btn d-btn--icon"
                type="button"
                title="Slide duplizieren"
                aria-label="Slide duplizieren"
                data-testid="slide-duplicate-phone"
                :disabled="!editor.slide"
                @click="editor.duplicateCurrentSlide()"
            >
                <Icon name="copy" :size="16" />
            </button>
            <button
                class="d-btn d-btn--icon"
                type="button"
                title="Slide entfernen"
                aria-label="Slide entfernen"
                data-testid="slide-remove-phone"
                :disabled="!editor.slide || editor.slides.length <= 1"
                @click="removeCurrent"
            >
                <Icon name="trash" :size="16" />
            </button>
        </div>
        <ol v-show="open" id="slide-list-ol">
            <li
                v-for="(slide, index) in editor.slides"
                :key="slide.id"
                :class="{
                    active: slide.id === editor.slide?.id,
                    disabled: !slide.enabled,
                    over: over === index && dragging !== index,
                }"
                :style="{ width: tileWidth ? `${tileWidth}px` : undefined }"
                draggable="true"
                data-testid="slide-item"
                @click="editor.selectSlide(slide.id)"
                @dragstart="dragging = index"
                @dragover.prevent="over = index"
                @dragleave="over = null"
                @drop.prevent="drop(index)"
                @dragend="dragging = null; over = null"
            >
                <div class="thumb" :style="{ width: `${thumb.width}px`, height: `${thumb.height}px` }">
                    <StageView :width="editor.stage.width" :height="editor.stage.height" :fit="thumb.fit">
                        <SlideView :slide="slide" :width="editor.stage.width" :height="editor.stage.height" />
                    </StageView>
                </div>
                <div class="meta">
                    <span class="name">{{ index + 1 }}. {{ slide.name }}</span>
                    <span
                        class="duration"
                        :class="{ longer: runs(slide).longer }"
                        :title="runs(slide).longer ? `Eingestellt ${slide.durationSeconds} s – die Terminliste braucht ${runs(slide).seconds} s für alle Seiten` : undefined"
                        data-testid="slide-duration"
                    >
                        <template v-if="runs(slide).longer">{{ slide.durationSeconds }} → </template>{{ runs(slide).seconds }} s{{ slide.enabled ? '' : ' · aus' }}
                    </span>
                </div>
                <div v-if="slide.id === editor.slide?.id" class="actions" @click.stop>
                    <button class="d-btn" type="button" title="Duplizieren" @click="editor.duplicateCurrentSlide()">
                        Duplizieren
                    </button>
                    <button
                        class="d-btn d-btn--danger"
                        type="button"
                        title="Entfernen"
                        :disabled="editor.slides.length <= 1"
                        @click="remove(slide.id, slide.name)"
                    >
                        Entfernen
                    </button>
                </div>
            </li>
            <!-- Where one looks for the next slide: below the last (Plan.md, Nächste Schritte 11). -->
            <li class="add-item" :style="{ width: tileWidth ? `${tileWidth}px` : undefined }">
                <button
                    class="add"
                    type="button"
                    data-testid="add-slide"
                    :style="{ minHeight: `${thumb.height}px` }"
                    @click="editor.addSlide()"
                >
                    <Icon name="plus" :size="22" />
                    Neue Slide
                </button>
                <button class="import" type="button" data-testid="import-slides" @click="importing = true">
                    <Icon name="copy" :size="16" />
                    Aus anderer Playlist …
                </button>
            </li>
        </ol>
        <SlideImportDialog v-if="importing" @close="importing = false" />
    </aside>
</template>

<style scoped>
.slide-list {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1px solid var(--d-divider);
    background: var(--d-surface);
}
.header-desktop {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--d-divider);
}
/* Phone: a collapsible row replaces the header (Plan.md 44); hidden at a desktop width. */
.header-phone {
    display: none;
}
ol {
    flex: 1;
    overflow-y: auto;
    margin: 0;
    padding: 8px;
    list-style: none;
}
li {
    padding: 8px;
    border: 2px solid transparent;
    border-radius: var(--d-radius-lg);
    cursor: pointer;
}
li + li {
    margin-top: 6px;
}
li:hover {
    background: var(--d-panel);
}
li.active {
    border-color: var(--d-accent);
    background: var(--d-accent-pale);
}
.count {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
li.add-item {
    padding: 8px;
    border: 0;
    cursor: default;
}
li.add-item:hover {
    background: none;
}
.add {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 100%;
    border: 2px dashed var(--d-interactive);
    border-radius: var(--d-radius);
    background: none;
    color: var(--d-text-muted);
    font: inherit;
    cursor: pointer;
}
.add:hover {
    border-color: var(--d-accent);
    background: var(--d-accent-pale);
    color: var(--d-accent-strong);
}
/* The smaller way to a new slide: copies from another playlist. */
.import {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    margin-top: 6px;
    padding: 6px;
    border: 0;
    border-radius: var(--d-radius);
    background: none;
    color: var(--d-accent-strong);
    font: inherit;
    font-size: var(--d-size-sm);
    cursor: pointer;
}
.import:hover {
    background: var(--d-accent-pale);
}
li.over {
    border-style: dashed;
    border-color: var(--d-accent);
}
li.disabled .thumb {
    opacity: 0.4;
}
.thumb {
    position: relative;
    overflow: hidden;
    border-radius: var(--d-radius);
    background: #000;
    pointer-events: none;
}
.meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 6px;
    font-size: var(--d-size-sm);
}
.name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.duration.longer {
    color: var(--d-accent-strong);
}
.duration {
    color: var(--d-text-muted);
    white-space: nowrap;
}
.actions {
    display: flex;
    gap: 6px;
    margin-top: 6px;
}
.actions .d-btn {
    padding: 0.2em 0.6em;
    font-size: var(--d-size-sm);
}
/*
 * Phone: the slides become a row to swipe above the stage (Plan.md, 10), collapsible and
 * with smaller tiles, so it does not push the stage far down (Plan.md 44, feedback from the
 * phone after v0.2.9: the row alone took ~245 px).
 */
@media (max-width: 48rem) {
    .slide-list {
        border-right: 0;
        border-bottom: 1px solid var(--d-divider);
    }
    .header-desktop {
        display: none;
    }
    .header-phone {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 44px;
        padding: 2px 8px;
        border-bottom: 1px solid var(--d-divider);
    }
    .toggle {
        display: flex;
        flex: 1;
        min-width: 0;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: 4px 6px;
        border: 0;
        border-radius: var(--d-radius);
        background: none;
        color: var(--d-text);
        font: inherit;
        font-weight: 700;
        text-align: left;
        cursor: pointer;
    }
    .toggle:hover {
        background: var(--d-panel);
    }
    .toggle-label {
        overflow: hidden;
        min-width: 0;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .current {
        font-weight: 400;
        color: var(--d-text-muted);
    }
    .toggle-chevron {
        flex: none;
        transition: transform 0.15s;
    }
    .toggle-chevron.open {
        transform: rotate(180deg);
    }
    ol {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        padding: 6px;
        overflow-x: auto;
        overflow-y: hidden;
    }
    li,
    li.add-item {
        box-sizing: border-box;
        flex: none;
        min-width: 104px;
        padding: 4px;
    }
    .meta {
        margin-top: 3px;
    }
    /* "Aus anderer Playlist …" is narrower here than the tile, so it wraps (Plan.md 44) – kept small to fit the budget. */
    .import {
        margin-top: 2px;
        padding: 2px;
        font-size: 0.6875rem;
        line-height: 1.15;
    }
    .actions {
        display: none;
    }
    li + li {
        margin-top: 0;
    }
}
</style>
