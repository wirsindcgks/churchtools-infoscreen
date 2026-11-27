<script setup lang="ts">
/**
 * The "Jetzt" row of the phone page (Plan.md 137 B): what the screen shows right now – the running part of a song or the running slide –
 * and where it stands in the whole ("3 von 5"). One slim row between the heading and the tiles or the list.
 */
import { t } from '../i18n/designer';

defineProps<{ title: string; number: number; total: number }>();
</script>

<template>
    <section class="now" :aria-label="t.control.nowAria" data-testid="control-now">
        <span class="label">{{ t.control.nowLabel }}</span>
        <span class="title" data-testid="control-now-title">{{ title }}</span>
        <span class="of" data-testid="control-now-of">{{ t.control.nowOf(number, total) }}</span>
    </section>
</template>

<style scoped>
.now {
    flex: none;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 0 16px;
    border-radius: 14px;
    background: #182649;
}
.label {
    flex: none;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #9db8ff;
}
/* Bold, but not `strong` and not heavier than 600 (Plan.md 79). */
.title {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 20px;
    font-weight: 600;
}
.of {
    flex: none;
    font-size: 14px;
    color: #a9bde8;
    font-variant-numeric: tabular-nums;
}
</style>
