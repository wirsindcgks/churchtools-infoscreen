<script setup lang="ts">
/**
 * A foldable part of the inspector (Plan.md 47) on a native `<details>`: the title, and while it
 * is folded a short summary of what is set inside. Open or closed is remembered per section id,
 * so a section opened once stays open for the next block, too (a section never touched is closed, unless `defaultOpen`). A `help` topic
 * (Plan.md 98) announces the section to the help bar of the page and puts a "?" at the end of the title line while the section is
 * open, where the summary stood; the "?" opens the bar on this section. Sections sharing a `group` open one at a time
 * (the native `name` of `<details>`): opening one folds the other, so the page keeps its overview (Plan.md 89). The inspector gives all its sections one group (`SECTION_GROUP`, Plan.md 91);
 * `group="…"` picks another, `:group="false"` leaves a section out of any group. In the short menu only the body shows, and
 * so it does in the open field of a chip there (without the "?": neither announces itself, the bar belongs to the inspector).
 */
import { computed, inject, ref, unref } from 'vue';
import { t } from '../i18n/designer';
import HelpButton from './HelpButton.vue';
import { hasHelp, type HelpTopic } from './help/types';
import { useHelp, useHelpSection } from './help/register';
import Icon from './Icon.vue';
import { IN_QUICK_FIELD, INSPECTOR_MODE, SECTION_GROUP } from './inspector/mode';
import { sectionState } from './section-state';

// `group` has the type `false`, so Vue would cast an absent one to `false`; the default keeps it `undefined` (= take the provided group).
const props = withDefaults(defineProps<{ id: string; title: string; summary: string; defaultOpen?: boolean; group?: string | false; help?: HelpTopic }>(), { group: undefined, help: undefined });
defineSlots<{ default(): unknown; 'summary-extra'?(): unknown }>();
/** In the short menu (Plan.md 79, B2) a section has no head: its fields stand there on their own. */
const mode = inject(INSPECTOR_MODE, 'full');
const inChip = inject(IN_QUICK_FIELD, ref(false));
/** The native group name: the section's own, else the one the page provides; `false` means none. */
const providedGroup = inject(SECTION_GROUP, undefined);
const groupName = computed(() => (props.group === false ? undefined : (props.group ?? providedGroup)));
/** What the viewer chose; a section never chosen follows `defaultOpen`. */
const isOpen = computed(() => sectionState[props.id] ?? !!props.defaultOpen);

/** The help bar of the page, if there is one: the full inspector announces the section to it, the short menu and its chips do not. */
const register = useHelp();
const details = ref<HTMLElement | null>(null);
useHelpSection(
    details,
    () => props.id,
    () => props.title,
    () => props.help,
);
const helpShown = computed(() => !!register && register.shown(props.id));

function onToggle(id: string, event: Event): void {
    sectionState[id] = (event.target as HTMLDetailsElement).open;
}
</script>

<template>
    <slot v-if="unref(mode) === 'quick'" />
    <div v-else-if="inChip" class="body">
        <slot />
    </div>
    <details v-else ref="details" class="section" :name="groupName" :open="isOpen" :data-testid="`section-${id}`" @toggle="onToggle(id, $event)">
        <summary :data-testid="`section-${id}-toggle`">
            <Icon name="chevron-down" :size="14" class="chevron" />
            <span class="title">{{ title }}</span>
            <span v-if="!isOpen" class="summary-text">
                <slot name="summary-extra" />
                <span v-if="summary" class="summary-line">{{ summary }}</span>
            </span>
            <HelpButton
                v-if="register && isOpen && hasHelp(help)"
                :label="t.help.about(title)"
                :shown="helpShown"
                :data-testid="`section-${id}-help`"
                @toggle="register.toggle(id)"
            />
        </summary>
        <div class="body">
            <slot />
        </div>
    </details>
</template>

<style scoped>
.section {
    min-width: 0;
    border-top: 1px solid var(--d-divider);
}
summary {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: var(--d-space-2);
    padding: var(--d-space-3) 0;
    list-style: none;
    cursor: pointer;
}
summary::-webkit-details-marker {
    display: none;
}
.chevron {
    color: var(--d-text-muted);
    transition: transform var(--d-transition);
}
.section:not([open]) .chevron {
    transform: rotate(-90deg);
}
.title {
    font-weight: var(--d-weight-heading);
}
.summary-text {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    min-width: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.summary-line {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--d-space-3);
    padding-bottom: var(--d-space-3);
}
</style>
