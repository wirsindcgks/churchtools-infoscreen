<script setup lang="ts">
/**
 * The short menu above the chosen block (Plan.md 79, C1): on the left the block's marked fields in their compact form, then
 * the actions lock, duplicate, delete and "⋯". It stands in the host of the stage, outside the scaled stage, in screen pixels,
 * so text and buttons keep their size at every zoom. A locked block shows only "Entsperren" and "⋯".
 * `variant="bar"` (C2) is the same menu as the bar at the bottom of a phone: the block's symbol, the fields in a row to
 * scroll, then "⋯" (which also holds duplicate, delete and lock/unlock there) and "Auswahl aufheben". An open field is a sheet from below.
 * With several blocks chosen (D5) it stands over their box and shows "3 Bausteine", the chip "Ausrichten" (D4), lock, duplicate,
 * delete and "⋯" (copy, cut, let go).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue';
import { t } from '../i18n/designer';
import type { Block } from '../model/schema';
import { useEditorStore } from './editor-store';
import ArrangeField from './ArrangeField.vue';
import Icon from './Icon.vue';
import { BLOCK_INSPECTORS } from './inspector/blocks';
import { INSPECTOR_MODE, QUICK_OPEN, QUICK_VARIANT } from './inspector/mode';
import { BLOCK_ICONS, BLOCK_LABELS, blockBelow, type Layer } from './ops';
import { quickMenuPlace, type Rect, type Size } from './quick-menu';
import { KEYS, keyLabel, withKeys } from './shortcuts';
import { vTip } from './tip';

/** `frame`: the rectangle of the block (of the box around several) in host pixels; `host`: the size of the host – both only for the menu above. */
const props = defineProps<{ blocks: Block[]; frame?: Rect; host?: Size; variant?: 'float' | 'bar' }>();
const emit = defineEmits<{ 'all-settings': [] }>();

const editor = useEditorStore();
const bar = props.variant === 'bar';
/** The one chosen block; null with several – then the menu has no fields of its own. */
const block = computed(() => (props.blocks.length === 1 ? props.blocks[0]! : null));
const many = computed(() => props.blocks.length > 1);
const ids = computed(() => props.blocks.map((b) => b.id));
const allLocked = computed(() => props.blocks.every((b) => b.locked));
const title = computed(() => (block.value ? BLOCK_LABELS[block.value.type] : (editor.groupSelected ? t.editor.groupCount(props.blocks.length) : t.editor.blocksCount(props.blocks.length))));
provide(INSPECTOR_MODE, 'quick');
provide(QUICK_VARIANT, bar ? 'bar' : 'float');
/** Only one field is open at a time. */
const openField = ref<string | null>(null);
provide(QUICK_OPEN, openField);

const root = ref<HTMLElement | null>(null);
const fields = ref<HTMLElement | null>(null);
/** Whether the fields of the bar run on past its left or right edge – there they fade out. */
const more = reactive({ start: false, end: false });
function onFieldsScroll(): void {
    const el = fields.value;
    if (!bar || !el) return;
    more.start = el.scrollLeft > 1;
    more.end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}

// Where the menu stands: from the block's frame and its own size – and not moving while someone works in it.
const size = reactive({ width: 0, height: 0 });
const ready = ref(bar);
const focusInside = ref(false);
const placed = ref({ left: 0, top: 0 });
function place(): void {
    if (bar || focusInside.value || !props.frame || !props.host) return;
    const { left, top } = quickMenuPlace(props.frame, size, props.host);
    placed.value = { left, top };
}
function measure(): void {
    if (!root.value) return;
    size.width = root.value.offsetWidth;
    size.height = root.value.offsetHeight;
}
watch([() => props.frame, () => props.host, size], place, { deep: true });
function onFocusOut(event: FocusEvent): void {
    if (root.value?.contains(event.relatedTarget as Node | null)) return;
    focusInside.value = false;
    place();
}

let observer: ResizeObserver | undefined;
onMounted(() => {
    measure();
    place();
    onFieldsScroll();
    ready.value = true;
    if (typeof ResizeObserver !== 'undefined' && root.value) {
        observer = new ResizeObserver(() => {
            measure();
            onFieldsScroll();
        });
        observer.observe(root.value);
    }
});
onBeforeUnmount(() => {
    observer?.disconnect();
    document.removeEventListener('pointerdown', closeMoreOnOutside, true);
});

/** The list behind "⋯". */
const moreOpen = ref(false);
const moreAbove = ref(false);
const moreWrap = ref<HTMLElement | null>(null);
const moreButton = ref<HTMLButtonElement | null>(null);
const moreList = ref<HTMLElement | null>(null);
/** A finger is the pointer (read when the list opens): only then "Mehrere auswählen" is offered here, a mouse has Shift. */
const coarse = ref(false);

function closeMoreOnOutside(event: PointerEvent): void {
    if (!moreWrap.value?.contains(event.target as Node)) moreOpen.value = false;
}
watch(moreOpen, async (open) => {
    if (!open) {
        document.removeEventListener('pointerdown', closeMoreOnOutside, true);
        return;
    }
    openField.value = null;
    coarse.value = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    document.addEventListener('pointerdown', closeMoreOnOutside, true);
    await nextTick();
    moreAbove.value = bar;
    const host = root.value?.closest<HTMLElement>('[data-quick-host]')?.getBoundingClientRect();
    const menu = root.value?.getBoundingClientRect();
    const list = moreList.value;
    if (!bar && host && menu && list) {
        const below = host.bottom - menu.bottom;
        moreAbove.value = list.offsetHeight + 8 > below && menu.top - host.top > below;
    }
    list?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
});
// A field opening closes the list.
watch(openField, (id) => {
    if (id) moreOpen.value = false;
});

function onMoreKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
        event.stopPropagation();
        moreOpen.value = false;
        moreButton.value?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        const items = [...(moreList.value?.querySelectorAll<HTMLElement>('button:not(:disabled)') ?? [])];
        const at = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
        items[next]?.focus();
    }
}

/** An entry of the list does its work and closes the list. */
function choose(action: () => void): void {
    moreOpen.value = false;
    action();
}
const LAYERS: { where: Layer; label: string }[] = [
    { where: 'front', label: t.quick.layers.front },
    { where: 'forward', label: t.quick.layers.forward },
    { where: 'backward', label: t.quick.layers.backward },
    { where: 'back', label: t.quick.layers.back },
];

/** Arrows hop between the buttons and chips of the menu; the editor's arrows (which move the block) never hear them. */
function onKeydown(event: KeyboardEvent): void {
    // While writing, Escape from the menu ends the writing as in the field – the block stays chosen.
    if (event.key === 'Escape' && editor.editingTextId) {
        event.stopPropagation();
        editor.endTextEdit();
        return;
    }
    // The editor's Delete removes the chosen block: a focused chip or button of the menu does not.
    if (event.key === 'Delete' || event.key === 'Backspace') {
        event.stopPropagation();
        return;
    }
    if (!event.key.startsWith('Arrow')) return;
    const target = event.target as HTMLElement;
    // A field takes its own arrows: the radio buttons of a segment, the numbers and text of an input, a list.
    if (target.closest('textarea, select') || (target instanceof HTMLInputElement && target.type !== 'checkbox')) return;
    event.stopPropagation();
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const stops = [...(root.value?.querySelectorAll<HTMLElement>('[data-quick-stop]') ?? [])].filter(
        (el) => !el.closest('[role="dialog"], [role="menu"]') && !(el as HTMLButtonElement).disabled,
    );
    const at = stops.indexOf(target.closest<HTMLElement>('[data-quick-stop]') as HTMLElement);
    if (at < 0) return;
    event.preventDefault();
    stops[Math.max(0, Math.min(stops.length - 1, at + (event.key === 'ArrowRight' ? 1 : -1)))]?.focus();
}

/** The first field of the block: a chip opens its field, the button of a medium opens the library (Plan.md 79, C5). */
function openFirst(): boolean {
    const first = fields.value?.querySelector<HTMLElement>('[data-quick-open]');
    first?.click();
    return !!first;
}
/** Long press on a block (C3): the list behind "⋯" opens. */
function openMore(): void {
    moreOpen.value = true;
}
defineExpose({ openFirst, openMore });

/** The block is being written on the stage (Plan.md 79, C4): the menu keeps its fields and offers "Fertig" instead of the actions. */
const writing = computed(() => !!block.value && editor.editingTextId === block.value.id);
/** The bar's "Auswahl aufheben": writing ends first, then the block is let go. */
function deselect(): void {
    if (editor.editingTextId) editor.endTextEdit();
    editor.selectBlock(null);
}
/** The block that lies under the chosen one in its middle, if there is one – for blocks that others cover. */
const below = computed(() => {
    const b = block.value;
    if (!b) return null;
    return blockBelow(editor.slide?.blocks ?? [], b, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
});
const lockLabel = computed(() => (allLocked.value ? t.quick.unlock : t.common.lock));
</script>

<template>
    <div
        ref="root"
        class="quick-menu"
        :class="{ 'quick-menu--bar': bar }"
        :style="bar ? undefined : { left: `${placed.left}px`, top: `${placed.top}px`, visibility: ready ? undefined : 'hidden' }"
        role="toolbar"
        :aria-label="t.quick.label(title)"
        data-testid="quick-menu"
        @pointerdown.stop
        @keydown="onKeydown"
        @focusin="focusInside = true"
        @focusout="onFocusOut"
    >
        <span v-if="bar" class="quick-kind" role="img" :aria-label="title" data-testid="quick-kind">
            <Icon :name="block ? BLOCK_ICONS[block.type] : 'grid'" :size="20" />
        </span>
        <span v-if="many" class="quick-count" data-testid="quick-count">{{ title }}</span>
        <span v-if="many && !bar" class="quick-divider" aria-hidden="true" />
        <ArrangeField v-if="many && !allLocked" />
        <span v-if="many && !allLocked && !bar" class="quick-divider" aria-hidden="true" />
        <template v-if="block && !block.locked">
            <div class="quick-scroll">
                <div ref="fields" class="quick-fields" @scroll.passive="onFieldsScroll">
                    <component :is="BLOCK_INSPECTORS[block.type]" :block="block" />
                </div>
                <template v-if="bar">
                    <span class="quick-fade quick-fade--start" :class="{ on: more.start }" aria-hidden="true" data-testid="quick-fade-start" />
                    <span class="quick-fade quick-fade--end" :class="{ on: more.end }" aria-hidden="true" data-testid="quick-fade-end" />
                </template>
            </div>
            <span v-if="!bar" class="quick-divider" aria-hidden="true" />
        </template>
        <div v-if="writing" class="quick-actions">
            <button class="d-btn d-btn--primary quick-done" type="button" data-testid="quick-done" data-quick-stop @click="editor.endTextEdit()">
                {{ t.quick.done }}
            </button>
        </div>
        <div v-else class="quick-actions">
            <button
                v-if="!bar"
                v-tip="lockLabel"
                class="d-btn d-btn--icon d-btn--ghost quick-action"
                :class="{ 'quick-action--on': allLocked }"
                type="button"
                :aria-label="t.common.lock"
                :aria-pressed="allLocked"
                data-testid="quick-lock"
                data-quick-stop
                @click="editor.setLocked(ids, !allLocked)"
            >
                <Icon :name="allLocked ? 'lock' : 'unlock'" :size="18" />
            </button>
            <!-- On a phone they move into "⋯": the bar keeps its width for the fields (user at the test instance, 2026-10-09). -->
            <template v-if="!allLocked && !bar">
                <button
                    v-tip="withKeys(t.common.duplicate, KEYS.duplicate)"
                    class="d-btn d-btn--icon d-btn--ghost quick-action"
                    type="button"
                    :aria-label="t.common.duplicate"
                    data-testid="quick-duplicate"
                    data-quick-stop
                    @click="editor.duplicateBlocks(ids)"
                >
                    <Icon name="duplicate" :size="bar ? 20 : 18" />
                </button>
                <button
                    v-tip="withKeys(t.common.delete, KEYS.delete)"
                    class="d-btn d-btn--icon d-btn--ghost quick-action quick-delete"
                    type="button"
                    :aria-label="t.common.delete"
                    data-testid="quick-delete"
                    data-quick-stop
                    @click="editor.removeBlocks(ids)"
                >
                    <Icon name="trash" :size="bar ? 20 : 18" />
                </button>
            </template>
            <div ref="moreWrap" class="quick-more">
                <button
                    ref="moreButton"
                    v-tip="t.editor.moreActions"
                    class="d-btn d-btn--icon d-btn--ghost quick-action"
                    :class="{ 'quick-action--on': moreOpen }"
                    type="button"
                    :aria-label="t.editor.moreActions"
                    aria-haspopup="menu"
                    :aria-expanded="moreOpen"
                    data-testid="quick-more"
                    data-quick-stop
                    @click="moreOpen = !moreOpen"
                >
                    <Icon name="more" :size="bar ? 20 : 18" />
                </button>
                <div
                    v-if="moreOpen"
                    ref="moreList"
                    class="quick-more-list"
                    :class="{ 'quick-more-list--above': moreAbove }"
                    role="menu"
                    data-testid="quick-more-list"
                    @keydown="onMoreKey"
                >
                    <button v-if="editor.canGroup" role="menuitem" type="button" data-testid="quick-group" @click="choose(() => editor.groupBlocks(ids))">
                        {{ t.common.group }}<kbd>{{ keyLabel(KEYS.group) }}</kbd>
                    </button>
                    <button v-if="editor.canUngroup" role="menuitem" type="button" data-testid="quick-ungroup" @click="choose(() => editor.ungroupBlocks(ids))">
                        {{ t.common.ungroup }}<kbd>{{ keyLabel(KEYS.ungroup) }}</kbd>
                    </button>
                    <button v-if="bar" role="menuitem" type="button" data-testid="quick-lock" @click="choose(() => editor.setLocked(ids, !allLocked))">
                        {{ lockLabel }}
                    </button>
                    <hr v-if="bar" role="separator">
                    <button
                        v-if="bar && block && block.type === 'text' && !block.locked"
                        role="menuitem"
                        type="button"
                        data-testid="quick-edit-text"
                        @click="choose(() => editor.startTextEdit(block!.id))"
                    >
                        {{ t.quick.editText }}
                    </button>
                    <button
                        v-if="bar && !allLocked"
                        role="menuitem"
                        type="button"
                        data-testid="quick-duplicate"
                        @click="choose(() => editor.duplicateBlocks(ids))"
                    >
                        {{ t.common.duplicate }}
                    </button>
                    <button role="menuitem" type="button" data-testid="quick-copy" @click="choose(() => editor.copyBlocks(ids))">
                        {{ t.quick.copy }}<kbd>{{ keyLabel(KEYS.copy) }}</kbd>
                    </button>
                    <button v-if="many && !allLocked" role="menuitem" type="button" data-testid="quick-cut" @click="choose(() => editor.cutBlocks(ids))">
                        {{ t.quick.cut }}<kbd>{{ keyLabel(KEYS.cut) }}</kbd>
                    </button>
                    <template v-if="block && !block.locked">
                        <button
                            role="menuitem"
                            type="button"
                            :disabled="!editor.clipboard.length"
                            data-testid="quick-paste"
                            @click="choose(() => editor.pasteBlocks())"
                        >
                            {{ t.quick.paste }}<kbd>{{ keyLabel(KEYS.paste) }}</kbd>
                        </button>
                        <hr role="separator">
                        <button
                            v-for="layer in LAYERS"
                            :key="layer.where"
                            role="menuitem"
                            type="button"
                            :data-testid="`quick-layer-${layer.where}`"
                            @click="choose(() => editor.layerBlocks(ids, layer.where))"
                        >
                            {{ layer.label }}
                        </button>
                    </template>
                    <button v-if="below" role="menuitem" type="button" data-testid="quick-select-below" @click="choose(() => editor.selectBlock(below!.id))">
                        {{ t.quick.selectBelow }}
                    </button>
                    <button v-if="(bar || coarse) && !editor.multiSelect" role="menuitem" type="button" data-testid="quick-multi-select" @click="choose(() => editor.startMultiSelect())">
                        {{ t.editor.multiSelect }}
                    </button>
                    <template v-if="many && !bar">
                        <hr role="separator">
                        <button role="menuitem" type="button" data-testid="quick-deselect" @click="choose(deselect)">
                            {{ t.quick.deselect }}
                        </button>
                    </template>
                    <!-- Several on a phone: the sheet holds the layer buttons for all of them (Arrange). -->
                    <template v-if="block || (many && bar)">
                        <hr role="separator">
                        <button role="menuitem" type="button" data-testid="quick-all-settings" @click="choose(() => emit('all-settings'))">
                            {{ t.quick.allSettings }}
                        </button>
                    </template>
                    <template v-if="bar && !allLocked">
                        <hr role="separator">
                        <button role="menuitem" type="button" class="quick-more-danger" data-testid="quick-delete" @click="choose(() => editor.removeBlocks(ids))">
                            {{ t.common.delete }}
                        </button>
                    </template>
                </div>
            </div>
            <button
                v-if="bar"
                class="d-btn d-btn--icon d-btn--ghost quick-action"
                type="button"
                :aria-label="t.quick.deselect"
                data-testid="quick-deselect"
                data-quick-stop
                @click="deselect"
            >
                <Icon name="close" :size="20" />
            </button>
        </div>
    </div>
</template>

<style scoped>
.quick-menu {
    position: absolute;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: var(--d-space-1);
    box-sizing: border-box;
    height: 44px;
    padding: var(--d-space-1);
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow);
    color: var(--d-text);
    font-family: var(--d-font);
    font-size: var(--d-size);
    white-space: nowrap;
}
.quick-fields,
.quick-actions {
    display: flex;
    align-items: center;
    gap: var(--d-space-1);
}
/* "3 Bausteine": the menu of several has no fields, only this name. */
.quick-count {
    flex: none;
    padding: 0 var(--d-space-2);
    font-weight: var(--d-weight-normal);
}
.quick-menu--bar .quick-count {
    flex: 1;
}
.quick-divider {
    flex: none;
    width: 1px;
    height: 20px;
    background: var(--d-divider);
}
.quick-done {
    min-height: 32px;
    height: 32px;
}
.quick-action {
    width: 32px;
    min-width: 32px;
    height: 32px;
    min-height: 32px;
}
.quick-action--on,
.quick-action--on:hover:not(:disabled) {
    background: var(--d-accent-pale);
    color: var(--d-accent-strong);
}
.quick-delete:hover:not(:disabled) {
    background: var(--d-danger-pale);
    color: var(--d-danger);
}
.quick-more {
    position: relative;
}
/* The list behind "⋯", after the editor's "…" menu. */
.quick-more-list {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    z-index: 5;
    display: grid;
    min-width: 220px;
    padding: 4px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow);
}
.quick-more-list--above {
    top: auto;
    bottom: calc(100% + 8px);
}
.quick-more-list button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--d-space-4);
    min-height: 36px;
    padding: 6px 10px;
    border: 0;
    border-radius: var(--d-radius);
    background: none;
    color: var(--d-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
}
.quick-more-list button:hover:not(:disabled),
.quick-more-list button:focus-visible {
    background: var(--d-panel);
}
.quick-more-list button:disabled {
    opacity: 0.5;
    cursor: default;
}
.quick-more-list kbd {
    color: var(--d-text-faint);
    font: inherit;
    font-size: var(--d-size-sm);
}
.quick-more-list hr {
    width: 100%;
    margin: 4px 0;
    border: 0;
    border-top: 1px solid var(--d-divider);
}
/* The bar at the bottom of a phone (C2): the upper row of 56 px – symbol, fields to scroll, then the actions and "Auswahl aufheben", each at least 44 × 44. */
.quick-menu--bar {
    position: relative;
    z-index: auto;
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 var(--d-space-2);
    border-radius: 0;
    background: none;
    box-shadow: none;
}
.quick-kind {
    display: grid;
    flex: none;
    place-items: center;
    width: 24px;
    height: 24px;
}
/* Only the bar needs a frame around the fields: for the fades at its edges. */
.quick-scroll {
    display: contents;
}
.quick-menu--bar .quick-scroll {
    position: relative;
    display: flex;
    flex: 1;
    min-width: 0;
    height: 100%;
    align-items: center;
}
/* The fields scroll and fade out at an edge where there is more. No mask: the sheet of a field hangs inside; the fades lie above the fields, below the sheet. */
.quick-fade {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 1;
    width: 32px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s;
}
.quick-fade.on {
    opacity: 1;
}
.quick-fade--start {
    left: 0;
    background: linear-gradient(to right, var(--d-panel), transparent);
}
.quick-fade--end {
    right: 0;
    background: linear-gradient(to left, var(--d-panel), transparent);
}
.quick-menu--bar .quick-fields {
    flex: 1;
    min-width: 0;
    padding: 0 var(--d-space-1);
    overflow-x: auto;
    scrollbar-width: none;
}
.quick-menu--bar .quick-fields::-webkit-scrollbar {
    display: none;
}
.quick-menu--bar .quick-actions {
    flex: none;
    margin-left: auto;
}
.quick-menu--bar .quick-action,
.quick-menu--bar .quick-done {
    width: 44px;
    min-width: 44px;
    height: 44px;
    min-height: 44px;
}
.quick-menu--bar .quick-done {
    width: auto;
    padding: 0 var(--d-space-4);
}
.quick-menu--bar .quick-fields :deep(button.quick-chip) {
    flex: none;
    height: 44px;
    min-width: 44px;
    max-width: 150px;
}
.quick-menu--bar .quick-fields :deep(.quick-face) {
    white-space: nowrap;
}
/* A hairline between the fields and "⋯". */
.quick-menu--bar .quick-actions {
    padding-left: var(--d-space-1);
    border-left: 1px solid var(--d-divider);
}
.quick-more-danger {
    color: var(--d-danger);
}
.quick-menu--bar .quick-fields :deep(.segment-face) {
    min-width: 44px;
    min-height: 44px;
}
.quick-menu--bar .quick-more-list {
    top: auto;
    bottom: calc(100% + 8px);
}
.quick-menu--bar .quick-more-list button {
    min-height: 44px;
}
</style>
