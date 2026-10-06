<script setup lang="ts">
/**
 * Gives the colour fields inside it the palette of `theme` – for a field on a page that offers no swatches
 * elsewhere, like the card colour on the Design page (Plan.md 74), where the palette is being edited itself.
 */
import { toRef } from 'vue';
import type { ThemeDoc } from '../model/schema';
import { providePalette } from './palette';

const props = defineProps<{ theme: ThemeDoc }>();
providePalette(toRef(props, 'theme'));
</script>

<template>
    <slot />
</template>
