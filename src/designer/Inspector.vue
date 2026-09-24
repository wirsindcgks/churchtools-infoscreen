<script setup lang="ts">
import { computed } from 'vue';
import type { Calendar } from '../ct/api';
import type { Block, Fill, MediaDoc, TextStyle } from '../model/schema';
import { useEditorStore } from './editor-store';
import FillEditor from './FillEditor.vue';
import { BLOCK_LABELS } from './ops';

defineProps<{ calendars: Calendar[]; media: MediaDoc[] }>();

const editor = useEditorStore();
const block = computed(() => editor.block);
const slide = computed(() => editor.slide);

/** Field edits are gestures: all keystrokes in one field are one undo step. */
const edit = { onFocus: () => editor.beginGesture(), onBlur: () => editor.endGesture() };

function setBlock(patch: Record<string, unknown>): void {
    if (block.value) editor.updateBlock(block.value.id, patch as Partial<Block>);
}

function setNumber(key: string, value: string): void {
    const n = Number(value);
    if (value !== '' && Number.isFinite(n)) setBlock({ [key]: n });
}

function setStyle(patch: Partial<TextStyle>): void {
    if (block.value && 'style' in block.value) setBlock({ style: { ...block.value.style, ...patch } });
}

function toggleCalendar(id: number, on: boolean): void {
    if (!block.value || !('calendarIds' in block.value)) return;
    const next = on ? [...block.value.calendarIds, id] : block.value.calendarIds.filter((c) => c !== id);
    if (next.length) setBlock({ calendarIds: [...new Set(next)].sort((a, b) => a - b) });
}

function setSlideNumber(value: string): void {
    const n = Number(value);
    if (n >= 1 && n <= 3600) editor.updateSlide({ durationSeconds: n });
}

const slideFill = computed<Fill>(() =>
    slide.value && slide.value.background.kind !== 'media' ? slide.value.background : { kind: 'solid', color: '#000000' },
);

const FONTS = [
    { key: 'sans', label: 'Serifenlos' },
    { key: 'serif', label: 'Serif' },
    { key: 'mono', label: 'Festbreite' },
];
</script>

<template>
    <aside class="inspector">
        <!-- Block -->
        <section v-if="block" data-testid="block-inspector">
            <h3>{{ BLOCK_LABELS[block.type] }}</h3>

            <div class="grid4">
                <label v-for="key in ['x', 'y', 'width', 'height'] as const" :key="key" class="d-field">
                    {{ { x: 'X', y: 'Y', width: 'Breite', height: 'Höhe' }[key] }}
                    <input
                        type="number"
                        :value="block[key]"
                        v-on="edit"
                        @input="setNumber(key, ($event.target as HTMLInputElement).value)"
                    >
                </label>
            </div>

            <label v-if="block.type === 'text'" class="d-field">
                Text
                <textarea
                    rows="3"
                    :value="block.text"
                    data-testid="text-input"
                    v-on="edit"
                    @input="setBlock({ text: ($event.target as HTMLTextAreaElement).value })"
                />
            </label>

            <template v-if="block.type === 'shape'">
                <FillEditor
                    :model-value="block.fill"
                    @focus="edit.onFocus"
                    @blur="edit.onBlur"
                    @update:model-value="setBlock({ fill: $event })"
                />
                <label class="d-field">
                    Ecken abrunden (px)
                    <input
                        type="number"
                        min="0"
                        :value="block.cornerRadius"
                        v-on="edit"
                        @input="setNumber('cornerRadius', ($event.target as HTMLInputElement).value)"
                    >
                </label>
            </template>

            <template v-if="block.type === 'image'">
                <label class="d-field">
                    Bild
                    <select :value="block.mediaId" @change="setBlock({ mediaId: ($event.target as HTMLSelectElement).value })">
                        <option value="">– kein Bild –</option>
                        <option v-for="m in media" :key="m.id" :value="m.id">{{ m.name }}</option>
                    </select>
                </label>
                <p v-if="!media.length" class="hint">Die Mediathek zum Hochladen folgt im nächsten Schritt.</p>
                <label class="d-field">
                    Einpassen
                    <select :value="block.fit" @change="setBlock({ fit: ($event.target as HTMLSelectElement).value })">
                        <option value="contain">Ganz zeigen</option>
                        <option value="cover">Fläche füllen</option>
                    </select>
                </label>
            </template>

            <label v-if="block.type === 'clock'" class="d-field">
                Anzeige
                <select :value="block.format" @change="setBlock({ format: ($event.target as HTMLSelectElement).value })">
                    <option value="time">Uhrzeit</option>
                    <option value="date">Datum</option>
                    <option value="datetime">Datum und Uhrzeit</option>
                </select>
            </label>

            <template v-if="block.type === 'appointment-list' || block.type === 'next-appointment'">
                <fieldset>
                    <legend>Kalender</legend>
                    <label v-for="c in calendars" :key="c.id" class="check">
                        <input
                            type="checkbox"
                            :checked="block.calendarIds.includes(c.id)"
                            @change="toggleCalendar(c.id, ($event.target as HTMLInputElement).checked)"
                        >
                        <span class="swatch" :style="{ background: c.color ?? 'transparent' }" />
                        {{ c.name }}
                    </label>
                    <p v-if="!calendars.length" class="hint">Keine Kalender sichtbar.</p>
                </fieldset>
                <div v-if="block.type === 'appointment-list'" class="grid2">
                    <label class="d-field">
                        Tage voraus
                        <input
                            type="number"
                            min="1"
                            max="366"
                            :value="block.horizonDays"
                            v-on="edit"
                            @input="setNumber('horizonDays', ($event.target as HTMLInputElement).value)"
                        >
                    </label>
                    <label class="d-field">
                        Höchstens
                        <input
                            type="number"
                            min="1"
                            max="50"
                            :value="block.limit"
                            v-on="edit"
                            @input="setNumber('limit', ($event.target as HTMLInputElement).value)"
                        >
                    </label>
                </div>
                <label v-else class="check">
                    <input
                        type="checkbox"
                        :checked="block.showImage"
                        @change="setBlock({ showImage: ($event.target as HTMLInputElement).checked })"
                    >
                    Terminbild zeigen
                </label>
            </template>

            <label v-if="block.type === 'church-header'" class="check">
                <input
                    type="checkbox"
                    :checked="block.showName"
                    @change="setBlock({ showName: ($event.target as HTMLInputElement).checked })"
                >
                Gemeindenamen zeigen
            </label>

            <fieldset v-if="'style' in block">
                <legend>Schrift</legend>
                <div class="grid2">
                    <label class="d-field">
                        Schriftart
                        <select
                            :value="block.style.fontFamily"
                            @change="setStyle({ fontFamily: ($event.target as HTMLSelectElement).value })"
                        >
                            <option v-for="f in FONTS" :key="f.key" :value="f.key">{{ f.label }}</option>
                        </select>
                    </label>
                    <label class="d-field">
                        Größe (px)
                        <input
                            type="number"
                            min="8"
                            :value="block.style.fontSize"
                            v-on="edit"
                            @input="
                                Number(($event.target as HTMLInputElement).value) >= 1 &&
                                    setStyle({ fontSize: Number(($event.target as HTMLInputElement).value) })
                            "
                        >
                    </label>
                    <label class="d-field">
                        Stärke
                        <select
                            :value="block.style.fontWeight"
                            @change="setStyle({ fontWeight: Number(($event.target as HTMLSelectElement).value) as 400 })"
                        >
                            <option :value="400">Normal</option>
                            <option :value="600">Halbfett</option>
                            <option :value="700">Fett</option>
                        </select>
                    </label>
                    <label class="d-field">
                        Farbe
                        <input
                            type="color"
                            :value="block.style.color"
                            v-on="edit"
                            @input="setStyle({ color: ($event.target as HTMLInputElement).value })"
                        >
                    </label>
                </div>
                <label class="d-field">
                    Ausrichtung
                    <select
                        :value="block.style.align"
                        @change="setStyle({ align: ($event.target as HTMLSelectElement).value as 'left' })"
                    >
                        <option value="left">Links</option>
                        <option value="center">Mittig</option>
                        <option value="right">Rechts</option>
                    </select>
                </label>
            </fieldset>

            <fieldset>
                <legend>Ebene</legend>
                <div class="buttons">
                    <button class="d-btn" type="button" @click="editor.layerBlock(block.id, 'front')">Ganz nach vorn</button>
                    <button class="d-btn" type="button" @click="editor.layerBlock(block.id, 'forward')">Eins vor</button>
                    <button class="d-btn" type="button" @click="editor.layerBlock(block.id, 'backward')">Eins zurück</button>
                    <button class="d-btn" type="button" @click="editor.layerBlock(block.id, 'back')">Ganz nach hinten</button>
                </div>
            </fieldset>
            <button class="d-btn d-btn--danger" type="button" @click="editor.removeBlock(block.id)">Block löschen</button>
        </section>

        <!-- Slide and screen -->
        <template v-else>
            <section v-if="slide" data-testid="slide-inspector">
                <h3>Slide</h3>
                <label class="d-field">
                    Name
                    <input
                        type="text"
                        maxlength="100"
                        :value="slide.name"
                        v-on="edit"
                        @input="editor.updateSlide({ name: ($event.target as HTMLInputElement).value })"
                    >
                </label>
                <div class="grid2">
                    <label class="d-field">
                        Anzeigedauer (s)
                        <input
                            type="number"
                            min="1"
                            max="3600"
                            :value="slide.durationSeconds"
                            data-testid="duration-input"
                            v-on="edit"
                            @input="setSlideNumber(($event.target as HTMLInputElement).value)"
                        >
                    </label>
                    <label class="check check--inline">
                        <input
                            type="checkbox"
                            :checked="slide.enabled"
                            @change="editor.updateSlide({ enabled: ($event.target as HTMLInputElement).checked })"
                        >
                        Wird gezeigt
                    </label>
                </div>
                <fieldset>
                    <legend>Hintergrund</legend>
                    <FillEditor
                        :model-value="slideFill"
                        @focus="edit.onFocus"
                        @blur="edit.onBlur"
                        @update:model-value="editor.updateSlide({ background: $event })"
                    />
                </fieldset>
            </section>

            <section v-if="editor.draft">
                <h3>Screen</h3>
                <label class="d-field">
                    Name
                    <input
                        type="text"
                        maxlength="100"
                        :value="editor.draft.screen.name"
                        v-on="edit"
                        @input="editor.updateScreen({ name: ($event.target as HTMLInputElement).value })"
                    >
                </label>
                <dl>
                    <dt>Adresse</dt>
                    <dd><code>{{ editor.draft.screen.slug }}</code></dd>
                    <dt>Bühne</dt>
                    <dd>{{ editor.draft.screen.stage.width }} × {{ editor.draft.screen.stage.height }} px</dd>
                </dl>
                <label class="d-field">
                    Overscan-Korrektur (%)
                    <input
                        type="number"
                        min="0"
                        max="20"
                        :value="editor.draft.screen.overscanPercent"
                        v-on="edit"
                        @input="
                            editor.updateScreen({
                                overscanPercent: Math.min(20, Math.max(0, Number(($event.target as HTMLInputElement).value) || 0)),
                            })
                        "
                    >
                </label>
                <p class="hint">Verkleinert die Bühne auf Fernsehern, die den Rand abschneiden.</p>
            </section>
        </template>
    </aside>
</template>

<style scoped>
.inspector {
    overflow-y: auto;
    min-height: 0;
    padding: 12px 14px 24px;
    border-left: 1px solid var(--d-divider);
    background: var(--d-surface);
}
section + section {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--d-divider);
}
section {
    display: grid;
    gap: 10px;
}
h3 {
    margin: 0;
    font-size: 1.05em;
}
fieldset {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 8px 10px 10px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
}
legend {
    padding: 0 4px;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    align-items: end;
}
.grid4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
}
.check {
    display: flex;
    align-items: center;
    gap: 6px;
}
.check--inline {
    padding-bottom: 0.4em;
}
.swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid var(--d-divider);
}
.buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
}
.buttons .d-btn {
    justify-content: center;
    font-size: var(--d-size-sm);
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
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
</style>
