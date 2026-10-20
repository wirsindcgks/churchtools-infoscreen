<script setup lang="ts">
/**
 * The bar of the editor below the ChurchTools navigation: the way back on the left, the title and the state of the
 * save in the middle (slot `title`), the actions on the right. It lies calm on the workspace, without a surface of its own
 * (Plan.md 79, B3). Above 48rem the title starts where the stage does, flush with "+ Baustein" – the editor hands down
 * the width of its slide column as `--slides-w` – unless the way back is wider and pushes it aside; below it, the title
 * takes a row of its own under the way back and the actions, so it stays readable (user, 2026-10-17). The overview
 * pages have no bar – their sidebar carries the sections and their page head the actions.
 */
</script>

<template>
    <header class="d-appbar">
        <div class="start"><slot /></div>
        <div class="middle"><slot name="title" /></div>
        <div class="end"><slot name="actions" /></div>
    </header>
</template>

<style scoped>
.d-appbar {
    display: flex;
    align-items: center;
    gap: var(--d-space-2);
    min-height: 64px;
    /* The same side margin as the columns below: back and save stand flush with the cards (`--d-gutter`, theme.css). */
    padding: var(--d-space-2) var(--d-gutter);
}
.start,
.middle,
.end {
    display: flex;
    align-items: center;
    gap: var(--d-space-2);
    min-width: 0;
}
.start {
    flex: none;
}
.middle {
    flex: 1;
    overflow: hidden;
}
.end {
    flex-wrap: nowrap;
    justify-content: flex-end;
}
@media (min-width: 48.0625rem) {
    .d-appbar {
        display: grid;
        /*
         * The columns of the editor below: the way back over the slides, the title over the stage, with the same gap.
         * Never narrower than its content, so a wide way back pushes the title aside; the title gives way first.
         */
        grid-template-columns: minmax(auto, var(--slides-w, auto)) minmax(0, 1fr) auto;
        column-gap: var(--d-space-3);
    }
    /* The padding of the bar with "+ Baustein" (BlockPalette.vue). */
    .middle {
        padding-left: var(--d-space-2);
    }
    /*
     * The sides keep the room of their content, so nothing overlaps. `auto` is not enough: a grid track with a fixed maximum
     * (53 px with the slides folded) ignores the automatic minimum, and the way back reached into the title (user, 2026-10-20).
     */
    .start,
    .end {
        min-width: max-content;
    }
}
@media (max-width: 48rem) {
    .d-appbar {
        flex-wrap: wrap;
        min-height: 56px;
        padding-block: var(--d-space-1);
    }
    /* The title in a row of its own below the way back and the actions. */
    .middle {
        order: 1;
        flex-basis: 100%;
    }
    .end {
        margin-left: auto;
    }
}
</style>
