import { expect, test } from '@playwright/test';

test('the start page opens for the signed-in user', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('screens-heading')).toHaveText('Screens');
});

test('unknown paths show an explanation instead of an empty page', async ({ page }) => {
    await page.goto('./gibt-es-nicht');
    await expect(page.getByRole('alert')).toBeVisible();
});

test('player without screen parameter says so', async ({ page }) => {
    await page.goto('./player');
    await expect(page.getByRole('alert')).toContainText('screen');
});
