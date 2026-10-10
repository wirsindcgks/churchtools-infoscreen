<script setup lang="ts">
/**
 * The frame of the module's overview pages: the sidebar as a card on the quiet workspace, the page beside it
 * (Plan.md 79, B3). The editor has its own frame – it needs the whole width. Pages show the frame at once and
 * load inside it: a page that shows "Lade …" instead would look like a reload on every change of section.
 */
import { ref } from 'vue';
import { LOCALE } from '../i18n/player';
import ModuleSidebar from './ModuleSidebar.vue';
import { useOffsetTop } from './useOffsetTop';

/**
 * The page background reaches the bottom of the window, below the navigation
 * of ChurchTools, however little the page holds. `100%` would need a height
 * on the host page's elements, which we do not style. The navigation stays
 * where it is when the page scrolls, so the offset holds still (the sidebar
 * reads it as `--page-top`).
 */
const root = ref<HTMLElement | null>(null);
const top = useOffsetTop(root);
</script>

<template>
    <!-- "de": names on a tile may need to hyphenate (Plan.md 44, M5) – we do not know what the host page sets. -->
    <div ref="root" :lang="LOCALE" class="infoscreen-designer module-page" :style="{ minHeight: `calc(100vh - ${top}px)`, '--page-top': `${top}px` }">
        <div class="layout">
            <ModuleSidebar />
            <main class="content"><slot /></main>
        </div>
    </div>
</template>

<style scoped>
.module-page {
    display: flex;
    flex-direction: column;
    background: var(--d-workspace);
}
.layout {
    flex: 1;
    display: grid;
    grid-template-columns: 236px minmax(0, 1fr);
    gap: var(--d-space-4);
    padding: var(--d-space-4);
}
.module-page :deep(.module-sidebar) {
    align-self: start;
}
/* The page lies on a light surface like the sidebar (Plan.md 79, B3); the tiles in it get a quieter shadow and a thin edge. */
.content {
    --d-shadow-card: 0 1px 2px #0f172a14, 0 2px 8px #0f172a0d;
    display: grid;
    min-width: 0;
    align-content: start;
    gap: var(--d-space-4);
    padding: var(--d-space-5);
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow-card);
}
.content :deep(.d-card) {
    border-color: var(--d-edge);
}
@media (max-width: 48rem) {
    .layout {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto 1fr;
        padding: var(--d-space-3);
    }
    .content {
        padding: var(--d-space-4);
    }
}
</style>
