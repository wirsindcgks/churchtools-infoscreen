<script setup lang="ts">
/**
 * The group that holds a page's items, after the group lists of ChurchTools:
 * round symbol, heading with the count below, tools such as filter chips on
 * the right – the same on every page of the module. It stands directly on the
 * workspace; the tiles inside are the cards (Plan.md 79, B3). A heading shows only where the page holds
 * several groups: with `hideHeading` the header stays for screen readers alone.
 */
import Icon, { type IconName } from './Icon.vue';

defineProps<{ icon: IconName; title: string; count: string; headingId: string; hideHeading?: boolean }>();
</script>

<template>
    <section class="group" :aria-labelledby="headingId">
        <header :class="{ 'heading-hidden': hideHeading }">
            <span class="group-icon"><Icon :name="icon" /></span>
            <div>
                <h2 :id="headingId">{{ title }}</h2>
                <span class="count">{{ count }}</span>
            </div>
            <div v-if="$slots.tools" class="tools"><slot name="tools" /></div>
        </header>
        <slot />
    </section>
</template>

<style scoped>
header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--d-space-3);
    margin-bottom: var(--d-space-4);
}
.group-icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--d-accent-pale);
    color: var(--d-accent);
}
header.heading-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
}
h2 {
    margin: 0;
    font-size: 1.15em;
}
.count {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.tools {
    display: flex;
    flex-wrap: wrap;
    gap: var(--d-space-2);
    margin-left: auto;
}
</style>
