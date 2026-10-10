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
    // "Ganze Folie" (Plan.md 79, C3): four corners drawn inwards.
    'frame-fit': ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
    more: [circle(5, 12, 1), circle(12, 12, 1), circle(19, 12, 1)],
    pencil: ['M4 20l1-4L16 5l3 3L8 19z', 'M14 7l3 3'],
    settings: ['M4 6h10', 'M18 6h2', circle(16, 6, 2), 'M4 12h4', 'M12 12h8', circle(10, 12, 2), 'M4 18h10', 'M18 18h2', circle(16, 18, 2)],
    tv: ['M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M8 21h8', 'M12 17v4'],
    slides: ['M7 7h13v11H7z', 'M4 4h13', 'M4 4v11'],
    person: [circle(12, 8, 3.5), 'M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6'],
    copy: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
    // Duplicate a block (Plan.md 79, A5): the two sheets of `copy`, with a plus on the front one.
    duplicate: ['M9 9h11v11H9z', 'M5 15H4V4h11v1', 'M14.5 12.5v6', 'M11.5 15.5h6'],
    // Group and ungroup blocks (Plan.md 79, D9): two blocks inside one frame, or the two apart.
    group: ['M3 3h18v18H3z', 'M7 7h5v5H7z', 'M12 12h5v5h-5z'],
    ungroup: ['M4 4h8v8H4z', 'M12 12h8v8h-8z'],
    // Address of a screen: a hash sign.
    id: ['M9.5 4L7.5 20', 'M16.5 4l-2 16', 'M4.5 9h15.5', 'M4 15h15.5'],
    // Linked slides (Plan.md 49): two chain links.
    link: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
    trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
    play: ['M8 5l11 7-11 7z'],
    pause: ['M8 5v14', 'M16 5v14'],
    forward: ['M9 5l7 7-7 7'],
    lock: ['M6 11h12v10H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
    unlock: ['M6 11h12v10H6z', 'M8.5 11V8a3.5 3.5 0 0 1 6.8-1.2'],
    eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', circle(12, 12, 3)],
    back: ['M15 5l-7 7 7 7'],
    // The rotate handle on the stage (Plan.md F1): a turning arrow.
    rotate: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 3.5v4h-4'],
    undo: ['M9 14L4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-3'],
    redo: ['M15 14l5-5-5-5', 'M20 9H9a5 5 0 0 0 0 10h3'],
    external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
    close: ['M6 6l12 12', 'M18 6L6 18'],
    check: ['M5 12l5 5L20 7'],
    // Block types (Plan.md, Nächste Schritte 11)
    text: ['M5 7V5h14v2', 'M12 5v14', 'M9 19h6'],
    image: ['M4 5h16v14H4z', circle(9, 10, 1.5), 'M4 17l5-5 4 4 3-3 4 4'],
    shape: ['M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z'],
    clock: [circle(12, 12, 8), 'M12 8v4l3 2'],
    list: ['M9 7h11', 'M9 12h11', 'M9 17h11', 'M4.5 7h.5', 'M4.5 12h.5', 'M4.5 17h.5'],
    calendar: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
    header: ['M3 5h18v5H3z', 'M3 14h11', 'M3 18h7'],
    web: [circle(12, 12, 8.5), 'M3.5 12h17', 'M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5S9.4 5.9 12 3.5z'],
    qr: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h2v2h-2z', 'M18 18h2v2h-2z', 'M14 18h2', 'M18 14h2'],
    // Countdown and banner (Plan.md, Nächste Schritte 32)
    timer: [circle(12, 13.5, 7.5), 'M12 13.5V10', 'M10 2.5h4', 'M18.5 6.5l1.2-1.2'],
    banner: ['M3 14h18v5H3z', 'M6 16.5h8', 'M3 5h18', 'M3 9h12'],
    // "Hinweise" (Plan.md, Nächste Schritte 34): a megaphone with sound waves.
    megaphone: ['M3 10v4h3l7 4V6l-7 4H3z', 'M6 14v3a1 1 0 0 0 1 1h1v-4', 'M15 9.5a3 3 0 0 1 0 5', 'M18 7a6.5 6.5 0 0 1 0 10'],
    // "Über & Neuigkeiten"
    info: [circle(12, 12, 8.5), 'M12 11v5', 'M12 7.8v.2'],
    // The handle of a sortable row (Plan.md 79, D7): two columns of three dots.
    grip: [circle(9, 6, 1), circle(15, 6, 1), circle(9, 12, 1), circle(15, 12, 1), circle(9, 18, 1), circle(15, 18, 1)],
    // Posts (Plan.md, Nächste Schritte 33): a page with a picture and lines of text.
    // Two people, for the groups block (Plan.md 43).
    people: [circle(9, 8, 3), 'M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6', 'M16 5a3 3 0 0 1 0 6', 'M18 14.5c1.8.8 3 2.9 3 5.5'],
    news: ['M4 4h16v16H4z', 'M7 7h6v5H7z', 'M15 8h2', 'M15 11h2', 'M7 14.5h11', 'M7 17h8'],
    // Galerie (slideshow) (Plan.md 46): two offset picture frames.
    slideshow: ['M8 4h13v10H8z', 'M4 8v12h13v-2', 'M8 12l4-4 3 3 2-2 4 4'],
    // Linie (Plan.md F1): a stroke with a dot at each end.
    line: ['M5 12h14', circle(4, 12, 1.5), circle(20, 12, 1.5)],
    // Social Media (Plan.md 80): three nodes joined by two lines.
    share: [circle(6, 12, 2.5), circle(17, 6, 2.5), circle(17, 18, 2.5), 'M8.2 10.8l6.6-3.6', 'M8.2 13.2l6.6 3.6'],
    // Video (Plan.md 52): a frame with a play triangle.
    video: ['M3 5h18v14H3z', 'M10 9v6l5-3z'],
    // Raumbelegung (Plan.md 46): a door with a handle.
    door: ['M6 21V4h12v17', 'M4 21h16', circle(14.5, 12.5, 0.8)],
    // The design page (Plan.md, Nächste Schritte 27)
    palette: ['M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.6 0-.9.7-1.6 1.7-1.6h2.2a3.8 3.8 0 0 0 3.8-3.8c0-4.2-3.8-7.3-8.5-7.3z', circle(7.5, 11.5, 1), circle(10, 7.5, 1), circle(14.5, 7.5, 1)],
    // The page menu on a phone (Plan.md 44, M1): rotates 180° when open.
    'chevron-down': ['M6 9l6 6 6-6'],
    // Stacking order in the inspector (Plan.md 47): an arrow, to a line for "all the way".
    'layer-front': ['M12 19V8', 'M7 13l5-5 5 5', 'M5 4h14'],
    'layer-forward': ['M12 19V6', 'M7 11l5-5 5 5'],
    'layer-backward': ['M12 5v13', 'M7 13l5 5 5-5'],
    'layer-back': ['M12 5v11', 'M7 12l5 5 5-5', 'M5 20h14'],
    // Text alignment and vertical position in a box (Plan.md 79, B2): lines of text, or a block against a line.
    'align-left': ['M4 6h16', 'M4 10h10', 'M4 14h16', 'M4 18h10'],
    'align-center': ['M4 6h16', 'M7 10h10', 'M4 14h16', 'M7 18h10'],
    'align-right': ['M4 6h16', 'M10 10h10', 'M4 14h16', 'M10 18h10'],
    'valign-top': ['M4 4h16', 'M8 8h8v8H8z'],
    'valign-middle': ['M4 12h16', 'M9 6h6v12H9z'],
    'valign-bottom': ['M4 20h16', 'M8 8h8v8H8z'],
    // Aligning several blocks (Plan.md 79, D4): a reference line and two bars of different length.
    'arrange-left': ['M4 4v16', 'M8 7h12v4H8z', 'M8 14h7v4H8z'],
    'arrange-center': ['M12 3v18', 'M5 7h14v4H5z', 'M8 14h8v4H8z'],
    'arrange-right': ['M20 4v16', 'M4 7h12v4H4z', 'M9 14h7v4H9z'],
    'arrange-top': ['M4 4h16', 'M7 8v12h4V8z', 'M14 8v7h4V8z'],
    'arrange-middle': ['M3 12h18', 'M7 5v14h4V5z', 'M14 8v8h4V8z'],
    'arrange-bottom': ['M4 20h16', 'M7 4v12h4V4z', 'M14 9v7h4V9z'],
    // Distributing: the outer two stay (the lines), the one between sits at equal distance to both.
    'distribute-x': ['M4 4v16', 'M20 4v16', 'M9.5 8h5v8h-5z'],
    'distribute-y': ['M4 4h16', 'M4 20h16', 'M8 9.5h8v5H8z'],
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
