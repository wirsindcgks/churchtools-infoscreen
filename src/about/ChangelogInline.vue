<script setup lang="ts">
/**
 * Renders the inline parts of a changelog bullet or paragraph – strong, code,
 * link and plain text – without a wrapper element, so it fits into a <li>
 * or <p> of the caller.
 */
import type { Inline } from './changelog';

defineProps<{ parts: Inline[] }>();
</script>

<template>
    <template v-for="(part, i) in parts" :key="i">
        <strong v-if="part.kind === 'strong'">{{ part.text }}</strong>
        <code v-else-if="part.kind === 'code'">{{ part.text }}</code>
        <a v-else-if="part.kind === 'link'" :href="part.href" target="_blank" rel="noopener">{{ part.text }}</a>
        <template v-else>{{ part.text }}</template>
    </template>
</template>
