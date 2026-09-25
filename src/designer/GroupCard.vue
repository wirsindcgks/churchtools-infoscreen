<script setup lang="ts">
/**
 * The card that holds a page's items, after the group lists of ChurchTools:
 * round symbol, heading with the count below, tools such as filter chips on
 * the right – the same on every page of the module.
 */
import Icon, { type IconName } from './Icon.vue';

defineProps<{ icon: IconName; title: string; count: string; headingId: string }>();
</script>

<template>
    <section class="d-card group" :aria-labelledby="headingId">
        <header>
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
.group {
    padding: 16px 20px 20px;
}
header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 14px;
    margin-bottom: 16px;
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
    gap: 6px;
    margin-left: auto;
}
@media (max-width: 48rem) {
    .group {
        padding: 12px;
    }
}
</style>
