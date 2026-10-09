<script setup lang="ts">
/**
 * The calendar as a small label (Plan.md, 20), drawn like the calendar label of the WordPress plugin of the same
 * makers (Plan.md 79): an outlined pill in the calendar's colour, the name in capitals. The name keeps the block's own
 * text colour – a calendar colour as text would vanish on a slide of a similar tone; the frame carries the calendar.
 */
import { computed } from 'vue';
import { themeOf, useStageContext } from '../context';
import { tint } from '../format';

const props = defineProps<{ name: string; color: string | null }>();
const context = useStageContext();
// A calendar without a colour takes the theme's accent (Plan.md, 27).
const base = computed(() => props.color ?? themeOf(context).accent);
const style = computed(() => ({
    borderColor: tint(base.value, 60),
    background: tint(base.value, 14),
}));
</script>

<template>
    <span class="badge" :style="style">
        <span class="name">{{ name }}</span>
    </span>
</template>

<style scoped>
.badge {
    display: inline-flex;
    align-items: center;
    flex: none;
    max-width: 12em;
    padding: 0.2em 0.65em;
    border: 0.1em solid;
    border-radius: var(--isd-pill, 999px);
    font-size: 0.55em;
    font-weight: 700;
    letter-spacing: 0.05em;
    line-height: 1.3;
    text-transform: uppercase;
    white-space: nowrap;
    vertical-align: middle;
}
.name {
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
