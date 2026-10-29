<script setup lang="ts">
/**
 * A new playlist (Plan.md, Nächste Schritte 19): a name and the format its
 * slides are designed for. It starts with one empty slide and runs nowhere
 * until a screen's schedule chooses it.
 */
import { computed, onMounted, ref } from 'vue';
import { t } from '../i18n/designer';
import { STAGE_PRESETS } from '../model/schema';
import type { ScreenRepository } from '../store/screen-repository';
import Icon from './Icon.vue';

const props = defineProps<{ repository: ScreenRepository; author: string }>();
const emit = defineEmits<{ close: []; created: [id: string] }>();

const name = ref('');
const orientation = ref<'landscape' | 'portrait'>('landscape');
const error = ref<string | null>(null);
const busy = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);
const canCreate = computed(() => name.value.trim() !== '' && !busy.value);

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
        const created = await props.repository.createPlaylist(
            { name: name.value, stage: STAGE_PRESETS[orientation.value] },
            props.author,
        );
        emit('created', created.id);
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
            aria-labelledby="create-playlist-title"
            data-testid="create-playlist-dialog"
            @submit.prevent="create"
        >
            <h2 id="create-playlist-title">{{ t.playlists.create.title }}</h2>
            <label class="d-field">
                {{ t.common.name }}
                <input
                    ref="nameInput"
                    v-model="name"
                    type="text"
                    maxlength="100"
                    :placeholder="t.playlists.create.namePlaceholder"
                    data-testid="new-playlist-name"
                >
                <small>{{ t.playlists.create.nameHint }}</small>
            </label>
            <fieldset class="orientation">
                <legend>{{ t.common.format }}</legend>
                <label v-for="o in ORIENTATIONS" :key="o.value" class="d-choice">
                    <input v-model="orientation" type="radio" name="orientation" :value="o.value" :data-testid="`new-playlist-${o.value}`">
                    <Icon :name="o.icon" :size="28" />
                    <span class="d-choice-text">
                        <strong>{{ o.label }}</strong>
                        <small>{{ o.size }}</small>
                    </span>
                </label>
                <small>{{ t.playlists.create.formatHint }}</small>
            </fieldset>
            <p v-if="error" class="invalid" role="alert">{{ error }}</p>
            <div class="d-dialog-actions">
                <button class="d-btn" type="button" @click="emit('close')">{{ t.common.cancel }}</button>
                <button class="d-btn d-btn--create" type="submit" :disabled="!canCreate" data-testid="create-playlist">
                    {{ t.common.create }}
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped src="./create-dialog.css"></style>
