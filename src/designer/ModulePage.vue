<script setup lang="ts">
/**
 * The frame of the module's overview pages: the sidebar as a card on the quiet workspace, the page beside it
 * (Plan.md 79, B3). The editor has its own frame – it needs the whole width. Pages show the frame at once and
 * load inside it: a page that shows "Lade …" instead would look like a reload on every change of section.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { LOCALE } from '../i18n/player';
import ModuleSidebar from './ModuleSidebar.vue';

/**
 * The page background reaches the bottom of the window, below the navigation
 * of ChurchTools, however little the page holds. `100%` would need a height
 * on the host page's elements, which we do not style.
 */
const root = ref<HTMLElement | null>(null);
const top = ref(0);
function measure(): void {
    if (root.value) top.value = Math.max(0, root.value.getBoundingClientRect().top + window.scrollY);
}
onMounted(() => {
    measure();
    window.addEventListener('resize', measure);
});
onBeforeUnmount(() => window.removeEventListener('resize', measure));
</script>

<template>
    <!-- "de": names on a tile may need to hyphenate (Plan.md 44, M5) – we do not know what the host page sets. -->
    <div ref="root" :lang="LOCALE" class="infoscreen-designer module-page" :style="{ minHeight: `calc(100vh - ${top}px)` }">
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
.content {
    display: grid;
    align-content: start;
    gap: var(--d-space-4);
    padding-bottom: var(--d-space-6);
}
@media (max-width: 48rem) {
    .layout {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto 1fr;
        padding: var(--d-space-3);
    }
    .content {
        padding-bottom: var(--d-space-5);
    }
}
</style>
