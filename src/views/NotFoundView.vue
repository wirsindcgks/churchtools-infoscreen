<script setup lang="ts">
import { t } from '../i18n/designer';
</script>

<template>
    <main class="not-found">
        <p role="alert">{{ t.notFound.text }}</p>
        <RouterLink to="/">{{ t.notFound.back }}</RouterLink>
    </main>
</template>
