/**
 * The musicians' group "Infoscreen-Musiker" (Plan.md 121 E3, G83): its members steer the song sheet from the phone. They come
 * from the band groups by the automatic membership of ChurchTools – a rule on the group (`/dynamicgroups`, needs "Personen
 * verwalten") that takes in everybody who is in one of the band groups and takes out whoever is not (any more).
 */
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { t } from '../i18n/designer';
import { provision, type GroupSpec, type ProvisionApi, type ProvisionResult } from './provision';

/** The calls for the automatic membership – behind an interface, like `ProvisionApi`. The answers carry no `data` field; the client hands them over as they are. */
export interface MusicianApi {
    /** `PUT /dynamicgroups/{id}/ruleset`; an empty list clears the rule. */
    setRuleset(groupId: number, rules: unknown[]): Promise<void>;
    /** `PUT /dynamicgroups/{id}/status`: `active` takes part in the scheduled and the manual runs. */
    setDynamicStatus(groupId: number, status: 'active' | 'none'): Promise<void>;
    /** `POST /dynamicgroups/{id}/refresh`: runs the rule once. */
    refreshDynamic(groupId: number): Promise<void>;
}

export const churchToolsMusicianApi: MusicianApi = {
    async setRuleset(groupId, rules) {
        await churchtoolsClient.put(`/dynamicgroups/${groupId}/ruleset`, { dynamicGroupRuleSet: rules });
    },
    async setDynamicStatus(groupId, status) {
        await churchtoolsClient.put(`/dynamicgroups/${groupId}/status`, { dynamicGroupStatus: status });
    },
    async refreshDynamic(groupId) {
        await churchtoolsClient.post(`/dynamicgroups/${groupId}/refresh`);
    },
};

/**
 * The rule in the format ChurchTools itself writes (G83): the standard parts "not archived" and "not deceased", plus
 * "member of one of the groups" (ids as text); in the group only: the people from the query are put in as `groupTypeRoleId` (the
 * "Teilnehmer"), those in the group but not in the query are taken out (`none`).
 */
export function musicianRuleset(groupId: number, sourceGroupIds: number[], groupTypeRoleId: number): unknown[] {
    return [
        {
            description: `Automatische Mitgliedschaft für Gruppe #${groupId}`,
            shorty: `Autom. Mitgliedschaft Gruppe #${groupId}`,
            personIdFieldName: 'person.id',
            importance: 0,
            query: {
                method: 'ChurchQuery',
                params: {
                    groupBy: ['person.id'],
                    filter: {
                        and: [
                            {
                                dterm: [
                                    { title: 'group.automatic-membership.default-archived.title' },
                                    {
                                        and: [
                                            {
                                                dterm: [
                                                    { title: 'group.automatic-membership.default.person-not-archived.title' },
                                                    { '==': [{ var: 'person.isArchived' }, 0] },
                                                ],
                                            },
                                            {
                                                dterm: [
                                                    { title: 'group.automatic-membership.default.person-not-deceased.title' },
                                                    { isnull: [{ var: 'person.dateOfDeath' }] },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                            {
                                dterm: [
                                    { title: 'Mitgliedschaft in einer Gruppe' },
                                    { and: [{ and: [{ oneof: [{ var: 'ctgroup.id' }, sourceGroupIds.map(String)] }] }, { 'true and': [] }] },
                                ],
                            },
                        ],
                    },
                },
                primaryEntityAlias: 'person',
                responseFields: ['person.id', 'person.firstName', 'person.lastName'],
            },
            process: {
                queryResultOnly: { none: { handleMembership: { groupMemberStatus: 'active', groupTypeRoleId } } },
                groupOnly: { active: { handleMembership: { groupMemberStatus: 'none' } } },
                groupAndQueryResult: {},
            },
        },
    ];
}

/**
 * Creates the musicians' group with its rights (`plan` holds the spec with key `musician`) and – where the person may
 * "Personen verwalten" and there are band groups – sets the rule, switches the group to `active` and runs it once. Without that
 * right the group and its rights are made and the rule is left to the administrator (the page says where). A failure after the group
 * exists stops the rest; the group stays in `groupIds`, so the caller records it.
 */
export async function provisionMusicians(
    plan: GroupSpec[],
    groupTypeId: number,
    sourceGroupIds: number[],
    canManagePersons: boolean,
    api: ProvisionApi & MusicianApi,
): Promise<ProvisionResult> {
    const musician = plan.find((spec) => spec.key === 'musician');
    if (!musician) return { groupIds: {}, log: [], error: t.setup.plan.none };
    const result = await provision([musician], groupTypeId, api);
    const groupId = result.groupIds.musician;
    if (result.error || groupId === undefined) return result;
    if (!sourceGroupIds.length) {
        result.log.push(t.setup.musicians.noSources);
        return result;
    }
    if (!canManagePersons) {
        result.log.push(t.setup.musicians.byHandLog);
        return result;
    }
    try {
        const role = await api.defaultRole(groupId);
        if (!role) throw new Error(t.setup.musicians.noRole);
        await api.setRuleset(groupId, musicianRuleset(groupId, sourceGroupIds, role.groupTypeRoleId));
        result.log.push(t.setup.musicians.ruleSet(sourceGroupIds.length));
        await api.setDynamicStatus(groupId, 'active');
        result.log.push(t.setup.musicians.statusActive);
        await api.refreshDynamic(groupId);
        result.log.push(t.setup.musicians.refreshed);
    } catch (e) {
        result.error = e instanceof Error ? e.message : String(e);
        result.log.push(t.setup.provision.aborted(result.error));
    }
    return result;
}

/** Writes the rule anew for other band groups and runs it; an empty list clears the rule (and then nothing is run). Returns the log lines; throws on failure. */
export async function updateMusicianSources(groupId: number, sourceGroupIds: number[], api: Pick<ProvisionApi, 'defaultRole'> & MusicianApi): Promise<string[]> {
    if (!sourceGroupIds.length) {
        await api.setRuleset(groupId, []);
        // Without rules the group is an ordinary one again (G83: `none` keeps the members).
        await api.setDynamicStatus(groupId, 'none');
        return [t.setup.musicians.ruleCleared];
    }
    const role = await api.defaultRole(groupId);
    if (!role) throw new Error(t.setup.musicians.noRole);
    await api.setRuleset(groupId, musicianRuleset(groupId, sourceGroupIds, role.groupTypeRoleId));
    // A group created without band groups was never switched on, and a refresh is refused in `none` (G83, Nachtrag).
    await api.setDynamicStatus(groupId, 'active');
    await api.refreshDynamic(groupId);
    return [t.setup.musicians.ruleSet(sourceGroupIds.length), t.setup.musicians.statusActive, t.setup.musicians.refreshed];
}
