<script setup lang="ts">
/**
 * Our own list instead of the browser's `<select>` (Plan.md 98 A): the same look and the same keyboard everywhere, in
 * Safari, on a tablet and in a dialog. A button shows the choice; the list floats over the page – set into the
 * designer's own element (like `tip.ts`), `position: fixed` under the button, above it where there is no room, and
 * carried along when the page scrolls – so neither a toolbar nor a dialog is pushed or clips it.
 * From `SELECT_SEARCH_FROM` entries on a search field stands above the list. Keyboard: arrows move (from the button
 * they open), Home and End jump, Enter and Space take, Escape and Tab close, letters jump to the first entry that
 * starts with them (without a search field).
 */
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import { t } from '../i18n/designer';
import Icon from './Icon.vue';
import { setFloatingOwner } from './floating';
import { matchesName, normalise, SELECT_SEARCH_FROM } from './name-search';

export interface SelectOption {
    value: string | number;
    label: string;
    /** Inline style of the option, for a font list in the fonts themselves. */
    style?: Record<string, string>;
    /** A caption stands before the first of a run of options with the same group. */
    group?: string;
}

const props = defineProps<{
    modelValue: string | number | undefined;
    options: readonly SelectOption[];
    /** The text of the button while nothing is chosen. */
    placeholder?: string;
    disabled?: boolean;
    testid?: string;
    ariaLabel?: string;
    labelledby?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [string | number] }>();

const listId = useId();
const root = ref<HTMLElement | null>(null);
const button = ref<HTMLButtonElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const list = ref<HTMLElement | null>(null);
const search = ref<HTMLInputElement | null>(null);

const open = ref(false);
const host = ref<HTMLElement | null>(null);
const query = ref('');
const active = ref(0);
const position = ref<Record<string, string>>({});

const chosen = computed(() => props.options.find((o) => String(o.value) === String(props.modelValue)));
const searchable = computed(() => props.options.length >= SELECT_SEARCH_FROM);
const shown = computed(() => (searchable.value ? props.options.filter((o) => matchesName(o.label, query.value)) : props.options));

function captionBefore(index: number): string | null {
    const group = shown.value[index]?.group;
    return group && shown.value[index - 1]?.group !== group ? group : null;
}

function optionId(index: number): string {
    return `${listId}-${index}`;
}

function scrollToActive(): void {
    document.getElementById(optionId(active.value))?.scrollIntoView?.({ block: 'nearest' });
}

/** Under the button, as wide as it is at least; above it where there is no room below; kept inside the window. */
function place(): void {
    const anchor = button.value;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const edge = 8;
    const below = window.innerHeight - rect.bottom - edge;
    const above = rect.top - edge;
    const up = below < 200 && above > below;
    const next: Record<string, string> = {
        left: `${Math.round(Math.max(edge, rect.left))}px`,
        minWidth: `${Math.round(rect.width)}px`,
        maxWidth: `${window.innerWidth - 2 * edge}px`,
        maxHeight: `${Math.max(120, Math.min(320, (up ? above : below) - 4))}px`,
    };
    if (up) next.bottom = `${Math.round(window.innerHeight - rect.top + 4)}px`;
    else next.top = `${Math.round(rect.bottom + 4)}px`;
    position.value = next;
    // Wider than the space to its right: move it left.
    void nextTick(() => {
        const width = panel.value?.getBoundingClientRect().width ?? 0;
        if (width && rect.left + width > window.innerWidth - edge) {
            position.value = { ...position.value, left: `${Math.round(Math.max(edge, window.innerWidth - edge - width))}px` };
        }
    });
}

function onScroll(event: Event): void {
    if (panel.value && event.target instanceof Node && panel.value.contains(event.target)) return;
    place();
}

async function show(): Promise<void> {
    if (props.disabled || open.value) return;
    host.value = button.value?.closest<HTMLElement>('.infoscreen-designer') ?? document.body;
    query.value = '';
    active.value = Math.max(props.options.findIndex((o) => String(o.value) === String(props.modelValue)), 0);
    place();
    open.value = true;
    await nextTick();
    if (panel.value && button.value) setFloatingOwner(panel.value, button.value);
    (search.value ?? list.value)?.focus();
    scrollToActive();
}

function close(refocus: boolean): void {
    open.value = false;
    if (refocus) button.value?.focus();
}

function pick(index: number): void {
    const option = shown.value[index];
    if (!option) return;
    if (String(option.value) !== String(props.modelValue)) emit('update:modelValue', option.value);
    close(true);
}

function move(to: number): void {
    if (!shown.value.length) return;
    active.value = Math.min(Math.max(to, 0), shown.value.length - 1);
    scrollToActive();
}

let typed = '';
let typedTimer: number | undefined;

/** A letter jumps to the first entry that starts with what was typed in the last moment. */
function jump(letter: string): void {
    typed += normalise(letter);
    window.clearTimeout(typedTimer);
    typedTimer = window.setTimeout(() => (typed = ''), 700);
    const at = shown.value.findIndex((o) => normalise(o.label).startsWith(typed));
    if (at >= 0) move(at);
}

function onPanelKey(event: KeyboardEvent): void {
    // The keys belong to the list: no shortcut of the editor behind it may take them.
    event.stopPropagation();
    const inSearch = event.target === search.value;
    const keys: Record<string, () => void> = {
        ArrowDown: () => move(active.value + 1),
        ArrowUp: () => move(active.value - 1),
        Enter: () => pick(active.value),
        Escape: () => close(true),
    };
    if (!inSearch) {
        keys.Home = () => move(0);
        keys.End = () => move(shown.value.length - 1);
        keys[' '] = () => pick(active.value);
    }
    if (event.key === 'Tab') {
        // Focus leaves from the button, not from the end of the page where the list is set.
        button.value?.focus();
        close(false);
        return;
    }
    const handler = keys[event.key];
    if (handler) {
        event.preventDefault();
        handler();
    } else if (!searchable.value && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        jump(event.key);
    }
}

function onButtonKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        void show();
    }
}

function onOutside(event: Event): void {
    const target = event.target as Node;
    if (root.value?.contains(target) || panel.value?.contains(target)) return;
    close(false);
}

watch(open, (now) => {
    if (now) {
        document.addEventListener('pointerdown', onOutside);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', place);
    } else {
        document.removeEventListener('pointerdown', onOutside);
        window.removeEventListener('scroll', onScroll, true);
        window.removeEventListener('resize', place);
    }
});
onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onOutside);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', place);
    window.clearTimeout(typedTimer);
});
</script>

<template>
    <span ref="root" class="select-menu">
        <button
            ref="button"
            type="button"
            class="select-button"
            role="combobox"
            aria-haspopup="listbox"
            :aria-expanded="open"
            :aria-controls="open ? listId : undefined"
            :aria-label="ariaLabel"
            :aria-labelledby="labelledby"
            :disabled="disabled"
            :style="chosen?.style"
            :data-testid="testid"
            :data-value="chosen ? String(chosen.value) : ''"
            @click="open ? close(false) : show()"
            @keydown="onButtonKey"
        >
            <span class="select-text" :class="{ placeholder: !chosen }">{{ chosen ? chosen.label : (placeholder ?? '') }}</span>
            <Icon name="chevron-down" :size="14" />
        </button>
        <Teleport v-if="open && host" :to="host">
            <div ref="panel" class="select-panel" data-floating :style="position" @keydown="onPanelKey">
                <input
                    v-if="searchable"
                    ref="search"
                    v-model="query"
                    type="search"
                    class="select-search"
                    autocomplete="off"
                    role="searchbox"
                    :placeholder="t.common.searchList"
                    :aria-label="t.common.searchList"
                    :aria-controls="listId"
                    :aria-activedescendant="shown.length ? optionId(active) : undefined"
                    :data-testid="testid ? `${testid}-search` : undefined"
                    @input="active = 0"
                >
                <ul
                    :id="listId"
                    ref="list"
                    class="select-list"
                    role="listbox"
                    tabindex="-1"
                    :aria-label="ariaLabel"
                    :aria-labelledby="labelledby"
                    :aria-activedescendant="shown.length ? optionId(active) : undefined"
                >
                    <template v-for="(option, index) in shown" :key="option.value">
                        <li v-if="captionBefore(index)" class="select-caption" role="presentation">{{ captionBefore(index) }}</li>
                        <li
                            :id="optionId(index)"
                            class="select-option"
                            :class="{ active: index === active }"
                            role="option"
                            :aria-selected="String(option.value) === String(modelValue)"
                            :style="option.style"
                            :data-testid="testid ? `${testid}-option` : undefined"
                            :data-value="String(option.value)"
                            @click="pick(index)"
                            @pointermove="active = index"
                        >
                            <span class="select-text">{{ option.label }}</span>
                        </li>
                    </template>
                    <li v-if="!shown.length" class="select-caption" role="presentation">{{ t.common.nothingFound(query) }}</li>
                </ul>
            </div>
        </Teleport>
    </span>
</template>

<style scoped>
.select-menu {
    display: flex;
    flex: 1;
    min-width: 0;
}
.select-button {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    min-width: 0;
    min-height: max(2.3em, var(--d-control-h));
    padding: 0.3em 12px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
    background: var(--d-surface);
    color: var(--d-text);
    font-size: var(--d-size);
    text-align: left;
    cursor: pointer;
}
.select-button:disabled {
    cursor: default;
    opacity: 0.5;
}
.select-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.placeholder {
    color: var(--d-text-muted);
}
.select-panel {
    position: fixed;
    z-index: 1300;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
    background: var(--d-surface);
    box-shadow: var(--d-shadow);
    color: var(--d-text);
    font-size: var(--d-size);
}
.select-search {
    flex: none;
    margin: 4px 4px 0;
    width: calc(100% - 8px);
}
.select-list {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: 4px;
    overflow-y: auto;
    list-style: none;
}
.select-list:focus-visible {
    outline: 2px solid var(--d-accent);
    outline-offset: -2px;
}
.select-caption {
    padding: 6px 8px 2px;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.select-option {
    display: flex;
    align-items: center;
    min-height: 2.2em;
    padding: 4px 12px;
    border-radius: var(--d-radius);
    cursor: pointer;
}
.select-option.active {
    background: var(--d-accent-pale);
}
.select-option[aria-selected='true'] {
    box-shadow: inset 3px 0 0 var(--d-accent);
}
@media (pointer: coarse) {
    .select-option {
        min-height: 44px;
    }
}
</style>
