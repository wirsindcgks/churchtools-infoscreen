<script setup lang="ts">
/**
 * "Mit dem Handy steuern" (Plan.md 121): from a tablet up the entry "Steuerung" of the sidebar shows the QR code of the phone page
 * instead of leading there – the song sheet is steered from the phone. Whoever wants it on this device follows the link.
 */
import { onMounted, ref } from 'vue';
import { t } from '../i18n/designer';
import { controlMemory } from '../views/control-memory';
import QrCode from './QrCode.vue';
import { controlUrl } from './player-url';

const emit = defineEmits<{ close: [] }>();

const address = controlUrl();
const addressText = ref<HTMLElement | null>(null);
const copied = ref(false);
const closeButton = ref<HTMLButtonElement | null>(null);
onMounted(() => closeButton.value?.focus());

async function copy(): Promise<void> {
    try {
        await navigator.clipboard.writeText(address);
        copied.value = true;
    } catch {
        // Without clipboard access the address is marked, so that it can be copied by hand.
        const range = document.createRange();
        if (addressText.value) range.selectNodeContents(addressText.value);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    }
}

function openHere(): void {
    controlMemory.designerToo = true;
    emit('close');
}
</script>

<template>
    <div class="d-dialog-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
        <div class="d-dialog control-qr" role="dialog" aria-modal="true" aria-labelledby="control-qr-title" data-testid="control-qr-dialog">
            <h2 id="control-qr-title">{{ t.controlQr.title }}</h2>
            <QrCode :value="address" :size="200" :label="t.controlQr.codeLabel" class="code" />
            <p>{{ t.controlQr.hint }}</p>
            <code ref="addressText" class="url" data-testid="control-qr-address">{{ address }}</code>
            <div class="row">
                <button class="d-btn" type="button" data-testid="control-qr-copy" @click="copy">{{ copied ? t.controlQr.copied : t.controlQr.copy }}</button>
                <RouterLink :to="{ name: 'control' }" data-testid="control-qr-open" @click="openHere">{{ t.controlQr.openHere }}</RouterLink>
            </div>
            <div class="d-dialog-actions">
                <button ref="closeButton" class="d-btn" type="button" data-testid="control-qr-close" @click="emit('close')">{{ t.common.close }}</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.control-qr {
    display: grid;
    justify-items: start;
    gap: 16px;
}
.control-qr h2,
.control-qr p {
    margin: 0;
}
.code {
    justify-self: center;
    border: 1px solid var(--d-divider);
}
.url {
    max-width: 100%;
    overflow-wrap: anywhere;
    user-select: all;
    font-size: var(--d-size-sm);
}
.row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--d-space-3);
}
.d-dialog-actions {
    justify-self: end;
}
</style>
