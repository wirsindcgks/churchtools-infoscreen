/**
 * Access to the recorded API responses under fixtures/ (not versioned).
 * Tests that need them use `describe.skipIf(!hasFixture(...))`, so a fresh
 * clone and CI report them as skipped instead of failing or passing silently.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..', 'fixtures');

export function hasFixture(name: string): boolean {
    return fs.existsSync(path.join(root, name));
}

export function loadFixture<T>(name: string): T {
    return JSON.parse(fs.readFileSync(path.join(root, name), 'utf8')) as T;
}
