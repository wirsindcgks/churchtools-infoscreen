<script setup lang="ts">
/**
 * A line of text between the levels of the inspector (Plan.md 133): "Auf der Folie", "Diese Folie", "Ganze Präsentation".
 * It names what the sections below it belong to.
 */
defineProps<{ label: string; testid: string }>();
</script>

<template>
    <p class="divider" role="heading" aria-level="3" :data-testid="testid">{{ label }}</p>
</template>

<style scoped>
.divider {
    margin: var(--d-space-3) 0 0;
    padding-bottom: var(--d-space-1);
    border-bottom: 1px solid var(--d-divider);
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    font-weight: var(--d-weight-heading);
}
</style>
