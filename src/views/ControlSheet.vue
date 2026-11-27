<script setup lang="ts">
/**
 * A sheet from below on the phone page (Plan.md 135 D): lies over the page, which does not scroll behind it. It closes with "Abbrechen", with
 * a tap beside it and with Escape. "Probe starten" and the search of a song use it. The page itself lies fixed, so the sheet needs no
 * `Teleport` – it covers the same window.
 */
import { onBeforeUnmount, onMounted, ref, useId, useTemplateRef } from 'vue';
import Icon, { type IconName } from '../designer/Icon.vue';
import { t } from '../i18n/designer';

/** `icon`: a symbol before the title – the TV where the sheet is about a screen. */
defineProps<{ title: string; icon?: IconName }>();
const emit = defineEmits<{ close: [] }>();

const titleId = useId();
const panel = useTemplateRef<HTMLElement>('panel');

function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') emit('close');
}

/**
 * The visible part of the window: with the keyboard open, iOS shifts and shrinks it, and a sheet fixed to the bottom of the whole window
 * slid behind the keyboard while the page above moved out of sight (user, 2026-11-27, search of a song). The backdrop follows it, so the
 * sheet sits on the keyboard.
 */
const visible = ref<{ top: string; height: string } | null>(null);
function follow(): void {
    const view = window.visualViewport;
    visible.value = view ? { top: `${view.offsetTop}px`, height: `${view.height}px` } : null;
}

onMounted(() => {
    document.addEventListener('keydown', onKey);
    follow();
    window.visualViewport?.addEventListener('resize', follow);
    window.visualViewport?.addEventListener('scroll', follow);
    // Where nothing in the sheet asks for the focus (the search field does), the sheet takes it.
    if (!panel.value?.contains(document.activeElement)) panel.value?.focus({ preventScroll: true });
});
onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKey);
    window.visualViewport?.removeEventListener('resize', follow);
    window.visualViewport?.removeEventListener('scroll', follow);
});
</script>

<template>
    <div class="backdrop" :style="visible ? { ...visible, bottom: 'auto' } : undefined" data-testid="control-sheet-backdrop" @click.self="emit('close')">
        <section ref="panel" class="sheet" role="dialog" aria-modal="true" :aria-labelledby="titleId" tabindex="-1" data-testid="control-sheet">
            <h2 :id="titleId" class="sheet-title"><Icon v-if="icon" :name="icon" :size="22" class="sheet-icon" />{{ title }}</h2>
            <div class="sheet-body">
                <slot />
            </div>
            <div class="sheet-foot">
                <slot name="foot" />
                <button type="button" class="cancel" data-testid="control-sheet-cancel" @click="emit('close')">{{ t.control.sheetCancel }}</button>
            </div>
        </section>
    </div>
</template>

<style scoped>
/* Above the page (2000) and the dialogs of ChurchTools (1100). */
.backdrop {
    position: fixed;
    inset: 0;
    z-index: 2100;
    display: flex;
    align-items: flex-end;
    background: rgb(0 0 0 / 0.6);
    overscroll-behavior: contain;
    touch-action: none;
}
.sheet {
    box-sizing: border-box;
    width: 100%;
    max-height: 92%;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
    border-top: 1px solid #3a3f4a;
    border-radius: 16px 16px 0 0;
    background: #1d2027;
    color: #f2f2f2;
    font-size: 1.1rem;
    touch-action: auto;
}
.sheet:focus {
    outline: none;
}
.sheet-title {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-size: 1.3rem;
    line-height: 1.25;
    color: #f2f2f2;
    overflow-wrap: anywhere;
}
/* Only the body rolls – the title and the buttons stay. */
.sheet-body {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: grid;
    gap: 14px;
}
.sheet-foot {
    flex: none;
    display: grid;
    gap: 8px;
}
.cancel {
    min-height: 48px;
    border: 0;
    background: none;
    color: #b8bcc4;
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
}
.sheet-icon {
    flex: none;
    color: #b8bcc4;
}
</style>
