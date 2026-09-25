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
    left: 12px;
    color: var(--d-text-muted);
    transform: translateY(-50%);
}
input {
    min-height: 44px;
    padding-left: 40px;
    border-radius: var(--d-radius-lg);
}
</style>
