<script setup lang="ts">
import * as v from 'valibot';
import { computed, onMounted, ref, watch } from 'vue';
import { t } from '../i18n/designer';
import { Slug } from '../model/schema';
import type { ScreenRepository } from '../store/screen-repository';
import Icon from './Icon.vue';
import { createScreenBundle, slugify } from './ops';

const props = defineProps<{ repository: ScreenRepository; author: string }>();
const emit = defineEmits<{ close: []; created: [playlistId: string] }>();

const name = ref('');
const slug = ref('');
const slugTouched = ref(false);
const orientation = ref<'landscape' | 'portrait'>('landscape');
const error = ref<string | null>(null);
const busy = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);

watch(name, (value) => {
    if (!slugTouched.value) slug.value = slugify(value);
});
const slugValid = computed(() => v.is(Slug, slug.value));
const canCreate = computed(() => name.value.trim() !== '' && slugValid.value && !busy.value);

const ORIENTATIONS = [
    { value: 'landscape', icon: 'landscape', label: t.common.landscape, size: '1920 × 1080' },
    { value: 'portrait', icon: 'portrait', label: t.common.portrait, size: '1080 × 1920' },
] as const;

onMounted(() => nameInput.value?.focus());

async function create(): Promise<void> {
    if (!canCreate.value) return;
    error.value = null;
    busy.value = true;
    try {
        const bundle = createScreenBundle({ name: name.value.trim(), slug: slug.value, orientation: orientation.value });
        await props.repository.saveScreen(bundle, { expectedRevision: null, updatedBy: props.author });
        emit('created', bundle.screen.defaultPlaylistId);
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <div class="d-dialog-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
        <form
            class="d-dialog create"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-title"
            data-testid="create-dialog"
            @submit.prevent="create"
        >
            <h2 id="create-title">{{ t.home.create.title }}</h2>
            <label class="d-field">
                {{ t.common.name }}
                <input
                    ref="nameInput"
                    v-model="name"
                    type="text"
                    maxlength="100"
                    :placeholder="t.home.create.namePlaceholder"
                    data-testid="new-name"
                >
                <small>{{ t.home.create.nameHint }}</small>
            </label>
            <label class="d-field">
                {{ t.home.create.address }}
                <input
                    v-model="slug"
                    type="text"
                    maxlength="64"
                    :placeholder="t.home.create.addressPlaceholder"
                    autocapitalize="off"
                    autocorrect="off"
                    spellcheck="false"
                    data-testid="new-slug"
                    @input="slugTouched = true"
                >
                <small v-if="slug && !slugValid" class="invalid">{{ t.home.create.addressInvalid }}</small>
                <small v-else>{{ t.home.create.addressHint }}</small>
            </label>
            <fieldset class="orientation">
                <legend>{{ t.common.format }}</legend>
                <label v-for="o in ORIENTATIONS" :key="o.value" class="d-choice">
                    <input v-model="orientation" type="radio" name="orientation" :value="o.value" :data-testid="`new-${o.value}`">
                    <Icon :name="o.icon" :size="28" />
                    <span class="d-choice-text">
                        <strong>{{ o.label }}</strong>
                        <small>{{ o.size }}</small>
                    </span>
                </label>
                <small>{{ t.home.create.formatHint }}</small>
            </fieldset>
            <p v-if="error" class="invalid" role="alert">{{ error }}</p>
            <div class="d-dialog-actions">
                <button class="d-btn" type="button" @click="emit('close')">{{ t.common.cancel }}</button>
                <button class="d-btn d-btn--create" type="submit" :disabled="!canCreate" data-testid="create">
                    {{ t.common.create }}
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped src="./create-dialog.css"></style>
