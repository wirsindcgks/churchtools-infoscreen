<script setup lang="ts">
/**
 * The "?" in the head of the inspector (Plan.md 98), beside the name of the block or the slide: it opens the help bar on
 * "Allgemein" if that has entries, else on the first section; a second click closes. Only there when some topic is announced.
 */
import { t } from '../i18n/designer';
import HelpButton from './HelpButton.vue';
import { useHelp } from './help/register';

const help = useHelp();
</script>

<template>
    <HelpButton
        v-if="help && help.sections.value.length"
        :label="t.help.aboutSubject(help.subject.value)"
        :shown="help.startShown.value"
        data-testid="inspector-help"
        @toggle="help.toggleStart()"
    />
</template>
