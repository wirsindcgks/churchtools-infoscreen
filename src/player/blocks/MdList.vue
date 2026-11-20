<script setup lang="ts">
/** A Markdown list (src/ct/markdown.ts); a list nested in an item is indented under it (Plan.md, Punkt 131). */
import type { MdList } from '../../ct/markdown';
import MdInlines from './MdInlines.vue';

withDefaults(defineProps<{ list: MdList; depth?: number }>(), { depth: 0 });
</script>

<template>
    <component :is="list.ordered ? 'ol' : 'ul'" :class="['md-list', { 'md-list--nested': depth > 0 }]" :start="list.ordered ? list.start : undefined" :data-depth="depth">
        <li v-for="(item, j) in list.items" :key="j">
            <MdInlines :parts="item.inlines" />
            <MdList v-for="(sub, k) in item.lists ?? []" :key="k" :list="sub" :depth="depth + 1" />
        </li>
    </component>
</template>

<style scoped>
.md-list {
    margin: 0 0 0.8em;
    padding-left: 1.4em;
    white-space: pre-line;
}
.md-list--nested {
    margin: 0;
}
/* Set the markers outright: the ChurchTools page around the player resets lists to `list-style: none` (Plan.md 130). */
ul.md-list {
    list-style: disc outside;
}
ul.md-list[data-depth='1'] {
    list-style-type: circle;
}
ul.md-list--nested:not([data-depth='1']) {
    list-style-type: square;
}
ol.md-list {
    list-style: decimal outside;
}
</style>
