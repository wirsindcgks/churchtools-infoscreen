<script setup lang="ts">
/**
 * The bar of the editor below the ChurchTools navigation: the way back on the left, the title and the state of the
 * save in the middle (slot `title`), the actions on the right. It lies calm on the workspace, without a surface of its own
 * (Plan.md 79, B3). Above 48rem the title stands in the middle of the window – left and right take equal room, unless
 * the actions are so wide that the title has to move aside; below it, there is no room for a middle, and the title
 * follows the way back. The overview pages have no bar – their sidebar carries the sections and their page head the actions.
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
        /* Equal sides, but never narrower than their content; the middle gives way first. */
        grid-template-columns: minmax(auto, 1fr) minmax(0, auto) minmax(auto, 1fr);
        column-gap: var(--d-space-4);
    }
    .middle {
        justify-content: center;
    }
    /* An automatic minimum, not 0: the sides keep the room of their content, so nothing overlaps. */
    .start,
    .end {
        min-width: auto;
    }
}
@media (max-width: 48rem) {
    .d-appbar {
        min-height: 56px;
        padding-block: var(--d-space-1);
    }
}
</style>
