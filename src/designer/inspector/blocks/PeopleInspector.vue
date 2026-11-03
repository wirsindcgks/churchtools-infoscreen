<script setup lang="ts">
/**
 * The people block (Plan.md 112): the people of a group as cards or, since 1.55, as a list – "Infoscreen-People" or a group an administrator released
 * (Stück 2a); the choice stands first. The roles and the member fields (in their order) each have a section named after what
 * they choose, and follow the chosen group; look and page time stand in "Darstellung".
 */
import { computed } from 'vue';
import { t } from '../../../i18n/designer';
import { th } from '../../../i18n/help';
import { groupOfBlock, resolveFieldKeys } from '../../../groups/members';
import { PERSON_FIELD_KEYS, type Block, type PersonFieldKey } from '../../../model/schema';
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
import SortList, { type SortItem } from '../fields/SortList.vue';
import ToggleField from '../fields/ToggleField.vue';
import TileField from '../fields/TileField.vue';
import FontSection from '../FontSection.vue';
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

/** The block's group: `undefined` until the preview has it, `null` where "Infoscreen-People" is not set up. */
const group = computed(() => groupOfBlock(stage.people, props.block.sourceGroupId));
const roles = computed(() => group.value?.roles ?? []);
const fields = computed(() => group.value?.fields ?? []);
/** Whether the preview has the group yet – until then a chosen field is not "gone", only not loaded. */
const loaded = computed(() => !!group.value && !group.value.denied);

// --- group: "Infoscreen-People" or a released one; roles and fields belong to the group, so a change clears them ---

const STANDARD = 'standard';
const standardChoice = computed(() => stage.peopleChoices?.find((c) => c.standard));
const groupOptions = computed<SelectOption[]>(() => {
    const options: SelectOption[] = [{ value: STANDARD, label: standardChoice.value?.name ?? t.inspector.peopleStandardGroup }];
    for (const c of stage.peopleChoices ?? []) if (!c.standard) options.push({ value: c.id, label: c.name });
    const own = props.block.sourceGroupId;
    if (own !== undefined && own !== standardChoice.value?.id && !options.some((o) => o.value === own)) {
        options.push({ value: own, label: t.inspector.peopleGroupGone(own) });
    }
    return options;
});
const groupValue = computed(() => (props.block.sourceGroupId === undefined || props.block.sourceGroupId === standardChoice.value?.id ? STANDARD : props.block.sourceGroupId));
function setGroup(value: string | number): void {
    const next = value === STANDARD ? undefined : Number(value);
    if (next === (groupValue.value === STANDARD ? undefined : props.block.sourceGroupId)) return;
    setBlock({ sourceGroupId: next, roleIds: [], fieldKeys: [] });
}
const groupSummary = computed(() => groupOptions.value.find((o) => o.value === groupValue.value)?.label ?? t.inspector.peopleStandardGroup);

const sorts = [
    { value: 'last-name', label: t.inspector.peopleSortLastName },
    { value: 'first-name', label: t.inspector.peopleSortFirstName },
    { value: 'role', label: t.inspector.peopleSortRole },
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

// --- member fields: chosen ones in their order, the rest to pick ---

/** The chosen fields by id – a block from before holds names, mapped here; edits write the ids. The list shows the current names. */
const keys = computed(() => resolveFieldKeys(props.block.fieldKeys, fields.value));
const chosen = computed<SortItem[]>(() =>
    keys.value.map((key) => {
        const name = fields.value.find((f) => f.key === key)?.name;
        return { key, label: name ?? (loaded.value ? `${key} – ${t.inspector.peopleFieldGone}` : key), dimmed: loaded.value && name === undefined };
    }),
);
const pickable = computed(() => fields.value.filter((f) => !keys.value.includes(f.key)));
function addField(key: string | number): void {
    if (props.block.fieldKeys.length >= FIELDS_MAX) return;
    setBlock({ fieldKeys: [...keys.value, String(key)] });
}
function removeField(index: number): void {
    setBlock({ fieldKeys: keys.value.filter((_, i) => i !== index) });
}
function moveField(from: number, to: number): void {
    if (to < 0 || to >= props.block.fieldKeys.length) return;
    setBlock({ fieldKeys: moveItem(keys.value, from, to) });
}
const fieldsFace = computed(() =>
    props.block.fieldKeys.length ? t.quick.listFace(t.inspector.peopleFields, t.common.countOf(props.block.fieldKeys.length, fields.value.length || props.block.fieldKeys.length)) : t.quick.empty.people,
);

// --- person fields (Stück 3): only what an administrator released; the list follows the release, so a withdrawn one shows as gone ---

const released = computed(() => stage.releasedPersonFields ?? []);
const personKeys = computed(() => props.block.personFieldKeys ?? []);
const personName = (key: string): string => t.inspector.personFieldNames[key] ?? key;
const chosenPerson = computed<SortItem[]>(() =>
    personKeys.value.map((key) => {
        const gone = !released.value.includes(key);
        return { key, label: gone ? `${personName(key)} – ${t.inspector.personFieldGone}` : personName(key), dimmed: gone };
    }),
);
const pickablePerson = computed(() => PERSON_FIELD_KEYS.filter((key) => released.value.includes(key) && !personKeys.value.includes(key)));
function setPersonFields(next: PersonFieldKey[]): void {
    setBlock({ personFieldKeys: next.length ? next : undefined });
}
function addPersonField(key: string | number): void {
    if (personKeys.value.length >= PERSON_FIELD_KEYS.length) return;
    setPersonFields([...personKeys.value, String(key) as PersonFieldKey]);
}
function removePersonField(index: number): void {
    setPersonFields(personKeys.value.filter((_, i) => i !== index));
}
function movePersonField(from: number, to: number): void {
    if (to < 0 || to >= personKeys.value.length) return;
    setPersonFields(moveItem([...personKeys.value], from, to));
}
const personFieldsFace = computed(() =>
    personKeys.value.length ? t.quick.listFace(t.inspector.personFields, t.common.countOf(personKeys.value.length, released.value.length || personKeys.value.length)) : t.quick.empty.personFields,
);

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
    items: [th.people.layout, th.people.sort, th.people.picture, th.people.grid, th.people.seconds, th.pageProgress('die nächste Seite'), th.pageProgressStyle, th.pageProgressPlacement],
}));
</script>

<template>
    <InspectorSection id="people-group" :title="t.inspector.peopleGroup" :summary="groupSummary" :help="th.people.group">
        <SelectField
            quick
            :model-value="groupValue"
            :options="groupOptions"
            :label="t.inspector.peopleGroup"
            testid="people-group"
            @update:model-value="setGroup"
        />
        <p v-if="mode === 'full' && groupOptions.length === 1" class="hint" data-testid="people-group-hint">{{ t.inspector.peopleGroupHint }}</p>
    </InspectorSection>
    <p v-if="mode === 'full' && group === null" class="hint" data-testid="people-no-group">{{ t.inspector.peopleNoGroup }}</p>
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

    <!-- Choosing and ordering the member fields are one chip "Angaben 2 von 5" in the short menu (Plan.md 79, C5). -->
    <QuickField quick :label="t.inspector.peopleFields" :face="fieldsFace">
        <SelectMenu
            :model-value="undefined"
            :options="pickable.map((f) => ({ value: f.key, label: f.name }))"
            :placeholder="t.inspector.addField"
            :disabled="!pickable.length || block.fieldKeys.length >= FIELDS_MAX"
            :aria-label="t.inspector.addFieldLabel"
            testid="people-fields-add"
            @update:model-value="addField"
        />
        <p v-if="!block.fieldKeys.length" class="hint">{{ loaded && !fields.length ? t.inspector.noFieldsThere : t.inspector.noFieldsChosen }}</p>
        <InspectorSection v-else id="people-fields" :title="t.inspector.peopleFields" :summary="t.common.countOf(block.fieldKeys.length, fields.length || block.fieldKeys.length)" :help="th.people.fields">
            <SortList :items="chosen" :remove-label="t.inspector.removeField" testid="people-field" @move="moveField" @remove="removeField" />
        </InspectorSection>
    </QuickField>

    <!-- Person fields (schema 1.54): shown only where an administrator released some; same handling as the member fields. -->
    <QuickField v-if="released.length" quick :label="t.inspector.personFields" :face="personFieldsFace">
        <SelectMenu
            :model-value="undefined"
            :options="pickablePerson.map((key) => ({ value: key, label: personName(key) }))"
            :placeholder="t.inspector.addPersonField"
            :disabled="!pickablePerson.length"
            :aria-label="t.inspector.addPersonFieldLabel"
            testid="people-person-fields-add"
            @update:model-value="addPersonField"
        />
        <p v-if="!personKeys.length" class="hint">{{ t.inspector.noPersonFieldsChosen }}</p>
        <InspectorSection v-else id="people-person-fields" :title="t.inspector.personFields" :summary="t.common.countOf(personKeys.length, released.length)" :help="th.people.personFields">
            <SortList :items="chosenPerson" :remove-label="t.inspector.removePersonField" testid="people-person-field" @move="movePersonField" @remove="removePersonField" />
        </InspectorSection>
    </QuickField>

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
