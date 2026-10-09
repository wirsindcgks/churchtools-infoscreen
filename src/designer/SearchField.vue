<script setup lang="ts">
/** The search above a page's items – the same field on every page of the module. */
import Icon from './Icon.vue';

defineProps<{ placeholder: string; label: string; testid: string }>();
const query = defineModel<string>({ required: true });
</script>

<template>
    <label class="search">
        <Icon name="search" class="search-icon" />
        <input v-model="query" type="search" :placeholder="placeholder" :aria-label="label" :data-testid="testid">
    </label>
</template>

<style scoped>
.search {
    position: relative;
    display: block;
}
.search-icon {
    position: absolute;
    top: 50%;
    left: var(--d-space-3);
    color: var(--d-text-muted);
    transform: translateY(-50%);
}
/* A white field with a soft shadow on the workspace, not a frame (Plan.md 79, B3). */
input {
    min-height: 44px;
    padding-left: 40px;
    border-color: transparent;
    border-radius: var(--d-radius-lg);
    box-shadow: var(--d-shadow-card);
}
</style>
