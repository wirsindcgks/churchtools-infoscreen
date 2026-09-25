<script setup lang="ts">
/**
 * The head of every module page: symbol, title, and a line on what the page
 * is for. The line runs as wide as the content below it – no narrower column
 * that breaks it early.
 */
import Icon, { type IconName } from './Icon.vue';

defineProps<{ icon: IconName; title: string; testid: string }>();
</script>

<template>
    <div class="page-head">
        <div class="page-title">
            <span class="title-icon"><Icon :name="icon" :size="20" /></span>
            <h1 :data-testid="testid">{{ title }}</h1>
        </div>
        <p v-if="$slots.default" class="intro"><slot /></p>
    </div>
</template>

<style scoped>
.page-head {
    display: grid;
    gap: 6px;
}
.page-title {
    display: flex;
    align-items: center;
    gap: 12px;
}
h1 {
    margin: 0;
    font-size: 1.8em;
}
.title-icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: var(--d-radius-lg);
    background: var(--d-accent-pale);
    color: var(--d-accent);
}
.intro {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
@media (max-width: 48rem) {
    h1 {
        font-size: 1.4em;
    }
    .title-icon {
        display: none;
    }
}
</style>
