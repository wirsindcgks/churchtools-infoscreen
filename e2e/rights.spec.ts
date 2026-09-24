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
    await expect(page.getByTestId('greeting')).toBeVisible();
    await expect(page.getByTestId('missing-rights')).toHaveCount(0);
});
