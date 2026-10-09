<script setup lang="ts">
/**
 * The bar of the editor below the ChurchTools navigation: its own title in the default slot, its actions on
 * the right. It lies calm on the workspace, without a surface of its own (Plan.md 79, B3). The overview pages
 * have none – their sidebar carries the sections and their page head the actions.
 */
</script>

<template>
    <header class="d-appbar">
        <div class="start"><slot /></div>
        <div class="end"><slot name="actions" /></div>
    </header>
</template>

<style scoped>
.d-appbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--d-space-2) var(--d-space-4);
    min-height: 64px;
    padding: var(--d-space-2) var(--d-space-5);
}
.start,
.end {
    display: flex;
    align-items: center;
    gap: var(--d-space-2);
    min-width: 0;
}
.start {
    flex: 1;
    overflow: hidden;
}
.end {
    flex-wrap: wrap;
    justify-content: flex-end;
}
@media (max-width: 48rem) {
    .d-appbar {
        min-height: 56px;
        padding: var(--d-space-1) var(--d-space-2);
    }
}
</style>
