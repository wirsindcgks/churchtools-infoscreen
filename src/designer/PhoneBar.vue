<script setup lang="ts">
/**
 * The two rows at the bottom of a phone (Plan.md 79, C2). The lower one is always there: the slide – "Folie 2 von 5" opens the
 * sheet of slides, "+ Baustein" the sheet of blocks, "⋯" holds what belongs to the slide. A block chosen (or several) adds the upper row:
 * the short menu of the block in its bar form (`QuickMenu`, `variant="bar"`). The sheets themselves belong to the editor; this bar only asks for them.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { t } from '../i18n/designer';
import { useEditorStore } from './editor-store';
import Icon from './Icon.vue';
import QuickMenu from './QuickMenu.vue';
import { GRID_SIZES } from './snap';
import { KEYS, keyLabel } from './shortcuts';
import { useConfirm } from './useConfirm';
import { useKeyboardInset } from './usePhone';

const emit = defineEmits<{ slides: []; 'edit-slide': []; 'all-settings': [] }>();

const editor = useEditorStore();
const { confirm } = useConfirm();

const quickMenu = ref<InstanceType<typeof QuickMenu> | null>(null);
/** Leads to the content of the chosen block: its first field opens (C5, C6). */
function openFirst(): boolean {
    return quickMenu.value?.openFirst() ?? false;
}
/** Long press on a block (C3): opens the "⋯" of the block's bar. */
function openMore(): void {
    quickMenu.value?.openMore();
}
defineExpose({ openFirst, openMore });
const keyboard = useKeyboardInset();

const slideIndex = computed(() => (editor.slide ? editor.slides.indexOf(editor.slide) + 1 : 0));

/** The list behind "⋯" of the slide. */
const moreOpen = ref(false);
const moreWrap = ref<HTMLElement | null>(null);
function closeOnOutside(event: PointerEvent): void {
    if (!moreWrap.value?.contains(event.target as Node)) moreOpen.value = false;
}
watch(moreOpen, (open) => {
    if (open) document.addEventListener('pointerdown', closeOnOutside, true);
    else document.removeEventListener('pointerdown', closeOnOutside, true);
});
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutside, true));
function onMoreKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    moreOpen.value = false;
}

function choose(action: () => void): void {
    moreOpen.value = false;
    action();
}
async function removeSlide(): Promise<void> {
    const slide = editor.slide;
    if (!slide) return;
    moreOpen.value = false;
    if (await confirm({ message: t.editor.slideList.confirmRemove(slide.name), confirmLabel: t.common.remove, danger: true })) editor.removeSlide(slide.id);
}
</script>

<template>
    <div class="phone-bar" :style="keyboard ? { bottom: `${keyboard}px` } : undefined" data-testid="phone-bar">
        <div v-if="editor.selection.length" class="block-row" data-testid="phone-block-row">
            <QuickMenu ref="quickMenu" :key="editor.selection.map((b) => b.id).join()" :blocks="editor.selection" variant="bar" @all-settings="emit('all-settings')" />
        </div>
        <div class="slide-row" data-testid="phone-slide-row">
            <button
                class="slides-btn"
                type="button"
                :disabled="!editor.slide"
                :aria-label="t.editor.slidesToggle(slideIndex)"
                aria-haspopup="dialog"
                data-testid="phone-slides"
                @click="emit('slides')"
            >
                <span class="slides-label">{{ t.editor.slideOf(slideIndex, editor.slides.length) }}</span>
                <Icon name="chevron-down" :size="16" class="slides-chevron" />
            </button>
            <button
                class="d-btn d-btn--create add"
                type="button"
                :aria-label="t.editor.palette.addBlock"
                :disabled="!editor.slide"
                data-testid="add-block-menu"
                @click="editor.blockSheetOpen = true"
            >
                <Icon name="plus" :size="20" />
            </button>
            <div ref="moreWrap" class="more">
                <button
                    class="d-btn d-btn--icon d-btn--ghost"
                    :class="{ on: moreOpen }"
                    type="button"
                    :aria-label="t.editor.moreActions"
                    aria-haspopup="menu"
                    :aria-expanded="moreOpen"
                    :disabled="!editor.slide"
                    data-testid="phone-slide-more"
                    @click="moreOpen = !moreOpen"
                >
                    <Icon name="more" :size="20" />
                </button>
                <div v-if="moreOpen" class="more-list" role="menu" data-testid="phone-slide-more-list" @keydown="onMoreKey">
                    <button role="menuitem" type="button" data-testid="phone-slide-edit" @click="choose(() => emit('edit-slide'))">
                        {{ t.editor.phone.editSlide }}
                    </button>
                    <button role="menuitem" type="button" data-testid="slide-duplicate-phone" @click="choose(() => editor.duplicateCurrentSlide())">
                        {{ t.editor.slideList.duplicateSlide }}
                    </button>
                    <button role="menuitem" type="button" :disabled="editor.slides.length <= 1" data-testid="slide-remove-phone" @click="removeSlide">
                        {{ t.editor.slideList.removeSlide }}
                    </button>
                    <button
                        v-if="editor.clipboard.length"
                        role="menuitem"
                        type="button"
                        data-testid="paste-block"
                        @click="choose(() => editor.pasteBlocks())"
                    >
                        {{ t.quick.paste }}<kbd>{{ keyLabel(KEYS.paste) }}</kbd>
                    </button>
                    <hr role="separator">
                    <label class="guides">
                        <span>{{ t.editor.palette.guides }}</span>
                        <select :value="editor.gridSize" data-testid="grid-size" @change="editor.setGridSize(Number(($event.target as HTMLSelectElement).value))">
                            <option v-for="size in GRID_SIZES" :key="size" :value="size">{{ size ? `${size} px` : t.editor.palette.gridOff }}</option>
                        </select>
                    </label>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.phone-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 900;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    color: var(--d-text);
    font-family: var(--d-font);
    font-size: var(--d-size);
}
.slide-row,
.block-row {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: var(--d-space-2);
    height: 56px;
    border-top: 1px solid var(--d-divider);
}
.slide-row {
    height: calc(56px + env(safe-area-inset-bottom));
    padding: 0 var(--d-space-2) env(safe-area-inset-bottom) var(--d-space-3);
    background: var(--d-surface);
}
/* One step set off from the slide row below. */
.block-row {
    padding: 0;
    background: var(--d-panel);
}
.slides-btn {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: flex-start;
    gap: var(--d-space-2);
    min-width: 0;
    height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--d-text);
    font: inherit;
    font-weight: var(--d-weight-heading);
    cursor: pointer;
}
.slides-btn:disabled {
    opacity: 0.5;
}
.slides-label {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
/* Open upwards: tap to open the sheet above. */
.slides-chevron {
    flex: none;
    transform: rotate(180deg);
}
.add {
    flex: none;
    width: 44px;
    height: 44px;
    padding: 0;
}
.more {
    position: relative;
    flex: none;
}
.more .d-btn {
    width: 44px;
    height: 44px;
}
.on,
.on:hover:not(:disabled) {
    background: var(--d-accent-pale);
    color: var(--d-accent-strong);
}
.more-list {
    position: absolute;
    right: 0;
    bottom: calc(100% + 8px);
    z-index: 5;
    display: grid;
    min-width: 240px;
    padding: 4px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow);
}
.more-list button,
.guides {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--d-space-4);
    min-height: 44px;
    padding: 6px 10px;
    border: 0;
    border-radius: var(--d-radius);
    background: none;
    color: var(--d-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
}
.more-list button:hover:not(:disabled),
.more-list button:focus-visible {
    background: var(--d-panel);
}
.more-list button:disabled {
    opacity: 0.5;
    cursor: default;
}
.more-list kbd {
    color: var(--d-text-faint);
    font: inherit;
    font-size: var(--d-size-sm);
}
.more-list hr {
    width: 100%;
    margin: 4px 0;
    border: 0;
    border-top: 1px solid var(--d-divider);
}
.guides select {
    width: auto;
}
</style>
