<script setup lang="ts">
/**
 * The name of a level of the inspector (Plan.md 133): "Auf der Folie", "Diese Folie", "Ganze Präsentation". It names what
 * the sections below it belong to. The levels part by their tinted surfaces, not by lines (patch after `v0.73.0`); the
 * section right below the name drops its own line. The class is not `divider`: ChurchTools styles that name for the whole
 * page (centred text between two lines).
 */
defineProps<{ label: string; testid: string; first?: boolean }>();
</script>

<template>
    <p class="inspector-level" :class="{ 'inspector-level--first': first }" role="heading" aria-level="3" :data-testid="testid">{{ label }}</p>
</template>

<style scoped>
.inspector-level {
    margin: 0;
    padding: var(--d-space-3) 0 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    font-weight: var(--d-weight-heading);
}
.inspector-level--first {
    padding-top: var(--d-space-1);
}
</style>

<style>
/* The first section of a level stands right under its name, without a line of its own. */
.inspector-level + .section {
    border-top: 0;
}
</style>
