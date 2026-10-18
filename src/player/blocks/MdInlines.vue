<script setup lang="ts">
/** Text pieces of ChurchTools Markdown (src/ct/markdown.ts) as elements, never as HTML. */
import type { MdInline } from '../../ct/markdown';

defineProps<{ parts: MdInline[] }>();
</script>

<template>
    <template v-for="(part, i) in parts" :key="i">
        <code v-if="part.code" class="md-code">{{ part.text }}</code>
        <strong v-else-if="part.strong" :class="{ 'md-em': part.em, 'md-del': part.del }">{{ part.text }}</strong>
        <em v-else-if="part.em" :class="{ 'md-del': part.del }">{{ part.text }}</em>
        <del v-else-if="part.del">{{ part.text }}</del>
        <template v-else>{{ part.text }}</template>
    </template>
</template>

<style scoped>
/* The page around the player styles these of its own – dark on a dark card; colour and font come from the block. */
strong,
em,
del,
code {
    color: inherit;
    font-family: inherit;
}
strong {
    font-weight: 700;
}
.md-em {
    font-style: italic;
}
.md-del {
    text-decoration: line-through;
}
code.md-code {
    padding: 0 0.25em;
    border-radius: 0.2em;
    background: color-mix(in srgb, currentColor 14%, transparent);
    font-size: 0.95em;
}
</style>
