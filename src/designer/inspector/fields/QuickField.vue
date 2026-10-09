<script setup lang="ts">
/**
 * The shape a field takes in the short menu above the block (Plan.md 79, C1). In the inspector (`full`) it is invisible:
 * the field is drawn as it is. In the short menu a field without the mark `quick` is not drawn; with `inline` it
 * stands in the menu itself (its visible label gone, kept for a screen reader); otherwise it is a chip with a short
 * `face` (or a round `swatch`), and a click opens the field itself in a small panel below – always in `full` mode, so it is
 * the very field of the inspector. Only one panel is open at a time (the menu provides the shared state).
 * In the bar of a phone (Plan.md 79, C2) the panel is a sheet from below over the bar: a grip and the label on top,
 * a swipe down or a tap beside closes it.
 */
import { computed, inject, nextTick, onBeforeUnmount, provide, ref, useId, watch } from 'vue';
import { t } from '../../../i18n/designer';
import Icon from '../../Icon.vue';
import { quickFieldPlace } from '../../quick-menu';
import { vTip } from '../../tip';
import { IN_QUICK_FIELD, INSPECTOR_MODE, QUICK_OPEN, QUICK_VARIANT, useInspectorMode } from '../mode';

const props = defineProps<{ quick?: boolean; label: string; face?: string; swatch?: string; inline?: boolean }>();
defineSlots<{ default(): unknown }>();

const mode = useInspectorMode();
const asChip = computed(() => mode.value === 'quick' && !!props.quick && !props.inline);

// Everything inside is the field as the inspector draws it; a section there shows its content without the fold.
provide(INSPECTOR_MODE, 'full');
const inside = inject(IN_QUICK_FIELD, ref(false));
provide(
    IN_QUICK_FIELD,
    computed(() => inside.value || asChip.value),
);

/** The name for a screen reader: the face where it starts with the label already ("Ecken 12 px"), else "label: face". */
const chipName = computed(() => (props.swatch || !props.face ? props.label : props.face.startsWith(props.label) ? props.face : t.quick.chip(props.label, props.face)));

const id = useId();
const shared = inject(QUICK_OPEN, null) ?? ref<string | null>(null);
const sheet = inject(QUICK_VARIANT, 'float') === 'bar';
const open = computed(() => asChip.value && shared.value === id);

const root = ref<HTMLElement | null>(null);
const chip = ref<HTMLButtonElement | null>(null);
const panel = ref<HTMLElement | null>(null);
/** Beside the chip and above or below it, kept inside the host of the editor. */
const placement = ref({ dx: 0, above: false });

function close(refocus = false): void {
    if (shared.value === id) shared.value = null;
    if (refocus) chip.value?.focus();
}

function toggle(): void {
    shared.value = open.value ? null : id;
}

function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !open.value) return;
    // Closes the panel and nothing else: the block must stay chosen (as `BlockPalette` does it).
    event.stopPropagation();
    close(true);
}

/** Captured: the menu stops `pointerdown` from bubbling, so a plain document listener would never hear a click inside it. */
function onOutside(event: PointerEvent): void {
    if (!root.value?.contains(event.target as Node)) close();
}

function place(): void {
    if (sheet) return;
    const host = root.value?.closest<HTMLElement>('[data-quick-host]');
    const menu = root.value?.closest<HTMLElement>('[data-testid="quick-menu"]');
    if (!host || !menu || !chip.value || !panel.value) return;
    const size = { width: panel.value.offsetWidth, height: panel.value.offsetHeight };
    placement.value = quickFieldPlace(chip.value.getBoundingClientRect(), menu.getBoundingClientRect(), size, host.getBoundingClientRect());
}

/** A swipe down on the grip or the head closes the sheet from this distance on; until then the sheet follows the finger. */
const SWIPE_CLOSE = 60;
const swipe = ref<{ id: number; from: number; dy: number } | null>(null);
function onGripDown(event: PointerEvent): void {
    swipe.value = { id: event.pointerId, from: event.clientY, dy: 0 };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
}
function onGripMove(event: PointerEvent): void {
    if (swipe.value?.id === event.pointerId) swipe.value.dy = Math.max(0, event.clientY - swipe.value.from);
}
function onGripUp(event: PointerEvent): void {
    const current = swipe.value;
    if (current?.id !== event.pointerId) return;
    swipe.value = null;
    if (event.clientY - current.from > SWIPE_CLOSE) close();
}

const FOCUSABLE = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The first control of the panel; in a group of radio buttons the chosen one. */
function focusFirst(): void {
    const first = panel.value?.querySelector<HTMLElement>(FOCUSABLE);
    if (first instanceof HTMLInputElement && first.type === 'radio' && first.name) {
        const group = [...(panel.value?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? [])].filter((r) => r.name === first.name);
        (group.find((r) => r.checked) ?? first).focus();
    } else first?.focus();
}

watch(open, async (isOpen) => {
    if (!isOpen) {
        document.removeEventListener('pointerdown', onOutside, true);
        return;
    }
    document.addEventListener('pointerdown', onOutside, true);
    await nextTick();
    place();
    focusFirst();
});

onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onOutside, true);
    close();
});
</script>

<template>
    <slot v-if="mode === 'full'" />
    <template v-else-if="!quick" />
    <div v-else-if="inline" class="quick-inline" data-quick-inline><slot /></div>
    <div v-else ref="root" class="quick-field" @keydown="onKeydown">
        <button
            ref="chip"
            v-tip="swatch ? label : ''"
            type="button"
            class="quick-chip"
            :class="{ 'quick-chip--open': open }"
            :aria-label="chipName"
            aria-haspopup="dialog"
            :aria-expanded="open"
            data-testid="quick-chip"
            data-quick-open
            data-quick-stop
            @click="toggle"
        >
            <span v-if="swatch" class="quick-swatch" :style="{ background: swatch }" />
            <span v-else class="quick-face">{{ face ?? label }}</span>
            <Icon name="chevron-down" :size="12" />
        </button>
        <!-- Catches the tap beside the sheet, so it closes the sheet and does nothing else; the bar below stays reachable. -->
        <div v-if="open && sheet" class="quick-backdrop" data-testid="quick-backdrop" @click="close()" />
        <div
            v-if="open"
            ref="panel"
            class="quick-panel"
            :class="{ 'quick-panel--above': placement.above, 'quick-panel--sheet': sheet }"
            :style="sheet ? (swipe?.dy ? { transform: `translateY(${swipe.dy}px)` } : undefined) : { left: `${placement.dx}px` }"
            role="dialog"
            :aria-label="label"
            data-testid="quick-popover"
        >
            <template v-if="sheet">
                <div
                    class="quick-sheet-head"
                    data-testid="quick-sheet-grip"
                    @pointerdown="onGripDown"
                    @pointermove="onGripMove"
                    @pointerup="onGripUp"
                    @pointercancel="swipe = null"
                >
                    <span class="quick-sheet-grip" aria-hidden="true" />
                    <span class="quick-sheet-title">{{ label }}</span>
                </div>
                <div class="quick-sheet-body"><slot /></div>
            </template>
            <slot v-else />
        </div>
    </div>
</template>

<style scoped>
.quick-field {
    position: relative;
    display: inline-flex;
    flex: none;
}
.quick-panel {
    position: absolute;
    top: calc(100% + 8px);
    z-index: 5;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--d-space-3);
    width: 300px;
    max-height: 360px;
    padding: var(--d-space-3);
    overflow-y: auto;
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow);
    color: var(--d-text);
    font-size: var(--d-size);
    text-align: left;
    white-space: normal;
}
.quick-panel--above {
    top: auto;
    bottom: calc(100% + 8px);
}
/* The sheet of a phone's bar: full width over the bar (over its upper row, when a block is chosen), the grip and the label on top, the field scrolling under them. */
.quick-backdrop {
    position: fixed;
    inset: 0 0 calc(var(--d-phone-bar, 56px) + env(safe-area-inset-bottom));
    z-index: 4;
}
.quick-panel--sheet {
    position: fixed;
    inset: auto 0 calc(var(--d-phone-bar, 56px) + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 0;
    width: auto;
    max-height: 60vh;
    padding: 0;
    overflow: hidden;
    border-radius: var(--d-radius-lg) var(--d-radius-lg) 0 0;
    border-top: 1px solid var(--d-divider);
}
.quick-sheet-head {
    display: flex;
    flex: none;
    flex-direction: column;
    align-items: center;
    gap: var(--d-space-2);
    padding: 8px var(--d-space-4) var(--d-space-2);
    /* The finger drags the sheet here instead of scrolling the page. */
    touch-action: none;
    cursor: grab;
}
.quick-sheet-grip {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--d-interactive);
}
.quick-sheet-title {
    align-self: flex-start;
    font-weight: var(--d-weight-heading);
}
.quick-sheet-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--d-space-3);
    min-height: 0;
    padding: 0 var(--d-space-4) var(--d-space-4);
    overflow-y: auto;
}
/* In the menu itself: the field stands there without its label (the screen reader keeps it) and without the room a row needs. */
.quick-inline {
    display: flex;
    flex: none;
    align-items: center;
}
.quick-inline :deep(.hint-row) {
    flex-wrap: nowrap;
}
.quick-inline :deep(.info-hint) {
    display: none;
}
.quick-inline :deep(.field-row) {
    grid-template-columns: minmax(0, 1fr);
}
.quick-inline :deep(.field-label-box) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    white-space: nowrap;
    clip-path: inset(50%);
}
.quick-inline :deep(.segment-face) {
    min-width: 30px;
    min-height: 30px;
    padding: 0 6px;
}
</style>
