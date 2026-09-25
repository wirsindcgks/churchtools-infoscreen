<script setup lang="ts">
import { computed, ref } from 'vue';
import SlideView from '../player/SlideView.vue';
import StageView from '../player/StageView.vue';
import { fitStage } from '../player/stage';
import { useEditorStore } from './editor-store';
import Icon from './Icon.vue';

const editor = useEditorStore();
const THUMB_WIDTH = 176;
const thumb = computed(() => {
    const height = Math.round((THUMB_WIDTH * editor.stage.height) / editor.stage.width);
    return { width: THUMB_WIDTH, height, fit: fitStage({ width: THUMB_WIDTH, height }, editor.stage) };
});

const dragging = ref<number | null>(null);
const over = ref<number | null>(null);

function drop(index: number): void {
    if (dragging.value !== null) editor.moveSlide(dragging.value, index);
    dragging.value = null;
    over.value = null;
}

function remove(id: string, name: string): void {
    const shared = editor.alsoIn(id).length > 0;
    const where = shared ? 'aus dieser Playlist' : 'aus diesem Screen';
    if (window.confirm(`Slide „${name}" ${where} entfernen?`)) editor.removeSlide(id);
}

function link(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select.value) editor.linkSlide(select.value);
    select.value = '';
}
</script>

<template>
    <aside class="slide-list">
        <header>
            <!-- One playlist – the designer notices nothing of them (Plan.md, Playlists und Zeitpläne). -->
            <strong v-if="editor.playlists.length <= 1">Slides</strong>
            <label v-else class="playlist-pick">
                <span class="visually-hidden">Playlist</span>
                <select
                    :value="editor.playlist?.id"
                    data-testid="playlist-select"
                    @change="editor.selectPlaylist(($event.target as HTMLSelectElement).value)"
                >
                    <option v-for="p in editor.playlists" :key="p.id" :value="p.id">
                        {{ p.name }}{{ p.id === editor.draft?.screen.defaultPlaylistId && !p.name.includes('Standard') ? ' (Standard)' : '' }}
                    </option>
                </select>
            </label>
            <span class="count">{{ editor.slides.length }}</span>
        </header>
        <ol>
            <li
                v-for="(slide, index) in editor.slides"
                :key="slide.id"
                :class="{
                    active: slide.id === editor.slide?.id,
                    disabled: !slide.enabled,
                    over: over === index && dragging !== index,
                }"
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
                    <span class="duration">{{ slide.durationSeconds }} s{{ slide.enabled ? '' : ' · aus' }}</span>
                </div>
                <p v-if="editor.alsoIn(slide.id).length" class="shared" data-testid="slide-shared">
                    Auch in {{ editor.alsoIn(slide.id).join(', ') }}
                </p>
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
            <li class="add-item">
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
                <select
                    v-if="editor.otherSlides.length"
                    class="link"
                    data-testid="link-slide"
                    aria-label="Vorhandene Slide dieses Screens einfügen"
                    @change="link"
                >
                    <option value="">Vorhandene Slide einfügen …</option>
                    <option v-for="s in editor.otherSlides" :key="s.id" :value="s.id">{{ s.name }}</option>
                </select>
            </li>
        </ol>
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
header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    border-bottom: 1px solid var(--d-divider);
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
.duration {
    color: var(--d-text-muted);
    white-space: nowrap;
}
.shared {
    margin: 4px 0 0;
    color: var(--d-accent-strong);
    font-size: var(--d-size-sm);
}
.playlist-pick {
    flex: 1;
    min-width: 0;
    margin-right: 8px;
}
.playlist-pick select {
    font-weight: 700;
}
.link {
    margin-top: 8px;
    font-size: var(--d-size-sm);
}
.visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
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
/* Phone: the slides become a row to swipe above the stage (Plan.md, 10). */
@media (max-width: 48rem) {
    .slide-list {
        border-right: 0;
        border-bottom: 1px solid var(--d-divider);
    }
    ol {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        overflow-y: hidden;
    }
    li {
        flex: none;
    }
    .add {
        width: 176px;
    }
    li + li {
        margin-top: 0;
    }
}
</style>
