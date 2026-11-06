<script setup lang="ts">
/**
 * The people block (Plan.md 112): the people of a group as cards or, since 1.55, as a list – "Infoscreen-People" or a group an administrator released
 * (Stück 2a); the choice stands first. The roles have a section; what stands under the name – the role, member fields and
 * released person fields – is one list "Angaben" in its order (schema 1.56, Plan.md 114 B); look and page time stand in "Darstellung".
 */
import { computed, nextTick } from 'vue';
import { t } from '../../../i18n/designer';
import { th } from '../../../i18n/help';
import { DEFAULT_NAME_FORMAT, entriesPatch, groupOfBlock, memberEntry, peopleEntries, personEntry, rightEntries, ROLE_ENTRY } from '../../../groups/members';
import type { Block } from '../../../model/schema';
import { useStageContext } from '../../../player/context';
import { PEOPLE_SECONDS } from '../../../player/paging';
import PageProgressHint from '../PageProgressHint.vue';
import PageProgressOptions from '../PageProgressOptions.vue';
import PageProgressToggle from '../PageProgressToggle.vue';
import InspectorSection from '../../InspectorSection.vue';
import SelectMenu, { type SelectOption } from '../../SelectMenu.vue';
import SelectField from '../fields/SelectField.vue';
import QuickField from '../fields/QuickField.vue';
import NumberField from '../fields/NumberField.vue';
import SegmentField from '../fields/SegmentField.vue';
import TextField from '../fields/TextField.vue';
import SortList, { type SortItem } from '../fields/SortList.vue';
import ToggleField from '../fields/ToggleField.vue';
import TileField from '../fields/TileField.vue';
import FontSection from '../FontSection.vue';
import Icon from '../../Icon.vue';
import { vTip } from '../../tip';
import { move as moveItem } from '../../ops';
import { PEOPLE_TILES } from '../layouts';
import { useBlockEdit } from '../use-block';
import { useInspectorMode } from '../mode';

/** Most member fields a card shows – the schema's limit. */
const FIELDS_MAX = 8;

const props = defineProps<{ block: Extract<Block, { type: 'people' }> }>();
/** Only fields stand in the short menu; a hint or a line of text belongs to the inspector. */
const mode = useInspectorMode();
const { setBlock } = useBlockEdit(() => props.block);
/** The preview's stage context: roles and fields come from the live members of the group. */
const stage = useStageContext();

/** The block's group: `undefined` until the preview has it, `null` where there is no such group ("Infoscreen-People" only exists on request). */
const group = computed(() => groupOfBlock(stage.people, props.block.sourceGroupId));
const roles = computed(() => group.value?.roles ?? []);
const fields = computed(() => group.value?.fields ?? []);
/** Whether the preview has the group yet – until then a chosen field is not "gone", only not loaded. */
const loaded = computed(() => !!group.value && !group.value.denied);

// --- group: "Infoscreen-People" or a released one; roles and fields belong to the group, so a change clears them ---

const STANDARD = 'standard';
const standardChoice = computed(() => stage.peopleChoices?.find((c) => c.standard));
const groupOptions = computed<SelectOption[]>(() => {
    // „Infoscreen-People" is offered only where it exists (or until the choices are known).
    const options: SelectOption[] = [];
    if (standardChoice.value || stage.peopleChoices === undefined) options.push({ value: STANDARD, label: standardChoice.value?.name ?? t.inspector.peopleStandardGroup });
    for (const c of stage.peopleChoices ?? []) if (!c.standard) options.push({ value: c.id, label: c.name });
    const own = props.block.sourceGroupId;
    if (own !== undefined && own !== standardChoice.value?.id && !options.some((o) => o.value === own)) {
        options.push({ value: own, label: t.inspector.peopleGroupGone(own) });
    }
    return options;
});
const groupValue = computed(() => {
    const own = props.block.sourceGroupId;
    if (own === undefined) return standardChoice.value || stage.peopleChoices === undefined ? STANDARD : undefined;
    return own === standardChoice.value?.id ? STANDARD : own;
});
function setGroup(value: string | number): void {
    const next = value === STANDARD ? undefined : Number(value);
    if (next === (groupValue.value === STANDARD ? undefined : props.block.sourceGroupId)) return;
    // The member fields belong to the group; the role and the person fields stay.
    const kept = keys.value.filter((key) => !key.startsWith('member:'));
    setBlock({ sourceGroupId: next, roleIds: [], ...entriesPatch(kept, right.value.filter((key) => kept.includes(key))) });
}
const groupSummary = computed(() => groupOptions.value.find((o) => o.value === groupValue.value)?.label ?? t.inspector.peopleChooseGroup);

const sorts = [
    { value: 'last-name', label: t.inspector.peopleSortLastName },
    { value: 'first-name', label: t.inspector.peopleSortFirstName },
    { value: 'role', label: t.inspector.peopleSortRole },
];
const shapes = [
    { value: 'circle', label: t.inspector.imageShapeCircle },
    { value: 'square', label: t.inspector.imageShapeSquare },
];
const columns = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }));

// --- roles: none chosen = every role ---

function toggleAllRoles(all: boolean): void {
    setBlock({ roleIds: all ? [] : roles.value.map((r) => r.id) });
}
function toggleRole(id: number, on: boolean): void {
    setBlock({ roleIds: on ? [...props.block.roleIds, id] : props.block.roleIds.filter((r) => r !== id) });
}
const rolesSummary = computed(() => (props.block.roleIds.length ? t.common.countOf(props.block.roleIds.length, roles.value.length) : t.inspector.all));

// --- entries (schema 1.56): role, member fields and released person fields in one order; a block from before derives it ---

/** The entries by key (`role`, `member:<id>`, `person:<key>`) – a block from before holds names, mapped here; edits write the ids. */
const keys = computed(() => peopleEntries(props.block, fields.value));
/** The entries pinned to the right (schema 1.57). */
const right = computed(() => rightEntries(props.block, fields.value));
const memberCount = computed(() => keys.value.filter((key) => key.startsWith('member:')).length);
const released = computed(() => stage.releasedPersonFields ?? []);
// The birthday keeps its own name: it says that only day and month show.
const personName = (key: string): string => (key === 'birthday' ? undefined : stage.personFieldNames?.[key]) ?? t.inspector.personFieldNames[key] ?? key;

const chosen = computed<SortItem[]>(() =>
    keys.value.map((key) => {
        if (key === ROLE_ENTRY) return { key, label: t.inspector.peopleRoleEntry };
        if (key.startsWith('person:')) {
            const name = personName(key.slice(7));
            const gone = !(released.value as readonly string[]).includes(key.slice(7));
            return { key, label: gone ? `${name} – ${t.inspector.personFieldGone}` : name, dimmed: gone };
        }
        const id = key.slice(7);
        const name = fields.value.find((f) => f.key === id)?.name;
        return { key, label: name ?? (loaded.value ? `${id} – ${t.inspector.peopleFieldGone}` : id), dimmed: loaded.value && name === undefined };
    }),
);
/** What is left to pick, by group: the role, the member fields (at most `FIELDS_MAX`), the released person fields. */
const pickable = computed<SelectOption[]>(() => {
    const g = t.inspector.peopleEntryGroups;
    const options: SelectOption[] = [];
    if (!keys.value.includes(ROLE_ENTRY)) options.push({ value: ROLE_ENTRY, label: t.inspector.peopleRoleEntry, group: g.group });
    if (memberCount.value < FIELDS_MAX) {
        for (const f of fields.value) if (!keys.value.includes(memberEntry(f.key))) options.push({ value: memberEntry(f.key), label: f.name, group: g.member });
    }
    for (const key of released.value) {
        if (!keys.value.includes(personEntry(key))) options.push({ value: personEntry(key), label: personName(key), group: g.person });
    }
    return options;
});
/** Everything there is to choose, for "n von m". */
const available = computed(() => 1 + fields.value.length + released.value.length);
function setEntries(next: string[], pinned: readonly string[] = right.value): void {
    setBlock(entriesPatch(next, pinned.filter((key) => next.includes(key))));
}
function togglePin(key: string): void {
    setEntries(keys.value, right.value.includes(key) ? right.value.filter((k) => k !== key) : [...right.value, key]);
}
function addEntry(key: string | number): void {
    setEntries([...keys.value, String(key)]);
}
function removeEntry(index: number): void {
    setEntries(keys.value.filter((_, i) => i !== index));
}
function moveEntry(from: number, to: number): void {
    if (to < 0 || to >= keys.value.length) return;
    setEntries(moveItem(keys.value, from, to));
}
// --- the name from fields (schema 1.60, Plan.md 115 B): a pattern with placeholders, a quick choice, "insert field" ---

const NAME_INPUT_ID = 'people-name-format';
const nameFormat = computed(() => props.block.nameFormat ?? DEFAULT_NAME_FORMAT);
const nameLabel = (key: string): string => (key === 'firstName' ? t.inspector.peopleNameFirst : key === 'lastName' ? t.inspector.peopleNameLast : personName(key));
/** The pattern as words: the placeholders replaced by the field names. */
const nameSummary = computed(() => nameFormat.value.replace(/\{([A-Za-z0-9_]{1,64})\}/g, (_, key: string) => nameLabel(key)));
const namePresets = computed<SelectOption[]>(() => {
    const nick = personName('nickname');
    return [
        { value: DEFAULT_NAME_FORMAT, label: `${nameLabel('firstName')} ${nameLabel('lastName')}` },
        ...(released.value.includes('nickname')
            ? [
                  { value: '{nickname} ({firstName}) {lastName}', label: `${nick} (${nameLabel('firstName')}) ${nameLabel('lastName')}` },
                  { value: '{firstName} ({nickname}) {lastName}', label: `${nameLabel('firstName')} (${nick}) ${nameLabel('lastName')}` },
              ]
            : []),
    ];
});
const namePresetValue = computed(() => namePresets.value.find((o) => o.value === nameFormat.value)?.value);
const nameInsertOptions = computed<SelectOption[]>(() => [
    { value: 'firstName', label: nameLabel('firstName') },
    { value: 'lastName', label: nameLabel('lastName') },
    ...released.value.map((key) => ({ value: key, label: personName(key) })),
]);
function setNameFormat(value: string): void {
    setBlock({ nameFormat: value === DEFAULT_NAME_FORMAT ? undefined : value });
}
/** Puts `{key}` where the cursor stands (replacing a selection), or at the end where the field was never focused. */
function insertPlaceholder(key: string | number): void {
    const input = document.getElementById(NAME_INPUT_ID) as HTMLInputElement | null;
    const text = nameFormat.value;
    const start = Math.min(input?.selectionStart ?? text.length, text.length);
    const end = Math.min(input?.selectionEnd ?? start, text.length);
    const insert = `{${key}}`;
    setNameFormat(`${text.slice(0, start)}${insert}${text.slice(end)}`.slice(0, 200));
    void nextTick(() => {
        input?.focus();
        input?.setSelectionRange(start + insert.length, start + insert.length);
    });
}
const entriesSummary = computed(() => t.common.countOf(keys.value.length, Math.max(available.value, keys.value.length)));
const entriesFace = computed(() => (keys.value.length ? t.quick.listFace(t.inspector.peopleFields, entriesSummary.value) : t.quick.empty.people));

const summary = computed(() =>
    [
        PEOPLE_TILES.find((o) => o.value === props.block.layout)?.label,
        sorts.find((o) => o.value === props.block.sort)?.label,
        props.block.layout === 'card' ? `${props.block.columns} × ${props.block.rows}` : undefined,
    ]
        .filter(Boolean)
        .join(' · '),
);
const appearanceHelp = computed(() => ({
    intro: th.people.intro,
    items: [th.people.layout, th.people.sort, th.people.picture, th.people.imageShape, th.people.grid, th.people.seconds, th.pageProgress('die nächste Seite'), th.pageProgressStyle, th.pageProgressPlacement],
}));
</script>

<template>
    <InspectorSection id="people-group" :title="t.inspector.peopleGroup" :summary="groupSummary" :help="th.people.group">
        <SelectField
            quick
            :model-value="groupValue"
            :options="groupOptions"
            :label="t.inspector.peopleGroup"
            :placeholder="t.inspector.peopleChooseGroup"
            testid="people-group"
            @update:model-value="setGroup"
        />
        <p v-if="mode === 'full' && groupOptions.length === 0" class="hint" data-testid="people-group-none">{{ t.inspector.peopleNoGroupsAtAll }}</p>
        <p v-else-if="mode === 'full' && groupOptions.length === 1" class="hint" data-testid="people-group-hint">{{ t.inspector.peopleGroupHint }}</p>
    </InspectorSection>
    <p v-if="mode === 'full' && group === null && groupOptions.length > 0" class="hint" data-testid="people-no-group">{{ t.inspector.peopleNoGroup }}</p>
    <p v-else-if="mode === 'full' && group?.unreleased" class="hint" data-testid="people-unreleased">{{ t.inspector.peopleUnreleased }}</p>
    <p v-else-if="mode === 'full' && group?.denied" class="hint" data-testid="people-denied">{{ t.inspector.peopleDenied }}</p>

    <InspectorSection id="people-roles" :title="t.inspector.peopleRoles" :summary="rolesSummary" :help="th.people.roles">
        <ToggleField
            :model-value="block.roleIds.length === 0"
            :label="t.inspector.allRoles"
            :disabled="block.roleIds.length === 0 && roles.length === 0"
            testid="people-roles-all"
            @update:model-value="toggleAllRoles"
        />
        <template v-if="block.roleIds.length">
            <ToggleField
                v-for="role in roles"
                :key="role.id"
                :model-value="block.roleIds.includes(role.id)"
                :label="role.name"
                :disabled="block.roleIds.length === 1 && block.roleIds.includes(role.id)"
                :testid="`people-role-${role.id}`"
                @update:model-value="toggleRole(role.id, $event)"
            />
        </template>
    </InspectorSection>

    <!-- Choosing and ordering what stands under the name is one chip "Angaben 2 von 5" in the short menu (Plan.md 79, C5; 114 B). -->
    <QuickField quick :label="t.inspector.peopleFields" :face="entriesFace">
        <SelectMenu
            :model-value="undefined"
            :options="pickable"
            :placeholder="t.inspector.addField"
            :disabled="!pickable.length"
            :aria-label="t.inspector.addFieldLabel"
            testid="people-fields-add"
            @update:model-value="addEntry"
        />
        <p v-if="!keys.length" class="hint">{{ loaded && !fields.length && !released.length ? t.inspector.noFieldsThere : t.inspector.noFieldsChosen }}</p>
        <InspectorSection v-else id="people-fields" :title="t.inspector.peopleFields" :summary="entriesSummary" :help="th.people.fields">
            <SortList :items="chosen" :remove-label="t.inspector.removeField" testid="people-field" @move="moveEntry" @remove="removeEntry">
                <template #actions="{ item }">
                    <button
                        v-tip="t.inspector.pinRight"
                        class="sort-action"
                        type="button"
                        :aria-label="t.inspector.pinRight"
                        :aria-pressed="right.includes(String(item.key))"
                        data-testid="people-field-pin"
                        @click="togglePin(String(item.key))"
                    >
                        <Icon name="pin" :size="14" />
                    </button>
                </template>
            </SortList>
        </InspectorSection>
    </QuickField>

    <InspectorSection id="people-name" :title="t.inspector.peopleName" :summary="nameSummary" :help="th.people.name">
        <SelectField
            :model-value="namePresetValue"
            :options="namePresets"
            :label="t.inspector.peopleNameQuick"
            :placeholder="t.inspector.peopleNameQuick"
            testid="people-name-preset"
            @update:model-value="setNameFormat(String($event))"
        />
        <TextField :model-value="nameFormat" :label="t.inspector.peopleNameFormat" :maxlength="200" :input-id="NAME_INPUT_ID" stacked testid="people-name-format" @update:model-value="setNameFormat" />
        <SelectField
            :model-value="undefined"
            :options="nameInsertOptions"
            :label="t.inspector.peopleNameInsertLabel"
            :placeholder="t.inspector.peopleNameInsert"
            testid="people-name-insert"
            @update:model-value="insertPlaceholder"
        />
    </InspectorSection>

    <InspectorSection id="appearance" :title="t.inspector.appearance" :summary="summary" :help="appearanceHelp">
        <TileField quick :model-value="block.layout" :options="PEOPLE_TILES" :label="t.inspector.view" testid="people-layout" @update:model-value="setBlock({ layout: $event })" />
        <SegmentField
            quick
            :model-value="block.sort"
            :options="sorts"
            :label="t.inspector.order"
            testid="people-sort"
            stacked
            @update:model-value="setBlock({ sort: $event })"
        />
        <ToggleField :model-value="block.showImage" :label="t.inspector.showPicture" testid="people-show-image" @update:model-value="setBlock({ showImage: $event })" />
        <SegmentField
            v-if="block.showImage"
            :model-value="block.imageShape ?? 'circle'"
            :options="shapes"
            :label="t.inspector.imageShape"
            testid="people-image-shape"
            @update:model-value="setBlock({ imageShape: $event === 'square' ? 'square' : undefined })"
        />
        <SegmentField v-if="block.layout === 'card'" :model-value="block.columns" :options="columns" :label="t.inspector.columns" testid="people-columns" @update:model-value="setBlock({ columns: Number($event) })" />
        <SegmentField v-if="block.layout === 'card'" :model-value="block.rows" :options="columns" :label="t.inspector.peopleRows" testid="people-rows" @update:model-value="setBlock({ rows: Number($event) })" />
        <NumberField
            :model-value="block.pageSeconds ?? PEOPLE_SECONDS"
            :label="t.inspector.secondsPerPage"
            :unit="t.inspector.unitSeconds"
            :min="5"
            :max="120"
            testid="people-seconds"
            @update:model-value="setBlock({ pageSeconds: $event })"
        />
        <PageProgressToggle :block="block" />
        <PageProgressOptions :block="block" />
        <PageProgressHint />
    </InspectorSection>
    <FontSection :block="block" effects="shadow" />
</template>

<style scoped>
.hint {
    margin: 0;
    color: var(--d-text-muted);
    font-size: var(--d-size-sm);
}
</style>
