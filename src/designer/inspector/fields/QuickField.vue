<script setup lang="ts">
/**
 * The shape a field takes in the short menu above the block (Plan.md 79, C1). In the inspector (`full`) it is invisible:
 * the field is drawn as it is. In the short menu a field without the mark `quick` is not drawn; with `inline` it
 * stands in the menu itself (its visible label gone, kept for a screen reader); otherwise it is a chip with a short
 * `face` (or a round `swatch`), and a click opens the field itself in a small panel below – always in `full` mode, so it is
 * the very field of the inspector. Only one panel is open at a time (the menu provides the shared state).
 */
import { computed, inject, nextTick, onBeforeUnmount, provide, ref, useId, watch } from 'vue';
import { t } from '../../../i18n/designer';
import Icon from '../../Icon.vue';
import { quickFieldPlace } from '../../quick-menu';
import { vTip } from '../../tip';
import { IN_QUICK_FIELD, INSPECTOR_MODE, QUICK_OPEN, useInspectorMode } from '../mode';

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
    const host = root.value?.closest<HTMLElement>('[data-quick-host]');
    const menu = root.value?.closest<HTMLElement>('[data-testid="quick-menu"]');
    if (!host || !menu || !chip.value || !panel.value) return;
    const size = { width: panel.value.offsetWidth, height: panel.value.offsetHeight };
    placement.value = quickFieldPlace(chip.value.getBoundingClientRect(), menu.getBoundingClientRect(), size, host.getBoundingClientRect());
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
        <div
            v-if="open"
            ref="panel"
            class="quick-panel"
            :class="{ 'quick-panel--above': placement.above }"
            :style="{ left: `${placement.dx}px` }"
            role="dialog"
            :aria-label="label"
            data-testid="quick-popover"
        >
            <slot />
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
