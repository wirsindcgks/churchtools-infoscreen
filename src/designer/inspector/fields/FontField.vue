<script setup lang="ts">
/**
 * The choice of a font, in the fonts themselves (Plan.md 79, B2): a list of our own instead of a `<select>`, because
 * Safari does not set a font in an `<option>`. The button shows the current font in itself; unfolded, the list starts
 * with the font of the design (mark „Design", only where a page provides the theme) and goes on with „Alle Schriften".
 * Keyboard: arrows, Home and End move, Enter and Space take, Escape and Tab close. The list unfolds in the flow of the
 * inspector, not over it, so no scrolling parent clips it.
 */
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import { t } from '../../../i18n/designer';
import { fontDef, FONTS } from '../../../player/fonts';
import Icon from '../../Icon.vue';
import { usePalette } from '../../palette';
import FieldRow from './FieldRow.vue';

const props = defineProps<{ modelValue: string; label: string; testid?: string; quick?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [string] }>();
defineSlots<{ info?(): unknown }>();

const labelId = useId();
const listId = useId();
const root = ref<HTMLElement | null>(null);
const button = ref<HTMLButtonElement | null>(null);
const list = ref<HTMLElement | null>(null);

const current = computed(() => fontDef(props.modelValue));
const lists = usePalette();
const design = computed(() => (lists?.value.designFont ? fontDef(lists.value.designFont) : null));

/** The rows in the order of the keyboard: the design's font first, then all of them. */
const entries = computed(() => [...(design.value ? [{ font: design.value, design: true }] : []), ...FONTS.map((font) => ({ font, design: false }))]);

const open = ref(false);
const active = ref(0);

function optionId(index: number): string {
    return `${listId}-${index}`;
}

async function show(): Promise<void> {
    open.value = true;
    // The row of the current font, in the „Alle Schriften" part where there is one.
    const at = entries.value.findIndex((e) => e.font.key === current.value.key && !e.design);
    active.value = Math.max(at, 0);
    await nextTick();
    list.value?.focus();
    document.getElementById(optionId(active.value))?.scrollIntoView?.({ block: 'nearest' });
}

function close(refocus: boolean): void {
    open.value = false;
    if (refocus) button.value?.focus();
}

function pick(index: number): void {
    const entry = entries.value[index];
    if (entry && entry.font.key !== current.value.key) emit('update:modelValue', entry.font.key);
    close(true);
}

function move(to: number): void {
    active.value = Math.min(Math.max(to, 0), entries.value.length - 1);
    document.getElementById(optionId(active.value))?.scrollIntoView?.({ block: 'nearest' });
}

function onListKey(event: KeyboardEvent): void {
    const keys: Record<string, () => void> = {
        ArrowDown: () => move(active.value + 1),
        ArrowUp: () => move(active.value - 1),
        Home: () => move(0),
        End: () => move(entries.value.length - 1),
        Enter: () => pick(active.value),
        ' ': () => pick(active.value),
        Escape: () => close(true),
        Tab: () => close(false),
    };
    const handler = keys[event.key];
    if (!handler) return;
    if (event.key !== 'Tab') event.preventDefault();
    // Escape closes the list, not the block selection or the dialog behind it.
    if (event.key === 'Escape') event.stopPropagation();
    handler();
}

function onButtonKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        void show();
    }
}

function onOutside(event: Event): void {
    if (root.value && !root.value.contains(event.target as Node)) close(false);
}

watch(open, (now) => {
    if (now) document.addEventListener('pointerdown', onOutside);
    else document.removeEventListener('pointerdown', onOutside);
});
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside));
</script>

<template>
    <FieldRow :label="label" :label-id="labelId" stacked :quick="quick">
        <div ref="root" class="font-field">
            <button
                ref="button"
                type="button"
                class="font-button"
                aria-haspopup="listbox"
                :aria-expanded="open"
                :aria-controls="open ? listId : undefined"
                :aria-labelledby="labelId"
                :title="current.label"
                :style="{ fontFamily: `'${current.family}'` }"
                :data-testid="testid"
                :data-value="current.key"
                @click="open ? close(false) : show()"
                @keydown="onButtonKey"
            >
                <span class="font-name">{{ current.label }}</span>
                <Icon name="chevron-down" :size="14" />
            </button>
            <ul
                v-if="open"
                :id="listId"
                ref="list"
                class="font-list"
                role="listbox"
                tabindex="-1"
                :aria-labelledby="labelId"
                :aria-activedescendant="optionId(active)"
                @keydown="onListKey"
            >
                <template v-for="(entry, index) in entries" :key="index">
                    <li v-if="index === (design ? 1 : 0)" class="font-caption" role="presentation">{{ t.inspector.allFonts }}</li>
                    <li
                        :id="optionId(index)"
                        class="font-option"
                        :class="{ active: index === active }"
                        role="option"
                        :aria-selected="entry.font.key === current.key"
                        :style="{ fontFamily: `'${entry.font.family}'` }"
                        :data-testid="testid ? `${testid}-${entry.design ? 'design' : entry.font.key}` : undefined"
                        @click="pick(index)"
                        @pointermove="active = index"
                    >
                        <span class="font-name">{{ entry.font.label }}</span>
                        <span v-if="entry.design" class="font-mark">{{ t.inspector.designFont }}</span>
                    </li>
                </template>
            </ul>
        </div>
        <template v-if="$slots.info" #info><slot name="info" /></template>
    </FieldRow>
</template>

<style scoped>
.font-field {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
}
.font-button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    min-height: 2.3em;
    padding: 0.3em 0.6em;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
    background: var(--d-surface);
    color: var(--d-text);
    font-size: var(--d-size);
    text-align: left;
    cursor: pointer;
}
.font-list {
    max-height: 16rem;
    margin: 0;
    padding: 4px;
    overflow-y: auto;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
    background: var(--d-surface);
    list-style: none;
}
.font-list:focus-visible {
    outline: 2px solid var(--d-accent);
    outline-offset: 1px;
}
.font-caption {
    padding: 6px 8px 2px;
    color: var(--d-text-muted);
    font-family: var(--d-font);
    font-size: var(--d-size-sm);
}
.font-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 2.4em;
    padding: 4px 8px;
    border-radius: var(--d-radius);
    color: var(--d-text);
    font-size: 1.1em;
    cursor: pointer;
}
.font-option.active {
    background: var(--d-accent-pale);
}
.font-option[aria-selected='true'] {
    box-shadow: inset 3px 0 0 var(--d-accent);
}
.font-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.font-mark {
    flex: none;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--d-accent-pale);
    color: var(--d-accent-strong);
    font-family: var(--d-font);
    font-size: var(--d-size-sm);
}
</style>
