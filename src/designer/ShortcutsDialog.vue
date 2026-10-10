<script setup lang="ts">
/**
 * The overview of the editor's handles behind the "?" (Plan.md 79, B3), in the style of `ConfirmDialog`: Escape
 * and a click beside it close it, the focus starts on "Schließen" and returns to where it was. A Mac shows ⌘.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from '../i18n/designer';
import { shortcutGroups } from './shortcuts';

// Without `mac` the keyboard decides; Vue would turn a missing boolean into `false`, so say so.
const props = withDefaults(defineProps<{ mac?: boolean }>(), { mac: undefined });
const emit = defineEmits<{ close: [] }>();

const groups = computed(() => shortcutGroups(props.mac));
const closeButton = ref<HTMLButtonElement | null>(null);
let before: HTMLElement | null = null;

onMounted(() => {
    before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.value?.focus();
});
onBeforeUnmount(() => before?.focus());
</script>

<template>
    <div class="d-dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" @click.self="emit('close')">
        <div class="d-dialog shortcuts" data-testid="shortcuts-dialog" @keydown.esc.stop.prevent="emit('close')">
            <h2 id="shortcuts-title">{{ t.shortcuts.title }}</h2>
            <p class="intro">{{ t.shortcuts.intro }}</p>
            <section v-for="group in groups" :key="group.title" class="group">
                <h3>{{ group.title }}</h3>
                <dl>
                    <div v-for="row in group.rows" :key="row.action" class="row">
                        <dt>{{ row.action }}</dt>
                        <dd>
                            <kbd v-for="keys in row.keys" :key="keys">{{ keys }}</kbd>
                        </dd>
                    </div>
                </dl>
            </section>
            <div class="d-dialog-actions">
                <button ref="closeButton" class="d-btn d-btn--primary" type="button" data-testid="shortcuts-close" @click="emit('close')">
                    {{ t.common.close }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.shortcuts {
    width: min(520px, 100%);
}
.intro {
    margin: 0 0 var(--d-space-4);
    color: var(--d-text-muted);
}
.group + .group {
    margin-top: var(--d-space-4);
}
h3 {
    margin: 0 0 var(--d-space-1);
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
    font-weight: var(--d-weight-heading);
}
dl {
    margin: 0;
}
.row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--d-space-4);
    padding: var(--d-space-2) 0;
    border-top: 1px solid var(--d-divider);
}
dt {
    min-width: 0;
}
dd {
    flex: none;
    margin: 0;
}
kbd {
    display: inline-block;
    padding: 2px var(--d-space-2);
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius);
    background: var(--d-panel);
    font: inherit;
    font-size: var(--d-size-sm);
    font-weight: var(--d-weight-normal);
    white-space: nowrap;
}
</style>
