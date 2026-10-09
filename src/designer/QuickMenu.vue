<script setup lang="ts">
/**
 * The short menu above the chosen block (Plan.md 79, C1): on the left the block's marked fields in their compact form, then
 * the actions lock, duplicate, delete and "⋯". It stands in the host of the stage, outside the scaled stage, in screen pixels,
 * so text and buttons keep their size at every zoom. A locked block shows only "Entsperren" and "⋯".
 * `variant="bar"` (C2) is the same menu as the bar at the bottom of a phone: the block's symbol, the fields in a row to
 * scroll, then duplicate, delete and "⋯" – which also holds lock/unlock there. An open field is a sheet from below.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue';
import { t } from '../i18n/designer';
import type { Block } from '../model/schema';
import { useEditorStore } from './editor-store';
import Icon from './Icon.vue';
import { BLOCK_INSPECTORS } from './inspector/blocks';
import { INSPECTOR_MODE, QUICK_OPEN, QUICK_VARIANT } from './inspector/mode';
import { BLOCK_ICONS, BLOCK_LABELS, type Layer } from './ops';
import { quickMenuPlace, type Rect, type Size } from './quick-menu';
import { KEYS, keyLabel, withKeys } from './shortcuts';
import { vTip } from './tip';

/** `frame`: the block's rectangle in host pixels; `host`: the size of the host – both only for the menu above the block. */
const props = defineProps<{ block: Block; frame?: Rect; host?: Size; variant?: 'float' | 'bar' }>();
const emit = defineEmits<{ 'all-settings': [] }>();

const editor = useEditorStore();
const bar = props.variant === 'bar';
provide(INSPECTOR_MODE, 'quick');
provide(QUICK_VARIANT, bar ? 'bar' : 'float');
/** Only one field is open at a time. */
const openField = ref<string | null>(null);
provide(QUICK_OPEN, openField);

const root = ref<HTMLElement | null>(null);
const fields = ref<HTMLElement | null>(null);

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
    ready.value = true;
    if (typeof ResizeObserver !== 'undefined' && root.value) {
        observer = new ResizeObserver(measure);
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

function closeMoreOnOutside(event: PointerEvent): void {
    if (!moreWrap.value?.contains(event.target as Node)) moreOpen.value = false;
}
watch(moreOpen, async (open) => {
    if (!open) {
        document.removeEventListener('pointerdown', closeMoreOnOutside, true);
        return;
    }
    openField.value = null;
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
defineExpose({ openFirst });

/** The block is being written on the stage (Plan.md 79, C4): the menu keeps its fields and offers "Fertig" instead of the actions. */
const writing = computed(() => editor.editingTextId === props.block.id);
const lockLabel = computed(() => (props.block.locked ? t.quick.unlock : t.common.lock));
</script>

<template>
    <div
        ref="root"
        class="quick-menu"
        :class="{ 'quick-menu--bar': bar }"
        :style="bar ? undefined : { left: `${placed.left}px`, top: `${placed.top}px`, visibility: ready ? undefined : 'hidden' }"
        role="toolbar"
        :aria-label="t.quick.label(BLOCK_LABELS[block.type])"
        data-testid="quick-menu"
        @pointerdown.stop
        @keydown="onKeydown"
        @focusin="focusInside = true"
        @focusout="onFocusOut"
    >
        <span v-if="bar" class="quick-kind" role="img" :aria-label="BLOCK_LABELS[block.type]" data-testid="quick-kind">
            <Icon :name="BLOCK_ICONS[block.type]" :size="20" />
        </span>
        <template v-if="!block.locked">
            <div ref="fields" class="quick-fields">
                <component :is="BLOCK_INSPECTORS[block.type]" :block="block" />
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
                :class="{ 'quick-action--on': block.locked }"
                type="button"
                :aria-label="t.common.lock"
                :aria-pressed="!!block.locked"
                data-testid="quick-lock"
                data-quick-stop
                @click="editor.setLocked(block.id, !block.locked)"
            >
                <Icon :name="block.locked ? 'lock' : 'unlock'" :size="18" />
            </button>
            <template v-if="!block.locked">
                <button
                    v-tip="withKeys(t.common.duplicate, KEYS.duplicate)"
                    class="d-btn d-btn--icon d-btn--ghost quick-action"
                    type="button"
                    :aria-label="t.common.duplicate"
                    data-testid="quick-duplicate"
                    data-quick-stop
                    @click="editor.duplicateBlock(block.id)"
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
                    @click="editor.removeBlock(block.id)"
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
                    <button v-if="bar" role="menuitem" type="button" data-testid="quick-lock" @click="choose(() => editor.setLocked(block.id, !block.locked))">
                        {{ lockLabel }}
                    </button>
                    <hr v-if="bar" role="separator">
                    <button role="menuitem" type="button" data-testid="quick-copy" @click="choose(() => editor.copyBlock(block.id))">
                        {{ t.quick.copy }}<kbd>{{ keyLabel(KEYS.copy) }}</kbd>
                    </button>
                    <template v-if="!block.locked">
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
                            @click="choose(() => editor.layerBlock(block.id, layer.where))"
                        >
                            {{ layer.label }}
                        </button>
                    </template>
                    <hr role="separator">
                    <button role="menuitem" type="button" data-testid="quick-all-settings" @click="choose(() => emit('all-settings'))">
                        {{ t.quick.allSettings }}
                    </button>
                </div>
            </div>
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
/* The bar at the bottom of a phone (C2): one row of 56 px – symbol, fields to scroll, then the actions, each at least 44 × 44. */
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
    width: 36px;
    height: 44px;
    color: var(--d-text-muted);
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
    height: 44px;
    min-width: 44px;
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
