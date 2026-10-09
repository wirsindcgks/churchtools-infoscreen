<script setup lang="ts">
/**
 * The head of every module page: symbol, title, a line on what the page is for – and the page's actions
 * ("Bildschirm erstellen" …) on the right (Plan.md 79, B3). The line runs as wide as the room beside the
 * actions allows.
 */
import Icon, { type IconName } from './Icon.vue';

defineProps<{ icon: IconName; title: string; testid: string }>();
</script>

<template>
    <div class="page-head">
        <span class="title-icon"><Icon :name="icon" :size="22" /></span>
        <div class="page-text">
            <h1 :data-testid="testid">{{ title }}</h1>
            <p v-if="$slots.default" class="intro"><slot /></p>
        </div>
        <div v-if="$slots.actions" class="page-actions"><slot name="actions" /></div>
    </div>
</template>

<style scoped>
.page-head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--d-space-3) var(--d-space-4);
}
.title-icon {
    display: grid;
    flex: none;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: var(--d-radius-lg);
    background: var(--d-accent-pale);
    color: var(--d-accent);
}
.page-text {
    flex: 1 1 16rem;
    min-width: 0;
}
h1 {
    margin: 0;
    font-size: 1.85em;
    font-weight: 800;
    line-height: 1.2;
}
.intro {
    margin: var(--d-space-1) 0 0;
    color: var(--d-text-muted);
}
.page-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--d-space-2);
}
@media (max-width: 48rem) {
    h1 {
        font-size: 1.4em;
    }
    .title-icon {
        display: none;
    }
    .page-text {
        flex-basis: 10rem;
    }
}
</style>
