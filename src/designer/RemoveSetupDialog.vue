<script setup lang="ts">
/**
 * Confirms „Einrichtung entfernen" (Plan.md, F, 2026-09-28): a plain
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
const canConfirm = computed(() => confirmText.value.trim().toLowerCase() === 'entfernen');

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
            <h2 id="remove-setup-title">Einrichtung entfernen</h2>
            <p>Das wird gelöscht:</p>
            <ul class="groups">
                <li v-for="g in props.groups" :key="g.id">
                    <template v-if="g.name">
                        „{{ g.name }}"<template v-if="g.memberCount !== undefined">
                            – {{ g.memberCount }} {{ g.memberCount === 1 ? 'Mitglied' : 'Mitglieder' }}
                        </template>
                    </template>
                    <template v-else>Gruppe {{ g.id }} (gibt es nicht mehr)</template>
                </li>
            </ul>
            <p v-if="props.wikiCategoryName">
                Gestalter kommen nicht mehr in den Designer. Fernseher, deren Konto in „{{ GROUP_NAMES.device }}" ist,
                bekommen keine neuen Inhalte mehr. Screens, Playlists und Bilder bleiben erhalten; der Wiki-Bereich
                „{{ props.wikiCategoryName }}" mit den Bildern wird wieder im Wiki angezeigt, damit Administratoren
                sie sichern können. Neu einrichten geht jederzeit.
            </p>
            <p v-else>
                Gestalter kommen nicht mehr in den Designer. Fernseher, deren Konto in „{{ GROUP_NAMES.device }}" ist,
                bekommen keine neuen Inhalte mehr. Screens, Playlists und Bilder bleiben erhalten; neu einrichten geht
                jederzeit.
            </p>
            <section
                v-if="props.deviceAccounts.length"
                class="d-banner d-banner--warning device-accounts"
                data-testid="remove-setup-device-accounts"
            >
                <strong>Gerätekonten</strong>
                <ul>
                    <li v-for="a in props.deviceAccounts" :key="a.personId">
                        <a :href="a.url" target="_blank" rel="noopener">{{ a.name }}</a>
                    </li>
                </ul>
                <p>
                    Empfehlung: Ändere danach die Passwörter dieser Konten in ChurchTools oder lösche die Konten. Erst
                    dann funktionieren die Adressen der Fernseher nicht mehr – sie enthalten die Anmeldung dieser
                    Konten. Der Designer kann das nicht selbst tun.
                </p>
            </section>
            <details data-testid="remove-setup-overview">
                <summary>Was beim Abbau sonst passiert und was bleibt</summary>
                <div>
                    <strong>Dieser Schritt</strong>
                    <ul>
                        <li>Die oben genannten Gruppen werden mit Rollen, Rechten und Mitgliedschaften gelöscht.</li>
                        <li>Selbst gewählte Gruppen bleiben unberührt.</li>
                        <li>Screens, Playlists, Slides, Hinweise und Design bleiben.</li>
                        <li v-if="props.wikiCategoryName">
                            Der Wiki-Bereich bleibt und wird wieder im Wiki angezeigt, damit du die Bilder dort sichern
                            kannst.
                        </li>
                        <li v-else>Der Wiki-Bereich bleibt.</li>
                    </ul>
                </div>
                <div>
                    <strong>Danach in der Extension-Verwaltung von ChurchTools – „Infoscreen Designer" löschen</strong>
                    <ul>
                        <li>Screens, Playlists, Slides, Hinweise, Design und Einstellungen werden gelöscht.</li>
                        <li>Die Rechte am Modul werden an allen Rollen entfernt, auch an der Administratoren-Gruppe.</li>
                        <li>Das hochgeladene ZIP wird gelöscht.</li>
                        <li>Eine Neuinstallation beginnt leer.</li>
                    </ul>
                </div>
                <div>
                    <strong>Bleibt, von Hand zu erledigen</strong>
                    <ul>
                        <li>
                            Der Wiki-Bereich mit den Bildern: sichern, dann im Wiki löschen oder behalten. Die
                            Adressen der Bilder bleiben ohne Anmeldung erreichbar, bis das Bild gelöscht ist.
                        </li>
                        <li>
                            Der Geräte-Benutzer: Passwort ändern (empfohlen) oder die Person löschen – sein
                            Login-Token steckt in den Adressen der Fernseher und gilt bis dahin weiter. Archivieren
                            kannst du ihn danach.
                        </li>
                        <li>Die Kiosk-Browser der Fernseher: umstellen oder ausschalten.</li>
                    </ul>
                </div>
                <p>
                    <a
                        :href="`${REPOSITORY_URL}/blob/main/docs/Einrichtung.md#was-beim-abbau-passiert--auf-einen-blick`"
                        target="_blank"
                        rel="noopener"
                    >Ausführlich in der Anleitung</a>
                </p>
            </details>
            <p v-if="props.ownMemberOf.length" class="d-banner d-banner--warning" data-testid="remove-setup-own-warning">
                Du bist selbst Mitglied in {{ props.ownMemberOf.map((n) => `„${n}"`).join(' und ') }}. Hast du die Rechte
                am Designer nur über diese Gruppe, kommst du danach nicht mehr hinein – prüfe vorher Schritt 2 der
                Einrichtung.
            </p>
            <label class="d-field">
                Zum Bestätigen <strong>entfernen</strong> eintippen
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
                <button class="d-btn" type="button" @click="emit('close')">Abbrechen</button>
                <button class="d-btn d-btn--danger" type="submit" :disabled="!canConfirm" data-testid="remove-setup-confirm">
                    Einrichtung entfernen
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
