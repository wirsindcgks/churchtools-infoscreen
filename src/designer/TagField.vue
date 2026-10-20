<script setup lang="ts">
/**
 * The appointment tags a block hides (Plan.md 82 C): a foldable list of the tags of ChurchTools as switches, each with a dot in
 * its colour. A chosen tag that no longer exists stays below as "Tag gelöscht", to be taken away. Not in the short menu.
 */
import { computed } from 'vue';
import { t } from '../i18n/designer';
import type { AppointmentTag } from '../ct/api';
import { calendarColor } from '../player/format';
import InspectorSection from './InspectorSection.vue';
import { HIDE_TAGS_MAX } from './inspector/tag-choice';
import QuickField from './inspector/fields/QuickField.vue';
import ToggleField from './inspector/fields/ToggleField.vue';

const props = defineProps<{ tags: AppointmentTag[]; chosenIds: number[] }>();
const emit = defineEmits<{ toggle: [id: number, on: boolean] }>();

/** The neutral grey of a tag whose colour has no counterpart here. */
const FALLBACK_COLOR = '#9ca3af';

const gone = computed(() => props.chosenIds.filter((id) => !props.tags.some((tag) => tag.id === id)));
const chosenCount = computed(() => props.chosenIds.length);
const summary = computed(() => (chosenCount.value ? t.common.countOf(chosenCount.value, props.tags.length + gone.value.length) : t.inspector.hideTagsNone));
</script>

<template>
    <QuickField :label="t.inspector.hideTagsTitle">
        <InspectorSection v-if="tags.length || gone.length" id="hide-tags" :title="t.inspector.hideTagsTitle" :summary="summary" :help="{ intro: t.inspector.hideTagsInfo }">
            <div class="list" data-testid="hide-tags">
                <ToggleField
                    v-for="tag in tags"
                    :key="tag.id"
                    :model-value="chosenIds.includes(tag.id)"
                    :label="tag.name"
                    :disabled="!chosenIds.includes(tag.id) && chosenCount >= HIDE_TAGS_MAX"
                    :testid="`hide-tag-${tag.id}`"
                    @update:model-value="emit('toggle', tag.id, $event)"
                >
                    <template #before><span class="swatch" :style="{ background: calendarColor(tag.color) ?? FALLBACK_COLOR }" /></template>
                </ToggleField>
            </div>
        </InspectorSection>
        <p v-if="!tags.length && !gone.length" class="hint" data-testid="hide-tags-none">{{ t.inspector.hideTagsEmpty }}</p>
        <p v-for="id in gone" :key="id" class="hint gone" :data-testid="`hide-tag-gone-${id}`">
            {{ t.inspector.hideTagGone }}
            <button class="d-btn" type="button" @click="emit('toggle', id, false)">
                {{ t.common.remove }}
            </button>
        </p>
    </QuickField>
</template>

<style scoped>
.list {
    display: grid;
    gap: 8px;
}
.swatch {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid var(--d-divider);
}
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
.gone {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
</style>
