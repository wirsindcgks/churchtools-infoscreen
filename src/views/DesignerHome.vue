<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { currentPerson, displayName, NotAuthenticatedError } from '../ct/client';
import type { Person } from '../ct/types';
import { createScreenBundle, slugify } from '../designer/ops';
import { Slug, type ScreenDoc } from '../model/schema';
import { getRepository } from '../store/backend';
import type { ScreenRepository } from '../store/screen-repository';
import * as v from 'valibot';

const router = useRouter();
const person = ref<Person | null>(null);
const screens = ref<ScreenDoc[]>([]);
const demo = ref(false);
const error = ref<string | null>(null);
let repository: ScreenRepository | null = null;

const name = ref('');
const slug = ref('');
const slugTouched = ref(false);
const orientation = ref<'landscape' | 'portrait'>('landscape');
const createError = ref<string | null>(null);

watch(name, (value) => {
    if (!slugTouched.value) slug.value = slugify(value);
});
const slugValid = computed(() => v.is(Slug, slug.value));
const canCreate = computed(() => name.value.trim() !== '' && slugValid.value);

async function refresh(): Promise<void> {
    if (repository) screens.value = await repository.listScreens();
}

onMounted(async () => {
    try {
        // Show the page only when both are there: a form without storage would swallow clicks.
        const [signedIn, handle] = await Promise.all([currentPerson(), getRepository()]);
        repository = handle.repository;
        demo.value = handle.demo;
        await refresh();
        person.value = signedIn;
    } catch (e) {
        error.value =
            e instanceof NotAuthenticatedError
                ? e.message
                : `ChurchTools ist gerade nicht erreichbar${e instanceof Error ? ` (${e.message})` : ''}.`;
    }
});

async function create(): Promise<void> {
    if (!repository || !person.value || !canCreate.value) return;
    createError.value = null;
    try {
        const bundle = createScreenBundle({ name: name.value.trim(), slug: slug.value, orientation: orientation.value });
        await repository.saveScreen(bundle, { expectedRevision: null, updatedBy: displayName(person.value) });
        await router.push({ name: 'editor', params: { slug: slug.value } });
    } catch (e) {
        createError.value = e instanceof Error ? e.message : String(e);
    }
}

async function remove(screen: ScreenDoc): Promise<void> {
    const question =
        `Screen „${screen.name}" löschen?\n\n` +
        `Ein Gerät, das die Adresse „${screen.slug}" aufruft, zeigt danach eine Fehlermeldung.`;
    if (!repository || !window.confirm(question)) return;
    await repository.deleteScreen(screen.slug);
    await refresh();
}
</script>

<template>
    <main class="infoscreen-designer home">
        <p v-if="error" role="alert">{{ error }}</p>
        <template v-else-if="person">
            <h1 data-testid="greeting">Hallo {{ person.firstName }}</h1>
            <p v-if="demo" class="notice" data-testid="demo-notice">
                Custom Modules sind auf dieser Instanz nicht freigeschaltet. Angezeigt wird ein Demo-Screen aus dem
                Arbeitsspeicher; seine Termine kommen live aus ChurchTools. Änderungen gehen beim Neuladen verloren.
            </p>

            <h2>Screens</h2>
            <ul v-if="screens.length" class="screens">
                <li v-for="screen in screens" :key="screen.id">
                    <div>
                        <strong>{{ screen.name }}</strong>
                        <span class="muted">
                            <code>{{ screen.slug }}</code> · {{ screen.stage.width }}×{{ screen.stage.height }}
                            <template v-if="screen.updatedBy"> · zuletzt {{ screen.updatedBy }}</template>
                        </span>
                    </div>
                    <div class="actions">
                        <RouterLink
                            class="d-link"
                            :to="{ name: 'editor', params: { slug: screen.slug } }"
                            data-testid="open-editor"
                        >
                            Bearbeiten
                        </RouterLink>
                        <RouterLink
                            class="d-link"
                            :to="{ name: 'player', query: { screen: screen.slug } }"
                            data-testid="open-player"
                        >
                            Player
                        </RouterLink>
                        <button class="d-btn d-btn--danger" type="button" @click="remove(screen)">Löschen</button>
                    </div>
                </li>
            </ul>
            <p v-else class="muted">Noch keine Screens angelegt.</p>

            <h2>Neuer Screen</h2>
            <form class="create" @submit.prevent="create">
                <label class="d-field">
                    Name
                    <input v-model="name" type="text" maxlength="100" placeholder="Foyer links" data-testid="new-name">
                </label>
                <label class="d-field">
                    Adresse für das Gerät
                    <input
                        v-model="slug"
                        type="text"
                        maxlength="64"
                        placeholder="foyer-links"
                        data-testid="new-slug"
                        @input="slugTouched = true"
                    >
                    <small v-if="slug && !slugValid" class="invalid">Nur Kleinbuchstaben, Ziffern und Bindestriche.</small>
                    <small v-else class="muted">Steht später in der Adresse des Fernsehers und bleibt fest.</small>
                </label>
                <label class="d-field">
                    Ausrichtung
                    <select v-model="orientation">
                        <option value="landscape">Quer (1920 × 1080)</option>
                        <option value="portrait">Hochkant (1080 × 1920)</option>
                    </select>
                </label>
                <div>
                    <button class="d-btn d-btn--primary" type="submit" :disabled="!canCreate" data-testid="create">
                        Anlegen
                    </button>
                </div>
                <p v-if="createError" class="invalid" role="alert">{{ createError }}</p>
            </form>
        </template>
        <p v-else>Lade …</p>
    </main>
</template>

<style scoped>
.home {
    max-width: 960px;
    margin: 0 auto;
    padding: 24px 16px 48px;
}
h1 {
    margin-top: 0;
}
h2 {
    margin-top: 28px;
    font-size: 1.15em;
}
.notice {
    padding: 10px 14px;
    border-left: 4px solid var(--d-accent);
    border-radius: var(--d-radius);
    background: var(--d-accent-pale);
}
.screens {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius-lg);
}
.screens li {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
}
.screens li + li {
    border-top: 1px solid var(--d-divider);
}
.screens strong {
    margin-right: 8px;
}
.actions {
    display: flex;
    align-items: center;
    gap: 14px;
}
.muted {
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.d-link {
    color: var(--d-accent-strong);
}
.create {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    align-items: end;
    padding: 14px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius-lg);
    background: var(--d-panel);
}
.invalid {
    color: var(--d-danger);
}
</style>
