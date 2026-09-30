import { expect, test, type Page } from '@playwright/test';
import { openSection } from './helpers';

// Linked slides (Plan.md 49): the very same slide in several playlists, in demo mode.
test.use({ viewport: { width: 1440, height: 900 } });

/** Duplicates the first playlist and lands in the editor of the copy. */
async function duplicateFirst(page: Page, linked: boolean): Promise<void> {
    await page.goto('playlists');
    await expect(page.getByTestId('playlist-card').first()).toBeVisible();
    await page.getByTestId('playlist-card').first().getByTestId('playlist-menu').click();
    await page.getByTestId('duplicate-playlist').click();
    await expect(page.getByTestId('duplicate-dialog')).toBeVisible();
    await page.getByTestId(linked ? 'duplicate-linked' : 'duplicate-copy').check();
    await page.getByTestId('duplicate-confirm').click();
    await expect(page).toHaveURL(/playlists\/[\w-]+$/);
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
}

async function openPlaylist(page: Page, index: number): Promise<void> {
    await page.goto('playlists');
    await page.getByTestId('playlist-card').nth(index).getByTestId('open-playlist').click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
}

const slideName = (page: Page) => page.getByTestId('slide-inspector').locator('input[type=text]').first();

async function rename(page: Page, name: string): Promise<void> {
    await slideName(page).fill(name);
    await slideName(page).blur();
}

async function save(page: Page): Promise<void> {
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Gespeichert');
}

test('a linked duplicate shows the chain, and a change in one playlist arrives in the other', async ({ page }) => {
    await duplicateFirst(page, true);
    await expect(page.getByTestId('slide-linked-badge')).toHaveCount(3);
    await expect(page.getByTestId('slide-linked')).toBeVisible();
    await expect(page.getByTestId('slide-linked-in')).toContainText('Auch in: ');
    await expect(page.getByTestId('slide-linked-badge').first()).toHaveAttribute('aria-label', /^Verknüpft mit: /);

    await rename(page, 'Gemeinsam geändert');
    await save(page);
    const notice = page.getByTestId('linked-save-notice');
    await expect(notice).toContainText('Verknüpfte Slide „Gemeinsam geändert" gespeichert – gilt auch in „');
    await notice.getByRole('button', { name: 'Meldung schließen' }).click();
    await expect(notice).toHaveCount(0);

    await openPlaylist(page, 0);
    await expect(page.getByTestId('slide-item').first()).toContainText('Gemeinsam geändert');
    await expect(page.getByTestId('slide-linked')).toBeVisible();
    await expect(page.getByTestId('slide-linked-in')).toContainText('(Kopie)');
});

test('"Verknüpfung lösen" makes an own copy: a later change stays in this playlist', async ({ page }) => {
    await duplicateFirst(page, true);
    await page.getByTestId('slide-unlink').click();
    await expect(page.getByTestId('slide-linked')).toHaveCount(0);
    await expect(page.getByTestId('slide-linked-badge')).toHaveCount(2);
    await rename(page, 'Nur hier');
    await save(page);
    await expect(page.getByTestId('linked-save-notice')).toHaveCount(0);

    await openPlaylist(page, 0);
    await expect(page.getByTestId('slide-item').first()).not.toContainText('Nur hier');
    await expect(page.getByTestId('slide-linked-badge')).toHaveCount(2);
});

test('a duplicate as copy stays independent', async ({ page }) => {
    await duplicateFirst(page, false);
    await expect(page.getByTestId('slide-linked-badge')).toHaveCount(0);
    await expect(page.getByTestId('slide-linked')).toHaveCount(0);
});

test('slides taken over linked: "schon hier" for the ones already in the playlist', async ({ page }) => {
    // In the copy there are own slides: linking the original's three is possible …
    await duplicateFirst(page, false);
    await page.getByTestId('import-slides').click();
    const dialog = page.getByTestId('slide-import');
    await expect(dialog.getByTestId('slide-import-item')).toHaveCount(3);
    await dialog.getByTestId('slide-import-linked').check();
    await expect(dialog.getByTestId('slide-import-linked-hint')).toContainText('Verknüpfte Slides bleiben gleich');
    await dialog.getByTestId('slide-import-item').first().click();
    await expect(dialog.getByTestId('slide-import-take')).toHaveText('1 Slide verknüpfen');
    await dialog.getByTestId('slide-import-take').click();
    await expect(page.getByTestId('slide-item')).toHaveCount(4);
    await expect(page.getByTestId('slide-linked-badge')).toHaveCount(1);
    await expect(dialog.getByTestId('slide-import-linked-hint')).toHaveCount(0);
    // The link comes with the save: until then the inspector says so.
    await expect(page.getByTestId('slide-link-pending')).toHaveText('ab dem Speichern');
    await save(page);
    await expect(page.getByTestId('linked-save-notice')).toContainText('gilt auch in „');
    await expect(page.getByTestId('slide-link-pending')).toHaveCount(0);
    await expect(page.getByTestId('slide-linked-in')).toBeVisible();

    // … and taken over once, they are not offered again.
    await page.getByTestId('import-slides').click();
    await dialog.getByTestId('slide-import-linked').check();
    await expect(dialog.getByTestId('slide-import-here')).toHaveCount(1);
    await expect(dialog.getByTestId('slide-import-item').first().locator('input')).toBeDisabled();

    // After the save the source knows of the link, too.
    await openPlaylist(page, 0);
    await expect(page.getByTestId('slide-linked-badge')).toHaveCount(1);
    await expect(page.getByTestId('slide-linked-in')).toContainText('(Kopie)');
    await expect(page.getByTestId('slide-link-pending')).toHaveCount(0);
});

test('two windows change the same linked slide: notice, reload, keep as an own copy', async ({ page, context }) => {
    await duplicateFirst(page, true); // page: the copy
    const other = await context.newPage();
    await openPlaylist(other, 0); // other: the original

    await rename(other, 'Von der anderen Seite');
    await save(other);

    await rename(page, 'Von meiner Seite');
    await page.getByTestId('save').click();
    const dialog = page.getByTestId('slide-conflict-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Von der anderen Seite');
    await expect(dialog).toContainText('Gespeichert wurde nichts.');
    await page.getByTestId('slide-conflict-reload').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('slide-item').first()).toContainText('Von der anderen Seite');

    // Once more, this time keeping mine as an own copy.
    await rename(other, 'Wieder von drüben');
    await save(other);
    await rename(page, 'Meine Fassung');
    await page.getByTestId('save').click();
    await expect(dialog).toBeVisible();
    await page.getByTestId('slide-conflict-keep').click();
    await expect(page.getByTestId('save-status')).toHaveText('Gespeichert');
    await expect(page.getByTestId('slide-item').first()).toContainText('Meine Fassung');
    await expect(page.getByTestId('slide-linked-badge')).toHaveCount(2);

    await openPlaylist(other, 0);
    await expect(other.getByTestId('slide-item').first()).toContainText('Wieder von drüben');
});

for (const size of [
    { width: 1440, height: 900 },
    { width: 1180, height: 820 },
    { width: 390, height: 844 },
]) {
    test(`the "Auch in" row and its button stay inside the inspector at ${size.width} x ${size.height}`, async ({ page }) => {
        // Named where the inspector is open; looked at in the size under test.
        await duplicateFirst(page, true);
        const long = 'Zuletzt: Gottesdienst im Sommer mit Kinderprogramm und anschließendem Mittagessen für alle Familien';
        await openSection(page, 'playlist');
        await page.getByTestId('playlist-name-input').fill(long);
        await page.getByTestId('playlist-name-input').blur();
        await save(page);

        await page.setViewportSize(size);
        await openPlaylist(page, 0);
        if (size.width === 390) await page.getByTestId('inspector-sheet-toggle').click();
        else if (size.width === 1180) await page.getByTestId('tablet-inspector-toggle').click();
        const row = page.getByTestId('slide-linked');
        await expect(row).toBeVisible();
        await expect(page.getByTestId('slide-linked-in')).toHaveAttribute('title', new RegExp(long));
        const frame = (await page.locator('aside.inspector').boundingBox())!;
        for (const id of ['slide-linked', 'slide-unlink']) {
            const box = (await page.getByTestId(id).boundingBox())!;
            expect(box.x).toBeGreaterThanOrEqual(frame.x - 0.5);
            expect(box.x + box.width).toBeLessThanOrEqual(Math.min(frame.x + frame.width, size.width) + 0.5);
        }
        await page.screenshot({ path: `test-results/linked-inspector-${size.width}.png` });
    });
}
