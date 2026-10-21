import { expect, test } from '@playwright/test';
import { addBlock, pickOption } from './helpers';

test.use({ viewport: { width: 1440, height: 900 } });

test('publishing shows on "Verlauf", the area filter narrows it, and the editor shows only its own presentation (Plan.md 100)', async ({ page }) => {
    await page.route('**/api/whoami**', (route) => route.fulfill({ json: { data: { id: 1, firstName: 'Anna', lastName: 'Beispiel' } } }));
    await page.goto('./');

    // A second presentation, so that "this presentation" has something to leave out.
    await page.getByTestId('sidebar-playlists').click();
    await page.getByTestId('new-playlist').click();
    await page.getByTestId('create-playlist-dialog').getByTestId('new-playlist-name').fill('Gottesdienst');
    await page.getByTestId('create-playlist').click();
    await expect(page).toHaveURL(/playlists\/[\w-]+$/);
    await page.getByTestId('leave-editor').click();

    // Publish a change on the demo presentation.
    await page.getByTestId('playlist-card').filter({ hasText: 'Wochenüberblick' }).getByTestId('open-playlist').click();
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await addBlock(page, 'text');
    await page.getByTestId('text-input').fill('Gemeindefest');
    await page.getByTestId('text-input').blur();
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Veröffentlicht');

    // The history of this presentation, from the editor's "…" menu.
    await page.getByTestId('editor-more').click();
    await page.getByTestId('more-history').click();
    await expect(page.getByTestId('history-heading')).toBeVisible();
    await expect(page.getByTestId('history-only')).toContainText('Nur „Wochenüberblick“');
    await expect(page.getByTestId('history-entry')).toHaveCount(1);
    await expect(page.getByTestId('history-entry')).toContainText('„Wochenüberblick“ veröffentlicht');
    await expect(page.getByTestId('history-entry')).toContainText('Anna Beispiel');

    // All entries: the creation of the other presentation is there as well.
    await page.getByTestId('history-show-all').click();
    await expect(page.getByTestId('history-only')).toHaveCount(0);
    await expect(page.getByTestId('history-entry')).toHaveCount(2);
    await expect(page.getByTestId('history-list')).toContainText('„Gottesdienst“ angelegt');

    // The filter by area.
    await pickOption(page, 'history-area', 'Bildschirm');
    await expect(page.getByTestId('history-no-match')).toBeVisible();
    await pickOption(page, 'history-area', 'Präsentation');
    await expect(page.getByTestId('history-entry')).toHaveCount(2);
    await pickOption(page, 'history-person', 'Anna Beispiel');
    await expect(page.getByTestId('history-entry')).toHaveCount(2);
});
