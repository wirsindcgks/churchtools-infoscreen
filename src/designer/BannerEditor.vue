<script setup lang="ts">
/**
 * The band's own fields, as a plain form (Plan.md, Nächste Schritte 34): text,
 * running or standing, where, how fast, colours – and until when, so "Heute
 * Parkplatz gesperrt" goes away by itself. On/off and which playlists it
 * runs on are the job of "Hinweise", not this form.
 */
import { computed } from 'vue';
import { t } from '../i18n/designer';
import type { Banner } from '../model/schema';
import { wallTime } from '../player/banner';
import ColorField from './ColorField.vue';
import HintRow from './HintRow.vue';
import FontField from './inspector/fields/FontField.vue';

const props = withDefaults(defineProps<{ modelValue: Banner; timeZone: string; now?: Date }>(), {
    now: () => new Date(),
});
const emit = defineEmits<{ 'update:modelValue': [Banner] }>();

function update(patch: Partial<Banner>): void {
    emit('update:modelValue', { ...props.modelValue, ...patch });
}

const SPEEDS = [
    { value: 80, label: t.notices.banner.speeds.slow },
    { value: 140, label: t.notices.banner.speeds.medium },
    { value: 220, label: t.notices.banner.speeds.fast },
];
/** The speed choice nearest to what is stored. */
const speed = computed(() => {
    const current = props.modelValue.speed ?? 140;
    return SPEEDS.reduce((a, b) => (Math.abs(b.value - current) < Math.abs(a.value - current) ? b : a)).value;
});

/** Its time is up: the TVs no longer show it. */
const expired = computed(
    () => !!props.modelValue.until && wallTime(props.now, props.timeZone) >= props.modelValue.until.slice(0, 16),
);

function setNumber(key: 'height', value: string, min: number, max: number): void {
    const n = Number(value);
    if (Number.isFinite(n) && n >= min && n <= max) update({ [key]: Math.round(n) });
}

function setFontSize(value: string): void {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 8 && n <= 400) update({ style: { ...props.modelValue.style, fontSize: n } });
}
</script>

<template>
    <div class="banner-editor">
        <label class="d-field">
            {{ t.inspector.text }}
            <input
                type="text"
                maxlength="500"
                :value="modelValue.text"
                :placeholder="t.notices.banner.textPlaceholder"
                data-testid="banner-text"
                @input="update({ text: ($event.target as HTMLInputElement).value })"
            >
        </label>
        <div class="grid2">
            <label class="d-field">
                {{ t.notices.banner.kind }}
                <select
                    :value="modelValue.mode"
                    data-testid="banner-mode"
                    @change="update({ mode: ($event.target as HTMLSelectElement).value as 'scroll' | 'static' })"
                >
                    <option value="scroll">{{ t.notices.modeTicker }}</option>
                    <option value="static">{{ t.notices.modeStatic }}</option>
                </select>
            </label>
            <label class="d-field">
                {{ t.notices.banner.position }}
                <select
                    :value="modelValue.position"
                    @change="update({ position: ($event.target as HTMLSelectElement).value as 'bottom' | 'top' })"
                >
                    <option value="bottom">{{ t.inspector.verticals.bottom }}</option>
                    <option value="top">{{ t.inspector.verticals.top }}</option>
                </select>
            </label>
            <label v-if="modelValue.mode !== 'static'" class="d-field">
                {{ t.notices.banner.speed }}
                <select :value="speed" @change="update({ speed: Number(($event.target as HTMLSelectElement).value) })">
                    <option v-for="s in SPEEDS" :key="s.value" :value="s.value">{{ s.label }}</option>
                </select>
            </label>
            <label class="d-field">
                {{ t.notices.banner.height }}
                <input
                    type="number"
                    min="30"
                    max="400"
                    :value="modelValue.height"
                    @input="setNumber('height', ($event.target as HTMLInputElement).value, 30, 400)"
                >
            </label>
            <label class="d-field">
                {{ t.notices.banner.fontSize }}
                <input
                    type="number"
                    min="8"
                    max="400"
                    :value="modelValue.style.fontSize"
                    @input="setFontSize(($event.target as HTMLInputElement).value)"
                >
            </label>
            <!-- The fonts the blocks offer: bundled with the module, never from a foreign server. -->
            <FontField
                :model-value="modelValue.style.fontFamily"
                :label="t.inspector.fontFamily"
                testid="banner-font"
                @update:model-value="update({ style: { ...modelValue.style, fontFamily: $event } })"
            />
            <label class="d-field">
                {{ t.inspector.fontWeight }}
                <select
                    data-testid="banner-weight"
                    :value="modelValue.style.fontWeight"
                    @change="
                        update({
                            style: { ...modelValue.style, fontWeight: Number(($event.target as HTMLSelectElement).value) as 400 | 600 | 700 },
                        })
                    "
                >
                    <option :value="400">{{ t.inspector.weights.normal }}</option>
                    <option :value="600">{{ t.inspector.weights.semibold }}</option>
                    <option :value="700">{{ t.inspector.weights.bold }}</option>
                </select>
            </label>
        </div>
        <div class="grid2">
            <ColorField
                :label="t.common.color.background"
                :model-value="modelValue.background"
                @update:model-value="update({ background: $event })"
            />
            <ColorField
                :label="t.common.color.text"
                :model-value="modelValue.style.color"
                @update:model-value="update({ style: { ...modelValue.style, color: $event } })"
            />
        </div>
        <HintRow>
            <label class="d-field">
                {{ t.notices.banner.until }}
                <input
                    type="datetime-local"
                    :value="modelValue.until ?? ''"
                    data-testid="banner-until"
                    @change="update({ until: ($event.target as HTMLInputElement).value || undefined })"
                >
            </label>
            <template #info>{{ t.notices.banner.untilInfo }}</template>
        </HintRow>
        <p v-if="expired" class="hint hint--warn" data-testid="banner-expired">
            {{ t.notices.banner.expired }}
        </p>
    </div>
</template>

<style scoped>
.banner-editor {
    display: grid;
    gap: 10px;
}
.grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.hint--warn {
    color: var(--d-danger);
}
</style>
