<script setup lang="ts">
import { computed } from 'vue';
import { t } from '../i18n/designer';
import type { Fill } from '../model/schema';
import ColorField from './ColorField.vue';
import SegmentField from './inspector/fields/SegmentField.vue';
import { fillOfKind } from './fill-kind';
import QuickField from './inspector/fields/QuickField.vue';

/** `noKind` leaves out the choice between colour and gradient, where the page offers it itself (the slide's background). */
const props = defineProps<{ modelValue: Fill; noKind?: boolean; quick?: boolean }>();
/** The swatch of the short menu's chip: the colour, or the first colour of a gradient. */
const swatch = computed(() => (props.modelValue.kind === 'solid' ? props.modelValue.color : (props.modelValue.stops[0]?.color ?? '')));
const emit = defineEmits<{ 'update:modelValue': [Fill]; focus: []; blur: [] }>();

function setKind(kind: string): void {
    emit('update:modelValue', fillOfKind(props.modelValue, kind as Fill['kind']));
}

function setStop(index: number, color: string): void {
    if (props.modelValue.kind !== 'linear-gradient') return;
    const stops = props.modelValue.stops.map((s, i) => (i === index ? { ...s, color } : s));
    emit('update:modelValue', { ...props.modelValue, stops });
}
</script>

<template>
    <QuickField :quick="quick" :label="t.common.fill.solid" :swatch="swatch">
        <div class="fill-editor">
            <SegmentField
                v-if="!noKind"
                :model-value="modelValue.kind"
                :options="[
                    { value: 'solid', label: t.common.fill.solid },
                    { value: 'linear-gradient', label: t.common.fill.gradient },
                ]"
                :label="t.common.fill.kind"
                testid="fill-kind"
                @update:model-value="setKind(String($event))"
            />
            <ColorField
                v-if="modelValue.kind === 'solid'"
                quick
                :label="t.common.fill.solid"
                testid="fill-color"
                :model-value="modelValue.color"
                @focus="emit('focus')"
                @blur="emit('blur')"
                @update:model-value="emit('update:modelValue', { kind: 'solid', color: $event })"
            />
            <template v-else>
                <div class="row">
                    <ColorField
                        v-for="(stop, i) in modelValue.stops"
                        :key="i"
                        quick
                        :label="i === 0 ? t.common.fill.from : t.common.fill.to"
                        :testid="`fill-stop-${i}`"
                        :model-value="stop.color"
                        @focus="emit('focus')"
                        @blur="emit('blur')"
                        @update:model-value="setStop(i, $event)"
                    />
                    <label class="d-field">
                        {{ t.common.fill.angle }}
                        <input
                            type="number"
                            min="0"
                            max="360"
                            step="15"
                            :value="modelValue.angle"
                            @focus="emit('focus')"
                            @blur="emit('blur')"
                            @input="
                                emit('update:modelValue', {
                                    ...modelValue,
                                    angle: Number(($event.target as HTMLInputElement).value) || 0,
                                })
                            "
                        >
                    </label>
                </div>
            </template>
        </div>
    </QuickField>
</template>

<style scoped>
.fill-editor {
    display: grid;
    gap: 8px;
}
.row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    align-items: end;
}
/* The angle gets its own line: two colour fields with hex values fill the width. */
.row > :last-child {
    grid-column: 1 / -1;
}
</style>
