<script setup lang="ts">
/** The first facts of a notice's tile: how the band runs and until when – the same on a running and an expired notice. */
import Icon from './Icon.vue';

defineProps<{ mode: string; end: string }>();
</script>

<template>
    <section class="d-tile-section">
        <ul class="d-facts">
            <li>
                <Icon name="banner" :size="16" />
                <span>{{ mode }}</span>
            </li>
            <li>
                <Icon name="timer" :size="16" />
                <span>{{ end }}</span>
            </li>
        </ul>
    </section>
</template>
