<script setup lang="ts">
/**
 * A line of text between the levels of the inspector (Plan.md 133): "Auf der Folie", "Diese Folie", "Ganze Präsentation".
 * It names what the sections below it belong to. One line above it marks the change of level (none for the `first`);
 * the section right below drops its own line, so a level brings one line, not three (patch after `v0.73.0`).
 * The class is not `divider`: ChurchTools styles that name for the whole page (centred text between two lines).
 */
defineProps<{ label: string; testid: string; first?: boolean }>();
</script>

<template>
    <p class="inspector-level" :class="{ 'inspector-level--first': first }" role="heading" aria-level="3" :data-testid="testid">{{ label }}</p>
</template>

<style scoped>
.inspector-level {
    margin: 0;
    padding: var(--d-space-3) 0 var(--d-space-1);
    border-top: 1px solid var(--d-divider);
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    font-weight: var(--d-weight-heading);
}
.inspector-level--first {
    padding-top: var(--d-space-1);
    border-top: 0;
}
</style>

<style>
/* The first section of a level stands right under its name, without a line of its own. */
.inspector-level + .section {
    border-top: 0;
}
</style>
