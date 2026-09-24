<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fetchCurrentPerson, NotAuthenticatedError } from '../ct/client';
import type { Person } from '../ct/types';

const person = ref<Person | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
    try {
        person.value = await fetchCurrentPerson();
    } catch (e) {
        error.value =
            e instanceof NotAuthenticatedError ? e.message : 'ChurchTools ist gerade nicht erreichbar.';
    }
});
</script>

<template>
    <main class="designer-home">
        <h1 v-if="person" data-testid="greeting">Hallo {{ person.firstName }}</h1>
        <p v-else-if="error" role="alert">{{ error }}</p>
        <p v-else>Lade …</p>
    </main>
</template>
