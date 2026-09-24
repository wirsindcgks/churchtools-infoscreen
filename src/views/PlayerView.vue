<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const slug = computed(() => (typeof route.query.screen === 'string' ? route.query.screen : null));
</script>

<template>
    <main class="player">
        <p v-if="slug">Screen „{{ slug }}"</p>
        <p v-else role="alert">Kein Screen angegeben (Parameter „screen" fehlt).</p>
    </main>
</template>
