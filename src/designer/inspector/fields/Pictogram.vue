<script setup lang="ts">
import { PICTOGRAMS, type PictogramName } from '../pictograms';

defineProps<{ name: PictogramName }>();
</script>

<template>
    <svg class="pictogram" viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <path v-for="path in PICTOGRAMS[name]" :key="path.d" :d="path.d" :fill="'fill' in path && path.fill ? 'currentColor' : 'none'" />
    </svg>
</template>

<style scoped>
.pictogram {
    width: 100%;
    max-width: 48px;
    height: auto;
}
</style>
