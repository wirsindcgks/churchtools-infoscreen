<script setup lang="ts">
/**
 * The frame of the module's overview pages, after "Gruppen" in ChurchTools:
 * bar on top, sidebar left, content on the page background. The editor has
 * its own frame – it needs the whole width.
 */
import AppBar from './AppBar.vue';
import type { FormatFilter } from './format-filter';
import ModuleSidebar from './ModuleSidebar.vue';

defineProps<{ current: 'screens' | 'setup'; admin: boolean; counts?: Record<FormatFilter, number> }>();
</script>

<template>
    <div class="infoscreen-designer module-page">
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
    min-height: 100%;
    background: var(--d-panel);
}
.layout {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr);
    align-items: start;
}
.content {
    display: grid;
    align-content: start;
    gap: 16px;
    min-height: 60vh;
    padding: 20px 24px 48px;
    border-left: 1px solid var(--d-divider);
}
@media (max-width: 48rem) {
    .layout {
        grid-template-columns: minmax(0, 1fr);
    }
    .content {
        padding: 12px 12px 32px;
        border-left: 0;
    }
}
</style>
