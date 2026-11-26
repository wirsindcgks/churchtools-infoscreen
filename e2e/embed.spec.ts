import { expect, test } from '@playwright/test';
import { expectSlides, openSection } from './helpers';

// A whole presentation inside another (Plan.md 120), in demo mode.
test.use({ viewport: { width: 1440, height: 900 } });

test('embeds a presentation as one entry, shows it in the preview, publishes and removes it', async ({ page }) => {
    // The copy of the first playlist is the outer one; the original is the main part.
    await page.goto('playlists');
    await expect(page.getByTestId('playlist-card').first()).toBeVisible();
    await page.getByTestId('playlist-card').first().getByTestId('playlist-menu').click();
    await page.getByTestId('duplicate-playlist').click();
    await page.getByTestId('duplicate-copy').check();
    await page.getByTestId('duplicate-confirm').click();
    await expect(page).toHaveURL(/playlists\/[\w-]+(\?|$)/);
    await expectSlides(page);
    await expect(page.getByTestId('slide-item')).toHaveCount(3);

    await page.getByTestId('slide-item').first().click();
    await page.getByTestId('embed-playlist').click();
    const dialog = page.getByTestId('embed-dialog');
    await expect(dialog.getByTestId('embed-candidate')).toHaveCount(1);
    await dialog.getByTestId('embed-candidate').first().click();
    // The chosen tile wears the ring of the shared tile, like in the media library.
    await expect(dialog.getByTestId('embed-candidate').first()).toHaveClass(/d-tile--selected/);
    await dialog.getByTestId('embed-take').click();

    // One entry behind the first slide; the own slides keep their numbers.
    await expect(page.getByTestId('embed-item')).toHaveCount(1);
    await expect(page.getByTestId('slide-item')).toHaveCount(3);
    await expect(page.getByTestId('embed-item')).toContainText('3 Folien · eingebettet');
    await expect(page.getByTestId('embed-item')).toContainText('Bearbeiten');
    await expect(page.getByTestId('embed-edit')).toHaveAttribute('aria-label', 'Im Hauptteil bearbeiten');
    await expect(page.getByTestId('embed-playlist')).toBeDisabled();

    // The number on the editor's progress bar counts the embedded slides in their place: the second own slide is 5 of 6.
    await openSection(page, 'playlist');
    await page.getByTestId('playlist-progress').check();
    await expect(page.getByTestId('slide-number')).toHaveText('1/6');
    await page.getByTestId('slide-item').nth(1).click();
    await expect(page.getByTestId('slide-number')).toHaveText('5/6');

    // The preview of the whole presentation runs the embedded slides as well: 3 own and 3 embedded.
    await page.getByTestId('open-preview').click();
    await expect(page.getByTestId('preview-where')).toContainText('/6 ·');
    await page.getByTestId('preview-close').click();

    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Veröffentlicht');

    // Removing asks first; the slides stay in the main part.
    await page.getByTestId('embed-remove').click();
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByTestId('embed-item')).toHaveCount(0);
    await expect(page.getByTestId('embed-playlist')).toBeEnabled();
});

test('the main part cannot embed anything once it is embedded', async ({ page }) => {
    await page.goto('playlists');
    await page.getByTestId('playlist-card').first().getByTestId('playlist-menu').click();
    await page.getByTestId('duplicate-playlist').click();
    await page.getByTestId('duplicate-copy').check();
    await page.getByTestId('duplicate-confirm').click();
    await expectSlides(page);
    await page.getByTestId('embed-playlist').click();
    await page.getByTestId('embed-dialog').getByTestId('embed-candidate').first().click();
    await page.getByTestId('embed-take').click();
    await page.getByTestId('save').click();
    await expect(page.getByTestId('save-status')).toHaveText('Veröffentlicht');

    await page.goto('playlists');
    // The card of the main part names where it is embedded and keeps it from being deleted (Plan.md 120 C).
    const main = page.getByTestId('playlist-card').first();
    await expect(main.getByTestId('playlist-embedded-in')).toContainText('Eingebettet in „');
    await main.getByTestId('playlist-menu').click();
    await expect(main.getByTestId('delete-playlist')).toBeDisabled();
    await page.keyboard.press('Escape');
    await main.getByTestId('open-playlist').click();
    await expectSlides(page);
    await expect(page.getByTestId('embed-item')).toHaveCount(0);
    await expect(page.getByTestId('embed-playlist')).toBeDisabled();
});
