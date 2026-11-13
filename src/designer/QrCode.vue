<script setup lang="ts">
/**
 * A QR code of an address as inline SVG, black on white. Drawn by the same helper as the block "QR-Code" (`src/player/qr.ts`), so
 * there is one QR library in the module; no dependency on the designer, so the player may show it too (Plan.md 121, "Proben").
 */
import { computed } from 'vue';
import { qrShape } from '../player/qr';

const props = withDefaults(defineProps<{ value: string; size?: number; label?: string }>(), { size: 200, label: '' });

const shape = computed(() => qrShape(props.value));
</script>

<template>
    <svg
        v-if="shape"
        xmlns="http://www.w3.org/2000/svg"
        :width="size"
        :height="size"
        :viewBox="`0 0 ${shape.size} ${shape.size}`"
        shape-rendering="crispEdges"
        role="img"
        :aria-label="label || value"
        data-testid="qr-code"
    >
        <rect :width="shape.size" :height="shape.size" fill="#ffffff" />
        <path :d="shape.path" fill="#000000" />
    </svg>
</template>
