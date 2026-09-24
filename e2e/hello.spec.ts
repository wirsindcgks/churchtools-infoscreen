import { expect, test } from '@playwright/test';

test('greets the signed-in user by first name', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('greeting')).toHaveText(/^Hallo \S+/);
});

test('unknown paths show an explanation instead of an empty page', async ({ page }) => {
    await page.goto('./gibt-es-nicht');
    await expect(page.getByRole('alert')).toBeVisible();
});

test('player without screen parameter says so', async ({ page }) => {
    await page.goto('./player');
    await expect(page.getByRole('alert')).toContainText('screen');
});
