<script setup lang="ts">
/**
 * The playlist's band in the inspector (Plan.md, Nächste Schritte 32): on or
 * off, text, running or standing, where, how fast, colours – and until when,
 * so "Parkplatz heute gesperrt" goes away by itself.
 */
import { computed } from 'vue';
import { useStageContext } from '../player/context';
import { wallTime } from '../player/banner';
import ColorField from './ColorField.vue';
import { useEditorStore } from './editor-store';

const editor = useEditorStore();
const context = useStageContext();
const banner = computed(() => editor.draft?.playlist.banner ?? null);
const edit = { onFocus: () => editor.beginGesture(), onBlur: () => editor.endGesture() };

const SPEEDS = [
    { value: 80, label: 'Langsam' },
    { value: 140, label: 'Mittel' },
    { value: 220, label: 'Schnell' },
];
/** The speed choice nearest to what is stored. */
const speed = computed(() => {
    const current = banner.value?.speed ?? 140;
    return SPEEDS.reduce((a, b) => (Math.abs(b.value - current) < Math.abs(a.value - current) ? b : a)).value;
});

/** Its time is up: the TVs no longer show it. */
const expired = computed(() => !!banner.value?.until && wallTime(context.now, context.timeZone) >= banner.value.until.slice(0, 16));

function setNumber(key: 'height', value: string, min: number, max: number): void {
    const n = Number(value);
    if (Number.isFinite(n) && n >= min && n <= max) editor.updateBanner({ [key]: Math.round(n) });
}

function setFontSize(value: string): void {
    const n = Number(value);
    if (banner.value && Number.isFinite(n) && n >= 8 && n <= 400) editor.updateBanner({ style: { ...banner.value.style, fontSize: n } });
}
</script>

<template>
    <div class="banner-editor">
        <label class="check">
            <input
                type="checkbox"
                :checked="!!banner"
                data-testid="banner-toggle"
                @change="editor.setBanner(($event.target as HTMLInputElement).checked)"
            >
            Hinweisband über allen Slides
        </label>
        <template v-if="banner">
            <label class="d-field">
                Text
                <input
                    type="text"
                    maxlength="500"
                    :value="banner.text"
                    placeholder="z. B. Heute Parkplatz gesperrt – bitte in der Schulstraße parken"
                    data-testid="banner-text"
                    v-on="edit"
                    @input="editor.updateBanner({ text: ($event.target as HTMLInputElement).value })"
                >
            </label>
            <div class="grid2">
                <label class="d-field">
                    Art
                    <select
                        :value="banner.mode"
                        data-testid="banner-mode"
                        @change="editor.updateBanner({ mode: ($event.target as HTMLSelectElement).value as 'scroll' | 'static' })"
                    >
                        <option value="scroll">Laufschrift</option>
                        <option value="static">Stehend</option>
                    </select>
                </label>
                <label class="d-field">
                    Position
                    <select
                        :value="banner.position"
                        @change="editor.updateBanner({ position: ($event.target as HTMLSelectElement).value as 'bottom' | 'top' })"
                    >
                        <option value="bottom">Unten</option>
                        <option value="top">Oben</option>
                    </select>
                </label>
                <label v-if="banner.mode !== 'static'" class="d-field">
                    Tempo
                    <select :value="speed" @change="editor.updateBanner({ speed: Number(($event.target as HTMLSelectElement).value) })">
                        <option v-for="s in SPEEDS" :key="s.value" :value="s.value">{{ s.label }}</option>
                    </select>
                </label>
                <label class="d-field">
                    Höhe (px)
                    <input
                        type="number"
                        min="30"
                        max="400"
                        :value="banner.height"
                        v-on="edit"
                        @input="setNumber('height', ($event.target as HTMLInputElement).value, 30, 400)"
                    >
                </label>
                <label class="d-field">
                    Schriftgröße
                    <input
                        type="number"
                        min="8"
                        max="400"
                        :value="banner.style.fontSize"
                        v-on="edit"
                        @input="setFontSize(($event.target as HTMLInputElement).value)"
                    >
                </label>
            </div>
            <div class="grid2">
                <ColorField
                    label="Hintergrund"
                    :model-value="banner.background"
                    @focus="edit.onFocus"
                    @blur="edit.onBlur"
                    @update:model-value="editor.updateBanner({ background: $event })"
                />
                <ColorField
                    label="Text"
                    :model-value="banner.style.color"
                    @focus="edit.onFocus"
                    @blur="edit.onBlur"
                    @update:model-value="editor.updateBanner({ style: { ...banner.style, color: $event } })"
                />
            </div>
            <label class="d-field">
                Zeigen bis
                <input
                    type="datetime-local"
                    :value="banner.until ?? ''"
                    data-testid="banner-until"
                    @change="editor.updateBanner({ until: ($event.target as HTMLInputElement).value || undefined })"
                >
            </label>
            <p v-if="expired" class="hint hint--warn" data-testid="banner-expired">
                Abgelaufen – die Fernseher zeigen das Band nicht mehr.
            </p>
            <p v-else class="hint">Leer: bis du es abschaltest. Die Zeit gilt für die Gemeinde, nicht für das Gerät.</p>
        </template>
    </div>
</template>

<style scoped>
.banner-editor {
    display: grid;
    gap: 10px;
}
.check {
    display: flex;
    align-items: center;
    gap: 8px;
}
.check input {
    width: auto;
    margin: 0;
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
