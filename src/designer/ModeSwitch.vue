<script setup lang="ts">
/**
 * The switch "Designer | Bühne" (Plan.md 121) for people in the designers' and the musicians' group: the same element at the top of
 * the designer and of the stage page, so that the way there and the way back are one. Light in the designer, dark on the stage – the
 * contrast tells at once where one is. The side one is on is no link: "Designer" from a playlist must not jump to the start page.
 */
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { t } from '../i18n/designer';
import Icon from './Icon.vue';

defineProps<{ dark?: boolean }>();

const route = useRoute();
const onStage = computed(() => route.name === 'control');
</script>

<template>
    <nav :class="['mode-switch', { dark }]" :aria-label="t.modeSwitch.label" data-testid="mode-switch">
        <span v-if="!onStage" class="on" aria-current="page" data-testid="mode-designer">
            <Icon name="pencil" :size="16" />{{ t.modeSwitch.designer }}
        </span>
        <RouterLink v-else :to="{ name: 'designer' }" data-testid="mode-designer">
            <Icon name="pencil" :size="16" />{{ t.modeSwitch.designer }}
        </RouterLink>
        <span v-if="onStage" class="on" aria-current="page" data-testid="mode-stage">
            <Icon name="music" :size="16" />{{ t.modeSwitch.stage }}
        </span>
        <RouterLink v-else :to="{ name: 'control' }" data-testid="mode-stage">
            <Icon name="music" :size="16" />{{ t.modeSwitch.stage }}
        </RouterLink>
    </nav>
</template>

<style scoped>
.mode-switch {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px;
    padding: 3px;
    border-radius: var(--d-radius-lg, 10px);
    background: var(--d-workspace);
}
.mode-switch > * {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 38px;
    border-radius: calc(var(--d-radius-lg, 10px) - 2px);
    color: var(--d-text-muted);
    font-weight: var(--d-weight-heading, 700);
    text-decoration: none;
    transition: background-color var(--d-transition, 0.15s);
}
.mode-switch a:hover {
    background: var(--d-panel);
}
.mode-switch .on {
    background: var(--d-accent);
    color: var(--d-accent-text);
}
/* The stage page is dark and keeps its own colours (ControlView): white for the side one is on. */
.mode-switch.dark {
    border-radius: 10px;
    background: #1d2027;
}
.mode-switch.dark > * {
    min-height: 44px;
    border-radius: 8px;
    color: #b8bcc4;
}
.mode-switch.dark a:hover {
    background: #2a2e37;
}
.mode-switch.dark .on {
    background: #f2f2f2;
    color: #101114;
}
.mode-switch a:focus-visible {
    outline: 2px solid var(--d-accent);
    outline-offset: 2px;
}
</style>
