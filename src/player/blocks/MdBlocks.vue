<script setup lang="ts">
/** ChurchTools Markdown (src/ct/markdown.ts) as blocks – lists, quote, table, paragraphs – never as HTML. */
import { computed } from 'vue';
import { markdownBlocks } from '../../ct/markdown';
import MdInlines from './MdInlines.vue';

const props = defineProps<{ text: string }>();
const blocks = computed(() => markdownBlocks(props.text));
</script>

<template>
    <div class="md-blocks">
        <template v-for="(mdBlock, i) in blocks" :key="i">
            <ul v-if="mdBlock.kind === 'list' && !mdBlock.ordered" class="md-list">
                <li v-for="(item, j) in mdBlock.items" :key="j"><MdInlines :parts="item" /></li>
            </ul>
            <ol v-else-if="mdBlock.kind === 'list'" class="md-list" :start="mdBlock.start">
                <li v-for="(item, j) in mdBlock.items" :key="j"><MdInlines :parts="item" /></li>
            </ol>
            <table v-else-if="mdBlock.kind === 'table'" class="md-table">
                <thead>
                    <tr>
                        <th v-for="(cell, j) in mdBlock.head" :key="j" :style="{ textAlign: mdBlock.align[j] ?? undefined }"><MdInlines :parts="cell" /></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(row, k) in mdBlock.rows" :key="k">
                        <td v-for="(cell, j) in row" :key="j" :style="{ textAlign: mdBlock.align[j] ?? undefined }"><MdInlines :parts="cell" /></td>
                    </tr>
                </tbody>
            </table>
            <blockquote v-else-if="mdBlock.kind === 'quote'" class="paragraph md-quote">
                <MdInlines :parts="mdBlock.inlines" />
            </blockquote>
            <div v-else :class="['paragraph', { 'md-heading': mdBlock.kind === 'heading' }]">
                <MdInlines :parts="mdBlock.inlines" />
            </div>
        </template>
    </div>
</template>

<style scoped>
.paragraph {
    margin: 0 0 0.8em;
    white-space: pre-line;
}
.md-blocks > :last-child {
    margin-bottom: 0;
}
.md-heading {
    font-size: 1.15em;
    font-weight: 700;
}
.md-list {
    margin: 0 0 0.8em;
    padding-left: 1.4em;
    white-space: pre-line;
}
.md-quote {
    margin-left: 0;
    padding-left: 0.8em;
    border-left: 0.2em solid color-mix(in srgb, currentColor 40%, transparent);
    opacity: 0.85;
}
/* A table shares the width of the card and wraps its text; no scrolling on a screen. */
.md-table {
    width: 100%;
    margin: 0 0 0.8em;
    table-layout: fixed;
    border-collapse: collapse;
}
.md-table th,
.md-table td {
    padding: 0.25em 0.5em;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    overflow-wrap: anywhere;
    text-align: left;
    vertical-align: top;
}
.md-table th {
    font-weight: 700;
}
</style>
