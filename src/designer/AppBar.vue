<script setup lang="ts">
/**
 * The bar of the editor below the ChurchTools navigation: its own title in the default slot, its actions on
 * the right. The overview pages have none – their sidebar carries the sections and their page head the
 * actions (Plan.md 79, B3).
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
    gap: 8px 16px;
    min-height: 56px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--d-divider);
    background: var(--d-surface);
}
.start,
.end {
    display: flex;
    align-items: center;
    gap: 8px;
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
@media (max-width: 40rem) {
    .d-appbar {
        padding: 6px 12px;
    }
}
</style>
