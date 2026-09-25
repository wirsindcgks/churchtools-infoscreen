import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatReleaseDate, parseChangelog, parseInline, releaseOf, REPOSITORY_URL } from './changelog';

const SAMPLE = `# Changelog

Einleitung, die nicht zu den Versionen gehört.

## [Unreleased]

### Neu

- **Mediathek** mit „Verwendet in":
  Suche nach Screen und Playlist.

## [0.1.0] – 2026-09-25

### Neu

- Erste Fassung, siehe [Einrichtung](docs/Einrichtung.md) und \`/ccm/infoscreen-designer/\`.

### Behoben

- Ein Fehler.

## [0.0.1] – 2026-09-01
`;

describe('the changelog on the about page', () => {
    it('reads versions, groups and bullets that continue on the next line', () => {
        const versions = parseChangelog(SAMPLE);
        expect(versions.map((v) => [v.version, v.date])).toEqual([
            [null, null],
            ['0.1.0', '2026-09-25'],
        ]); // an empty version is left out
        expect(versions[1]!.groups.map((g) => g.heading)).toEqual(['Neu', 'Behoben']);
        expect(versions[0]!.groups[0]!.items[0]).toEqual([
            { kind: 'strong', text: 'Mediathek' },
            { kind: 'text', text: ' mit „Verwendet in": Suche nach Screen und Playlist.' },
        ]);
    });

    it('opens documents of the repository on GitHub and keeps code as code', () => {
        expect(parseInline('siehe [Einrichtung](docs/Einrichtung.md) und `x`')).toEqual([
            { kind: 'text', text: 'siehe ' },
            { kind: 'link', text: 'Einrichtung', href: `${REPOSITORY_URL}/blob/main/docs/Einrichtung.md` },
            { kind: 'text', text: ' und ' },
            { kind: 'code', text: 'x' },
        ]);
        // Nothing but a web address leaves the module as a link.
        expect(parseInline('[x](javascript:alert(1))')[0]).toMatchObject({ kind: 'link', href: expect.stringMatching(/^https:\/\/github\.com\//) });
    });

    it('reads the real CHANGELOG.md', () => {
        const versions = parseChangelog(fs.readFileSync('CHANGELOG.md', 'utf8'));
        expect(versions.length).toBeGreaterThan(0);
        expect(versions.flatMap((v) => v.groups.flatMap((g) => g.items)).length).toBeGreaterThan(5);
    });

    it('counts a build between releases as the release before, and writes dates in German', () => {
        expect(releaseOf('0.1.0+abc1234')).toBe('0.1.0');
        expect(releaseOf('0.1.0')).toBe('0.1.0');
        expect(formatReleaseDate('2026-09-25')).toBe('25. September 2026');
    });
});
