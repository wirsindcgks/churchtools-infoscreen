import { expect, test } from '@playwright/test';

// The switch "Designer | Bühne" (Plan.md 121) for those who may steer the song sheet. The test login is an administrator: its visit
// creates the category `steuerung` in the demo store, so the switch shows. Pure designers do not see it – the demo cannot play that.

test.describe('switch between designer and stage on a desktop', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('leads to the stage page and back; the side one is on is no link', async ({ page }) => {
        await page.goto('./');
        const sidebarSwitch = page.locator('.module-sidebar').getByTestId('mode-switch');
        await expect(sidebarSwitch).toBeVisible();
        await expect(sidebarSwitch.getByTestId('mode-designer')).toHaveAttribute('aria-current', 'page');
        await expect(sidebarSwitch.locator('a')).toHaveCount(1);

        await sidebarSwitch.getByTestId('mode-stage').click();
        await expect(page).toHaveURL(/\/steuerung$/);
        const stageSwitch = page.getByTestId('mode-switch');
        await expect(stageSwitch.getByTestId('mode-stage')).toHaveAttribute('aria-current', 'page');

        await stageSwitch.getByTestId('mode-designer').click();
        await expect(page.getByTestId('screens-heading')).toBeVisible();
    });
});

test.describe('switch between designer and stage on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('stands above the page menu, whose panel still opens below the button', async ({ page }) => {
        await page.goto('./');
        const modeSwitch = page.getByTestId('mode-switch');
        const button = page.getByTestId('page-menu');
        await expect(modeSwitch).toBeVisible();
        const above = (await modeSwitch.boundingBox())!;
        const menu = (await button.boundingBox())!;
        expect(above.y + above.height).toBeLessThanOrEqual(menu.y);

        await button.click();
        const panel = (await page.locator('#module-pages').boundingBox())!;
        expect(panel.y).toBeGreaterThanOrEqual(menu.y + menu.height);
    });
});
