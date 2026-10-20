<script setup lang="ts">
/**
 * The card that offers the introduction to the editor (Plan.md 81): it floats at the bottom left without blocking
 * the page and never starts anything by itself. The editor decides when it shows and what its buttons remember.
 */
import { t } from '../i18n/designer';
import Icon from './Icon.vue';
import { vTip } from './tip';

const emit = defineEmits<{ start: []; later: []; close: [] }>();
</script>

<template>
    <aside class="intro-card" role="region" aria-labelledby="intro-card-title" data-testid="intro-card">
        <button v-tip="t.intro.cardClose" class="d-btn d-btn--icon d-btn--ghost close" type="button" :aria-label="t.intro.cardClose" data-testid="intro-card-close" @click="emit('close')">
            <Icon name="close" :size="16" />
        </button>
        <h2 id="intro-card-title">{{ t.intro.cardTitle }}</h2>
        <p>{{ t.intro.cardText }}</p>
        <div class="actions">
            <button class="d-btn d-btn--primary" type="button" data-testid="intro-start" @click="emit('start')">{{ t.intro.cardStart }}</button>
            <button class="d-btn" type="button" data-testid="intro-later" @click="emit('later')">{{ t.intro.cardLater }}</button>
        </div>
    </aside>
</template>

<style scoped>
.intro-card {
    position: absolute;
    left: var(--d-space-4);
    bottom: var(--d-space-4);
    z-index: 60;
    box-sizing: border-box;
    width: min(320px, calc(100% - 2 * var(--d-space-4)));
    padding: var(--d-space-4);
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow);
}
.close {
    position: absolute;
    top: var(--d-space-2);
    right: var(--d-space-2);
}
h2 {
    margin: 0 0 var(--d-space-2);
    padding-right: var(--d-space-6);
    font-size: 1.1em;
}
p {
    margin: 0 0 var(--d-space-4);
}
.actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--d-space-2);
}
</style>
