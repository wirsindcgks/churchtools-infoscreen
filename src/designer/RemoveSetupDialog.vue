<script setup lang="ts">
/**
 * Confirms „Automatische Einrichtung rückgängig machen" (Plan.md, F, 2026-09-28): a plain
 * `window.confirm` was too easy to click away without reading. The dialog
 * names exactly what disappears and asks for the word „entfernen" typed out,
 * so the click that deletes two groups is never an accident.
 *
 * It only asks – the actual deletion happens on the page once it emits
 * `confirm`, and closes right away: the page's assistant card is the one
 * place that already shows progress and errors for every assistant action,
 * and duplicating that inside a dialog that is about to vanish would only
 * split the story in two.
 */
import { computed, onMounted, ref } from 'vue';
import { REPOSITORY_URL } from '../about/changelog';
import { t } from '../i18n/designer';
import { GROUP_NAMES } from '../setup/provision';

export interface RemoveGroupInfo {
    id: number;
    /** `null`: the group is gone already – nothing left to show but its id. */
    name: string | null;
    /** Unknown unless the page happened to load this group's members already. */
    memberCount?: number;
}

/**
 * A device account named before its group is deleted (Plan.md, F; G18): its
 * login token cannot be revoked, only invalidated by changing the account's
 * password – and once the group is gone, nobody would know anymore which
 * accounts were devices.
 */
export interface DeviceAccountInfo {
    personId: number;
    name: string;
    /** Where to see and change the account in ChurchTools. */
    url: string;
}

const props = withDefaults(
    defineProps<{
        groups: RemoveGroupInfo[];
        ownMemberOf?: string[];
        wikiCategoryName?: string | null;
        deviceAccounts?: DeviceAccountInfo[];
    }>(),
    { ownMemberOf: () => [], wikiCategoryName: null, deviceAccounts: () => [] },
);
const emit = defineEmits<{ close: []; confirm: [] }>();

const confirmText = ref('');
const confirmInput = ref<HTMLInputElement | null>(null);
const canConfirm = computed(() => confirmText.value.trim().toLowerCase() === t.setup.remove.confirmWord);

onMounted(() => confirmInput.value?.focus());

function confirm(): void {
    if (!canConfirm.value) return;
    emit('confirm');
}
</script>

<template>
    <div class="d-dialog-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
        <form
            class="d-dialog remove"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-setup-title"
            data-testid="remove-setup-dialog"
            @submit.prevent="confirm"
        >
            <h2 id="remove-setup-title">{{ t.setup.remove.title }}</h2>
            <p>{{ t.setup.remove.willBeDeleted }}</p>
            <ul class="groups">
                <li v-for="g in props.groups" :key="g.id">
                    <template v-if="g.name">
                        „{{ g.name }}"<template v-if="g.memberCount !== undefined">
                            – {{ g.memberCount }} {{ t.setup.remove.member(g.memberCount) }}
                        </template>
                    </template>
                    <template v-else>{{ t.setup.remove.groupGone(g.id) }}</template>
                </li>
            </ul>
            <p>{{ t.setup.remove.consequences(GROUP_NAMES.device, props.wikiCategoryName || null) }}</p>
            <section
                v-if="props.deviceAccounts.length"
                class="d-banner d-banner--warning device-accounts"
                data-testid="remove-setup-device-accounts"
            >
                <strong>{{ t.setup.remove.deviceAccounts }}</strong>
                <ul>
                    <li v-for="a in props.deviceAccounts" :key="a.personId">
                        <a :href="a.url" target="_blank" rel="noopener">{{ a.name }}</a>
                    </li>
                </ul>
                <p>{{ t.setup.remove.deviceAccountsAdvice }}</p>
            </section>
            <details data-testid="remove-setup-overview">
                <summary>{{ t.setup.remove.overview }}</summary>
                <div>
                    <strong>{{ t.setup.remove.thisStep }}</strong>
                    <ul>
                        <li>{{ t.setup.remove.groupsDeleted }}</li>
                        <li>{{ t.setup.remove.ownGroupsStay }}</li>
                        <li>{{ t.setup.remove.dataStays }}</li>
                        <li v-if="props.wikiCategoryName">{{ t.setup.remove.wikiStaysShown }}</li>
                        <li v-else>{{ t.setup.remove.wikiStays }}</li>
                    </ul>
                </div>
                <div>
                    <strong>{{ t.setup.remove.afterwards }}</strong>
                    <ul>
                        <li>{{ t.setup.remove.extensionDeletes }}</li>
                        <li>{{ t.setup.remove.moduleRights }}</li>
                        <li>{{ t.setup.remove.zipDeleted }}</li>
                        <li>{{ t.setup.remove.freshStart }}</li>
                    </ul>
                </div>
                <div>
                    <strong>{{ t.setup.remove.byHand }}</strong>
                    <ul>
                        <li>{{ t.setup.remove.wikiByHand }}</li>
                        <li>{{ t.setup.remove.deviceByHand }}</li>
                        <li>{{ t.setup.remove.kioskByHand }}</li>
                    </ul>
                </div>
                <p>
                    <a
                        :href="`${REPOSITORY_URL}/blob/main/docs/Einrichtung.md#was-beim-abbau-passiert--auf-einen-blick`"
                        target="_blank"
                        rel="noopener"
                    >{{ t.setup.remove.guide }}</a>
                </p>
            </details>
            <p v-if="props.ownMemberOf.length" class="d-banner d-banner--warning" data-testid="remove-setup-own-warning">
                {{ t.setup.remove.ownWarning(props.ownMemberOf.map((n) => `„${n}"`).join(' und ')) }}
            </p>
            <label class="d-field">
                {{ t.setup.remove.confirmBefore }} <strong>{{ t.setup.remove.confirmWord }}</strong> {{ t.setup.remove.confirmAfter }}
                <input
                    ref="confirmInput"
                    v-model="confirmText"
                    type="text"
                    autocomplete="off"
                    autocapitalize="off"
                    spellcheck="false"
                    data-testid="remove-setup-confirm-input"
                >
            </label>
            <div class="d-dialog-actions">
                <button class="d-btn" type="button" @click="emit('close')">{{ t.common.cancel }}</button>
                <button class="d-btn d-btn--danger" type="submit" :disabled="!canConfirm" data-testid="remove-setup-confirm">
                    {{ t.setup.remove.title }}
                </button>
            </div>
        </form>
    </div>
</template>

<style scoped>
.remove {
    display: grid;
    gap: 16px;
}
.remove h2 {
    margin-bottom: 0;
}
.remove p {
    margin: 0;
}
.groups {
    margin: 0;
    padding-left: 20px;
}
.device-accounts {
    display: grid;
    gap: 6px;
}
.device-accounts ul {
    margin: 0;
    padding-left: 20px;
}
.remove details {
    font-size: 0.95em;
}
.remove details > div + div {
    margin-top: 10px;
}
.remove details ul {
    margin: 4px 0 0;
    padding-left: 20px;
}
</style>
