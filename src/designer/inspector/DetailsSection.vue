<script setup lang="ts">
/**
 * The foldable "Angaben" of a block (Plan.md 128): the same section for groups, posts and people – one id, so open or closed
 * stays alike from block to block, always there, even without a choice. Fixed details are switches, open ones a sortable list with
 * "+ Angabe" as its last row (people); the caller puts them into the slot and says "n von m" as `summary`.
 */
import { t } from '../../i18n/designer';
import type { HelpTopic } from '../help/types';
import InspectorSection from '../InspectorSection.vue';

defineProps<{ summary: string; help: HelpTopic }>();
defineSlots<{ default(): unknown }>();
</script>

<template>
    <InspectorSection id="fields" :title="t.inspector.details" :summary="summary" :help="help">
        <slot />
    </InspectorSection>
</template>
