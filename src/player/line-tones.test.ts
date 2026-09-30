/**
 * Lines and cards of the player take their tone from the block's text colour (Plan.md 48): a fixed
 * white with alpha shows on a dark slide and vanishes on a light one. This test keeps it out.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function vueFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return vueFiles(full);
        return entry.name.endsWith('.vue') ? [full] : [];
    });
}

const FIXED_WHITE = /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,|hsla\(\s*0\s*,\s*0%\s*,\s*100%\s*,|#fff[0-9a-f]{1,2}\b|#ffffff[0-9a-f]{2}\b/i;

describe('player styles', () => {
    it('set no fixed white with alpha as a line or card tone', () => {
        const offenders = vueFiles(path.resolve(__dirname)).filter((file) => FIXED_WHITE.test(fs.readFileSync(file, 'utf8')));
        expect(offenders).toEqual([]);
    });
});
