<script setup lang="ts">
/**
 * The band's own fields, as a plain form (Plan.md, Nächste Schritte 34): text,
 * running or standing, where, how fast, colours – and until when, so "Heute
 * Parkplatz gesperrt" goes away by itself. On/off and which playlists it
 * runs on are the job of "Hinweise", not this form.
 */
import { computed } from 'vue';
import type { Banner } from '../model/schema';
import { wallTime } from '../player/banner';
import { fontDef, FONTS } from '../player/fonts';
import ColorField from './ColorField.vue';

const props = withDefaults(defineProps<{ modelValue: Banner; timeZone: string; now?: Date }>(), {
    now: () => new Date(),
});
const emit = defineEmits<{ 'update:modelValue': [Banner] }>();

function update(patch: Partial<Banner>): void {
    emit('update:modelValue', { ...props.modelValue, ...patch });
}

const SPEEDS = [
    { value: 80, label: 'Langsam' },
    { value: 140, label: 'Mittel' },
    { value: 220, label: 'Schnell' },
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
            Text
            <input
                type="text"
                maxlength="500"
                :value="modelValue.text"
                placeholder="z. B. Heute Parkplatz gesperrt – bitte in der Schulstraße parken"
                data-testid="banner-text"
                @input="update({ text: ($event.target as HTMLInputElement).value })"
            >
        </label>
        <div class="grid2">
            <label class="d-field">
                Art
                <select
                    :value="modelValue.mode"
                    data-testid="banner-mode"
                    @change="update({ mode: ($event.target as HTMLSelectElement).value as 'scroll' | 'static' })"
                >
                    <option value="scroll">Laufschrift</option>
                    <option value="static">Stehend</option>
                </select>
            </label>
            <label class="d-field">
                Position
                <select
                    :value="modelValue.position"
                    @change="update({ position: ($event.target as HTMLSelectElement).value as 'bottom' | 'top' })"
                >
                    <option value="bottom">Unten</option>
                    <option value="top">Oben</option>
                </select>
            </label>
            <label v-if="modelValue.mode !== 'static'" class="d-field">
                Tempo
                <select :value="speed" @change="update({ speed: Number(($event.target as HTMLSelectElement).value) })">
                    <option v-for="s in SPEEDS" :key="s.value" :value="s.value">{{ s.label }}</option>
                </select>
            </label>
            <label class="d-field">
                Höhe (px)
                <input
                    type="number"
                    min="30"
                    max="400"
                    :value="modelValue.height"
                    @input="setNumber('height', ($event.target as HTMLInputElement).value, 30, 400)"
                >
            </label>
            <label class="d-field">
                Schriftgröße
                <input
                    type="number"
                    min="8"
                    max="400"
                    :value="modelValue.style.fontSize"
                    @input="setFontSize(($event.target as HTMLInputElement).value)"
                >
            </label>
            <!-- The fonts the blocks offer: bundled with the module, never from a foreign server. -->
            <label class="d-field">
                Schriftart
                <select
                    data-testid="banner-font"
                    :value="fontDef(modelValue.style.fontFamily).key"
                    @change="update({ style: { ...modelValue.style, fontFamily: ($event.target as HTMLSelectElement).value } })"
                >
                    <option v-for="f in FONTS" :key="f.key" :value="f.key" :style="{ fontFamily: `'${f.family}'` }">
                        {{ f.label }}
                    </option>
                </select>
            </label>
            <label class="d-field">
                Stärke
                <select
                    data-testid="banner-weight"
                    :value="modelValue.style.fontWeight"
                    @change="
                        update({
                            style: { ...modelValue.style, fontWeight: Number(($event.target as HTMLSelectElement).value) as 400 | 600 | 700 },
                        })
                    "
                >
                    <option :value="400">Normal</option>
                    <option :value="600">Halbfett</option>
                    <option :value="700">Fett</option>
                </select>
            </label>
        </div>
        <div class="grid2">
            <ColorField
                label="Hintergrund"
                :model-value="modelValue.background"
                @update:model-value="update({ background: $event })"
            />
            <ColorField
                label="Text"
                :model-value="modelValue.style.color"
                @update:model-value="update({ style: { ...modelValue.style, color: $event } })"
            />
        </div>
        <label class="d-field">
            Zeigen bis
            <input
                type="datetime-local"
                :value="modelValue.until ?? ''"
                data-testid="banner-until"
                @change="update({ until: ($event.target as HTMLInputElement).value || undefined })"
            >
        </label>
        <p v-if="expired" class="hint hint--warn" data-testid="banner-expired">
            Abgelaufen – die Fernseher zeigen das Band nicht mehr.
        </p>
        <p v-else class="hint">Leer: bis du es abschaltest. Die Zeit gilt für die Gemeinde, nicht für das Gerät.</p>
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
