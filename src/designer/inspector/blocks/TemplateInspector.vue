<script setup lang="ts">
/**
 * The template block (schema 1.41, Plan.md 87): where it stands and how often, and the way out – "Lösen" turns it into
 * blocks of the slide's own. Its size is its template's, so there are no further fields; the short menu shows nothing.
 */
import { computed, ref, watch } from 'vue';
import { t } from '../../../i18n/designer';
import type { Block } from '../../../model/schema';
import { useGeneralHelp } from '../../help/register';
import { useBlockEdit } from '../use-block';
import { useInspectorMode } from '../mode';

const props = defineProps<{ block: Extract<Block, { type: 'template' }> }>();
const { editor } = useBlockEdit(() => props.block);
const mode = useInspectorMode();
useGeneralHelp(() => [
    { term: t.templates.edit.start, text: t.templates.editInfo },
    ...(editor.templateLocked(props.block) ? [{ term: t.templates.fixed, text: t.templates.fixedInfo }] : []),
]);

const known = computed(() => editor.templateById.has(props.block.templateId));
/** On how many slides the template stands; null while it is being counted. */
const count = ref<number | null>(null);
watch(
    () => props.block.templateId,
    async (id) => {
        count.value = null;
        const n = await editor.templateSlideCount(id);
        if (props.block.templateId === id) count.value = n;
    },
    { immediate: true },
);
</script>

<template>
    <div v-if="mode === 'full'" class="template-inspector">
        <button class="d-btn d-btn--primary" type="button" :disabled="!known" data-testid="template-edit" @click="editor.startTemplateEdit(block.id)">
            {{ t.templates.edit.start }}
        </button>
        <p v-if="editor.templateLocked(block)" class="hint" data-testid="template-fixed-note">{{ t.templates.fixedTitle }}</p>
        <p v-if="known && count !== null" class="hint" data-testid="template-uses">{{ t.templates.onSlides(count) }}</p>
        <button class="d-btn" type="button" :disabled="!known" data-testid="template-unlink" @click="editor.unlinkTemplate(block.id)">
            {{ t.templates.unlink }}
        </button>
        <p class="hint">{{ t.templates.unlinkHint }}</p>
    </div>
</template>

<style scoped>
.template-inspector {
    display: grid;
    gap: var(--d-space-2);
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
