<script setup lang="ts">
/**
 * The frame of the module's overview pages, after "Gruppen" in ChurchTools:
 * bar on top, sidebar left, content on the page background. The editor has
 * its own frame – it needs the whole width. Pages show the frame at once and
 * load inside it: a page that shows "Lade …" instead would look like a reload
 * on every change of section.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { administrator, isAdministrator } from './administrator';
import AppBar from './AppBar.vue';
import type { FormatFilter } from './format-filter';
import ModuleSidebar from './ModuleSidebar.vue';

defineProps<{ current: 'screens' | 'schedules' | 'playlists' | 'media' | 'design' | 'about' | 'setup'; counts?: Record<FormatFilter, number> }>();

const admin = computed(() => administrator.value === true);

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
    void isAdministrator();
    measure();
    window.addEventListener('resize', measure);
});
onBeforeUnmount(() => window.removeEventListener('resize', measure));
</script>

<template>
    <div ref="root" class="infoscreen-designer module-page" :style="{ minHeight: `calc(100vh - ${top}px)` }">
        <AppBar :current="current" :show-setup="admin">
            <template #actions><slot name="actions" /></template>
        </AppBar>
        <div class="layout">
            <ModuleSidebar :admin="admin" :counts="counts" />
            <main class="content"><slot /></main>
        </div>
    </div>
</template>

<style scoped>
.module-page {
    display: flex;
    flex-direction: column;
    background: var(--d-panel);
}
.layout {
    flex: 1;
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
}
.module-page :deep(.module-sidebar) {
    align-self: start;
}
.content {
    display: grid;
    align-content: start;
    gap: 16px;
    padding: 20px 24px 48px;
    border-left: 1px solid var(--d-divider);
}
@media (max-width: 48rem) {
    .layout {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto 1fr;
    }
    .content {
        padding: 12px 12px 32px;
        border-left: 0;
    }
}
</style>
