<script setup lang="ts">
/** A turning ring with a line beside it, for work that takes a while and must not be left half done (the rights of the setup). */
defineProps<{ text: string }>();
</script>

<template>
    <p class="busy-note" role="status" aria-live="polite">
        <span class="ring" aria-hidden="true" />
        <span>{{ text }}</span>
    </p>
</template>

<style scoped>
.busy-note {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    color: var(--d-text-muted);
}
.ring {
    flex: none;
    width: 18px;
    height: 18px;
    border: 2px solid var(--d-divider);
    border-top-color: var(--d-accent);
    border-radius: 50%;
    animation: busy-turn 0.8s linear infinite;
}
@keyframes busy-turn {
    to {
        transform: rotate(360deg);
    }
}
@media (prefers-reduced-motion: reduce) {
    .ring {
        animation-duration: 2.4s;
    }
}
</style>
