<script setup lang="ts">
/**
 * The buttons in the fixed zone below the middle of the phone page (Plan.md 135 C): "Zurück" and "Vor", the main button, with what comes
 * next in small letters below; with a presentation "Schwarz" as well. The parts of the page put it into the zone by `Teleport`.
 */
import { t } from '../i18n/designer';

defineProps<{
    backDisabled: boolean;
    forwardDisabled: boolean;
    /** What "Vor" leads to: "Strophe 2", the name of the slide. */
    hint?: string;
    /** With a presentation: whether the stage is black; without it there is no button. */
    black?: boolean;
    blackDisabled?: boolean;
}>();
const emit = defineEmits<{ back: []; forward: []; black: [] }>();
</script>

<template>
    <nav class="steps" :class="{ withBlack: black !== undefined }">
        <button type="button" class="step-back" :disabled="backDisabled" data-testid="step-back" @click="emit('back')">{{ t.control.back }}</button>
        <button type="button" class="step-forward" :disabled="forwardDisabled" data-testid="step-forward" @click="emit('forward')">
            <span>{{ t.control.forward }}</span>
            <small v-if="hint" data-testid="step-hint">{{ hint }}</small>
        </button>
        <button v-if="black !== undefined" type="button" class="step-black" :class="{ on: black }" :disabled="blackDisabled" :aria-pressed="black" data-testid="step-black" @click="emit('black')">
            {{ black ? t.control.clickBlackOff : t.control.clickBlack }}
        </button>
    </nav>
</template>

<style scoped>
.steps {
    display: grid;
    grid-template-columns: 1fr 1.4fr;
    gap: 8px;
}
.steps.withBlack {
    grid-template-columns: 1fr 1.4fr 0.8fr;
}
/* Back and forward are what a hand on stage reaches for blind: tall and in big letters (user, 2026-11-11). */
button {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 2px;
    min-width: 0;
    min-height: 80px;
    padding: 4px 8px;
    border: 1px solid #3a3f4a;
    border-radius: 8px;
    background: #1d2027;
    color: inherit;
    font: inherit;
    font-size: 1.5rem;
    font-weight: 600;
    cursor: pointer;
}
/* "Vor" is the main button: the accent colour, and it names what follows. */
.step-forward {
    background: #2f6fed;
    border-color: #6ea8ff;
}
.step-forward small {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8rem;
    font-weight: 400;
    opacity: 0.85;
}
.step-black {
    font-size: 1.1rem;
}
.step-black.on {
    background: #f2f2f2;
    border-color: #f2f2f2;
    color: #101114;
}
button:disabled {
    opacity: 0.4;
}
</style>
