<script setup lang="ts">
/**
 * The administrators' part of a screen (Plan.md, F; Nächste Schritte 15):
 * name, overscan and interaction (Bedienung, Plan.md 127 B) – out of the editor, where designers shape content.
 * Saved against the revision of the screen document only, so it never
 * collides with a designer saving slides at the same time. `mode` `rename`: the name only,
 * from the tile's menu (Plan.md 71).
 */
import { computed, onMounted, ref } from 'vue';
import { t } from '../i18n/designer';
import { INTERACTION_WAIT_SECONDS, type ScreenDoc } from '../model/schema';
import InspectorSection from './InspectorSection.vue';
import ToggleField from './inspector/fields/ToggleField.vue';
import { ConflictError, type ScreenRepository } from '../store/screen-repository';

const props = withDefaults(defineProps<{ screen: ScreenDoc; repository: ScreenRepository; author: string; mode?: 'settings' | 'rename' }>(), {
    mode: 'settings',
});
const emit = defineEmits<{ close: []; saved: [] }>();

const name = ref(props.screen.name);
const overscan = ref(props.screen.overscanPercent);
const interactive = ref(props.screen.interactive ?? false);
const waitSeconds = ref<number | string>(props.screen.interactionWaitSeconds ?? INTERACTION_WAIT_SECONDS);
const arrows = ref<'always' | 'after-tap'>(props.screen.interactionArrows ?? 'always');
const error = ref<string | null>(null);
const busy = ref(false);
const nameInput = ref<HTMLInputElement | null>(null);

const portrait = computed(() => props.screen.stage.height > props.screen.stage.width);
/** The wait as a whole number of 5–300 seconds; empty or invalid falls back to the default. */
const wait = computed(() => {
    const n = Number(waitSeconds.value);
    return waitSeconds.value === '' || !Number.isFinite(n) ? INTERACTION_WAIT_SECONDS : Math.min(300, Math.max(5, Math.round(n)));
});
const interactionSummary = computed(() =>
    interactive.value ? t.home.settings.interactionOn(wait.value, arrows.value === 'always') : t.home.settings.interactionOff,
);
const canSave = computed(() => name.value.trim() !== '' && !busy.value);

onMounted(() => {
    nameInput.value?.focus();
    if (props.mode === 'rename') nameInput.value?.select();
});

async function save(): Promise<void> {
    if (!canSave.value) return;
    busy.value = true;
    error.value = null;
    try {
        await props.repository.saveScreenSettings(
            props.screen.id,
            {
                name: name.value.trim(),
                overscanPercent: Math.min(20, Math.max(0, Number(overscan.value) || 0)),
                ...(props.mode === 'settings' && { interactive: interactive.value, interactionWaitSeconds: wait.value, interactionArrows: arrows.value }),
            },
            { expectedRevision: props.screen.revision, updatedBy: props.author },
        );
        emit('saved');
    } catch (e) {
        error.value =
            e instanceof ConflictError
                ? t.home.settings.conflict(e.current.updatedBy)
                : e instanceof Error
                  ? e.message
                  : String(e);
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <div class="d-dialog-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
        <form
            class="d-dialog settings"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            :data-testid="mode === 'rename' ? 'screen-rename' : 'screen-settings'"
            @submit.prevent="save"
        >
            <h2 id="settings-title">{{ mode === 'rename' ? t.home.settings.renameTitle : t.home.settings.title }}</h2>
            <label class="d-field">
                {{ t.common.name }}
                <input ref="nameInput" v-model="name" type="text" maxlength="100" data-testid="settings-name">
                <small v-if="!name.trim()" class="invalid">{{ t.home.settings.nameRequired }}</small>
            </label>
            <label v-if="mode === 'settings'" class="d-field">
                {{ t.home.settings.overscan }}
                <input v-model.number="overscan" type="number" min="0" max="20" data-testid="settings-overscan">
                <small class="hint">{{ t.home.settings.overscanInfo }}</small>
            </label>
            <InspectorSection
                v-if="mode === 'settings'"
                id="screen-interaction"
                :title="t.home.settings.interaction"
                :summary="interactionSummary"
                :group="false"
            >
                <ToggleField v-model="interactive" :label="t.home.settings.interactive" testid="settings-interactive" />
                <small class="hint">{{ t.home.settings.interactiveInfo }}</small>
                <template v-if="interactive">
                    <label class="d-field">
                        {{ t.home.settings.wait }}
                        <input v-model="waitSeconds" type="number" min="5" max="300" data-testid="settings-wait">
                        <small class="hint">{{ t.home.settings.waitInfo }}</small>
                    </label>
                    <label class="d-field">
                        {{ t.home.settings.arrows }}
                        <select v-model="arrows" data-testid="settings-arrows">
                            <option value="always">{{ t.home.settings.arrowsAlways }}</option>
                            <option value="after-tap">{{ t.home.settings.arrowsAfterTap }}</option>
                        </select>
                        <small class="hint">{{ t.home.settings.arrowsInfo }}</small>
                    </label>
                </template>
            </InspectorSection>
            <dl v-if="mode === 'settings'">
                <dt>{{ t.common.format }}</dt>
                <dd>{{ portrait ? t.common.portrait : t.common.landscape }}, {{ screen.stage.width }} × {{ screen.stage.height }}</dd>
                <dt>{{ t.home.settings.address }}</dt>
                <dd><code>{{ screen.slug }}</code></dd>
            </dl>
            <p v-if="mode === 'settings'" class="muted">{{ t.home.settings.fixedHint }}</p>
            <p v-if="error" class="invalid" role="alert">{{ error }}</p>
            <div class="d-dialog-actions">
                <button class="d-btn" type="button" @click="emit('close')">{{ t.common.cancel }}</button>
                <button class="d-btn d-btn--primary" type="submit" :disabled="!canSave" data-testid="settings-save">
                    {{ t.common.save }}
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped>
.settings {
    display: grid;
    gap: 14px;
}
.settings h2 {
    margin-bottom: 0;
}
dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    margin: 0;
    font-size: var(--d-size-sm);
}
dt {
    color: var(--d-text-muted);
}
dd {
    margin: 0;
}
.hint,
.muted {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.invalid {
    margin: 0;
    color: var(--d-danger);
}
</style>
