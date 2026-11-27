import { describe, expect, it } from 'vitest';
import { compare, compareVersions, matchPath, usedEndpoints } from './ct-check.js';

describe('ct-check', () => {
    it('sorts versions by their numbers', () => {
        expect(['3.139.1', '3.138', '3.137.1'].sort(compareVersions)).toEqual(['3.137.1', '3.138', '3.139.1']);
    });

    it('finds the calls of churchtoolsClient, a `${…}` as {}, a query cut off', () => {
        const found = usedEndpoints([
            ['a.ts', "churchtoolsClient.get<Foo[]>('/songs?include=arrangements'); churchtoolsClient.put(`/groups/${id}/members/${personId}`, {})"],
            ['b.vue', 'churchtoolsClient.get<{ x?: number }>(`/events/${eventId}/agenda`)'],
        ]);
        expect(found.map((e) => `${e.method} ${e.route}`)).toEqual(['get /songs', 'put /groups/{}/members/{}', 'get /events/{}/agenda']);
    });

    it('matches a route to the most literal path of the specification', () => {
        const paths = ['/events/{eventId}/agenda', '/permissions/{domainType}/{domainId}', '/permissions/global'];
        expect(matchPath('/events/{}/agenda', paths)).toBe('/events/{eventId}/agenda');
        expect(matchPath('/permissions/global', paths)).toBe('/permissions/global');
        expect(matchPath('/permissions/group_role/{}', paths)).toBe('/permissions/{domainType}/{domainId}');
        expect(matchPath('/songs', paths)).toBeNull();
    });

    it('reports a field gone, a type changed and an endpoint gone, through $ref', () => {
        const spec = (props, withSongs = true) => ({
            components: { schemas: { Song: { type: 'object', required: ['id'], properties: props } } },
            paths: withSongs
                ? { '/songs': { get: { responses: { 200: { content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Song' } } } } } } } } } }, '/info': { get: {} } }
                : { '/info': { get: {} } },
        });
        const endpoints = [{ method: 'get', route: '/songs' }, { method: 'get', route: '/info' }, { method: 'get', route: '/custommodules' }];
        const before = spec({ id: { type: 'integer' }, name: { type: 'string' }, ccli: { type: 'string' } });
        const after = spec({ id: { type: 'integer' }, name: { type: ['string', 'null'] } });
        const report = compare(before, after, endpoints);
        expect(report.same).toBe(1);
        expect(report.undocumented).toEqual(['GET /custommodules']);
        expect(report.changed[0].lines).toEqual(['- answer 200 data[].ccli: string', '~ answer 200 data[].name: string → string|null']);
        expect(compare(before, spec({}, false), endpoints).gone).toEqual(['GET /songs (vorher /songs)']);
    });
});
