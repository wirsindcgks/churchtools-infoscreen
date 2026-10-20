<script setup lang="ts">
/**
 * The help bar (Plan.md 98): the explanations of the open page, in the bar below the slide of the editor (and below the preview
 * of the page "Design"), on a phone as a sheet from below. It reads the register the page provides: one tab per announced topic,
 * "Allgemein" first, then the sections in the order of the inspector; the search runs over all topics. Closing is up to the
 * caller's keys (Esc) and to the "?" that opened it; here are the ✕ and, on a phone, a tap beside the sheet.
 */
import { computed, nextTick, ref, watch } from 'vue';
import { t } from '../i18n/designer';
import { useHelp } from './help/register';
import Icon from './Icon.vue';
import { matchesName } from './name-search';
import SearchField from './SearchField.vue';
import { usePhone } from './usePhone';
import { vTip } from './tip';

const help = useHelp();
const phone = usePhone();
const query = ref('');
const searching = computed(() => query.value.trim() !== '');
const sections = computed(() => help?.sections.value ?? []);
const visible = computed(() => !!help && help.open.value && sections.value.length > 0);
const current = computed(() => sections.value.find((s) => s.id === help?.active.value) ?? sections.value[0]);

const paragraphs = (intro: string | undefined): string[] => (intro ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/** What the search finds, topic by topic: the introduction if it matches, and the settings whose label or text does. */
const hits = computed(() =>
    sections.value
        .map((s) => ({
            id: s.id,
            title: s.title,
            intro: s.topic.intro && matchesName(s.topic.intro, query.value) ? paragraphs(s.topic.intro) : [],
            items: (s.topic.items ?? []).filter((item) => matchesName(`${item.term} ${item.text}`, query.value)),
        }))
        .filter((hit) => hit.intro.length || hit.items.length),
);

const panel = ref<HTMLElement | null>(null);
const sheet = ref<HTMLElement | null>(null);
const tabs = ref<HTMLElement | null>(null);

function pick(id: string): void {
    query.value = '';
    if (help) help.active.value = id;
}

/** Arrow keys move between the tabs and choose them, as a tab list does. */
function onTabKey(event: KeyboardEvent): void {
    const list = sections.value;
    const at = list.findIndex((s) => s.id === current.value?.id);
    const next = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: list.length - 1 }[event.key];
    if (next === undefined || !list.length) return;
    event.preventDefault();
    const target = list[(next + list.length) % list.length]!;
    pick(target.id);
    void nextTick(() => tabs.value?.querySelector<HTMLElement>(`[data-testid="help-tab-${target.id}"]`)?.focus());
}

// Another topic starts at its top; a closed bar forgets the search.
watch(
    () => current.value?.id,
    () => {
        if (panel.value) panel.value.scrollTop = 0;
    },
);
watch(visible, (now) => {
    if (!now) query.value = '';
    // A sheet over the page takes the focus, so the keys and the reader stay inside it.
    else if (phone.value) void nextTick(() => sheet.value?.focus());
});
</script>

<template>
    <div v-if="help && visible" :class="phone ? 'd-dialog-backdrop help-backdrop' : 'help-flow'" @click.self="phone && help.close()">
        <section
            ref="sheet"
            class="help-bar"
            :class="{ 'help-bar--sheet': phone }"
            :role="phone ? 'dialog' : 'region'"
            :aria-modal="phone ? 'true' : undefined"
            :aria-label="t.help.subject(help.subject.value)"
            tabindex="-1"
            data-testid="help-bar"
        >
            <header class="help-head">
                <strong class="help-title" data-testid="help-title">{{ t.help.subject(help.subject.value) }}</strong>
                <SearchField v-model="query" class="help-search" :placeholder="t.help.search" :label="t.help.search" testid="help-search" />
                <button v-tip="t.help.close" class="d-btn d-btn--icon" type="button" :aria-label="t.help.close" data-testid="help-close" @click="help.close()">
                    <Icon name="close" :size="16" />
                </button>
            </header>
            <div ref="tabs" class="help-tabs" role="tablist" :aria-label="t.help.topics" @keydown="onTabKey">
                <button
                    v-for="s in sections"
                    :id="`help-tab-${s.id}`"
                    :key="s.id"
                    class="help-tab"
                    :class="{ 'help-tab--on': !searching && s.id === current?.id }"
                    type="button"
                    role="tab"
                    :aria-selected="s.id === current?.id"
                    :tabindex="s.id === current?.id ? 0 : -1"
                    aria-controls="help-panel"
                    :data-testid="`help-tab-${s.id}`"
                    @click="pick(s.id)"
                >
                    {{ s.title }}
                </button>
            </div>
            <div id="help-panel" ref="panel" class="help-panel" role="tabpanel" :aria-labelledby="current ? `help-tab-${current.id}` : undefined" data-testid="help-panel">
                <template v-if="searching">
                    <p v-if="!hits.length" class="help-empty" data-testid="help-empty">{{ t.help.noMatches }}</p>
                    <section v-for="hit in hits" :key="hit.id" class="help-topic" :data-testid="`help-hit-${hit.id}`">
                        <h3>{{ hit.title }}</h3>
                        <p v-for="(p, i) in hit.intro" :key="i">{{ p }}</p>
                        <dl v-if="hit.items.length">
                            <template v-for="item in hit.items" :key="item.term">
                                <dt>{{ item.term }}</dt>
                                <dd>{{ item.text }}</dd>
                            </template>
                        </dl>
                    </section>
                </template>
                <section v-else-if="current" class="help-topic">
                    <h3>{{ current.title }}</h3>
                    <p v-for="(p, i) in paragraphs(current.topic.intro)" :key="i">{{ p }}</p>
                    <dl v-if="current.topic.items?.length">
                        <template v-for="item in current.topic.items" :key="item.term">
                            <dt>{{ item.term }}</dt>
                            <dd>{{ item.text }}</dd>
                        </template>
                    </dl>
                </section>
            </div>
        </section>
    </div>
</template>

<style scoped>
.help-flow {
    display: contents;
}
.help-bar {
    box-sizing: border-box;
    display: flex;
    flex: none;
    flex-direction: column;
    gap: var(--d-space-2);
    max-height: 40vh;
    min-height: 0;
    padding: var(--d-space-3) var(--d-space-4);
    border-radius: var(--d-radius-lg);
    background: var(--d-surface);
    box-shadow: var(--d-shadow-card);
}
.help-bar:focus {
    outline: none;
}
.help-head {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--d-space-3);
}
.help-title {
    flex: none;
    color: var(--d-help);
    font-weight: var(--d-weight-heading);
}
.help-search {
    flex: 1;
    min-width: 0;
    max-width: 22rem;
    margin-left: auto;
}
.help-search :deep(input) {
    width: 100%;
    box-sizing: border-box;
    min-height: 32px;
}
.help-head .d-btn {
    flex: none;
}
.help-tabs {
    display: flex;
    flex: none;
    flex-wrap: wrap;
    gap: var(--d-space-1);
}
.help-tab {
    padding: 4px 10px;
    border: 1px solid transparent;
    border-radius: 999px;
    background: none;
    color: var(--d-text-muted);
    font: inherit;
    cursor: pointer;
}
.help-tab:hover {
    background: var(--d-help-pale);
}
.help-tab--on,
.help-tab--on:hover {
    border-color: var(--d-help);
    background: var(--d-help-pale);
    color: var(--d-text);
    font-weight: var(--d-weight-button);
}
.help-tab:focus-visible {
    outline: 2px solid var(--d-help);
}
.help-panel {
    min-height: 0;
    overflow-y: auto;
}
.help-topic {
    display: grid;
    gap: var(--d-space-2);
}
.help-topic + .help-topic {
    margin-top: var(--d-space-3);
}
h3 {
    margin: 0;
    font-size: 1.05em;
}
p {
    margin: 0;
}
dl {
    display: grid;
    gap: var(--d-space-1) var(--d-space-3);
    grid-template-columns: minmax(8rem, max-content) minmax(0, 1fr);
    margin: 0;
}
dt {
    font-weight: var(--d-weight-heading);
}
dd {
    margin: 0;
    color: var(--d-text-muted);
}
.help-empty {
    color: var(--d-text-muted);
}

/* A phone: a sheet from below over the inspector's sheet, like the sheet of slides. */
.help-backdrop {
    align-items: end;
    padding: 0;
}
.help-bar--sheet {
    width: 100%;
    max-height: 75vh;
    max-height: 75dvh;
    padding-bottom: calc(var(--d-space-3) + env(safe-area-inset-bottom));
    border: 0;
    border-radius: var(--d-radius-lg) var(--d-radius-lg) 0 0;
    box-shadow: var(--d-shadow);
}
.help-bar--sheet .help-head {
    flex-wrap: wrap;
}
.help-bar--sheet .help-search {
    order: 3;
    flex: 1 0 100%;
    max-width: none;
    margin-left: 0;
}
.help-bar--sheet .help-title {
    flex: 1;
    min-width: 0;
}
.help-bar--sheet dl {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
}
.help-bar--sheet dd {
    margin-bottom: var(--d-space-2);
}
@media (pointer: coarse) {
    .help-tab {
        min-height: 44px;
    }
}
</style>
