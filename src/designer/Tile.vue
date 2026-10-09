<script setup lang="ts">
/**
 * The one tile of all areas (Plan.md 79, B3): the picture on top with the marks on it, the head with the name
 * and the "…" menu, then sections set apart by a hairline (what belongs together stands in one; an empty one is
 * left out by its owner with `v-if`), the foot last. The owner brings the picture's link or button, the name and
 * the menu's entries; the menu closes on Escape, on a click beside it and – by `close` – after an entry.
 */
import { onBeforeUnmount, ref, watch } from 'vue';
import { t } from '../i18n/designer';
import Icon from './Icon.vue';

const props = withDefaults(defineProps<{ as?: string; menuLabel?: string; menuTestid?: string }>(), { as: 'article', menuLabel: undefined, menuTestid: undefined });

defineSlots<{
    /** The picture – a link or button with `d-tile-media`. */
    media?: () => unknown;
    /** The marks on the picture, top left. */
    marks?: () => unknown;
    /** The name; no element of its own, the head wraps it. */
    title?: () => unknown;
    /** The entries of the "…" menu; without any there is no "…". */
    menu?: (scope: { close: () => void }) => unknown;
    /** The sections, each a `section.d-tile-section`. */
    default?: () => unknown;
    /** When and by whom it was last changed. */
    foot?: () => unknown;
}>();

const menuOpen = ref(false);
const root = ref<HTMLElement | null>(null);

function close(): void {
    menuOpen.value = false;
}
function closeOnOutside(event: Event): void {
    if (!root.value?.contains(event.target as Node)) close();
}
watch(menuOpen, (open) => {
    if (open) document.addEventListener('pointerdown', closeOnOutside);
    else document.removeEventListener('pointerdown', closeOnOutside);
});
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutside));
</script>

<template>
    <component :is="props.as" ref="root" class="d-card d-tile" @keydown.esc="close">
        <div class="d-tile-picture">
            <slot name="media" />
            <div v-if="$slots.marks" class="d-tile-marks"><slot name="marks" /></div>
        </div>
        <div class="d-tile-body">
            <div class="d-tile-head">
                <h3 class="d-tile-title"><slot name="title" /></h3>
                <div v-if="$slots.menu" class="menu">
                    <button
                        class="d-btn d-btn--icon menu-button"
                        type="button"
                        :aria-expanded="menuOpen"
                        aria-haspopup="menu"
                        :aria-label="menuLabel"
                        :title="t.home.card.actions"
                        :data-testid="menuTestid"
                        @click="menuOpen = !menuOpen"
                    >
                        <Icon name="more" />
                    </button>
                    <div v-if="menuOpen" class="menu-list" role="menu">
                        <slot name="menu" :close="close" />
                    </div>
                </div>
            </div>
            <slot />
            <div v-if="$slots.foot" class="d-tile-section d-tile-foot"><slot name="foot" /></div>
        </div>
    </component>
</template>

<style scoped>
.d-tile-picture {
    position: relative;
}
.d-tile-marks {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-width: calc(100% - 16px);
    /* The click falls through to the picture: the mark is a label, not a button. */
    pointer-events: none;
}
.d-tile-head {
    display: flex;
    align-items: flex-start;
    gap: 4px;
}
.d-tile-head .d-tile-title {
    flex: 1;
    min-width: 0;
}
.menu {
    position: relative;
    margin: calc(var(--d-space-1) * -1) calc(var(--d-space-2) * -1) 0 0;
}
/* The "…" is a 36 px square, quiet until the pointer comes (Plan.md 79, B3). */
.menu-button {
    width: 36px;
    min-width: 36px;
    height: 36px;
    min-height: 36px;
    padding: 0;
    border-color: transparent;
    background: transparent;
    color: var(--d-text-muted);
}
.menu-list {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    z-index: 10;
    display: grid;
    min-width: 190px;
    padding: var(--d-space-1);
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow);
}
.menu-list :deep(a),
.menu-list :deep(button) {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 var(--d-space-3);
    border: 0;
    border-radius: var(--d-radius);
    background: none;
    color: var(--d-text);
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
}
.menu-list :deep(a:hover),
.menu-list :deep(button:hover) {
    background: var(--d-workspace);
}
.menu-list :deep(button:disabled) {
    cursor: not-allowed;
    opacity: 0.5;
}
.menu-list :deep(.danger) {
    color: var(--d-danger);
}
</style>
