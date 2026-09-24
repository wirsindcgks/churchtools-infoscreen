<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fetchCurrentPerson, NotAuthenticatedError } from '../ct/client';
import type { Person } from '../ct/types';
import type { ScreenDoc } from '../model/schema';
import { getRepository } from '../store/backend';

const person = ref<Person | null>(null);
const screens = ref<ScreenDoc[]>([]);
const demo = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
    try {
        person.value = await fetchCurrentPerson();
        const handle = await getRepository();
        demo.value = handle.demo;
        screens.value = await handle.repository.listScreens();
    } catch (e) {
        error.value =
            e instanceof NotAuthenticatedError
                ? e.message
                : `ChurchTools ist gerade nicht erreichbar${e instanceof Error ? ` (${e.message})` : ''}.`;
    }
});
</script>

<template>
    <main class="designer-home">
        <p v-if="error" role="alert">{{ error }}</p>
        <template v-else-if="person">
            <h1 data-testid="greeting">Hallo {{ person.firstName }}</h1>
            <p v-if="demo" class="notice" data-testid="demo-notice">
                Custom Modules sind auf dieser Instanz nicht freigeschaltet. Angezeigt wird ein Demo-Screen aus dem
                Arbeitsspeicher; seine Termine kommen live aus ChurchTools.
            </p>
            <h2>Screens</h2>
            <ul v-if="screens.length" class="screens">
                <li v-for="screen in screens" :key="screen.id">
                    <strong>{{ screen.name }}</strong>
                    <code>{{ screen.slug }}</code>
                    <span>{{ screen.stage.width }}×{{ screen.stage.height }}</span>
                    <RouterLink :to="{ name: 'player', query: { screen: screen.slug } }" data-testid="open-player">
                        Player öffnen
                    </RouterLink>
                </li>
            </ul>
            <p v-else>Noch keine Screens angelegt.</p>
        </template>
        <p v-else>Lade …</p>
    </main>
</template>

<style scoped>
.designer-home {
    max-width: 960px;
    margin: 0 auto;
    padding: 24px 16px;
    font-family: system-ui, sans-serif;
}
.notice {
    padding: 12px 16px;
    border-left: 4px solid #d97706;
    background: rgba(217, 119, 6, 0.08);
}
.screens {
    list-style: none;
    padding: 0;
}
.screens li {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: baseline;
    padding: 8px 0;
    border-bottom: 1px solid rgba(128, 128, 128, 0.3);
}
</style>
