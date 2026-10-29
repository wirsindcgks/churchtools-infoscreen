<script setup lang="ts">
/** The foot of a notice's tile: when and by whom it was last edited – the same on a running and an expired notice. */
import type { LastEdited } from './last-edited';
import Icon from './Icon.vue';
import { vTip } from './tip';

defineProps<{ edited: LastEdited }>();
</script>

<template>
    <ul class="d-facts">
        <li v-if="edited.when" v-tip="edited.whenTitle!" data-testid="notice-edited-at">
            <Icon name="clock" :size="16" />
            <span>{{ edited.when }}</span>
        </li>
        <li v-if="edited.by" v-tip="edited.byTitle!" data-testid="notice-edited-by">
            <Icon name="person" :size="16" />
            <span>{{ edited.by }}</span>
        </li>
    </ul>
</template>
