<script setup lang="ts">
/**
 * The line under the "Fortschritt" switch of a block (Plan.md 105): the presentation has a bar of its own, set in the slide's
 * section "Fortschritt". With the bar off, the line leads there – it lets go of the block and opens the section.
 */
import { t } from '../../i18n/designer';
import { useEditorStore } from '../editor-store';
import { sectionState } from '../section-state';
import { useInspectorMode } from './mode';

const editor = useEditorStore();
const mode = useInspectorMode();

function openSection(): void {
    editor.selectBlock(null);
    sectionState.progress = true;
}
</script>

<template>
    <p v-if="mode === 'full'" class="hint" data-testid="page-progress-hint">
        <template v-if="editor.draft?.playlist.progress">{{ t.inspector.pageProgressHintOn }}</template>
        <template v-else>
            {{ t.inspector.pageProgressHintOff }}<button class="link" type="button" data-testid="page-progress-hint-link" @click="openSection">{{ t.inspector.pageProgressHintLink }}</button>
        </template>
    </p>
</template>

<style scoped>
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.link {
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
}
</style>
