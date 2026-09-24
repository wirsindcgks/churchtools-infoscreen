<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import type { Block } from '../model/schema';
import SlideView from '../player/SlideView.vue';
import StageView from '../player/StageView.vue';
import { fitStage } from '../player/stage';
import { useEditorStore } from './editor-store';
import { BLOCK_LABELS } from './ops';

const editor = useEditorStore();
const host = ref<HTMLElement | null>(null);
const size = reactive({ width: 800, height: 450 });
const fit = computed(() => fitStage(size, editor.stage));

let observer: ResizeObserver | undefined;
onMounted(() => {
    observer = new ResizeObserver(([entry]) => {
        if (!entry) return;
        size.width = entry.contentRect.width;
        size.height = entry.contentRect.height;
    });
    if (host.value) observer.observe(host.value);
});
onBeforeUnmount(() => observer?.disconnect());

type Handle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface Drag {
    id: string;
    handle: Handle | 'move';
    startX: number;
    startY: number;
    frame: { x: number; y: number; width: number; height: number };
}
let drag: Drag | null = null;

function start(event: PointerEvent, block: Block, handle: Handle | 'move'): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    editor.selectBlock(block.id);
    drag = {
        id: block.id,
        handle,
        startX: event.clientX,
        startY: event.clientY,
        frame: { x: block.x, y: block.y, width: block.width, height: block.height },
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function moveTo(event: PointerEvent): void {
    if (!drag) return;
    // Screen pixels to stage pixels: the stage is shown scaled.
    const dx = (event.clientX - drag.startX) / fit.value.scale;
    const dy = (event.clientY - drag.startY) / fit.value.scale;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    editor.beginGesture();
    const f = { ...drag.frame };
    const h = drag.handle;
    if (h === 'move') {
        f.x += dx;
        f.y += dy;
    } else {
        if (h.includes('e')) f.width += dx;
        if (h.includes('s')) f.height += dy;
        if (h.includes('w')) {
            f.x += dx;
            f.width -= dx;
        }
        if (h.includes('n')) {
            f.y += dy;
            f.height -= dy;
        }
    }
    editor.updateBlock(drag.id, f);
}

function end(): void {
    drag = null;
    editor.endGesture();
}

const blocks = computed(() => editor.slide?.blocks ?? []);
</script>

<template>
    <div ref="host" class="editor-stage" @pointerdown="editor.selectBlock(null)">
        <StageView v-if="editor.slide" :width="editor.stage.width" :height="editor.stage.height" :fit="fit">
            <SlideView :slide="editor.slide" :width="editor.stage.width" :height="editor.stage.height" />
            <div class="overlay">
                <div
                    v-for="block in blocks"
                    :key="block.id"
                    class="frame"
                    :class="{ 'frame--selected': block.id === editor.selectedBlockId }"
                    :style="{
                        left: `${block.x}px`,
                        top: `${block.y}px`,
                        width: `${block.width}px`,
                        height: `${block.height}px`,
                        '--handle': `${12 / fit.scale}px`,
                        '--line': `${1.5 / fit.scale}px`,
                    }"
                    :title="BLOCK_LABELS[block.type]"
                    :data-testid="`frame-${block.type}`"
                    @pointerdown="start($event, block, 'move')"
                    @pointermove="moveTo"
                    @pointerup="end"
                    @pointercancel="end"
                >
                    <template v-if="block.id === editor.selectedBlockId">
                        <span
                            v-for="h in HANDLES"
                            :key="h"
                            class="handle"
                            :class="`handle--${h}`"
                            @pointerdown="start($event, block, h)"
                            @pointermove="moveTo"
                            @pointerup="end"
                            @pointercancel="end"
                        />
                    </template>
                </div>
            </div>
        </StageView>
        <p v-else class="empty">Diese Playlist hat noch keine Slide.</p>
    </div>
</template>

<style scoped>
.editor-stage {
    position: relative;
    min-height: 0;
    height: 100%;
    overflow: hidden;
    background: var(--d-panel);
    touch-action: none;
}
.overlay {
    position: absolute;
    inset: 0;
}
.frame {
    position: absolute;
    box-sizing: border-box;
    cursor: move;
    outline: var(--line) dashed rgba(148, 163, 184, 0.55);
}
.frame:hover {
    outline-color: rgba(96, 165, 250, 0.9);
}
.frame--selected {
    outline: calc(var(--line) * 1.5) solid rgb(59, 130, 246);
}
.handle {
    position: absolute;
    width: var(--handle);
    height: var(--handle);
    margin: calc(var(--handle) / -2);
    background: #fff;
    border: var(--line) solid rgb(59, 130, 246);
    border-radius: 2px;
    box-sizing: border-box;
}
.handle--nw { left: 0; top: 0; cursor: nwse-resize; }
.handle--n { left: 50%; top: 0; cursor: ns-resize; }
.handle--ne { left: 100%; top: 0; cursor: nesw-resize; }
.handle--e { left: 100%; top: 50%; cursor: ew-resize; }
.handle--se { left: 100%; top: 100%; cursor: nwse-resize; }
.handle--s { left: 50%; top: 100%; cursor: ns-resize; }
.handle--sw { left: 0; top: 100%; cursor: nesw-resize; }
.handle--w { left: 0; top: 50%; cursor: ew-resize; }
.empty {
    display: grid;
    place-items: center;
    height: 100%;
    margin: 0;
    color: var(--d-text-muted);
}
</style>
