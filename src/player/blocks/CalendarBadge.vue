<script setup lang="ts">
/** The calendar as a small label in its own colour, legible on any stage (Plan.md, 20). */
import { computed } from 'vue';
import { textOn, withAlpha } from '../format';

const props = defineProps<{ name: string; color: string | null }>();
const style = computed(() => ({
    background: withAlpha(props.color, 0.9) ?? 'rgba(255, 255, 255, 0.2)',
    color: textOn(props.color),
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
    border-radius: 999px;
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
