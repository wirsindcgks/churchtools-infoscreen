<script setup lang="ts">
/** The calendar as a small label in its own colour, legible on any stage (Plan.md, 20). */
import { computed } from 'vue';
import { themeOf, useStageContext } from '../context';
import { textOn, withAlpha } from '../format';

const props = defineProps<{ name: string; color: string | null }>();
const context = useStageContext();
// A calendar without a colour takes the theme's accent (Plan.md, 27).
const base = computed(() => props.color ?? themeOf(context).accent);
const style = computed(() => ({
    background: withAlpha(base.value, 0.9) ?? 'rgba(255, 255, 255, 0.2)',
    color: textOn(base.value),
}));
</script>

<template>
    <span class="badge" :style="style">{{ name }}</span>
</template>

<style scoped>
.badge {
    display: inline-block;
    flex: none;
    max-width: 12em;
    overflow: hidden;
    padding: 0.2em 0.7em;
    border-radius: var(--isd-pill, 999px);
    font-size: 0.55em;
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.3;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
    vertical-align: middle;
}
</style>
