<script setup lang="ts">
/**
 * The name of a template (Plan.md 87): asked when blocks are saved as a template and when a template is renamed.
 * It only asks – the caller saves, shows a failure in `error` and closes the dialog when it worked.
 */
import { computed, onMounted, ref } from 'vue';
import { t } from '../i18n/designer';
import { TEMPLATE_NAME_MAX } from './templates';

const props = defineProps<{ title: string; name?: string; error?: string | null; busy?: boolean }>();
const emit = defineEmits<{ close: []; save: [name: string] }>();

const name = ref(props.name ?? '');
const nameInput = ref<HTMLInputElement | null>(null);
const canSave = computed(() => name.value.trim() !== '' && !props.busy);

onMounted(() => {
    nameInput.value?.focus();
    nameInput.value?.select();
});

function save(): void {
    if (canSave.value) emit('save', name.value.trim());
}
</script>

<template>
    <div class="d-dialog-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
        <form
            class="d-dialog template-name"
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-name-title"
            data-testid="template-name-dialog"
            @submit.prevent="save"
        >
            <h2 id="template-name-title">{{ title }}</h2>
            <label class="d-field">
                {{ t.common.name }}
                <input
                    ref="nameInput"
                    v-model="name"
                    type="text"
                    :maxlength="TEMPLATE_NAME_MAX"
                    :placeholder="t.templates.namePlaceholder"
                    data-testid="template-name"
                >
            </label>
            <p v-if="error" class="invalid" role="alert" data-testid="template-name-error">{{ error }}</p>
            <div class="d-dialog-actions">
                <button class="d-btn" type="button" @click="emit('close')">{{ t.common.cancel }}</button>
                <button class="d-btn d-btn--primary" type="submit" :disabled="!canSave" data-testid="template-name-save">
                    {{ t.common.save }}
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped>
.template-name {
    display: grid;
    gap: 16px;
}
.template-name h2 {
    margin-bottom: 0;
}
.invalid {
    margin: 0;
    color: var(--d-danger);
}
</style>
