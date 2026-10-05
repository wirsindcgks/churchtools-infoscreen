import { expect, test, type Page } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 } });

test('a new notice: empty text blocks saving, the preview shows it once typed, playlists are preselected (Plan.md 34)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('sidebar-notices').click();
    await expect(page.getByTestId('notices-heading')).toBeVisible();
    await expect(page.getByText('Gerade läuft kein Hinweis.')).toBeVisible();
    await page.screenshot({ path: 'test-results/notices-page.png' });

    await page.getByTestId('new-notice').click();
    const dialog = page.getByTestId('notice-dialog');
    await expect(dialog).toBeVisible();

    // Nothing typed yet – there is nothing to show on the TVs.
    await expect(dialog.getByTestId('notice-save')).toBeDisabled();

    await dialog.getByTestId('banner-text').fill('Heute Parkplatz gesperrt – bitte in der Schulstraße parken');
    await expect(dialog.getByTestId('notice-preview').getByTestId('banner')).toContainText('Parkplatz gesperrt');
    // A font of its own, bundled like the blocks' fonts, reaches the preview.
    await dialog.getByTestId('banner-font').selectOption('oswald');
    await dialog.getByTestId('banner-weight').selectOption('700');
    const text = dialog.getByTestId('notice-preview').getByTestId('banner').getByText('Parkplatz gesperrt');
    await expect(text).toHaveCSS('font-family', /Oswald/);
    await expect(text).toHaveCSS('font-weight', '700');
    // The demo screen shows the demo playlist – it starts checked.
    await expect(dialog.getByTestId('notice-playlist-demo-playlist')).toBeChecked();
    await expect(dialog.getByTestId('notice-save')).toBeEnabled();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/notices-dialog.png' });

    // Close without saving: nothing is written.
    page.once('dialog', (d) => d.accept());
    await dialog.getByTestId('notice-cancel').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Gerade läuft kein Hinweis.')).toBeVisible();
});

test('a saved notice shows when and by whom it was last changed, one fact per line (Plan.md 66)', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('sidebar-notices').click();
    await page.getByTestId('new-notice').click();
    const dialog = page.getByTestId('notice-dialog');
    await dialog.getByTestId('banner-text').fill('Heute Parkplatz gesperrt');
    await dialog.getByTestId('notice-save').click();
    await expect(dialog).toBeHidden();

    const card = page.getByTestId('notice-card').first();
    await expect(card).toContainText('Parkplatz gesperrt');
    await expect(card.getByTestId('notice-edited-at')).toHaveText(/^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/);
    await expect(card.getByTestId('notice-edited-at')).toHaveAttribute('title', /^Zuletzt geändert am .+ um \d{2}:\d{2}$/);
    // The signed-in test user's name, whoever that is.
    await expect(card.getByTestId('notice-edited-by')).toHaveText(/\S/);
    await expect(card.getByTestId('notice-edited-by')).toHaveAttribute('title', /^Zuletzt geändert von /);
    // Under each other: the date's line lies above the name's line.
    const at = (await card.getByTestId('notice-edited-at').boundingBox())!;
    const by = (await card.getByTestId('notice-edited-by').boundingBox())!;
    expect(by.y).toBeGreaterThanOrEqual(at.y + at.height - 1);
    await page.screenshot({ path: 'test-results/notices-edited.png' });
});

/** A playlist that runs nowhere yet. */
async function addPlaylist(page: Page, name: string): Promise<void> {
    await page.getByTestId('sidebar-playlists').click();
    await page.getByTestId('new-playlist').click();
    await page.getByTestId('create-playlist-dialog').getByTestId('new-playlist-name').fill(name);
    await page.getByTestId('create-playlist').click();
    await expect(page).toHaveURL(/playlists\/[\w-]+$/);
    await page.getByTestId('leave-editor').click();
}

/** A notice on exactly these playlists (by name), with an optional end as `YYYY-MM-DDTHH:mm`. */
async function addNotice(page: Page, text: string, playlists: string[], until?: string): Promise<void> {
    await page.getByTestId('sidebar-notices').click();
    await page.getByTestId('new-notice').click();
    const dialog = page.getByTestId('notice-dialog');
    await dialog.getByTestId('banner-text').fill(text);
    if (until) {
        await dialog.getByTestId('banner-until').fill(until);
        await dialog.getByTestId('banner-until').dispatchEvent('change');
    }
    await dialog.getByTestId('notice-playlists-none').click();
    for (const name of playlists) await dialog.locator('label.check', { hasText: name }).locator('input').check();
    await dialog.getByTestId('notice-save').click();
    await expect(dialog).toBeHidden();
}

/** The demo screen takes "Gottesdienst" on Sundays 9–12; a second screen "Café" has a playlist of its own. */
async function sundayAndSecondScreen(page: Page): Promise<void> {
    await page.goto('./');
    await addPlaylist(page, 'Gottesdienst');
    await page.getByTestId('nav-screens').click();
    await page.getByTestId('screen-card').first().getByTestId('open-schedule').click();
    const dialog = page.getByTestId('schedule-dialog');
    await dialog.getByTestId('add-time-rule').click();
    await dialog.getByTestId('schedule-save').click();
    await expect(dialog).toBeHidden();
    await page.getByTestId('new-screen').click();
    await page.getByTestId('new-name').fill('Café');
    await page.getByTestId('create').click();
    await expect(page).toHaveURL(/playlists\//);
    await page.getByTestId('leave-editor').click();
}

test('a running notice shows a strip for each of the next seven days; hovering a screen dims the stretches it is not on (Plan.md 69)', async ({ page }) => {
    await sundayAndSecondScreen(page);
    await page.getByTestId('sidebar-playlists').click();
    const cafePlaylist = (await page.getByTestId('playlist-card').filter({ hasText: 'Café' }).locator('h3').first().innerText()).trim();
    await addNotice(page, 'Heute Parkplatz gesperrt', ['Gottesdienst', cafePlaylist]);

    const card = page.getByTestId('notice-card').first();
    await expect(card.getByTestId('week-day')).toHaveCount(7);
    await expect(card.getByTestId('week-needle')).toHaveCount(1);
    await expect(card.getByTestId('notice-nowhere')).toHaveCount(0);
    const lines = card.getByTestId('notice-screen-line');
    await expect(lines).toHaveCount(2);

    // Nothing dimmed at first; on the demo screen's line only its Sunday morning stays lit.
    await expect(card.locator('[data-testid=week-segment][data-dim=true]')).toHaveCount(0);
    await lines.filter({ hasText: 'Foyer' }).hover();
    await expect(card.locator('[data-testid=week-segment][data-dim=false]')).toHaveCount(1);
    await expect(card.locator('[data-testid=week-segment][data-dim=true]')).not.toHaveCount(0);
    await expect(card.locator('[data-testid=week-segment][data-dim=false]')).toHaveAttribute('title', /^So 09:00–12:00: .*Foyer/);
});

test('a notice on a playlist no screen shows says so, with a pale strip (Plan.md 69)', async ({ page }) => {
    await page.goto('./');
    await addPlaylist(page, 'Ohne Fernseher');
    await addNotice(page, 'Niemand sieht mich', ['Ohne Fernseher']);
    const card = page.getByTestId('notice-card').first();
    await expect(card.getByTestId('notice-nowhere')).toHaveText('Erscheint in den nächsten 7 Tagen auf keinem Fernseher');
    await expect(card.getByTestId('week-day')).toHaveCount(7);
    await expect(card.getByTestId('week-segment')).toHaveCount(0);
    await expect(card).toContainText('auf keinem Screen');
});

test('an expired notice has no strip and says when it ended (Plan.md 69)', async ({ page }) => {
    await page.goto('./');
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    await addNotice(page, 'Schon vorbei', ['Wochenüberblick'], `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}T10:00`);
    const card = page.getByTestId('notice-card-expired').first();
    await expect(card).toContainText('abgelaufen am');
    await expect(card.getByTestId('week-timeline')).toHaveCount(0);
    await expect(card.getByTestId('notice-remove')).toBeVisible();
});
