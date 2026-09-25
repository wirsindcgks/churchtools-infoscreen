<script setup lang="ts">
/**
 * Line icons as inline SVG in the style of the ChurchTools interface. No icon
 * font: the CSP of ChurchTools allows fonts only from the instance (`font-src
 * 'self'`), and a font for a dozen symbols is more than they are worth.
 */
import { computed } from 'vue';

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const PATHS = {
    grid: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
    landscape: ['M4 6.5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z'],
    portrait: ['M7.5 3h9a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z'],
    plus: ['M12 5v14', 'M5 12h14'],
    search: [circle(11, 11, 6.5), 'M16 16l4.5 4.5'],
    more: [circle(5, 12, 1), circle(12, 12, 1), circle(19, 12, 1)],
    settings: ['M4 6h10', 'M18 6h2', circle(16, 6, 2), 'M4 12h4', 'M12 12h8', circle(10, 12, 2), 'M4 18h10', 'M18 18h2', circle(16, 18, 2)],
    tv: ['M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M8 21h8', 'M12 17v4'],
    slides: ['M7 7h13v11H7z', 'M4 4h13', 'M4 4v11'],
    person: [circle(12, 8, 3.5), 'M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6'],
    copy: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
    trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
    play: ['M8 5l11 7-11 7z'],
    pause: ['M8 5v14', 'M16 5v14'],
    forward: ['M9 5l7 7-7 7'],
    lock: ['M6 11h12v10H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
    unlock: ['M6 11h12v10H6z', 'M8.5 11V8a3.5 3.5 0 0 1 6.8-1.2'],
    eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', circle(12, 12, 3)],
    back: ['M15 5l-7 7 7 7'],
    undo: ['M9 14L4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-3'],
    redo: ['M15 14l5-5-5-5', 'M20 9H9a5 5 0 0 0 0 10h3'],
    external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    // Block types (Plan.md, Nächste Schritte 11)
    text: ['M5 7V5h14v2', 'M12 5v14', 'M9 19h6'],
    image: ['M4 5h16v14H4z', circle(9, 10, 1.5), 'M4 17l5-5 4 4 3-3 4 4'],
    shape: ['M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z'],
    clock: [circle(12, 12, 8), 'M12 8v4l3 2'],
    list: ['M9 7h11', 'M9 12h11', 'M9 17h11', 'M4.5 7h.5', 'M4.5 12h.5', 'M4.5 17h.5'],
    calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
    header: ['M3 5h18v5H3z', 'M3 14h11', 'M3 18h7'],
} as const;

export type IconName = keyof typeof PATHS;

const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 18 });
const paths = computed(() => PATHS[props.name]);
</script>

<template>
    <svg
        class="d-icon"
        :width="size"
        :height="size"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        focusable="false"
    >
        <path v-for="d in paths" :key="d" :d="d" />
    </svg>
</template>

<style scoped>
.d-icon {
    flex: none;
    display: inline-block;
    vertical-align: middle;
}
</style>
