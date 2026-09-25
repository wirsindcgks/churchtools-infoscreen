import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 800 } });

test('a designer without upload rights is told which right is missing', async ({ page }) => {
    // The real answer of the instance, minus the right to edit any wiki category.
    await page.route('**/api/permissions/global', async (route) => {
        const response = await route.fetch();
        const body = (await response.json()) as { data: { churchwiki?: Record<string, unknown> } };
        body.data.churchwiki = { ...body.data.churchwiki, 'edit category': [] };
        await route.fulfill({ response, json: body });
    });
    await page.goto('./');
    const notice = page.getByTestId('missing-rights');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('bearbeiten');
    await expect(notice.locator('code')).toHaveText(['edit category']);
    // The screens stay usable: missing upload rights are no reason to lock the page.
    await expect(page.getByTestId('open-editor').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/missing-rights.png' });
});

test('a designer with all rights sees no notice', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('screens-heading')).toBeVisible();
    await expect(page.getByTestId('missing-rights')).toHaveCount(0);
});

test('only administrators see the settings and configure screens; everyone else is told whose job it is', async ({ page }) => {
    // The real answer of the instance, minus the right to manage persons and permissions.
    await page.route('**/api/permissions/global', async (route) => {
        const response = await route.fetch();
        const body = (await response.json()) as { data: { churchcore?: Record<string, unknown> } };
        body.data.churchcore = { ...body.data.churchcore, 'administer persons': false };
        await route.fulfill({ response, json: body });
    });
    await page.goto('./');
    await expect(page.getByTestId('screens-heading')).toBeVisible();
    await expect(page.getByTestId('open-setup')).toHaveCount(0);
    // Screens are the administrators' (Plan.md, F): designers open the editor, nothing more.
    await expect(page.getByTestId('new-screen')).toHaveCount(0);
    await page.getByTestId('screen-menu').first().click();
    await expect(page.getByTestId('open-player')).toBeVisible();
    await expect(page.getByTestId('screen-settings-open')).toHaveCount(0);
    await expect(page.getByTestId('delete-screen')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('open-editor').first()).toBeVisible();

    await page.goto('./einrichtung'); // the old address leads to the settings
    await expect(page).toHaveURL(/\/einstellungen$/);
    await expect(page.getByTestId('setup-admins-only')).toBeVisible();
    await expect(page.getByTestId('assistant')).toHaveCount(0);
});
