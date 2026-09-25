import { describe, expect, it } from 'vitest';
import { changelogSection, releaseProblems, versionOfTag } from './release-check.js';

const changelog = `# Changelog

## [Unreleased]

- Noch nicht veröffentlicht.

## [0.2.0] – 2026-10-01

### Neu
- Mediathek auf der Startseite.

## [0.1.0] - 2026-09-25

- Erste Fassung.
`;

describe('versionOfTag', () => {
    it('reads vX.Y.Z and nothing else', () => {
        expect(versionOfTag('v0.1.0')).toBe('0.1.0');
        expect(versionOfTag('0.1.0')).toBeNull();
        expect(versionOfTag('v0.1')).toBeNull();
        expect(versionOfTag('v0.1.0-beta')).toBeNull();
    });
});

describe('changelogSection', () => {
    it('returns the text of a dated section up to the next one, with either dash', () => {
        expect(changelogSection(changelog, '0.2.0')).toBe('### Neu\n- Mediathek auf der Startseite.');
        expect(changelogSection(changelog, '0.1.0')).toBe('- Erste Fassung.');
    });

    it('does not take a version for another one that merely starts alike', () => {
        expect(changelogSection('## [0.1.00] – 2026-09-25\n- x', '0.1.0')).toBeNull();
    });
});

describe('releaseProblems', () => {
    const ok = { tag: 'v0.2.0', packageVersion: '0.2.0', lockVersion: '0.2.0', changelog };

    it('has none when tag, package, lock file and changelog agree', () => {
        expect(releaseProblems(ok)).toEqual([]);
    });

    it('names every file that disagrees with the tag', () => {
        const problems = releaseProblems({ ...ok, packageVersion: '0.1.0', lockVersion: '0.1.0', changelog: '' });
        expect(problems).toHaveLength(3);
        expect(problems.join()).toMatch(/package\.json.*package-lock\.json.*CHANGELOG/s);
    });

    it('refuses a tag that is no version, and an empty section', () => {
        expect(releaseProblems({ ...ok, tag: 'test' })[0]).toContain('vX.Y.Z');
        expect(releaseProblems({ ...ok, changelog: '## [0.2.0] – 2026-10-01\n\n## [0.1.0] – 2026-09-25\n- x' })[0]).toContain(
            'leer',
        );
    });
});
