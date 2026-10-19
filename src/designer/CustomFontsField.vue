<script setup lang="ts">
/**
 * The church's own fonts on the Design page (Plan.md 103): upload a font, add its semibold and bold cut, rename it,
 * delete it. A file goes up at once; the list only counts once the page is saved, like everything on it. The page
 * deletes the files of fonts that left the list after a successful save.
 */
import { ref } from 'vue';
import { t } from '../i18n/designer';
import { FONT_EXTENSIONS, suggestFontName } from '../media/font';
import { CUSTOM_FONT_PREFIX, type CustomFont, type FontFile } from '../model/schema';
import { fontStack } from '../player/fonts';
import Icon from './Icon.vue';
import { useConfirm } from './useConfirm';

type Cut = 400 | 600 | 700;
const CUTS: Cut[] = [400, 600, 700];
const MAX = 10;
const text = t.design.font.custom;

const props = defineProps<{
    modelValue: CustomFont[];
    /** Uploads a file (checked before it is sent) and returns where it lies. */
    upload: (file: File) => Promise<FontFile>;
    /** Where the font is used, one line each; empty when nowhere. */
    usage: (key: string) => Promise<string[]>;
}>();
const emit = defineEmits<{ 'update:modelValue': [CustomFont[]] }>();

const { confirm } = useConfirm();
const input = ref<HTMLInputElement | null>(null);
/** What the file the browser asks for is meant for: a new font, or a cut of one. */
let target: { key: string; cut: Cut } | null = null;
const busy = ref<string | null>(null);
const problem = ref<string | null>(null);

function ask(to: { key: string; cut: Cut } | null): void {
    target = to;
    input.value?.click();
}

function errorText(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

async function picked(event: Event): Promise<void> {
    const element = event.target as HTMLInputElement;
    const file = element.files?.[0];
    element.value = '';
    if (!file) return;
    const aim = target;
    problem.value = null;
    busy.value = aim ? `${aim.key}-${aim.cut}` : 'new';
    try {
        const uploaded = await props.upload(file);
        if (!aim) {
            emit('update:modelValue', [
                ...props.modelValue,
                { key: `${CUSTOM_FONT_PREFIX}${crypto.randomUUID()}`, name: suggestFontName(file.name), files: { 400: uploaded } },
            ]);
        } else {
            emit(
                'update:modelValue',
                props.modelValue.map((f) => (f.key === aim.key ? { ...f, files: { ...f.files, [aim.cut]: uploaded } } : f)),
            );
        }
    } catch (e) {
        problem.value = errorText(e);
    } finally {
        busy.value = null;
    }
}

function rename(key: string, name: string): void {
    emit(
        'update:modelValue',
        props.modelValue.map((f) => (f.key === key ? { ...f, name } : f)),
    );
}

/** A name cleared again is not a name: the field falls back to what was there. */
function commitName(font: CustomFont, event: Event): void {
    const element = event.target as HTMLInputElement;
    const name = element.value.trim();
    if (name === '') element.value = font.name;
    else if (name !== font.name) rename(font.key, name);
}

async function remove(font: CustomFont): Promise<void> {
    const lines = await props.usage(font.key).catch(() => []);
    const shown = lines.slice(0, 6);
    const where = [...shown.map((line) => `• ${line}`), ...(lines.length > shown.length ? [text.more(lines.length - shown.length)] : [])].join('\n');
    if (!(await confirm({ message: text.removeQuestion(font.name, where), confirmLabel: text.remove, danger: true }))) return;
    emit(
        'update:modelValue',
        props.modelValue.filter((f) => f.key !== font.key),
    );
}
</script>

<template>
    <div class="custom-fonts" data-testid="custom-fonts">
        <h3>{{ text.title }}</h3>
        <p class="hint">{{ text.hint }}</p>
        <p class="hint">{{ text.license }}</p>
        <p v-if="problem" class="d-banner d-banner--error" role="alert" data-testid="custom-font-problem">{{ problem }}</p>
        <p v-if="!modelValue.length" class="hint" data-testid="custom-fonts-empty">{{ text.empty }}</p>
        <ul v-else class="entries">
            <li v-for="font in modelValue" :key="font.key" class="entry" data-testid="custom-font" :data-font-key="font.key">
                <input
                    :value="font.name"
                    class="entry-name"
                    type="text"
                    maxlength="40"
                    autocomplete="off"
                    :aria-label="text.name"
                    :style="{ fontFamily: fontStack(font.key) }"
                    data-testid="custom-font-name"
                    @change="commitName(font, $event)"
                >
                <ul class="cuts">
                    <li v-for="cut in CUTS" :key="cut" class="cut" :data-testid="`custom-font-cut-${cut}`">
                        <span class="cut-label">{{ text.cuts[cut] }}</span>
                        <span class="cut-file" :title="font.files[cut]?.name">{{ font.files[cut]?.name ?? '–' }}</span>
                        <button
                            class="d-btn"
                            type="button"
                            :disabled="busy !== null"
                            :aria-label="text.cutLabel(text.cuts[cut], font.name)"
                            :data-testid="`custom-font-upload-${cut}`"
                            @click="ask({ key: font.key, cut })"
                        >
                            {{ busy === `${font.key}-${cut}` ? text.uploading : font.files[cut] ? text.replace : text.upload }}
                        </button>
                    </li>
                </ul>
                <div>
                    <button
                        class="d-btn d-btn--danger"
                        type="button"
                        :disabled="busy !== null"
                        :aria-label="text.removeLabel(font.name)"
                        data-testid="custom-font-remove"
                        @click="remove(font)"
                    >
                        <Icon name="trash" /> {{ text.remove }}
                    </button>
                </div>
            </li>
        </ul>
        <p v-if="modelValue.length" class="hint">{{ text.missingCut }}</p>
        <div>
            <button
                class="d-btn"
                type="button"
                :disabled="busy !== null || modelValue.length >= MAX"
                data-testid="custom-font-add"
                @click="ask(null)"
            >
                <Icon name="plus" /> {{ busy === 'new' ? text.uploading : text.add }}
            </button>
        </div>
        <p v-if="modelValue.length >= MAX" class="hint">{{ text.max(MAX) }}</p>
        <input
            ref="input"
            type="file"
            :accept="FONT_EXTENSIONS.join(',')"
            hidden
            data-testid="custom-font-file"
            @change="picked"
        >
    </div>
</template>

<style scoped>
.custom-fonts {
    display: grid;
    gap: 8px;
}
h3 {
    margin: 0;
    font-size: var(--d-size);
    font-weight: var(--d-weight-heading);
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.entries,
.cuts {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}
.entry {
    display: grid;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
}
.entry-name {
    font-size: 1.2em;
}
.cuts {
    gap: 4px;
}
.cut {
    display: grid;
    grid-template-columns: 5.5em minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
}
.cut-label {
    font-size: var(--d-size-sm);
}
.cut-file {
    min-width: 0;
    overflow: hidden;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
