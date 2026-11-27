<script setup lang="ts">
/**
 * The buttons in the fixed zone below the middle of the phone page (Plan.md 135 C, 137 C): "Zurück" as an arrow alone (1 part) and "Vor", the
 * main button, big and light (3 parts), with "Als Nächstes: …" in small letters below. The parts of the page put it into the zone by `Teleport`.
 */
import { t } from '../i18n/designer';

defineProps<{
    backDisabled: boolean;
    forwardDisabled: boolean;
    /** What "Vor" leads to: "Strophe 2", the name of the slide. */
    hint?: string;
}>();
const emit = defineEmits<{ back: []; forward: [] }>();
</script>

<template>
    <nav class="steps">
        <!-- The word, not an arrow: "‹" at the top already means "leave the page" (user, 2026-11-27). -->
        <button type="button" class="step-back" :disabled="backDisabled" data-testid="step-back" @click="emit('back')">{{ t.control.back }}</button>
        <button type="button" class="step-forward" :disabled="forwardDisabled" data-testid="step-forward" @click="emit('forward')">
            <span>{{ t.control.forward }}</span>
            <small v-if="hint" data-testid="step-hint">{{ t.control.nextHint(hint) }}</small>
        </button>
    </nav>
</template>

<style scoped>
.steps {
    display: grid;
    grid-template-columns: 1fr 3fr;
    gap: 10px;
}
/* Back and forward are what a hand on stage reaches for blind: tall, flat, "Vor" in big letters (user, 2026-11-11; Plan.md 137 C). */
button {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 2px;
    min-width: 0;
    height: 72px; /* 88 px left the eighth part of a song outside on a small phone (user, 2026-11-27: the parts matter more). */
    padding: 4px 8px;
    border: 0;
    border-radius: 18px;
    background: #1b1e25;
    color: #f1f2f4;
    font: inherit;
    cursor: pointer;
}
.step-back {
    font-size: 17px;
    font-weight: 600;
}
/* "Vor" is the main button: light with dark letters, and it names what follows. Bold, but not heavier than 600 (Plan.md 79). */
.step-forward {
    background: #f1f2f4;
    color: #111318;
    font-size: 28px;
    font-weight: 600;
}
.step-forward small {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 400;
    color: #3a3f4a;
}
/* Greyed out is grey, also for "Vor": no light face that looks half active (user, 2026-11-27). */
button:disabled {
    background: #1b1e25;
    color: #7d828c;
    cursor: default;
}
button:disabled small {
    color: inherit;
}
</style>
