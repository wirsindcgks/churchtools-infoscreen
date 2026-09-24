<script setup lang="ts">
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { onMounted, reactive, ref } from 'vue';
import { fetchCalendars, type Calendar } from '../ct/api';
import { httpStatus } from '../ct/client';
import { WIKI_CATEGORY_NAME, type WikiCategory } from '../media/wiki';
import { SCHEMA_VERSION } from '../model/schema';
import { checkDesignerGroup, checkDeviceGroup, type Check } from '../setup/checks';
import { loadGroupRights, loadGroups, loadPersonGrants, type GroupSummary } from '../setup/load';
import { getRepository } from '../store/backend';
import type { ScreenRepository } from '../store/screen-repository';

type Side = 'designer' | 'device';

const groups = ref<GroupSummary[]>([]);
const selected = reactive<Record<Side, number | null>>({ designer: null, device: null });
const checks = reactive<Record<Side, Check[] | null>>({ designer: null, device: null });
const busy = reactive<Record<Side, boolean>>({ designer: false, device: false });
const error = ref<string | null>(null);
const saveState = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle');

let repository: ScreenRepository | null = null;
let wikiCategoryId: number | null = null;
let calendars: Calendar[] = [];
let usedCalendarIds: number[] = [];

function explain(e: unknown): string {
    if (httpStatus(e) === 403) {
        return 'Rechte anderer lesen darf nur, wer in ChurchTools Berechtigungen verwalten darf. Diese Seite ist für Administratoren.';
    }
    return e instanceof Error ? e.message : String(e);
}

async function check(side: Side): Promise<void> {
    const groupId = selected[side];
    checks[side] = null;
    if (groupId === null) return;
    busy[side] = true;
    try {
        const rights = await loadGroupRights(groupId);
        if (side === 'designer') {
            checks.designer = checkDesignerGroup({ statusId: rights.group.statusId, roles: rights.roles, wikiCategoryId });
        } else {
            const members = await Promise.all(
                rights.members.map(async (m) => {
                    const person = await loadPersonGrants(m.personId);
                    return { label: person.label, grants: [...m.roleGrants, ...person.grants] };
                }),
            );
            checks.device = checkDeviceGroup({
                statusId: rights.group.statusId,
                members,
                calendars,
                usedCalendarIds,
                wikiCategoryId,
            });
        }
        if (selected.designer !== null && selected.designer === selected.device) {
            checks[side]!.unshift({
                level: 'warn',
                text: 'Gestalter und Geräte sind dieselbe Gruppe.',
                detail: 'Dann bekommen die Geräte die Rechte der Gestalter – mehr, als ein unbeaufsichtigtes Gerät haben sollte.',
            });
        }
    } catch (e) {
        checks[side] = [{ level: 'fail', text: 'Prüfen nicht möglich.', detail: explain(e) }];
    } finally {
        busy[side] = false;
    }
}

function choose(side: Side, value: string): void {
    selected[side] = value ? Number(value) : null;
    saveState.value = 'idle';
    void check(side);
}

async function save(): Promise<void> {
    if (!repository) return;
    saveState.value = 'saving';
    try {
        await repository.saveSettings({
            schema: { ...SCHEMA_VERSION },
            designerGroupId: selected.designer ?? undefined,
            deviceGroupId: selected.device ?? undefined,
        });
        saveState.value = 'saved';
    } catch (e) {
        saveState.value = 'failed';
        error.value = explain(e);
    }
}

onMounted(async () => {
    try {
        ({ repository } = await getRepository());
        const [list, settings, wikiCategories, calendarList, used] = await Promise.all([
            loadGroups(),
            repository.loadSettings(),
            churchtoolsClient.get<WikiCategory[]>('/wiki/categories'),
            fetchCalendars(),
            repository.calendarIdsInUse(),
        ]);
        groups.value = list;
        wikiCategoryId = wikiCategories.find((c) => c.name === WIKI_CATEGORY_NAME)?.id ?? null;
        calendars = calendarList;
        usedCalendarIds = used;
        selected.designer = settings?.designerGroupId ?? null;
        selected.device = settings?.deviceGroupId ?? null;
        await Promise.all([check('designer'), check('device')]);
    } catch (e) {
        error.value = explain(e);
    }
});

const SYMBOL = { ok: '✓', warn: '!', fail: '✗', info: 'i' } as const;
const SIDES: { side: Side; title: string; purpose: string }[] = [
    {
        side: 'designer',
        title: 'Gestalter',
        purpose: 'Wer Infoscreens gestaltet. Die Gruppe braucht die Rechte am Modul und am Wiki-Bereich „Infoscreen" für die Mediathek.',
    },
    {
        side: 'device',
        title: 'Geräte',
        purpose: 'Die Konten, mit denen sich die Fernseher anmelden. Sie brauchen nur Leserechte auf die Kalender ihrer Screens – sonst nichts.',
    },
];
</script>

<template>
    <main class="infoscreen-designer setup">
        <RouterLink class="d-link back" :to="{ name: 'designer' }">← Screens</RouterLink>
        <h1>Einrichtung</h1>
        <p class="lead">
            Rechte vergibt ChurchTools an Rollen in Gruppen. Wähle je eine Gruppe für die Gestalter und für die Geräte –
            diese Seite prüft, ob ihre Rechte reichen, und sagt, was fehlt. Sie ändert selbst keine Rechte.
        </p>
        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <div class="sides">
            <section v-for="{ side, title, purpose } in SIDES" :key="side" class="card" :data-testid="`setup-${side}`">
                <h2>{{ title }}</h2>
                <p class="muted">{{ purpose }}</p>
                <label class="d-field">
                    Gruppe
                    <select
                        :value="selected[side] ?? ''"
                        :data-testid="`group-${side}`"
                        @change="choose(side, ($event.target as HTMLSelectElement).value)"
                    >
                        <option value="">– keine gewählt –</option>
                        <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
                    </select>
                </label>
                <p v-if="!groups.length && !error" class="muted">Lade Gruppen …</p>
                <p class="muted small">
                    Keine passende Gruppe? In ChurchTools unter „Gruppen" eine anlegen, auf „aktiv" stellen und hier wählen.
                </p>

                <p v-if="busy[side]" class="muted">Prüfe …</p>
                <ul v-else-if="checks[side]" class="checks">
                    <li v-for="(c, i) in checks[side]" :key="i" :class="`check--${c.level}`">
                        <span class="symbol" aria-hidden="true">{{ SYMBOL[c.level] }}</span>
                        <span>
                            {{ c.text }}
                            <small v-if="c.detail" class="muted">{{ c.detail }}</small>
                        </span>
                    </li>
                </ul>
            </section>
        </div>

        <div class="actions">
            <button class="d-btn d-btn--primary" type="button" data-testid="save-setup" @click="save">Auswahl speichern</button>
            <span v-if="saveState === 'saved'" class="muted" data-testid="setup-saved">Gespeichert.</span>
            <span v-else-if="saveState === 'saving'" class="muted">Speichert …</span>
        </div>
        <p class="muted small">
            Geprüft werden die Rechte der Gruppenrollen und ihrer Gruppentyp-Rollen, bei Geräten dazu Personenstatus und
            direkt vergebene Rechte. Rechte aus anderen Gruppen zählen nicht mit.
        </p>
    </main>
</template>

<style scoped>
.setup {
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px 16px 48px;
}
.back {
    color: var(--d-accent-strong);
}
h1 {
    margin: 8px 0 4px;
}
.lead {
    max-width: 70ch;
}
.sides {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px;
    margin-top: 16px;
}
.card {
    display: grid;
    align-content: start;
    gap: 10px;
    padding: 16px;
    border: 1px solid var(--d-divider);
    border-radius: var(--d-radius-lg);
    background: var(--d-panel);
}
.card h2 {
    margin: 0;
    font-size: 1.15em;
}
.card p {
    margin: 0;
}
.checks {
    display: grid;
    gap: 8px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
}
.checks li {
    display: grid;
    grid-template-columns: 22px 1fr;
    gap: 6px;
    align-items: start;
}
.checks small {
    display: block;
}
.symbol {
    display: inline-grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
}
.check--ok .symbol {
    background: var(--d-success);
}
.check--warn .symbol {
    background: var(--d-warning);
}
.check--fail .symbol {
    background: var(--d-danger);
}
.check--info .symbol {
    background: var(--d-text-muted);
}
.actions {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 0 8px;
}
.muted {
    color: var(--d-text-muted);
}
.small {
    font-size: var(--d-size-sm);
}
.error {
    color: var(--d-danger);
}
</style>
